# GDU XP: database API (RPCs)

Generated from `supabase/migrations/*.sql` on 2026-10-21 (latest definition of each function wins). Regenerate or edit by hand when migrations change; keep **one line per function**.

Rules for callers: the app calls these through `supabase.rpc(name, args)` (wrapped in `src/lib/api.ts`). Never write to ledger or governance tables directly. `definer` = SECURITY DEFINER (runs with owner rights, so it must check `auth.uid()` and roles itself).


## client RPC

| Function | Arguments | Returns | Migration | Definer |
|---|---|---|---|---|
| `add_to_coach_plan` | `p_member_id uuid, p_activity_type_id uuid, p_activity_title text, p_activity_category text, p_activity_domain uuid, p_exp_reward integer, p_day_of_week integer` | `uuid` | 0002 | yes |
| `appoint_conduct_panel_member` | `p_profile_id uuid` | `text` | 0018 | yes |
| `approve_activity_proposal` | `p_proposal_id uuid, p_approve boolean, p_reason text` | `text` | 0005 | yes |
| `approve_cash_release` | `p_release_id uuid, p_approve boolean` | `text` | 0015 | yes |
| `assign_league_tier` | `p_profile_id uuid` | `void` | 0003 | no |
| `assign_permission_bundle_holder` | `p_bundle_name text, p_holder_type text, p_holder_id uuid, p_holder_group text, p_motion_id uuid` | `text` | 0020 | yes |
| `award_badge` | `p_member_id uuid, p_badge_id uuid` | `void` | 0006 | yes |
| `board_ratify_conduct_case` | `p_case_id uuid, p_ratified boolean, p_reason text` | `text` | 0013 | yes |
| `cast_ballot` | `p_motion_id uuid, p_vote text` | `text` | 0028 | yes |
| `check_and_award_badges` | `p_member_id uuid` | `void` | 0006 | yes |
| `claim_quest_reward` | `p_member_quest_id uuid` | `integer` | 0007 | yes |
| `classify_jurisdiction` | `p_case_id uuid, p_classifier_id uuid, p_classification text` | `text` | 0016 | yes |
| `close_feedback_360_cycle` | `p_cycle_id uuid` | `text` | 0019 | yes |
| `compute_motion_result` | `p_motion_id uuid` | `jsonb` | 0012 | yes |
| `confirm_claim` | `p_claim_id uuid, p_confirm boolean` | `text` | 0004 | yes |
| `decide_branch_override` | `p_override_case_id uuid, p_decider_id uuid, p_decision text, p_decision_reason text, p_board_yes_votes integer, p_board_total_votes integer` | `text` | 0017 | yes |
| `decide_branch_override_appeal` | `p_appeal_id uuid, p_decider_id uuid, p_status text, p_decision_reason text` | `text` | 0017 | yes |
| `decide_conduct_case_appeal` | `p_appeal_id uuid, p_decider_id uuid, p_status text, p_decision_reason text` | `text` | 0018 | yes |
| `dismiss_notification` | `p_notification_id uuid` | `text` | 0002 | yes |
| `feature_flag_mode` | `p_key text` | `text` | 0024 | yes |
| `file_branch_override_appeal` | `p_override_case_id uuid, p_appellant_id uuid, p_appeal_reason text` | `text` | 0017 | yes |
| `file_conduct_case` | `p_member_id uuid, p_reason_code text, p_severity text, p_description text, p_evidence_links text[]` | `uuid` | 0013 | yes |
| `file_conduct_case_appeal` | `p_conduct_case_id uuid, p_appellant_id uuid, p_appeal_reason text` | `text` | 0018 | yes |
| `file_penalty` | `p_member_id uuid, p_activity_type_id uuid, p_severity text, p_exp_deduction integer, p_description text, p_evidence_urls text[], p_response_deadline timestamptz` | `uuid` | 0002 | yes |
| `finalize_claim` | `p_claim_id uuid` | `void` | 0028 | yes |
| `get_coin_balance` | `p_member_id uuid` | `integer` | 0014 | yes |
| `get_or_create_member_quest` | `p_member_id uuid, p_quest_id uuid` | `uuid` | 0007 | yes |
| `grant_role` | `p_profile_id uuid, p_role text, p_scope text, p_scope_entity_id uuid default null, p_expires_at timestamptz default null, p_reason text default null` | `uuid` | 0024 | yes |
| `import_csv_claims` | `p_job_id uuid, p_claims jsonb` | `jsonb` | 0026 | yes |
| `list_activity_proposals` | `—` | `setof activity_proposals` | 0005 | yes |
| `list_my_review_queue` | `—` | `setof claims` | 0028 | yes |
| `mark_coach_not_for_me` | `p_activity_type_id uuid` | `text` | 0002 | yes |
| `mark_notification_read` | `p_notification_id uuid` | `text` | 0002 | yes |
| `mediate_deadlock` | `p_case_id uuid, p_mediator_id uuid, p_resolution text` | `text` | 0016 | yes |
| `open_motion` | `p_motion_id uuid` | `void` | 0028 | yes |
| `panel_review_conduct_case` | `p_case_id uuid, p_decision text, p_reason text` | `text` | 0013 | yes |
| `prepare_cash_release` | `p_recipient_id uuid, p_amount_cents integer, p_currency text, p_purpose text, p_justification text, p_ledger_entry_ids uuid[], p_authority text` | `uuid` | 0015 | yes |
| `process_redemption` | `p_redemption_id uuid, p_approve boolean, p_tracking_info text` | `text` | 0014 | yes |
| `propose_activity` | `p_name text, p_category text, p_subcategory_id uuid, p_domain_id uuid, p_kind text, p_exp_min integer, p_exp_max integer, p_season_cap integer, p_difficulty integer, p_evidence_required boolean, p_approvers_needed integer, p_description text, p_justification text` | `uuid` | 0005 | yes |
| `publish_admin_config_version` | `p_version_label text, p_effective_from timestamptz, p_config jsonb, p_notes text default null` | `uuid` | 0024 | yes |
| `recuse_panel_member` | `p_case_id uuid, p_reason text` | `text` | 0018 | yes |
| `release_cash` | `p_release_id uuid` | `text` | 0015 | yes |
| `remove_from_coach_plan` | `p_plan_item_id uuid` | `text` | 0002 | yes |
| `request_leave_of_absence_freeze` | `p_member_id uuid, p_reason text, p_start_date date, p_end_date date, p_freeze_reason text` | `text` | 0018 | yes |
| `request_redemption` | `p_member_id uuid, p_reward_id uuid` | `uuid` | 0014 | yes |
| `respond_to_conduct_case` | `p_case_id uuid, p_response_text text` | `text` | 0013 | yes |
| `review_claim` | `p_claim_id uuid, p_score integer, p_reason text` | `text` | 0001 | yes |
| `revoke_role` | `p_role_assignment_id uuid, p_reason text default null` | `text` | 0024 | yes |
| `search_members` | `p_query text default '', p_limit integer default 20` | `table (id uuid, username text, display_name text, avatar_url text, branch_id uuid)` | 0029 | yes |
| `set_feature_flag` | `p_key text, p_mode text, p_reason text default null` | `text` | 0024 | yes |
| `sign_recall_petition` | `p_petition_id uuid, p_signer_id uuid` | `text` | 0016 | yes |
| `submit_branch_override_right_of_reply` | `p_override_case_id uuid, p_respondent_role text, p_respondent_id uuid, p_reply_text text` | `text` | 0017 | yes |
| `submit_claim` | `p_activity_type_id uuid, p_title text, p_description text, p_activity_date date, p_evidence_links text[], p_suggested_exp integer, p_analysis_pointers text, p_contributors jsonb, p_submitted_on_behalf_of uuid default null` | `uuid` | 0029 | yes |
| `submit_feedback_360_response` | `p_cycle_id uuid, p_target_id uuid, p_communication integer, p_reliability integer, p_fairness integer, p_leadership integer, p_comment text` | `text` | 0019 | yes |
| `submit_right_of_reply` | `p_motion_id uuid, p_respondent_id uuid, p_reply_text text` | `text` | 0016 | yes |
| `toggle_alumni_mode` | `—` | `text` | 0027 | yes |
| `toggle_integration` | `p_provider text, p_connected boolean` | `text` | 0026 | yes |
| `update_notification_settings` | `p_in_app boolean, p_discord_dm boolean, p_email boolean, p_quiet_hours_start time, p_quiet_hours_end time, p_max_proactive_nudges_per_week integer, p_auto_pause_on_leave boolean, p_auto_pause_on_exams boolean, p_leave_until timestamptz, p_exam_until timestamptz` | `text` | 0002 | yes |
| `update_redemption_status` | `p_redemption_id uuid, p_new_status text, p_tracking_info text` | `text` | 0020 | yes |
| `verify_transcript` | `p_code text` | `jsonb` | 0027 | yes |

