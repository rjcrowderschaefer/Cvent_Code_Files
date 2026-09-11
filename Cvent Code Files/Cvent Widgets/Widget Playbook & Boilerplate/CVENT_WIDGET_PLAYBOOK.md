# Cvent Custom Widget Playbook

Hard-won knowledge for building Cvent Flex custom widgets. Every item here is a
real gotcha, limitation, or pattern discovered building production widgets.
When you hit a problem on a new widget, search this doc first.

> Docs: https://developers.cvent.com/docs/custom-widgets/overview
> Note: the docs site is JS-rendered — read it in a browser, not via fetch.

---

## 0. Golden rules (read these first)

1. **Test in Incognito, always.** Cvent + its CDN cache widget files aggressively.
   A normal hard-refresh often serves a stale `.js`. ~90% of "it's broken /
   didn't change" moments are stale files, not code. Verify the file is live via
   DevTools → Sources → open the loaded file → Cmd+F for a string you just added.
2. **Editor preview ≠ published front end.** The editor shows your working draft
   config; the front end serves the *last published* config. If it works in the
   editor but not live, **you probably didn't publish** (or CDN hasn't propagated).
3. **The SDK is authoritative for data, not your assumptions.** If a field isn't
   on the session object, it's not available — confirm by dumping the object.
4. **Prod and dev widgets are separate files with the same names.** Uploading to
   one doesn't touch the other. Multi-file widgets must be kept in sync across
   BOTH the widget and its component files simultaneously (see §4).

---

## 1. SDK data & method limitations

The Custom Widget SDK exposes far less than the Cvent backend has. Confirmed gaps:

- **Native session "tags" are NOT exposed.** The session object has no `tags`,
  `labels`, or similar field, and they're not in `sessionCustomFields` either.
  **Workaround:** create a **MultiChoice custom field** (e.g. named "Tags"); its
  `value` is a clean array of strings you can read.
- **`getSessionStatus` is unavailable to "Website" purpose widgets.** Only
  available to `SessionRegistration` purpose. Error: *"the custom widget sdk
  property 'getSessionStatus' is not available to custom widgets with the Website
  purpose."* Use fields already on the session (`isOpenForRegistration`, custom
  fields) instead.
- **`getEventDetails` returns `undefined`** on Website purpose. Use
  **`getEventInfo()`** instead (available), which returns event metadata incl.
  `timezone`, `locales`, `startDate`, planner, address.
- **`config.json` `purpose` is a single string**, not an array. Values:
  `Website`, `SessionRegistration`, `AllPages`. `AllPages` still can't access
  `getSessionStatus`.
- **No method to fetch a registrant's `registrationId`** — so `getSessionStatus`
  is effectively current-registrant-only even where available.

### How to confirm what's available (probe pattern)
```js
// Dump the full session object + hunt for a field by keyword.
console.log(JSON.stringify(session, null, 2));
const hunt = (obj, path = "") => {
  if (!obj || typeof obj !== "object") return;
  Object.keys(obj).forEach((k) => {
    const p = path ? `${path}.${k}` : k;
    if (/tag|label|keyword|topic|track/i.test(k)) console.log("HIT:", p, obj[k]);
    if (obj[k] && typeof obj[k] === "object") hunt(obj[k], p);
  });
};
hunt(session);
```

### Confirmed session object shape (Website purpose)
`id, name, code, isIncludedSession, startDateTime, endDateTime, description,
location{id,name,code}, category{id,name,description}, speakers[{id,firstName,
lastName,profilePictureUri}], presentationType, isOpenForRegistration,
isWaitlistEnabled, displayPriority, isFeatured, capacity, waitlistCapacity,
sessionCustomFields[{id,name,type,value[]}], associatedRegistrationTypes, locale`

---

## 2. Timezones (the biggest footgun)

- **All session times come as UTC** (`"2026-06-16T07:45:00.000Z"`). They are NOT
  in the event timezone.
- **You MUST convert using the event's IANA timezone**, or times render in the
  viewer's device timezone. Get the zone from `getEventInfo().timezone`.
- **Always format with an explicit `timeZone`:**
  ```js
  d.toLocaleString("en-US", { timeStyle: "short", timeZone: eventTz });
  ```
- **Grouping by day must ALSO use the event timezone**, or a session can land
  under the wrong date header (e.g. a 9 AM Singapore session showing under the
  previous day for a US viewer). Use `Intl.DateTimeFormat("en-CA", {timeZone})`
  to derive a `YYYY-MM-DD` key in the event zone.
- **Cvent maps some timezone options to DST-stripped IANA zones.** Confirmed:
  Cvent's **"London"** option returns **`Atlantic/Reykjavik`** (permanent GMT+0,
  no DST) instead of `Europe/London` (which observes BST). This makes summer
  times an hour off. **Fix:** a normalize map, applied to whatever `getEventInfo`
  returns:
  ```js
  const TZ_NORMALIZE = { "Atlantic/Reykjavik": "Europe/London" };
  ```
  Only remap DST-stripped zones for regions that observe DST; verify each mapping
  empirically (set the event to that city, log `getEventInfo().timezone`). Note
  this remap is only "correct" if it matches planner intent (don't remap if you
  genuinely run events in Reykjavik).
