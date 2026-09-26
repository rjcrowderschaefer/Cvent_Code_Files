// page-kit.js — shared building blocks for the Bloomberg Live PAGE widgets
// (Home, Agenda, Speakers, Venue, Contact).
//
// CANONICAL COPY: "Widget Playbook & Boilerplate/page-kit.js".
// Every page widget folder carries an IDENTICAL copy (Cvent only lets a widget
// import files uploaded alongside it) — same rule as type-scale.js.
//
// Design source: Bloomberg Design System (Live / events register):
// Avenir Next for BBG, near-black ink ladder, amber picked by ground
// (#F7A325 on dark, #9C5F00 on light), 2px radii, 11px tracked eyebrows,
// hairline borders, two section grounds (white + tint) plus dark inversion.
//
// Everything that renders planner- or Cvent-supplied text goes through esc()
// or cleanRichText(). Never interpolate raw config into innerHTML.

import { FONT_STACK, TYPE_SCALE } from "./type-scale.js";

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------
export const TOKENS = {
  ink: "#141416",
  deep: "#0B0B0C",
  panel: "#17181C",
  body: "#3F3F3D",
  muted: "#5C5C5A",
  faint: "#6F6F6D",
  hair: "#E4E4E0",
  tint: "#F5F5F3",
  placeholder: "#EDEDEA",
  tagBg: "#F0F0EE",
  tagInk: "#3F3F3D",
  amberOnDark: "#F7A325",   // amber on dark grounds (label = deep)
  amberOnDarkH: "#E8951B",
  amberInk: "#9C5F00",      // amber as text / fill on light grounds (label = white)
  amberInkH: "#8F5700",
  onDark: "rgba(255,255,255,.72)",
  onDarkFaint: "rgba(255,255,255,.66)",
  onDarkHair: "rgba(255,255,255,.16)",
  focus: "#2B6CE8",
  focusOnPhoto: "#6FA0FF",
};

// ---------------------------------------------------------------------------
// Escaping / sanitising
// ---------------------------------------------------------------------------
const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ESC[c]);

// Only allow http(s), mailto, tel, root-relative and in-page links.
export function safeUrl(u, fallback = "#") {
  const s = String(u ?? "").trim();
  if (!s) return fallback;
  if (/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(s)) return s;
  return fallback;
}

