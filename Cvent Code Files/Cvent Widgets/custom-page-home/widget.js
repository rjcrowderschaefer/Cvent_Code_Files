// widget.js — Home PAGE widget (Bloomberg Live event sites).
//
// One widget renders the whole Home page body, section by section:
//   hero · facts strip · featured speakers · about · themes ·
//   program highlights · request-to-attend panel · more from Bloomberg
// Every section has an on/off toggle and planner-editable copy (editor.js).
// Speakers and sessions are LIVE event data (SDK), never hard-coded:
//   - featured speakers  = planner-picked in the editor (featuredSpeakerIds),
//                          rendered with the shared FeaturedSpeaker card + bio modal
//   - program highlights = sessions flagged "Featured" in Cvent, else the
//                          planner's picks, else the first sessions with speakers
//   - facts strip / hero facts / countdown = getEventInfo() + session counts
// The site nav, footer and fixed mobile CTA bar stay NATIVE Cvent (theme-styled):
// position:fixed inside a widget pins to the widget, not the screen.
//
// Shared building blocks: page-kit.js (identical copy in every page widget).
// NOTE: include the file extension in imports.
import { FeaturedSpeaker, defaultTypography as speakerTypography } from "./FeaturedSpeaker.js";
import { TYPE_SCALE, ensureBrandFont } from "./type-scale.js";
import {
  TOKENS, esc, safeUrl, cleanRichText, paragraphs, lines, tzNormalize, resolveLang, fixed,
  plannerText, fmtTime, fmtTimeRange, fmtDate, tzName, eyebrow, button, arrowLink,
  sectionHead, regBand, kitCss, applyFullBleed, registerButton, wireRegister, cleanLabel, isExternal, isHiddenSession,
  closingBandCopy, eventFacts, pageCardBase, pageCardTypography, LABEL_PX,
  holdHeight, trackScroll, noteConfig, restoreScroll,
} from "./page-kit.js";

const CARD_TAG = "bbg-home-speaker-card";
// Bump on every change. Shown in the editor footer and as data-build on the
// widget root, so a stale Cvent/CDN copy is obvious (Playbook §0).
export const BUILD = "home-2026-10-02a";

// ---------------------------------------------------------------------------
// Defaults (exported for editor.js). Copy defaults are GENERIC on purpose:
// this widget is reused across events; each planner writes their own copy.
// ---------------------------------------------------------------------------
export const HOME_DEFAULTS = {
  // Registration buttons: "native" clicks Cvent's own Register button (keeps
  // registration type / path logic); "url" links to registerUrl instead.
  registerMode: "native",
  nativeRegisterLabel: "",     // label of Cvent's button to click; blank = hero button label
  nativeRegisterSelector: "",  // optional exact CSS selector (wins over the label)
  registerUrl: "",             // fallback when the native button is not found, and the "url" mode target
  useBrandFont: true,
  fullBleed: true,       // section backgrounds run edge to edge of the window
  // Section order, top to bottom. Planners reorder in the editor; any section
  // missing from a saved order is appended in its default position.
  // Flagship review (2026-10-01): About the event sits ABOVE the speakers.
  order: ["hero", "facts", "about", "speakers", "themes", "program", "cta", "more"],
  sectionSpacing: 100,   // % of the default space between sections (the default is already 50% of the original)
  hero: {
    show: true,
    videoUrl: "",
    posterUrl: "",
    logoUrl: "",          // event lockup image; blank = text lockup below
    logoAlt: "",
    logoWidth: 960,       // desktop width, px
    logoWidthTablet: 720, // ≤1024px, px
    logoWidthMobile: 100, // ≤600px, % of the hero's content width (over 100 is fine for PNGs with transparent padding)
    logoGap: 22,          // space under the logo, px (desktop); negative trims a PNG's transparent padding
    logoGapTablet: "",    // ≤1024px, px; blank = same as desktop
    logoGapMobile: 18,    // space under the logo, px (≤600px)
    titleStrong: "",      // blank = event title minus its last word
    titleLight: "",       // blank = last word of the event title
    eyebrow: "",
    showFacts: false,     // off: the facts card right under the hero already says when and where (flagship review)
    lede: "",
    primaryLabel: "Request to attend",
    secondaryLabel: "View the program",
    secondaryUrl: "",
    showCountdown: true,
    focalX: 50,           // video focal point, % from left (desktop / tablet)
    focalXMobile: 65,     // ≤600px
    scrimDesktop: 0,      // 0–80 %. Design system: raw image + text shadow…
    scrimMobile: 45,      // …with a 45% scrim on mobile only.
  },
  facts: {
    show: true,
    docked: true,         // card overlaps the bottom of the hero when it follows the hero
    dateLabel: "Date", dateValue: "", dateDetail: "",
    venueLabel: "Venue", venueValue: "", venueDetail: "",
    programLabel: "Program", programValue: "", programDetail: "",
    speakersLabel: "Speakers", speakersValue: "", speakersDetail: "",
    showSpeakers: false,  // the Speakers cell repeats the speakers section below it (flagship review)
  },
  speakers: {
    show: true,
    eyebrow: "Speakers",
    heading: "Featured speakers",
    layout: "carousel",   // "carousel" (flagship default: arrows, swipe) | "grid" (static row + "See all" link)
    includeAll: true,     // carousel: after the picked speakers, the rest of the event's speakers
    linkLabel: "See all speakers",   // grid layout only
    linkUrl: "",
    featuredSpeakerIds: [],
    modalEyebrowText: "Speaker",
    showSessions: true,
    sessionsHeaderText: "Sessions",
    showModeratorLabel: true,   // "Moderator" above the name, as on the Speakers page
    moderatorCategories: "Moderator, Moderators",
  },
  about: {
    show: true,
    eyebrow: "About the event",
    heading: "",
    body: "",             // blank = the Cvent event description
    listEyebrow: "",
    listStyle: "numbered", // "numbered" (01, 02 …) | "bullets" | "icons" (one per item)
    items: [],            // [{ title, description, icon }]; a description makes the item expandable
    listItems: "",        // LEGACY: one item per line (migrated into items by mergeHomeConfig)
    seeded: false,        // editor has copied the Cvent description into the fields once
  },
  themes: {
    show: true,
    eyebrow: "Themes in focus",
    heading: "",
    bgImageUrl: "",       // optional background photo behind the dark band
    bgFocalX: 50,         // focal point, % from left
    bgFocalY: 50,         // focal point, % from top
    bgOverlay: 70,        // darkening over the photo, 0–90 % (text must stay readable)
    listStyle: "numbered", // card marker: "numbered" (01, 02 …) | "bullets" | "icons"
    items: [
      { kicker: "", title: "", body: "", icon: "" },
      { kicker: "", title: "", body: "", icon: "" },
      { kicker: "", title: "", body: "", icon: "" },
    ],
  },
  program: {
    show: true,
    eyebrow: "Program",
    heading: "Program highlights",
    linkLabel: "View the full program",
    linkUrl: "",
    source: "auto",       // auto = Cvent "Featured" sessions, else picks, else first sessions
    sessionIds: [],
    limit: 5,
  },
  cta: {
    show: true,
    eyebrow: "Request to attend",
    heading: "",          // blank = "Join us on <date>"
    body: "",             // blank = date · time · venue
    buttonLabel: "Request to attend",
  },
  more: {
    show: true,
    layout: "cards",      // "cards" (image on top) | "tiles" (text over image) | "list" (text only)
    eyebrow: "More from Bloomberg",
    heading: "",
    intro: "",
    bgImageUrl: "",       // optional background photo (section turns dark)
    bgFocalX: 50,
    bgFocalY: 50,
    bgOverlay: 70,
    items: [
      { title: "", body: "", linkLabel: "", url: "", imageUrl: "" },
      { title: "", body: "", linkLabel: "", url: "", imageUrl: "" },
      { title: "", body: "", linkLabel: "", url: "", imageUrl: "" },
    ],
  },
  translations: {},
};

const SECTIONS = ["hero", "facts", "speakers", "about", "themes", "program", "cta", "more"];
// Every default order this widget has shipped. A saved order that is exactly
// one of these was never customised, so it follows the current default.
const LEGACY_ORDERS = [["hero", "facts", "speakers", "about", "themes", "program", "cta", "more"]];

// Deep-merge a saved config over the defaults (section objects + item arrays).
export { SECTIONS };
export function mergeHomeConfig(incoming = {}) {
  const d = HOME_DEFAULTS;
  const out = { ...d, ...incoming };
  SECTIONS.forEach((k) => { out[k] = { ...d[k], ...(incoming[k] || {}) }; });
  ["themes", "more"].forEach((k) => {
    const base = d[k].items;
    const inc = Array.isArray(incoming[k]?.items) ? incoming[k].items : [];
    out[k].items = base.map((b, i) => ({ ...b, ...(inc[i] || {}) }));
  });
  // About list: structured items. Older configs kept one item per line in
  // listItems; turn those into items once (titles only, no descriptions).
  const inAbout = incoming.about || {};
  out.about.items = Array.isArray(inAbout.items)
    ? inAbout.items.map((it) => ({ title: "", description: "", icon: "", ...(typeof it === "string" ? { title: it } : it || {}) }))
    : lines(inAbout.listItems || "").map((title) => ({ title, description: "", icon: "" }));
  const seen = new Set();
  let saved = Array.isArray(incoming.order) ? incoming.order : [];
  if (LEGACY_ORDERS.some((o) => o.length === saved.length && o.every((k, i) => k === saved[i]))) saved = d.order;
  out.order = [...saved, ...d.order].filter((k) => SECTIONS.includes(k) && !seen.has(k) && seen.add(k));
  out.translations = { ...(incoming.translations || {}) };
  return out;
}