## server-side/helper

| Function | Arguments | Returns | Migration | Definer |
|---|---|---|---|---|
| `appeal_penalty` | `p_penalty_id uuid, p_appeal_text text, p_evidence_urls text[]` | `uuid` | 0002 | yes |
| `award_coins` | `p_member_id uuid, p_amount integer, p_source text, p_reference_id uuid, p_description text` | `void` | 0014 | yes |
| `can_be_sole_approver` | `p_profile_id uuid` | `boolean` | 0025 | yes |
| `claim_chain_rank` | `p_user uuid` | `integer` | 0029 | yes |
| `compute_all_standings` | `—` | `void` | 0010 | yes |
| `compute_branch_health` | `—` | `void` | 0011 | yes |
| `decide_penalty` | `p_penalty_id uuid, p_decision text, p_decision_reason text` | `text` | 0002 | yes |
| `effective_admin_config` | `—` | `jsonb` | 0024 | yes |
| `get_member_standing` | `p_member_id uuid` | `record` | 0010 | yes |
| `has_role` | `allowed text[], uid uuid default auth.uid()` | `boolean` | 0021 | yes |
| `log_role_assignment_change` | `—` | `trigger` | 0024 | yes |
| `respond_to_penalty` | `p_penalty_id uuid, p_response_text text, p_evidence_urls text[]` | `text` | 0002 | yes |
| `reverse_entry` | `p_ledger_entry_id uuid, p_reason text` | `void` | 0001 | yes |
| `review_appeal` | `p_appeal_id uuid, p_status text, p_review_notes text` | `text` | 0002 | yes |
| `review_penalty` | `p_penalty_id uuid, p_review_notes text` | `text` | 0002 | yes |
| `spend_coins` | `p_member_id uuid, p_amount integer, p_source text, p_reference_id uuid, p_description text` | `void` | 0014 | yes |
| `sync_admin_config_to_runtime` | `p_version_label text, p_effective_from timestamptz, p_config jsonb, p_actor uuid` | `void` | 0024 | yes |
| `trigger_branch_override` | `p_branch_id uuid` | `void` | 0011 | yes |
| `update_all_league_tiers` | `—` | `void` | 0003 | no |
| `update_quest_progress` | `p_member_id uuid, p_quest_id uuid, p_increment integer default 1` | `void` | 0007 | yes |
| `validate_admin_config` | `p_config jsonb` | `void` | 0024 | no |

