# GDU XP: Audit before Phase 10 (2026-10-21)

Scope: `docs/GDU_XP_System__AI_builder_plan.html` against `GDU_XP/` (src, 27 migrations, USER_TASKS.md).
Method: `tsc --noEmit`, `next build`, `next lint`, a script cross-checking every `@/lib/api` import against api.ts exports, and every `.rpc()` and `.from()` call against migrations. I also read the core SQL (0001, 0003, 0021, 0023) and the key pages.
Not done: nothing was run against the live Supabase DB, and there was no click-through in a browser. The app can't start until the P0 items are fixed.

Note: "user_docs" is `GDU_XP/USER_TASKS.md`. Nothing in it is blocking except Discord OAuth credentials. See section 6.

---

## 0. Headline

USER_TASKS.md says Patches A–D and Phases 5–9 are "complete". **That is not true of the code on disk.** The latest edit session damaged the project:

| # | Problem | Effect |
|---|---|---|
| P0-1 | `src/app/approvals/page.tsx` is saved as **UTF-16 LE** and its tail is truncated (missing closing tags/braces) | `next build` fails (SWC syntax error) |
| P0-2 | `src/app/recall/page.tsx` has an unbalanced `<div>` in the header (about lines 108–125, stray `)}`) | `next build` fails |
| P0-3 | `src/lib/api.ts` is **missing 35 exports** that pages import (see 1.1) | Standing, Coach, Notifications, Team Health, Penalties and Admin → Activity Types have no client functions. They crash at runtime. The SQL for them exists. |
| P0-4 | `src/app/landing/page.tsx` contains its whole body **twice** (duplicate imports and declarations) | Compile errors on the public entry page |
| P0-5 | `next.config.mjs` sets `ignoreBuildErrors` and `ignoreDuringBuilds` | This is why the type errors went unnoticed. Anything that parses will still deploy. |

Build result: `Build failed because of webpack errors` (approvals and recall).
Type check, with those two files excluded: **81 more TS errors** across 20 files. Lint: 82 errors, 330 warnings (`any` and prettier mostly).

---

## 1. Poorly implemented / broken (fix before building Phase 10)

### 1.1 Missing from api.ts (pages import them, nothing exports them)
- Standing: `getMemberStanding`, `getMemberCategoryStanding`, `getStandingConfig`, `getStandingZone`, and the types `MemberStanding`, `CategoryStanding`, `StandingZone`
- Coach: `getCoachRecommendations`, `getWeeklyPlan`, `addToPlan`, `removeFromPlan`, `markNotForMe`, and the types `CoachRecommendation`, `WeeklyPlan`, `PlanItem`
- Notifications: `getNotifications`, `markNotificationRead`, `dismissNotification`, `getNotificationSettings`, `updateNotificationSettings`, `getSampleNotifications`, and the types `Notification`, `NotificationType`, `NotificationSetting`
- Team Health: `getTeamHealth`, and the types `TeamHealthSnapshot`, `TeamMemberHealth`
- Penalties: `getPenalties`, `filePenalty`, and the types `PenaltyRecord`, `PenaltyRecordStatus`, `PenaltySeverity`. `MyClaimsContent` also uses `getPenalties`.
- Approvals: `approveClaim`, `approveSpotAward`. There is no Spot Award feature anywhere (see 3).
- Admin: `updateActivityType`. The activity-type edit drawer cannot save.

These were probably lost in the same incident that corrupted approvals and recall. Check OneDrive version history for api.ts and those two pages first. If the old versions are there, restore them.

