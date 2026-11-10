# AI Tool Use for Academic Research — online questionnaire

An anonymous online questionnaire (English) with a protected live researcher dashboard and CSV
export. The primary deployment runs on Cloudflare Workers with a persistent D1 database, so the
public link remains available while your laptop sleeps, restarts or disconnects.

Cloudflare is used only to host the page and its database. It is not an external survey platform,
and no respondent account or personal identifier is required. The original local Node/SQLite app
is retained as an offline development and recovery path.

---

## 1. Deploy the always-on version

This is a one-time setup. You need a Cloudflare account; the questionnaire and D1 database fit
within Cloudflare's free tier for a typical research pilot.

```bash
./cloudflare-login.sh   # one browser sign-in and authorization
./deploy.sh             # creates D1, imports pilot rows, sets the admin secret, deploys
./cloudflare-status.sh  # prints the stable public and dashboard links
```

The first deployment creates an Asia-Pacific D1 database, generates a new researcher token in
`data/cloud-admin-token.txt`, and privately imports the five existing pilot responses from the
local SQLite database. Participant answers are never included in the public repository. Later
deployments update the code without replacing the database or the URL.

| What | Link |
|---|---|
| **Share with respondents** | printed by `./cloudflare-status.sh`, using the stable `*.workers.dev` URL |
| **Results dashboard** | printed by `./cloudflare-status.sh` with its token filled in |
| **CSV download** | printed by `./cloudflare-status.sh`, or from the dashboard |

The Worker URL does not depend on this laptop. Sleep, power loss or a reboot do not affect
collection. The URL changes only if the Worker is renamed or deleted.

For a branded address or stronger availability in mainland China, attach a custom domain to the
Worker in the Cloudflare dashboard. A custom domain is also the recommended long-term setup for
fieldwork; `workers.dev` availability can vary by network.

## 2. Day-to-day

```bash
./cloudflare-status.sh  # live link, response count, dashboard token
npm run deploy          # publish code changes to the same URL and database
```

To make a schema change, add a numbered SQL file under `migrations/`, then run:

```bash
npm run d1:migrate:remote
npm run deploy
```

The desktop scripts below operate the older local/SQLite fallback:

```bash
./status.sh          # is everything up? what is the link? how many responses?
./restart.sh         # restart the web server (data is untouched)
tail -f data/server.log
```

The fallback runs under **launchd**, so it starts at login and survives crashes while this
machine is on and connected:

- `local.ai-research-questionnaire` — the web server (port 8788)
- `local.ai-research-questionnaire-tunnel` — the public tunnel
- `local.ai-research-questionnaire-backup` — hourly CSV snapshot into `data/backups/`

Faster local Worker preview:

```bash
npm run d1:migrate:local
npm run dev
```

The local preview uses `.wrangler/state` and does not affect production responses.

```bash
launchctl list | grep ai-research-questionnaire
launchctl kickstart -k gui/$(id -u)/local.ai-research-questionnaire          # restart server
launchctl kickstart -k gui/$(id -u)/local.ai-research-questionnaire-tunnel   # restart tunnel
```

## 3. Data

Production responses live in Cloudflare D1. The dashboard and `/api/export.csv` read directly
from D1, so downloads are current and do not require this laptop.

- `data/responses.db` — SQLite, one row per response, timestamps in UTC.
- `data/backups/*.csv` — hourly CSV snapshots (last 200 kept).
- `bin/export-local-pilot.js` — private, temporary import of the original pilot rows during deploy.
- CSV/JSON download from the production dashboard at any time.

**Anonymous by design.** The server stores no IP address, no user agent, no cookie identifier
for the respondent — only the answers and a UTC timestamp. A short-lived `q_submitted` cookie
exists solely to tell a respondent "you already submitted from this browser"; it is not stored
with the response and cannot be linked to one.

Columns (`api/export.csv`):

`response_id, submitted_at_utc, q1_international_curriculum, q2_grade, q3_tool,
q4_peu, q5_pu, q6_att, q7_tr, q8_tr, q9_mr, q10_mr, q11_bi, q12_bi,
q13_vb, q14_vb, q14_no_source_named, q15_days_used`