// ---------------------------------------------------------------------------
// List markers (About list + Themes cards): numbers, bullets or an icon per
// item. Icons are inline stroke SVGs (24 × 24, currentColor), so they follow
// the text colour of where they sit and need no extra files.
// ---------------------------------------------------------------------------
export const LIST_STYLES = [["numbered", "Numbered (01, 02, 03)"], ["bullets", "Bullets"], ["icons", "An icon for each item"]];
export const ICONS = {
  check: ["Check", '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.8 2.8L16 9.5"/>'],
  chart: ["Line chart", '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 6-7"/>'],
  bars: ["Bar chart", '<path d="M3 21h18M6 21V11M11 21V5M16 21v-7M20 21v-4"/>'],
  trend: ["Trend up", '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>'],
  globe: ["Globe", '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/>'],
  bank: ["Bank", '<path d="M3 9.5L12 4l9 5.5M4 21h16M6 10.5v7.5M10 10.5v7.5M14 10.5v7.5M18 10.5v7.5"/>'],
  coins: ["Coins", '<ellipse cx="9" cy="6.5" rx="6" ry="2.5"/><path d="M3 6.5V11c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V6.5"/><path d="M9 13.5V18c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-4.5c0-1.2-2-2.2-4.8-2.4"/>'],
  shield: ["Shield", '<path d="M12 3l8 3v6c0 4.6-3.4 8.3-8 9-4.6-.7-8-4.4-8-9V6z"/><path d="M9 12l2.2 2.2L15.5 10"/>'],
  lock: ["Lock", '<rect x="5" y="11" width="14" height="10" rx="1.5"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>'],
  scale: ["Scales", '<path d="M12 4v17M8 21h8M5 7h14M12 4a1 1 0 1 0 0 .01"/><path d="M5 7l-3 6.5a3 3 0 0 0 6 0zM19 7l-3 6.5a3 3 0 0 0 6 0z"/>'],
  bulb: ["Light bulb", '<path d="M9.5 18h5M10.5 21h3"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.1V16h5v-.1c0-.8.4-1.6 1.1-2.1A6 6 0 0 0 12 3z"/>'],
  chip: ["Chip / AI", '<rect x="6.5" y="6.5" width="11" height="11" rx="1.5"/><path d="M10 10h4v4h-4zM9.5 2.5v4M14.5 2.5v4M9.5 17.5v4M14.5 17.5v4M2.5 9.5h4M2.5 14.5h4M17.5 9.5h4M17.5 14.5h4"/>'],
  network: ["Network", '<circle cx="12" cy="5" r="2.2"/><circle cx="5" cy="19" r="2.2"/><circle cx="19" cy="19" r="2.2"/><path d="M12 7.2V12M12 12l-5.4 5.4M12 12l5.4 5.4"/>'],
  users: ["People", '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.4 3.3-5.5 6.5-5.5s5.9 2.1 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.9.7 3.2 2.5 3.5 5.2"/>'],
  briefcase: ["Briefcase", '<rect x="3" y="7" width="18" height="13" rx="1.5"/><path d="M9 7V4.5h6V7M3 12.5h18"/>'],
  target: ["Target", '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>'],
  bolt: ["Lightning", '<path d="M13 2.5L4.5 13.5H11l-1 8 8.5-11H12z"/>'],
  leaf: ["Leaf", '<path d="M5 19C5 11 10 5 20 4c-1 10-7 15-15 15z"/><path d="M5 19l7.5-7.5"/>'],
  doc: ["Document", '<path d="M6 3h8.5L19 7.5V21H6z"/><path d="M14 3v5h5M9 12.5h7M9 16.5h7"/>'],
  mic: ["Microphone", '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>'],
  calendar: ["Calendar", '<rect x="3" y="5" width="18" height="16" rx="1.5"/><path d="M3 10h18M8 3v4M16 3v4"/>'],
};
export const iconSvg = (name, cls = "mk-ico") => {
  const d = (ICONS[name] || ICONS.check)[1];
  return `<svg class="${cls}" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;
};
const listStyleOf = (v) => (LIST_STYLES.some(([k]) => k === v) ? v : "numbered");
function listMarker(style, i, icon) {
  if (style === "icons") return `<span class="mk mk--icon">${iconSvg(icon)}</span>`;
  if (style === "bullets") return '<span class="mk mk--dot" aria-hidden="true"></span>';
  return `<span class="mk mk--num" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span>`;
}

// Speakers heading: always one line. 24 characters fit on one line at every
// breakpoint (42px desktop down to 1025px wide with the carousel arrows, 32px
// tablet down to 601px, 28px phone, scaled down slightly under ~430px). The
// editor caps the field at this length; anything longer that is already saved
// (or a long translation) is cut with an ellipsis and kept whole in a tooltip.
export const SPEAKER_HEADING_MAX = 24;
const spkTitle = (h) => (String(h || "").length > SPEAKER_HEADING_MAX ? ` title="${esc(h)}"` : "");

// Same rule as the Speakers page widget: the speaker's Cvent category.
const normCat = (v) => String(v ?? "").trim().toLowerCase();
const isModerator = (sp, s) => String(s.moderatorCategories || "").split(",").map(normCat).filter(Boolean)
  .includes(normCat(sp?.category?.name || sp?.categoryName || ""));

// Split the Cvent event description into the About section's parts, so the
// section renders in its two-column layout out of the box and the editor can
// show (and let planners edit) exactly what is on the page:
//   paragraphs            -> body (blank line between paragraphs)
//   first bulleted list   -> numbered list, one item per line
//   "…, the program will explore:" lead-in before that list -> list eyebrow
export function deriveAbout(html) {
  const out = { body: "", listEyebrow: "", listItems: "" };
  const raw = String(html ?? "").trim();
  if (!raw) return out;
  let doc;
  try { doc = new DOMParser().parseFromString(`<div>${raw}</div>`, "text/html"); } catch (e) { return out; }
  const textOf = (el) => {
    const c = el.cloneNode(true);
    c.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
    return c.textContent.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ");
  };
  const paras = [];
  let items = null;
  let leadIn = "";
  doc.body.querySelectorAll("p, ul, ol").forEach((el) => {
    if (el.closest("li") || (el.tagName === "P" && el.parentElement.closest("p"))) return;
    if (el.tagName === "P") {
      textOf(el).split(/\n{2,}/).map((t) => t.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean).forEach((t) => paras.push(t));
      return;
    }
    if (items) { // a second list stays in the body as plain lines
      paras.push([...el.querySelectorAll(":scope > li")].map((li) => textOf(li).trim()).filter(Boolean).join("\n"));
      return;
    }
    items = [...el.querySelectorAll(":scope > li")].map((li) => textOf(li).replace(/\s+/g, " ").trim()).filter(Boolean);
    if (paras.length && /:\s*$/.test(paras[paras.length - 1])) leadIn = paras.pop();
  });
  if (!paras.length && !items) {
    // No block markup at all: plain text description.
    textOf(doc.body).split(/\n{2,}/).map((t) => t.trim()).filter(Boolean).forEach((t) => paras.push(t));
  }
  if (leadIn) {
    // "Through executive discussions and panel sessions, the program will explore:"
    // -> "The program will explore" (the last clause reads as an eyebrow).
    const clause = leadIn.replace(/:\s*$/, "").split(/,\s*/).pop().trim();
    const short = clause.length <= 48 ? clause : leadIn.replace(/:\s*$/, "");
    out.listEyebrow = short.charAt(0).toUpperCase() + short.slice(1);
    // Keep the full sentence when it was shortened, so no copy is lost.
    if (short !== leadIn.replace(/:\s*$/, "") && clause.length > 48) paras.push(leadIn);
  }
  out.body = paras.join("\n\n");
  out.listItems = (items || []).join("\n");
  return out;
}

export default class extends HTMLElement {
  constructor({ configuration, theme } = {}) {
    super();
    this.configuration = configuration || {};
    this.theme = theme || {};
    this.attachShadow({ mode: "open" });
    if (!customElements.get(CARD_TAG)) customElements.define(CARD_TAG, FeaturedSpeaker);
    this._dataPromise = null;   // sessions + speakers + event info, cached across config updates
    this._renderSeq = 0;        // a stale render bails out (no doubled output)
    this._timer = null;         // countdown
    this._langObserver = null;
  }

  async connectedCallback() {
    if (this.configuration?.useBrandFont !== false) ensureBrandFont();
    const root = document.createElement("div");
    root.className = "pk";
    root.dataset.build = BUILD;
    this.shadowRoot.append(root);
    await this._renderInto(root);
    restoreScroll(this, "home", this.configuration);
    this._scrollCleanup = trackScroll(this, "home", this.configuration);
    // Re-render when the attendee switches language (Cvent updates <html lang>).
    this._langObserver = new MutationObserver(() => this._rerender());
    this._langObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  }

  disconnectedCallback() {
    this._scrollCleanup?.();
    this._stopCountdown();
    this._carouselCleanup?.();
    this._bleedCleanup?.();
    this._bleedCleanup = null;
    this._registerCleanup?.();
    this._registerCleanup = null;
    this._langObserver?.disconnect();
  }

  onConfigurationUpdate(newConfig) {
    this.configuration = newConfig || {};
    noteConfig(this, this.configuration);
    this._rerender();
  }

  _rerender() {
    const root = this.shadowRoot?.querySelector(".pk");
    if (root) this._renderInto(root);
  }

  // =========================================================================
  // DATA
  // =========================================================================
  _sdk(name) {
    if (this.cventSdk?.[name]) return this.cventSdk[name].bind(this.cventSdk);
    if (typeof this[name] === "function") return this[name].bind(this);
    if (typeof window !== "undefined" && typeof window[name] === "function") return window[name];
    return undefined;
  }

  _loadData() {
    if (this._dataPromise) return this._dataPromise;
    this._dataPromise = (async () => {
      let eventInfo = {};
      try { eventInfo = (await this._sdk("getEventInfo")?.()) || {}; } catch (e) { console.warn("[home] getEventInfo error:", e); }

      const sessions = [];
      try {
        const gen = await this._sdk("getSessionGenerator")?.("dateTimeAsc", 200);
        if (gen) {
          for await (const page of gen) {
            const batch = Array.isArray(page) ? page : Array.isArray(page?.sessions) ? page.sessions : Array.isArray(page?.records) ? page.records : [];
            sessions.push(...batch);
            if (sessions.length >= 200) break;
          }
        }
      } catch (e) {
        console.warn("[home] getSessionGenerator error:", e);
      }

      const ids = new Set();
      sessions.forEach((s) => (s.speakers || []).forEach((sp) => { const id = sp?.id || sp?.speakerId || sp?.speaker?.id; if (id) ids.add(String(id)); }));
      const getSpeakers = this._sdk("getSpeakers");
      let speakers = {};
      if (ids.size && getSpeakers) {
        try {
          const map = (await getSpeakers([...ids])) || {};
          Object.keys(map).forEach((k) => { if (map[k] && !map[k].failureReason) speakers[String(map[k].id || k)] = map[k]; });
        } catch (e) {
          console.warn("[home] getSpeakers error:", e);
        }
      }
      const eventTz = tzNormalize(eventInfo.timezone) || "America/New_York";
      return { eventInfo, sessions, speakers, getSpeakers, eventTz };
    })();
    return this._dataPromise;
  }

  // =========================================================================
  // RENDER
  // =========================================================================
  async _renderInto(root) {
    const seq = ++this._renderSeq;
    const cfg = mergeHomeConfig(this.configuration || {});
    // First render only: an editor change keeps the old content on screen
    // until the new markup is ready, so the page does not jump to the top.
    if (!root.childElementCount) root.innerHTML = `<style>${kitCss()}${this._css(cfg)}</style><p class="pk-sr" role="status">${esc(fixed("en", "loading"))}</p>`;

    const data = await this._loadData();
    if (seq !== this._renderSeq) return; // a newer render started meanwhile
    this._stopCountdown();
    const release = holdHeight(root);

    const lang = resolveLang(data.eventInfo);
    const ctx = { cfg, lang, ...data, facts: this._eventFacts(data, lang) };
    const P = (section, key, base) => plannerText(cfg, lang, `${section}.${key}`, base);
    ctx.P = P;

    // Facts card docks onto the hero only when it sits directly under it.
    const visible = cfg.order.filter((k) => cfg[k]?.show);
    const heroAt = visible.indexOf("hero");
    ctx.dock = cfg.facts.docked !== false && heroAt > -1 && visible[heroAt + 1] === "facts";

    const RENDER = {
      hero: () => this._hero(ctx),
      facts: () => this._factsStrip(ctx),
      speakers: () => this._speakersShell(ctx),
      about: () => this._about(ctx),
      themes: () => this._themes(ctx),
      program: () => this._program(ctx),
      cta: () => this._cta(ctx),
      more: () => this._more(ctx),
    };
    const html = visible.map((k) => RENDER[k]()).join("");
    const space = Math.max(20, Math.min(200, Number(cfg.sectionSpacing) || 100)) / 100;
    root.style.setProperty("--pk-space", String(space));

    root.classList.toggle("pk--bleed", cfg.fullBleed !== false);
    root.innerHTML = `<style>${kitCss()}${this._css(cfg)}</style>${html}`;
    this._bleedCleanup?.();
    this._bleedCleanup = cfg.fullBleed !== false ? applyFullBleed(root) : null;
    this._registerCleanup?.();
    this._registerCleanup = wireRegister(root, {
      mode: cfg.registerMode,
      // Cvent's header button usually carries the same text as ours.
      label: cfg.nativeRegisterLabel || P("hero", "primaryLabel", cfg.hero.primaryLabel),
      selector: cfg.nativeRegisterSelector,
      url: cfg.registerUrl,
    });
    this._mountVideo(root, cfg);
    this._carouselCleanup?.();
    this._carouselCleanup = null;
    this._mountSpeakers(root, ctx);
    this._startCountdown(root, ctx);
    release();
  }

  // ---- derived event facts (hero line, facts strip, CTA) -------------------
  _eventFacts({ eventInfo, sessions, speakers, eventTz }, lang) {
    const start = eventInfo.startDate;
    const end = eventInfo.endDate;
    const a = eventInfo.address || {};
    const venueName = eventInfo.location || "";
    const street = [a.address1, a.city].filter(Boolean).join(", ");
    const spk = Object.values(speakers);
    const companies = [...new Set(spk.map((s) => (s.company || "").trim()).filter(Boolean))];
    return {
      title: eventInfo.title || "",
      dateLong: fmtDate(start, eventTz, lang, { weekday: "long", month: "long", day: "numeric", year: "numeric" }),
      dateShort: fmtDate(start, eventTz, lang, { weekday: "long", month: "long", day: "numeric" }),
      dayMonth: fmtDate(start, eventTz, lang, { month: "long", day: "numeric" }),
      timeRange: fmtTimeRange(start, end, eventTz),
      tzShort: tzName(start, eventTz, "shortGeneric") || tzName(start, eventTz, "short"),
      tzLong: tzName(start, eventTz, "longGeneric") || tzName(start, eventTz, "long"),
      venueName,
      street,
      venueLine: [venueName, a.address1].filter(Boolean).join(", "),
      sessionCount: sessions.length,
      speakerCount: spk.length,
      companies,
      startMs: start ? new Date(start).getTime() : 0,
    };
  }

  // ---- HERO -----------------------------------------------------------------
  _hero({ cfg, lang, facts, P, dock }) {
    const h = cfg.hero;
    const words = (facts.title || "").trim().split(/\s+/);
    const strong = P("hero", "titleStrong", h.titleStrong) || (words.length > 1 ? words.slice(0, -1).join(" ") : facts.title);
    const light = P("hero", "titleLight", h.titleLight) || (words.length > 1 ? words[words.length - 1] : "");
    const lockup = h.logoUrl
      ? `<h1 class="hero-logo-h"><img class="hero-logo" src="${esc(safeUrl(h.logoUrl, ""))}" alt="${esc(P("hero", "logoAlt", h.logoAlt) || facts.title)}"></h1>`
      : `<h1 class="hero-title"><span class="hero-title-strong">${esc(strong)}</span>${light ? ` <span class="hero-title-light">${esc(light)}</span>` : ""}</h1>`;
    const factsLine = h.showFacts && (facts.dateLong || facts.venueLine)
      ? `<p class="hero-facts">${[facts.dateLong, facts.timeRange && `${facts.timeRange} ${facts.tzShort}`.trim(), facts.venueLine]
          .filter(Boolean).map((f) => `<span>${esc(f)}</span>`).join('<span class="hero-dot" aria-hidden="true"></span>')}</p>`
      : "";
    const lede = P("hero", "lede", h.lede);
    const btns = `<div class="hero-btns">
        ${cfg.registerMode === "url"
          ? button({ label: P("hero", "primaryLabel", h.primaryLabel), href: cfg.registerUrl, variant: "primary", ground: "dark", size: "lg", lang })
          : registerButton({ label: P("hero", "primaryLabel", h.primaryLabel), variant: "primary", ground: "dark", size: "lg" })}
        ${button({ label: P("hero", "secondaryLabel", h.secondaryLabel), href: h.secondaryUrl, variant: "secondary", ground: "dark", size: "lg", lang })}
      </div>`;
    const countdown = h.showCountdown && facts.startMs > Date.now()
      ? `<div class="hero-count" role="timer" aria-live="off">
          ${["d", "h", "m"].map((k) => `<div class="hero-count-cell"><span class="hero-count-n" data-cd="${k}">–</span><span class="hero-count-l">${esc(fixed(lang, k === "d" ? "days" : k === "h" ? "hours" : "mins"))}</span></div>`).join("")}
        </div>`
      : "";
    return `
    <section class="hero pk-bleed${dock ? " hero--dock" : ""}" aria-label="${esc(facts.title || strong)}">
      <div class="hero-media" data-video="${esc(safeUrl(h.videoUrl, ""))}" data-poster="${esc(safeUrl(h.posterUrl, ""))}"></div>
      <div class="hero-scrim" aria-hidden="true"></div>
      <div class="hero-inner">
        ${eyebrow(P("hero", "eyebrow", h.eyebrow), "pk-on-dark hero-eyebrow")}
        ${lockup}
        ${factsLine}
        ${lede ? `<p class="hero-lede">${esc(lede)}</p>` : ""}
        ${btns}
        ${countdown}
      </div>
    </section>`;
  }

  // Build the <video> with DOM APIs so muted/playsInline are real properties
  // (autoplay needs them) and reduced-motion users get the poster only.
  _mountVideo(root, cfg) {
    const media = root.querySelector(".hero-media");
    if (!media) return;
    const src = media.dataset.video;
    const poster = media.dataset.poster;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const status = (s) => { media.dataset.videoStatus = s; };
    if (poster) {
      const img = document.createElement("img");
      img.className = "hero-poster";
      img.src = poster;
      img.alt = "";
      media.append(img);
    }
    if (!src) { status(cfg.hero.videoUrl ? "rejected-url" : "none"); if (cfg.hero.videoUrl) console.warn("[home] hero video URL was rejected (must start with https://):", cfg.hero.videoUrl); return; }
    if (reduce) { status("reduced-motion"); return; }
    const v = document.createElement("video");
    v.className = "hero-video";
    // Muted + playsinline are what browsers require for autoplay: set both
    // as properties AND attributes before the source is attached.
    v.muted = true;
    v.defaultMuted = true;
    v.setAttribute("muted", "");
    v.autoplay = true;
    v.setAttribute("autoplay", "");
    v.loop = true;
    v.playsInline = true;
    v.setAttribute("playsinline", "");
    v.setAttribute("webkit-playsinline", "");
    v.preload = "auto";
    v.setAttribute("aria-hidden", "true");
    if (poster) v.poster = poster;
    const s = document.createElement("source");
    s.src = src;
    s.type = "video/mp4";
    v.append(s);
    status("loading");
    const tryPlay = () => {
      if (!v.isConnected) return;
      const p = v.play?.();
      if (p && p.then) p.then(() => status("playing")).catch((e) => {
        status(`blocked:${e?.name || "error"}`);
        console.warn("[home] hero video could not autoplay:", e?.name, e?.message);
      });
    };
    v.addEventListener("loadeddata", tryPlay, { once: true });
    v.addEventListener("playing", () => status("playing"));
    // A dead link (e.g. an expired or changed Vimeo file link) fires error on
    // the <source>, not the <video>.
    const onErr = () => {
      const code = v.error?.code;
      status(`error${code ? ":" + code : ""}`);
      console.warn(`[home] hero video failed to load (${code === 4 ? "file not found or not a playable MP4" : code ? "media error " + code : "network or access error"}). URL:`, src);
    };
    s.addEventListener("error", onErr);
    v.addEventListener("error", onErr);
    media.append(v);
    tryPlay();
    // Some browsers pause autoplaying video that starts off-screen; resume when visible.
    if (typeof IntersectionObserver !== "undefined") {
      const io = new IntersectionObserver((entries) => {
        if (!v.isConnected) { io.disconnect(); return; }
        if (entries.some((e) => e.isIntersecting) && v.paused) tryPlay();
      });
      io.observe(v);
    }
  }

  _startCountdown(root, { facts, lang }) {
    const cells = root.querySelectorAll("[data-cd]");
    if (!cells.length || !facts.startMs) return;
    const box = root.querySelector(".hero-count");
    const tick = () => {
      const ms = Math.max(0, facts.startMs - Date.now());
      const d = Math.floor(ms / 864e5);
      const h = Math.floor((ms % 864e5) / 36e5);
      const m = Math.floor((ms % 36e5) / 6e4);
      const v = { d: String(d), h: String(h).padStart(2, "0"), m: String(m).padStart(2, "0") };
      cells.forEach((c) => { c.textContent = v[c.dataset.cd]; });
      box?.setAttribute("aria-label", fixed(lang, "countdownAria", { d, h, m }));
      if (!ms) { box?.remove(); this._stopCountdown(); }
    };
    tick();
    this._timer = setInterval(tick, 30000);
  }
  _stopCountdown() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  }

  // ---- FACTS STRIP ----------------------------------------------------------
  _factsStrip({ cfg, lang, facts, P, dock }) {
    const f = cfg.facts;
    const cos = facts.companies;
    const autoSpkDetail = cos.length ? `${cos.slice(0, 3).join(", ")}${cos.length > 3 ? ` ${fixed(lang, "andMore")}` : ""}` : "";
    const cells = [
      [P("facts", "dateLabel", f.dateLabel), P("facts", "dateValue", f.dateValue) || facts.dateShort, P("facts", "dateDetail", f.dateDetail) || [facts.timeRange, facts.tzLong].filter(Boolean).join(" ")],
      [P("facts", "venueLabel", f.venueLabel), P("facts", "venueValue", f.venueValue) || facts.venueName, P("facts", "venueDetail", f.venueDetail) || facts.street],
      [P("facts", "programLabel", f.programLabel), P("facts", "programValue", f.programValue) || (facts.sessionCount ? fixed(lang, "sessions", { n: facts.sessionCount }) : ""), P("facts", "programDetail", f.programDetail)],
      f.showSpeakers ? [P("facts", "speakersLabel", f.speakersLabel), P("facts", "speakersValue", f.speakersValue) || (facts.speakerCount ? fixed(lang, "speakers", { n: facts.speakerCount }) : ""), P("facts", "speakersDetail", f.speakersDetail) || autoSpkDetail] : null,
    ].filter((c) => c && c[1]);
    if (!cells.length) return "";
    return `
    <section class="facts pk-bleed${dock ? " facts--docked" : ""}" aria-label="${esc(facts.title)}">
      <div class="pk-inner">
        <dl class="facts-grid" style="--cols:${cells.length}">
          ${cells.map(([l, v, d]) => `<div class="facts-cell"><dt class="pk-eyebrow">${esc(l)}</dt><dd class="facts-v">${esc(v)}</dd>${d ? `<dd class="facts-d">${esc(d)}</dd>` : ""}</div>`).join("")}
        </dl>
      </div>
    </section>`;
  }

  // ---- FEATURED SPEAKERS (cards mounted after innerHTML) --------------------
  _speakersShell({ cfg, lang, P }) {
    const s = cfg.speakers;
    if (s.layout !== "grid") {
      // Carousel (flagship default): the arrows replace the "See all" link.
      const arrows = `<div class="spk-nav" data-spk-nav hidden>
          <button type="button" class="spk-arrow" data-dir="-1" aria-controls="home-spk-track" aria-label="${esc(fixed(lang, "prevSpeakers"))}"><span aria-hidden="true">←</span></button>
          <button type="button" class="spk-arrow" data-dir="1" aria-controls="home-spk-track" aria-label="${esc(fixed(lang, "nextSpeakers"))}"><span aria-hidden="true">→</span></button>
        </div>`;
      return `
    <section class="pk-section pk-bleed pk-ground-white spk-sec--carousel" aria-labelledby="home-speakers-h">
      <div class="pk-inner">
        <div class="pk-head">${sectionHead({ eyebrowText: P("speakers", "eyebrow", s.eyebrow), heading: P("speakers", "heading", s.heading) }).replace('<h2 class="pk-h2"', `<h2 id="home-speakers-h" class="pk-h2 spk-h"${spkTitle(P("speakers", "heading", s.heading))}`)}${arrows}</div>
        <ul class="spk-grid spk-track" id="home-spk-track" role="list" data-speakers data-carousel></ul>
      </div>
    </section>`;
    }
    const link = arrowLink({ label: P("speakers", "linkLabel", s.linkLabel), href: s.linkUrl, lang });
    return `
    <section class="pk-section pk-bleed pk-ground-white" aria-labelledby="home-speakers-h">
      <div class="pk-inner">
        ${sectionHead({ eyebrowText: P("speakers", "eyebrow", s.eyebrow), heading: P("speakers", "heading", s.heading), link }).replace('<h2 class="pk-h2"', `<h2 id="home-speakers-h" class="pk-h2 spk-h"${spkTitle(P("speakers", "heading", s.heading))}`)}
        <ul class="spk-grid" role="list" data-speakers></ul>
        ${link ? `<div class="pk-only-mobile">${link}</div>` : ""}
      </div>
    </section>`;
  }

  // Carousel arrows: scroll one "page" of cards; hidden when everything fits,
  // each arrow disabled at its end. Swipe / trackpad / keyboard scroll natively.
  _wireCarousel(root) {
    const track = root.querySelector("[data-carousel]");
    const nav = root.querySelector("[data-spk-nav]");
    if (!track || !nav) return;
    const [prev, next] = nav.querySelectorAll(".spk-arrow");
    const update = () => {
      const max = track.scrollWidth - track.clientWidth;
      nav.hidden = max <= 2;
      prev.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft >= max - 2;
    };
    nav.addEventListener("click", (e) => {
      const b = e.target.closest(".spk-arrow");
      if (!b) return;
      const item = track.querySelector("li");
      const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
      const step = item ? item.getBoundingClientRect().width + gap : track.clientWidth;
      const perView = Math.max(1, Math.floor((track.clientWidth + gap) / step));
      track.scrollBy({ left: Number(b.dataset.dir) * perView * step, behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    });
    track.addEventListener("scroll", () => requestAnimationFrame(update), { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(track);
    this._carouselCleanup?.();
    this._carouselCleanup = () => ro?.disconnect();
    update();
    setTimeout(update, 300);
  }

  _mountSpeakers(root, { cfg, lang, sessions, speakers, getSpeakers, eventTz, P }) {
    const grid = root.querySelector("[data-speakers]");
    if (!grid) return;
    const ids = (cfg.speakers.featuredSpeakerIds || []).map(String);
    const carousel = cfg.speakers.layout !== "grid";
    if (carousel && cfg.speakers.includeAll !== false) {
      // Then everyone else, in the order they first appear in the program.
      sessions.filter((s) => !isHiddenSession(s)).forEach((s) => (s.speakers || []).forEach((sp) => {
        const id = String(sp?.id || sp?.speakerId || sp?.speaker?.id || "");
        if (id && !ids.includes(id)) ids.push(id);
      }));
    }
    const list = ids.map((id) => speakers[id]).filter(Boolean);
    if (!list.length) {
      grid.outerHTML = `<p class="pk-empty spk-empty">${esc(fixed(lang, "noSpeakers"))}</p>`;
      return;
    }
    const cardCfg = {
      ...pageCardBase(),           // blue hover, amber labels, company as text
      // Home page: names 18px, roles 15px in body grey (review rec 04).
      typography: (() => {
        const ty = speakerTypography();
        ty.speakerName = { ...ty.speakerName, fontSize: 18, fontSizeMd: 17, fontSizeSm: 15 };
        ty.speakerRole = { ...ty.speakerRole, fontSize: 15, fontSizeMd: 14, fontSizeSm: 13.5, color: TOKENS.body };
        return pageCardTypography(ty);
      })(),
      tileSize: 400,                // cards fill their grid column; the grid sets the width
      fontFamily: undefined,        // card default = brand stack
      allSessions: sessions.filter((s) => !isHiddenSession(s)),
      getSpeakers,
      eventTz,
      modalEyebrowText: P("speakers", "modalEyebrowText", cfg.speakers.modalEyebrowText),
      showSessions: cfg.speakers.showSessions !== false,
      sessionsHeaderText: P("speakers", "sessionsHeaderText", cfg.speakers.sessionsHeaderText),
      moderatorLabel: fixed(lang, "moderator"),
      // "Moderator" above the name, exactly as on the Speakers page. Every card
      // reserves the line when any moderator is in the row, so names align.
      cardEyebrow: cfg.speakers.showModeratorLabel !== false ? (sp) => (isModerator(sp, cfg.speakers) ? fixed(lang, "moderator") : "") : undefined,
      cardEyebrowReserve: cfg.speakers.showModeratorLabel !== false && list.some((sp) => isModerator(sp, cfg.speakers)),
    };
    list.forEach((sp) => {
      const li = document.createElement("li");
      const card = document.createElement(CARD_TAG);
      card.speaker = sp;          // props BEFORE append (Playbook §4)
      card.theme = this.theme || {};
      card.config = cardCfg;
      li.append(card);
      grid.append(li);
    });
    grid.dataset.count = String(list.length);
    if (carousel) this._wireCarousel(root);
  }

  // ---- ABOUT ----------------------------------------------------------------
  _about({ cfg, eventInfo, P }) {
    const a = cfg.about;
    // Planner copy wins; anything left blank comes from the Cvent event
    // description, split into body / list / list eyebrow (deriveAbout).
    const derived = deriveAbout(eventInfo.description);
    const ownBody = P("about", "body", a.body);
    const legacyTr = lines(P("about", "listItems", "")); // old one-per-line translation
    const own = (a.items || [])
      .map((it, i) => ({
        title: P("about", `items.${i}.title`, legacyTr[i] || it.title).trim(),
        description: P("about", `items.${i}.description`, it.description || ""),
        icon: it.icon || "",
      }))
      .filter((it) => it.title);
    const bodyText = ownBody || derived.body;
    const items = own.length ? own : ownBody ? [] : lines(derived.listItems).map((title) => ({ title, description: "", icon: "" }));
    const listEyebrow = P("about", "listEyebrow", a.listEyebrow) || (own.length ? "" : derived.listEyebrow);
    const heading = P("about", "heading", a.heading);
    const body = paragraphs(bodyText);
    const eyebrowText = P("about", "eyebrow", a.eyebrow);
    if (!body && !heading && !items.length) {
      return `
    <section class="pk-section pk-bleed pk-ground-tint" aria-label="${esc(eyebrowText || "About")}">
      <div class="pk-inner">${eyebrow(eyebrowText)}
        <div class="pk-placeholder"><strong>About section</strong>No event description found. Write the body in the widget settings, or switch this section off.</div>
      </div>
    </section>`;
    }
    // Items with a description expand (FAQ-style arrows, closed on load).
    const style = listStyleOf(a.listStyle);
    const tag = style === "numbered" ? "ol" : "ul";
    const row = (it, i) => {
      const mk = listMarker(style, i, it.icon);
      const desc = paragraphs(it.description);
      if (!desc) return `<li class="ai"><div class="ai-row">${mk}<span class="num-t">${esc(it.title)}</span></div></li>`;
      return `<li class="ai"><details class="ai-d">
          <summary class="ai-row">${mk}<span class="num-t">${esc(it.title)}</span><span class="ai-arrow" aria-hidden="true"></span></summary>
          <div class="ai-desc">${desc}</div>
        </details></li>`;
    };
    const list = items.length
      ? `<div class="about-list">
          ${eyebrow(listEyebrow)}
          <${tag} class="num-list num-list--${style}">${items.map(row).join("")}</${tag}>
        </div>`
      : "";
    return `
    <section class="pk-section pk-bleed pk-ground-tint" aria-label="${esc(heading || eyebrowText)}">
      <div class="pk-inner">
        <div class="about ${items.length ? "" : "about--single"} ${heading ? "" : "about--no-heading"}">
          <div class="about-eyebrow">${eyebrow(eyebrowText)}</div>
          <div class="about-main">
            ${heading ? `<h2 class="pk-h2 about-h">${esc(heading)}</h2>` : ""}
            <div class="pk-copy about-copy">${body}</div>
          </div>
          ${list}
        </div>
      </div>
    </section>`;
  }

  // Optional background photo for a dark section. The URL is validated
  // (safeUrl) and passed through a CSS custom property, never interpolated
  // raw into a stylesheet.
  _sectionBg(url, fx, fy, overlay) {
    const src = safeUrl(url, "");
    if (!src || src.startsWith("#")) return "";
    const clamp = (n, d, max = 100) => Math.max(0, Math.min(max, Number.isFinite(Number(n)) ? Number(n) : d));
    const cssUrl = src.replace(/["\\\n\r]/g, encodeURIComponent);
    return `<div class="sec-bg" aria-hidden="true" style="--sec-bg: url(&quot;${esc(cssUrl)}&quot;); --sec-bg-pos: ${clamp(fx, 50)}% ${clamp(fy, 50)}%"></div>
      <div class="sec-bg-shade" aria-hidden="true" style="--sec-bg-shade: ${clamp(overlay, 70, 90) / 100}"></div>`;
  }

  // ---- THEMES (dark inversion) ----------------------------------------------
  _themes({ cfg, P }) {
    const t = cfg.themes;
    const items = t.items
      .map((it, i) => ({ kicker: P("themes", `items.${i}.kicker`, it.kicker), title: P("themes", `items.${i}.title`, it.title), body: P("themes", `items.${i}.body`, it.body), icon: it.icon || "" }))
      .filter((it) => it.title || it.body);
    const style = listStyleOf(t.listStyle);
    // Numbered: the kicker replaces the number ("01"); bullets / icons sit
    // beside the kicker text, if any.
    const themeMarker = (st, i, it) => {
      if (st === "numbered") return `<p class="theme-kicker">${esc(it.kicker || String(i + 1).padStart(2, "0"))}</p>`;
      const mk = st === "icons" ? `<span class="mk mk--icon">${iconSvg(it.icon)}</span>` : '<span class="mk mk--dot" aria-hidden="true"></span>';
      return `<p class="theme-kicker theme-kicker--${st}">${mk}${it.kicker ? `<span>${esc(it.kicker)}</span>` : ""}</p>`;
    };
    if (!items.length) {
      return `
    <section class="pk-section pk-bleed pk-ground-dark sec-has-bg" aria-label="${esc(t.heading || t.eyebrow || "Themes")}">
      ${this._sectionBg(t.bgImageUrl, t.bgFocalX, t.bgFocalY, t.bgOverlay)}
      <div class="pk-inner">
        ${sectionHead({ eyebrowText: P("themes", "eyebrow", t.eyebrow), heading: P("themes", "heading", t.heading) })}
        <div class="pk-placeholder"><strong>Themes section</strong>Add up to three themes (a title and a short description each) in the widget settings, or switch this section off.</div>
      </div>
    </section>`;
    }
    return `
    <section class="pk-section pk-bleed pk-ground-dark sec-has-bg ${safeUrl(t.bgImageUrl, "") ? "sec-photo" : ""}" aria-label="${esc(t.heading || t.eyebrow)}">
      ${this._sectionBg(t.bgImageUrl, t.bgFocalX, t.bgFocalY, t.bgOverlay)}
      <div class="pk-inner">
        ${sectionHead({ eyebrowText: P("themes", "eyebrow", t.eyebrow), heading: P("themes", "heading", t.heading) })}
        <div class="themes-grid" style="--cols:${items.length}">
          ${items.map((it, i) => `
            <article class="theme-card">
              ${themeMarker(style, i, it)}
              ${it.title ? `<h3 class="theme-title">${esc(it.title)}</h3>` : ""}
              ${it.body ? `<p class="theme-body">${esc(it.body)}</p>` : ""}
            </article>`).join("")}
        </div>
      </div>
    </section>`;
  }

  // ---- PROGRAM HIGHLIGHTS ---------------------------------------------------
  _pickSessions(cfg, sessions) {
    const p = cfg.program;
    const limit = Math.max(1, Math.min(12, Number(p.limit) || 5));
    const byTime = sessions.filter((s) => !isHiddenSession(s)).sort((a, b) => new Date(a.startDateTime) - new Date(b.startDateTime));
    const picked = (p.sessionIds || []).map(String);
    if (p.source === "picked" && picked.length) return byTime.filter((s) => picked.includes(String(s.id))).slice(0, limit);
    const featured = byTime.filter((s) => s.isFeatured);
    if (featured.length) return featured.slice(0, limit);
    if (picked.length) return byTime.filter((s) => picked.includes(String(s.id))).slice(0, limit);
    return byTime.filter((s) => (s.speakers || []).length).slice(0, limit);
  }

  _speakerLine(session, speakers, lang) {
    const list = (session.speakers || []).map((sp) => speakers[String(sp?.id || sp?.speakerId)] || sp).filter(Boolean);
    if (!list.length) return "";
    const name = (s) => [s.firstName, s.lastName].filter(Boolean).join(" ");
    if (list.length === 1) return [name(list[0]), list[0].title, list[0].company].filter(Boolean).join(", ");
    const cos = [...new Set(list.map((s) => (s.company || "").trim()).filter(Boolean))];
    return cos.length ? cos.join(", ") : list.map(name).join(", ");
  }

  _program({ cfg, lang, sessions, speakers, eventTz, P }) {
    const p = cfg.program;
    const rows = this._pickSessions(cfg, sessions);
    if (!rows.length) return "";
    const link = arrowLink({ label: P("program", "linkLabel", p.linkLabel), href: p.linkUrl, lang });
    return `
    <section class="pk-section pk-bleed pk-ground-white" aria-label="${esc(p.heading || p.eyebrow)}">
      <div class="pk-inner">
        ${sectionHead({ eyebrowText: P("program", "eyebrow", p.eyebrow), heading: P("program", "heading", p.heading), link })}
        <ol class="prog" role="list">
          ${rows.map((s) => {
            const who = this._speakerLine(s, speakers, lang) || (s.endDateTime ? fixed(lang, "until", { t: fmtTime(s.endDateTime, eventTz) }) : "");
            const url = safeUrl(p.linkUrl, "");
            const inner = `
              <span class="prog-time">${esc(fmtTime(s.startDateTime, eventTz))}</span>
              <span class="prog-title">${esc(s.name || "")}</span>
              <span class="prog-who">${esc(who)}</span>
              ${url ? '<span class="prog-go" aria-hidden="true">→</span>' : ""}`;
            return `<li>${url ? `<a class="prog-row" href="${esc(url)}">${inner}</a>` : `<div class="prog-row">${inner}</div>`}</li>`;
          }).join("")}
        </ol>
        ${link ? `<div class="pk-only-mobile">${link}</div>` : ""}
      </div>
    </section>`;
  }

  // ---- REQUEST TO ATTEND PANEL ----------------------------------------------
  // Same band, same default copy as every inner page (flagship review).
  _cta({ cfg, lang, P, eventInfo, sessions, speakers, eventTz }) {
    const facts = eventFacts({ eventInfo, sessions, speakers, eventTz }, lang);
    return regBand(closingBandCopy({ cfg, lang, facts, P }));
  }

  // ---- MORE FROM BLOOMBERG ---------------------------------------------------
  _more({ cfg, lang, P }) {
    const m = cfg.more;
    const layout = ["cards", "tiles", "list"].includes(m.layout) ? m.layout : "cards";
    const items = m.items
      .map((it, i) => ({
        title: P("more", `items.${i}.title`, it.title),
        body: P("more", `items.${i}.body`, it.body),
        linkLabel: cleanLabel(P("more", `items.${i}.linkLabel`, it.linkLabel)),
        url: safeUrl(it.url, ""),
        img: safeUrl(it.imageUrl, ""),
      }))
      .filter((it) => it.title);
    const hasBg = !!safeUrl(m.bgImageUrl, "") && !safeUrl(m.bgImageUrl, "").startsWith("#");
    const ground = hasBg ? "pk-ground-dark sec-has-bg sec-photo" : "pk-ground-white pk-rule-top";
    const heading = P("more", "heading", m.heading);
    const intro = P("more", "intro", m.intro);
    const head = `${sectionHead({ eyebrowText: P("more", "eyebrow", m.eyebrow), heading })}${intro ? `<p class="more-intro">${esc(intro)}</p>` : ""}`;
    const open = `<section class="pk-section pk-bleed ${ground} more more--${layout} ${heading ? "" : "more--no-heading"}" aria-label="${esc(heading || m.eyebrow || "More")}">
      ${hasBg ? this._sectionBg(m.bgImageUrl, m.bgFocalX, m.bgFocalY, m.bgOverlay) : ""}
      <div class="pk-inner">${head}`;
    if (!items.length) {
      return `${open}
        <div class="pk-placeholder"><strong>More from Bloomberg</strong>Add up to three links (title, text, link label, URL and an optional image) in the widget settings, or switch this section off.</div>
      </div></section>`;
    }
    const arrow = (it) => it.linkLabel
      ? `<span class="pk-arrow pk-arrow--on-${layout === "tiles" ? "dark" : hasBg && layout === "list" ? "dark" : "light"} more-cta">${esc(it.linkLabel)}<span aria-hidden="true">${isExternal(it.url) ? "↗" : "→"}</span></span>`
      : "";
    // The whole card/tile is one link (one tab stop); the visible "arrow link"
    // inside is text, so there is never a link inside a link.
    const wrap = (it, inner, cls) => {
      const ext = isExternal(it.url);
      return it.url
        ? `<a class="${cls}" href="${esc(it.url)}"${ext ? ' target="_blank" rel="noopener"' : ""}>${inner}${ext ? `<span class="pk-sr"> ${esc(fixed(lang, "opensNewTab"))}</span>` : ""}</a>`
        : `<div class="${cls}">${inner}</div>`;
    };
    const img = (it, cls) => it.img ? `<div class="${cls}"><img src="${esc(it.img)}" alt="" loading="lazy"></div>` : "";
    const body = items.map((it) => {
      if (layout === "tiles") {
        return `<li>${wrap(it, `${img(it, "more-tile-img")}<div class="more-tile-shade" aria-hidden="true"></div>
          <div class="more-tile-body"><h3 class="more-title">${esc(it.title)}</h3>${it.body ? `<p class="more-body">${esc(it.body)}</p>` : ""}${arrow(it)}</div>`, `more-tile ${it.img ? "" : "more-tile--noimg"}`)}</li>`;
      }
      if (layout === "list") {
        return `<li>${wrap(it, `<h3 class="more-title">${esc(it.title)}</h3>${it.body ? `<p class="more-body">${esc(it.body)}</p>` : ""}${arrow(it)}`, "more-item")}</li>`;
      }
      return `<li>${wrap(it, `${img(it, "more-card-img")}<div class="more-card-body"><h3 class="more-title">${esc(it.title)}</h3>${it.body ? `<p class="more-body">${esc(it.body)}</p>` : ""}${arrow(it)}</div>`, "more-card")}</li>`;
    }).join("");
    return `${open}
        <ul class="more-grid" role="list" style="--cols:${items.length}">${body}</ul>
      </div>
    </section>`;
  }

  // =========================================================================
  // HOME-SPECIFIC CSS (the shared kit CSS comes from page-kit.js)
  // =========================================================================
  _css(cfg) {
    const t = TOKENS;
    const h = cfg.hero;
    const hero = TYPE_SCALE.hero || { fontSize: 68, fontSizeMd: 52, fontSizeSm: 40 };
    const pct = (n, d) => Math.max(0, Math.min(100, Number.isFinite(Number(n)) ? Number(n) : d));
    const num = (n, d, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(Number(n)) && String(n).trim() !== "" ? Number(n) : d));
    // Logo size + spacing (planner controls). The hero's flex gap is 22px /
    // 18px on mobile; the logo's own margin adds (or, negative, removes) the
    // difference so "space under the logo" means exactly that.
    const lw = num(h.logoWidth, 960, 120, 1800);
    const lwT = num(h.logoWidthTablet, 720, 120, 1400);
    const lwM = num(h.logoWidthMobile, 100, 30, 160);
    const gap = num(h.logoGap, 22, -200, 240);
    const gapM = num(h.logoGapMobile, 18, -200, 240);
    const gapT = num(h.logoGapTablet, gap, -200, 240);
    const scrim = (n, d) => Math.max(0, Math.min(80, Number.isFinite(Number(n)) ? Number(n) : d)) / 100;
    return `
    /* HERO — raw video + text shadow (design system); scrim on mobile */
    .hero { position: relative; overflow: hidden; background: ${t.deep}; color: #fff;
      min-height: 680px; display: flex; align-items: center; justify-content: center; }
    .hero-media, .hero-scrim { position: absolute; inset: 0; }
    .hero-poster, .hero-video { position: absolute; inset: 0; width: 100%; height: 100%;
      object-fit: cover; object-position: ${pct(h.focalX, 50)}% top; display: block; }
    .hero-scrim { background: rgba(11,11,12,${scrim(h.scrimDesktop, 0)}); }
    .hero-inner { position: relative; z-index: 1; width: 100%; max-width: ${Math.max(960, lw)}px; margin: 0 auto;
      padding: 72px clamp(20px, 4vw, 48px); display: flex; flex-direction: column; align-items: center;
      text-align: center; gap: 22px;
      text-shadow: 0 1px 2px rgba(0,0,0,.65), 0 0 18px rgba(0,0,0,.45), 0 0 42px rgba(0,0,0,.35); }
    .hero .pk-eyebrow { margin: 0; color: ${t.amber}; }
    .hero-title { font-size: ${hero.fontSize}px; line-height: 1.04; letter-spacing: -0.02em; color: #fff; }
    .hero-title-strong { font-weight: 600; }
    .hero-title-light { font-weight: 400; }
    .hero-logo-h { line-height: 0; margin-bottom: ${gap - 22}px; display: flex; justify-content: center; width: 100%; }
    /* Up to 130% of the content width, so a PNG's transparent padding can
       overflow (the hero clips it) while the visible lockup reaches the size set. */
    .hero-logo { display: block; flex-shrink: 0; width: min(${lw}px, 130%); max-width: none; height: auto; }
    .hero-facts { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 6px 14px;
      font-size: 16px; font-weight: 500; color: #fff; }
    .hero-dot { width: 5px; height: 5px; border-radius: 50%; background: ${t.amberOnDark}; flex-shrink: 0; }
    .hero-lede { max-width: 620px; font-size: 17px; line-height: 1.45; color: rgba(255,255,255,.85); }
    .hero-btns { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; text-shadow: none; }
    .hero-count { display: flex; gap: 8px; padding-top: 16px; border-top: 1px solid ${t.onDarkHair}; }
    .hero-count-cell { display: flex; flex-direction: column; align-items: center; min-width: 60px; }
    .hero-count-n { font-size: 22px; font-weight: 600; font-variant-numeric: tabular-nums; }
    .hero-count-l { font-size: 10px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: ${t.onDarkFaint}; }
    .hero :focus-visible { outline-color: ${t.focusOnPhoto}; }

    /* FACTS STRIP */
    .facts { background: #fff; border-bottom: 1px solid ${t.hair}; }
    .facts-grid { display: grid; grid-template-columns: repeat(var(--cols, 4), minmax(0, 1fr)); margin: 0; border-left: 1px solid ${t.hair}; }
    .facts-cell { padding: 28px; border-right: 1px solid ${t.hair}; display: flex; flex-direction: column; gap: 4px; }
    .facts-cell .pk-eyebrow { margin: 0 0 4px; font-size: ${LABEL_PX.small}px; color: ${t.amber}; }
    .facts-v { margin: 0; font-size: 20px; font-weight: 700; }
    .facts-d { margin: 0; font-size: 15px; color: ${t.body}; }
    /* Docked: the strip becomes a card overlapping the bottom of the hero. */
    .hero--dock .hero-inner { padding-bottom: 136px; }
    .facts--docked { background: transparent; border-bottom: 0; position: relative; z-index: 2; margin-top: -64px; }
    .facts--docked .facts-grid { background: #fff; border-top: 3px solid ${t.amberOnDark}; box-shadow: 0 22px 48px rgba(11,11,12,.18); }

    /* SPEAKERS */
    .spk-grid { list-style: none; margin: 48px 0 0; padding: 0; display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 40px 32px; }
    .spk-grid > li { min-width: 0; }
    .spk-empty { margin-top: 32px; }
    /* Carousel: 4 cards in view (3 tablet, ~1.6 phone so the next one peeks) */
    .spk-sec--carousel .pk-head { align-items: flex-end; }
    /* Heading on one line at every size (SPEAKER_HEADING_MAX characters). */
    .spk-h { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: none; }
    .pk-head .pk-head-text { min-width: 0; }
    .spk-track { grid-template-columns: none; grid-auto-flow: column; grid-auto-columns: calc((100% - 3 * 32px) / 4);
      overflow-x: auto; overscroll-behavior-x: contain; scroll-snap-type: x mandatory; scroll-behavior: smooth;
      scrollbar-width: none; padding-bottom: 4px; }
    .spk-track::-webkit-scrollbar { display: none; }
    .spk-track > li { scroll-snap-align: start; }
    .spk-nav { display: flex; gap: 8px; flex-shrink: 0; }
    .spk-nav[hidden] { display: none; }
    .spk-arrow { font-family: inherit; width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center;
      border: 1px solid ${t.action}; border-radius: 2px; background: #fff; color: ${t.action}; font-size: 18px; font-weight: 700; cursor: pointer;
      transition: background-color .15s ease, color .15s ease, opacity .15s ease; }
    .spk-arrow:hover:not(:disabled) { background: ${t.action}; color: #fff; }
    .spk-arrow:disabled { border-color: ${t.hair}; color: ${t.faint}; cursor: default; }

    /* ABOUT — eyebrow alone in row 1 so heading + list start on one line */
    .about { display: grid; grid-template-columns: .87fr 1.13fr; column-gap: clamp(36px, 8vw, 125px); }
    .about-eyebrow { grid-column: 1 / -1; }
    .about--single { grid-template-columns: minmax(0, 1fr); max-width: 820px; }
    .about-h { margin-bottom: 24px; }
    .about-list .pk-eyebrow { margin-top: 10px; }
    /* No heading: the list label lines up with the first line of the body. */
    .about--no-heading .about-list .pk-eyebrow { margin-top: 0; }
    .num-list { list-style: none; margin: 0; padding: 0; border-bottom: 1px solid ${t.hair}; }
    .num-list > li { border-top: 1px solid ${t.hair}; }
    .ai-row { display: grid; grid-template-columns: 48px minmax(0, 1fr); gap: 12px; align-items: baseline; padding: 20px 0; }
    .num-t { font-size: 18px; line-height: 1.4; font-weight: 600; }
    /* Markers: numbers, bullets or icons (decorative; the list itself is the
       semantics). Bullets and icons are centred on the title's first line. */
    .mk { display: inline-flex; align-items: center; color: ${t.ink}; }
    .mk--num { font-size: 14px; font-weight: 700; color: ${t.faint}; font-variant-numeric: tabular-nums; }
    .num-list--bullets .ai-row, .num-list--icons .ai-row { grid-template-columns: 28px minmax(0, 1fr); align-items: start; }
    .num-list--bullets .ai-row { grid-template-columns: 20px minmax(0, 1fr); }
    .mk--dot { height: 1.4em; font-size: 18px; }
    .mk--dot::before { content: ""; width: 7px; height: 7px; background: ${t.amber}; }
    .mk--icon { height: calc(18px * 1.4); }
    .mk-ico { width: 24px; height: 24px; display: block; }
    /* Expandable items: same arrows as the Contact page FAQ, closed on load. */
    .ai-d > summary { list-style: none; cursor: pointer; }
    .ai-d > summary::-webkit-details-marker { display: none; }
    .ai-d > summary.ai-row { grid-template-columns: 48px minmax(0, 1fr) auto; }
    .num-list--bullets .ai-d > summary.ai-row { grid-template-columns: 20px minmax(0, 1fr) auto; }
    .num-list--icons .ai-d > summary.ai-row { grid-template-columns: 28px minmax(0, 1fr) auto; }
    .ai-d > summary:hover .num-t { color: ${t.action}; }
    .ai-arrow::before { content: "↓"; color: ${t.action}; font-weight: 700; font-size: 18px; }
    .ai-d[open] .ai-arrow::before { content: "↑"; }
    .ai-desc { padding: 0 32px 22px 60px; font-size: 15.5px; line-height: 1.6; color: ${t.body}; }
    .num-list--bullets .ai-desc { padding-left: 32px; }
    .num-list--icons .ai-desc { padding-left: 40px; }
    .ai-desc p + p { margin-top: 10px; }

    /* SECTION BACKGROUND PHOTO (themes) */
    .sec-has-bg { position: relative; overflow: hidden; isolation: isolate; }
    .sec-has-bg > .pk-inner { position: relative; z-index: 1; }
    .sec-bg { position: absolute; inset: 0; z-index: 0; background-image: var(--sec-bg); background-size: cover; background-position: var(--sec-bg-pos, 50% 50%); background-repeat: no-repeat; }
    .sec-bg-shade { position: absolute; inset: 0; z-index: 0; background: rgba(11,11,12,var(--sec-bg-shade, .7)); }
    /* On a photo the cards stay near-opaque so body copy keeps its contrast. */
    .sec-photo .theme-card { background: rgba(23,24,28,.9); }

    /* THEMES */
    .themes-grid { margin-top: 48px; display: grid; grid-template-columns: repeat(var(--cols, 3), minmax(0, 1fr)); gap: 24px; }
    .theme-card { background: ${t.panel}; border: 1px solid ${t.onDarkHair}; border-radius: 2px; padding: 36px; display: flex; flex-direction: column; gap: 14px; }
    .theme-kicker { font-size: ${LABEL_PX.small}px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: ${t.amber}; }
    .theme-kicker--bullets, .theme-kicker--icons { display: flex; align-items: center; gap: 12px; min-height: 20px; }
    .theme-kicker .mk { color: ${t.amber}; }
    .theme-kicker .mk--dot { height: auto; font-size: inherit; }
    .theme-kicker .mk--icon { height: auto; }
    .theme-kicker .mk-ico { width: 32px; height: 32px; }
    .theme-title { font-size: 22px; line-height: 1.25; font-weight: 700; color: #fff; }
    .theme-body { font-size: 15.5px; line-height: 1.6; color: rgba(255,255,255,.82); }

    /* PROGRAM */
    .prog { list-style: none; margin: 40px 0 0; padding: 0; border-bottom: 1px solid ${t.hair}; }
    .prog-row { display: grid; grid-template-columns: 140px minmax(0, 1fr) minmax(0, .8fr) 24px; gap: 24px; align-items: center;
      padding: 24px 0; border-top: 1px solid ${t.hair}; text-decoration: none; color: ${t.ink}; }
    a.prog-row:hover .prog-title { color: ${t.action}; }
    .prog-time { font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; }
    .prog-title { font-size: 21px; line-height: 1.3; font-weight: 700; letter-spacing: -0.01em; transition: color .15s ease; }
    .prog-who { font-size: 15px; color: ${t.body}; }
    .prog-go { color: ${t.action}; font-weight: 700; }

    /* MORE — three layouts share the grid, heading and link treatment */
    .more-intro { margin-top: 14px; max-width: 72ch; font-size: 18px; line-height: 1.5; color: ${t.body}; }
    .pk-ground-dark .more-intro { color: ${t.onDark}; }
    .more-grid { list-style: none; margin: 32px 0 0; padding: 0; display: grid; grid-template-columns: repeat(var(--cols, 3), minmax(0, 1fr)); gap: 24px; }
    .more--no-heading .more-grid { margin-top: 12px; }
    .more-grid > li { min-width: 0; display: flex; }
    .more-grid > li > * { flex: 1; }
    .more-title { font-size: 19px; line-height: 1.3; font-weight: 700; letter-spacing: -0.01em; }
    .more-body { font-size: 15.5px; line-height: 1.55; color: ${t.body}; }
    .more-cta { margin-top: auto; padding-top: 6px; }
    a.more-card, a.more-tile, a.more-item { text-decoration: none; }
    a.more-tile { color: #fff; }
    a.more-item { color: inherit; }
    /* Cards are always white, so their text is always ink, even on a dark photo section. */
    .more-card, a.more-card, .pk-ground-dark .more-card { color: ${t.ink}; }
    .more-card .more-title { color: ${t.ink}; }
    .more-card .more-body { color: ${t.body}; }
    a.more-card:hover .more-cta, a.more-item:hover .more-cta, a.more-tile:hover .more-cta { gap: 11px; }

    /* cards: image on top, white card (works on white or on a photo) */
    .more-card { display: flex; flex-direction: column; background: #fff; border: 1px solid ${t.hair}; border-radius: 2px; overflow: hidden; color: ${t.ink};
      transition: transform .18s cubic-bezier(.2,0,.2,1), box-shadow .18s cubic-bezier(.2,0,.2,1), border-color .15s ease; }
    .more-card-img { aspect-ratio: 16 / 9; background: ${t.placeholder}; overflow: hidden; }
    .more-card-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .more-card-body { flex: 1; display: flex; flex-direction: column; gap: 8px; padding: 22px 24px 24px; }
    .sec-photo .more-card { border-color: transparent; }
    @media (hover: hover) and (pointer: fine) {
      a.more-card:hover { transform: translateY(-3px); box-shadow: 0 10px 30px rgba(0,0,0,.10); border-color: #cfcfca; }
    }

    /* tiles: text over the image, dark shade for contrast */
    .more-tile { position: relative; display: flex; flex-direction: column; justify-content: flex-end; min-height: 300px; overflow: hidden; border-radius: 2px; background: ${t.panel}; color: #fff; isolation: isolate; }
    .more-tile-img { position: absolute; inset: 0; z-index: -2; }
    .more-tile-img img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .4s cubic-bezier(.2,0,.2,1); }
    .more-tile-shade { position: absolute; inset: 0; z-index: -1; background: linear-gradient(180deg, rgba(11,11,12,.15) 0%, rgba(11,11,12,.55) 45%, rgba(11,11,12,.92) 100%); }
    .more-tile--noimg .more-tile-shade { display: none; }
    .more-tile--noimg { border: 1px solid ${t.onDarkHair}; }
    .more-tile-body { display: flex; flex-direction: column; gap: 8px; padding: 28px; }
    .more-tile .more-title { color: #fff; }
    .more-tile .more-body { color: rgba(255,255,255,.82); }
    @media (hover: hover) and (pointer: fine) { a.more-tile:hover .more-tile-img img { transform: scale(1.04); } }

    /* list: text columns, hairline on top */
    .more-item { display: flex; flex-direction: column; gap: 8px; padding-top: 20px; border-top: 1px solid ${t.hair}; color: ${t.ink}; }
    .pk-ground-dark .more-item { border-top-color: ${t.onDarkHair}; color: #fff; }
    .pk-ground-dark .more-item .more-body { color: ${t.onDark}; }

    /* ≤1024 */
    @media (max-width: 1024px) {
      .hero { min-height: 560px; }
      .hero-title { font-size: ${hero.fontSizeMd}px; }
      .hero-inner { max-width: ${Math.max(960, lwT)}px; }
      .hero-logo { width: min(${lwT}px, 130%); }
      .hero-logo-h { margin-bottom: ${gapT - 22}px; }
      .facts-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .facts-cell { border-bottom: 1px solid ${t.hair}; }
      .spk-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 32px 24px; }
      .spk-track { grid-template-columns: none; grid-auto-columns: calc((100% - 2 * 24px) / 3); }
      .about { grid-template-columns: minmax(0, 1fr); }
      .about-list { margin-top: 40px; }
      .themes-grid { grid-template-columns: minmax(0, 1fr); }
      .prog-row { grid-template-columns: 110px minmax(0, 1fr) 20px; }
      .prog-who { grid-column: 2; }
      .prog-go { grid-column: 3; grid-row: 1; }
    }
    /* ≤600 */
    @media (max-width: 600px) {
      .hero { min-height: 620px; }
      .hero-poster, .hero-video { object-position: ${pct(h.focalXMobile, 65)}% top; }
      .hero-scrim { background: rgba(11,11,12,${scrim(h.scrimMobile, 45)}); }
      .hero-inner { gap: 18px; padding: 56px 20px; }
      .hero-title { font-size: ${hero.fontSizeSm}px; }
      .hero-logo { width: ${lwM}%; }
      .hero-logo-h { margin-bottom: ${gapM - 18}px; }
      .hero--dock .hero-inner { padding-bottom: 104px; }
      .facts--docked { margin-top: -48px; }
      .hero-facts { flex-direction: column; gap: 4px; font-size: 15px; }
      .hero-dot { display: none; }
      .hero-lede { font-size: 15px; }
      .hero-btns { flex-direction: column; width: 100%; }
      .hero-btns .pk-btn { width: 100%; }
      .facts-grid { grid-template-columns: minmax(0, 1fr); border-left: 0; }
      .facts-cell { padding: 18px 0; border-right: 0; }
      .facts--docked .facts-cell { padding: 18px 20px; }
      .spk-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px 16px; margin-top: 28px; }
      .spk-track { grid-template-columns: none; grid-auto-columns: 62%; }
      .spk-sec--carousel .pk-head { flex-wrap: wrap; gap: 16px; }
      .spk-sec--carousel .pk-head-text { flex: 1 1 100%; }
      /* 24 characters at 0.55em need ~13.2em: shrink a little on narrow phones. */
      .spk-h { font-size: min(28px, calc((100vw - 40px) / 13.2)); }
      .num-t { font-size: 16px; }
      .mk--dot { font-size: 16px; }
      .mk--icon { height: calc(16px * 1.4); }
      .mk-ico { width: 22px; height: 22px; }
      .ai-row { padding: 16px 0; }
      .ai-desc { font-size: 15px; }
      .themes-grid { margin-top: 28px; gap: 16px; }
      .theme-card { padding: 28px; }
      .theme-title { font-size: 20px; }
      .prog { margin-top: 24px; }
      .prog-row { grid-template-columns: 72px minmax(0, 1fr); gap: 12px; padding: 18px 0; align-items: start; }
      .prog-title { font-size: 16px; }
      .prog-who { grid-column: 2; font-size: 13.5px; }
      .prog-go { display: none; }
      .more-grid { grid-template-columns: minmax(0, 1fr); gap: 16px; margin-top: 24px; }
      .more--list .more-grid { gap: 0; }
      .more--list .more-item { padding: 20px 0; }
      .more-tile { min-height: 240px; }
      .more-card-body { padding: 18px 20px 20px; }
    }
    `;
  }
}
