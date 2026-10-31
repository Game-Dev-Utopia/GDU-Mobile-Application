# GDU XP: remaining work as AI prompts

Status as of 2026-10-21. Migrations 0001–0029 are applied. `tsc` is clean and `next build` passes.
Run the prompts in order, one at a time, and review each result before the next.
Nothing below has been exercised in a browser or against real users yet.

## How to use this file
1. Paste the **Common prefix** at the start of every prompt.
2. Paste one prompt below it. Keep each prompt to one screen or one feature.
3. After each prompt: run `npx tsc --noEmit`, `npm run build`, and apply the new migration with `node scripts/run-migrations.mjs <number>`.
4. The next free migration number is **0030**.

## Common prefix (paste before every prompt)

```
Project: GDU XP, a community contribution tracker. Next.js 15 (App Router), React 19, TypeScript, Tailwind, Supabase (Postgres + Auth + Storage). The app is in GDU_XP/. Read AUDIT_REPORT.md, USER_TASKS.md and src/lib/api.ts first.

Architecture rules (do not break):
- Thin UI, thick database. Business rules live in Postgres: triggers, constraints, RLS, and SECURITY DEFINER functions with `set search_path = public, pg_temp`. The browser calls RPCs or reads RLS-protected tables/views. It never computes awards, tallies or caps itself.
- ledger_entries is append-only (trigger blocks UPDATE/DELETE). Only SQL functions write to it. Corrections insert a reversing row.
- No self-approval, and nobody in a claim's split can review it. Approvers must not see the claimant's suggested EXP before scoring (use list_my_review_queue(), which blanks it).
- Every new table needs RLS enabled, with no policy that lets "any authenticated user read all rows" unless the data is genuinely public. Write with RPCs only. Every new view reading personal data uses `with (security_invoker = true)`; revoke all from anon.
- Roles are resolved with public.has_role(array[...], auth.uid()). Never compare profiles.role directly in new policies.
- Every state change writes an audit_log row.

Repo conventions:
- New SQL goes in supabase/migrations/NNNN_name.sql (next number: 0030). Make migrations re-runnable (drop policy if exists, create or replace, if not exists). The live database does NOT exactly match the earlier migration files (for example profiles.is_active and my_ledger_view were missing), so never assume a column exists: inspect with to_jsonb(row) ->> 'col' or `to_regclass`, and verify against the live DB before relying on it. Apply with `node scripts/run-migrations.mjs <number>`; each migration runs in one transaction.
- Client data access goes in src/lib/api.ts (typed async functions, snake_case DB to camelCase, throw Error(error.message) on writes). Guard pages with <RequireRole> from src/components/RequireRole.tsx and the matrix in src/lib/permissions.ts. Wrap pages in <AppLayout activePath="...">.
- Icons: lucide-react is typed by the local shim src/types/lucide.d.ts. Add any new icon name there (and confirm the icon exists in the installed package at runtime; Github does not).
- Style: dark-first design tokens already in tailwind.config.js (text-ink, text-mute, bg-card, border-line, bg-accent). Keep mobile-first, accessible (labels, focus states, aria-live for errors, reduced motion).
- Do not enable ignoreBuildErrors. Finish with `npx tsc --noEmit` and `npm run build` passing.
- Do not touch the database directly except through the migration runner, and do not print secrets from .env.

At the end, report: files changed, migration number, new RPCs/tables, what you could not verify.
```

---

## A. Finish Phase 1: the core claim loop

### A1. Approver budgets, caps and diminishing returns (database)
```
Add migration 0030. Enforce, inside finalize_claim() in the same transaction as the ledger insert:
1. Season cap per activity type: activity_types.season_cap is the max total EXP one member can earn from that activity per season. Cut the award so the cap is not exceeded. Return the capped amount.
2. Diminishing returns where activity_types.diminishing_returns is true: each repeat of the same activity by the same member in the season earns 100%, 75%, 50%, then 25% of the score. Keep the multipliers in config (a config_versions row or a new table), not in code.
3. Monthly approver budget: a table approver_budgets(approver_id, month, budget_exp, used_exp) with a configurable default per role. review_claim() must reject a score that would exceed the remaining budget. Use row locking to avoid races.
Also: add a "season" definition (start/end dates in config) and replace the "last 14 days" hack in season_leaderboard_view. Document every new function in docs/API.md (create it if missing: one line per RPC with inputs and outputs).
```