- **`getEventInfo()` timezone changes require publishing** to reflect on the
  front end (the SDK serves the published value).
- **Timezone abbreviations are per-date** (DST): `Europe/London` is `GMT+1`
  (BST) in summer, `GMT` in winter. Compute the abbreviation from each session's
  own date via `timeZoneName: "short"`, don't hardcode.

---

## 3. Language / localization

- **Event default language:** `getEventInfo().locales` → the entry with
  `isDefault: true`, field `cultureCode` (e.g. `"pt-BR"`).
- **The runtime language selector** (attendee switches display language) is NOT
  the event default. It's exposed via **`document.documentElement.lang`** (the
  `<html lang>` attribute), which Cvent updates on switch.
- **Detect the SELECTED language, fall back to the event default:**
  ```js
  const mapLang = (c="") => c.toLowerCase().startsWith("es") ? "es"
    : c.toLowerCase().startsWith("pt") ? "pt"
    : c.toLowerCase().startsWith("en") ? "en" : null;
  const lang = mapLang(document.documentElement.lang)
            || mapLang(defaultLocaleCultureCode) || "en";
  ```
- **Localize dates via `toLocaleDateString(locale, …)`** — it translates weekday
  and month names AND reorders format (es/pt put day before month with "de").
  Map your lang to a full locale: `es` → `"es"`, `pt` → `"pt-BR"`, `en` → `"en-US"`.
- **es/pt lowercase weekday/month by grammar** ("quarta-feira, 21 de outubro").
  That's correct, but for a HEADER capitalize only the FIRST letter:
  ```js
  const capFirst = s => s ? s[0].toUpperCase() + s.slice(1) : s;
  ```
- **Keep the fixed sentence template translated, but the editable label
  translated by the planner.** e.g. legend = template("Indicates a [X] session"
  / "Indica uma sessão de [X]") + a planner-editable `[X]` label.

---

## 4. The four-file structure & multi-file sync

Widgets are four files: `config.js`/`config.json`, `editor.js`, `widget.js`, and
component file(s) (e.g. `AgendaItem.js`).

- **`widget.js` orchestrates; component files render items.** Common pattern:
  `widget.js` creates a custom element (`document.createElement("your-tag")`),
  sets `el.session`, `el.theme`, `el.config`, then appends. The component's
  `connectedCallback` reads those and renders.
- **Set properties BEFORE `append()`** — `connectedCallback` reads them on
  upgrade. (In practice this works reliably; if a prop seems missing, the file is
  stale, not the timing.)
- **The widget↔component handshake means BOTH files must be current at once.**
  If `widget.js` passes a new config key (e.g. `tileMode: true`) but the live
  `AgendaItem.js` is an old version that doesn't read it, you get broken output.
  Symptom: full-card render where you expected tiles, or `undefined` for a config
  you know you set. **Fix:** upload both, verify both live via Sources.
- **Detect a stale component file** by putting a unique log/string in it and
  searching the loaded source.

---

## 5. Shadow DOM & CSS

- **Each custom element has its own shadow root and its own `<style>` block.**
  CSS defined in one render path is NOT available in another. Real bug we hit:
  a modal opened from a "tile mode" render didn't have the modal CSS because that
  lived in the full-card style block, not the tile's. **Fix:** inject the needed
  CSS into whichever shadow root will render it (or share a CSS-string helper).
- **Inline styles beat the Cvent global stylesheet; attributes don't reliably.**
  For SVG icons, set `fill`/`stroke`/`width` as **inline styles**, not just
  attributes — Cvent global CSS (`svg{...}`, `path{fill}`) can otherwise recolor
  or distort them. Inline SVG (vs. PNG) is preferred: recolorable, sharp, no asset
  hosting.
- **Content Security Policy is report-only (for now).** Inline styles trigger CSP
  warnings but still apply. Dynamic per-config inline styles (typography from
  planner settings) will always warn — acceptable while report-only, but prefer
  a `<style>` block with classes where values are static.
- **Cvent CSS specifics:** the Carina design system, `data-cvent-id` hooks, and
  Emotion-hashed class names (`css-xxxx`) are unstable — don't target them.
  Prefer stable IDs/classes (`#navigationContainer`, `.cus_nav`) but verify they
  exist per breakpoint (Cvent swaps header elements responsively).
- **CSS char cap:** Cvent limits custom stylesheet size. Minify, use reusable
  utility classes, and keep static CSS in `<style>` rather than inline where
  possible.

---

## 6. Custom fields as your extension mechanism

Since native features (tags, arbitrary metadata) aren't SDK-exposed, **custom
fields are how you attach data to sessions the widget can read.**

- Read from `session.sessionCustomFields` — an array of
  `{id, name, type, value[]}`.
- **Match by name, case-insensitively and trimmed** (Cvent field names can vary):
  ```js
  const f = session.sessionCustomFields?.find(
    x => x.name?.trim().toLowerCase() === "focus session?"
  );
  const isFocus = !!f?.value?.includes("Yes");
  ```
