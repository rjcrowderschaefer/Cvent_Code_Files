// widget.js — Speakers PAGE widget (Bloomberg Live event sites).
//
// Renders the whole Speakers page body:
//   dark banner · featured speakers · all speakers · "Request to attend" band
// Speakers are LIVE event data: everyone assigned to at least one session
// (the SDK has no "all speakers" call), full records from getSpeakers().
//   - featured      = planner-picked, in the planner's order
//   - all speakers  = everyone else (auto), or planner-picked; A–Z by last
//                     name, first name, or event order; planner can hide people
// Cards + bio pop-up are the shared FeaturedSpeaker component (same as Home).
// Shared building blocks: page-kit.js. NOTE: include the file extension in imports.
import { FeaturedSpeaker, defaultTypography as speakerTypography } from "./FeaturedSpeaker.js";
import { PageWidget, PAGE_BASE_DEFAULTS, mergePageConfig, TOKENS, esc, fixed, eyebrow, isHiddenSession } from "./page-kit.js";

const CARD_TAG = "bbg-speakers-page-card";
export const BUILD = "speakers-2026-09-26e";

export const SECTION_LABELS = {
  banner: "Page banner",
  featured: "Featured speakers",
  all: "All speakers",
  cta: "Request to attend band",
};

export const SPEAKERS_DEFAULTS = {
  ...PAGE_BASE_DEFAULTS,
  order: ["banner", "featured", "all", "cta"],
  featured: {
    show: true,
    eyebrow: "Featured",
    heading: "",
    speakerIds: [],
    columns: 3,
  },
  all: {
    show: true,
    eyebrow: "Speakers",
    heading: "",
    source: "auto",          // "auto" = every speaker on a session | "picked" = speakerIds only
    speakerIds: [],          // picked list (source "picked"), in order
    hiddenIds: [],           // never shown (source "auto")
    excludeFeatured: true,   // featured speakers are not repeated here
    // "first-house-last" = A–Z by first name; moderators after the others;
    //                      speakers from houseCompany (Bloomberg) always last
    // "last" | "first" = A–Z by last / first name
    // "event"          = order of first appearance in the program
    // "custom"         = customOrder (set in the editor); anyone new goes at the end, A–Z by first name
    sort: "last",
    customOrder: [],
    houseCompany: "Bloomberg",
    // Moderators: speakers in these Cvent speaker categories get a label above
    // their name on the card (and "Moderator" in the bio pop-up).
    moderatorCategories: "Moderator, Moderators",
    moderatorLabel: "",      // blank = "Moderator" in the visitor’s language
    showModeratorLabel: true,
    columns: 3,
    showMore: true,
    moreText: "",            // blank = "More speakers to be announced."
  },
  bios: {
    modalEyebrowText: "",     // blank = "Speaker" in the visitor’s language (moderators get "Moderator")
    showSessions: true,
    sessionsHeaderText: "",   // blank = "Sessions" / "Session" in the visitor’s language
    sessionHeaderText: "",
    hoverPrompt: "View bio",
  },
};

export function mergeSpeakersConfig(incoming = {}) {
  return mergePageConfig(SPEAKERS_DEFAULTS, incoming);
}

const clampCols = (n) => Math.max(2, Math.min(4, Number(n) || 3));
const norm = (v) => String(v ?? "").trim().toLowerCase();
const fullKey = (sp, first) => (first ? [sp.firstName, sp.lastName] : [sp.lastName, sp.firstName]).filter(Boolean).join(" ").toLowerCase();

export const isModerator = (sp, cfgAll) => String(cfgAll.moderatorCategories || "").split(",").map(norm).filter(Boolean)
  .includes(norm(sp?.category?.name || sp?.categoryName || ""));
export const isHouse = (sp, cfgAll) => !!norm(cfgAll.houseCompany) && norm(sp?.company).includes(norm(cfgAll.houseCompany));

