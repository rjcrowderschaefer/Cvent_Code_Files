# Local live preview for Cvent custom widgets

Run any widget in this repo locally, against a mock Cvent SDK fed by a real
sandbox data dump, with the real `editor.js` on the left and the real
`widget.js` on the right inside a device-sized iframe (desktop / laptop /
tablet / mobile). Config edits re-render live. Nothing here touches Cvent.

The reference harness lives in `Cvent Code Files/Cvent Widgets/preview/` and is
wired to `custom-agenda-widget`. For a new widget you clone that folder (steps
in §3). One static server serves every preview folder.

---

## 1. Start / stop the server

**From Claude Code (preferred).** The launch config `agenda-preview` exists in
both `.claude/launch.json` (repo root) and `~/Claude Code/.claude/launch.json`.
Ask Claude:

> Start the preview server and open http://localhost:8765/preview/

Claude uses `preview_start {name: "agenda-preview"}` and opens the in-app
browser. To stop: "Stop the preview server" (`preview_stop`). The server does not
survive between sessions, so ask for it again each time.

**Manually.** From the repo root:

```bash
python3 -m http.server 8765 --directory "Cvent Code Files/Cvent Widgets"
```

Open <http://localhost:8765/preview/> (agenda) or
<http://localhost:8765/preview-<widget-folder>/> (any clone). Ctrl-C stops it.
ES modules will not load from `file://`, hence the server.

**Caching.** The harness cache-busts its own scripts and all widget files with
`?v=Date.now()`, so a plain reload picks up edits. If something still looks
stale, tick DevTools → Network → Disable cache, or add `?nocache=1` to the URL.

---

## 2. What the harness is

| File | Role |
|---|---|
| `index.html` + `harness.js` | Parent page. Mounts `editor.js`, owns the toolbar (lang, breakpoint, re-render, reset config) and sizes the iframe. Config persists in `localStorage`. |
| `frame.html` + `frame.js` | Runs inside the iframe. Imports `widget.js`, builds the mock SDK, exposes `window.__preview` `{ready, mount, update, setLang, info, data}`. Includes a fake sticky `#navigationContainer` so header-offset logic has something to measure. |
| `mock-sdk.js` | Fakes `getSessionGenerator(sort, pageSize)`, `getEventInfo()`, `getSpeakers(ids)` from the dump. Generic: any widget that only uses those three calls needs no change. |
| `data/<widget>-dump.json` | `{ eventInfo, sessions, speakers }` captured from the sandbox (§4). |

The widget is constructed exactly as Cvent does it: `new Widget({configuration,
theme})`, `widget.cventSdk = sdk`, then appended. Config changes go through
`widget.onConfigurationUpdate(cfg)`. Language changes set `<html lang>`.

Covers: layout, typography, breakpoints, modals, editor plumbing, timezone and
language paths. Does NOT cover: Cvent's global CSS bleed, the real site header,
SDK shape drift, publish/cache issues. Always do one sandbox upload + incognito
check before promoting to `main`.

---

## 3. Set up a preview for a new widget

Prerequisite: the widget follows the four-file boilerplate
(`widget.js` default-exports the element class with `constructor({configuration,
theme})`; `editor.js` default-exports the editor with
`constructor({setConfiguration, initialConfiguration})`; sub-components are
imported by `widget.js` with a fixed relative specifier).

1. **Clone the harness** (replace the three placeholders):

   ```bash
   cd "Cvent Code Files/Cvent Widgets"
   cp -R preview preview-custom-featured-speakers
   cd preview-custom-featured-speakers
   sed -i '' \
     -e 's#custom-agenda-widget#custom-featured-speakers#g' \
     -e 's#AgendaItem\.js#FeaturedSpeaker.js#g' \
     -e 's#agenda-dump\.json#featured-speakers-dump.json#g' \
     -e 's#agenda-preview#featured-speakers-preview#g' \
     -e 's#preview-agenda-#preview-featured-speakers-#g' \
     -e 's#agenda preview#featured speakers preview#g' \
     -e 's#Agenda widget#Featured speakers widget#g' \
     frame.js harness.js index.html
   ```

   What each substitution does:
   - widget folder → `WIDGET_DIR` in `frame.js` and `harness.js`
   - sub-component file → the `fetch(..., {cache: "reload"})` prefetch in
     `frame.js` (needed because `widget.js` imports it with a fixed specifier
     that cannot be cache-busted)
   - dump filename → the data file `frame.js` loads
   - `agenda-preview` → the `localStorage` keys, so widgets don't share config
   - `agenda preview` / `Agenda widget` → toolbar label and page title (cosmetic)
   - `preview-agenda-` → the custom element names registered by the harness
     (any unique name works; the real `customElementName` comes from
     `config.json` only when Cvent loads it)

2. **Delete the agenda-only bits.** In `frame.js` remove `setShortSamples`; in
   `harness.js` remove the `samples` block; in `index.html` remove the
   "short samples" checkbox. Leaving them in is harmless as long as the box
   stays unticked, so this can wait.

3. **Add the dump** to `data/<widget>-dump.json` (§4). Remove the copied
   `agenda-dump.json` if the new widget does not need it.

4. **Extend the mock SDK only if the widget calls something else.** Add the
   method to the object returned by `createMockSdk` and the matching data to the
   dump. Keep the async `wait(latency)` so loading states still render.

5. **Open** <http://localhost:8765/preview-custom-featured-speakers/> and check
   the status line reads `N sessions · tz … · event "…"`. Then walk the four
   breakpoints and the language selector.

6. **Commit the folder on `dev`.** Preview folders carry no Cvent-facing config,
   so `./promote.sh` moves them to `main` untouched.

---

## 4. Capture a data dump from the sandbox

Temporary code, sandbox only, removed before commit. Paste into the widget after
`cventSdk` is available (e.g. top of the data-loading method), upload to the
sandbox, open the published page (not the editor preview), filter the console by
the tag, right-click the logged string → **Copy string contents**, save as
`preview-<widget>/data/<widget>-dump.json`.

```js
// DUMP PROBE | TEMP — delete before committing
(async () => {
  const sdk = this.cventSdk;
  const sessions = [];
  for await (const page of await sdk.getSessionGenerator("dateTimeAsc", 100)) sessions.push(...page);
  const eventInfo = await sdk.getEventInfo();
  const ids = [...new Set(sessions.flatMap((s) => (s.speakers || []).map((sp) => sp.id)))];
  const speakers = ids.length ? await sdk.getSpeakers(ids) : {};
  console.log("DUMP PROBE |", JSON.stringify({ eventInfo, sessions, speakers }));
})();
```

Refresh the dump whenever the sandbox event changes (new sessions, speakers,
custom fields). The `data()` hook on `window.__preview` returns the loaded dump
so you can mutate a session in the console and re-mount to test edge cases.

---

## 5. Prompts that work

- "Start the preview server and open /preview-custom-featured-speakers/ at mobile."
- "Set up a preview folder for `custom-xyz` following LOCAL_PREVIEW.md §3; the
  dump is at ~/Downloads/xyz-dump.json."
- "Verify this change in the preview at desktop and mobile in en/es/pt, then
  screenshot."
- "Stop the preview server."
