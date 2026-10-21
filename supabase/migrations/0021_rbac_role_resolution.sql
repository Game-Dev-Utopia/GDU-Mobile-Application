-- Phase 8.3: RBAC role resolution
--
-- Problem
-- -------
-- The application resolves a user's roles from `role_assignments`, where the
-- board role is spelled 'board_member' (see 0009_role_assignments_seed.sql).
-- The database, however, checked the *denormalised* `profiles.role` column
-- and compared it against the legacy literal 'board' (see 0001_initial_schema).
-- A board member therefore failed every board-scoped RLS policy and RPC,
-- because `profiles.role` still held the signup default 'member' and no
-- profile ever carried the value 'board'.
--
-- Fix
-- ---
-- 1. `public.normalize_role(text)` folds the legacy 'board' alias onto
--    'board_member' so both vocabularies resolve to the same role.
-- 2. `public.has_role(allowed text[], uid uuid default auth.uid())` resolves
--    a role against BOTH `role_assignments` (active, unexpired) and
--    `profiles.role`, so a user's authoritative role set is always honoured.
-- 3. Every RLS policy and SECURITY DEFINER function that performed a role
--    check is rewritten to call `has_role`. Each rewrite keeps the original
--    "whose role" semantics by passing the relevant profile id through, so
--    checks against *another* member (a motion voter, a conduct case target)
--    continue to test that member and not the caller.
--
-- The rewrite is idempotent: re-running this migration matches nothing.

-- ============================================================
-- Role normalisation
-- ============================================================

create or replace function public.normalize_role(r text)
returns text
language sql
immutable
parallel safe
as $$
  select case when r = 'board' then 'board_member' else r end;
$$;

-- ============================================================
-- Effective role check
-- ============================================================

create or replace function public.has_role(allowed text[], uid uuid default auth.uid())
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_target uuid := coalesce(uid, auth.uid());
  v_norm text[];
  v_is_admin boolean := false;
begin
  if v_target is null then
    return false;
  end if;

  select coalesce(array_agg(public.normalize_role(x)), '{}')
  into v_norm
  from unnest(allowed) x;

  if cardinality(v_norm) = 0 then
    return false;
  end if;

  -- Only an admin may evaluate roles other than their own.
  if v_target is distinct from auth.uid() then
    select exists (
      select 1 from public.role_assignments ra
      where ra.profile_id = auth.uid()
        and ra.is_active
        and (ra.expires_at is null or ra.expires_at > now())
        and public.normalize_role(ra.role) = 'admin'
    ) or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and public.normalize_role(p.role) = 'admin'
    )
    into v_is_admin;

    if not v_is_admin then
      return false;
    end if;
  end if;

  -- Authoritative source: active role assignments.
  return exists (
    select 1 from public.role_assignments ra
    where ra.profile_id = v_target
      and ra.is_active
      and (ra.expires_at is null or ra.expires_at > now())
      and public.normalize_role(ra.role) = any (v_norm)
  ) or exists (
    -- Fallback: the denormalised profile role.
    select 1 from public.profiles p
    where p.id = v_target
      and public.normalize_role(p.role) = any (v_norm)
  );
end;
$$;

revoke execute on function public.has_role(text[], uuid) from public;
grant execute on function public.has_role(text[], uuid) to authenticated;
grant execute on function public.has_role(text[], uuid) to service_role;

-- ============================================================
-- Rewrite RLS policies
--
-- ALTER POLICY is used rather than DROP + CREATE so the policy keeps its
-- identity, target roles and permissive/restrictive kind. Policies written
-- without an explicit WITH CHECK keep a NULL polwithcheck, and PostgreSQL
-- falls back to the USING expression for row checks, so rewriting USING
-- alone is sufficient and keeps the two in sync.
-- ============================================================

do $$
declare
  r record;
  v_new_qual text;
  v_new_check text;
  v_count integer := 0;
  v_pattern constant text :=
    '([a-zA-Z_0-9]+)\.role = ANY \(ARRAY\[([^\]]*)\]\)';