### A2. Two-approver rule and "big gap" escalation
```
Add migration 0031. activity_types.approvers_needed is 1, 2 or board. Extend review_claim()/finalize_claim() so:
- claims need N independent reviewers (different people, none in the split, none the claimant);
- final score = the median/average per a config rule;
- if two approvers' scores differ by more than a configurable percentage of the range, or one reviewer's score differs from the suggested EXP by that much, set claim status to 'escalated' and require one more reviewer;
- "board" approvers_needed requires one board member.
Add a table claim_reviews(claim_id, reviewer_id, score, reason, impact ratings reach/magnitude/durability/verifiability 1-5, created_at) with RLS (the reviewer and the board/auditor can read; the claimant sees reviews only after the final decision). Write only through the RPC. Blind-then-reveal: a reviewer can read the claimant's suggested EXP only after submitting their own score (create RPC get_claim_for_review(claim_id) that blanks it before then, and a view for the reveal).
```

### A3. Review Queue UI
```
Rebuild src/app/review/page.tsx. Queue sorted by age with a "waiting N days" badge. Claim detail page /review/[id] showing description, evidence links, proof gallery (signed URLs via getProofFiles), contributors/split, activity range and category, but NOT the suggested EXP. Include a score slider within the activity range, four impact ratings (reach, magnitude, durability, verifiability) with tooltips, a required reason, and a monthly award budget meter. Block with a clear message if the user is the claimant or in the split. After submitting, reveal "suggested vs your score"; if the backend returns 'escalated', show "sent to a second approver". Add a "Report this proof" button (see N2). Use only the RPCs from A1/A2.
```

### A4. My Claims
```
Upgrade src/app/my-claims. Tabs: All, Pending, Approved, Needs info, Rejected. Each claim shows a status timeline (Submitted, In review, Decided), awarded vs suggested EXP, and the approver's reason once decided. Allow: edit before review starts, withdraw, and add evidence (links and files via uploadProof) while status is submitted. Add SQL RPCs edit_claim, withdraw_claim and add_claim_evidence (migration 0032) that only the claimant or submitter can call and only while no review exists. On approval play a celebration (count-up of XP plus a "+X Technical" chip; respect prefers-reduced-motion). Add a "Recommend a teammate" form (member, activity, why) backed by a recommendations table and an RPC that notifies the member. Show the Confirm/Dispute buttons (confirmClaim) for claims awaiting the member's confirmation.
```

### A5. Admin: activity types
```
Complete src/app/admin/page.tsx. Table + edit drawer: name, category, subcategory, domain tags, EXP min/max, season cap, diminishing returns toggle, evidence required, approvers needed (1, 2, board), active toggle. Add version history: a trigger writes every change to activity_type_versions (migration 0033), and the drawer shows the history with who changed what. Changes must go through an RPC upsert_activity_type that requires roles.manage at org scope (admin/board) and writes audit_log. Make "Propose a new activity" (the existing /activities/propose flow) appear at the bottom of every activity dropdown in the claim wizard.
```

---

## B. Phase 2: Home, profile, leaderboard

### B1. Home dashboard
```
Rebuild src/app/components/HomeContent.tsx as the daily hub, all data from SQL views/RPCs (create get_home_summary() in migration 0034): greeting and weekly streak flame, a level ring with XP to next level, a Today card with 3 suggested actions (use the coach recommendations), pending items (claims waiting on me, reviews waiting for me, confirmations), a league card (tier, rank, countdown to week end), a Recent wins community feed ("Aditi shipped a jam game +120 XP", only from opted-in members), and an upcoming events strip. One primary action button per card. Pinned announcements appear at the top.
```