### 1.2 Security: these break the plan's own "RLS checklist"
| Severity | Finding |
|---|---|
| **Critical** | `profiles_update_own` (0001) has no column restriction or `WITH CHECK`. Any logged-in user can run `update profiles set role='admin'` or set their own `total_exp`/`level`. `has_role()` falls back to `profiles.role`, so this is full privilege escalation. |
| **Critical** | Discord login (`api/auth/discord/callback`) is broken and unsafe. (a) A fresh `Math.random()` password is generated every login but only set on user creation, so `signInWithPassword` fails on every login after the first. (b) No OAuth `state` check (CSRF). (c) It links to an existing user **by email without checking Discord's `verified` flag**, which allows account takeover. (d) `listUsers()` only reads the first page. (e) It inserts into `profiles` after the `handle_new_user` trigger already did, so the insert collides and the error is ignored. (f) The plan said to use Supabase's built-in Discord provider. This custom flow bypasses it. |
| **Critical** | `NEXT_PUBLIC_DISCORD_CLIENT_SECRET` ships the Discord client secret to the browser bundle. Rename it to a server-only variable and **rotate the secret** once it is real. |
| High | `ledger_read` lets any authenticated user read **all** ledger rows. The leaderboard and `season_leaderboard_view` expose every member's name, avatar and EXP. The views aren't `security_invoker`, so they bypass RLS. Check whether `anon` can also read them (Supabase grants by default; no `revoke` anywhere). |
| High | `finalize_claim()` has **no caller check**. Any user can finalise any `under_review` claim, including their own. `reverse_entry` checks the role against `profiles.role` only. |
| High | Blind-then-reveal is not enforced. `list_my_review_queue()` returns `claims.*` including `suggested_exp`, and the reviewer RLS exposes the full row. The review page then displays "Suggested EXP" before scoring. |
| High | No auth gate on `/admin`, `/review`, `/finance-compliance`, `/rewards`, `/approvals`, `/partners` and most other pages. Only 3 pages use `RequireRole` and about 20 call `can()`. The plan asked for "You need the X role" on direct URL access. RLS is the only protection. |
| Medium | `ballots_read` and `threshold_violations_read` use `auth.role()='authenticated'` as the **original** policy in 0012/0010. I didn't verify whether 0021 replaced them. Standing zones must be visible only to the member and their seniors, and secret ballots must stay secret. Verify on the live DB. |
| Medium | The View As menu renders for **every** user in production. It has no `NODE_ENV` gate, and it only changes a local label. |
| Medium | `middleware.ts` trusts `getSession()` (cookie, unverified). Use `getUser()`. |
| Medium | `activity_subcategories` has no RLS. The 5 views above have no `security_invoker`. |
| Low | Storage bucket `claim_proofs` is created manually, and the migration line is commented out. Bucket policies are not in git. |

