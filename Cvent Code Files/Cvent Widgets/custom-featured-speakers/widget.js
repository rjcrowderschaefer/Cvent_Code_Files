// widget.js
// NOTE: include the file extension in imports
import { FeaturedSpeaker } from "./FeaturedSpeaker.js";

export default class extends HTMLElement {
  constructor({ configuration, theme } = {}) {
    super();
    this.configuration = configuration || {};
    this.theme = theme || {};

    this.attachShadow({ mode: "open" });

    // Register the card sub-element once
    if (!customElements.get("dev-featured-speaker-card")) {
      customElements.define("dev-featured-speaker-card", FeaturedSpeaker);
    }

    this._typoBindings = [];
    this._onResize = null;
  }

  async connectedCallback() {
    const container = document.createElement("div");
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.width = "100%";
    container.style.gap = "12px";

    // Placeholder height while data loads
    const placeholder = document.createElement("div");
    placeholder.style.height = "200px";
    placeholder.style.width = "0px";
    container.append(placeholder);

    this.shadowRoot.append(container);

    await this._renderInto(container);

    this._onResize = () => this._reapplyTypography();
    window.addEventListener("resize", this._onResize);
  }

  disconnectedCallback() {
    if (this._onResize) window.removeEventListener("resize", this._onResize);
    this._typoBindings = [];
  }

  onConfigurationUpdate(newConfig) {
    this.configuration = newConfig || {};
    const container = this.shadowRoot?.firstElementChild;
    if (container) {
      container.innerHTML = "";
      const placeholder = document.createElement("div");
      placeholder.style.height = "200px";
      placeholder.style.width = "0px";
      container.append(placeholder);
      this._renderInto(container);
    }
  }

  // =============================================
  // SDK RESOLUTION  (mirrors widget.js pattern)
  // =============================================

  _resolveGetSpeakers() {
    if (this.cventSdk?.getSpeakers) return this.cventSdk.getSpeakers.bind(this.cventSdk);
    if (typeof this.getSpeakers === "function") return this.getSpeakers;
    if (typeof window !== "undefined" && typeof window.getSpeakers === "function") return window.getSpeakers;
    return undefined;
  }

  // =============================================
  // RENDER
  // =============================================

