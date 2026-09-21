// widget.js
// Featured Speakers — NYCW "Meet our speakers" design.
// Section: eyebrow / heading / intro / "more coming" line, centred grid of
// square speaker tiles, optional disclosure note. Each tile is a
// <dev-featured-speaker-card> (FeaturedSpeaker.js) that owns its bio modal.
// NOTE: include the file extension in imports
import { FeaturedSpeaker, migrateTypography } from "./FeaturedSpeaker.js";
import { FONT_STACK, ensureBrandFont } from "./type-scale.js";

const FALLBACK_TOKENS = {
  ink: "#141416",
  muted: "#5C5C5A",
  faint: "#6F6F6D",
  hair: "#E4E4E0",
  placeholder: "#EDEDEA",
  accent: "#9C5F00",
  tagBg: "#F0F0EE",
  tagInk: "#3F3F3D",
  modalBar: "#F7A325",
  accentRule: "#F7A325",
  mainAccent: "#F7A325", // heading rule + speaker hover; wins over accentRule when set
  bioInk: "#3F3F3D",
  focus: "#2B6CE8",
};

const BRAND_FONT_STACK = FONT_STACK;

// Cvent maps some timezone options to DST-stripped IANA zones (playbook §2).
const TZ_NORMALIZE = { "Atlantic/Reykjavik": "Europe/London" };

export default class extends HTMLElement {
  constructor({ configuration, theme } = {}) {
    super();
    this.configuration = configuration || {};
    this.theme = theme || {};

    this.attachShadow({ mode: "open" });

    if (!customElements.get("dev-featured-speaker-card")) {
      customElements.define("dev-featured-speaker-card", FeaturedSpeaker);
    }

    this._typoBindings = [];
    this._onResize = null;
    this._dataPromise = null; // cached sessions + speakers (survives config updates)
  }

  async connectedCallback() {
    this._ensureBrandFont();
    const root = document.createElement("div");
    root.className = "fs";
    this.shadowRoot.append(root);
    await this._renderInto(root);

    this._onResize = () => this._reapplyTypography();
    window.addEventListener("resize", this._onResize);
  }

  disconnectedCallback() {
    if (this._onResize) window.removeEventListener("resize", this._onResize);
    this._typoBindings = [];
  }

  onConfigurationUpdate(newConfig) {
    this.configuration = newConfig || {};
    const root = this.shadowRoot?.querySelector(".fs");
    if (root) {
      this._typoBindings = [];
      this._renderInto(root);
    }
  }

  // =============================================
  // BRAND FONT
  // =============================================

  _ensureBrandFont() {
    if (this.configuration?.useBrandFont === false) return;
    ensureBrandFont(); // shared @font-face loader (type-scale.js)
  }

  // =============================================
  // SDK RESOLUTION
  // =============================================

  _resolveGetSpeakers() {
    if (this.cventSdk?.getSpeakers) return this.cventSdk.getSpeakers.bind(this.cventSdk);
    if (typeof this.getSpeakers === "function") return this.getSpeakers;
    if (typeof window !== "undefined" && typeof window.getSpeakers === "function") return window.getSpeakers;
    return undefined;
  }

  async _resolveEventTz() {
    try {
      let info = null;
      if (this.cventSdk?.getEventInfo) info = await this.cventSdk.getEventInfo();
      else if (typeof this.getEventInfo === "function") info = await this.getEventInfo();
      const tz = info?.timezone;
      if (!tz) return undefined;
      return TZ_NORMALIZE[tz] || tz;
    } catch (e) {
      return undefined;
    }
  }

