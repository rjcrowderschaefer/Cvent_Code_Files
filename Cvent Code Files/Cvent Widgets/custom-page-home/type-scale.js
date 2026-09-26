// type-scale.js — the shared typography system for all Cvent custom widgets.
//
// CANONICAL COPY: "Widget Playbook & Boilerplate/type-scale.js".
// Every widget folder carries an IDENTICAL copy (Cvent only lets a widget
// import files uploaded alongside it). Edit the canonical copy, then copy it
// into each widget folder and upload it with the widget's other files.
// See TYPOGRAPHY.md for the scale, the roles and how a widget adopts it.
//
// A widget never hard-codes a font size. It maps each of its typography keys
// to a ROLE below (a "role map"), and gets three things from that map:
//   buildTypography(roleMap)            -> the editor's default typography
//   migrateTypography(saved, roleMap,   -> saved OLD defaults replaced with the
//                     legacy)              current ones; planner choices kept
//   FONT_STACK / COLORS / TYPE_SCALE    -> for stylesheet fallbacks

export const FONT_STACK =
  `"AvenirNextforBBG","Helvetica Neue",Helvetica,Arial,-apple-system,BlinkMacSystemFont,sans-serif`;

export const COLORS = {
  ink: "#141416",      // headings, names, primary text
  body: "#3F3F3D",     // long-form body copy, tag text
  muted: "#5C5C5A",    // intro lines, roles/titles, captions, eyebrows
  faint: "#6F6F6D",    // notes, placeholders
  accentInk: "#9C5F00",// accent-coloured TEXT (dark enough to read on white)
  brand: "#F7A325",    // brand orange (bars, rules, accent names on cards)
  onBrand: "#FFFFFF",  // text on a brand-coloured surface
};

// Sizes are px at desktop / <=1024px / <=600px (the widgets' two breakpoints).
const role = (fontSize, fontSizeMd, fontSizeSm, color, extra = {}) =>
  ({ fontSize, fontSizeMd, fontSizeSm, color, bold: false, italic: false, underline: false, ...extra });

export const TYPE_SCALE = {
  display:   role(28, 24, 20, COLORS.ink,   { bold: true }),  // section heading
  headline:  role(29, 26, 24, COLORS.ink,   { bold: true }),  // modal speaker name
  title:     role(20, 18, 16, COLORS.ink,   { bold: true }),  // session title
  subtitle:  role(18, 16, 15, COLORS.ink,   { bold: true }),  // day header, modal session title
  lead:      role(18, 16, 15, COLORS.muted),                  // intro / subheader, modal role
  body:      role(18, 16, 15, COLORS.body),                   // modal bio
  bodySmall: role(16, 14, 13, COLORS.ink),                    // card description
  name:      role(16, 15, 14, COLORS.ink,   { bold: true }),  // speaker name on cards / tiles
  listTitle: role(15, 14, 14, COLORS.ink,   { bold: true }),  // session rows inside a modal
  meta:      role(14, 13, 12, COLORS.muted),                  // speaker title / company on cards
  caption:   role(13, 13, 12, COLORS.muted),                  // date/time lines, notes
  tag:       role(12, 12, 11, COLORS.body,  { bold: true }),  // company tag, meta pills (uppercase via CSS)
  label:     role(11, 11, 11, COLORS.muted, { bold: true }),  // eyebrows, SESSIONS header (uppercase via CSS)
  // Page widgets (Home / Agenda / Speakers / Venue / Contact) — added 2026-09-24
  hero:      role(68, 52, 40, COLORS.ink),                    // page-widget hero lockup (weight set per part in CSS)
  section:   role(42, 32, 28, COLORS.ink,   { bold: true }),  // page-widget section heading
};

// roleMap: { widgetKey: "role" | { role: "role", ...overrides } }
export function buildTypography(roleMap) {
  const out = {};
  Object.keys(roleMap).forEach((key) => {
    const spec = typeof roleMap[key] === "string" ? { role: roleMap[key] } : roleMap[key];
    const base = TYPE_SCALE[spec.role];
    if (!base) throw new Error(`type-scale: unknown role "${spec.role}" for "${key}"`);
    const { role: _r, ...overrides } = spec;
    out[key] = { ...base, ...overrides };
  });
  return out;
}

