# CLAUDE.md — Cvent_Code_Files

Auto-read by Claude Code at the start of every session. It carries the context,
rules, and current state for the Cvent custom widgets so work continues
seamlessly. **Read the referenced docs before making changes.**

---

## Repo layout

```
Cvent Code Files/
├── Cvent Widgets/
│   ├── custom-agenda-widget/        ← THE agenda widget (widget.js, AgendaItem.js, editor.js, config.json)
│   ├── custom-featured-speakers/    ← dev branch only so far (not yet promoted to prod)
│   └── Widget Playbook & Boilerplate/
│       ├── CVENT_WIDGET_PLAYBOOK.md ← gotchas, SDK limits, patterns (REQUIRED READING)
│       ├── AGENDA_WIDGET_TODO.md    ← backlog / deferred items for the agenda widget
│       ├── README.md                ← boilerplate guide + §3 branch workflow
│       ├── MIGRATION_folders_to_branches.md
│       └── widget.js / ITEM.js / editor.js / config.json  (boilerplate scaffold, not a live widget)
├── BLE-Events/, code-snippets/, css-files/   ← event CSS and snippets, not environment-tracked
promote.sh                            ← the dev → main promotion script (see Workflow)
```

## What the main project is

A Cvent Flex **custom agenda widget** (`custom-agenda-widget/`, four files:
`widget.js`, `AgendaItem.js`, `editor.js`, `config.json`). It renders an event
agenda with extensive custom features built over many iterations.

## Required reading (in this repo, under `Cvent Code Files/Cvent Widgets/Widget Playbook & Boilerplate/`)

- **`CVENT_WIDGET_PLAYBOOK.md`** — every SDK limitation, gotcha, and proven
  pattern. READ THIS before touching timezone, language, custom-field, shadow-DOM,
  or editor code. It will save you from re-discovering hard-won lessons.
- **`AGENDA_WIDGET_TODO.md`** — backlog and deferred items.
- **`README.md` §3** — git branch workflow (dev → main via `promote.sh`).

## Golden rules (from the Playbook — do not violate)

1. **Test in Incognito on the PUBLISHED front end.** Cvent/CDN cache stale files;
   most "it's broken" moments are stale files, not code.
2. **Editor preview ≠ published front end.** Publish after uploading.
3. **widget.js ↔ AgendaItem.js handshake:** both files must be current together.
   `widget.js` sets props (`el.session`, `el.config` incl. `tileMode`, etc.)
   before append; `AgendaItem.js` reads them in `connectedCallback`.
4. **Gate new/behavioral features behind a toggle that defaults OFF**, so existing
   events are unchanged until a planner opts in (pattern used for: accent bar,
   hide date nav, focus legend, compact styling, concurrent tiles).
5. **Strip debug `console.log` before prod** (keep `console.warn` error handlers).
6. **Custom-field name matching is case-insensitive + trimmed** (exact match has
   bitten us repeatedly).

## Key implementation facts (so you don't relearn them)

- **Timezone:** session times are UTC; always format with an explicit `timeZone`
  from `getEventInfo().timezone`. Day-grouping also uses the event zone. Cvent
  maps "London" → `Atlantic/Reykjavik` (DST-stripped) — normalize to
  `Europe/London`. See `_tzNormalize` / TZ_NORMALIZE in widget.js.
- **Language:** the runtime selector lives in `document.documentElement.lang`
  (NOT the event default). Detect there, fall back to event default, then EN.
  Localized: legend, focus eyebrow, date headers (capitalize first letter for
  es/pt). Supported: en, es, pt.
- **Native session tags are NOT SDK-exposed** — we use a `Tags` MultiChoice
  custom field instead. Focus/Break/etc. also use custom fields.
- **Concurrent tile tiers by duration** (2026-09-12): <=15 min = "strip" (48px,
  one row: title · time · up to 3 tiny avatars, plain accent bar, no tags),
  16–29 min = "compact" (104px, 14px title, time, avatar row, no description),
  >=30 min = "full". `tierOf()` in widget.js sets `cfg.tileTier`; per-tier
  floors feed the stretched time scale so short sessions barely distort it.
- **Concurrent tiles** are opt-in (`concurrentTiles` toggle, default off). When
  on, overlapping sessions render as a time grid (4px/min, MIN_H 118, MAX_H 440);
  plenary-left/focus-right for same start times; tiles pin speakers to bottom,
  title shrinks to 12px then clamps, description fills the middle with "show more".
  When off, single-column classic layout.
- **Compact typography** is the default scale now (title 17/desc 13/speaker 14 px
  on desktop).
- **Bios** come as `\r\n\r\n` plain text — convert to `<p>` before innerHTML.
- **Accent-derived colours** (2026-09-12): the time column, speaker names,
  "show more", and the active date tab all take the Plenary accent (or the
  Focus accent on focus sessions). `gutterBg`, `showMoreColor`,
  `dateNav.underlineColor` and `typography.speakerName.color` are no longer
  read; their editor controls are gone. Don't re-add per-element colours.
