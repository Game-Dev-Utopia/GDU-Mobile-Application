# User Tasks (Pending / On You)

This file tracks all tasks that are on you (the user) so you can find them in one place. Keep appending as new items come up.

## Infrastructure / Setup (blocking end-to-end testing)

1. **Supabase project** — Connected successfully at `ewlbqnqhhhcngeouujgc.supabase.co`. `.env` has real URL/anon key/service role key/connection string.
2. **`.env`** — Supabase credentials populated. Discord OAuth credentials still need real client ID/secret (currently placeholders).
3. **Migrations 0001–0017** — All 17 migrations run against Supabase. `schema_migrations` table confirms all applied. Migration 0017 adds Phase 7.1 branch override right-of-reply + appeal tables.
4. **Create `claim_proofs` storage bucket** — Needed for Patch C proofs upload. Create in Supabase Dashboard or via API.
5. **Register Discord OAuth app** — Add redirect URI (`/api/auth/discord/callback`) in Discord Developer Portal. Update `.env` with client ID/secret.
6. **Notification settings** — notification_settings and notifications tables auto-created by migration 0002. No additional setup needed.

## Deployment

7. **Deploy to Netlify** — First deployment target. Configure build command, env vars, and connect to Git repo.

## Notes

- All development work (Patches A–D, Phase 5.1 Standing, Phase 5.2 Coach, Phase 5.3 Notifications & Team Health, Phase 6.1 Motions, Phase 6.2 Voting, Phase 6.3 Recall & Mediation, Phase 7.1 Branch Health) is complete: `npm run build` succeeds (36/36 routes including `/branch-health`).
- Phase 7.1 adds: health score trend chart (recharts), per-capita branch comparison table, board override timeline with right-of-reply (branch council / faculty coordinator / college student council), decision options (extend / supervised admin 3/5 / merge or dormant / wind-down 4/5), one appeal, and "Shadow Mode" label.
- No user action needed on code unless you want to review or test against a live Supabase instance.