### 1.3 Core-loop logic gaps (Phase 1 / invariants table)
- The claim wizard is a single form, not the 4-step wizard. Contributors are **hard-coded to** `[{ memberId: 'current-user', sharePercent: 100 }]`, so there is no splits UI, no member search and no donut chart. There is also no "Submitting for" selector, no proof upload UI (`uploadProof` exists but isn't called from the wizard), no suggested-EXP slider and no analysis/impact notes field.
- `review_claim` allows one reviewer. Missing: "approvers needed (1 / 2 / board)", a **second approver on a large gap**, **approver budgets and caps** (monthly award budget meter), and impact ratings (reach, magnitude, durability, verifiability). `activity_types` season caps and diminishing returns are not enforced in `finalize_claim`. It also uses integer division on split shares.
- Review is two steps (`review_claim`, then `finalize_claim`). The UI shouldn't expose that.
- `season_leaderboard_view` defines the "season" as `max(activity_date) − 14 days`. That is a placeholder, not seasons, and there are no Bi-weekly/Monthly/Quarterly periods in SQL.
- My Claims has tabs, but no status timeline, no edit/withdraw/add-evidence, no celebration animation and no "Recommend a teammate" flow.
- Profile: no EXP-by-category radar from `my_ledger_view`. The "Skill Radar" exists, but there is no history table, privacy toggles, banner or frame.
- Leaderboard: group, period and metric filters exist. No podium, rank-change arrows, pinned "You" row or opt-out.
- Leagues page: tier ladder by EXP only. No cohorts of 15, promotion/relegation zones, weekly result modal or branch/team leagues. League tier names are inconsistent (the OAuth route sets `'obsidian'`; plan uses Pixel → Sprite → Voxel).
- Home: hero, stats, chart, feed, spotlights and coach card only. No streak logic (a "streak" field is read, not computed), no Today card, pending items, league card, events strip or recent-wins feed.
- Mock leftovers: `MOCK_ACTIVITIES` fallback in `getActivities`. Type mismatches in `getActivities`/`getMyClaims`.
- `public/manifest.json` references `icon-72x72.png`, `icon-192x192.png`, etc., but `public/assets` only has two images. The PWA is not installable.
- Other compile issues: `LinkIcon` undefined (`partners/rep`), lucide `ArrowRight` missing in `ProductTour` (version 1.x of lucide-react looks wrong; current is 0.4xx), `BeforeInstallPromptEvent` type, `EmptyState` icon props, null-check in motions/[id]. `activities/propose` sends `kind`, but the type has no `kind`.
- Repo hygiene: no `docs/RULES.md` or `docs/API.md` (the plan's prompt prefix depends on them), `supabase/functions/` is empty, README is boilerplate, `scripts/tmp-inspect.mjs` is a leftover, no tests anywhere, no CI, no RLS lint. `.env` holds live keys (the folder isn't a git repo yet, so add `.gitignore` coverage before the first commit).

---

## 2. Partially implemented (UI and tables exist, but pieces are missing)

| Area | Present | Missing |
|---|---|---|
| Phase 2 badges (0006) | gallery, award RPCs | locked silhouettes' "how to earn", rarity tiers, level-up full-screen celebration, Season page (picker/archive) |
| Phase 2 quests (0007) | quest cards, claim reward | weekly streaks, freeze tokens, heat map, shared team quest, seasonal quest line |
| Patch A RBAC | `permissions.ts` matrix, `RequireRole`, `Admin → Roles` in the admin console | guards not applied on most pages (above); `ViewAs` doesn't actually switch roles |
| Patch B1 taxonomy | grouped activities, filters | verify the Patron recognition path; decrements only in Penalties |
| Patch B2 penalties | tables, `review_penalty`, page | `filePenalty` / `getPenalties` missing in api.ts (page broken); response-window countdown not verified |
| Patch C on-behalf and proofs | migration 0004, `uploadProof` | UI not wired into the claim wizard; no gallery on review; confirm/dispute needs `confirmClaim` UI in My Claims |
| Patch D proposals + approvals | propose page, `approve_activity_proposal` | Approvals page is corrupted; no spot-award items; bulk undo unverified |
| 5.1 Standing | SQL views (0010) and page | api functions missing (broken); RLS for zone visibility |
| 5.2 Coach | page and card | api missing; no SQL view for runway/impact (plan says all numbers come from SQL) |
| 5.3 Notifications/Team Health | pages | api missing; no `pg_cron` jobs, no Discord DM Edge Function, no nudge cap logic (`supabase/functions` is empty) |
| 6.x Governance/Recall/Mediation | most RPCs and pages | Recall page won't compile; deadlock ladder and 72h countdown unverified |
| 7.x Branch Health/Conduct/360 | RPCs and pages | no scheduled snapshot job; shadow mode only |
| 8.x Rewards/Finance/Admin console | RPCs and pages | Cash tab is only a flag; "Export audit pack" and article/MoU reminders unverified |
| 9.1 Partners | tables, 2 pages | scorecard is manually upserted; no guest-pass expiry job |
| 9.2 Integrations | cards and import wizard | integrations are mock (as planned); "imported" tag shown in history? not verified |
| 9.3 Transcript/Alumni | pages and RPCs | PDF export; alumni freeze isn't enforced by a trigger |
| **9.4 Polish** | skip link, reduced-motion CSS, tour, PWA install prompt, service worker | tour only on landing; PWA icons missing; no consistent empty/error states checked; no focus-state audit; service worker caches authenticated routes |

---

## 3. Not implemented (planned for phases 1–9 in the plan; nothing in code)

- **Phase 3.1** League cohorts, promotion/relegation, weekly close job (`pg_cron`), shield, branch and team leagues
- **Phase 3.2** weekly streaks and freeze tokens, calendar heat map, shared/seasonal quests
- **Phase 3.3** Season page, season rewards, profile frame/title picker, level-up celebration
- **Phase 4.1** Projects (create, roles, share split with co-sign, pool, top-up, leave project). `split_agreements` exists, but no project UI
- **Phase 4.2** Spot Awards, Kudos (5 per month), Wall of Thanks, budget meter. Only a table stub exists in SQL.
- **Phase 4.3** Events (calendar, RSVP, check-in codes, "claim your XP" prompt)
- **Patch D** "Propose a new activity" at the bottom of every dropdown (only a separate page exists)
- **Phase 2.1/2.2** Today card and pending items on Home; profile privacy toggles and contribution timeline
- Scheduled jobs of any kind (league week close, weekly digest, nudges, MoU/filing reminders), Edge Functions, the Discord DM sender
- Server-side enforcement of per-user monthly budgets, caps and cohort logic (invariants table, plan §4)
- RLS test users per role and any automated test

---

## 4. Remaining: Phase 10 onward (nothing started)

| Phase | Items |
|---|---|
| **10.1** | Demo/seed data file with Admin "Demo mode" and banner (PICT 50 / IIITK 20 members, 12 months of history, one Watch-stage branch). Note that the app now reads **real Supabase data**, not a mock layer, so seed data should be a SQL seed (staging only) rather than the plan's mock file. |
| **10.2** | "Claim your GDU history" first-login step, tenure from join date, approver review of history. Needs a table plus RPCs. Reuse the import wizard. |
| **10.3** | Admin → Launch Readiness checklist and ring, Pilot panel, Shadow Season Report with CSV export |
| **10.4** | Floating Feedback button, admin triage board with upvotes, "What's new" modal |
| **11** | Engagement analytics; 14-day Starter Path; Win-back and "People to reach out to"; Approver Health |
| **12** | Discord linking/mapping, announcements composer (a table exists, no composer), Hall of Fame and share cards |
| **13** | Privacy/Terms/Guidelines pages and consent step, "Download my data" / "Deactivate", upload hardening (EXIF strip, per-user daily limit, report proof, moderation queue), Integrity flags |
| **14** | Propose a branch wizard and settings, Seasons rollover and league unlock config, Agreements, Credit mapping |

---

## 5. Suggested order

1. **Restore or repair** `approvals/page.tsx` (re-encode to UTF-8 and finish it, or restore from OneDrive history), `recall/page.tsx`, `landing/page.tsx`, and the lost api.ts functions. Then get `tsc --noEmit` and `next build` green, and remove `ignoreBuildErrors` / `ignoreDuringBuilds`.
2. **Security migration 0028**: lock profile updates (a trigger or column-level grant for `role`/`total_exp`/`level`), restrict `ledger_read`, set views to `security_invoker` and revoke `anon`, add a caller check to `finalize_claim`, hide `suggested_exp` from reviewers, re-audit every `auth.role()='authenticated'` policy.
3. **Fix Discord OAuth.** Use Supabase's Discord provider (or fix the custom flow), add the state check, require a verified email, and move the secret to a server-only variable. Rotate it.
4. **Finish the core loop** (Phase 1 gaps: splits, proofs, on-behalf, two-approver and budget rules), then **Phases 3–4 of the plan** (leagues, projects, spot awards, events).
5. Only then start Phase 10. 10.1 depends on 3–4 existing (leagues, events and so on).

## 6. Your tasks (USER_TASKS.md)

Still on you:
- Real Discord client ID and secret in `.env`. Add the redirect URI `/api/auth/discord/callback`. Use a server-only variable name (see 1.2).
- Set `NEXT_PUBLIC_*` and `SUPABASE_SERVICE_ROLE_KEY` in Netlify, then deploy. Don't deploy yet.
- Plan items nobody has done: separate staging and prod Supabase projects (only one project is mentioned), a paid tier before real data, backups, and a lawyer review for the privacy policy (DPDP).
- `USER_TASKS.md` itself needs correcting. It lists work as complete that isn't.