  async _renderInto(container) {
    const cfg = this.configuration || {};
    const theme = this.theme || {};

    // ---- Header & Subheader ----
    const headerText = cfg.headerText !== undefined ? cfg.headerText : "Featured Speakers";
    const subheaderText = cfg.subheaderText !== undefined ? cfg.subheaderText : "Meet the experts taking the stage";

    const headerWrap = document.createElement("div");
    headerWrap.style.cssText = "display:flex;flex-direction:column;gap:4px;width:calc(100% - 40px);max-width:1210px;margin:0 auto;box-sizing:border-box;";

    const headerEl = document.createElement("div");
    headerEl.textContent = headerText;
    this._applyTypographyOverrides(headerEl, cfg.typography?.widgetHeader, true);
    if (!headerEl.style.fontSize) headerEl.style.fontSize = "32px";
    if (!headerEl.style.fontWeight) headerEl.style.fontWeight = "700";

    const subheaderEl = document.createElement("div");
    subheaderEl.textContent = subheaderText;
    this._applyTypographyOverrides(subheaderEl, cfg.typography?.widgetSubheader, true);
    if (!subheaderEl.style.fontSize) subheaderEl.style.fontSize = "18px";
    if (!subheaderEl.style.color) subheaderEl.style.color = "#444";

    headerWrap.append(headerEl, subheaderEl);
    container.append(headerWrap);

    // ---- Resolve getSpeakers ----
    const getSpeakers = this._resolveGetSpeakers();
    if (!getSpeakers) {
      console.warn("[widget.js] getSpeakers not found; speaker data will not hydrate.");
    }

    // ---- Fetch sessions first (needed both for speaker IDs and modal "appears in") ----
    let allSessions = [];
    const sort = cfg.sort || "dateTimeAsc";
    const pageSize = 200;
    try {
      let gen = null;
      if (this.cventSdk?.getSessionGenerator) {
        gen = await this.cventSdk.getSessionGenerator(sort, pageSize);
      } else if (typeof this.getSessionGenerator === "function") {
        gen = await this.getSessionGenerator(sort, pageSize);
      }
      if (gen) {
        for await (const page of gen) {
          const batch = Array.isArray(page)
            ? page
            : Array.isArray(page?.sessions)
            ? page.sessions
            : Array.isArray(page?.records)
            ? page.records
            : [];
          if (batch.length) allSessions.push(...batch);
          if (allSessions.length >= pageSize) break;
        }
      }
    } catch (e) {
      console.warn("[widget.js] getSessionGenerator error:", e);
    }

    // ---- Collect unique speaker IDs from sessions ----
    const idSet = new Set();
    allSessions.forEach((sess) => {
      const list = Array.isArray(sess.resolvedSpeakers)
        ? sess.resolvedSpeakers
        : Array.isArray(sess.speakers)
        ? sess.speakers.map((x) => (x && x.speaker ? x.speaker : x)).filter(Boolean)
        : [];
      list.forEach((sp) => {
        const id = sp?.id || sp?.speakerId;
        if (id) idSet.add(String(id));
      });
    });

    // ---- Fetch full speaker profiles by ID ----
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


    if (!allSpeakers.length) {
      console.warn("[widget.js] No speakers returned.");
      const placeholder = container.querySelector("div[style*='height: 200px']");
      if (placeholder) container.removeChild(placeholder);
      return;
    }

    // ---- Filter to planner-selected speakers (featuredSpeakerIds) ----
    // cfg.featuredSpeakerIds: string[] of IDs the planner selected in the editor.
    // If none selected yet, fall back to showing all speakers (editor preview mode).
    const selectedIds = Array.isArray(cfg.featuredSpeakerIds) && cfg.featuredSpeakerIds.length
      ? cfg.featuredSpeakerIds
      : null;

    let speakersToRender = selectedIds
      ? selectedIds
          .map((id) => allSpeakers.find((s) => String(s?.id || s?.speakerId) === String(id)))
          .filter(Boolean)
      : allSpeakers;

    // ---- Remove placeholder ----
    const placeholder = container.querySelector("div[style*='height: 200px']");
    if (placeholder) container.removeChild(placeholder);

    // ---- Grid wrapper ----
    const columns = Math.min(Math.max(cfg.columns || 3, 1), 6);
    const grid = document.createElement("div");
    grid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(${columns}, minmax(0, 1fr));
      gap: ${cfg.cardGap || "16px"};
      width: calc(100% - 40px);
      max-width: 1210px;
      margin: 0 auto;
      box-sizing: border-box;
    `;

    // Responsive grid breakpoints via a style tag in shadow root
    const gridStyle = document.createElement("style");
    gridStyle.textContent = `
      @media (max-width: 1024px) {
        .speaker-grid { grid-template-columns: repeat(${Math.min(columns, 3)}, minmax(0, 1fr)) !important; }
      }
      @media (max-width: 600px) {
        .speaker-grid { grid-template-columns: repeat(${Math.min(columns, 2)}, minmax(0, 1fr)) !important; }
      }
    `;
    grid.classList.add("speaker-grid");
    this.shadowRoot.prepend(gridStyle);

    // ---- Render each speaker card ----
    speakersToRender.forEach((sp) => {
      const card = document.createElement("dev-featured-speaker-card");
      card.speaker = sp;
      card.theme = theme;
      card.config = {
        ...cfg,
        allSessions,
        getSpeakers,
      };
      grid.append(card);
    });

    container.append(grid);
  }

  // =============================================
  // TYPOGRAPHY HELPERS
  // =============================================

  _activeFontSize(ov) {
    if (!ov) return undefined;
    const w = window.innerWidth || document.documentElement.clientWidth || 1920;
    if (w <= 600 && ov.fontSizeSm) return ov.fontSizeSm;
    if (w <= 1024 && ov.fontSizeMd) return ov.fontSizeMd;
    return ov.fontSize;
  }

  _applyTypographyNow(element, override) {
    const { color, bold, italic, underline } = override || {};
    const fs = this._activeFontSize(override);
    element.style.fontSize = fs ? `${fs}px` : "";
    if (color !== undefined) element.style.color = color || "";
    if (bold !== undefined) element.style.fontWeight = bold ? "700" : "";
    if (italic !== undefined) element.style.fontStyle = italic ? "italic" : "";
    if (underline !== undefined) element.style.textDecoration = underline ? "underline" : "none";
  }

  _applyTypographyOverrides(element, override, track = false) {
    this._applyTypographyNow(element, override);
    if (track) this._typoBindings.push([element, override || {}]);
  }

  _reapplyTypography() {
    for (const [el, ov] of this._typoBindings) this._applyTypographyNow(el, ov);
  }
}