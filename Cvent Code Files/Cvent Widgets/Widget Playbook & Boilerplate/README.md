# Cvent Custom Widget Framework

A reusable starting point for building Cvent Flex custom widgets, distilled from
production experience. Four parts:

## 1. `CVENT_WIDGET_PLAYBOOK.md` — the reference

Every gotcha, SDK limitation, and proven pattern, organized by topic. **Read §0
(Golden Rules) before you start, and search this doc the moment something breaks.**
Highlights:
- Which SDK methods/fields are (and aren't) available
- Timezone handling (UTC conversion, DST, Cvent's London→Reykjavik quirk)
- Language detection (runtime selector via `<html lang>`)
- Shadow-DOM CSS isolation
- Custom fields as your extension mechanism
- The multi-file sync trap
- A pre-prod checklist

## 2. `LOCAL_PREVIEW.md` — run it locally before uploading

How to start the local preview server, clone the `preview/` harness for a new
widget (one `cp` + one `sed`), capture a sandbox data dump for it, and which
prompts to give Claude. Every widget should get a preview folder on day one.

## 3. `TYPOGRAPHY.md` + `type-scale.js` — one type system for every widget

The shared scale (roles → size / weight / colour at three breakpoints), the
colour tokens, the brand font loader, and the rules for migrating saved
configs when a default changes. Each widget maps its typography keys to roles
and carries an identical copy of `type-scale.js`.

## 4. `boilerplate/` — the scaffold

Four skeleton files with the proven patterns pre-wired, but no widget-specific
logic. Copy the folder, rename, and build on top.

| File | Role |
|------|------|
| `config.json` | Widget manifest. `purpose` is a single string. |
| `widget.js` | Orchestrator: fetches data, handles timezone + language, hands items to the component. |
| `ITEM.js` | Component element: renders one item in its own shadow root. Includes bio + inline-SVG helpers. |
| `editor.js` | Settings panel: `_patch` flow, default-OFF feature gating, deep-merge config. |

### What's already handled in the scaffold
- ✅ Timezone normalize map + explicit-`timeZone` formatting
- ✅ Language detection (selector → event default → English) + localized dates
- ✅ Case-insensitive custom-field reader
- ✅ Widget↔component handshake (props before append)
- ✅ Shadow-DOM `<style>` block pattern
- ✅ Bio `\r\n\r\n` → HTML converter
- ✅ Inline-SVG icon helper (immune to Cvent global CSS)
- ✅ Editor `_patch` + deep-merge + default-OFF toggle pattern
- ✅ `console.warn` for real errors (no debug `console.log`)

### First steps on a new widget
1. Copy `boilerplate/`, rename the files/tags/classes.
2. Set `purpose` in `config.json` (default `Website`).
3. Implement `_fetchItems()` in `widget.js` (your real data source).
4. Build the item UI in `ITEM.js`.
5. Add editor controls in `editor.js`, gating new behavior behind default-OFF toggles.
6. Before shipping: run the **Pre-prod checklist** in the Playbook (§11).

### The one habit that saves the most time
**Test in Incognito, on the published front end.** Most "it's broken" moments are
stale cached files, not code. See Playbook §0 and §10.

## 3. Branch workflow (prod vs sandbox)

Since Sep 2026 this repo uses **branches, not folders**, to separate environments.

| Branch | Cvent environment | Widget folders (under `Cvent Code Files/Cvent Widgets/`) |
|--------|-------------------|-----------------------------------------------------------|
| `main` | **Prod**          | `custom-agenda-widget/` |
| `dev`  | **Sandbox**       | `custom-agenda-widget/`, `custom-featured-speakers/` (sandbox-only so far) |

Same paths and filenames on both branches. The one intentional, permanent
difference is `customElementName` in each `config.json`: on `dev` it carries the
`dev-` prefix (`dev-custom-agenda-widget`), on `main` it does not
(`custom-agenda-widget`), because the Cvent Sandbox and Prod widgets are
registered under different names.

```
Develop:   git checkout dev  → edit → upload to the Cvent SANDBOX widget → test in incognito
Save:      git add . && git commit -m "..." && git push origin dev
Inspect:   git diff main dev        (what prod will gain; afterwards only config.json names should differ)
Promote:   git checkout main && ./promote.sh "Promote dev to prod: <what changed>"
           (merges dev, restores prod customElementName(s), refuses to commit a dev- name)
           git push origin main
Deploy:    upload main's files to the Cvent PROD widget; verify via Sources that both widget + component files are live
```

`promote.sh` (repo root) is the promote step. It runs `git merge --no-ff --no-commit dev`,
restores `main`'s `config.json` for every widget that already exists on `main`, strips the
`dev-` prefix for widgets new to `main` (e.g. `custom-featured-speakers`), and aborts the
merge if any `dev-` name would land on `main`. Manual equivalent, if you ever need it:
`git merge --no-ff --no-commit dev`, then `git checkout HEAD -- <widget>/config.json`, then commit.

Safety net from the migration: the tag `backup-before-branch-migration` (also on
GitHub) and `~/Cvent_Code_Files_backup_2026-09-11.zip` hold the old folder
layout. Background: `MIGRATION_folders_to_branches.md`.
