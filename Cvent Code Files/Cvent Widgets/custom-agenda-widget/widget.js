// widget.js
// NOTE: include the file extension in imports
import { AgendaItem } from "./AgendaItem.js";

export default class extends HTMLElement {
  constructor({ configuration, theme } = {}) {
    super();
    this.configuration = configuration || {};
    this.theme = theme || {};

    this.attachShadow({ mode: "open" });

    // define the custom element once (use a namespaced tag to avoid collisions)
    if (!customElements.get("namespace-vertical-agenda")) {
      customElements.define("namespace-vertical-agenda", AgendaItem);
    }

    // keep bindings for responsive typography (optional)
    this._typoBindings = [];
    this._onResize = null;
  }

  async connectedCallback() {
    // container like Cvent’s example
    const container = document.createElement("div");
    container.style.display = "flex";
    container.style.flexDirection = "column";
    container.style.width = "100%";
    container.style.gap = "12px";

    // placeholder height in editor until data arrives
    const placeholderDiv = document.createElement("div");
    placeholderDiv.style.height = "200px";
    placeholderDiv.style.width = "0px";
    container.appendChild(placeholderDiv);

    this.shadowRoot.appendChild(container);

    // load + render
    await this._renderInto(container);

    // set up responsive typography reflow
    this._onResize = () => this._reapplyTypography();
    window.addEventListener("resize", this._onResize);
  }

  disconnectedCallback() {
    if (this._onResize) window.removeEventListener("resize", this._onResize);
    this._typoBindings = [];
  }

  onConfigurationUpdate(newConfig) {
    this.configuration = newConfig || {};
    // re-render into the current container
    const container = this.shadowRoot?.firstElementChild;
    if (container) {
      // clear except keep container node
      container.innerHTML = "";
      const placeholderDiv = document.createElement("div");
      placeholderDiv.style.height = "200px";
      placeholderDiv.style.width = "0px";
      container.appendChild(placeholderDiv);
      this._renderInto(container);
    }
  }

  async _renderInto(container) {
    const cfg = this.configuration || {};
    const theme = this.theme || {};

    // Sort + page size config
    const sort =
      cfg.sort === "nameAsc" ||
      cfg.sort === "nameDesc" ||
      cfg.sort === "dateTimeDesc"
        ? cfg.sort
        : "dateTimeAsc";
    const pageSize = Math.max(20, Math.min(200, cfg.maxResults || 100));

    // Acquire a generator (prefer the platform-injected SDK)
    let gen = null;
    try {
      if (this.cventSdk?.getSessionGenerator) {
        gen = await this.cventSdk.getSessionGenerator(sort, pageSize);
      } else if (typeof this.getSessionGenerator === "function") {
        gen = await this.getSessionGenerator(sort, pageSize);
      }
    } catch (e) {
      console.warn("[widget.js] getSessionGenerator error:", e);
    }

    if (!gen) {
      console.warn("[widget.js] No session generator available.");
      return; // keep placeholder
    }

    const sessions = [];
    try {
      for await (const page of gen) {
        // Support both shapes: arrays OR { sessions: [...] }
        const batch = Array.isArray(page)
          ? page
          : Array.isArray(page?.sessions)
          ? page.sessions
          : Array.isArray(page?.records)
          ? page.records
          : [];
        if (batch.length) sessions.push(...batch);
        if (sessions.length >= pageSize) break;
      }
    } catch (e) {
      console.warn("[widget.js] Iterating session generator failed:", e);
    }

    // If we have data, remove placeholder
    const placeholder = container.querySelector("div[style*='height: 200px']");
    if (sessions.length && placeholder) {
      container.removeChild(placeholder);
    }

    // Client-side fallback sort (matches your original)
    const sorted = [...sessions].sort((a, b) => {
      const aName = (a?.name || "").toLowerCase();
      const bName = (b?.name || "").toLowerCase();
      const aStart = a?.startDateTime ? new Date(a.startDateTime).getTime() : 0;
      const bStart = b?.startDateTime ? new Date(b.startDateTime).getTime() : 0;
      switch (sort) {
        case "nameAsc":
          return aName.localeCompare(bName);
        case "nameDesc":
          return bName.localeCompare(aName);
        case "dateTimeDesc":
          return bStart - aStart;
        case "dateTimeAsc":
        default:
          return aStart - bStart;
      }
    });

    // Render
    if (cfg.groupByDay === false) {
      sorted.forEach((s) => container.appendChild(this._renderItem(s, theme, cfg, sessions)));
    } else {
      const groups = this._groupSessionsByDay(sorted);
      for (const [dayKey, daySessions] of groups) {
        const header = this._renderDayHeader(dayKey, theme, cfg);
        container.appendChild(header);
        daySessions.forEach((s) => container.appendChild(this._renderItem(s, theme, cfg, sessions)));
      }
    }
  }

  _renderItem(session, theme, cfg, allSessions) {
    // IMPORTANT: create the custom element by tag name and set properties
    const el = document.createElement("namespace-vertical-agenda");
    el.session = session;
    el.theme = theme;
    el.config = { ...cfg, allSessions: allSessions || [] };
    return el;
  }

  _groupSessionsByDay(sessions) {
    const map = new Map();
    sessions.forEach((s) => {
      const d = s?.startDateTime ? new Date(s.startDateTime) : null;
      const key = d
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
            d.getDate()
          ).padStart(2, "0")}`
        : "Unknown";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    });
    return map;
  }

  _formatDayKeyLabel(key) {
    if (key === "Unknown") return "Unknown Date";
    const [y, m, d] = key.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  }

  _renderDayHeader(dayKey, theme, cfg) {
    const el = document.createElement("div");
    el.textContent = this._formatDayKeyLabel(dayKey);

    // theme styles (inline like Cvent example)
    const header3 = theme?.header3 ?? {};
    const { customClasses, ...styles } = header3;
    Object.assign(el.style, styles, { margin: "8px 0 0 30px" });
    if (Array.isArray(customClasses) && customClasses.length) el.classList.add(...customClasses);

    // minimal typography override support
    this._applyTypographyOverrides(el, cfg?.typography?.eventDate, true);
    return el;
  }

  // === Typography helpers ===
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
    if (underline !== undefined) {
      const existing = getComputedStyle(element).textDecorationLine;
      const parts = new Set((existing || "").split(" ").filter(Boolean));
      if (underline) parts.add("underline");
      else parts.delete("underline");
      element.style.textDecorationLine = parts.size ? Array.from(parts).join(" ") : "";
    }
  }

  _applyTypographyOverrides(element, override, track = false) {
    this._applyTypographyNow(element, override);
    if (track) this._typoBindings.push([element, override || {}]);
  }

  _reapplyTypography() {
    for (const [el, ov] of this._typoBindings) this._applyTypographyNow(el, ov);
  }
}