### B2. Profile
```
Rebuild src/app/profile/page.tsx and add /profile/[id] for other members (public parts only). Show: banner, avatar with a level-based frame, title and badge, level and XP bar, EXP-by-category radar from my_ledger_view, a badge shelf, season stats, position and branch, and a read-only contribution timeline with category and period filters. Add privacy toggles (public profile, show on leaderboards, appear in Wins feed) stored on profiles via an RPC set_privacy_prefs (migration 0035). Never show Standing or zones on public views. Imported entries show an "imported" tag with a tooltip.
```

### B3. Leaderboard
```
Rebuild src/app/leaderboard/page.tsx. Animated top-3 podium, ranked list with rank-change arrows (store weekly rank snapshots in a table via a scheduled function, see S1), filter chips Group (My team, Same level, My branch, All) and Period (Bi-weekly, Monthly, Quarterly, Half-yearly, Yearly), tabs Season EXP and Lifetime EXP, the "You" row pinned at the bottom, percentile bands instead of raw ranks in cross-branch views, and respect the show-on-leaderboards opt-out in SQL (the view must exclude opted-out members for everyone else). Make the leaderboard SQL take a period parameter instead of the fixed 14-day window.
```

---

## C. Phase 3: Game layer

### C1. League cohorts (database)
```
Migration 0036. Implement weekly league cohorts: tables league_cohorts and league_cohort_members; a function assign_league_cohorts() that groups members of the same tier into cohorts of 15 mixed across branches; compute weekly EXP per member; close_league_week() promotes the top 5, relegates the bottom 3 (demotion shield on the lowest tier), writes league_results rows, and notifies members. Tier names: Pixel, Sprite, Voxel, plus locked Shader, Engine, Utopia (unlock when active-member counts reach config values 80/150/250). Replace the placeholder tier name 'obsidian' used in the Discord signup flow and profiles.league_tier default with the real first tier. Add a pg_cron job (see S1) to close the week every Monday 00:00 IST.
```

### C2. Leagues UI
```
Rebuild src/app/leagues/page.tsx: tier ladder Pixel to Sprite to Voxel plus locked silhouettes for Shader, Engine and Utopia; the member's cohort of 15 with the top 5 in a green promotion zone, the bottom 3 in a red relegation zone, a countdown to week end, a shield indicator on the lowest tier, and a weekly result modal (promoted, stayed, demoted). Tabs for Branch League (EXP per active member) and Team League.
```

### C3. Quests, streaks and freezes
```
Migration 0037 + src/app/quests/page.tsx. Add weekly streaks (a week counts if the member had at least one approved EXP or a quest completion), freeze tokens earned by milestones and spendable in exam weeks (RPC spend_freeze_token), a calendar heat map of active weeks, three weekly quest cards with progress and rewards (XP or Coins), one shared team quest, and a seasonal quest line. Quest progress must be computed in SQL from ledger/claims, not in the browser. Completing a quest triggers a small celebration.
```

### C4. Badges, levels, seasons
```
Add: badge gallery with locked silhouettes showing how to earn each, and rarity tiers; a full-screen level-up celebration with confetti showing the new perk or frame (trigger from a level change detected server-side, exposed via an unseen_level_ups view); a Season page with countdown, season title rewards, a profile frame and title picker, and an archive of past seasons. Create season tables and an Admin rollover RPC in the same migration set (see S3).
```

---

## D. Phase 4: Projects, recognition, events

### D1. Projects and splits
```
Migration 0038 + /projects. Tables: projects, project_members (role: Lead, Dev, Designer, Tester, PM, Marketer; share_percent; cosigned_at; vested), project_pool, project_log. Rules in SQL: shares must total 100 and every member must co-sign before the project can award; leaving returns the unvested share to the pool; "Request impact top-up" creates an approval item. UI: list and create, project page with members and roles, split editor with a co-sign chip per member, pool total, activity log, and a Leave project flow showing where the unvested share goes. Partner reps may co-sign splits but never see EXP.
```

