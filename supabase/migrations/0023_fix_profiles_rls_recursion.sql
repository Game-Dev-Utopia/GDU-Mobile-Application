-- Phase 8.5: Fix RLS recursion on profiles
--
-- profiles_board_read and profiles_domain_read each contained a subquery on
-- `profiles` itself. PostgreSQL refuses to evaluate a policy that references
-- its own relation, so every authenticated read against `profiles` failed
-- with "infinite recursion detected in policy for relation profiles" --
-- and with it every read of cash_releases, permission_bundle_holders and
-- audit_log, whose policies look up the caller's profile row.
--
-- The lookup is replaced by SECURITY DEFINER helpers, which read the tables
-- as the owner and therefore do not re-enter RLS.
--
-- A member must also be able to read their own profile: the application
-- resolves the signed-in user with a SELECT on profiles, and the only
-- existing SELECT policies were scoped to board members and domain staff.

-- Caller's domain, read as the table owner so RLS is not re-entered.
create or replace function public.current_user_domain_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select p.domain_id from public.profiles p where p.id = auth.uid();
$$;

revoke execute on function public.current_user_domain_id() from public;
grant execute on function public.current_user_domain_id() to authenticated;
grant execute on function public.current_user_domain_id() to service_role;

-- Board / admin may read every profile.
drop policy if exists profiles_board_read on profiles;
create policy profiles_board_read on profiles
  for select using (
    public.has_role(array['board', 'board_member', 'admin'], auth.uid())
  );

-- Domain staff may read profiles in their own domain.
drop policy if exists profiles_domain_read on profiles;
create policy profiles_domain_read on profiles
  for select using (
    public.has_role(array['domain_head', 'team_lead', 'board', 'board_member', 'admin'], auth.uid())
    and profiles.domain_id = public.current_user_domain_id()
  );

-- Every member may read their own profile.
drop policy if exists profiles_read_own on profiles;
create policy profiles_read_own on profiles
  for select using (auth.uid() = id);
