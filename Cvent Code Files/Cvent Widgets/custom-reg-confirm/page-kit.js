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

import { FONT_STACK, TYPE_SCALE, ensureBrandFont } from "./type-scale.js";

// Shown in the page widgets' editor footer, so a stale copy in Cvent is visible.
export const PAGE_KIT_BUILD = "pagekit-2026-09-26f";

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

// Planners paste whatever they copied: a bare link, a <source src="…"> tag,
// a whole code block, a link wrapped in quotes or with &amp; entities. Pull the
// link out. Returns "" when there is none.
export function extractUrl(input) {
  let s = String(input ?? "").trim();
  if (!s) return "";
  if (/[<>]|\b(src|href|poster)\s*=/i.test(s)) {
    // Prefer an explicit src= / href= / poster= attribute value; for a pasted
    // code block the media <source src> comes before any image or link.
    // Skip empty attributes (poster="") and commented-out markup.
    const text = s.replace(/<!--[\s\S]*?-->/g, " ");
    const vals = [...text.matchAll(/\b(src|href|poster)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)]
      .map((m) => ({ name: m[1].toLowerCase(), val: (m[2] ?? m[3] ?? m[4] ?? "").trim() }))
      .filter((a) => a.val);
    const pick = vals.find((a) => a.name === "src") || vals.find((a) => a.name === "href") || vals[0];
    const any = text.match(/https?:\/\/[^\s"'<>)]+/i);
    s = pick ? pick.val : any ? any[0] : "";
  }
  s = s.replace(/^["'\s]+|["'\s]+$/g, "").replace(/&amp;/gi, "&").replace(/&#38;/g, "&");
  return s;
}

// Only allow http(s), mailto, tel, root-relative and in-page links.
export function safeUrl(u, fallback = "#") {
  const s = extractUrl(u);
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
  en: { days: "Days", hours: "Hours", mins: "Min", countdownAria: "{d} days, {h} hours, {m} minutes until the event", sessions: "{n} sessions", session1: "1 session", speakers: "{n} speakers", tba: "Speakers to be announced", andMore: "and more", opensNewTab: "(opens in a new tab)", loading: "Loading…", noSpeakers: "No speakers have been selected. Use the editor to choose the speakers to feature here.", until: "Until {t}",
    toTime: "to {t}", readMore: "Read more", readLess: "Show less", allSessions: "All sessions", filterSessions: "Filter sessions", noMatch: "No sessions match this filter.", noSessions: "The program will be announced soon.", getDirections: "Get directions", addToCalendar: "Add to calendar", moreTba: "More speakers to be announced.", featured: "Featured", speakersLabel: "Speakers", viewBio: "View bio for {name}", mapTitle: "Map of {place}", regOpens: "Registration opens at {t} {tz}", joinUsAt: "Join us at {place} on {date}", joinUsOn: "Join us on {date}", noSpeakersYet: "Speakers will be announced soon.", email: "Email", sessionsAcrossDays: "{n} sessions across {d} days", agendaIntro: "{n} at {place}. All times are {tz}.", agendaIntroNoPlace: "{n}. All times are {tz}.", sessionHdr1: "Session", sessionHdrN: "Sessions", filterLocation: "Location", filterTopics: "Topics", clearFilters: "Clear filters", moderator: "Moderator", speakerOne: "Speaker" },
  es: { days: "Días", hours: "Horas", mins: "Min", countdownAria: "Faltan {d} días, {h} horas y {m} minutos para el evento", sessions: "{n} sesiones", session1: "1 sesión", speakers: "{n} ponentes", tba: "Ponentes por anunciar", andMore: "y más", opensNewTab: "(se abre en una pestaña nueva)", loading: "Cargando…", noSpeakers: "No se han seleccionado ponentes.", until: "Hasta las {t}",
    toTime: "hasta las {t}", readMore: "Leer más", readLess: "Mostrar menos", allSessions: "Todas las sesiones", filterSessions: "Filtrar sesiones", noMatch: "Ninguna sesión coincide con este filtro.", noSessions: "El programa se anunciará pronto.", getDirections: "Cómo llegar", addToCalendar: "Añadir al calendario", moreTba: "Más ponentes por anunciar.", featured: "Destacados", speakersLabel: "Ponentes", viewBio: "Ver la biografía de {name}", mapTitle: "Mapa de {place}", regOpens: "La acreditación abre a las {t} {tz}", joinUsAt: "Acompáñenos en {place} el {date}", joinUsOn: "Acompáñenos el {date}", noSpeakersYet: "Los ponentes se anunciarán pronto.", email: "Correo electrónico", sessionsAcrossDays: "{n} sesiones en {d} días", agendaIntro: "{n} en {place}. Todos los horarios son en {tz}.", agendaIntroNoPlace: "{n}. Todos los horarios son en {tz}.", sessionHdr1: "Sesión", sessionHdrN: "Sesiones", filterLocation: "Ubicación", filterTopics: "Temas", clearFilters: "Borrar filtros", moderator: "Moderador", speakerOne: "Ponente" },
  pt: { days: "Dias", hours: "Horas", mins: "Min", countdownAria: "Faltam {d} dias, {h} horas e {m} minutos para o evento", sessions: "{n} sessões", session1: "1 sessão", speakers: "{n} palestrantes", tba: "Palestrantes a anunciar", andMore: "e mais", opensNewTab: "(abre em uma nova aba)", loading: "Carregando…", noSpeakers: "Nenhum palestrante foi selecionado.", until: "Até {t}",
    toTime: "até {t}", readMore: "Leia mais", readLess: "Mostrar menos", allSessions: "Todas as sessões", filterSessions: "Filtrar sessões", noMatch: "Nenhuma sessão corresponde a este filtro.", noSessions: "A programação será anunciada em breve.", getDirections: "Como chegar", addToCalendar: "Adicionar à agenda", moreTba: "Mais palestrantes a anunciar.", featured: "Destaques", speakersLabel: "Palestrantes", viewBio: "Ver a biografia de {name}", mapTitle: "Mapa de {place}", regOpens: "O credenciamento abre às {t} {tz}", joinUsAt: "Junte-se a nós em {place} em {date}", joinUsOn: "Junte-se a nós em {date}", noSpeakersYet: "Os palestrantes serão anunciados em breve.", email: "E-mail", sessionsAcrossDays: "{n} sessões em {d} dias", agendaIntro: "{n} em {place}. Todos os horários estão em {tz}.", agendaIntroNoPlace: "{n}. Todos os horários estão em {tz}.", sessionHdr1: "Sessão", sessionHdrN: "Sessões", filterLocation: "Local", filterTopics: "Temas", clearFilters: "Limpar filtros", moderator: "Moderador", speakerOne: "Palestrante" },
};
export const countSessions = (lang, n) => (n === 1 ? fixed(lang, "session1") : fixed(lang, "sessions", { n }));
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

// Strip an arrow a planner typed at the end of a label ("Watch →"), so the
// link never shows two.
export const cleanLabel = (t) => String(t ?? "").replace(/\s*[→↗➔➜›»]+\s*$/u, "").trim();

export function arrowLink({ label, href, ground = "light", lang = "en" }) {
  label = cleanLabel(label);
  if (!label) return "";
  const url = safeUrl(href);
  const ext = isExternal(url);
  return `<a class="pk-arrow pk-arrow--on-${ground}" href="${esc(url)}"${ext ? ' target="_blank" rel="noopener"' : ""}>${esc(label)}<span aria-hidden="true">${ext ? "↗" : "→"}</span>${ext ? `<span class="pk-sr"> ${esc(fixed(lang, "opensNewTab"))}</span>` : ""}</a>`;
}

// ---------------------------------------------------------------------------
// Registration buttons that use CVENT'S OWN Register button
// The Custom Widget SDK has no "start registration" method, and a plain link
// to the registration URL skips the logic Cvent's button runs (registration
// type / path selection, invitee context). So our styled button is a proxy:
// it finds the site's native Register button (normally the one in the header)
// and clicks it, and Cvent does the rest. Found by its visible label (the
// header button has no stable id; its classes are Emotion hashes), or by a
// planner-supplied CSS selector. A hidden native button (e.g. the header
// button on mobile) still works: .click() runs its handler.
// Fallback when none is found: the planner's registration URL, if set.
// ---------------------------------------------------------------------------
export function registerButton({ label, variant = "primary", ground = "light", size = "", full = false }) {
  if (!label) return "";
  const cls = ["pk-btn", `pk-btn--${variant}`, `pk-btn--on-${ground}`, size ? `pk-btn--${size}` : "", full ? "pk-btn--full" : ""].join(" ");
  return `<button type="button" class="${cls}" data-pk-register>${esc(label)}</button>`;
}

const norm = (t) => String(t || "").replace(/\s+/g, " ").trim().toLowerCase();

// Find Cvent's native Register button in the page (light DOM only: our own
// buttons live in shadow roots, so they are never matched).
export function findNativeRegister({ selector = "", label = "" } = {}) {
  if (selector) {
    try {
      const el = document.querySelector(selector);
      if (el) return el;
    } catch (e) {
      console.warn("[page-kit] invalid register selector:", selector);
    }
  }
  const want = norm(label);
  if (!want) return null;
  const all = [...document.querySelectorAll("button, a[href], [role='button']")].filter((el) => norm(el.textContent) === want);
  if (!all.length) return null;
  // Prefer the header's button, then any visible one, then the first match.
  const inHeader = all.find((el) => el.closest("header, [role='banner'], #navigationContainer, .cus_nav"));
  const visible = all.find((el) => el.getClientRects().length);
  return inHeader || visible || all[0];
}

// Wire every [data-pk-register] button inside `root`. Returns a cleanup fn.
export function wireRegister(root, { mode = "native", label = "", selector = "", url = "" } = {}) {
  if (!root) return () => {};
  const onClick = (e) => {
    const btn = e.target.closest?.("[data-pk-register]");
    if (!btn || !root.contains(btn)) return;
    e.preventDefault();
    if (mode === "native") {
      const native = findNativeRegister({ selector, label });
      if (native) { native.click(); return; }
      console.warn(`[page-kit] Cvent Register button not found (label "${label}"${selector ? `, selector "${selector}"` : ""}); using the registration URL.`);
    }
    const href = safeUrl(url, "");
    if (href) window.location.assign(href);
  };
  root.addEventListener("click", onClick);
  return () => root.removeEventListener("click", onClick);
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
export function regBand({ eyebrowText = "", heading, body, buttonLabel, href, dark = false, lang = "en", nativeRegister = false }) {
  if (!heading && !buttonLabel) return "";
  return `
  <section class="pk-section pk-bleed pk-ground-tint pk-pad-tight" aria-label="${esc(heading || buttonLabel)}">
    <div class="pk-inner">
      <div class="pk-band ${dark ? "pk-band--dark" : ""}">
        <div class="pk-band-text">
          ${eyebrow(eyebrowText, dark ? "pk-on-dark" : "")}
          ${heading ? `<h2 class="pk-band-h">${esc(heading)}</h2>` : ""}
          ${body ? `<p class="pk-band-p">${esc(body)}</p>` : ""}
        </div>
        <div class="pk-band-cta">${nativeRegister
          ? registerButton({ label: buttonLabel, variant: "primary", ground: dark ? "dark" : "light", size: "lg" })
          : button({ label: buttonLabel, href, variant: "primary", ground: dark ? "dark" : "light", size: "lg", lang })}</div>
      </div>
    </div>
  </section>`;
}

// Dark page banner for inner pages (Agenda, Speakers, Venue, Contact).
export function pageBanner({ eyebrowText, title, intro, bg = null }) {
  // Optional background photo: validated URL passed through CSS custom
  // properties (never interpolated raw into a stylesheet), darkened by an
  // overlay so the white text keeps its contrast.
  // An uploaded image arrives as a JPEG/PNG/WebP data URL; anything else must pass safeUrl.
  const raw = String(bg?.url || "");
  const src = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(raw) ? raw : bg ? safeUrl(raw, "") : "";
  const hasBg = !!src && !src.startsWith("#");
  const clamp = (n, d, max = 100) => Math.max(0, Math.min(max, Number.isFinite(Number(n)) && String(n).trim() !== "" ? Number(n) : d));
  const cssUrl = hasBg ? src.replace(/["\\\n\r]/g, encodeURIComponent) : "";
  const fx = clamp(bg?.focalX, 50), fy = clamp(bg?.focalY, 50);
  const fxm = clamp(bg?.focalXMobile, fx);
  const h = clamp(bg?.height, 0, 900);
  const style = [
    hasBg ? `--pk-banner-bg: url(&quot;${esc(cssUrl)}&quot;); --pk-banner-pos: ${fx}% ${fy}%; --pk-banner-pos-m: ${fxm}% ${fy}%; --pk-banner-shade: ${clamp(bg?.overlay, 60, 90) / 100}` : "",
    h ? `--pk-banner-h: ${h}px` : "",
  ].filter(Boolean).join("; ");
  return `
  <section class="pk-banner pk-bleed${hasBg ? " pk-banner--photo" : ""}${h ? " pk-banner--sized" : ""}"${style ? ` style="${style}"` : ""}>
    ${hasBg ? '<div class="pk-banner-bg" aria-hidden="true"></div><div class="pk-banner-shade" aria-hidden="true"></div>' : ""}
    <div class="pk-inner">
      ${eyebrow(eyebrowText, "pk-on-dark")}
      ${title ? `<h1 class="pk-banner-h">${esc(title)}</h1>` : ""}
      ${intro ? `<p class="pk-banner-p">${esc(intro)}</p>` : ""}
    </div>
  </section>`;
}

// ---------------------------------------------------------------------------
// Full-bleed backgrounds
// A widget renders inside whatever column Cvent gives it. With full bleed on,
// each section's BACKGROUND (hero video, tint, dark band) is stretched to the
// browser window edges while its content stays in the centred .pk-inner column.
// We measure instead of using 100vw: 100vw includes the scrollbar (a sideways
// scroll on Windows) and "50% - 50vw" is wrong when the column is off-centre.
// Widgets render as web components in the page (no iframe), so the page
// viewport is the right reference. An ancestor with overflow:hidden will still
// clip it — then set the Cvent section/column to full width instead.
// Returns a cleanup function; call it on re-render and disconnect.
// ---------------------------------------------------------------------------
export function applyFullBleed(root) {
  if (!root) return () => {};
  // The box the section may stretch across: the nearest ancestor that clips
  // horizontally (overflow-x not visible), crossing shadow roots; else the
  // viewport. In Cvent's site designer that is the canvas, NOT the whole
  // window (which also holds the settings panel), so the content stays
  // centred over the canvas. On the live site it is the viewport, or a
  // clipping Cvent wrapper — which would crop the background anyway.
  const bleedBox = () => {
    let el = root;
    while (el) {
      el = el.parentElement || (el.getRootNode && el.getRootNode().host) || null;
      if (!el || el === document.documentElement || el === document.body) break;
      const ox = getComputedStyle(el).overflowX;
      if (ox && ox !== "visible") {
        const r = el.getBoundingClientRect();
        return { left: r.left + el.clientLeft, width: el.clientWidth };
      }
    }
    return { left: 0, width: document.documentElement.clientWidth || window.innerWidth };
  };
  const measure = () => {
    const box = bleedBox();
    const r = root.getBoundingClientRect(); // viewport-relative, so page scroll does not matter
    // A canvas that is CSS-scaled (zoom to fit) reports scaled rects; convert
    // back to the widget's own CSS pixels.
    const scale = root.offsetWidth ? r.width / root.offsetWidth || 1 : 1;
    const col = root.clientWidth;
    const vw = Math.max(col, Math.round(box.width / scale));
    const bleedLeft = Math.min(0, Math.round((box.left - r.left) / scale));
    root.style.setProperty("--pk-vw", `${vw}px`);
    root.style.setProperty("--pk-bleed-left", `${bleedLeft}px`);
    // Extra room to the right of the column, so padding can hold the content
    // exactly over the column (see .pk--bleed .pk-bleed).
    root.style.setProperty("--pk-bleed-right", `${Math.max(0, vw - col + bleedLeft)}px`);
  };
  measure();
  let raf = 0;
  const onResize = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(measure); };
  window.addEventListener("resize", onResize);
  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(onResize) : null;
  ro?.observe(root);
  // Cvent's editor canvas shifts panels in and out: re-measure after layout settles.
  const t = setTimeout(measure, 400);
  return () => {
    window.removeEventListener("resize", onResize);
    ro?.disconnect();
    cancelAnimationFrame(raf);
    clearTimeout(t);
  };
}

// ---------------------------------------------------------------------------
// INNER PAGES (Agenda, Speakers, Venue, Contact) — shared config + base class
// Each inner-page widget = dark banner + its own sections + "Request to attend"
// band, with the same General / Page layout / Banner / Closing band settings.
// ---------------------------------------------------------------------------
export const PAGE_BASE_DEFAULTS = {
  // "native" clicks Cvent's own Register button; "url" links to registerUrl.
  registerMode: "native",
  nativeRegisterLabel: "",     // Cvent button label to match; blank = the band's button label
  nativeRegisterSelector: "",  // optional exact CSS selector (wins over the label)
  registerUrl: "",             // fallback when the native button is not found; the "url" mode target
  useBrandFont: true,
  fullBleed: true,             // section backgrounds run edge to edge of the window
  sectionSpacing: 100,         // % of the standard space between sections
  banner: {
    show: true,
    autoEyebrow: true,         // blank eyebrow = "<event> · <date> · <city>"
    eyebrow: "",
    title: "",                 // blank = the page's default title
    intro: "",                 // blank = the page's default intro (if it has one)
    bgImageUrl: "",            // optional background photo; blank = solid black
    bgImageData: "",           // uploaded photo (JPEG data URL, made by the editor); a URL above wins
    bgFocalX: 50,              // focal point, % from left (desktop / tablet)
    bgFocalXMobile: "",        // ≤600px; blank = same as desktop
    bgFocalY: 50,              // focal point, % from top
    bgOverlay: 60,             // darkening over the photo, 0–90 %
    height: "",                // minimum banner height, px; blank = fits the text
  },
  cta: {
    show: true,
    style: "light",            // "light" (on the grey band) | "dark" (black panel)
    eyebrow: "",
    heading: "",               // blank = "Join us at <venue> on <date>"
    body: "",                  // blank = "<weekday>, <time> <zone>, <address>"
    buttonLabel: "Request to attend",
  },
  translations: {},
};

// Deep-merge a saved config over page defaults.
//   sections : keys whose values are objects (merged one level deep)
//   lists    : { "section.items": length } fixed-length item arrays, merged per index
export function mergePageConfig(defaults, incoming = {}, { lists = {} } = {}) {
  const out = { ...defaults, ...incoming };
  Object.keys(defaults).forEach((k) => {
    const d = defaults[k];
    if (d && typeof d === "object" && !Array.isArray(d) && k !== "translations") out[k] = { ...d, ...(incoming[k] || {}) };
  });
  Object.keys(lists).forEach((path) => {
    const [sec, key] = path.split(".");
    const base = defaults[sec][key];
    const inc = Array.isArray(incoming[sec]?.[key]) ? incoming[sec][key] : [];
    out[sec][key] = base.map((b, i) => ({ ...b, ...(inc[i] || {}) }));
  });
  if (Array.isArray(defaults.order)) {
    const seen = new Set();
    const saved = Array.isArray(incoming.order) ? incoming.order : [];
    out.order = [...saved, ...defaults.order].filter((k) => defaults.order.includes(k) && !seen.has(k) && seen.add(k));
  }
  out.translations = { ...(incoming.translations || {}) };
  return out;
}

// SDK method lookup: this.cventSdk first (Cvent), then the element, then window.
export function sdkFn(host, name) {
  if (host?.cventSdk?.[name]) return host.cventSdk[name].bind(host.cventSdk);
  if (typeof host?.[name] === "function") return host[name].bind(host);
  if (typeof window !== "undefined" && typeof window[name] === "function") return window[name];
  return undefined;
}

// Sessions (date order) + the full speaker records of everyone on a session +
// event info. Speakers are only reachable through their sessions (the SDK has
// no "all speakers" call), so a speaker must be on at least one session.
export async function loadEventData(host, { tag = "page", sessions: wantSessions = true, speakers: wantSpeakers = true } = {}) {
  let eventInfo = {};
  try { eventInfo = (await sdkFn(host, "getEventInfo")?.()) || {}; } catch (e) { console.warn(`[${tag}] getEventInfo error:`, e); }
  const sessions = [];
  if (wantSessions || wantSpeakers) {
    try {
      const gen = await sdkFn(host, "getSessionGenerator")?.("dateTimeAsc", 200);
      if (gen) {
        for await (const page of gen) {
          const batch = Array.isArray(page) ? page : Array.isArray(page?.sessions) ? page.sessions : Array.isArray(page?.records) ? page.records : [];
          sessions.push(...batch);
          if (sessions.length >= 400) break;
        }
      }
    } catch (e) {
      console.warn(`[${tag}] getSessionGenerator error:`, e);
    }
  }
  const getSpeakers = sdkFn(host, "getSpeakers");
  const speakers = {};
  const order = [];                       // speaker ids in first-appearance order
  if (wantSpeakers) {
    sessions.forEach((s) => (s.speakers || []).forEach((sp) => {
      const id = String(sp?.id || sp?.speakerId || sp?.speaker?.id || "");
      if (id && !order.includes(id)) order.push(id);
    }));
    if (order.length && getSpeakers) {
      try {
        const map = (await getSpeakers(order)) || {};
        Object.keys(map).forEach((k) => { if (map[k] && !map[k].failureReason) speakers[String(map[k].id || k)] = map[k]; });
      } catch (e) {
        console.warn(`[${tag}] getSpeakers error:`, e);
      }
    }
  }
  const eventTz = tzNormalize(eventInfo.timezone) || "America/New_York";
  return { eventInfo, sessions, speakers, speakerOrder: order, getSpeakers, eventTz };
}

// ---- Session visibility + session meta (custom fields, Playbook §6) --------
// Cvent's native "Display on agenda" switch is NOT in the SDK session object,
// so hiding uses a session custom field. Any of these works (case-insensitive):
//   "Hide from agenda" / "Hide from agenda?" / "Hide from main agenda?" = Yes
//   "Display on agenda" / "Display on agenda?" / "Show on agenda?"       = No
const cfValues = (f) => (Array.isArray(f?.value) ? f.value : f?.value != null ? [f.value] : []).map((v) => String(v).trim().toLowerCase());
const cfName = (f) => String(f?.name || "").trim().toLowerCase().replace(/\s+/g, " ").replace(/\?$/, "");
export function isHiddenSession(s, hiddenIds = []) {
  if (hiddenIds.map(String).includes(String(s?.id))) return true;
  return (s?.sessionCustomFields || []).some((f) => {
    const n = cfName(f);
    const v = cfValues(f);
    if (/^hide from (main )?agenda$/.test(n)) return v.includes("yes");
    if (/^(display|show) on (the )?agenda$/.test(n)) return v.includes("no");
    return false;
  });
}
// Value(s) of a session custom field, by name (case-insensitive, "?" optional).
export function sessionField(s, name) {
  const want = String(name || "").trim().toLowerCase().replace(/\?$/, "");
  const f = (s?.sessionCustomFields || []).find((x) => cfName(x) === want);
  return f ? (Array.isArray(f.value) ? f.value : f.value != null ? [f.value] : []).map((v) => String(v).trim()).filter(Boolean) : [];
}
export const fieldIsYes = (s, name) => sessionField(s, name).some((v) => v.toLowerCase() === "yes");

// Event facts used by banners, closing bands and the venue page.
export function eventFacts({ eventInfo = {}, sessions = [], speakers = {}, eventTz }, lang) {
  const start = eventInfo.startDate;
  const end = eventInfo.endDate;
  const a = eventInfo.address || {};
  return {
    title: eventInfo.title || "",
    dateLong: fmtDate(start, eventTz, lang, { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
    dateShort: fmtDate(start, eventTz, lang, { weekday: "long", month: "long", day: "numeric" }),
    dateMedium: fmtDate(start, eventTz, lang, { month: "long", day: "numeric", year: "numeric" }),
    dayMonth: fmtDate(start, eventTz, lang, { month: "long", day: "numeric" }),
    weekday: fmtDate(start, eventTz, lang, { weekday: "long" }),
    startTime: fmtTime(start, eventTz),
    timeRange: fmtTimeRange(start, end, eventTz),
    tzShort: tzName(start, eventTz, "shortGeneric") || tzName(start, eventTz, "short"),
    tzLong: tzName(start, eventTz, "longGeneric") || tzName(start, eventTz, "long"),
    venueName: eventInfo.location || "",
    address1: a.address1 || "",
    address2: [a.address2, a.address3].filter(Boolean).join(", "),
    city: a.city || "",
    cityLine: [a.city, [a.stateCode, a.postalCode].filter(Boolean).join(" ")].filter(Boolean).join(", "),
    street: [a.address1, a.city].filter(Boolean).join(", "),
    sessionCount: sessions.length,
    speakerCount: Object.keys(speakers).length,
    startIso: start || "",
    endIso: end || "",
  };
}

// Google Maps links from an address (no API key needed).
export const mapsDirectionsUrl = (q) => (q ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}` : "");
export const mapsEmbedUrl = (q) => (q ? `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=15&output=embed` : "");

// Download an .ics calendar file for the event (works in every calendar app).
export function downloadIcs({ title, start, end, location = "", description = "", url = "", uid = "" }) {
  if (!start) return;
  const stamp = (iso) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const escIcs = (s) => String(s ?? "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
  const body = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Bloomberg Live//Event page//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escIcs(uid || `${stamp(start)}-${Math.random().toString(36).slice(2)}@bloomberglive`)}`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end || start)}`,
    `SUMMARY:${escIcs(title)}`,
    location ? `LOCATION:${escIcs(location)}` : "",
    description ? `DESCRIPTION:${escIcs(description)}` : "",
    url ? `URL:${escIcs(url)}` : "",
    "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
  const blob = new Blob([body], { type: "text/calendar;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${String(title || "event").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "event"}.ics`;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

// Base element for the inner-page widgets. A page subclass provides:
//   static defaults / merge(cfg) / labels   config
//   get tag()                               console prefix + BUILD label
//   needs()                                 { sessions, speakers } to load
//   bannerDefaults(ctx)                     { title, intro } used when blank
//   sections(ctx)                           { key: () => html } for cfg.order
//   pageCss(cfg)                            page-specific CSS
//   afterRender(root, ctx)                  mount cards, wire filters, …
export class PageWidget extends HTMLElement {
  constructor({ configuration, theme } = {}) {
    super();
    this.configuration = configuration || {};
    this.theme = theme || {};
    this.attachShadow({ mode: "open" });
    this._dataPromise = null;
    this._renderSeq = 0;
    this._langObserver = null;
    this._cleanups = [];
  }

  get tag() { return "page"; }
  get build() { return ""; }
  merge(cfg) { return mergePageConfig(PAGE_BASE_DEFAULTS, cfg); }
  needs() { return { sessions: true, speakers: true }; }
  bannerDefaults() { return { title: "", intro: "" }; }
  sections() { return {}; }
  pageCss() { return ""; }
  afterRender() {}

  async connectedCallback() {
    if (this.configuration?.useBrandFont !== false) ensureBrandFont();
    const root = document.createElement("div");
    root.className = "pk";
    root.dataset.build = this.build;
    this.shadowRoot.append(root);
    await this._renderInto(root);
    this._langObserver = new MutationObserver(() => this._rerender());
    this._langObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  }

  disconnectedCallback() {
    this._runCleanups();
    this._langObserver?.disconnect();
  }

  onConfigurationUpdate(newConfig) {
    this.configuration = newConfig || {};
    this._rerender();
  }

  _rerender() {
    const root = this.shadowRoot?.querySelector(".pk");
    if (root) this._renderInto(root);
  }

  _runCleanups() {
    this._cleanups.forEach((fn) => { try { fn?.(); } catch (e) { /* noop */ } });
    this._cleanups = [];
  }

  _loadData() {
    if (!this._dataPromise) this._dataPromise = loadEventData(this, { tag: this.tag, ...this.needs() });
    return this._dataPromise;
  }

  async _renderInto(root) {
    const seq = ++this._renderSeq;
    const cfg = this.merge(this.configuration || {});
    const css = `<style>${kitCss()}${this.pageCss(cfg)}</style>`;
    root.innerHTML = `${css}<p class="pk-sr" role="status">${esc(fixed("en", "loading"))}</p>`;
    const data = await this._loadData();
    if (seq !== this._renderSeq) return; // a newer render started meanwhile
    this._runCleanups();

    const lang = resolveLang(data.eventInfo);
    const P = (section, key, base) => plannerText(cfg, lang, `${section}.${key}`, base);
    const ctx = { cfg, lang, P, ...data, facts: eventFacts(data, lang) };
    const own = this.sections(ctx);
    const RENDER = { banner: () => this._banner(ctx), cta: () => this._cta(ctx), ...own };
    const order = Array.isArray(cfg.order) ? cfg.order : ["banner", ...Object.keys(own), "cta"];
    const keys = order.filter((k) => cfg[k]?.show !== false && RENDER[k]);
    const parts = keys.map((k) => RENDER[k]()).filter((h) => h && h.trim());
    // A light closing band right after a grey section turns white with a
    // hairline on top, so two grey bands never merge.
    parts.forEach((h, i) => {
      if (i && /pk-band(?!--dark)/.test(h) && !/pk-band--dark/.test(h)) {
        const prev = (parts[i - 1].match(/<section[^>]*>/) || [""])[0];
        if (/pk-ground-tint/.test(prev)) parts[i] = h.replace("pk-ground-tint pk-pad-tight", "pk-ground-white pk-rule-top pk-pad-tight");
      }
    });
    const html = parts.join("");

    const space = Math.max(20, Math.min(200, Number(cfg.sectionSpacing) || 100)) / 100;
    root.style.setProperty("--pk-space", String(space));
    root.classList.toggle("pk--bleed", cfg.fullBleed !== false);
    root.innerHTML = `${css}${html}`;
    if (cfg.fullBleed !== false) this._cleanups.push(applyFullBleed(root));
    this._cleanups.push(wireRegister(root, {
      mode: cfg.registerMode,
      label: cfg.nativeRegisterLabel || P("cta", "buttonLabel", cfg.cta.buttonLabel),
      selector: cfg.nativeRegisterSelector,
      url: cfg.registerUrl,
    }));
    this.afterRender(root, ctx);
  }

  // ---- shared sections ------------------------------------------------------
  _banner(ctx) {
    const { cfg, facts, P } = ctx;
    const b = cfg.banner;
    const d = this.bannerDefaults(ctx) || {};
    const auto = b.autoEyebrow !== false ? [facts.title, facts.dateMedium, facts.city].filter(Boolean).join(" · ") : "";
    return pageBanner({
      eyebrowText: P("banner", "eyebrow", b.eyebrow) || auto,
      title: P("banner", "title", b.title) || d.title || "",
      intro: P("banner", "intro", b.intro) || d.intro || "",
      bg: { url: b.bgImageUrl || b.bgImageData, focalX: b.bgFocalX, focalXMobile: b.bgFocalXMobile, focalY: b.bgFocalY, overlay: b.bgOverlay, height: b.height },
    });
  }

  _cta({ cfg, lang, facts, P }) {
    const c = cfg.cta;
    const place = facts.venueName;
    const heading = P("cta", "heading", c.heading)
      || (facts.dayMonth ? (place ? fixed(lang, "joinUsAt", { place, date: facts.dayMonth }) : fixed(lang, "joinUsOn", { date: facts.dayMonth })) : "");
    const when = [facts.weekday, facts.timeRange && `${facts.timeRange} ${facts.tzLong}`.trim()].filter(Boolean).join(", ");
    const body = P("cta", "body", c.body) || [when, [facts.address1, facts.city].filter(Boolean).join(", ")].filter(Boolean).join(", ") + (when ? "." : "");
    return regBand({
      eyebrowText: P("cta", "eyebrow", c.eyebrow), heading, body,
      buttonLabel: P("cta", "buttonLabel", c.buttonLabel), href: cfg.registerUrl,
      dark: c.style === "dark", lang, nativeRegister: cfg.registerMode !== "url",
    });
  }
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
  /* Section rhythm: --pk-space scales every section's top AND bottom padding
     equally (1 = the default, set by the widget's "Space between sections").
     The default is half the original 104px band, so the gap between two
     sections is 50% smaller: 25% of it taken from each side. */
  .pk-section { padding: calc(clamp(56px, 7vw, 104px) * .5 * var(--pk-space, 1)) 0; }
  .pk-pad-tight { padding: calc(clamp(40px, 5vw, 80px) * .5 * var(--pk-space, 1)) 0; }
  .pk-inner { width: 100%; max-width: 1240px; margin: 0 auto; padding: 0 clamp(20px, 4vw, 48px); }
  .pk-ground-white { background: #fff; }
  .pk-ground-tint { background: ${t.tint}; }
  .pk-ground-dark { background: ${t.deep}; color: #fff; }
  .pk-rule-top { border-top: 1px solid ${t.hair}; }

  /* Type */
  .pk-eyebrow { font-size: 12px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: ${t.amberInk}; margin-bottom: 14px; }
  .pk-on-dark.pk-eyebrow, .pk-ground-dark .pk-eyebrow { color: ${t.amberOnDark}; }
  .pk-h2 { font-size: ${px(sec.fontSize)}; line-height: 1.15; font-weight: 700; letter-spacing: -0.02em; max-width: 34ch; }
  .pk-ground-dark .pk-h2 { color: #fff; }
  .pk-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; }
  .pk-lede { font-size: 16px; line-height: 1.5; color: ${t.ink}; }
  .pk-copy { font-size: 17px; line-height: 1.65; color: ${t.body}; }
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
  button.pk-btn { font-family: inherit; background: transparent; cursor: pointer; -webkit-appearance: none; appearance: none; margin: 0; }
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
  .pk-banner--photo, .pk-banner--sized { position: relative; overflow: hidden; isolation: isolate; }
  .pk-banner--sized { min-height: var(--pk-banner-h); display: flex; flex-direction: column; justify-content: flex-end; }
  .pk-banner--photo > .pk-inner { position: relative; z-index: 1; }
  .pk-banner-bg { position: absolute; inset: 0; z-index: 0; background-image: var(--pk-banner-bg); background-size: cover; background-position: var(--pk-banner-pos, 50% 50%); background-repeat: no-repeat; }
  .pk-banner-shade { position: absolute; inset: 0; z-index: 0; background: rgba(11,11,12,var(--pk-banner-shade, .6)); }
  .pk-banner--photo .pk-banner-p { color: rgba(255,255,255,.85); }
  .pk-banner--photo .pk-inner { text-shadow: 0 1px 2px rgba(0,0,0,.45); }

  /* Full bleed: the section box spans the window; content stays in .pk-inner. */
  /* The section BOX spans the bleed area (so backgrounds, video and photos
     reach the edges) but its horizontal padding puts the content area exactly
     back over the widget's own column. Content is therefore centred on the
     column in the editor and live alike, whatever the measurement says. */
  .pk--bleed .pk-bleed {
    width: var(--pk-vw, 100%); max-width: none;
    margin-left: var(--pk-bleed-left, 0px); margin-right: 0;
    padding-left: calc(-1 * var(--pk-bleed-left, 0px)); padding-right: var(--pk-bleed-right, 0px);
    box-sizing: border-box;
  }
  .pk-only-mobile { display: none; }
  /* A section that is switched on but has no content yet. Visible on purpose
     (same pattern as the featured-speakers widget's empty prompt): it tells the
     planner what to fill in, or to switch the section off. */
  .pk-placeholder { margin-top: 32px; padding: 28px; border: 1px dashed ${t.muted}; border-radius: 2px; font-size: 14px; line-height: 1.5; color: ${t.muted}; }
  .pk-ground-dark .pk-placeholder { border-color: rgba(255,255,255,.4); color: ${t.onDark}; }
  .pk-placeholder strong { display: block; margin-bottom: 4px; color: inherit; }
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
    .pk-banner-bg { background-position: var(--pk-banner-pos-m, var(--pk-banner-pos, 50% 50%)); }
    .pk-banner--sized { min-height: min(var(--pk-banner-h), 360px); }
  }
  @media (prefers-reduced-motion: reduce) {
    .pk *, .pk *::before, .pk *::after { transition: none !important; animation: none !important; }
  }
  `;
}
