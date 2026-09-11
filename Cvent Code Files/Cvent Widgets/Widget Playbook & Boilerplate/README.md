# Cvent Custom Widget Framework

A reusable starting point for building Cvent Flex custom widgets, distilled from
production experience. Two parts:

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

## 2. `boilerplate/` — the scaffold

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
