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
    // Render sequence: a render that is still awaiting session data must not
    // append into a container a newer render has since cleared (two config
    // updates in quick succession used to produce a doubled agenda).
    this._renderSeq = 0;
    // Opt-in session filters (type / location / category / tags): a Set of
    // selected values per facet. Empty set = facet not filtering.
    this._filters = { type: new Set(), location: new Set(), category: new Set(), tags: new Set() };
    this._openFacet = null;
  }

  async connectedCallback() {
    // Cvent's language selector updates <html lang> in place. Re-render when
    // the resolved language changes so every label (date tabs, "All days",
    // legend, counts, day headers) follows the attendee's choice immediately.
    if (typeof MutationObserver !== "undefined" && !this._langObserver) {
      this._langObserver = new MutationObserver(() => {
        const next = this._mapLang(document.documentElement.lang);
        if (next && next !== this._eventLang) this.onConfigurationUpdate(this.configuration);
      });
      this._langObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["lang"],
      });
    }
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
    if (this._langObserver) {
      this._langObserver.disconnect();
      this._langObserver = null;
    }
    if (this._docClick) {
      document.removeEventListener("click", this._docClick, true);
      this._docClick = null;
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
    const seq = ++this._renderSeq;
    const stale = () => seq !== this._renderSeq;

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
    this._headerEl = headerEl; // re-texted once the language is known
    headerEl.style.margin = "0";

    const subheaderEl = document.createElement("div");
    subheaderEl.textContent = subheaderText;
    this._subheaderEl = subheaderEl;
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

    // "Editorial" header style (opt-in; default "classic" leaves existing
    // events untouched): eyebrow + title + short accent rule + muted subheader,
    // legend inline under the masthead, pill-tab date nav, day headers with a
    // session count and hairline.
    const editorial = cfg.headerStyle === "editorial";
    this._editorial = editorial;
    this._eyebrowEl = null;
    if (editorial) {
      const mastStyle = document.createElement("style");
      mastStyle.textContent = `
        .agendaEyebrow { font-size:11px; font-weight:700; letter-spacing:.12em; text-transform:uppercase; color:#8a8a8a; margin-bottom:10px; min-height:1em; }
        .agendaTitleEditorial { font-weight:600 !important; letter-spacing:-0.01em; line-height:1.1; }
        .agendaTitleEditorial.isBold { font-weight:700 !important; }
        .agendaRule { width:40px; height:3px; border-radius:2px; margin:14px 0 12px; }
        .agendaSubEditorial { max-width:640px; line-height:1.45; }
        .agendaLegendEditorial { display:flex !important; flex-direction:row !important; flex-wrap:wrap; align-items:center !important; gap:6px 18px !important; }
        .agendaDayLeft { display:flex; align-items:baseline; flex-wrap:wrap; gap:6px 14px; min-width:0; }
        .agendaDayRight { display:flex; align-items:center; flex-wrap:wrap; justify-content:flex-end; gap:6px 18px; min-width:0; margin-left:auto; }
        @media (max-width: 600px) {
          /* Align with the cards' 15px side inset on phones and tighten the rhythm. */
          .agendaMasthead { width: calc(100% - 30px) !important; margin-top: 4px !important; }
          .agendaEyebrow { font-size: 10px; letter-spacing: .1em; margin-bottom: 6px; }
          .agendaRule { margin: 10px 0 8px; }
          .agendaSubEditorial { font-size: 15px !important; }
          .dayHeaderRow { width: calc(100% - 30px) !important; flex-direction: column !important; align-items: flex-start !important; gap: 6px !important; }
          .agendaDayRight { margin-left: 0; justify-content: flex-start; }
          .agendaLegendEditorial { gap: 4px 14px !important; }
        }
      `;
      container.appendChild(mastStyle);

      headerWrap.classList.add("agendaMasthead");
      headerWrap.style.gap = "0";
      headerWrap.style.margin = "8px auto 0 auto";

      const eyebrow = document.createElement("div");
      eyebrow.classList.add("agendaEyebrow");
      eyebrow.textContent = (cfg.headerEyebrow || "").trim();
      this._eyebrowEl = eyebrow; // filled with the event date range if blank

      headerEl.classList.add("agendaTitleEditorial");
      if (cfg.typography?.agendaHeader?.bold === true) headerEl.classList.add("isBold");
      if (!cfg.typography?.agendaHeader?.fontSize) headerEl.style.fontSize = "40px";

      const rule = document.createElement("div");
      rule.classList.add("agendaRule");
      rule.style.background = cfg.plenaryAccent || "#f7a325";

      subheaderEl.classList.add("agendaSubEditorial");
      if (!cfg.typography?.agendaSubheader?.color) subheaderEl.style.color = "#666";

      headerWrap.append(eyebrow, headerEl, rule, subheaderEl);
      // (Legend sits on the first day-header row, right side, next to the count.)
    } else {
      headerWrap.append(headerEl, subheaderEl);
    }
    container.appendChild(headerWrap);

    // (Focus legend is rendered inline with the first date header row below,
    // so it aligns vertically with the date.)

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
    let eventLang = "en"; // fallback language for legend/eyebrow phrasing
    try {
      const eventInfo = await this.cventSdk.getEventInfo?.();
      let rawTz = eventInfo?.timezone;
      if (rawTz && TZ_NORMALIZE[rawTz]) rawTz = TZ_NORMALIZE[rawTz];
      if (rawTz) eventTimezone = rawTz;
      // Detect the CURRENTLY SELECTED display language from <html lang>, which
      // Cvent updates when the attendee uses the language selector. Fall back to
      // the event's default locale if html lang isn't a recognized language.
      const mapLang = (code) => this._mapLang(code);
      const htmlLang = mapLang(document.documentElement.lang);
      const locales = eventInfo?.locales || [];
      const def = locales.find((l) => l.isDefault) || locales[0];
      const defaultLang = mapLang(def?.cultureCode);
      eventLang = htmlLang || defaultLang || "en";
    } catch (e) {
      console.warn("getEventInfo error:", e);
    }
    this._eventLang = eventLang;
    // Planner text may have a translation for this language; apply it now
    // (the masthead was built before the language was known).
    this._applyPlannerText();

    // Session data doesn't change with config or filters, so re-renders reuse
    // the last fetch (keyed by sort + page size). A page reload refetches.
    const cacheKey = `${sort}|${pageSize}`;
    const cached =
      this._sessionCache && this._sessionCache.key === cacheKey
        ? this._sessionCache.sessions
        : null;
    if (!gen && !cached) {
      console.warn("[widget.js] No session generator available.");
      return; // keep placeholder
    }

    const sessions = cached ? [...cached] : [];
    if (!cached) {
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
      this._sessionCache = { key: cacheKey, sessions: [...sessions] };
    }
    if (stale()) return; // a newer render owns the container now

    // Visibility is controlled solely by the "Hide from main agenda?" custom
    // field. Registration status (isOpenForRegistration) is intentionally
    // ignored so closed sessions still appear on the agenda.
    const openSessions = sessions.filter(s => {
      const hideField = s.sessionCustomFields?.find(f => f.name === "Hide from main agenda?");
      return !hideField?.value?.includes("Yes");
    });

    // If we have data, remove placeholder
    const placeholder = container.querySelector("div[style*='height: 200px']");
    if (openSessions.length && placeholder) {
      container.removeChild(placeholder);
    }

    // ---- Session filters (opt-in): type / location / category / tags ----
    // The nav, eyebrow and "appears in" lists use ALL open sessions; only the
    // rendered day sections use the filtered list.
    const filtersOn = cfg.showFilters === true && openSessions.length > 0;
    const filtered = filtersOn ? this._applySessionFilters(openSessions) : openSessions;

    // Client-side fallback sort (matches your original)
    const sortSessions = (list) => [...list].sort((a, b) => {
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
    const sortedAll = sortSessions(openSessions);
    const sorted = filtersOn ? sortSessions(filtered) : sortedAll;

    // Resolve getSpeakers once per render
    const getSpeakers = this._resolveGetSpeakers();
    if (!getSpeakers) {
      console.warn(
        "[widget.js] getSpeakers not found; speakers will not hydrate (title/company may be empty)."
      );
    }

    // Render
    if (cfg.groupByDay === false) {
      if (filtersOn) container.appendChild(this._buildFilterBar(openSessions, cfg));
      sorted.forEach((s) =>
        container.appendChild(
          this._renderItem(s, theme, cfg, openSessions, getSpeakers, eventTimezone)
        )
      );
    } else {
      const groups = this._groupSessionsByDay(sorted, eventTimezone);
      // Nav tabs + eyebrow come from ALL days so they stay put while filters
      // narrow which days actually render a section.
      const groupsAll = filtersOn ? this._groupSessionsByDay(sortedAll, eventTimezone) : groups;
      const dayKeys = [...groupsAll.keys()];

      if (this._eyebrowEl && !this._eyebrowEl.textContent && dayKeys.length) {
        this._eyebrowEl.textContent = this._formatDayRange(dayKeys);
      }

      // Date nav: a plain (non-sticky) row of day links under the subheader.
      // Clicking a day scrolls its header just below Cvent's own site header.
      const showDateNav = cfg.hideDateNav !== true;
      const dn = cfg.dateNav || {};
      // "filter": the nav shows ONE day at a time (no scrolling back up to pick
      // another day). "jump" (default): all days listed, links scroll to them.
      const filterMode =
        cfg.dateNavMode === "filter" && showDateNav && dayKeys.length > 1;
      const ALL_DAYS = "__all__"; // filter-mode key for "no filter"

      const dayHeaderRefs = {};
      const daySections = {};
      const navLinks = {};
      let dateNav = null;
      let showDay = null; // assigned after the day sections exist (filter mode)

      const setActiveDay = (activeKey) => {
        Object.entries(navLinks).forEach(([key, link]) => {
          link.classList.toggle("active", key === activeKey);
        });
      };

      if (showDateNav) {
        const dnStyle = document.createElement("style");
        dnStyle.textContent = editorial
          ? `
        .dateNav {
          display:flex; flex-wrap:nowrap; align-items:stretch; gap:4px; overflow-x:auto;
          scroll-snap-type:x mandatory; -webkit-overflow-scrolling:touch;
          scrollbar-width:none;
          width: calc(100% - 40px); max-width: 1210px; margin: 16px auto 0;
          padding: 4px; box-sizing: border-box;
          background: ${dn.navBg && dn.navBg.toLowerCase() !== "#ffffff" ? dn.navBg : "#f3f4f6"};
          border-radius: 14px;
        }
        .dateNav::-webkit-scrollbar { display:none; }
        .dateNav button {
          position: relative;
          flex: 0 0 auto; scroll-snap-align:start;
          display:flex; flex-direction:column; align-items:center; gap:1px;
          min-width: 68px; padding: 8px 14px 10px; border:none; border-radius:10px;
          background: transparent; cursor:pointer; font-family: inherit;
          color: ${dn.inactiveColor || "#6b6b6b"};
          transition: background .15s ease, color .15s ease, box-shadow .15s ease;
        }
        .dateNav button:hover { background: rgba(255,255,255,.55); }
        .dateNav .navDow { font-size:10px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; opacity:.85; }
        .dateNav .navDay { font-size:${dn.fontSize ?? 18}px; font-weight:700; line-height:1.1; }
        .dateNav .navMon { font-size:11px; font-weight:500; opacity:.85; }
        /* Active = a raised white segment (segmented-control style). The accent is
           used sparingly: the day number and a short underline, not a solid fill. */
        .dateNav button.active {
          background: #ffffff;
          color: ${dn.activeColor || "#111111"};
          box-shadow: 0 1px 2px rgba(0,0,0,.08), 0 3px 10px rgba(0,0,0,.10);
        }
        .dateNav button.active .navDow, .dateNav button.active .navMon { opacity: 1; }
        .dateNav button.active .navDay { color: ${this._textAccent(cfg.plenaryAccent || "#f7a325")}; }
        .dateNav button.active::after {
          content: ""; position: absolute; left: 50%; bottom: 5px; width: 18px; height: 3px;
          transform: translateX(-50%); border-radius: 2px;
          background: ${cfg.plenaryAccent || "#f7a325"};
        }
        /* "All days": same footprint as a day tab (two lines, centred), then a hairline. */
        .dateNav .navAll { justify-content: center; }
        .dateNav .navDivider { flex: 0 0 1px; align-self: stretch; margin: 8px 4px; background: rgba(0,0,0,.12); }
        @media (max-width: 1024px) {
          .dateNav .navDay { font-size: ${dn.fontSizeMd ?? 16}px; }
        }
        @media (max-width: 600px) {
          .dateNav { width: calc(100% - 30px); margin-top: 14px; padding: 4px; border-radius: 12px; }
          .dateNav button { min-width: 54px; padding: 6px 9px; }
          .dateNav .navDow { font-size: 9px; }
          .dateNav .navDay { font-size: ${dn.fontSizeSm ?? 15}px; }
          .dateNav .navMon { font-size: 10px; }
        }
        `
          : `
        .dateNav {
          display: flex; flex-wrap: wrap; gap: 16px;
          width: calc(100% - 40px); max-width: 1210px; margin: 0 auto;
          box-sizing: border-box;
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
          text-decoration-color: ${cfg.plenaryAccent || "#f7a325"};
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

        // Bottom edge of Cvent's (pinned) site header, so a day jump doesn't
        // land underneath it. Measured live at click time (Playbook §9).
        const measureCventHeader = () => {
          const selectors = ["#navigationContainer", ".cus_nav"];
          for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) {
              const r = el.getBoundingClientRect();
              if (r.height > 0) return Math.max(0, Math.round(r.bottom));
            }
          }
          return 0;
        };

        if (filterMode) {
          // "All days" tab: clears the filter. Active by default.
          const allLink = document.createElement("button");
          allLink.type = "button";
          const allLabel = this._allDaysLabel();
          if (editorial) {
            // Two stacked lines ("All" / "days") so the tab matches the
            // weekday / day / month tabs beside it; same active treatment.
            allLink.classList.add("navAll");
            const big = document.createElement("span");
            big.className = "navDay";
            big.textContent = allLabel.big;
            const small = document.createElement("span");
            small.className = "navMon";
            small.textContent = allLabel.small;
            allLink.append(big, small);
            allLink.setAttribute("aria-label", allLabel.full);
          } else {
            allLink.textContent = allLabel.full;
          }
          allLink.addEventListener("click", () => {
            if (showDay) showDay(ALL_DAYS);
          });
          navLinks[ALL_DAYS] = allLink;
          dateNav.appendChild(allLink);
          if (editorial) {
            const divider = document.createElement("span");
            divider.className = "navDivider";
            divider.setAttribute("aria-hidden", "true");
            dateNav.appendChild(divider);
          }
        }

        dayKeys.forEach((dayKey) => {
          const link = document.createElement("button");
          link.type = "button";

          if (editorial) {
            // Weekday / day number / month stacked in a pill tab.
            const parts = this._dayKeyParts(dayKey);
            const dow = document.createElement("span");
            dow.className = "navDow";
            dow.textContent = parts.weekday;
            const day = document.createElement("span");
            day.className = "navDay";
            day.textContent = parts.day;
            const mon = document.createElement("span");
            mon.className = "navMon";
            mon.textContent = parts.month;
            link.append(dow, day, mon);
            link.setAttribute("aria-label", this._formatDayKeyLabel(dayKey));
          } else {
            const fullLabel = document.createElement("span");
            fullLabel.className = "navLabelFull";
            fullLabel.textContent = this._formatDayKeyLabel(dayKey);

            const shortLabel = document.createElement("span");
            shortLabel.className = "navLabelShort";
            shortLabel.textContent = this._formatDayKeyLabelShort(dayKey);

            link.append(fullLabel, shortLabel);
          }

          link.addEventListener("click", () => {
            if (filterMode) {
              // Clicking the active day again clears the filter.
              if (showDay) showDay(this._activeDayKey === dayKey ? ALL_DAYS : dayKey);
              return;
            }
            setActiveDay(dayKey);
            const target = dayHeaderRefs[dayKey];
            if (!target) return;

            const targetTop = () =>
              target.getBoundingClientRect().top +
              window.pageYOffset -
              (measureCventHeader() + 12);

            // Eased scroll that runs to completion, then a gentle second pass
            // if lazy images shifted the layout underneath us. (The previous
            // version cut the native smooth scroll off after a fixed 650ms and
            // jumped, which read as a snap on longer distances.)
            this._smoothScrollTo(targetTop()).then((completed) => {
              if (!completed) return; // user took over scrolling
              const drift = Math.abs(target.getBoundingClientRect().top - (measureCventHeader() + 12));
              if (drift > 4) this._smoothScrollTo(targetTop(), { duration: 260 });
            });
          });

          navLinks[dayKey] = link;
          dateNav.appendChild(link);
        });

        container.appendChild(dateNav);
      }

      if (filtersOn) container.appendChild(this._buildFilterBar(openSessions, cfg));

      // --- Render headers + sessions (always, nav or not) ---
      const legendEnabled =
        cfg.showAccentBar === true && cfg.showFocusLegend === true;
      let isFirstHeader = true;
      for (const [dayKey, daySessions] of groups) {
        // One section per day so filter mode can show/hide whole days.
        const section = document.createElement("div");
        section.classList.add("daySection");
        section.dataset.dayKey = dayKey;
        // Same layout as the container itself so cards keep their spacing and
        // the concurrent grid's last rail label doesn't bleed into the next card.
        section.style.display = "flex";
        section.style.flexDirection = "column";
        section.style.gap = "12px";
        section.style.width = "100%";
        daySections[dayKey] = section;

        // In filter mode every day is rendered as if it were the first (each
        // is the only one visible), so the legend / start rule go on all of them.
        const treatAsFirst = isFirstHeader || filterMode;
        const header = this._renderDayHeader(dayKey, theme, cfg, {
          count: daySessions.length,
          isFirst: treatAsFirst,
          showLegend: treatAsFirst && legendEnabled,
        });
        header.dataset.dayKey = dayKey;
        dayHeaderRefs[dayKey] = header;

        // On the first day header, place it in a row with the focus legend
        // right-aligned so the legend aligns vertically with the date.
        if (treatAsFirst && legendEnabled && !editorial) {
          const isMobile =
            (window.innerWidth || document.documentElement.clientWidth || 1920) <=
            600;
          const row = document.createElement("div");
          row.style.display = "flex";
          // On mobile, stack date over legend so neither is crowded/wraps oddly.
          row.style.flexDirection = isMobile ? "column" : "row";
          row.style.alignItems = isMobile ? "flex-start" : "center";
          row.style.justifyContent = "space-between";
          row.style.gap = isMobile ? "4px" : "12px";
          row.style.width = "calc(100% - 40px)";
          row.style.maxWidth = "1210px";
          row.style.margin = "0 auto";
          row.style.boxSizing = "border-box";

          // The header's own width/margin would fight the row; neutralize them.
          header.style.width = "auto";
          header.style.maxWidth = "none";
          header.style.margin = "0";

          const dayLegend = this._buildFocusLegend(cfg);
          dayLegend.classList.add("dayLegend");
          row.append(header, dayLegend);
          section.appendChild(row);
        } else {
          section.appendChild(header);
        }

        // Thin divider under the FIRST date/legend to mark where the agenda
        // begins (classic only; editorial day headers carry their own rule).
        if (treatAsFirst && !editorial) {
          const startLine = document.createElement("div");
          startLine.classList.add("dayStartLine");
          startLine.style.width = "calc(100% - 40px)";
          startLine.style.maxWidth = "1210px";
          startLine.style.margin = "6px auto 2px auto";
          startLine.style.borderTop = "1px solid #d9d9d9";
          startLine.style.boxSizing = "border-box";
          section.appendChild(startLine);
        }
        isFirstHeader = false;

        // Concurrent tiles are opt-in. When OFF (default), render every session
        // in a single column in start-time order (classic layout). When ON,
        // overlapping sessions form side-by-side tile groups.
        if (cfg.concurrentTiles === true) {
          const blocks = this._buildDayBlocks(daySessions);
          blocks.forEach((blk) => {
            if (blk.type === "single") {
              section.appendChild(
                this._renderItem(
                  blk.session, theme, cfg, openSessions, getSpeakers, eventTimezone
                )
              );
            } else {
              section.appendChild(
                this._renderConcurrentGroup(
                  blk, theme, cfg, openSessions, getSpeakers, eventTimezone
                )
              );
            }
          });
        } else {
          // Single-column classic: every session as a normal card, in order.
          daySessions.forEach((s) => {
            section.appendChild(
              this._renderItem(
                s, theme, cfg, openSessions, getSpeakers, eventTimezone
              )
            );
          });
        }
        container.appendChild(section);
      }

      // Empty state when filters leave nothing to show (in the current day view).
      const emptyEl = document.createElement("div");
      emptyEl.classList.add("agendaEmpty");
      emptyEl.style.display = "none";
      if (filtersOn) {
        const msg = document.createElement("div");
        msg.textContent = this._t("noMatches");
        emptyEl.appendChild(msg);
        if (this._filtersActive()) {
          const clr = document.createElement("button");
          clr.type = "button";
          clr.classList.add("filterClear");
          clr.textContent = this._t("clearFilters");
          clr.addEventListener("click", () => this._clearFilters());
          emptyEl.appendChild(clr);
        }
      }
      container.appendChild(emptyEl);
      const updateEmpty = () => {
        const anyVisible = Object.values(daySections).some((sec) => sec.style.display !== "none");
        emptyEl.style.display = !anyVisible && filtersOn ? "" : "none";
      };

      if (filterMode) {
        showDay = (key) => {
          this._activeDayKey = key;
          let firstVisible = true;
          dayKeys.forEach((k) => {
            const sec = daySections[k];
            if (!sec) return; // day filtered out entirely
            const visible = key === ALL_DAYS || k === key;
            // "flex" (not ""): the section's own layout is inline flex/column.
            sec.style.display = visible ? "flex" : "none";
            if (!visible) return;
            // Every day carries a legend + start rule (any of them can be the
            // only one visible); show them on the FIRST visible day only.
            sec.querySelectorAll(".dayLegend, .dayStartLine").forEach((n) => {
              if (n.dataset.disp === undefined) n.dataset.disp = n.style.display;
              n.style.display = firstVisible ? n.dataset.disp : "none";
            });
            const row = sec.querySelector(".dayHeaderRow");
            if (row) row.style.marginTop = firstVisible ? "22px" : "32px";
            firstVisible = false;
          });
          setActiveDay(key);
          updateEmpty();
        };
        const remembered = this._activeDayKey;
        showDay(
          remembered === ALL_DAYS || dayKeys.includes(remembered)
            ? remembered
            : ALL_DAYS
        );
      } else {
        if (showDateNav && dayKeys.length) {
          // Highlight the first day by default; clicks move the highlight.
          setActiveDay(dayKeys[0]);
        }
        updateEmpty();
      }
    }
  }

  // ===========================================================
  // SESSION FILTERS (opt-in): type / location / category / tags
  // ===========================================================

  _sessionTagsOf(s) {
    const field = s?.sessionCustomFields?.find((f) => f.name?.trim().toLowerCase() === "tags");
    const raw = Array.isArray(field?.value) ? field.value : [];
    const seen = new Set();
    const out = [];
    raw.forEach((v) => {
      if (typeof v !== "string") return;
      const tag = v.trim();
      if (!tag || seen.has(tag.toLowerCase())) return;
      seen.add(tag.toLowerCase());
      out.push(tag);
    });
    return out;
  }

  _sessionTypeOf(s) {
    const f = this._detectSessionFields(s);
    return f.isBreak ? "break" : f.isFocus ? "focus" : "plenary";
  }

  // Distinct facet values across the given sessions (sorted, case-insensitive).
  _sessionFacets(sessions) {
    const uniq = (vals) => {
      const m = new Map();
      vals.forEach((v) => { const k = (v || "").trim(); if (k && !m.has(k.toLowerCase())) m.set(k.toLowerCase(), k); });
      return [...m.values()].sort((a, b) => a.localeCompare(b));
    };
    const types = new Set(sessions.map((s) => this._sessionTypeOf(s)).filter((x) => x !== "break"));
    const typeLabel = (k) =>
      k === "focus"
        ? this._plannerText("focusLabel", "Focus")
        : this._capFirst(this._plannerText("plenaryLabel", "plenary"));
    return {
      type: ["plenary", "focus"].filter((k) => types.has(k)).map((k) => ({ value: k, label: typeLabel(k) })),
      location: uniq(sessions.map((s) => s?.location?.name)).map((v) => ({ value: v, label: v })),
      category: uniq(sessions.map((s) => s?.category?.name)).map((v) => ({ value: v, label: v })),
      tags: uniq(sessions.flatMap((s) => this._sessionTagsOf(s))).map((v) => ({ value: v, label: v })),
    };
  }

  _filtersActive() {
    return Object.values(this._filters || {}).some((set) => set.size > 0);
  }

  // AND across facets, OR within a facet. Breaks are hidden when a TYPE filter
  // is active (they are neither plenary nor focus).
  _applySessionFilters(list) {
    const F = this._filters;
    const has = (set, v) => [...set].some((x) => x.toLowerCase() === (v || "").trim().toLowerCase());
    return list.filter((s) => {
      if (F.type.size) {
        const ty = this._sessionTypeOf(s);
        if (ty === "break" || !F.type.has(ty)) return false;
      }
      if (F.location.size && !has(F.location, s?.location?.name)) return false;
      if (F.category.size && !has(F.category, s?.category?.name)) return false;
      if (F.tags.size && !this._sessionTagsOf(s).some((tg) => has(F.tags, tg))) return false;
      return true;
    });
  }

  _clearFilters() {
    Object.values(this._filters).forEach((set) => set.clear());
    this._openFacet = null;
    this._rerender();
  }

  // Re-render from the session cache (no refetch).
  _rerender() {
    this.onConfigurationUpdate(this.configuration);
  }

  _rgba(hex, a) {
    const h = (hex || "").trim().replace("#", "");
    const x = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    if (x.length !== 6) return `rgba(0,0,0,${a})`;
    const r = parseInt(x.slice(0, 2), 16), g = parseInt(x.slice(2, 4), 16), b = parseInt(x.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  // The filter bar: one chip per facet that has 2+ values, each opening a
  // checkbox menu; a "Clear filters" link when anything is active.
  _buildFilterBar(sessions, cfg) {
    const accent = cfg.plenaryAccent || "#f7a325";
    const accentText = this._textAccent(accent);
    const facets = this._sessionFacets(sessions);
    const wrap = document.createElement("div");
    wrap.classList.add("filterBar");

    const style = document.createElement("style");
    style.textContent = `
      .filterBar { display:flex; flex-wrap:wrap; align-items:center; gap:8px; width:calc(100% - 40px); max-width:1210px; margin:12px auto 0; box-sizing:border-box; }
      .filterFacet { position:relative; }
      .filterBtn {
        appearance:none; display:inline-flex; align-items:center; gap:6px;
        padding:7px 12px; border-radius:999px; border:1px solid #d0d5dd; background:#fff;
        color:#333; font-family:inherit; font-size:12px; font-weight:600; line-height:1.2;
        letter-spacing:.02em; cursor:pointer; transition:border-color .15s, background .15s, color .15s;
      }
      .filterBtn:hover { border-color:#9aa0a6; }
      .filterBtn .caret { font-size:9px; opacity:.6; }
      .filterBtn.active { border-color:${accentText}; color:${accentText}; background:${this._rgba(accent, 0.12)}; }
      .filterBtn .count { font-size:10px; font-weight:700; background:${accent}; color:${this._readableOn(accent)}; border-radius:999px; padding:1px 6px; line-height:1.4; }
      .filterMenu {
        position:absolute; top:calc(100% + 6px); left:0; z-index:60; min-width:220px; max-width:320px;
        max-height:280px; overflow:auto; background:#fff; border:1px solid #e3e5ea; border-radius:10px;
        box-shadow:0 8px 24px rgba(0,0,0,.12); padding:6px; box-sizing:border-box;
      }
      .filterMenu label { display:flex; align-items:center; gap:8px; padding:7px 8px; border-radius:6px; font-size:13px; color:#222; cursor:pointer; }
      .filterMenu label:hover { background:#f3f4f6; }
      .filterMenu input { accent-color:${accent}; margin:0; }
      .filterClear { appearance:none; border:none; background:transparent; color:#666; font-family:inherit; font-size:12px; font-weight:600; text-decoration:underline; cursor:pointer; padding:6px 4px; }
      .agendaEmpty { width:calc(100% - 40px); max-width:1210px; margin:28px auto; text-align:center; color:#666; font-size:15px; display:flex; flex-direction:column; align-items:center; gap:6px; box-sizing:border-box; }
      @media (max-width:600px) { .filterBar { width:calc(100% - 30px); gap:6px; } .filterBtn { padding:6px 10px; font-size:11px; } .agendaEmpty { width:calc(100% - 30px); } }
    `;
    wrap.appendChild(style);

    const closeAll = () => wrap.querySelectorAll(".filterMenu").forEach((m) => (m.hidden = true));
    if (!this._docClick) {
      this._docClick = (e) => {
        const path = e.composedPath ? e.composedPath() : [];
        if (!path.some((n) => n && n.classList && n.classList.contains("filterFacet"))) {
          this._openFacet = null;
          closeAll();
        }
      };
      document.addEventListener("click", this._docClick, true);
    }

    const FACETS = [
      ["type", this._t("filterType")],
      ["location", this._t("filterLocation")],
      ["category", this._t("filterCategory")],
      ["tags", this._t("filterTags")],
    ];
    FACETS.forEach(([key, label]) => {
      const values = facets[key];
      if (!values || values.length < 2) return; // nothing to choose between
      const selected = this._filters[key];
      const facet = document.createElement("div");
      facet.classList.add("filterFacet");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.classList.add("filterBtn");
      if (selected.size) btn.classList.add("active");
      btn.setAttribute("aria-haspopup", "true");
      const txt = document.createElement("span");
      txt.textContent = label;
      btn.appendChild(txt);
      if (selected.size) {
        const count = document.createElement("span");
        count.classList.add("count");
        count.textContent = String(selected.size);
        btn.appendChild(count);
      }
      const caret = document.createElement("span");
      caret.classList.add("caret");
      caret.textContent = "\u25BC";
      btn.appendChild(caret);

      const menu = document.createElement("div");
      menu.classList.add("filterMenu");
      menu.hidden = this._openFacet !== key;
      btn.setAttribute("aria-expanded", menu.hidden ? "false" : "true");
      values.forEach(({ value, label: vLabel }) => {
        const row = document.createElement("label");
        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = [...selected].some((x) => x.toLowerCase() === value.toLowerCase());
        cb.addEventListener("change", () => {
          if (cb.checked) selected.add(value);
          else [...selected].forEach((x) => { if (x.toLowerCase() === value.toLowerCase()) selected.delete(x); });
          this._openFacet = key; // keep this menu open across the re-render
          this._rerender();
        });
        const span = document.createElement("span");
        span.textContent = vLabel;
        row.append(cb, span);
        menu.appendChild(row);
      });
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const open = menu.hidden;
        closeAll();
        menu.hidden = !open;
        this._openFacet = open ? key : null;
        btn.setAttribute("aria-expanded", open ? "true" : "false");
      });
      facet.append(btn, menu);
      wrap.appendChild(facet);
    });

    if (this._filtersActive()) {
      const clr = document.createElement("button");
      clr.type = "button";
      clr.classList.add("filterClear");
      clr.textContent = this._t("clearFilters");
      clr.addEventListener("click", () => this._clearFilters());
      wrap.appendChild(clr);
    }
    return wrap;
  }

  // ===========================================================
  // CONCURRENT SESSION GROUPING (Stage 1: detection + columns)
  // ===========================================================

  // Two sessions overlap only if their time ranges STRICTLY intersect.
  // Touching at a boundary (one ends when the next starts) is NOT overlap.
  _sessionsOverlap(a, b) {
    const aStart = a?.startDateTime ? new Date(a.startDateTime).getTime() : null;
    const aEnd = a?.endDateTime ? new Date(a.endDateTime).getTime() : null;
    const bStart = b?.startDateTime ? new Date(b.startDateTime).getTime() : null;
    const bEnd = b?.endDateTime ? new Date(b.endDateTime).getTime() : null;
    if (aStart == null || aEnd == null || bStart == null || bEnd == null) {
      return false; // missing times -> treat as non-overlapping (standalone)
    }
    return aStart < bEnd && bStart < aEnd;
  }

  // Split a day's sessions into an ordered list of "blocks". Each block is
  // either { type: "single", session } or { type: "group", sessions: [...] }.
  // Breaks are always standalone singles, even if their time overlaps.
  // Order is by start time so the agenda reads top-to-bottom chronologically.
  _buildDayBlocks(daySessions) {
    const isBreakSession = (s) => {
      const f = s?.sessionCustomFields?.find(
        (x) => x.name?.trim().toLowerCase() === "break session?"
      );
      return !!f?.value?.includes("Yes");
    };

    // Sessions eligible to participate in concurrency (non-breaks with times)
    const eligible = [];
    const forcedSingles = [];
    daySessions.forEach((s) => {
      const hasTimes = s?.startDateTime && s?.endDateTime;
      if (isBreakSession(s) || !hasTimes) forcedSingles.push(s);
      else eligible.push(s);
    });

    // Union-find style clustering: group eligible sessions that overlap
    // transitively (A-B overlap, B-C overlap => A,B,C one group).
    const clusters = [];
    eligible.forEach((s) => {
      let placed = null;
      for (const cluster of clusters) {
        if (cluster.some((c) => this._sessionsOverlap(c, s))) {
          if (placed) {
            // s bridges two clusters -> merge them
            placed.push(...cluster);
            cluster.length = 0;
          } else {
            cluster.push(s);
            placed = cluster;
          }
        }
      }
      if (!placed) clusters.push([s]);
    });
    const realClusters = clusters.filter((c) => c.length > 0);

    // Build blocks: a cluster of 1 is a single; 2+ is a concurrent group.
    const blocks = [];
    realClusters.forEach((cluster) => {
      if (cluster.length === 1) {
        blocks.push({ type: "single", session: cluster[0] });
      } else {
        // Sort by start, then end. Tiebreaker for SAME start time: plenary
        // (non-focus) sessions come first so they claim the left columns, and
        // focus sessions come last so they land on the right.
        const isFocusSession = (s) => {
          const f = s?.sessionCustomFields?.find(
            (x) => x.name?.trim().toLowerCase() === "focus session?"
          );
          return !!f?.value?.includes("Yes");
        };
        const sorted = [...cluster].sort((a, b) => {
          const startDiff =
            new Date(a.startDateTime) - new Date(b.startDateTime);
          if (startDiff !== 0) return startDiff;
          // Same start time: plenary (false=0) before focus (true=1).
          const focusDiff = (isFocusSession(a) ? 1 : 0) - (isFocusSession(b) ? 1 : 0);
          if (focusDiff !== 0) return focusDiff;
          return new Date(a.endDateTime) - new Date(b.endDateTime);
        });
        blocks.push({
          type: "group",
          sessions: sorted,
          columns: this._assignColumns(sorted),
        });
      }
    });
    forcedSingles.forEach((s) => blocks.push({ type: "single", session: s }));

    // Order all blocks by their earliest start time
    const blockStart = (blk) =>
      blk.type === "single"
        ? new Date(blk.session.startDateTime || 0).getTime()
        : new Date(blk.sessions[0].startDateTime || 0).getTime();
    blocks.sort((a, b) => blockStart(a) - blockStart(b));
    return blocks;
  }

  // Option B column assignment: each session takes the first column whose
  // last-placed session has already ended. Returns { colOf: Map, colCount }.
  _assignColumns(sortedSessions) {
    const colEndTimes = []; // colEndTimes[i] = end time of last session in col i
    const colOf = new Map(); // session -> column index
    sortedSessions.forEach((s) => {
      const start = new Date(s.startDateTime).getTime();
      const end = new Date(s.endDateTime).getTime();
      let col = colEndTimes.findIndex((endT) => endT <= start);
      if (col === -1) {
        col = colEndTimes.length;
        colEndTimes.push(end);
      } else {
        colEndTimes[col] = end;
      }
      colOf.set(s, col);
    });
    return { colOf, colCount: colEndTimes.length };
  }

  // ===========================================================
  // CONCURRENT GROUP RENDERING (Stage 2: time-grid geometry)
  // ===========================================================
  _renderConcurrentGroup(blk, theme, cfg, allSessions, getSpeakers, eventTimezone) {
    const colCount = blk.columns.colCount;

    // Decide grid vs. stacked based on per-tile width. When columns would be
    // narrower than MIN_TILE_W, collapse to a single vertical stack (mobile).
    const MIN_TILE_W = 150;
    const RAIL_RESERVE = 88; // rail width + gap, matches grid layout
    const viewportW =
      window.innerWidth || document.documentElement.clientWidth || 1920;
    const usableW = Math.min(viewportW - 40, 1210) - RAIL_RESERVE;
    const perTileW = usableW / colCount;

    if (perTileW < MIN_TILE_W) {
      return this._renderConcurrentStack(
        blk, theme, cfg, allSessions, getSpeakers, eventTimezone
      );
    }

    return this._renderConcurrentGrid(
      blk, theme, cfg, allSessions, getSpeakers, eventTimezone
    );
  }

  // Mobile / narrow: stack the group's sessions vertically in start-time order,
  // full-width content-height cards, with a grouping accent + shared time header
  // so they still read as concurrent.
  _renderConcurrentStack(blk, theme, cfg, allSessions, getSpeakers, eventTimezone) {
    const tz = eventTimezone || "America/New_York";
    const sessions = [...blk.sessions].sort(
      (a, b) => new Date(a.startDateTime) - new Date(b.startDateTime)
    );

    const wrap = document.createElement("div");
    wrap.classList.add("concurrentStack");
    wrap.style.width = "calc(100% - 40px)";
    wrap.style.maxWidth = "1210px";
    wrap.style.margin = "0 auto";
    wrap.style.boxSizing = "border-box";
    wrap.style.paddingTop = "14px";
    // Left accent binds the group visually.
    wrap.style.borderLeft = "3px solid #c9c9c9";
    wrap.style.paddingLeft = "12px";

    // Shared time header spanning the group's overall window.
    const groupStart = new Date(
      Math.min(...sessions.map((s) => new Date(s.startDateTime).getTime()))
    );
    const groupEnd = new Date(
      Math.max(...sessions.map((s) => new Date(s.endDateTime).getTime()))
    );
    const fmt = (d) =>
      d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: tz,
      });
    const header = document.createElement("div");
    header.style.fontSize = "13px";
    header.style.fontWeight = "700";
    header.style.marginBottom = "10px";
    header.textContent = `${fmt(groupStart)}–${fmt(groupEnd)} · ${this._t("concurrentSessions")}`;
    wrap.appendChild(header);

    // Each session as a full-width, content-height compact TILE card (same
    // look as desktop tiles, not the heavy standalone card).
    const stackInner = document.createElement("div");
    stackInner.style.display = "flex";
    stackInner.style.flexDirection = "column";
    stackInner.style.gap = "10px";
    sessions.forEach((s) => {
      const el = document.createElement("namespace-vertical-agenda");
      el.session = s;
      el.theme = theme;
      el.config = {
        ...cfg,
        allSessions: allSessions || [],
        getSpeakers,
        eventTimezone,
        ...this._detectSessionFields(s),
        eventLang: this._eventLang || "en",
        tileMode: true,
        tileStack: true, // content-height, no fixed-height truncation
      };
      el.style.display = "block";
      el.style.width = "100%";
      stackInner.appendChild(el);
    });
    wrap.appendChild(stackInner);

    return wrap;
  }

  _renderConcurrentGrid(blk, theme, cfg, allSessions, getSpeakers, eventTimezone) {
    // --- Tunable geometry constants ---
    const PX_PER_MIN = 4; // tuned for a 30-60 min session norm (30min ~= content floor)
    const MIN_H = 118; // floor for FULL tiles: title + time + speaker row + some description
    // Shorter sessions get shorter floors so the time axis barely stretches and
    // a 5-minute item doesn't loom as large as a 30-minute one:
    //   <= 15 min  -> "strip"   (one line: title · time · tiny avatars)
    //   16–29 min  -> "compact" (title, time, avatar row; no description)
    //   >= 30 min  -> "full"
    const STRIP_H = 48;
    const COMPACT_H = 104;
    const MAX_H = 440; // cap (~110 min at 4px/min) so very long sessions don't dominate
    const ROW_GAP = 5; // visual gap below each tile (separates stacked tiles)
    const RAIL_W = 80; // left time-rail width (matches single-card gutter)
    const COL_GAP = 12; // gap between columns

    const tz = eventTimezone || "America/New_York";
    const sessions = blk.sessions;
    const { colOf, colCount } = blk.columns;

    // Group start = earliest start; all positions measured from it.
    const groupStartMs = Math.min(
      ...sessions.map((s) => new Date(s.startDateTime).getTime())
    );
    const startMsOf = (s) => new Date(s.startDateTime).getTime();
    const endMsOf = (s) => new Date(s.endDateTime).getTime();
    const durMin = (s) => (endMsOf(s) - startMsOf(s)) / 60000;
    const tierOf = (s) => (durMin(s) <= 15 ? "strip" : durMin(s) < 30 ? "compact" : "full");
    const minHFor = (s) =>
      tierOf(s) === "strip" ? STRIP_H : tierOf(s) === "compact" ? COMPACT_H : MIN_H;

    // Determine the last tile in each column (it should NOT be gap-trimmed, so
    // it reaches its true end-time gridline).
    const lastInColumn = new Set();
    for (let c = 0; c < colCount; c++) {
      const colSessions = sessions
        .filter((x) => colOf.get(x) === c)
        .sort((a, b) => startMsOf(a) - startMsOf(b));
      if (colSessions.length) lastInColumn.add(colSessions[colSessions.length - 1]);
    }

    // Time -> px scale. Linear at PX_PER_MIN, but STRETCHED wherever a session
    // would otherwise render shorter than MIN_H. Positioning tiles by pure time
    // math while clamping their height up to MIN_H let a short (e.g. 20-min)
    // tile bleed under the next tile in its column, which painted over the
    // speaker avatars pinned to its bottom. Stretching the scale keeps every
    // tile at least MIN_H tall AND collision-free; the rail labels still show
    // the true times, the axis is just non-uniform around short sessions.
    const boundaries = [
      ...new Set(sessions.flatMap((s) => [startMsOf(s), endMsOf(s)])),
    ].sort((a, b) => a - b);
    const posOfMs = new Map();
    boundaries.forEach((ms, i) => {
      if (i === 0) {
        posOfMs.set(ms, 0);
        return;
      }
      const prevMs = boundaries[i - 1];
      let pos =
        posOfMs.get(prevMs) + Math.round(((ms - prevMs) / 60000) * PX_PER_MIN);
      sessions.forEach((s) => {
        if (endMsOf(s) !== ms) return;
        const need = minHFor(s) + (lastInColumn.has(s) ? 0 : ROW_GAP);
        pos = Math.max(pos, posOfMs.get(startMsOf(s)) + need);
      });
      posOfMs.set(ms, pos);
    });
    // True time position of any timestamp (px from group start).
    const timePos = (ms) =>
      posOfMs.has(ms)
        ? posOfMs.get(ms)
        : Math.round(((ms - groupStartMs) / 60000) * PX_PER_MIN);
    // Tile top = exact start position. Tile height = the span between its start
    // and end on the (stretched) scale, capped at MAX_H. Because sessions sharing
    // a column never overlap in time and the scale guarantees >= MIN_H per
    // session, tiles can never collide.
    const topOf = (s) => timePos(startMsOf(s));
    // Full span-based height (capped), WITHOUT the row-gap trim.
    const fullTileHeight = (s) =>
      Math.max(minHFor(s), Math.min(MAX_H, timePos(endMsOf(s)) - timePos(startMsOf(s))));

    // Rendered height: last tile in a column keeps full height (aligns to end
    // gridline); others are trimmed by ROW_GAP for visual separation.
    const tileHeight = (s) =>
      lastInColumn.has(s)
        ? fullTileHeight(s)
        : Math.max(minHFor(s), fullTileHeight(s) - ROW_GAP);

    // Distinct times (starts + ends) for gridlines + rail labels.
    const distinctTimes = new Map(); // pos -> ms
    sessions.forEach((s) => {
      const startMs = new Date(s.startDateTime).getTime();
      const endMs = new Date(s.endDateTime).getTime();
      distinctTimes.set(timePos(startMs), startMs);
      distinctTimes.set(timePos(endMs), endMs);
    });

    // Grid height = furthest tile bottom (accounts for min/max clamping).
    let gridHeight = 0;
    sessions.forEach((s) => {
      gridHeight = Math.max(gridHeight, topOf(s) + tileHeight(s));
    });
    // Also ensure the last time label/gridline isn't clipped.
    [...distinctTimes.keys()].forEach((pos) => {
      gridHeight = Math.max(gridHeight, pos);
    });

    // Outer wrapper matches the single-card width/centering.
    const wrap = document.createElement("div");
    wrap.classList.add("concurrentGroup");
    wrap.style.width = "calc(100% - 40px)";
    wrap.style.maxWidth = "1210px";
    wrap.style.margin = "0 auto";
    wrap.style.boxSizing = "border-box";
    wrap.style.display = "grid";
    wrap.style.gridTemplateColumns = `${RAIL_W}px 1fr`;
    wrap.style.gap = "8px";
    wrap.style.paddingTop = "14px"; // clear the previous block above the rail

    // Time rail: a label at each distinct time, positioned by true time.
    // Styled to RHYME with the single-card gutter (same time typography +
    // italic timezone abbreviation) so single and concurrent feel consistent.
    const railTzAbbr = (() => {
      // Mirror the single-card timezone label logic (override, else auto).
      const override =
        typeof cfg.timezoneAbbr === "string" ? cfg.timezoneAbbr.trim() : "";
      if (cfg.showTimezone === false) return "";
      if (override) return override;
      const anyStart = sessions[0]?.startDateTime
        ? new Date(sessions[0].startDateTime)
        : null;
      return anyStart
        ? anyStart
            .toLocaleString("en-US", { timeZoneName: "short", timeZone: tz })
            .split(" ")
            .pop()
        : "";
    })();
    // Time typography derived the SAME way as the standalone gutter and tiles:
    // theme paragraph weight/family as a base, then sessionTime overrides.
    const stTypo = cfg.typography?.sessionTime || {};
    const paraTheme = theme?.paragraph || {};
    const railActiveSize = (() => {
      const w =
        window.innerWidth || document.documentElement.clientWidth || 1920;
      if (w <= 600 && stTypo.fontSizeSm) return stTypo.fontSizeSm;
      if (w <= 1024 && stTypo.fontSizeMd) return stTypo.fontSizeMd;
      return stTypo.fontSize;
    })();
    const railFontSize = railActiveSize ? `${railActiveSize}px` : "14px";
    // Weight: sessionTime.bold wins if set; else theme paragraph weight; else 700.
    const railWeight =
      stTypo.bold === true
        ? "700"
        : stTypo.bold === false
        ? "400"
        : paraTheme.fontWeight || "700";
    const railFontFamily = paraTheme.fontFamily || "";

    const rail = document.createElement("div");
    rail.classList.add("concurrentRail");
    rail.style.position = "relative";

    // Sort distinct times top-to-bottom, suppress labels that would collide
    // with the one above (within MIN_LABEL_GAP px), and show the timezone
    // abbreviation only once (on the first label).
    const MIN_LABEL_GAP = 26; // px; smaller than a two-line label so no overlap
    const sortedTimes = [...distinctTimes.entries()].sort((a, b) => a[0] - b[0]);
    let lastShownPos = -Infinity;
    let tzShown = false;
    sortedTimes.forEach(([pos, ms]) => {
      if (pos - lastShownPos < MIN_LABEL_GAP) return; // too close -> skip label
      lastShownPos = pos;

      const lbl = document.createElement("div");
      lbl.style.position = "absolute";
      lbl.style.left = "8px"; // match single-card gutter's left padding
      if (pos <= 0) {
        // Topmost label: align its TOP with the first tile's top (like the
        // gutter time sits at the top of a single card), not centered on 0
        // (which would pull it up toward the date header).
        lbl.style.top = "8px";
      } else {
        lbl.style.top = `${pos}px`;
        lbl.style.transform = "translateY(-50%)";
      }

      const timeLine = document.createElement("div");
      timeLine.textContent = new Date(ms).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: tz,
      });
      timeLine.style.fontSize = railFontSize;
      timeLine.style.fontWeight = railWeight;
      if (railFontFamily) timeLine.style.fontFamily = railFontFamily;
      timeLine.style.color = "#333";
      timeLine.style.lineHeight = "1.1";
      lbl.appendChild(timeLine);

      // Timezone abbreviation once, under the first shown label only.
      if (railTzAbbr && !tzShown) {
        tzShown = true;
        const tzLine = document.createElement("div");
        tzLine.textContent = railTzAbbr;
        tzLine.style.fontSize = "11px";
        tzLine.style.fontStyle = "italic";
        tzLine.style.color = "#888";
        tzLine.style.lineHeight = "1.1";
        lbl.appendChild(tzLine);
      }

      rail.appendChild(lbl);
    });

    // Positioned tile area.
    const grid = document.createElement("div");
    grid.classList.add("concurrentGrid");
    grid.style.position = "relative";
    // + room for the last rail label, which is centred on the final gridline and
    // otherwise hangs below the grid (clipped in hosts like the Cvent editor).
    const LABEL_PAD = 12;
    grid.style.height = `${gridHeight + LABEL_PAD}px`;

    const colWidthPct = 100 / colCount;
    sessions.forEach((s) => {
      const col = colOf.get(s);
      const tile = document.createElement("div");
      tile.classList.add("concurrentTile");
      tile.style.position = "absolute";
      tile.style.top = `${topOf(s)}px`;
      tile.style.height = `${tileHeight(s)}px`;
      tile.style.left = `calc(${col * colWidthPct}% + ${col === 0 ? 0 : COL_GAP / 2}px)`;
      tile.style.width = `calc(${colWidthPct}% - ${COL_GAP}px)`;
      tile.style.boxSizing = "border-box";

      // Render the tile as an AgendaItem in "tile mode" so it reuses all the
      // existing card logic (speakers, accent/focus/break coloring, modal).
      const el = document.createElement("namespace-vertical-agenda");
      el.session = s;
      el.theme = theme;
      el.config = {
        ...cfg,
        allSessions: allSessions || [],
        getSpeakers,
        eventTimezone,
        ...this._detectSessionFields(s),
        eventLang: this._eventLang || "en",
        tileMode: true,
        tileTier: tierOf(s),
        tileHeight: tileHeight(s),
      };
      el.style.display = "block";
      el.style.height = "100%";
      tile.appendChild(el);

      grid.appendChild(tile);
    });

    wrap.append(rail, grid);
    return wrap;
  }

  // Shared session-field detection (break / break type / focus) used by both
  // single-card rendering and concurrent tiles.
  _detectSessionFields(session) {
    const breakField = session?.sessionCustomFields?.find(
      (f) => f.name === "Break session?"
    );
    const isBreak = !!breakField?.value?.includes("Yes");

    const breakTypeField = session?.sessionCustomFields?.find(
      (f) => f.name === "Break Type"
    );
    const breakType =
      Array.isArray(breakTypeField?.value) && breakTypeField.value.length
        ? breakTypeField.value[0]
        : "";

    const focusField = session?.sessionCustomFields?.find(
      (f) => f.name?.trim().toLowerCase() === "focus session?"
    );
    const isFocus = !!focusField?.value?.includes("Yes");

    return { isBreak, breakType, isFocus };
  }

  _renderItem(session, theme, cfg, allSessions, getSpeakers, eventTimezone) {
    // IMPORTANT: create the custom element by tag name and set properties
    const el = document.createElement("namespace-vertical-agenda");
    el.session = session;
    el.theme = theme;

    el.config = {
      ...cfg,
      allSessions: allSessions || [],
      getSpeakers,
      eventTimezone,
      eventLang: this._eventLang || "en",
      ...this._detectSessionFields(session),
    };

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

  // Map the detected event language to a full locale for date formatting.
  // "es-MX" / "pt-BR" / "en-GB" -> "es" / "pt" / "en"; unknown -> null.
  _mapLang(code) {
    const c = (code || "").toLowerCase();
    if (c.startsWith("es")) return "es";
    if (c.startsWith("pt")) return "pt";
    if (c.startsWith("en")) return "en";
    return null;
  }

  _dateLocale() {
    const lang = this._eventLang || "en";
    if (lang === "es") return "es";
    if (lang === "pt") return "pt-BR";
    return "en-US";
  }

  // Capitalize the first letter (for header polish in es/pt where weekday/month
  // are lowercase by grammar, but a header reads better sentence-cased).
  _capFirst(str) {
    return str ? str.charAt(0).toUpperCase() + str.slice(1) : str;
  }

  _formatDayKeyLabel(key) {
    if (key === "Unknown") return this._t("unknownDate");
    const [y, m, d] = key.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return this._capFirst(
      date.toLocaleDateString(this._dateLocale(), {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    );
  }

  _formatDayKeyLabelShort(key) {
    if (key === "Unknown") return this._t("unknownDate");
    const [y, m, d] = key.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return this._capFirst(
      date.toLocaleDateString(this._dateLocale(), {
        month: "long",
        day: "numeric",
      })
    );
  }

  _buildFocusLegend(cfg) {
    const lang = this._eventLang || "en";
    const legendMobile =
      (window.innerWidth || document.documentElement.clientWidth || 1920) <= 600;

    // Legend text is simply "[label] sessions" (planner-editable label; first
    // letter capitalised so a lowercase default like "plenary" still reads as
    // a heading). es/pt lead with the noun instead.
    const sentence = (label) =>
      lang === "es"
        ? `Sesiones ${label}`
        : lang === "pt"
        ? `Sessões ${label}`
        : `${this._capFirst(label)} sessions`;

    const makeItem = (color, label) => {
      const item = document.createElement("div");
      item.style.display = "flex";
      item.style.alignItems = "center";
      item.style.gap = "8px";
      item.style.flexShrink = "0";

      const swatch = document.createElement("span");
      swatch.style.width = "16px";
      swatch.style.height = "16px";
      swatch.style.borderRadius = "4px";
      swatch.style.background = color;
      swatch.style.flexShrink = "0";
      swatch.style.display = "inline-block";

      const labelEl = document.createElement("span");
      labelEl.textContent = sentence(label);
      labelEl.style.fontSize = legendMobile ? "12px" : "14px";
      labelEl.style.fontStyle = "italic";

      item.append(swatch, labelEl);
      return item;
    };

    // Container holding both legend items (plenary + focus), left-aligned so
    // the swatches form a clean vertical line regardless of text length.
    const wrap = document.createElement("div");
    wrap.style.display = "flex";
    wrap.style.flexDirection = "column";
    wrap.style.alignItems = "flex-start";
    wrap.style.gap = "4px";
    wrap.style.flexShrink = "0";

    // Plenary legend item
    const plenaryColor = cfg.plenaryAccent || "#f7a325";
    const plenaryLabel = this._plannerText("plenaryLabel", "plenary");
    wrap.append(makeItem(plenaryColor, plenaryLabel));

    // Focus legend item
    const focusColor = cfg.focusAccent || "#1a7f8e";
    const focusLabel = this._plannerText("focusLabel", "Focus");
    wrap.append(makeItem(focusColor, focusLabel));

    return wrap;
  }

  _renderDayHeader(
    dayKey,
    theme,
    cfg,
    { count = 0, isFirst = false, showLegend = false } = {}
  ) {
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

    if (this._editorial) {
      // Editorial: date left, session count right, hairline under EVERY day,
      // and real breathing room above each day so days read as chapters.
      const row = document.createElement("div");
      Object.assign(row.style, {
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        justifyContent: "space-between",
        gap: "8px 12px",
        width: "calc(100% - 40px)",
        maxWidth: "1210px",
        margin: `${isFirst ? 22 : 32}px auto 0 auto`,
        paddingBottom: "8px",
        borderBottom: "1px solid #dcdcdc",
        boxSizing: "border-box",
      });
      el.style.width = "auto";
      el.style.maxWidth = "none";
      el.style.margin = "0";
      const countEl = document.createElement("div");
      countEl.style.fontSize = "12px";
      countEl.style.fontWeight = "600";
      countEl.style.letterSpacing = ".06em";
      countEl.style.textTransform = "uppercase";
      countEl.style.color = "#8a8a8a";
      countEl.style.flexShrink = "0";
      countEl.textContent = this._sessionCountLabel(count);
      // Left: date + count together. Right: focus legend (when enabled).
      const left = document.createElement("div");
      left.classList.add("agendaDayLeft");
      left.append(el, countEl);
      const right = document.createElement("div");
      right.classList.add("agendaDayRight");
      if (showLegend) {
        const legend = this._buildFocusLegend(cfg);
        legend.classList.add("agendaLegendEditorial", "dayLegend");
        right.append(legend);
      }
      row.classList.add("dayHeaderRow");
      row.append(left, right);
      return row;
    }
    return el;
  }

  // Animate window scroll to `top` with an ease-in-out curve. Duration scales
  // with distance (min/max clamped) so short hops feel quick and long ones
  // don't rush. Cancels if the user wheels/touches mid-flight. Resolves true
  // when it ran to completion, false if interrupted. Honours reduced motion.
  _smoothScrollTo(top, { duration } = {}) {
    const startY = window.pageYOffset;
    const maxY = Math.max(0, (document.documentElement.scrollHeight || 0) - window.innerHeight);
    const endY = Math.max(0, Math.min(top, maxY));
    const dist = endY - startY;
    const reduce =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (Math.abs(dist) < 2) return Promise.resolve(true);
    if (reduce) {
      window.scrollTo(0, endY);
      return Promise.resolve(true);
    }
    const ms = duration ?? Math.max(450, Math.min(950, Math.abs(dist) * 0.45));
    const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

    // Cancel any in-flight animation from a previous click.
    if (this._scrollAnim) this._scrollAnim.cancel();

    return new Promise((resolve) => {
      let raf = null;
      let cancelled = false;
      const t0 = performance.now();
      const stop = (completed) => {
        if (raf) cancelAnimationFrame(raf);
        window.removeEventListener("wheel", onUser);
        window.removeEventListener("touchstart", onUser);
        window.removeEventListener("keydown", onUser);
        if (this._scrollAnim === anim) this._scrollAnim = null;
        resolve(completed);
      };
      const onUser = () => { cancelled = true; stop(false); };
      const anim = { cancel: () => { cancelled = true; stop(false); } };
      this._scrollAnim = anim;
      window.addEventListener("wheel", onUser, { passive: true });
      window.addEventListener("touchstart", onUser, { passive: true });
      window.addEventListener("keydown", onUser);

      const step = (now) => {
        if (cancelled) return;
        const p = Math.min(1, (now - t0) / ms);
        window.scrollTo(0, startY + dist * ease(p));
        if (p < 1) raf = requestAnimationFrame(step);
        else stop(true);
      };
      raf = requestAnimationFrame(step);
    });
  }

  // Text colour to put ON a solid accent: white on dark accents, near-black on
  // light ones (perceived brightness, YIQ).
  _readableOn(color) {
    const h = (color || "").trim().replace("#", "");
    const hex = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    if (hex.length !== 6) return "#ffffff";
    const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
    if ([r, g, b].some(Number.isNaN)) return "#ffffff";
    return (r * 299 + g * 587 + b * 114) / 1000 < 150 ? "#ffffff" : "#111111";
  }

  // A very pale accent, darkened for use as text (mirror of AgendaItem._textAccent).
  _textAccent(accent) {
    const h = (accent || "").trim().replace("#", "");
    const hex = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    if (hex.length !== 6) return accent;
    const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
    if ([r, g, b].some(Number.isNaN)) return accent;
    if ((r * 299 + g * 587 + b * 114) / 1000 <= 175) return accent;
    const to2 = (n) => Math.round(n * 0.55).toString(16).padStart(2, "0");
    return `#${to2(r)}${to2(g)}${to2(b)}`;
  }

  // Planner-typed text (header, subheader, eyebrow, legend labels) with an
  // optional per-language override from cfg.translations[lang][key]. A blank
  // or missing translation falls back to the planner's base (English) value,
  // then to the code default.
  _plannerText(key, fallback = "") {
    const cfg = this.configuration || {};
    const lang = this._eventLang || "en";
    const tr = (cfg.translations || {})[lang] || {};
    const v = typeof tr[key] === "string" ? tr[key].trim() : "";
    if (v) return v;
    const base = typeof cfg[key] === "string" ? cfg[key].trim() : "";
    return base || fallback;
  }
  _applyPlannerText() {
    const cfg = this.configuration || {};
    if (this._headerEl) {
      this._headerEl.textContent = this._plannerText(
        "headerText",
        cfg.headerText !== undefined ? cfg.headerText : "Agenda"
      );
    }
    if (this._subheaderEl) {
      this._subheaderEl.textContent = this._plannerText(
        "subheaderText",
        cfg.subheaderText !== undefined ? cfg.subheaderText : "Here's what's on the schedule"
      );
    }
    if (this._eyebrowEl) {
      // Blank stays blank here so the auto date range can fill it later.
      const v = this._plannerText("headerEyebrow", "");
      if (v) this._eyebrowEl.textContent = v;
    }
  }

  // Fixed UI strings, by runtime language (mirror of AgendaItem._t for the
  // strings widget.js renders itself).
  _t(key) {
    const T = {
      en: { showMore: "show more", showLess: "show less", speaker: "Speaker", speakers: "Speakers", session: "Session", sessions: "Sessions", noOtherSessions: "No other sessions found.", backToSession: "\u2190 Back to session details", concurrentSessions: "Concurrent sessions", unknownDate: "Unknown Date", close: "Close", speakerPhoto: "Speaker photo", noMatches: "No sessions match these filters.", clearFilters: "Clear filters", filterType: "Type", filterLocation: "Location", filterCategory: "Category", filterTags: "Tags" },
      es: { showMore: "ver m\u00e1s", showLess: "ver menos", speaker: "Ponente", speakers: "Ponentes", session: "Sesi\u00f3n", sessions: "Sesiones", noOtherSessions: "No se encontraron otras sesiones.", backToSession: "\u2190 Volver a los detalles de la sesi\u00f3n", concurrentSessions: "Sesiones simult\u00e1neas", unknownDate: "Fecha desconocida", close: "Cerrar", speakerPhoto: "Foto del ponente", noMatches: "Ninguna sesi\u00f3n coincide con estos filtros.", clearFilters: "Borrar filtros", filterType: "Tipo", filterLocation: "Ubicaci\u00f3n", filterCategory: "Categor\u00eda", filterTags: "Etiquetas" },
      pt: { showMore: "ver mais", showLess: "ver menos", speaker: "Palestrante", speakers: "Palestrantes", session: "Sess\u00e3o", sessions: "Sess\u00f5es", noOtherSessions: "Nenhuma outra sess\u00e3o encontrada.", backToSession: "\u2190 Voltar aos detalhes da sess\u00e3o", concurrentSessions: "Sess\u00f5es simult\u00e2neas", unknownDate: "Data desconhecida", close: "Fechar", speakerPhoto: "Foto do palestrante", noMatches: "Nenhuma sess\u00e3o corresponde a estes filtros.", clearFilters: "Limpar filtros", filterType: "Tipo", filterLocation: "Local", filterCategory: "Categoria", filterTags: "Tags" },
    };
    const lang = this._eventLang || "en";
    return (T[lang] || T.en)[key] ?? T.en[key] ?? key;
  }

  // "All days" tab wording (filter mode), localised to the runtime language.
  _allDaysLabel() {
    const lang = this._eventLang || "en";
    if (lang === "es") return { full: "Todos los días", big: "Todos", small: "los días" };
    if (lang === "pt") return { full: "Todos os dias", big: "Todos", small: "os dias" };
    return { full: "All days", big: "All", small: "days" };
  }

  // "5 sessions" / "1 session", localised to the runtime language.
  _sessionCountLabel(n) {
    const lang = this._eventLang || "en";
    const one = n === 1;
    if (lang === "es") return `${n} ${one ? "sesión" : "sesiones"}`;
    if (lang === "pt") return `${n} ${one ? "sessão" : "sessões"}`;
    return `${n} ${one ? "session" : "sessions"}`;
  }

  // Weekday / day / month pieces for the editorial date-nav tabs.
  _dayKeyParts(key) {
    if (key === "Unknown") return { weekday: "", day: "?", month: "" };
    const [y, m, d] = key.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    const loc = this._dateLocale();
    const strip = (s) => s.replace(/\.$/, ""); // es/pt abbreviate with a dot
    return {
      weekday: strip(date.toLocaleDateString(loc, { weekday: "short" })),
      day: String(d),
      month: strip(date.toLocaleDateString(loc, { month: "short" })),
    };
  }

  // "Jun 16 – Dec 31, 2026" style range for the editorial eyebrow.
  _formatDayRange(dayKeys) {
    const keys = dayKeys.filter((k) => k !== "Unknown");
    if (!keys.length) return "";
    const toDate = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
    const first = toDate(keys[0]);
    const last = toDate(keys[keys.length - 1]);
    const loc = this._dateLocale();
    const fmt = (dt, withYear) =>
      this._capFirst(dt.toLocaleDateString(loc, withYear
        ? { month: "short", day: "numeric", year: "numeric" }
        : { month: "short", day: "numeric" }));
    if (keys.length === 1) return fmt(first, true);
    const sameYear = first.getFullYear() === last.getFullYear();
    return `${fmt(first, !sameYear)} – ${fmt(last, true)}`;
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
