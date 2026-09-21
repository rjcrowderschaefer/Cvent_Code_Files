# Typography system for Cvent custom widgets

One type scale, shared by every custom widget, so that two widgets on the same
page read as one product and a size change happens in one place.

The system lives in **`type-scale.js`**. The canonical copy is in this folder;
every widget folder carries an **identical copy**, because Cvent only lets a
widget import files that were uploaded alongside it. Edit the canonical copy,
copy it into each widget folder, and upload it with the widget's other files.

```
Widget Playbook & Boilerplate/type-scale.js   ← canonical
custom-agenda-widget/type-scale.js            ← identical copy (uploaded to Cvent)
custom-featured-speakers/type-scale.js        ← identical copy (uploaded to Cvent)
```

---

## 1. The scale

Sizes are px at **desktop / ≤1024px / ≤600px** (the two breakpoints every
widget uses). Weight is 700 where marked bold, 400 otherwise. Colours are the
shared tokens in §2.

| Role        | Desktop | ≤1024 | ≤600 | Weight | Colour  | Used for                                              |
|-------------|---------|-------|------|--------|---------|-------------------------------------------------------|
| `display`   | 28      | 24    | 20   | 700    | ink     | Section heading ("Agenda", "Featured Speakers")       |
| `headline`  | 29      | 26    | 24   | 700    | ink     | Speaker name in a modal                               |
| `title`     | 20      | 18    | 16   | 700    | ink     | Session title on a card                               |
| `subtitle`  | 18      | 16    | 15   | 700    | ink     | Day header, session-modal title                       |
| `lead`      | 18      | 16    | 15   | 400    | muted   | Intro / subheader line, speaker title in a modal      |
| `body`      | 18      | 16    | 15   | 400    | body    | Speaker bio in a modal                                |
| `bodySmall` | 16      | 14    | 13   | 400    | ink     | Session description on a card                         |
| `name`      | 16      | 15    | 14   | 700    | ink     | Speaker name on a card / tile                         |
| `listTitle` | 15      | 14    | 14   | 700    | ink     | Session rows inside a modal                           |
| `meta`      | 14      | 13    | 12   | 400    | muted   | Speaker title / company on a card / tile              |
| `caption`   | 13      | 13    | 12   | 400    | muted   | Date/time lines, notes                                |
| `tag`       | 12      | 12    | 11   | 700    | body    | Company tag, location/category pills (uppercase)      |
| `label`     | 11      | 11    | 11   | 700    | muted   | Eyebrows ("SPEAKER"), section labels ("SESSIONS")     |

Letter-spacing and text-transform for `tag` and `label` (uppercase, tracked)
belong in the widget's stylesheet, not in the scale — the scale only carries
what the editor's typography controls can express (size, weight, italic,
colour).

Two widgets sharing a role must render it identically. If a role needs to
change, change it in `type-scale.js`; do not fork a size in one widget.

## 2. Colour tokens

| Token       | Value     | Use                                                        |
|-------------|-----------|------------------------------------------------------------|
| `ink`       | `#141416` | Headings, names, primary text                              |
| `body`      | `#3F3F3D` | Long-form body copy, tag text                              |
| `muted`     | `#5C5C5A` | Intro lines, roles/titles, captions, eyebrows              |
| `faint`     | `#6F6F6D` | Notes, placeholders                                        |
| `accentInk` | `#9C5F00` | Accent-coloured *text* — dark enough to read on white      |
| `brand`     | `#F7A325` | Brand orange for bars, rules, accent names on cards        |
| `onBrand`   | `#FFFFFF` | Text on a brand-coloured surface                           |

Accent text derived from a session colour (the agenda's "Speaker" /
"Moderator" eyebrow) uses the widget's `_eyebrowInk()` rule: an accent whose
brightness is above 130 is pulled 45% toward black (`#F7A325` → `#885A14`);
darker accents are used as-is.

## 3. Font

`FONT_STACK` is `"AvenirNextforBBG", "Helvetica Neue", Helvetica, Arial, …`.
Cvent registers the uploaded Avenir faces under separate family names on the
parent theme, and `@font-face` inside a shadow root is not registered by
browsers, so `type-scale.js` also carries the `@font-face` block and
`ensureBrandFont()`, which injects it once into `document.head`. Every widget
that renders in the brand font calls `ensureBrandFont()` on first render; the
first widget on the page wins and the rest are no-ops.