// External links announce themselves (design system rule).
export function isExternal(url) {
  try {
    if (!/^https?:\/\//i.test(url)) return false;
    return new URL(url).host !== window.location.host;
  } catch (e) {
    return false;
  }
}

// Cvent rich text (event / session descriptions) arrives as RTE HTML full of
// inline styles and hashed classes. Keep structure, drop everything else.
const KEEP = new Set(["P", "BR", "UL", "OL", "LI", "STRONG", "B", "EM", "I", "A"]);
export function cleanRichText(html) {
  const raw = String(html ?? "");
  if (!raw.trim()) return "";
  let doc;
  try {
    doc = new DOMParser().parseFromString(`<div>${raw}</div>`, "text/html");
  } catch (e) {
    return `<p>${esc(raw.replace(/<[^>]*>/g, " "))}</p>`;
  }
  const walk = (node) => {
    let out = "";
    node.childNodes.forEach((n) => {
      if (n.nodeType === 3) { out += esc(n.textContent); return; }
      if (n.nodeType !== 1) return;
      const inner = walk(n);
      if (!KEEP.has(n.tagName)) { out += inner; return; }
      const tag = n.tagName.toLowerCase();
      if (tag === "br") { out += "<br>"; return; }
      if (tag === "a") {
        const href = safeUrl(n.getAttribute("href"), "");
        out += href ? `<a href="${esc(href)}"${isExternal(href) ? ' target="_blank" rel="noopener"' : ""}>${inner}</a>` : inner;
        return;
      }
      out += `<${tag}>${inner}</${tag}>`;
    });
    return out;
  };
  const html2 = walk(doc.body.firstElementChild || doc.body)
    .replace(/<p>\s*(<br>\s*)*<\/p>/g, "")
    .trim();
  return /^<(p|ul|ol)>/.test(html2) ? html2 : `<p>${html2}</p>`;
}

// Planner textareas: blank line = new paragraph, single newline = <br>.
export function paragraphs(text) {
  return String(text ?? "")
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

// One item per line.
export const lines = (text) =>
  String(text ?? "").replace(/\r\n?/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean);

// ---------------------------------------------------------------------------
// Timezone (Playbook §2)
// ---------------------------------------------------------------------------
const TZ_NORMALIZE = { "Atlantic/Reykjavik": "Europe/London" };
export const tzNormalize = (tz) => (tz && TZ_NORMALIZE[tz]) || tz;

// ---------------------------------------------------------------------------
// Language (Playbook §3). Core languages: en es pt ja zh ko fr de.
// Fixed strings ship in en / es / pt; the rest fall back to English until the
// translator hand-off lands (same status as the agenda widget).
// ---------------------------------------------------------------------------
const LANGS = ["en", "es", "pt", "ja", "zh", "ko", "fr", "de"];
export function mapLang(code) {
  const c = String(code || "").toLowerCase();
  return LANGS.find((l) => c.startsWith(l)) || null;
}
export function resolveLang(eventInfo) {
  const locs = eventInfo?.locales || [];
  const def = locs.find((l) => l.isDefault) || locs[0];
  return mapLang(document.documentElement.lang) || mapLang(def?.cultureCode) || "en";
}
const DATE_LOCALE = { en: "en-US", es: "es", pt: "pt-BR", ja: "ja-JP", zh: "zh-CN", ko: "ko-KR", fr: "fr-FR", de: "de-DE" };
export const dateLocale = (lang) => DATE_LOCALE[lang] || "en-US";
export const capFirst = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const FIXED = {
  en: { days: "Days", hours: "Hours", mins: "Min", countdownAria: "{d} days, {h} hours, {m} minutes until the event", sessions: "{n} sessions", speakers: "{n} speakers", tba: "Speakers to be announced", andMore: "and more", opensNewTab: "(opens in a new tab)", loading: "Loading…", noSpeakers: "No speakers have been selected. Use the editor to choose the speakers to feature here.", until: "Until {t}" },
  es: { days: "Días", hours: "Horas", mins: "Min", countdownAria: "Faltan {d} días, {h} horas y {m} minutos para el evento", sessions: "{n} sesiones", speakers: "{n} ponentes", tba: "Ponentes por anunciar", andMore: "y más", opensNewTab: "(se abre en una pestaña nueva)", loading: "Cargando…", noSpeakers: "No se han seleccionado ponentes.", until: "Hasta las {t}" },
  pt: { days: "Dias", hours: "Horas", mins: "Min", countdownAria: "Faltam {d} dias, {h} horas e {m} minutos para o evento", sessions: "{n} sessões", speakers: "{n} palestrantes", tba: "Palestrantes a anunciar", andMore: "e mais", opensNewTab: "(abre em uma nova aba)", loading: "Carregando…", noSpeakers: "Nenhum palestrante foi selecionado.", until: "Até {t}" },
};
export function fixed(lang, key, vars = {}) {
  const table = FIXED[lang] || FIXED.en;
  const s = table[key] ?? FIXED.en[key] ?? key;
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ""));
}

// Planner-typed text: cfg.translations[lang]["section.key"] overrides the base
// value; blank/missing falls back (same contract as the agenda widget).
export function plannerText(cfg, lang, path, base) {
  const tr = cfg?.translations?.[lang]?.[path];
  return tr !== undefined && String(tr).trim() !== "" ? tr : base;
}