  // Fetch sessions (for speaker IDs + "appears in") and full speaker profiles once.
  _loadData() {
    if (this._dataPromise) return this._dataPromise;
    this._dataPromise = (async () => {
      const cfg = this.configuration || {};
      const getSpeakers = this._resolveGetSpeakers();
      if (!getSpeakers) console.warn("[widget.js] getSpeakers not found; speaker data will not hydrate.");

      const allSessions = [];
      const sort = cfg.sort || "dateTimeAsc";
      const pageSize = 200;
      try {
        let gen = null;
        if (this.cventSdk?.getSessionGenerator) gen = await this.cventSdk.getSessionGenerator(sort, pageSize);
        else if (typeof this.getSessionGenerator === "function") gen = await this.getSessionGenerator(sort, pageSize);
        if (gen) {
          for await (const page of gen) {
            const batch = Array.isArray(page) ? page
              : Array.isArray(page?.sessions) ? page.sessions
              : Array.isArray(page?.records) ? page.records : [];
            if (batch.length) allSessions.push(...batch);
            if (allSessions.length >= pageSize) break;
          }
        }
      } catch (e) {
        console.warn("[widget.js] getSessionGenerator error:", e);
      }

      const idSet = new Set();
      allSessions.forEach((sess) => {
        const list = Array.isArray(sess.resolvedSpeakers) ? sess.resolvedSpeakers
          : Array.isArray(sess.speakers) ? sess.speakers.map((x) => (x && x.speaker ? x.speaker : x)).filter(Boolean)
          : [];
        list.forEach((sp) => {
          const id = sp?.id || sp?.speakerId;
          if (id) idSet.add(String(id));
        });
      });

      let allSpeakers = [];
      if (idSet.size && getSpeakers) {
        try {
          const map = await getSpeakers([...idSet]);
          if (map && typeof map === "object") {
            allSpeakers = Object.values(map).filter((s) => s && !s.failureReason);
          }
        } catch (e) {
          console.warn("[widget.js] getSpeakers error:", e);
        }
      }

      const eventTz = await this._resolveEventTz();
      return { allSessions, allSpeakers, getSpeakers, eventTz };
    })();
    return this._dataPromise;
  }

  // =============================================
  // RENDER
  // =============================================

