# DESO Alliance Dashboard

**Project credit: Anderson Tagata — ATTecnologies, 2026.**

Technical documentation: [Português (PT)](docs/TECHNICAL.md) · [English (EN)](docs/TECHNICAL.en.md). Both versions are maintained together for improvements and fixes; see [documentation policy](docs/TECHNICAL.en.md#15-bilingual-documentation-maintenance). Attribution: [NOTICE](NOTICE). License: [Apache 2.0](LICENSE).

A public, read-only command center for **DESO / Death Soldiers**, server 2052, in *Last War: Survival*. Built for phones and desktop browsers. All production interface text is English; player names remain exactly as supplied.

**Public URL after Pages is enabled:** https://attagata.github.io/deso-dashboard/

## Architecture

React 19 + TypeScript strict mode + Vite, Recharts, plain CSS. GitHub Pages serves the compiled application and versioned daily JSON files. The browser loads the data and performs all calculations. There is no database, authentication, application server, external processing API for alliance data, authoritative browser persistence or paid infrastructure. The owner-approved exception to local-only requests is a FreeCounterStat visit counter, described below. Hash URLs support direct refreshes, for example `/deso-dashboard/#/member/p001?date=2026-10-20`.

```text
public/data/YYYY-MM-DD.json    One capture per day; source of production statistics
public/data/index.json         Generated list of daily files
source-data/                   Original historical source, unchanged, for audit
src/components/               Overview, roster, profiles, charts, activity and guidelines
src/services/dataService.ts   Uncached static JSON loading and runtime validation
src/types/member.ts           Daily and normalized data interfaces
src/utils/statistics.ts       Deterministic client-side calculations
src/utils/validation.ts       Shared browser / build data checks
scripts/validate-data.mjs     Validator and automatic manifest generation
tests/statistics.test.ts      Calculation, validation and source-preservation tests
.github/workflows/deploy.yml  Validation, tests, build and official Pages actions
```

## Local development

Install **Node.js 24 LTS** (the workflow uses Node 24) and npm. From this folder:

```sh
npm install
npm run dev
```

Open the address printed by Vite, including `/deso-dashboard/`. Vite is only a local development tool; no development server is deployed.

```sh
npm run validate:data
npm test
npm run build
npm run preview
```

The production files are generated in `dist/`. `npm run build` validates the data and type-checks before compiling. The workflow also runs the automated tests. Use `npm ci` for reproducible installs from the lockfile.

## Historical data and safe migration

The provided schema 1.1 file has **103 stable player IDs** and captures on **2026-10-14, 2026-10-19 and 2026-10-20**. Its original bytes are preserved in `source-data/DESO_member_history_2026-10-14_to_2026-10-20.json`. Do not edit this audit copy as part of daily updates.

The data was split into three schema 2 daily files. Every raw snapshot field is preserved: ranks, `power_m`, `base_level`, activity text and nominal minutes, separate online status, visibility, sources and explicit departure indicators. Dated profile details remain on the corresponding daily row. Each daily file retains the original alliance metadata, summary and data policy. Membership events appear only on their recorded date. Undated global player statuses and the extra departure descriptions remain intact in the audit source; the app calculates historical membership from dated captures and events instead of applying the most recent status to all past dates. The preservation test verifies every original snapshot, dated profile, summary, metadata and membership event against the split files.

The browser normalizes numeric `power_m` into integer power using `Math.round(power_m * 1_000_000)`. This respects the source's displayed million-power precision. The raw source values are retained; they are not exact unit-level measurements.

| Capture | Observed members | Individual power sum | Confirmed departures through date | Unobserved known players |
| --- | ---: | ---: | ---: | ---: |
| 2026-10-14 | 91 | 5,429,600,000 | 0 | 0 |
| 2026-10-19 | 97 | 5,615,800,000 | 4 | 0 |
| 2026-10-20 | 98 | 5,690,200,000 | 4 | 1 |

The official screenshot total is **5,611,412,930 on October 19**, distinct from the sum above. Other dates have no recorded official power total. Neither value is substituted for the other.

## Daily updates: one JSON per day

The administrator only adds or updates **`public/data/YYYY-MM-DD.json`**. No source code or manual manifest change is needed. On each build, the validator discovers all daily files and regenerates `index.json`. The deployed app fetches the manifest and daily files with `cache: 'no-store'` plus a refresh query, and does not keep an authoritative local copy.

1. Capture the roster and record the actual observation date.
2. Give ChatGPT the screenshots, the newest roster with stable IDs, and this schema. Ask it to generate only the day's observed data and explicit membership events, preserving names and activity exactly. Reuse each player's `player_id`; name changes must not create a new identity. Uncertain matches need human confirmation; `identity_uncertain: true` excludes rank movement claims.
3. Save the result as `public/data/2026-10-21.json` (using the actual date). Keep every prior daily file. Do not copy yesterday's power into missing rows.
4. Run `npm run validate:data`, `npm test` and `npm run build`, or let GitHub Actions run them after upload.
5. Commit to `main` (the existing `master` branch is also supported). GitHub Actions publishes the updated site. Refresh the browser after deployment finishes.

On iPhone Safari: open the repository's `public/data` folder → **Add file → Upload files** → select the new daily JSON → commit. If the mobile page hides these controls, request the desktop website. You can also use **Add file → Create new file**, name it `YYYY-MM-DD.json`, and paste the JSON text. You never need to paste a password or token into ChatGPT.

### Daily schema

The example below is intentionally empty; it does not invent a production player:

```json
{
  "schema_version": 2,
  "date": "2026-10-21",
  "alliance": {
    "tag": "DeSo",
    "name": "Death Soldiers",
    "server": "2052"
  },
  "summary": {},
  "observations": [],
  "membership_events": []
}
```

Each `observations` row requires:

| Field | Type and meaning |
| --- | --- |
| `player_id` | Stable nonempty string, reused across all dates |
| `name` | Name displayed in this capture, preserved verbatim |
| `rank` | `R1`–`R5`, or `null` if unknown |
| `base_level` | Positive integer, or `null` |
| `power_m` | Nonnegative numeric million power, or `null` |
| `visible` | Boolean: whether the player was observed |
| `last_seen` | `"online"`, a displayed elapsed value such as `"27m"`, `"2h"`, `"5d"`, or `null` |
| `last_seen_minutes` | Nominal elapsed minutes corresponding to the displayed value, or `null`; online rows use `null` |
| `online_at_capture` | `true`, `false`, or `null` if unknown, separately from elapsed time |
| `source` | Nonempty description of the evidence |
| `identity_uncertain` | Optional boolean; use `true` if matching requires confirmation |
| `profile` | Optional object preserving extra dated profile data |

For an explicitly unobserved row, set `visible: false` and set rank, power, level and all activity fields to `null`. Omitting the row also means unobserved if the player was known on an earlier date. A player who has not appeared yet is excluded from earlier date views.

`summary` may include `reported_members`, `reported_ranks` and `alliance_power` from game headings. Use **numeric full units** for `alliance_power`. Unknown optional summary values may be omitted or `null`. Summary counts and power never override the actual individual records.

`membership_events` contains confirmed events only. Required event fields: `event_type` (`departure` or `rejoin`), `player_id`, `name`, `recorded_on` (same date as the daily file), `effective_date` (ISO date or `null` when unknown), and `source`. `previous_rank` is optional. Record a departure once, on the date confirmation was recorded, rather than repeating it daily. An explicit rejoin is required before a departed player can become active again. The UI uses the confirmation date to avoid claiming an unknown departure date.

Corrections to a capture should amend that date's file through a new Git commit, leaving the repository's audit trail. This version permits one daily capture, not multiple captures with the same date. Do not replace the complete history with only the newest file.

### Validation

`npm run validate:data` exits unsuccessfully with filename / field errors for invalid JSON, missing fields, wrong schema or filenames, invalid/impossible dates, duplicate player IDs or same-day observations, duplicate member names needing identity review, invalid rank values, negative/non-numeric power, invalid activity units, activity contradictions, stale values on unobserved rows, duplicate events, unknown event identities, future effective dates, repeated departures and observed members without a rejoin after departure. Shared runtime checks reject invalid published data too. Duplicate names across separate days are allowed to support renaming; identity ambiguity that cannot be determined from JSON still requires review.

## Calculation rules

### Player performance analysis

Every player profile includes **Player performance analysis**, combining dated power changes, HQ progression, rank changes, last observed login and recovery evidence through the selected date. Labels are descriptive: Growing, Stable, Power Decline, Recovering and Inactivity Review. Insufficient data is shown when evidence does not support a comparison. Power loss never independently generates demotion recommendations or establishes inactivity, commitment or the cause of a reduction.

Defaults live in [`src/config/performance.ts`](src/config/performance.ts): significant decline **5%**, minor positive fluctuation **1%**, sustained decline **two consecutive declining intervals over at least two days**, and inactivity review **five days**. A sustained decline also requires a cumulative loss at least as large as the significant-decline threshold. Smaller reductions remain Stable unless the sustained rule is met. A single capture is not sufficient to classify the power pattern.

Expand **Analysis thresholds** inside a profile to apply temporary analysis thresholds. These settings remain in React memory while that profile view stays mounted; returning to the overview or reloading restores defaults. They do not change source JSON, alliance policy or the existing Activity Monitor's five-day rule.

Interval and historical power changes show absolute and percentage differences. A daily change is displayed only for comparable captures exactly one calendar day apart; multi-day differences are explicitly interval changes. Unknown values, missing capture rows, uncertain identities and departure/rejoin boundaries interrupt trend and recovery tracking.

Recovery tracks the pre-decline baseline and lowest observed power until an observed increase reaches or exceeds that baseline. The module shows regained power and the percentage of the recorded loss recovered; this percentage can exceed 100%. Recovery does not imply troop replacement, battle participation, hospital treatment, hero upgrades or research: all such causes remain **Unknown** without evidence.

See the detailed performance specification in [English](docs/TECHNICAL.en.md#14-player-performance-analysis) or [Português](docs/TECHNICAL.md#14-player-performance-analysis) for formulas, classification precedence and test coverage.

### Dashboard statistics

- The date selector updates the statistics, ranking, activity and top ten together. A missing selected-date observation never inherits older power, rank, HQ or activity for that day's statistics.
- Active means visible in that capture and not confirmed departed. Unobserved players remain separate from confirmed departures. The full historical roster is available through the status filter. Official heading count is shown beside the observed count.
- Newly observed means the first visible capture for an identity, excluding the baseline date. It does not establish an exact join date.
- Power change compares the current visible observation with the previous visible observation; a null power value does not become zero. Percentage change is shown only when previous power is positive. Changes of at least 10% are visually highlighted, without performance judgments.
- Rank movements require different known ranks in two **adjacent recorded capture dates**, both visible and with certain identity. Missing observations are never bridged for movement claims.
- Power graphs show every recorded date after the first record, use `null` for missing observations and never connect across these gaps. Straight lines are guides between capture markers, not invented measurements. The history table is the accessible numeric alternative.
- Activity: Online is separate from elapsed time; under 24 hours = Recently Active; 24 hours to under five days = Away; five days or more = Review Required; missing information = Unknown. No time-since-capture extrapolation is performed.
- Last-seen times are approximate screenshot observations, not total daily playtime or exact session duration. Five days away is an officer review flag. Promotions, demotions and departures are never executed by this app.

## GitHub Pages publication

1. Push the project and lockfile to the public repository.
2. Open **Settings → Pages → Build and deployment → Source → GitHub Actions**.
3. Open **Actions → Validate and deploy dashboard**. Push a commit to `main`, or use **Run workflow**. The current repository began on `master`, so the workflow supports that branch as well. If changing the default to `main`, switch it under repository settings; no code edit is needed.
4. The workflow runs `npm ci`, JSON validation, calculation/preservation tests and the production build. It uses official `actions/configure-pages`, `actions/upload-pages-artifact` and `actions/deploy-pages` actions with scoped Pages permissions and OIDC.
5. Wait for the deployment to finish, then share **https://attagata.github.io/deso-dashboard/**. The website is public and requires no GitHub account to view.

Vite defaults to `/deso-dashboard/`; CI derives the base from the repository name. For another repository locally, set `VITE_BASE_PATH=/your-repository/` when building. For a root user site (`USERNAME.github.io`), use `/`. All JSON, image and generated asset paths respect this base. Hash navigation supports profile refreshes on Pages without custom server rewrites.

If the first deployment fails because Pages is disabled, select **GitHub Actions** in Pages settings and rerun the workflow. A data-validation failure requires fixing the identified daily file before rerunning.

## Tests and limitations

Automated tests cover real capture totals, historical power differences and percentages, player counts, rank distributions, exact activity boundaries, departure date handling, missing observations/power, duplicate detection, renaming, adjacent-date rank changes, validation errors, chronology and preservation of the supplied data.

The initial dataset has only three capture dates. Captures can be incomplete, displayed power is rounded, matching names is not always conclusive, first/last observations do not prove join/exit dates, and snapshot evidence does not establish exact administrative action times. All daily files are loaded into memory; this is suitable for the current small roster, but a long history may eventually benefit from a generated static summary and on-demand historical loading. There is no upload/edit UI or screenshot OCR in the website: ChatGPT and the administrator handle extraction externally.

The layout targets iPhone Safari and Android Chrome with native selects, touch-sized controls, responsive cards and horizontal table scrolling. Device emulation is useful, but final confirmation on a physical iPhone is still recommended. The dashboard uses system fonts and local assets for alliance features. The approved FreeCounterStat counter additionally loads external scripts/images; it is not a source of alliance data.

Possible future improvements: additional accessible chart comparisons, a documented offline screenshot-import helper, and a human-reviewed identity alias list. None requires server infrastructure.

## Simple visit counter

The owner-supplied FreeCounterStat embed appears at the very bottom of each page, below the React application and its credited footer. It is declared in `index.html`, outside `#root`, so React StrictMode, filtering, date selection and hash/profile navigation do not reload the script. A full document load requests the asynchronous vendor script once; the provider determines whether a request counts as a new visit. This is an approximate counter, not an exact count of people or alliance members.

The embed uses counter ID `13h5wuu6cn83gb5hd9tq3y79lcaht6g9`, the original attribution link, and the supplied `noscript` image fallback. A scoped image-error handler also reuses that same fallback URL if the vendor-generated main image fails; it does not retry repeatedly or react to the separate tracking pixel. Its CSS lives in `src/styles.css`. The script comes from `counter6.optistats.ovh`; the current vendor code also loads a counter image from `counter6.freecounterstat.com` and a tracking pixel from `counter6.optistats.ovh:4433`. Counter configuration and stored counts belong to the provider, not to GitHub Pages or the roster JSONs.

This is an explicitly approved exception to the original no-external-requests requirement. The vendor script uses cookies and may send the current URL (including a profile hash), referrer and browser/display information, in addition to normal connection information such as IP address. The app does not deliberately send roster JSONs or add user authentication, but the script executes in the page context. Do not describe this integration as cookie-free or as guaranteed anonymous. The provider can change its script and counting behavior. An image fallback may issue an additional provider request; counts remain approximate.

The dashboard renders independently of the asynchronous counter. Blocking or losing access to the service may leave the counter blank without blocking alliance features. Browser caching, cookies, blockers and bots may affect counts; no accuracy guarantee or historical count before installation is assumed. Removing the `visit-counter` footer block from `index.html` and its CSS removes this integration without changing alliance data or calculations.

## Manual API feasibility probe

The dashboard still uses static JSON data. A separate, manual experiment checks the community LastWar Tools API without game credentials or automatic imports. Store the provider API key in repository secret `LASTWAR_DESO_TOOLS`, then run **Actions → Test LastWar shared API access → Run workflow** on `master`. It makes at most two shared-pool reads and may consume free provider tokens. It does not purchase credits or modify dashboard data. Aggregate diagnostics appear in the job summary and a seven-day artifact; successful reading does not establish data freshness or activity semantics. See section 17 of both technical references. Offline safeguards: `node --test scripts/probe-lastwar.test.mjs`.