begin
  for r in
    select n.nspname as schemaname,
           c.relname as tablename,
           p.polname as policyname,
           p.polcmd as cmd,
           pg_get_expr(p.polqual, p.polrelid) as qual,
           pg_get_expr(p.polwithcheck, p.polrelid) as with_check
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and (
        pg_get_expr(p.polqual, p.polrelid) like '%\.role = ANY (ARRAY[%'
        or pg_get_expr(p.polwithcheck, p.polrelid) like '%\.role = ANY (ARRAY[%'
      )
  loop
    v_new_qual := case
      when r.qual is null then null
      else regexp_replace(r.qual, v_pattern, 'public.has_role(ARRAY[\2], \1.id)', 'g')
    end;

    v_new_check := case
      when r.with_check is null then null
      else regexp_replace(r.with_check, v_pattern, 'public.has_role(ARRAY[\2], \1.id)', 'g')
    end;

    if r.cmd = 'a' then
      -- INSERT policies carry their check in polwithcheck.
      if v_new_check is null then
        raise exception 'INSERT policy % has no usable WITH CHECK expression', r.policyname;
      end if;
      execute format(
        'alter policy %I on %I.%I with check (%s)',
        r.policyname, r.schemaname, r.tablename, v_new_check
      );
    else
      if v_new_qual is null then
        raise exception 'Policy % has no usable USING expression', r.policyname;
      end if;
      execute format(
        'alter policy %I on %I.%I using (%s)',
        r.policyname, r.schemaname, r.tablename, v_new_qual
      );
      if v_new_check is not null then
        execute format(
          'alter policy %I on %I.%I with check (%s)',
          r.policyname, r.schemaname, r.tablename, v_new_check
        );
      end if;
    end if;

    v_count := v_count + 1;
  end loop;

  raise notice 'Rewrote % RLS policies to use public.has_role', v_count;
end;
$$;

-- ============================================================
-- Rewrite SECURITY DEFINER functions
-- ============================================================

do $$
declare
  r record;
  v_src text;
  v_new_src text;
  v_new_def text;
  v_count integer := 0;
  -- caller- or record-scoped check:
  --   exists (select 1 from profiles where id = <expr> and role in (...))
  -- The <expr> is carried through so a check against another member keeps
  -- testing that member rather than the caller.
  c_pattern_exists constant text :=
    'exists[[:space:]]*\([[:space:]]*select[[:space:]]+1[[:space:]]+from[[:space:]]+profiles[[:space:]]+where[[:space:]]+id[[:space:]]*=[[:space:]]*([^[:space:]]+)[[:space:]]+and[[:space:]]+role[[:space:]]+in[[:space:]]*\(([^)]*)\)[[:space:]]*\)';
  c_pattern_not_in constant text :=
    '([a-zA-Z_0-9]+)\.role[[:space:]]+not[[:space:]]+in[[:space:]]*\(([^)]*)\)';
  c_pattern_in constant text :=
    '([a-zA-Z_0-9]+)\.role[[:space:]]+in[[:space:]]*\(([^)]*)\)';
  c_pattern_eq constant text :=
    '([a-zA-Z_0-9]+)\.role[[:space:]]*=[[:space:]]*''([^'']*)''';
begin
  for r in
    select p.oid, p.prosrc, pg_get_functiondef(p.oid) as def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosrc ~* 'role[[:space:]]+(not[[:space:]]+)?in[[:space:]]*[()]'
  loop
    v_src := r.prosrc;
    v_new_src := v_src;

    -- 1. exists (... from profiles where id = <expr> and role in (...))
    v_new_src := regexp_replace(v_new_src, c_pattern_exists, 'public.has_role(array[\2], \1)', 'g');
    -- 2. <alias>.role not in (...)  ->  not public.has_role(array[...], <alias>.id)
    v_new_src := regexp_replace(v_new_src, c_pattern_not_in, 'not public.has_role(array[\2], \1.id)', 'g');
    -- 3. <alias>.role in (...)      ->  public.has_role(array[...], <alias>.id)
    v_new_src := regexp_replace(v_new_src, c_pattern_in, 'public.has_role(array[\2], \1.id)', 'g');
    -- 4. <alias>.role = 'x'        ->  public.has_role(array['x'], <alias>.id)
    v_new_src := regexp_replace(v_new_src, c_pattern_eq, 'public.has_role(array[''\2''], \1.id)', 'g');

    if v_new_src is distinct from v_src then
      v_new_def := replace(r.def, r.prosrc, v_new_src);
      execute v_new_def;
      v_count := v_count + 1;
    end if;
  end loop;

  raise notice 'Rewrote % SECURITY DEFINER functions to use public.has_role', v_count;
end;
$$;