// Order the "all speakers" list (used by the widget AND the editor's
// custom-order list, so both always agree).
export function orderSpeakers(list, a) {
  const out = [...list];
  const byFirst = (x, y) => fullKey(x, true).localeCompare(fullKey(y, true));
  if (a.sort === "event") return out;
  if (a.sort === "first") return out.sort(byFirst);
  if (a.sort === "first-house-last") {
    const rank = (sp) => (isHouse(sp, a) ? 2 : isModerator(sp, a) ? 1 : 0);
    return out.sort((x, y) => rank(x) - rank(y) || byFirst(x, y));
  }
  if (a.sort === "custom") {
    const pos = new Map((a.customOrder || []).map((id, i) => [String(id), i]));
    const at = (sp) => (pos.has(String(sp.id)) ? pos.get(String(sp.id)) : Infinity);
    return out.sort((x, y) => at(x) - at(y) || byFirst(x, y));
  }
  return out.sort((x, y) => fullKey(x, false).localeCompare(fullKey(y, false)));
}

export default class extends PageWidget {
  constructor(args) {
    super(args);
    if (!customElements.get(CARD_TAG)) customElements.define(CARD_TAG, FeaturedSpeaker);
  }

  get tag() { return "speakers"; }
  get build() { return BUILD; }
  merge(cfg) { return mergeSpeakersConfig(cfg); }
  needs() { return { sessions: true, speakers: true }; }

  bannerDefaults() {
    return { title: "Speakers", intro: "" };
  }

  // Resolve the two lists once per render.
  _lists({ cfg, speakers, speakerOrder }) {
    const visible = (sp) => sp && sp.displayOnWebsite !== false;
    const featured = cfg.featured.show !== false
      ? (cfg.featured.speakerIds || []).map(String).map((id) => speakers[id]).filter(visible)
      : [];
    const a = cfg.all;
    let all;
    if (a.source === "picked") {
      all = (a.speakerIds || []).map(String).map((id) => speakers[id]).filter(visible);
    } else {
      const hidden = new Set((a.hiddenIds || []).map(String));
      const feat = new Set(a.excludeFeatured !== false ? featured.map((s) => String(s.id)) : []);
      all = orderSpeakers(speakerOrder.map((id) => speakers[id]).filter((sp) => visible(sp) && !hidden.has(String(sp.id)) && !feat.has(String(sp.id))), a);
    }
    return { featured, all };
  }

  sections(ctx) {
    ctx.lists = this._lists(ctx);
    return {
      featured: () => this._grid(ctx, "featured"),
      all: () => this._grid(ctx, "all"),
    };
  }

  _grid(ctx, key) {
    const { cfg, lang, P, lists } = ctx;
    const s = cfg[key];
    const list = lists[key];
    const eb = P(key, "eyebrow", s.eyebrow);
    const heading = P(key, "heading", s.heading);
    // A hairline separates "all" from a featured block above it.
    const order = cfg.order.filter((k) => cfg[k]?.show !== false);
    const afterFeatured = key === "all" && order[order.indexOf("all") - 1] === "featured" && lists.featured.length;
    if (!list.length) {
      if (key === "featured") return "";
      return `<section class="pk-section pk-bleed pk-ground-white spk-sec" aria-label="${esc(heading || eb || "Speakers")}">
        <div class="pk-inner${afterFeatured ? " spk-rule" : ""}">${eyebrow(eb)}<p class="pk-empty">${esc(fixed(lang, "noSpeakersYet"))}</p></div></section>`;
    }
    const more = key === "all" && s.showMore !== false ? (P("all", "moreText", s.moreText) || fixed(lang, "moreTba")) : "";
    return `
    <section class="pk-section pk-bleed pk-ground-white spk-sec spk-sec--${key}${afterFeatured ? " spk-sec--after" : ""}" aria-label="${esc(heading || eb || "Speakers")}">
      <div class="pk-inner${afterFeatured ? " spk-rule" : ""}">
        ${eyebrow(eb)}
        ${heading ? `<h2 class="pk-h2 spk-h">${esc(heading)}</h2>` : ""}
        <ul class="spk-grid" role="list" data-list="${key}" style="--cols:${clampCols(s.columns)};--cols-md:${Math.min(3, clampCols(s.columns))}"></ul>
        ${more ? `<p class="spk-more">${esc(more)}</p>` : ""}
      </div>
    </section>`;
  }