// ---------------------------------------------------------------------------
// Date helpers (always an explicit event timeZone)
// ---------------------------------------------------------------------------
export function fmtTime(iso, tz) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz });
}
export function fmtTimeRange(startIso, endIso, tz) {
  const a = fmtTime(startIso, tz);
  const b = fmtTime(endIso, tz);
  if (!b) return a;
  // "1:00 – 7:00 PM" when both share AM/PM
  const pa = a.slice(-2), pb = b.slice(-2);
  return pa === pb ? `${a.slice(0, -3)} – ${b}` : `${a} – ${b}`;
}
export function fmtDate(iso, tz, lang, opts) {
  if (!iso) return "";
  return capFirst(new Date(iso).toLocaleDateString(dateLocale(lang), { timeZone: tz, ...opts }));
}
export function tzName(iso, tz, style) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: style }).formatToParts(new Date(iso || Date.now()));
    return parts.find((p) => p.type === "timeZoneName")?.value || "";
  } catch (e) {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Markup builders (return HTML strings; inputs are escaped here)
// ---------------------------------------------------------------------------
export function eyebrow(text, cls = "") {
  return text ? `<p class="pk-eyebrow ${cls}">${esc(text)}</p>` : "";
}

export function button({ label, href, variant = "primary", ground = "light", size = "", full = false, lang = "en" }) {
  if (!label) return "";
  const url = safeUrl(href);
  const ext = isExternal(url);
  const cls = ["pk-btn", `pk-btn--${variant}`, `pk-btn--on-${ground}`, size ? `pk-btn--${size}` : "", full ? "pk-btn--full" : ""].join(" ");
  return `<a class="${cls}" href="${esc(url)}"${ext ? ' target="_blank" rel="noopener"' : ""}>${esc(label)}${ext ? `<span class="pk-sr"> ${esc(fixed(lang, "opensNewTab"))}</span>` : ""}</a>`;
}

export function arrowLink({ label, href, ground = "light", lang = "en" }) {
  if (!label) return "";
  const url = safeUrl(href);
  const ext = isExternal(url);
  return `<a class="pk-arrow pk-arrow--on-${ground}" href="${esc(url)}"${ext ? ' target="_blank" rel="noopener"' : ""}>${esc(label)}<span aria-hidden="true">${ext ? "↗" : "→"}</span>${ext ? `<span class="pk-sr"> ${esc(fixed(lang, "opensNewTab"))}</span>` : ""}</a>`;
}

// Eyebrow + proposition heading, optional right-aligned link (desktop) that
// drops below the content on mobile (render `link` again after the content
// with class pk-only-mobile).
export function sectionHead({ eyebrowText, heading, link = "", level = 2 }) {
  const h = heading ? `<h${level} class="pk-h2">${esc(heading)}</h${level}>` : "";
  const head = `<div class="pk-head-text">${eyebrow(eyebrowText)}${h}</div>`;
  return link ? `<div class="pk-head">${head}<div class="pk-only-desktop">${link}</div></div>` : head;
}

// "Request to attend" band (every page) — light or dark.
export function regBand({ eyebrowText = "", heading, body, buttonLabel, href, dark = false, lang = "en" }) {
  if (!heading && !buttonLabel) return "";
  return `
  <section class="pk-section ${dark ? "pk-ground-tint" : "pk-ground-tint"} pk-pad-tight" aria-label="${esc(heading || buttonLabel)}">
    <div class="pk-inner">
      <div class="pk-band ${dark ? "pk-band--dark" : ""}">
        <div class="pk-band-text">
          ${eyebrow(eyebrowText, dark ? "pk-on-dark" : "")}
          ${heading ? `<h2 class="pk-band-h">${esc(heading)}</h2>` : ""}
          ${body ? `<p class="pk-band-p">${esc(body)}</p>` : ""}
        </div>
        <div class="pk-band-cta">${button({ label: buttonLabel, href, variant: "primary", ground: dark ? "dark" : "light", size: "lg", lang })}</div>
      </div>
    </div>
  </section>`;
}

// Dark page banner for inner pages (Agenda, Speakers, Venue, Contact).
export function pageBanner({ eyebrowText, title, intro }) {
  return `
  <section class="pk-banner">
    <div class="pk-inner">
      ${eyebrow(eyebrowText, "pk-on-dark")}
      ${title ? `<h1 class="pk-banner-h">${esc(title)}</h1>` : ""}
      ${intro ? `<p class="pk-banner-p">${esc(intro)}</p>` : ""}
    </div>
  </section>`;
}

// ---------------------------------------------------------------------------
// Shared stylesheet. Inject once per shadow root (Playbook §5).
// ---------------------------------------------------------------------------
const px = (n) => `${n}px`;
export function kitCss() {
  const t = TOKENS;
  const S = TYPE_SCALE;
  const sec = S.section || { fontSize: 42, fontSizeMd: 32, fontSizeSm: 28 };
  return `
  :host { display: block; width: 100%; }
  .pk, .pk *, .pk *::before, .pk *::after { box-sizing: border-box; }
  .pk {
    font-family: ${FONT_STACK}; color: ${t.ink}; font-size: 16px; line-height: 1.5;
    -webkit-font-smoothing: antialiased; text-align: left; width: 100%;
  }
  /* Zero-specificity reset (:where) so every component class below wins. */
  :where(.pk) :where(p, h1, h2, h3, ul, ol, dl, dd) { margin: 0; padding: 0; }
  :where(.pk) a { color: inherit; }
  .pk :focus-visible { outline: 3px solid ${t.focus}; outline-offset: 2px; }
  .pk-sr { position: absolute !important; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

  /* Layout */
  .pk-section { padding: clamp(56px, 7vw, 104px) 0; }
  .pk-pad-tight { padding: clamp(40px, 5vw, 80px) 0; }
  .pk-inner { width: 100%; max-width: 1240px; margin: 0 auto; padding: 0 clamp(20px, 4vw, 48px); }
  .pk-ground-white { background: #fff; }
  .pk-ground-tint { background: ${t.tint}; }
  .pk-ground-dark { background: ${t.deep}; color: #fff; }
  .pk-rule-top { border-top: 1px solid ${t.hair}; }

  /* Type */
  .pk-eyebrow { font-size: 11px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: ${t.muted}; margin-bottom: 14px; }
  .pk-on-dark.pk-eyebrow, .pk-ground-dark .pk-eyebrow { color: ${t.onDark}; }
  .pk-h2 { font-size: ${px(sec.fontSize)}; line-height: 1.15; font-weight: 700; letter-spacing: -0.02em; max-width: 34ch; }
  .pk-ground-dark .pk-h2 { color: #fff; }
  .pk-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; }
  .pk-lede { font-size: 16px; line-height: 1.5; color: ${t.ink}; }
  .pk-copy { font-size: 15px; line-height: 1.5; color: ${t.muted}; }
  .pk-copy p + p, .pk-lede p + p { margin-top: 16px; }
  .pk-copy a, .pk-lede a { color: ${t.amberInk}; font-weight: 600; }
  .pk-copy ul, .pk-lede ul { padding-left: 20px; margin-top: 12px; }

  /* Buttons: one primary (amber, by ground) + one secondary (outline) */
  .pk-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    min-height: 44px; padding: 0 22px; border-radius: 2px; border: 1px solid transparent;
    font-size: 14px; font-weight: 700; line-height: 1.2; text-decoration: none; white-space: nowrap;
    transition: background-color .15s ease, border-color .15s ease, color .15s ease;
  }
  .pk-btn--lg { min-height: 52px; padding: 0 26px; font-size: 15px; }
  .pk-btn--full { width: 100%; }
  .pk-btn--primary.pk-btn--on-dark { background: ${t.amberOnDark}; color: ${t.deep}; }
  .pk-btn--primary.pk-btn--on-dark:hover { background: ${t.amberOnDarkH}; }
  .pk-btn--primary.pk-btn--on-light { background: ${t.amberInk}; color: #fff; }
  .pk-btn--primary.pk-btn--on-light:hover { background: ${t.amberInkH}; }
  .pk-btn--secondary.pk-btn--on-dark { border-color: rgba(255,255,255,.5); color: #fff; }
  .pk-btn--secondary.pk-btn--on-dark:hover { background: rgba(255,255,255,.08); border-color: #fff; }
  .pk-btn--secondary.pk-btn--on-light { border-color: ${t.ink}; color: ${t.ink}; }
  .pk-btn--secondary.pk-btn--on-light:hover { background: rgba(156,95,0,.10); }

  .pk-arrow { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 700; text-decoration: none; transition: gap .15s ease; }
  .pk-arrow:hover { gap: 11px; }
  .pk-arrow--on-light { color: ${t.amberInk}; }
  .pk-arrow--on-dark { color: ${t.amberOnDark}; }

  /* Tags */
  .pk-tag { display: inline-flex; align-items: center; min-height: 24px; padding: 0 8px; border-radius: 2px; background: ${t.tagBg}; color: ${t.tagInk}; font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
  .pk-badge { display: inline-flex; align-items: center; min-height: 22px; padding: 0 8px; border: 1px solid ${t.hair}; border-radius: 2px; font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: ${t.muted}; }

  /* Registration band */
  .pk-band { display: flex; justify-content: space-between; align-items: center; gap: 48px; padding: 0; }
  .pk-band--dark { background: ${t.deep}; padding: clamp(32px, 4.5vw, 56px) clamp(24px, 5vw, 64px); }
  .pk-band-h { font-size: clamp(24px, 2.4vw, 34px); line-height: 1.2; font-weight: 700; letter-spacing: -0.02em; }
  .pk-band--dark .pk-band-h { color: #fff; }
  .pk-band-p { margin-top: 10px; font-size: 16px; color: ${t.muted}; }
  .pk-band--dark .pk-band-p { color: ${t.onDark}; }
  .pk-band-cta { flex-shrink: 0; }

  /* Inner-page banner */
  .pk-banner { background: ${t.deep}; color: #fff; padding: clamp(48px, 5vw, 64px) 0 clamp(40px, 4.5vw, 56px); }
  .pk-banner-h { font-size: clamp(34px, 4vw, 48px); line-height: 1.1; font-weight: 700; letter-spacing: -0.02em; color: #fff; }
  .pk-banner-p { margin-top: 16px; max-width: 720px; font-size: 16px; line-height: 1.45; color: ${t.onDark}; }

  .pk-only-mobile { display: none; }
  .pk-empty { font-size: 14px; font-style: italic; color: ${t.faint}; }

  @media (max-width: 1024px) {
    .pk-h2 { font-size: ${px(sec.fontSizeMd)}; }
  }
  @media (max-width: 600px) {
    .pk-h2 { font-size: ${px(sec.fontSizeSm)}; }
    .pk-only-desktop { display: none; }
    .pk-only-mobile { display: block; margin-top: 24px; }
    .pk-band { flex-direction: column; align-items: stretch; gap: 20px; }
    .pk-band-cta .pk-btn { width: 100%; }
    .pk-btn { white-space: normal; text-align: center; }
  }
  @media (prefers-reduced-motion: reduce) {
    .pk *, .pk *::before, .pk *::after { transition: none !important; animation: none !important; }
  }
  `;
}
