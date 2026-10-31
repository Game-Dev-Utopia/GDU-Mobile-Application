# GDU XP: rules (read before every change)

Plain-text version of `GDU_XP_System__Consolidated_Architecture_v1` and the AI-builder plan, plus the rules this codebase has learned the hard way. If code and this file disagree, the code is wrong unless the rules owner changes this file.

## 1. Architecture: thin UI, thick database
- Postgres owns the rules: triggers, constraints, row-level security (RLS), and SECURITY DEFINER SQL functions. The browser only draws screens and calls existing RPCs (listed in `docs/API.md`).
- Do not compute awards, caps, tallies, standings or eligibility in the browser. If a number is shown, it comes from a view or RPC.
- An AI model may only *word* messages (digests, nudges). It never calculates or invents numbers.
- Schema and security changes are SQL migrations in `supabase/migrations/NNNN_name.sql`, reviewed by a second person, applied with `node scripts/run-migrations.mjs <number>`. No hand edits to the database. The live database has drifted from the early migration files before (missing `profiles.is_active`, `my_ledger_view`), so check before assuming a column exists.

## 2. Entrenched principles (only a constitutional motion can change these)
1. The ledger is append-only. Corrections are reversing entries, never edits or deletes (trigger `ledger_no_update`).
2. Nobody approves their own EXP, or a split they benefit from. Nobody in a claim's split can review it.
3. Every penalty has notice, a right to respond, review and appeal.
4. Cash leaves only through the Finance & Compliance function (Board for now): maker-checker, two different board members, neither the recipient, within caps. Cash stays off until a CS/CA confirms the structure.
5. Board, council and faculty are rated by the same system as members.
6. EXP can never be transferred between people.

## 3. Three numbers
| Number | Meaning | Changes by | Drives |
|---|---|---|---|
| EXP | Lifetime impact | Approved awards, penalties | Levels, privileges, profile, transcript |
| Standing | Recent activity health | Rolling 90-day window of EXP with half-life decay | Position minimums, probation, branch health |
| GDU Coins | Spendable wallet | Earned as a percentage of EXP gained | Rewards, Spot Awards |

Categories (Technical, Social, Soft, Management) tag every EXP entry. Effort data is private to the member and their lead and is never ranked. Leagues never feed Standing or probation.

## 4. Earning EXP
- Flow: claim, evidence, **blind review** (approvers score first and see the suggested EXP only after), approval by 1, 2 or board majority depending on the activity, immutable ledger entry counted on the activity date.
- Rubric per activity type: EXP min/max, category, season cap, diminishing returns, evidence required, approvers needed. The impact multiplier within the range scores reach, magnitude, durability and verifiability.
- Approvers have monthly award budgets and are rated on patterns (always max, always reject).
- Splits must total exactly 100% and every contributor must co-sign. Unvested share returns to the project pool when someone leaves.
- Spot Award: the sender pays one third of the award from Standing or Coins (config), with a monthly budget, a per-recipient cap and reciprocal-pair detection. Kudos: small monthly budget.
- Referrals vest after 60 to 90 days; donations earn Patron recognition, not EXP; little or no EXP for winning elections.
- Submitting on behalf of someone: only people above them in the chain (Member, Team Lead/Domain Head, Council, Board), within their own domain/branch. The member must confirm or dispute.

## 5. Roles
Member, Senior Member, Team Lead, Domain Head, Council Member, Board Member (5), Faculty, Independent Contributor, plus system roles Admin (held by a board member), Finance & Compliance Officer, Conduct Panel Member, Auditor, Partner Rep. One person can hold several roles, each with a scope (org, branch, domain, team). Use `has_role(array[...], auth.uid())` in SQL and `src/lib/permissions.ts` (`can`, `canAnyScope`, `<RequireRole>`) in the app. Never compare `profiles.role` directly in new code. Users must never be able to change their own role, EXP or level (trigger `profiles_guard_privileged`).

Partner Reps never see EXP, leaderboards or votes, and can never be the sole approver.