  afterRender(root, ctx) {
    ["featured", "all"].forEach((key) => {
      const grid = root.querySelector(`[data-list="${key}"]`);
      if (!grid) return;
      const cardCfg = this._cardConfig(ctx, key);
      ctx.lists[key].forEach((sp) => {
        const li = document.createElement("li");
        const card = document.createElement(CARD_TAG);
        card.speaker = sp;            // props BEFORE append (Playbook §4)
        card.theme = this.theme || {};
        card.config = cardCfg;
        li.append(card);
        grid.append(li);
      });
    });
  }

  _cardConfig({ cfg, lang, sessions, getSpeakers, eventTz, P, lists }, key) {
    const ty = speakerTypography();
    // Featured names 22px, the rest 18px; roles 15px in body grey (review rec 04).
    ty.speakerName = key === "featured"
      ? { ...ty.speakerName, fontSize: 22, fontSizeMd: 20, fontSizeSm: 17 }
      : { ...ty.speakerName, fontSize: 18, fontSizeMd: 17, fontSizeSm: 15 };
    ty.speakerRole = { ...ty.speakerRole, fontSize: 15, fontSizeMd: 14, fontSizeSm: 13.5, color: TOKENS.body };
    const b = cfg.bios;
    return {
      colors: {
        ink: TOKENS.ink, muted: TOKENS.muted, faint: TOKENS.faint, hair: TOKENS.hair, placeholder: TOKENS.placeholder,
        accent: TOKENS.amberInk, tagBg: TOKENS.tagBg, tagInk: TOKENS.tagInk, modalBar: TOKENS.amberOnDark,
        mainAccent: TOKENS.amberInk, accentRule: TOKENS.amberOnDark, bioInk: TOKENS.body, focus: TOKENS.focus,
      },
      typography: ty,
      tileSize: 400,
      hoverPrompt: P("bios", "hoverPrompt", b.hoverPrompt),
      allSessions: sessions.filter((s) => !isHiddenSession(s)),   // sessions hidden from the agenda stay out of bios
      getSpeakers,
      eventTz,
      modalEyebrowText: P("bios", "modalEyebrowText", b.modalEyebrowText) || fixed(lang, "speakerOne"),
      showSessions: b.showSessions !== false,
      sessionsHeaderText: P("bios", "sessionsHeaderText", b.sessionsHeaderText) || fixed(lang, "sessionHdrN"),
      sessionHeaderText: P("bios", "sessionHeaderText", b.sessionHeaderText) || fixed(lang, "sessionHdr1"),
      moderatorLabel: P("all", "moderatorLabel", cfg.all.moderatorLabel) || fixed(lang, "moderator"),
      cardEyebrow: cfg.all.showModeratorLabel !== false
        ? (sp) => (isModerator(sp, cfg.all) ? (P("all", "moderatorLabel", cfg.all.moderatorLabel) || fixed(lang, "moderator")) : "")
        : null,
      // Keep names aligned when some cards in this grid have the label.
      cardEyebrowReserve: cfg.all.showModeratorLabel !== false && (lists?.[key] || []).some((sp) => isModerator(sp, cfg.all)),
    };
  }

  pageCss() {
    const t = TOKENS;
    return `
    .spk-sec--after { padding-top: 0; }
    .spk-rule { background: linear-gradient(${t.hair}, ${t.hair}) center top / calc(100% - 2 * clamp(20px, 4vw, 48px)) 1px no-repeat; padding-top: calc(clamp(56px, 7vw, 104px) * .5 * var(--pk-space, 1)); }
    .spk-h { margin-bottom: 8px; }
    .spk-grid { list-style: none; margin: 18px 0 0; padding: 0; display: grid;
      grid-template-columns: repeat(var(--cols, 3), minmax(0, 1fr)); gap: 48px 32px; }
    .spk-grid > li { min-width: 0; display: flex; }
    .spk-grid > li > * { max-width: none; width: 100%; }
    .spk-more { margin-top: 48px; font-size: 16px; font-style: italic; color: ${t.faint}; }
    @media (max-width: 1024px) {
      .spk-grid { grid-template-columns: repeat(var(--cols-md, 3), minmax(0, 1fr)); gap: 40px 24px; }
    }
    @media (max-width: 760px) {
      .spk-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 32px 16px; }
    }
    `;
  }
}
