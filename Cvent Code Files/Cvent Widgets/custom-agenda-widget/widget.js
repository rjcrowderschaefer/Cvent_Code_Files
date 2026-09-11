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

        // Detect the live front-end header. If it's absent (e.g. the Site
        // Designer preview), sticky positioning has no correct anchor and looks
        // misplaced — so render the nav statically in that context instead.
        const hasLiveHeader = ["#navigationContainer", ".cus_nav"].some((sel) => {
          const el = document.querySelector(sel);
          return el && el.getBoundingClientRect().height > 0;
        });
        if (!hasLiveHeader) {
          dateNav.style.position = "static";
        }

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
      const legendEnabled =
        cfg.showAccentBar === true && cfg.showFocusLegend === true;
      let isFirstHeader = true;
      for (const [dayKey, daySessions] of groups) {
        const header = this._renderDayHeader(dayKey, theme, cfg);
        header.dataset.dayKey = dayKey;
        dayHeaderRefs[dayKey] = header;

        // On the first day header, place it in a row with the focus legend
        // right-aligned so the legend aligns vertically with the date.
        if (isFirstHeader && legendEnabled) {
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
        // begins.
        if (isFirstHeader) {
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

    const sentence = (label) =>
      lang === "es"
        ? `Indica una sesión de ${label}`
        : lang === "pt"
        ? `Indica uma sessão de ${label}`
        : `Indicates a ${label} session`;

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