### D2. Spot Awards, Kudos, Wall of Thanks
```
Migration 0039. Spot Award RPC give_spot_award(member, reason, amount): cost to the sender is one third of the award taken from Standing or Coins, with per-recipient and monthly caps from config, no self-awards, no reciprocal-ring abuse (record for integrity checks, see N3). Kudos: 5 per month with emoji tags. Wall of Thanks: public feed with reactions. UI pages: Spot Award form with the sender's monthly budget meter and cap warnings; Kudos; Wall of Thanks. Spot awards over a threshold go to the Approvals inbox (add item_type 'spot_award' handling to the approvals page).
```

### D3. Events
```
Migration 0040 + /events. Tables: events (linked to an activity type), rsvps, check-ins. Hosts get a 6-digit check-in code (rotate/expire) and attendees check in with it via an RPC that rate-limits attempts. UI: calendar and list (upcoming, past), cards with category and a potential-XP chip ("Up to +60 XP") plus RSVP, a host form, an event page with attendee avatars, and after the event a "Claim your XP" prompt that opens the claim wizard prefilled. Show the Coach impact-preview chip on event cards.
```

---

## E. Fixes to Phases 5–9 (known problems)

### E1. Voting weights and tallies
```
compute_motion_result() in migration 0012 sums raw ballot counts and ignores the class weights (Board 40%, Council 35%, Members 25%) and quorum (Board 3 of 5, Council 50%). Replace it (new migration) with a function that: computes each chamber's yes/no percentage, applies the configured class weights, checks quorum per chamber, applies thresholds by tier (ordinary, serious, constitutional, recall including "2 of the other 4 board members concur" and accused recusal), returns the deadlock ladder status (status quo, mediator, re-vote at higher quorum, motion falls) and writes the result with a breakdown JSON the result page can explain. Add tests as SQL asserts in a scripts/tests folder.
```

### E2. Secret ballots
```
Decide with the rules owner whether ballots are secret. If yes: change ballots_read so members can read only their own ballot, make tallies available through motion_summary_view/RPC only, and update getBallots() and the motion page so it no longer needs per-voter rows.
```

### E3. Standing and Coach inside SQL
```
The plan says Coach and Standing numbers are computed in SQL, but getCoachRecommendations() and getTeamHealth() in src/lib/api.ts compute estimates client-side. Create SQL functions coach_recommendations(member), standing_what_if(member, activity_ids[]), and team_health(scope) (migration), return runway days, EXP range, league places gained and aggregated gaps, and make the client call them. Also fix the category-name mismatch: the standing views use technology_innovation_wisdom / motivation_initiative_learning_mindset / social_soft_skills / leadership_management while the app uses technical / social / soft / management. Pick one vocabulary, migrate the data and views, and remove CATEGORY_DB_TO_UI mapping from api.ts.
```

### E4. Disputed RLS and role resolution
```
Audit every RLS policy in the live DB (query pg_policies) for: `auth.role() = 'authenticated'` on personal or sensitive data, comparisons against profiles.role instead of has_role(), and policies that reference their own table. Fix each in a new migration. Write a test script (scripts/rls-check.mjs) that signs in as one seeded test user per role (member, team lead, domain head, council, board, faculty, partner rep, auditor) and verifies they can only read/write what they should. Add it to the release checklist.
```

### E5. Remaining guards
```
Add <RequireRole> (or a roles list) to every page that is not member-wide, and verify each with a user of the wrong role: /rewards admin parts, /partners (partner scorecard edits), /branch-health override timeline, /conduct-panel, /team-health, /recall petitions, /standing seniors view. Remove the dev-only Discord mock path if any remains.
```

### E6. Remaining Discord/auth items
```
Finish production auth: use the real Discord client ID and DISCORD_CLIENT_SECRET (server-only), confirm the redirect URI matches exactly, set NEXT_PUBLIC_SITE_URL, and use supabase.auth.getUser() instead of getSession() in middleware.ts. Test: first login, second login, an existing-email account, an unverified Discord email (must be rejected).
```

---

## S. Scheduled jobs and server functions (Phases 3, 5, 6, 7)

