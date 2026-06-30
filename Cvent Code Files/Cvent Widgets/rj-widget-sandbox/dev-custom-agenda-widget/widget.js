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
    if (this._navResizeHandler) {
      window.removeEventListener("resize", this._navResizeHandler);
      this._navResizeHandler = null;
    }
    if (this._navScrollHandler) {
      window.removeEventListener("scroll", this._navScrollHandler);
      this._navScrollHandler = null;
    }
    if (this._dateNavObserver) {
      this._dateNavObserver.disconnect();
      this._dateNavObserver = null;
    }
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

  // === NEW: find the SDK's getSpeakers hook, wherever it lives ===
  _resolveGetSpeakers() {
    if (this.cventSdk?.getSpeakers)
      return this.cventSdk.getSpeakers.bind(this.cventSdk);
    if (typeof this.getSpeakers === "function") return this.getSpeakers;
    if (
      typeof window !== "undefined" &&
      typeof window.getSpeakers === "function"
    )
      return window.getSpeakers;
    return undefined;
  }

  async _renderInto(container) {
    const cfg = this.configuration || {};
    const theme = this.theme || {};

    if (this._dateNavObserver) {
      this._dateNavObserver.disconnect();
      this._dateNavObserver = null;
    }

    // Agenda header + subheader

    const headerText = cfg.headerText !== undefined ? cfg.headerText : "Agenda";

    const subheaderText =
      cfg.subheaderText !== undefined
        ? cfg.subheaderText
        : "Here's what's on the schedule";

    const headerWrap = document.createElement("div");
    headerWrap.style.display = "flex";
    headerWrap.style.flexDirection = "column";
    headerWrap.style.gap = "4px";
    headerWrap.style.width = "calc(100% - 40px)";
    headerWrap.style.maxWidth = "1210px";
    headerWrap.style.margin = "0px auto 0px auto";
    headerWrap.style.boxSizing = "border-box";

    const headerEl = document.createElement("div");
    headerEl.textContent = headerText;
    headerEl.style.margin = "0";

    const subheaderEl = document.createElement("div");
    subheaderEl.textContent = subheaderText;
    subheaderEl.style.margin = "0";

    this._applyTypographyOverrides(
      headerEl,
      (cfg.typography && cfg.typography.agendaHeader) || {},
      true
    );

    this._applyTypographyOverrides(
      subheaderEl,
      (cfg.typography && cfg.typography.agendaSubheader) || {},
      true
    );

    // fallback defaults if planner hasn't styled them yet
    if (!headerEl.style.fontSize) headerEl.style.fontSize = "32px";
    const hasExplicitBold = (cfg.typography?.agendaHeader?.bold !== undefined);
    if (!hasExplicitBold) headerEl.style.fontWeight = "700";

    if (!subheaderEl.style.fontSize) subheaderEl.style.fontSize = "18px";
    if (!subheaderEl.style.color) subheaderEl.style.color = "#444";

    headerWrap.append(headerEl, subheaderEl);
    container.appendChild(headerWrap);

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

    // Cvent returns some zones as DST-stripped GMT anchors. Map those back to
    // their DST-aware canonical IANA zone so summer/winter offsets resolve correctly.
    // VERIFIED MAPPINGS (confirmed via getEventInfo on this account):
    //   Atlantic/Reykjavik  ->  Europe/London   (Cvent's "London" option, needs BST in summer)
    // Add new entries only after confirming what getEventInfo() returns for that city.
    const TZ_NORMALIZE = {
      "Atlantic/Reykjavik": "Europe/London",
    };

    let eventTimezone = "America/New_York"; // fallback
    try {
      const eventInfo = await this.cventSdk.getEventInfo?.();
      let rawTz = eventInfo?.timezone;
      if (rawTz && TZ_NORMALIZE[rawTz]) rawTz = TZ_NORMALIZE[rawTz];
      if (rawTz) eventTimezone = rawTz;
    } catch (e) {
      console.warn("getEventInfo error:", e);
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

    // Filter out closed sessions and those marked "Hide from main agenda?" via custom field
    const openSessions = sessions.filter(s => {
      if (s.isOpenForRegistration == false) return false;
      const hideField = s.sessionCustomFields?.find(f => f.name === "Hide from main agenda?");
      if (hideField?.value?.includes("Yes")) return false;
      return true;
    });

    // If we have data, remove placeholder
    const placeholder = container.querySelector("div[style*='height: 200px']");
    if (openSessions.length && placeholder) {
      container.removeChild(placeholder);
    }

    // Client-side fallback sort (matches your original)
    const sorted = [...openSessions].sort((a, b) => {
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

    // Resolve getSpeakers once per render
    const getSpeakers = this._resolveGetSpeakers();
    if (!getSpeakers) {
      console.warn(
        "[widget.js] getSpeakers not found; speakers will not hydrate (title/company may be empty)."
      );
    }

    // Render
    if (cfg.groupByDay === false) {
      sorted.forEach((s) =>
        container.appendChild(
          this._renderItem(s, theme, cfg, openSessions, getSpeakers, eventTimezone)
        )
      );
    } else {
      const groups = this._groupSessionsByDay(sorted, eventTimezone);
      const dayKeys = [...groups.keys()];

      const showDateNav = cfg.hideDateNav !== true;
      if (!showDateNav) {
        if (this._navResizeHandler) {
          window.removeEventListener("resize", this._navResizeHandler);
          this._navResizeHandler = null;
        }
        if (this._navScrollHandler) {
          window.removeEventListener("scroll", this._navScrollHandler);
          this._navScrollHandler = null;
        }
        if (this._dateNavObserver) {
          this._dateNavObserver.disconnect();
          this._dateNavObserver = null;
        }
      }

      const dn = cfg.dateNav || {};
      const cventOffset = Number(dn.stickyOffset) || 0;

      const dayHeaderRefs = {};
      const navLinks = {};
      let triggerOffset = cventOffset;
      let dateNav = null;
      let measureCventHeader = () => cventOffset;

      const setActiveDay = (activeKey) => {
        Object.entries(navLinks).forEach(([key, link]) => {
          link.classList.toggle("active", key === activeKey);
        });
      };

      if (showDateNav) {
        const dnStyle = document.createElement("style");
        dnStyle.textContent = `
        .dateNav {
          display: flex; flex-wrap: wrap; gap: 16px;
          width: calc(100% - 40px); max-width: 1210px; margin: 0 auto;
          box-sizing: border-box; position: sticky; z-index: 50;
          background: ${dn.navBg || "#ffffff"}; padding: 8px 0;
        }
        .dateNav button {
          background: none; border: none; padding: 0; cursor: pointer;
          font-family: inherit; font-weight: 400;
          color: ${dn.inactiveColor || "#999999"};
          font-size: ${dn.fontSize ?? 18}px; text-decoration: none;
        }
        .dateNav button.active {
          color: ${dn.activeColor || "#000000"}; font-weight: 700;
          text-decoration: underline;
          text-decoration-color: ${dn.underlineColor || "#f7a325"};
          text-underline-offset: 4px;
        }
        .navLabelShort { display: none; }
        .navLabelFull { display: inline; }
        @media (max-width: 1024px) {
          .dateNav button { font-size: ${dn.fontSizeMd ?? 16}px; }
        }
        @media (max-width: 600px) {
          .dateNav {
            width: 100%; max-width: 100%;
            padding-left: 20px; padding-right: 20px;
          }
          .dateNav button { font-size: ${dn.fontSizeSm ?? 14}px; }
          .navLabelFull { display: none; }
          .navLabelShort { display: inline; }
        }
        `;
        container.appendChild(dnStyle);

        dateNav = document.createElement("div");
        dateNav.classList.add("dateNav");

        measureCventHeader = () => {
          const selectors = ["#navigationContainer", ".cus_nav"];
          for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) {
              const r = el.getBoundingClientRect();
              if (r.height > 0) return Math.max(0, Math.round(r.bottom));
            }
          }
          return cventOffset;
        };

        dayKeys.forEach((dayKey) => {
          const link = document.createElement("button");
          link.type = "button";

          const fullLabel = document.createElement("span");
          fullLabel.className = "navLabelFull";
          fullLabel.textContent = this._formatDayKeyLabel(dayKey);

          const shortLabel = document.createElement("span");
          shortLabel.className = "navLabelShort";
          shortLabel.textContent = this._formatDayKeyLabelShort(dayKey);

          link.append(fullLabel, shortLabel);

          link.addEventListener("click", () => {
            setActiveDay(dayKey);
            this._navClickLock = dayKey;
            clearTimeout(this._navClickTimer);
            this._navClickTimer = setTimeout(() => {
              this._navClickLock = null;
            }, 700);

            const target = dayHeaderRefs[dayKey];
            if (!target) return;

            const scrollToTarget = (smooth) => {
              const cventBottom = measureCventHeader();
              const navH = dateNav.offsetHeight || 0;
              const totalOffset = cventBottom + navH + 12;
              const top =
                target.getBoundingClientRect().top +
                window.pageYOffset -
                totalOffset;
              window.scrollTo({ top, behavior: smooth ? "smooth" : "auto" });
            };

            scrollToTarget(true);
            setTimeout(() => {
              const cventBottom = measureCventHeader();
              const navH = dateNav.offsetHeight || 0;
              const totalOffset = cventBottom + navH + 12;
              const drift = Math.abs(
                target.getBoundingClientRect().top - totalOffset
              );
              if (drift > 4) scrollToTarget(false);
            }, 650);
          });

          navLinks[dayKey] = link;
          dateNav.appendChild(link);
        });

        container.appendChild(dateNav);

        const applyStickyOffset = () => {
          dateNav.style.top = `${measureCventHeader()}px`;
        };
        applyStickyOffset();

        if (this._navResizeHandler) {
          window.removeEventListener("resize", this._navResizeHandler);
        }
        let resizeRAF = null;
        this._navResizeHandler = () => {
          if (resizeRAF) cancelAnimationFrame(resizeRAF);
          resizeRAF = requestAnimationFrame(applyStickyOffset);
        };
        window.addEventListener("resize", this._navResizeHandler);

        if (this._navScrollHandler) {
          window.removeEventListener("scroll", this._navScrollHandler);
        }
        let scrollRAF = null;
        this._navScrollHandler = () => {
          if (scrollRAF) cancelAnimationFrame(scrollRAF);
          scrollRAF = requestAnimationFrame(applyStickyOffset);
        };
        window.addEventListener("scroll", this._navScrollHandler, {
          passive: true,
        });
      }

      // --- Render headers + sessions (always, nav or not) ---
      for (const [dayKey, daySessions] of groups) {
        const header = this._renderDayHeader(dayKey, theme, cfg);
        header.dataset.dayKey = dayKey;
        dayHeaderRefs[dayKey] = header;
        container.appendChild(header);

        daySessions.forEach((s) => {
          container.appendChild(
            this._renderItem(s, theme, cfg, openSessions, getSpeakers, eventTimezone)
          );
        });
      }

      // --- Scroll-spy (only when nav is shown) ---
      if (showDateNav) {
        if (dayKeys.length) setActiveDay(dayKeys[0]);

        requestAnimationFrame(() => {
          const navH = dateNav.offsetHeight || 0;
          triggerOffset = cventOffset + navH;
          const headerEls = Object.values(dayHeaderRefs);

          const update = () => {
            if (this._navClickLock) {
              setActiveDay(this._navClickLock);
              return;
            }
            let activeKey = dayKeys[0];
            headerEls.forEach((h) => {
              if (h.getBoundingClientRect().top - triggerOffset <= 4) {
                activeKey = h.dataset.dayKey;
              }
            });
            if (activeKey) setActiveDay(activeKey);
          };

          const io = new IntersectionObserver(update, {
            root: null,
            rootMargin: `-${triggerOffset}px 0px 0px 0px`,
            threshold: [0, 1],
          });
          headerEls.forEach((h) => io.observe(h));
          this._dateNavObserver = io;
          update();
        });
      }
    }
  }

  _renderItem(session, theme, cfg, allSessions, getSpeakers, eventTimezone) {
    // IMPORTANT: create the custom element by tag name and set properties
    const el = document.createElement("namespace-vertical-agenda");
    el.session = session;
    el.theme = theme;

    // ⬇️ Pass getSpeakers into the component's config so it can hydrate title/company
    el.config = { ...cfg, allSessions: allSessions || [], getSpeakers, eventTimezone };

    return el;
  }

  _groupSessionsByDay(sessions, tz = "America/New_York") {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const map = new Map();
    sessions.forEach((s) => {
      const d = s?.startDateTime ? new Date(s.startDateTime) : null;
      const key = d ? fmt.format(d) : "Unknown"; // YYYY-MM-DD in event tz
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    });
    return map;
  }

  _formatDayKeyLabel(key) {
    if (key === "Unknown") return "Unknown Date";
    const [y, m, d] = key.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }

  _formatDayKeyLabelShort(key) {
    if (key === "Unknown") return "Unknown Date";
    const [y, m, d] = key.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
    });
  }

  _renderDayHeader(dayKey, theme, cfg) {
    const el = document.createElement("div");
    el.textContent = this._formatDayKeyLabel(dayKey);

    // theme styles (inline like Cvent example)
    const header3 = theme?.header3 ?? {};
    const { customClasses, ...styles } = header3;

    Object.assign(el.style, styles, {
      width: "calc(100% - 40px)",
      maxWidth: "1210px",
      margin: "0 auto 0 auto",
    });

    // Object.assign(el.style, styles, {
    //   width: "100% - 40px",
    //   maxWidth: "1210px",
    //   margin: "30 0 0 0",
    //   padding: "8px 20px",
    //   boxSizing: "border-box",
    //   position: "sticky",
    //   top: "0",
    //   zIndex: "100",
    //   backgroundColor: "#ffffff",
    // });

    if (Array.isArray(customClasses) && customClasses.length) {
      el.classList.add(...customClasses);
    }

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
      element.style.textDecorationLine = parts.size
        ? Array.from(parts).join(" ")
        : "";
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