  async _renderInto(root) {
    // Saved OLD default typography is swapped for the current defaults (see
    // migrateTypography); the migrated map is what the cards receive too.
    const cfg = { ...(this.configuration || {}), typography: migrateTypography((this.configuration || {}).typography) };
    const c = { ...FALLBACK_TOKENS, ...(cfg.colors || {}) };
    // Main accent: heading rule + card hover. Older configs only carry accentRule.
    c.mainAccent = (cfg.colors && cfg.colors.mainAccent) || (cfg.colors && cfg.colors.accentRule) || c.mainAccent;
    const fontFamily = cfg.useBrandFont === false ? "inherit" : BRAND_FONT_STACK;
    // 250px tiles (4 across in the 1210px content box). 200 was the old default;
    // a saved 200 is treated as "default", not a planner choice.
    const tileRaw = Number(cfg.tileSize) || 250;
    const tile = Math.max(120, Math.min(400, tileRaw === 200 ? 250 : tileRaw));
    const gapRow = Number(cfg.gridGapRow) || 36;
    // 65px column gap; a saved 24 (the old default) is treated as the new default.
    const gapColRaw = Number(cfg.gridGapCol) || 65;
    const gapCol = gapColRaw === 24 ? 65 : gapColRaw;
    const align = cfg.gridAlign === "left" ? "start" : "center";

    root.innerHTML = "";

    const style = document.createElement("style");
    style.textContent = `
      :host { display: block; width: 100%; }
      .fs, .fs *, .fs *::before, .fs *::after { box-sizing: border-box; }
      .fs {
        font-family: ${fontFamily};
        color: ${c.ink};
        line-height: 1.45; font-size: 16px; text-align: left;
        background: transparent; display: block; width: 100%; margin: 0;
        padding: clamp(28px, 3.5vw, 52px) 0;
      }
      .fs p, .fs h2 { margin: 0; padding: 0; }
      .fs :focus-visible { outline: 3px solid ${c.focus}; outline-offset: 3px; }
      /* Same content box as the agenda widget so the two line up on a page */
      .fs__inner { width: calc(100% - 40px); max-width: 1210px; margin: 0 auto; padding: 0; }
      .fs .fs__rule { width: 40px; height: 3px; border-radius: 2px; margin: 14px 0 12px; background: ${c.mainAccent}; }
      @media (max-width: 600px) { .fs .fs__rule { margin: 10px 0 8px; } }
      .fs .fs__eyebrow {
        font-size: 11px; letter-spacing: .14em; text-transform: uppercase;
        font-weight: 700; color: ${c.muted};
      }
      .fs .fs__h2 {
        font-size: 28px; font-weight: 700; letter-spacing: -.02em;
        line-height: 1.1; margin: 14px 0 10px; max-width: 34ch; color: ${c.ink};
      }
      .fs .fs__eyebrow[style*="display: none"] + .fs__h2 { margin-top: 0; }
      .fs .fs__intro { font-size: 18px; color: ${c.muted}; max-width: 86ch; }
      @media (max-width: 1024px) { .fs .fs__h2 { font-size: 24px; } .fs .fs__intro { font-size: 16px; } }
      @media (max-width: 600px)  { .fs .fs__h2 { font-size: 20px; } .fs .fs__intro { font-size: 15px; } }
      .fs .fs__more { margin-top: 16px; font-size: 15px; font-weight: 600; letter-spacing: .01em; color: ${c.accent}; }
      .fs .fs__grid {
        display: grid; grid-template-columns: repeat(auto-fit, ${tile}px);
        justify-content: ${align}; gap: ${gapRow}px ${gapCol}px; margin-top: 38px;
      }
      .fs__grid > * { height: 100%; }
      .fs .fs__empty { margin-top: 38px; font-size: 14px; color: ${c.faint}; font-style: italic; }
      .fs .fs__note {
        margin-top: clamp(44px, 4.5vw, 64px); padding-top: 20px;
        border-top: 1px solid ${c.hair};
        font-size: 13px; font-style: italic; line-height: 1.5; color: ${c.faint};
      }
      @media (max-width: ${tile * 2 + gapCol + 40}px) {
        .fs .fs__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: ${Math.round(gapRow*0.75)}px ${Math.min(gapCol, 16)}px; }
      }
    `;
    root.append(style);

    const inner = document.createElement("div");
    inner.className = "fs__inner";
    root.append(inner);

    // ---- Header block ----
    const eyebrowText = cfg.eyebrowText !== undefined ? cfg.eyebrowText : "";
    const headerText = cfg.headerText !== undefined ? cfg.headerText : "Featured Speakers";
    const introText = cfg.introText !== undefined ? cfg.introText : "Select a speaker to read their bio.";
    const moreText = cfg.moreText !== undefined ? cfg.moreText : "";
    const noteText = cfg.noteText !== undefined ? cfg.noteText : "";

    const eyebrow = document.createElement("p");
    eyebrow.className = "fs__eyebrow";
    eyebrow.textContent = eyebrowText;
    this._applyTypographyOverrides(eyebrow, cfg.typography?.eyebrow, true);
    if (!eyebrowText) eyebrow.style.display = "none";

    const h2 = document.createElement("h2");
    h2.className = "fs__h2";
    h2.textContent = headerText;
    this._applyTypographyOverrides(h2, cfg.typography?.header, true);
    if (!headerText) h2.style.display = "none";

    const intro = document.createElement("p");
    intro.className = "fs__intro";
    intro.textContent = introText;
    this._applyTypographyOverrides(intro, cfg.typography?.intro, true);
    if (!introText) intro.style.display = "none";

    const more = document.createElement("p");
    more.className = "fs__more";
    more.textContent = moreText;
    this._applyTypographyOverrides(more, cfg.typography?.more, true);
    if (!moreText) more.style.display = "none";

    const rule = document.createElement("div");
    rule.className = "fs__rule";
    rule.setAttribute("aria-hidden", "true");
    if (cfg.showAccentRule === false) rule.style.display = "none";
    else h2.style.marginBottom = "0";

    inner.append(eyebrow, h2, rule, intro, more);

    // ---- Grid (placeholder while loading) ----
    const grid = document.createElement("ul");
    grid.className = "fs__grid";
    grid.setAttribute("role", "list");
    grid.style.listStyle = "none";
    grid.style.padding = "0";
    grid.style.margin = "38px 0 0";
    grid.style.minHeight = `${tile + 80}px`;
    inner.append(grid);

    // ---- Disclosure note ----
    const note = document.createElement("p");
    note.className = "fs__note";
    note.textContent = noteText;
    this._applyTypographyOverrides(note, cfg.typography?.note, true);
    if (!noteText) note.style.display = "none";
    inner.append(note);

    // ---- Data ----
    const { allSessions, allSpeakers, getSpeakers, eventTz } = await this._loadData();
    grid.style.minHeight = "";

    if (!allSpeakers.length) {
      console.warn("[widget.js] No speakers returned.");
      grid.remove();
      const empty = document.createElement("p");
      empty.className = "fs__empty";
      empty.textContent = "No speakers to display yet.";
      inner.insertBefore(empty, note);
      return;
    }

    // Planner-selected speakers (featuredSpeakerIds) in planner order. A fresh
    // widget has none selected and renders nothing but a prompt to use the
    // editor; it never falls back to "every speaker in the event".
    const selectedIds = Array.isArray(cfg.featuredSpeakerIds)
      ? cfg.featuredSpeakerIds.map(String) : [];
    const speakersToRender = selectedIds
      .map((id) => allSpeakers.find((s) => String(s?.id || s?.speakerId) === id))
      .filter(Boolean);

    if (!speakersToRender.length) {
      grid.remove();
      const empty = document.createElement("p");
      empty.className = "fs__empty";
      empty.textContent = "No speakers have been added. Use the editor to the right to add and order speakers to feature within this widget.";
      inner.insertBefore(empty, note);
      return;
    }

    speakersToRender.forEach((sp) => {
      const li = document.createElement("li");
      const card = document.createElement("dev-featured-speaker-card");
      card.speaker = sp;
      card.theme = this.theme || {};
      card.config = {
        ...cfg,
        colors: c,
        tileSize: tile,
        fontFamily,
        allSessions,
        getSpeakers,
        eventTz,
      };
      li.append(card);
      grid.append(li);
    });
  }