## trigger/helper

| Function | Arguments | Returns | Migration | Definer |
|---|---|---|---|---|
| `block_ledger_changes` | `—` | `trigger` | 0001 | no |
| `current_user_domain_id` | `—` | `uuid` | 0023 | yes |
| `enforce_proof_limits` | `—` | `trigger` | 0029 | no |
| `guard_profile_privileged_columns` | `—` | `trigger` | 0028 | no |
| `handle_new_user` | `—` | `trigger` | 0001 | yes |
| `normalize_role` | `r text` | `text` | 0021 | yes |
| `on_claim_approved` | `—` | `trigger` | 0006 | no |
| `on_claim_approved_for_quests` | `—` | `trigger` | 0007 | no |
| `on_ledger_entry_insert` | `—` | `trigger` | 0003 | no |

## Views read directly by the client

| View | Purpose | Notes |
|---|---|---|
| `my_ledger_view` | The signed-in member's ledger rows | security_invoker; created again in 0029 |
| `season_leaderboard_view` | Season EXP per member | owner-run on purpose, signed-in users only |
| `member_standing_view`, `member_category_standing_view` | Rolling-window Standing | security_invoker; members see only their own rows |
| `current_branch_health_view` | Branch health snapshot | owner-run, signed-in only |
| `motion_summary_view` | Vote tallies | owner-run, signed-in only |
| `feedback_360_summary` | 360 averages (only with 3+ respondents) | owner-run, signed-in only |

## Storage

- Bucket `claim_proofs` (private). Path `claims/<claim_id>/<uuid>.<ext>`. Shown to users through signed URLs (1 hour). Limits (enforced by trigger on `proof_files`): 5 files per claim, 2 MB each, JPG/PNG/WebP/MP4/WebM.

## Error handling convention

RPCs raise plain-language exceptions (`raise exception 'Cannot review your own claim'`). The client throws `new Error(error.message)` and pages show the message as-is. Keep messages human-readable.

## Authorization notes

Migration 0030 (written, applied only when the owner confirms) makes these internal-only and adds caller-scoped wrappers:

| Internal (no client EXECUTE) | Client wrapper |
|---|---|
| `award_badge(member, badge)` | `admin_award_badge(member, badge)` (admin/board only) |
| `check_and_award_badges(member)` | `check_my_badges()` |
| `get_or_create_member_quest(member, quest)` | `ensure_my_quest(quest)` |
| `update_quest_progress(...)` | none (triggers only) |
| `assign_league_tier(profile)`, `update_all_league_tiers()` | `refresh_my_league_tier()` |

`add_to_coach_plan` now requires `p_member_id = auth.uid()`. `claim_quest_reward` now requires ownership and locks the row. The table above is generated from 0001-0029; wrappers from 0030 are not in it yet.

Still open: `compute_motion_result` ignores class weights and quorum (see REMAINING_WORK_PROMPTS.md, E1); `claim_quest_reward` marks a quest claimed but does not itself pay out XP or Coins.