- Field `type` values seen: `SingleChoice` (one value in `value[]`),
  `MultiChoice` (multiple values — ideal for tags, up to N inputs).
- **Exact string match will silently fail** on casing/spelling mismatches. This
  bit us repeatedly (`"Break Type"` vs `"Break type"`). Always trim + lowercase.
- Custom-field data **requires publishing** to reach the front end.

---

## 7. Editor patterns

- **Config flows:** `editor.js` builds a settings panel; `_patch(partial)` merges
  into config and calls the host's `setConfiguration`, which propagates to the
  widget (fires the widget's `onConfigurationUpdate`, which re-renders).
- **`_patch` deep-merges nested objects** (typography, modalColors) — pass a full
  nested object to replace all keys, or a partial to merge.
- **Gate new/behavioral features behind a toggle that defaults OFF**, so existing
  events are unchanged until a planner opts in. This is the safe rollout pattern
  (used for accent bar, hide date nav, focus legend, compact styling, concurrent
  tiles). There's no way to distinguish "new event" from "existing un-customized
  event," so a default-off toggle is the only clean opt-in.
- **The editor should reflect what renders.** If a feature sets values (e.g. a
  compact type scale), write those values into the config so the editor fields
  show them accurately and stay editable.
- **`<select>` in a panel that re-renders on every `_patch`:** use `onchange`
  (fires on blur/commit), not `oninput`, or the re-render steals focus.
- **Editor preview may not have full SDK data** (e.g. `getEventInfo` can differ),
  so build in fallbacks; don't assume editor === front end.

---

## 8. Speaker data & hydration

- Session `speakers[]` gives `{id, firstName, lastName, profilePictureUri}` —
  **no title, company, or bio.**
- **Title/company/bio require a separate hydration call** (a `getSpeakers([id])`
  style function passed through config). Render the basics immediately, then fill
  title/company/bio async when hydration resolves.
- **Speaker order:** Cvent returns speakers in the session-level drag-and-drop
  order as the RAW ARRAY ORDER. There's no reliable `displayPriority` field
  (it's `undefined`). To honor the planner's order, DON'T sort — return the array
  as-is. (Offer alphabetical as an opt-in if wanted.)
- **Bios are plain text with `\r\n\r\n` paragraph breaks**, not HTML. Assigning
  via `innerHTML` collapses them. Convert: split on `\n{2,}` → `<p>`, single
  `\n` → `<br>`. Guard: if it already contains block HTML, leave it.

---

## 9. Sticky / scroll / responsive (if building nav or grids)

- **`position: sticky` only works within its own scroll container.** Inside a
  shadow root or iframe, that may not be the page — a sticky element can pin to
  the wrong boundary. Confirm what actually scrolls (`window.pageYOffset` vs a
  nested element) before relying on sticky.
- **Cvent's header pins at a negative top offset** (`top: -10`) once scrolled, so
  measure its LIVE `getBoundingClientRect().bottom`, not its height, to place
  something beneath it.
- **Cvent swaps header elements per breakpoint** (`#navigationContainer` desktop,
  `.cus_nav` tablet/mobile). Measure whichever is currently visible (nonzero
  height), and re-measure on scroll + resize (the pinned bottom only settles
  after scrolling).
- **Anchor scroll across auto-sizing iframes** (Cvent Code Widgets) can land on
  the wrong section on mobile — the parent scroll container differs from the
  widget's. Compute absolute position and scroll the real container.

---

## 10. Debugging workflow that works

1. Reproduce in **Incognito** (rules out cache).
2. Add a `console.log` with a **unique tag** (`"XYZ PROBE |"`), upload, filter
   the console for that tag. Cvent/Datadog spam the console — always filter.
3. If the log doesn't appear: **Sources → open loaded file → search for the tag.**
   Absent = stale file (re-upload, disable cache). Present but silent = code path
   not reached (check for errors, check the config gating it).
4. **`JSON.stringify` values** so structure (arrays, `\r\n`, empty vs null) is
   visible.
5. Ignore `net::ERR_BLOCKED_BY_CLIENT` on `datadoghq.com` — that's an ad-blocker
   blocking Cvent telemetry, unrelated to your widget.
6. **Strip all `console.log` before promoting to prod.** Keep `console.warn` for
   genuine error handlers.

---

## 11. Pre-prod checklist

- [ ] All `console.log` debug statements removed (keep `console.warn` error handlers)
- [ ] Tested in Incognito on the PUBLISHED front end, not just editor preview
- [ ] Both widget.js and component file(s) uploaded & verified live
- [ ] Timezone: times + day grouping use the event zone; DST abbreviations correct
- [ ] Language: legend/eyebrow/dates follow the runtime selector, not just default
- [ ] New behavioral features gated behind a default-OFF toggle
- [ ] Custom fields created in Cvent with EXACT names your code matches (case-insensitive match recommended)
- [ ] Prod widget updated separately from dev (they're different files)
- [ ] Published (editor changes don't reach the front end without publishing)
