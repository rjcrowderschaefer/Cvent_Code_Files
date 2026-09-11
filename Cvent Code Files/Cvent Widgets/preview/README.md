# Local preview for the agenda widget

Runs the real `custom-agenda-widget/widget.js`, `AgendaItem.js` and `editor.js`
in a plain browser page against a mock Cvent SDK fed by `data/agenda-dump.json`
(a real dump captured from the sandbox). Editor on the left, widget on the right,
config changes re-render live. Nothing here is uploaded to Cvent.

## Run

From the repo root:

```bash
python3 -m http.server 8765 --directory "Cvent Code Files/Cvent Widgets"
```

then open <http://localhost:8765/preview/>. (ES modules won't load from `file://`,
hence the server.) In DevTools, tick **Disable cache** while the panel is open so
edits are picked up on reload. (The harness already cache-busts all three widget files,
so this is belt-and-suspenders.)

Claude Code: `.claude/launch.json` at the repo root defines the same server as
`agenda-preview`.

## What it covers / doesn't

Covers layout, typography, concurrent tiles, modals, editor plumbing, timezone and
language paths (use the lang selector; the widget reads `<html lang>` like Cvent).
Does NOT cover Cvent's global CSS bleed, the real header/sticky behaviour, real SDK
shape drift, or cache/publish issues. Always do one sandbox upload + incognito
check before promoting.

## Refresh the data

Re-run the dump probe (see CLAUDE.md / git history for the snippet), copy the
logged object, overwrite `data/agenda-dump.json`. Editor config persists in
`localStorage`; **reset config** in the toolbar clears it.