- **Editor "New Features" section** (second in the panel) holds every opt-in
  toggle: Header style + Eyebrow text, Date nav behaviour, accent bar, focus
  legend, concurrent tiles. Session Types keeps only the colours and labels.
- **Header style** is a planner choice: `headerStyle` = `classic` (default, the
  original look) or `editorial` (eyebrow + accent rule + muted subheader, legend
  inline under the masthead, pill date tabs, day headers with a session count
  and hairline). `headerEyebrow` overrides the auto event-date-range eyebrow.
  Added 2026-09-12 as an opt-in preview; keep classic the default.
- **Renders are sequenced** (`_renderSeq` in widget.js): a render still awaiting
  session data bails out if a newer config update has cleared the container.
  Without this, two quick config updates doubled the agenda.
- **Date nav behaviour** is a planner choice: `dateNavMode` = `jump` (default:
  all days listed, click scrolls to the day) or `filter` (one day shown at a
  filter on top of the full list: all days show by default, an "All days" tab
  leads the nav, a day tab narrows to that day, clicking the active day again
  or "All days" clears it; each day is a `.daySection`, the choice is
  remembered across re-renders in `_activeDayKey`; legend / start rule show
  on the first VISIBLE day only). Filter is the answer to "why scroll back up
  to pick a day" — do not reintroduce sticky positioning for that.
- **Date nav is NOT sticky** (removed 2026-09-12). It is a plain row of day
  links; the only Cvent-header measurement left is at click time so a day jump
  lands below the pinned site header. Do not reintroduce sticky positioning.
- **Speaker modal look** (2026-09-12): accent line across the top, floating
  circular close (from a card) or back-link head bar (from a tile), body =
  photo | role eyebrow ("Speaker"/"Moderator", detected from category/title/
  company incl. a "(Moderator)" company suffix, re-evaluated after hydration)
  + big name + muted title + accent-tinted company pill, hairline, bio, then
  the SESSIONS list (keep it). Modal accent is plenary/focus, never break grey
  (`_modalAccent`).
- **One modal.** Session and speaker details use a single shell (`_ensureSessionModal`
  → `_renderSessionView` / `_renderSpeakerView`). Standalone cards open the speaker
  view directly with `openModalForSpeaker` (close only); tiles go session → speaker
  with a back link. Modal CSS comes from `_sharedModalCss(cfg)` and must be injected
  into every render path's `<style>` (Playbook §5). Do not add a second modal.
- **Speaker order** follows Cvent's raw array (drag-and-drop) order; opt-in
  alphabetical toggle exists.

## Known open items / edge cases

- No debug `console.log` calls remain in the three widget files (as of
  2026-09-11). Keep it that way; `console.warn` error handlers are fine.
- Concurrent grid time axis is intentionally NON-uniform: it stretches around
  sessions shorter than MIN_H so short tiles keep their speaker row without
  overlapping the next tile (fixed 2026-09-11; see AGENDA_WIDGET_TODO.md Done).
- See `AGENDA_WIDGET_TODO.md` for the full backlog (Option A rail unification,
  compact-mode cutover + toggle removal, normal-card modal unification,
  grid↔stack resize re-render).

## Workflow (this repo uses branches, not folders — since Sep 2026)

- `dev` branch = Cvent **Sandbox** widget; `main` branch = Cvent **Prod** widget.
- Same file paths on both branches. The ONLY intentional permanent difference is
  `customElementName` in `config.json`: `dev-custom-agenda-widget` on `dev`,
  `custom-agenda-widget` on `main` (Cvent registers Sandbox and Prod under
  different names). Never "fix" that difference.
- Develop on `dev`: edit → `git add . && git commit && git push origin dev` →
  upload the files from `custom-agenda-widget/` to the Cvent Sandbox widget →
  test in incognito.
- Promote: `git checkout main && ./promote.sh "Promote dev to prod: <what>"` then
  `git push origin main`, then upload `main`'s files to the Cvent Prod widget.
  `promote.sh` does the merge, restores prod config names, and refuses to commit
  a `dev-` name. Do NOT use a plain `git merge dev` on main.
- Uploading to Cvent is always manual. Nothing in git touches live widgets.
- Safety net: tag `backup-before-branch-migration` + `~/Cvent_Code_Files_backup_2026-09-11.zip`.

## How to work with me here

- When I edit files, I edit the real repo files directly — review the diff before
  committing. Widget edits happen on `dev` unless told otherwise; check the
  branch first (`git branch --show-current`).
- Before shipping, run the **Pre-prod checklist** in the Playbook (§11).
- The widget files use **CRLF line endings**. Preserve them when editing (a
  rewrite that converts to LF shows up as a 2,500-line diff). Check with
  `git diff --stat` before committing; only the lines you touched should appear.
- If something "doesn't work," first suspect a stale Cvent upload (re-upload,
  incognito) before assuming the code is wrong.
