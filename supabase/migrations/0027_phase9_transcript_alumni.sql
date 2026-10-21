-- Phase 9.3: Transcript and alumni
--
-- 1. Extend profiles with alumni mode and transcript verification code.
--    Graduating members can "freeze" their profile as an alumnus and receive
--    an alumni badge plus a public verification code for their contribution
--    transcript.
-- 2. Public `verify_transcript` RPC lets anyone (no login) verify a transcript
--    code against a member's frozen record.

-- ============================================================
-- Alumni + transcript columns on profiles
-- ============================================================

alter table profiles
  add column if not exists is_alumni boolean default false,
  add column if not exists alumni_badge text,
  add column if not exists transcript_code text unique,
  add column if not exists transcript_generated_at timestamptz;

create index if not exists profiles_transcript_code_idx
  on profiles (transcript_code) where transcript_code is not null;

-- ============================================================
-- Toggle alumni mode (freeze profile + issue transcript code)
-- ============================================================

create or replace function public.toggle_alumni_mode()
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_is_alumni boolean;
  v_code text;
begin
  select is_alumni into v_is_alumni
  from profiles
  where id = auth.uid();

  if not found then
    raise exception 'Profile not found';
  end if;

  if v_is_alumni then
    -- Disable alumni mode: reactivate profile, clear badge/code
    update profiles
    set is_alumni = false,
        alumni_badge = null,
        transcript_code = null,
        transcript_generated_at = null,
        updated_at = now()
    where id = auth.uid()
    returning is_alumni into v_is_alumni;
    return 'Alumni mode disabled. Profile reactivated.';
  else
    -- Enable alumni mode: freeze profile, issue badge + verification code
    v_code := 'GDU-' || upper(substring(gen_random_uuid()::text from 1 for 8));
    update profiles
    set is_alumni = true,
        alumni_badge = 'Alumni · ' || to_char(now(), 'YYYY'),
        transcript_code = v_code,
        transcript_generated_at = now(),
        updated_at = now()
    where id = auth.uid()
    returning is_alumni into v_is_alumni;
    return 'Alumni mode enabled. Transcript verification code: ' || v_code;
  end if;
end;
$$;

-- ============================================================
-- Public transcript verification (no login required)
-- ============================================================

create or replace function public.verify_transcript(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v record;
begin
  select
    p.id,
    p.display_name,
    p.username,
    p.total_exp,
    p.level,
    p.league_tier,
    p.alumni_badge,
    p.transcript_generated_at,
    b.name as branch_name,
    d.name as domain_name
  into v
  from profiles p
  left join branches b on b.id = p.branch_id
  left join domains d on d.id = p.domain_id
  where p.transcript_code = p_code
    and p.is_alumni = true;

  if not found then
    return jsonb_build_object(
      'valid', false,
      'error', 'Invalid or inactive transcript verification code'
    );
  end if;

  return jsonb_build_object(
    'valid', true,
    'member_id', v.id,
    'name', v.display_name,
    'username', v.username,
    'branch', v.branch_name,
    'domain', v.domain_name,
    'total_exp', v.total_exp,
    'level', v.level,
    'league_tier', v.league_tier,
    'alumni_badge', v.alumni_badge,
    'transcript_generated_at', v.transcript_generated_at
  );
end;
$$;