### S1. pg_cron jobs
```
Migration: enable pg_cron and schedule (all in SQL): weekly league close (C1), weekly rank snapshots (B3), nightly compute_all_standings(), weekly digest notifications, Watch/Critical warnings (max 2 proactive nudges per week per member, respect quiet hours and leave/exam pause in notification_settings), "claim your attendance before Friday" reminders, approver reminders with a cooldown, branch health snapshots, MoU expiry and filing reminders, guest-pass expiry. Every job is idempotent and logs to a job_runs table.
```

### S2. Discord DM Edge Function
```
Create supabase/functions/send-discord-dm: reads unsent notifications where channel = 'discord_dm', respects quiet hours and opt-in, sends via the Discord bot API with a bot token held as a Supabase secret, records delivery status and retries with backoff. The AI may only word messages; all numbers come from SQL.
```

### S3. Seasons rollover
```
Admin → Seasons page + RPCs: rollover checklist (close claim window, finalise pending, archive season, reset season EXP, keep lifetime), with a dry-run preview. Add league tier unlock rules to Config (Shader/Engine/Utopia unlock at configurable active-member counts) with a cohort-size preview.
```

---

## F. Phase 9.4 polish pass

```
Without changing features: consistent spacing and motion; accessible colour contrast and visible focus states; keyboard navigation through all modals (focus trap, Escape, restore focus); prefers-reduced-motion respected everywhere (confetti, count-ups, bars); empty and error states with retry on every page; loading skeletons; run the product tour for first login of every new user (not only on the landing page); generate the PWA icons referenced in public/manifest.json (72 to 512 px, maskable) and fix the service worker so it does not cache authenticated pages or API responses; check Lighthouse (Performance, Accessibility, PWA) and fix the findings.
```

---

## G. Phase 10: Pilot readiness

### G1. Seed and demo data (10.1)
```
Create supabase/seed/demo_seed.sql (one file, easy to delete before launch) and an Admin "Demo mode" toggle with a banner when on. Staging DB only. Seed: PICT with 50 members and IIITK with 20, all 8 domains, teams, 12 months of claims, approvals and ledger history (a few high performers, many mid, about 20% dormant), league cohorts, events, motions, one branch in the Watch stage. All rows are tagged is_demo = true so one RPC can delete them. The ledger rows must be inserted through the real functions or with the append-only trigger respected.
```

### G2. Existing members join with their history (10.2)
```
First-login step "Claim your GDU history" for existing members: join date (sets tenure for Senior Member), positions held and past contributions with evidence. An approver reviews it (new table history_claims, RPCs submit_history_claim and review_history_claim, tenure applied only after approval). Reuse the Admin Import wizard for bulk uploads. Imported entries carry source = 'imported' and show an info tooltip in history.
```

### G3. Launch readiness and shadow report (10.3)
```
Admin → Launch Readiness: a checklist with owner, status and link per item (roles assigned, activity types reviewed, config reviewed, enforcement flags in Shadow, privacy pages published, each role tested, backups confirmed) with a progress ring. A Pilot panel (pilot branch, start and end dates). A Shadow Season Report listing who would have been At Risk or Probation and which branches would have been flagged, with a "nothing was enforced" disclaimer and CSV export. All computed in SQL.
```

### G4. Feedback and What's New (10.4)
```
Floating Feedback button (bug, idea, confusing) with an optional screenshot (private storage bucket, 2 MB, image types only). Admin triage board (New, Planned, Done) with member upvotes. A "What's new" modal on login driven by a changelog table.
```

---

## H. Phase 11: Fighting dormancy

```
11.1 Admin → Engagement: weekly active members, new vs returning, never-claimed, 30/60/90-day inactive segments, median claim-to-decision time, approver backlog, EXP by category, per-capita branch comparison, retention by join-month cohort. Filters for branch and date range, a one-line "what this means" caption per chart. SQL views only; use the recharts dependency already installed.

11.2 Starter Path: 14-day path for new members (complete profile, attend a session, first claim, first kudos), progress ring on Home, a bonus on the first approved claim, an assigned onboarding buddy (a Senior Member) with a message button, and a Starter badge at the end.

11.3 Win-back: for members inactive 30+ days (a config value) show a friendly "Welcome back" card with three small comeback quests and a leave-of-absence request. For Team Leads, Domain Heads and Council add "People to reach out to" with message templates and a copy button. No public labels; notification limits still apply.

11.4 Approver Health (Admin and Council): median review time, queue by age, monthly budget used, score-pattern flags (always max, always reject), oldest waiting claims at the top, and a "Remind approver" action with a cooldown.
```