  // =============================================
  // TYPOGRAPHY HELPERS (shared pattern with FeaturedSpeaker.js)
  // =============================================

  _activeFontSize(ov) {
    if (!ov) return undefined;
    const w = window.innerWidth || document.documentElement.clientWidth || 1920;
    if (w <= 600 && ov.fontSizeSm) return ov.fontSizeSm;
    if (w <= 1024 && ov.fontSizeMd) return ov.fontSizeMd;
    return ov.fontSize;
  }

  _applyTypographyNow(element, override) {
    if (!override) return;
    const { color, bold, italic, underline } = override;
    const fs = this._activeFontSize(override);
    element.style.fontSize = fs !== undefined && fs !== null && fs !== "" ? `${fs}px` : "";
    if (color) element.style.color = color;
    if (bold !== undefined) element.style.fontWeight = bold ? "700" : "400";
    if (italic !== undefined) element.style.fontStyle = italic ? "italic" : "normal";
    if (underline !== undefined) element.style.textDecoration = underline ? "underline" : "none";
  }

  _applyTypographyOverrides(element, override, track = false) {
    this._applyTypographyNow(element, override);
    if (track && override) this._typoBindings.push([element, override]);
  }

  _reapplyTypography() {
    for (const [el, ov] of this._typoBindings) this._applyTypographyNow(el, ov);
  }
}
