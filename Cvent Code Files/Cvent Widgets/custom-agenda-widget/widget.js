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
        .agendaDayRight { display:flex; align-items:center; flex-wrap:wrap; justify-content:flex-end; gap:6px 18px; min-width:0; }
      `;
      container.appendChild(mastStyle);

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
      const mapLang = (code) => {
        const c = (code || "").toLowerCase();
        if (c.startsWith("es")) return "es";
        if (c.startsWith("pt")) return "pt";
        if (c.startsWith("en")) return "en";
        return null;
      };
      const htmlLang = mapLang(document.documentElement.lang);
      const locales = eventInfo?.locales || [];
      const def = locales.find((l) => l.isDefault) || locales[0];
      const defaultLang = mapLang(def?.cultureCode);
      eventLang = htmlLang || defaultLang || "en";
    } catch (e) {
      console.warn("getEventInfo error:", e);
    }
    this._eventLang = eventLang;

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

      if (this._eyebrowEl && !this._eyebrowEl.textContent && dayKeys.length) {
        this._eyebrowEl.textContent = this._formatDayRange(dayKeys);
      }

      // Date nav: a plain (non-sticky) row of day links under the subheader.
      // Clicking a day scrolls its header just below Cvent's own site header.
      const showDateNav = cfg.hideDateNav !== true;
      const dn = cfg.dateNav || {};

      const dayHeaderRefs = {};
      const navLinks = {};
      let dateNav = null;

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
          display:flex; flex-wrap:nowrap; gap:6px; overflow-x:auto;
          scroll-snap-type:x mandatory; -webkit-overflow-scrolling:touch;
          scrollbar-width:none;
          width: calc(100% - 40px); max-width: 1210px; margin: 18px auto 0;
          padding: 4px; box-sizing: border-box;
          background: ${dn.navBg && dn.navBg.toLowerCase() !== "#ffffff" ? dn.navBg : "#f3f4f6"};
          border-radius: 14px;
        }
        .dateNav::-webkit-scrollbar { display:none; }
        .dateNav button {
          flex: 0 0 auto; scroll-snap-align:start;
          display:flex; flex-direction:column; align-items:center; gap:1px;
          min-width: 68px; padding: 8px 14px; border:none; border-radius:10px;
          background: transparent; cursor:pointer; font-family: inherit;
          color: ${dn.inactiveColor || "#6b6b6b"};
          transition: background .15s ease, color .15s ease;
        }
        .dateNav button:hover { background: rgba(0,0,0,.05); }
        .dateNav .navDow { font-size:10px; font-weight:700; letter-spacing:.1em; text-transform:uppercase; opacity:.85; }
        .dateNav .navDay { font-size:${dn.fontSize ?? 18}px; font-weight:700; line-height:1.1; }
        .dateNav .navMon { font-size:11px; font-weight:500; opacity:.85; }
        .dateNav button.active {
          background: ${dn.underlineColor || cfg.plenaryAccent || "#f7a325"};
          color: #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,.12);
        }
        .dateNav button.active .navDow, .dateNav button.active .navMon { opacity: 1; }
        @media (max-width: 1024px) {
          .dateNav .navDay { font-size: ${dn.fontSizeMd ?? 16}px; }
        }
        @media (max-width: 600px) {
          .dateNav { width: 100%; max-width: 100%; border-radius: 0; padding: 4px 12px; }
          .dateNav button { min-width: 60px; padding: 7px 10px; }
          .dateNav .navDay { font-size: ${dn.fontSizeSm ?? 15}px; }
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

      // --- Render headers + sessions (always, nav or not) ---
      const legendEnabled =
        cfg.showAccentBar === true && cfg.showFocusLegend === true;
      let isFirstHeader = true;
      for (const [dayKey, daySessions] of groups) {
        const header = this._renderDayHeader(dayKey, theme, cfg, {
          count: daySessions.length,
          isFirst: isFirstHeader,
        });
        header.dataset.dayKey = dayKey;
        dayHeaderRefs[dayKey] = header;

        // On the first day header, place it in a row with the focus legend
        // right-aligned so the legend aligns vertically with the date.
        if (isFirstHeader && legendEnabled && !editorial) {
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

          row.append(header, this._buildFocusLegend(cfg));
          container.appendChild(row);
        } else {
          container.appendChild(header);
        }

        // Thin divider under the FIRST date/legend to mark where the agenda
        // begins (classic only; editorial day headers carry their own rule).
        if (isFirstHeader && !editorial) {
          const startLine = document.createElement("div");
          startLine.style.width = "calc(100% - 40px)";
          startLine.style.maxWidth = "1210px";
          startLine.style.margin = "6px auto 2px auto";
          startLine.style.borderTop = "1px solid #d9d9d9";
          startLine.style.boxSizing = "border-box";
          container.appendChild(startLine);
        }
        isFirstHeader = false;

        // Concurrent tiles are opt-in. When OFF (default), render every session
        // in a single column in start-time order (classic layout). When ON,
        // overlapping sessions form side-by-side tile groups.
        if (cfg.concurrentTiles === true) {
          const blocks = this._buildDayBlocks(daySessions);
          blocks.forEach((blk) => {
            if (blk.type === "single") {
              container.appendChild(
                this._renderItem(
                  blk.session, theme, cfg, openSessions, getSpeakers, eventTimezone
                )
              );
            } else {
              container.appendChild(
                this._renderConcurrentGroup(
                  blk, theme, cfg, openSessions, getSpeakers, eventTimezone
                )
              );
            }
          });
        } else {
          // Single-column classic: every session as a normal card, in order.
          daySessions.forEach((s) => {
            container.appendChild(
              this._renderItem(
                s, theme, cfg, openSessions, getSpeakers, eventTimezone
              )
            );
          });
        }
      }

      // Highlight the first day by default; clicks move the highlight.
      if (showDateNav && dayKeys.length) setActiveDay(dayKeys[0]);
    }
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
    header.textContent = `${fmt(groupStart)}–${fmt(groupEnd)} · Concurrent sessions`;
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
    const MIN_H = 118; // floor: enough for title + start/end time + a speaker row
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
        const need = MIN_H + (lastInColumn.has(s) ? 0 : ROW_GAP);
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
      Math.max(MIN_H, Math.min(MAX_H, timePos(endMsOf(s)) - timePos(startMsOf(s))));

    // Rendered height: last tile in a column keeps full height (aligns to end
    // gridline); others are trimmed by ROW_GAP for visual separation.
    const tileHeight = (s) =>
      lastInColumn.has(s)
        ? fullTileHeight(s)
        : Math.max(MIN_H, fullTileHeight(s) - ROW_GAP);

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
    grid.style.height = `${gridHeight}px`;

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
    if (key === "Unknown") return "Unknown Date";
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
    if (key === "Unknown") return "Unknown Date";
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
    const plenaryLabel =
      typeof cfg.plenaryLabel === "string" && cfg.plenaryLabel.trim()
        ? cfg.plenaryLabel.trim()
        : "plenary";
    wrap.append(makeItem(plenaryColor, plenaryLabel));

    // Focus legend item
    const focusColor = cfg.focusAccent || "#1a7f8e";
    const focusLabel =
      typeof cfg.focusLabel === "string" && cfg.focusLabel.trim()
        ? cfg.focusLabel.trim()
        : "Focus";
    wrap.append(makeItem(focusColor, focusLabel));

    return wrap;
  }

  _renderDayHeader(dayKey, theme, cfg, { count = 0, isFirst = false } = {}) {
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
      // Right-hand group: focus legend (first day only, when enabled) + count.
      const right = document.createElement("div");
      right.classList.add("agendaDayRight");
      if (isFirst && cfg.showAccentBar === true && cfg.showFocusLegend === true) {
        const legend = this._buildFocusLegend(cfg);
        legend.classList.add("agendaLegendEditorial");
        right.append(legend);
      }
      right.append(countEl);
      row.append(el, right);
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