## 4. How a widget adopts the scale

A widget never hard-codes a font size in its typography defaults. It declares a
**role map** — one entry per typography key — in its component file, and
derives everything from it.

```js
// FeaturedSpeaker.js (or AgendaItem.js)
import { FONT_STACK, COLORS, T, buildTypography, migrateTypography as migrateShared } from "./type-scale.js";

export const TYPO_ROLES = {
  header:       "display",
  intro:        "lead",
  speakerName:  "name",
  speakerRole:  "meta",
  speakerTag:   "tag",
  modalEyebrow: { role: "label", color: COLORS.accentInk },   // override = a real exception
  // ...
};

// Every default set the editor has EVER written for a key (see §5).
const TYPO_LEGACY = {
  intro: [T(15, 14, 13, { color: "#5C5C5A" })],
  // ...
};

export const defaultTypography = () => buildTypography(TYPO_ROLES);
export const migrateTypography  = (t) => migrateShared(t, TYPO_ROLES, TYPO_LEGACY);
```

Then:

- **`editor.js`** — `_makeDefaultTypography()` returns `defaultTypography()`,
  and the config merge runs the incoming typography through
  `migrateTypography()` so the panel shows migrated values and re-saves them.
- **`widget.js`** — runs the saved typography through `migrateTypography()`
  before handing config to the cards, and calls `ensureBrandFont()`.
- **Stylesheet fallbacks** — the widget's CSS should carry the same sizes as
  the roles it uses, so a config with no typography (or a key a planner
  cleared) still renders on the scale.

Overrides in the role map are for genuine exceptions only: the agenda's
accent-coloured speaker name, white time text on the orange gutter, an italic
title. A widget that needs a *new size* needs a new role in the scale, not an
override.

## 5. Why there is a migration, and how to maintain it

Saved widget config carries the typography defaults the editor wrote at the
time, and the widgets apply saved typography as **inline styles**, which beat
the stylesheet. Without a migration, restyling the defaults would change new
drops of a widget but leave every existing event on the old sizes forever —
which is exactly the whack-a-mole we had before this system.

`migrateTypography()` replaces a saved entry with the current role when the
saved entry is one of the widget's *known old defaults* — either an exact match
across size / colour / weight / italic, or the same desktop size with no
planner-chosen colour (the hybrid that a toggled compact mode used to leave
behind). Anything a planner set by hand does not match and is kept.

**Rule: whenever a default changes, append the *old* values to `TYPO_LEGACY`
for that key.** Never delete from the table; an event configured a year ago can
still carry the oldest set. The tables in `AgendaItem.js` and
`FeaturedSpeaker.js` currently hold every set each editor has written.

The featured speakers editor also has a **"Reset all typography to defaults"**
button in the Typography section for an event whose saved values predate the
tables. It writes the current defaults for every key.

## 6. Adding a widget

1. Copy `type-scale.js` from this folder into the widget folder.
2. Add a role map + legacy table (empty at first) to the component file, and
   the two exports shown in §4.
3. Point `_makeDefaultTypography()` in the editor at `defaultTypography()`;
   run incoming typography through `migrateTypography()` in the config merge.
4. Call `ensureBrandFont()` on first render and use `FONT_STACK`.
5. Upload `type-scale.js` with the widget's other files — it is a fixed-specifier
   import, so a missing copy breaks the widget. Add it to the widget's preview
   harness prefetch (`frame.js`) as well.

## 7. Cvent upload checklist for a typography change

- Edit the canonical `type-scale.js` (a role) **or** a widget's role map (a
  mapping), never a number in a stylesheet alone.
- If a default changed, append the old values to that widget's `TYPO_LEGACY`.
- Copy `type-scale.js` into every widget folder if it changed.
- Upload **all** of the widget's files (`widget.js`, component, `editor.js`,
  `type-scale.js`). Cvent's CDN caches hard: verify in the Network tab with
  "Disable cache" that the served file contains the change before assuming the
  code is wrong.