// Legacy entry helper for widgets' legacy tables: T(size, md, sm, {extra}).
// Colour defaults to plain black, which is what older editors wrote.
export const T = (fontSize, fontSizeMd, fontSizeSm, extra = {}) =>
  ({ fontSize, fontSizeMd, fontSizeSm, color: "#000000", bold: false, italic: false, underline: false, ...extra });

const same = (a, b) =>
  !!a && !!b &&
  Number(a.fontSize) === Number(b.fontSize) && Number(a.fontSizeMd) === Number(b.fontSizeMd) &&
  Number(a.fontSizeSm) === Number(b.fontSizeSm) &&
  String(a.color || "#000000").toLowerCase() === String(b.color || "#000000").toLowerCase() &&
  !!a.bold === !!b.bold && !!a.italic === !!b.italic && !!a.underline === !!b.underline;

// Saved typography is applied inline by the widgets, so a saved OLD default
// would override a restyled stylesheet forever. This swaps any saved entry that
// matches a known old default (exactly, or by desktop size when the planner
// never chose a colour — the "compact toggled on and off" hybrid) for the
// current default. Anything a planner actually changed is left alone.
export function migrateTypography(saved, roleMap, legacy = {}) {
  const current = buildTypography(roleMap);
  const out = { ...(saved || {}) };
  Object.keys(current).forEach((key) => {
    const cur = out[key];
    if (!cur) return;
    const olds = legacy[key] || [];
    const exact = olds.some((old) => same(cur, old));
    const noColor = !cur.color || /^#0{6}$/i.test(String(cur.color));
    const legacySize = olds.some((old) => Number(cur.fontSize) === Number(old.fontSize));
    if (exact || (noColor && legacySize)) out[key] = { ...current[key] };
  });
  return out;
}

// Bloomberg brand font. Cvent registers the uploaded Avenir faces under
// separate family names on the parent theme; re-declared here as ONE family
// ("AvenirNextforBBG") with correct weight slots. @font-face inside a shadow
// root is not registered by browsers, so ensureBrandFont() injects this once
// into document.head. Every widget that uses FONT_STACK calls it.
export const BRAND_FONT_CSS = `
@font-face{font-family:"AvenirNextforBBG";font-weight:400;font-style:normal;font-display:swap;src:url("https://custom.cvent.com/437e6683a93144aaaee124507fc78642/files/43ba48291a694c6b839f5076a265c1bb.otf") format("opentype")}
@font-face{font-family:"AvenirNextforBBG";font-weight:500;font-style:normal;font-display:swap;src:url("https://custom.cvent.com/437e6683a93144aaaee124507fc78642/files/1c8ddb83438d454e97bc30944531a8c0.ttf") format("truetype")}
@font-face{font-family:"AvenirNextforBBG";font-weight:600;font-style:normal;font-display:swap;src:url("https://custom.cvent.com/437e6683a93144aaaee124507fc78642/files/2bc2aedb5a704c7483976a475ecf020f.otf") format("opentype")}
@font-face{font-family:"AvenirNextforBBG";font-weight:700;font-style:normal;font-display:swap;src:url("https://custom.cvent.com/437e6683a93144aaaee124507fc78642/files/370525f70e1b4cc68d3b6f5e9b5bcaa2.otf") format("opentype")}
@font-face{font-family:"AvenirNextforBBG";font-weight:400;font-style:italic;font-display:swap;src:url("https://custom.cvent.com/437e6683a93144aaaee124507fc78642/files/c10dce35a1914a99a8d286307087ef5b.ttf") format("truetype")}
`;
export function ensureBrandFont() {
  try {
    if (typeof document === "undefined" || document.getElementById("bbg-brand-font")) return;
    const st = document.createElement("style");
    st.id = "bbg-brand-font";
    st.textContent = BRAND_FONT_CSS;
    (document.head || document.documentElement).append(st);
  } catch (e) { /* noop */ }
}

// Responsive size for an entry: desktop / <=1024 / <=600.
export function activeFontSize(entry) {
  if (!entry) return undefined;
  const w = window.innerWidth || document.documentElement.clientWidth || 1920;
  if (w <= 600 && entry.fontSizeSm) return entry.fontSizeSm;
  if (w <= 1024 && entry.fontSizeMd) return entry.fontSizeMd;
  return entry.fontSize;
}