Coding rules that the data respects:

- Q13/Q14 left blank, "Not observed", or excluded because Q15 = 0 → **empty cell** (not observed),
  never `0` and never "Never".
- Q14 "No source was named" → `q14_vb` empty and `q14_no_source_named = 1`.
- Q15 = 0 → Part C is forced to not-observed server-side.

## 4. The instrument (what is on the page)

| Part | Questions | Scale |
|---|---|---|
| A. Background & screening | Q1 international curriculum (Yes/No), Q2 grade level, **Q3 the one tool used most often** | — |
| B. Perceptions & intentions | Q4 PEU, Q5 PU, Q6 ATT, Q7–Q8 TR, Q9–Q10 MR, Q11–Q12 BI | 1 Strongly disagree … 5 Strongly agree |
| C. Verification behaviour, past 30 days | Q13, Q14 (+ "No source was named" on Q14) | 1 Never … 5 Very often; optional |
| D. Actual usage | Q15 days out of the past 30 | 0–30 whole number |

"**This tool**" is defined in the introduction and fixed by Q3; every later item refers to it.

Measurement notes carried over from the source document (also shown on the dashboard):
Q9–Q10 are concern items and must not be pooled with the trust items Q7–Q8; Q15 is a count, not a
scale; the two-item pairs are candidate indicators pending pilot dimensionality checks; the
adapted short form needs pilot validation.

## 5. Changing the questionnaire

- Question wording and order → `views.js`.
- Item metadata and validation → `survey-core.js`.
- Storage columns → `migrations/` for the Worker and `server.js` for the local fallback.
- Dashboard tables → `public/assets/dashboard.js`.
- Styling → `public/assets/style.css`.

After editing, run `npm run deploy`. For a local visual check first, run `npm run dev`.

Adding a question means adding a column. Add a numbered migration under `migrations/` for D1;
for the local fallback, use
`sqlite3 data/responses.db 'ALTER TABLE responses ADD COLUMN q16_x INTEGER'`.

## 6. Privacy / ethics checklist

- Anonymous, voluntary, no personal data collected.
- `noindex, nofollow` so the page is not searchable.
- Results are token-protected. The local token is `data/admin-token.txt`; the production token
  is `data/cloud-admin-token.txt` (both chmod 600).
- Review and, if needed, remove test rows before collecting the final dataset.

## 7. Resetting to an empty dataset

```bash
./stop.sh
rm -f data/responses.db data/responses.db-shm data/responses.db-wal
./restart.sh          # recreates the local fallback database
```

The production D1 database is intentionally not cleared by that command. Delete production
rows only after exporting the data and confirming the exact D1 target; D1 Time Travel should be
checked before a destructive change.

## 8. Files

```
worker.js                       always-on Cloudflare Worker
survey-core.js                  shared validation, scoring and CSV rules
views.js                        HTML templates
public/assets/style.css         styling (mobile-first, light/dark)
public/assets/dashboard.js      results dashboard renderer
migrations/                     Cloudflare D1 schema
deploy.sh                       create/update production
cloudflare-login.sh             one-time browser authorization
cloudflare-status.sh            production health and links
server.js                       local Node fallback
status.sh / restart.sh / stop.sh local fallback controls
data/                           local database, logs, token, backups
docs/                           screenshots
```

## 9. Troubleshooting

| Symptom | Fix |
|---|---|
| Cloudflare authorization expired | run `./cloudflare-login.sh`, then `./deploy.sh` |
| Need to diagnose production | run `./cloudflare-status.sh`, then `./bin/wrangler-run.sh tail` |
| `curl: (7) Failed to connect ... 8788` | local fallback is down: `./restart.sh`, check `data/server.err.log` |
| "Researcher access" page | open `/results?token=...` once; the token is set as a cookie for a week |
| Want a custom domain | in Cloudflare Workers, add a Custom Domain route for `ai-research-questionnaire` |