## 6. Governance
- Three lists: **Org** (Board, 3 of 5), **Branch** (Board and Council as two chambers, both must pass), **Concurrent** (Board 40%, Council 35%, Members 25%). Unlisted matters default to concurrent. Matters about the board are always concurrent.
- One person, one vote within a class. EXP never weights a vote. Quorum: board 3 of 5, council 50%.
- Ordinary motion: over 50% of weight cast. Serious or constitutional: 2/3 weighted plus a majority in both board and council. Recall: 2/3 weighted and at least 2 of the other 4 board members, accused recused.
- Deadlock ladder: status quo, mediator, re-vote at higher quorum, motion falls. A disputed classification goes to three faculty mediators within 72 hours, defaulting to concurrent.
- Ballots are inserted only by `cast_ballot()`, which derives chamber and weight on the server.

## 7. Branch health, conduct, probation
- Branch stages: Healthy, Watch, Recovery plan, Board review, Decision. Board decision only; the affected branch's board members recuse; one appeal on procedure.
- Members: Standing below the minimum for 3 months in a year enters Probation (not automatic removal): Healthy, At risk, Probation (support plan), Conduct Panel hearing, decision with board ratification, appeal. Leave-of-absence freeze and a 60-day grace for new position holders.
- Conduct Panel: 5 seats (1 board, 2 council from other branches, 1 faculty, 1 member rep), conflicts recused. Sensitive case details are hidden from non-panel roles.
- 360 feedback: anonymous, quarterly, shown only with at least 3 respondents, informs reviews, never triggers a penalty alone.
- Enforcement (Standing enforcement, pink-slip, branch override, cash) starts in **shadow mode**; flags are advisory until switched Live.

## 8. Security rules (the RLS checklist; run before every release)
1. Every table has RLS enabled. No policy says "any authenticated user can read all rows" for personal, financial or conduct data.
2. Writes to ledger, claims, ballots, motions, approval items and penalties go through RPCs only. No client insert/update policies on them.
3. Views over personal data use `security_invoker = true`. No view is readable by `anon`.
4. SECURITY DEFINER functions set `search_path = public, pg_temp`, check `auth.uid()`, and never trust a member id supplied by the client unless the caller is allowed to act for that member.
5. Test with one seeded user per role (member, team lead, domain head, council, board, faculty, partner rep, auditor): try to read and write what they should not.
6. Secrets: the Discord client secret and the Supabase service-role key are server-only. Never use the `NEXT_PUBLIC_` prefix for secrets.
7. Every state change writes an `audit_log` row. Only Auditor/Admin read it.
8. Proof uploads: JPG, PNG, WebP, MP4, WebM; 2 MB each; 5 per claim; private bucket with signed URLs.

## 9. Config, not code
Weights, caps, thresholds, class shares, quorums, league sizes and list schedules are versioned config (`config_versions`, `admin_config_versions` and the runtime tables). A change never rewrites history; ledger entries record the config version used.

## 10. Process
- Roles for the team: rules owner (decides policy and acceptance tests), database and security owner (writes and reviews migrations and RLS), UI driver (only one person prompts the builder at a time, on a feature branch), QA (seeds test users per role and tries to break things).
- No migration or RLS change merges without a second reviewer. Test on the staging Supabase project before production.
- Every AI prompt starts with: "Read docs/RULES.md and docs/API.md. Do not change existing policies, functions or the ledger rules unless the task says so. Use only the RPCs listed in docs/API.md, and add new ones in a new migration."
- Keep prompts to one screen or feature; review diffs before merging.

## 11. Open items for the board and a CS or CA
Whether the Articles recognise app-based votes and board recall; how cash honorariums should be structured for a Section 8 company; the weight of each branch-health component; the initial Coin conversion rate; a signed transcript format colleges accept; DPDP Act review of the privacy policy. Rubric ranges, the Standing half-life, position minimums and the branch floor are starting guesses to be tuned during the shadow season.