---

## I. Phase 12: Discord and communications

```
12.1 Settings → Discord: link account, show linked server roles. Admin → Discord: channel mapping (announcements, leaderboard, wins), toggles for weekly digest, league results and level-up shoutouts (members opt in individually), and a role-mapping table between app roles and Discord roles with a preview before syncing.

12.2 Announcements composer for Leads, Council and Board: target by branch, domain or role, schedule, preview as In-app, Discord and Email, read counts, and pinned announcements at the top of Home. (An announcements table exists from migration 0022; extend it.)

12.3 Public Hall of Fame (opt-in members only: season champions, top projects, jam wins) and "Share my achievement" image cards for a level-up, badge or league promotion, sized for LinkedIn and Instagram with a download button. Cards must never show Standing or private data.

(The Discord bot itself, with commands like /xp, /claim and /leaderboard, is a separate small service and is not part of this repo.)
```

---

## J. Phase 13: Trust, privacy and safety

```
13.1 Privacy Policy, Terms and Community Guidelines pages (placeholder text), a consent step in onboarding stored with a version and timestamp, and Settings → Privacy: a summary of who sees what, a "Download my data" request (RPC that produces a JSON export), and "Deactivate my account" explaining that approved ledger entries are kept, anonymised. Have a lawyer review the real text against India's DPDP Act before launch.

13.2 Harden proof uploads: strip image metadata (EXIF) server-side, limit uploads per user per day, add a "Report this proof" button, an Admin moderation queue with keep/remove actions, and malware-safe content-type checks (verify magic bytes in an Edge Function, not just the MIME type).

13.3 Admin → Integrity: automatic advisory flags for two people always splitting claims, reciprocal Spot Awards, near-identical repeated claims, one approver always approving the same person, and sudden EXP spikes. Each flag shows its evidence with Dismiss and "Escalate to Conduct". Flags are advisory only and never create penalties automatically.
```

---

## K. Phase 14: Growth

```
14.1 "Propose a branch" wizard (college, faculty coordinator, student lead, starter members) that creates a concurrent-list motion; when it passes, create the branch with starter config. Branch Settings: domains, council, local award budget, and rubric tuning limited to plus or minus 20% of org values.

14.2 Admin → Seasons rollover (see S3) and league-unlock config.

14.3 (v2) Agreements: Team A offers Team B a share of its future dividend; both team leads sign; there is an expiry date and a cap on Team A's total outstanding liabilities; when the project dividend arrives, settle automatically and show the history.

14.4 Admin → Credit Mapping: map EXP bands to proposed college credits per semester. Faculty verification screen to export a signed per-student semester report (PDF and CSV). Students see projected credits on Profile.
```

---

## L. Non-code tasks (you, not an AI tool)

- Real Discord client ID and secret in `.env`; add the redirect URI (`/api/auth/discord/callback`, same port as the dev server, 4028) in the Discord developer portal; rotate the secret once it is real.
- Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DISCORD_CLIENT_SECRET`, `NEXT_PUBLIC_SITE_URL` in Netlify. Do not deploy before the security items above are retested.
- Create a **separate staging Supabase project** and test every prompt there first. Move to a paid Supabase tier with backups before any real data goes in.
- Check that the Storage policies for the `claim_proofs` bucket exist (migration 0029 skips them if the connecting role cannot create them). If a proof upload fails with a permissions error, create them in the Supabase dashboard (SQL is in section 4 of `0029_claim_flow_hardening.sql`).
- Create docs/RULES.md (the architecture rules in plain text) and docs/API.md (one line per RPC) so the Common prefix works for any tool.
- Seed one test user per role (member, team lead, domain head, council, board, faculty, partner rep, auditor) and run the RLS checklist (E4) before every release.
- Get a lawyer to review the privacy text (DPDP Act) before launch, and run a small internal pilot at one branch before widening.
