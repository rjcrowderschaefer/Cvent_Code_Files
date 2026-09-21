// editor.js
// Planner-facing editor. Recreates your index.html + main.js control surface inside Shadow DOM
// and persists values via setConfiguration. No mock data required.

// Legacy speaker-modal typography (pre-restyle defaults) is migrated on load so
// the panel shows and re-saves the new values. Same rule the widget applies.
import { migrateModalTypography, defaultTypography } from "./AgendaItem.js";

export default class ExampleAgendaEditor extends HTMLElement {
  constructor({ setConfiguration, initialConfiguration } = {}) {
    super();
    this.setConfiguration = setConfiguration;
    // this._config = {
    //   ...this._getDefaultConfig(),
    //   ...(initialConfiguration || {}),
    // };
    const defaults = this._getDefaultConfig();
    const incoming = initialConfiguration || {};

    const defaultTypography = defaults.typography || {};
    const incomingTypography = migrateModalTypography(incoming.typography || {});
    const mergedTypography = {};

    Object.keys(defaultTypography).forEach((key) => {
      mergedTypography[key] = {
        ...(defaultTypography[key] || {}),
        ...(incomingTypography[key] || {}),
      };
    });

    Object.keys(incomingTypography).forEach((key) => {
      if (!mergedTypography[key]) {
        mergedTypography[key] = incomingTypography[key];
      }
    });

    this._config = {
      ...defaults,
      ...incoming,
      dateNav: {
        ...(defaults.dateNav || {}),
        ...(incoming.dateNav || {}),
      },
      modalColors: {
        ...(defaults.modalColors || {}),
        ...(incoming.modalColors || {}),
      },
      typography: mergedTypography,
    };

    if (!initialConfiguration) {
      setConfiguration(this._config);
    }

    this.attachShadow({ mode: "open" });
  }

  // onConfigurationUpdate(newConfig) {
  //   this._config = newConfig || this._config;
  //   this._safeRenderUI(); // use the new safe renderer
  // }
  onConfigurationUpdate(newConfig) {
    const defaults = this._getDefaultConfig();
    const incoming = newConfig || {};

    const defaultTypography = defaults.typography || {};
    const incomingTypography = migrateModalTypography(incoming.typography || {});
    const mergedTypography = {};

    Object.keys(defaultTypography).forEach((key) => {
      mergedTypography[key] = {
        ...(defaultTypography[key] || {}),
        ...(incomingTypography[key] || {}),
      };
    });

    Object.keys(incomingTypography).forEach((key) => {
      if (!mergedTypography[key]) {
        mergedTypography[key] = incomingTypography[key];
      }
    });

    this._config = {
      ...defaults,
      ...incoming,
      dateNav: {
        ...(defaults.dateNav || {}),
        ...(incoming.dateNav || {}),
      },
      modalColors: {
        ...(defaults.modalColors || {}),
        ...(incoming.modalColors || {}),
      },
      typography: mergedTypography,
      breakStyle: {
        ...(defaults.breakStyle || {}),
        ...(incoming.breakStyle || {}),
      },
    };

    this._safeRenderUI();
  }

  async _resolveAutoTimezoneAbbr() {
    try {
      let getInfo = null;
      if (this.cventSdk?.getEventInfo)
        getInfo = this.cventSdk.getEventInfo.bind(this.cventSdk);
      else if (typeof this.getEventInfo === "function")
        getInfo = this.getEventInfo.bind(this);
      if (!getInfo) return "";

      const info = await getInfo();
      let tz = info?.timezone;
      if (!tz) return "";

      // Same DST-stripped-zone remap as widget.js (keep in sync)
      const TZ_NORMALIZE = {
        "Atlantic/Reykjavik": "Europe/London",
      };
      if (TZ_NORMALIZE[tz]) tz = TZ_NORMALIZE[tz];

      const ref = info?.startDate ? new Date(info.startDate) : new Date();
      const raw = ref.toLocaleString("en-US", {
        timeZoneName: "short",
        timeZone: tz,
      });
      return raw.split(" ").pop() || "";
    } catch (e) {
      console.warn("[editor] timezone resolve failed", e);
      return "";
    }
  }

  async _maybeInitTimezoneAbbr() {
    if (this._autoTzAbbr !== undefined) return;
    if (this._tzInitTried) return;
    this._tzInitTried = true;

    this._autoTzAbbr = (await this._resolveAutoTimezoneAbbr()) || "";
    this._safeRenderUI(); // re-render so the placeholder reflects the auto value
  }

  connectedCallback() {
    this._safeRenderUI();
    this._maybeInitTimezoneAbbr();
  }

  // ============================
  // DEFAULT CONFIG
  // ============================

  _getDefaultConfig() {
    return {
      headerText: "Agenda",
      subheaderText: "Here's what's scheduled for the event",
      headerStyle: "classic",
      headerEyebrow: "",
      translations: {},
      sort: "dateTimeAsc",
      maxResults: 100,
      groupByDay: true,
      speakerOrder: "alphabetical",
      hideDateNav: false,
      dateNavMode: "jump",
      concurrentTiles: false,
      showFilters: false,
      plenaryAccent: "#f7a325",
      focusAccent: "#1a7f8e",
      showAccentBar: false,
      showFocusLegend: false,
      focusLabel: "Focus",
      plenaryLabel: "plenary",
      dateNav: {
        fontSize: 18,
        fontSizeMd: 16,
        fontSizeSm: 14,
        activeColor: "#000000",
        inactiveColor: "#999999",
      },
      showTimezone: true,
      showDescription: true,
      showDescriptionLimited: false,
      cardBg: "#ffffff",
      cardBorder: {
        width: 0.5,
        style: "solid",
        color: "#cccccc",
      },
      typography: this._makeCompactTypography(),
      breakStyle: {
        gutterBg: "#e8eaed",
        gutterText: "#5f5e5a",
        cardBg: "#f7f7f5",
        hideSpeakers: true,
        hideDescription: false,
        iconSize: 20,
      },
    };
  }

  // Typography defaults come from the shared type scale (type-scale.js) via
  // the role map in AgendaItem.js. "Compact card styling" no longer changes
  // type sizes; both scales are the same system.
  _makeDefaultTypography() {
    return defaultTypography();
  }

  _makeCompactTypography() {
    return defaultTypography();
  }

  // ============================
  // MAIN RENDER FUNCTION
  // ============================

  _safeRenderUI() {
    // --- Save scroll position of host editor container ---
    const scrollTop = this.scrollTop;

    // --- Save open/closed state of all existing <details> sections ---
    const detailsState = [...this.shadowRoot.querySelectorAll("details")].map(
      (d) => d.open
    );

    // --- Rebuild the entire editor ---
    this._renderUI();

    // --- Restore <details> open/closed state ---
    const newDetails = [...this.shadowRoot.querySelectorAll("details")];

    detailsState.forEach((wasOpen, i) => {
      if (newDetails[i]) newDetails[i].open = wasOpen;
    });

    // --- Restore scroll position ---
    this.scrollTop = scrollTop;
  }

  _renderUI() {
    this.shadowRoot.innerHTML = "";

    const style = document.createElement("style");
    style.textContent = `
      :host {
        display:block;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      }
      .panel { padding:14px; }
      .section { margin: 10px 0 14px; }
      .field { margin: 8px 0; }
      .row { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
      fieldset {
        border:1px solid #ddd;
        border-radius:8px;
        padding:10px;
        margin:10px 0;
      }
      legend { padding:0 6px; font-weight:600; }
      label { font-size:12px; opacity:.85; }
      input[type="number"] { 
        width: 100px;
        min-width: 100px;
        pointer-events: auto;
        user-select: text;
        -webkit-user-select: text;
        cursor: text;
       }

      input[type="color"] { width:48px; height:28px; padding:0; border:none; background:transparent; }
      h3 { margin: 14px 0 6px; }
      details {
        border:1px solid #e7e7e7;
        border-radius:8px;
        margin:10px 0;
        background:#fff;
      }
      summary {
        list-style:none;
        cursor:pointer;
        padding:10px 12px;
        font-weight:600;
        display:flex;
        align-items:center;
        gap:8px;
      }
      summary::-webkit-details-marker { display:none; }
      .chev {
        transition: transform .18s ease;
      }
      details[open] .chev { transform: rotate(90deg); }
      .block { padding: 0 12px 12px 12px; }
      .grid { display:grid; grid-template-columns: 1fr; gap: 10px; }
      input.hex {
        width: 92px;
        height: 28px;
        padding: 2px 6px;
        border: 1px solid #ccc;
        border-radius: 6px;
        font-family: ui-monospace;
        font-size: 12px;
      }
    `;
    this.shadowRoot.append(style);

    const panel = document.createElement("div");
    panel.className = "panel";
    this.shadowRoot.append(panel);

    // ============================
    // SECTIONS (collapsible; only the first is open by default)
    // ============================
    // Config keys are unchanged; this is purely how controls are grouped.

    const makeSection = (title, open) => {
      const details = this._details(title, open);
      const block = document.createElement("div");
      block.className = "block";
      details.append(block);
      return { details, block };
    };
    const secHeader = makeSection("Agenda Header", true);
    const secNew = makeSection("New Features", true);
    const secLayout = makeSection("Layout & Ordering", false);
    const secDateNav = makeSection("Date Navigation", false);
    const secCards = makeSection("Card Colors & Border", false);
    const secTypes = makeSection("Session Types (Plenary / Focus)", false);
    const secBreaks = makeSection("Break Sessions", false);
    const secTypoAgenda = makeSection("Typography (Agenda)", false);
    const secModal = makeSection("Speaker Modal", false);
    const secTranslations = makeSection("Translations", false);
    // Opt-in feature toggles (all default OFF) collected in "New Features".
    const featWrap = document.createElement("div");
    featWrap.className = "section";

    // Header text
    const headerWrap = document.createElement("div");
    headerWrap.className = "section";
    headerWrap.appendChild(this._label("Header"));
    headerWrap.appendChild(document.createElement("br"));

    const headerInput = document.createElement("input");
    headerInput.type = "text";
    headerInput.value =
      this._config.headerText !== undefined
        ? this._config.headerText
        : "Agenda";
    headerInput.style.width = "100%";

    headerInput.onchange = () => {
      this._patch({ headerText: headerInput.value });
    };

    headerWrap.appendChild(headerInput);
    secHeader.block.appendChild(headerWrap);

    // Subheader text
    const subheaderWrap = document.createElement("div");
    subheaderWrap.className = "section";
    subheaderWrap.appendChild(this._label("Subheader"));
    subheaderWrap.appendChild(document.createElement("br"));

    const subheaderInput = document.createElement("input");
    subheaderInput.type = "text";
    subheaderInput.value =
      this._config.subheaderText !== undefined
        ? this._config.subheaderText
        : "Here's what's on the schedule";
    subheaderInput.style.width = "100%";

    subheaderInput.onchange = () => {
      this._patch({ subheaderText: subheaderInput.value });
    };

    subheaderWrap.appendChild(subheaderInput);
    secHeader.block.appendChild(subheaderWrap);

    // Header style (opt-in "Editorial" look; "Classic" keeps existing events unchanged)
    const hsWrap = document.createElement("div");
    hsWrap.className = "section";
    hsWrap.appendChild(this._label("Header style"));
    hsWrap.appendChild(document.createElement("br"));
    const hsSelect = document.createElement("select");
    [
      ["classic", "Classic (current look)"],
      ["editorial", "Editorial — eyebrow, accent rule, pill date tabs, day counts"],
    ].forEach(([v, label]) => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = label;
      hsSelect.appendChild(o);
    });
    hsSelect.value = this._config.headerStyle === "editorial" ? "editorial" : "classic";
    hsSelect.style.width = "100%";
    hsSelect.onchange = () => this._patch({ headerStyle: hsSelect.value });
    hsWrap.appendChild(hsSelect);

    const hsNote = document.createElement("div");
    hsNote.style.fontSize = "11px";
    hsNote.style.opacity = "0.7";
    hsNote.style.margin = "4px 0 8px";
    hsNote.textContent =
      "Editorial uses the plenary accent for the rule and active date tab, and the Date Navigation colours/sizes for the tabs.";
    hsWrap.appendChild(hsNote);

    hsWrap.appendChild(this._label("Eyebrow text (Editorial only; blank = event date range)"));
    hsWrap.appendChild(document.createElement("br"));
    const eyebrowInput = document.createElement("input");
    eyebrowInput.type = "text";
    eyebrowInput.placeholder = "e.g. Jun 16 – Jun 18, 2026";
    eyebrowInput.value = typeof this._config.headerEyebrow === "string" ? this._config.headerEyebrow : "";
    eyebrowInput.style.width = "100%";
    eyebrowInput.onchange = () => this._patch({ headerEyebrow: eyebrowInput.value });
    hsWrap.appendChild(eyebrowInput);
    secNew.block.appendChild(hsWrap);

// Timezone label controls
    const tzWrap = document.createElement("div");
    tzWrap.className = "section";

    // Explicit show / hide
    tzWrap.appendChild(
      this._checkbox(
        "Show timezone label",
        this._config.showTimezone !== false,
        (v) => this._patch({ showTimezone: v })
      )
    );
    tzWrap.appendChild(document.createElement("br"));
    tzWrap.appendChild(document.createElement("br"));

    // Optional static override; blank = auto (DST-aware)
    tzWrap.appendChild(
      this._label("Timezone label override (leave blank for event default)")
    );
    tzWrap.appendChild(document.createElement("br"));

    const tzInput = document.createElement("input");
    tzInput.type = "text";
    tzInput.placeholder = this._autoTzAbbr
      ? `Auto: ${this._autoTzAbbr}`
      : "e.g. CET";
    tzInput.value =
      typeof this._config.timezoneAbbr === "string"
        ? this._config.timezoneAbbr
        : "";
    tzInput.style.width = "100%";
    tzInput.onchange = () => this._patch({ timezoneAbbr: tzInput.value });

    tzWrap.appendChild(tzInput);
    secHeader.block.appendChild(tzWrap);

// Date Navigation controls
    const dnWrap = document.createElement("div");
    dnWrap.className = "section";

    const dn = this._config.dateNav || {};

    const dnSizes = document.createElement("div");
    dnSizes.className = "row field";

    const mkDnSize = (lbl, prop) => {
      const wrap = document.createElement("div");
      const l = this._label(lbl);
      const i = document.createElement("input");
      i.type = "number";
      i.min = "8";
      i.max = "72";
      i.value = dn[prop] !== undefined ? dn[prop] : "";
      const commit = () => {
        const raw = i.value.trim();
        const val =
          raw === "" ? undefined : Math.max(8, Math.min(72, Number(raw)));
        this._patch({
          dateNav: { ...(this._config.dateNav || {}), [prop]: val },
        });
      };
      i.onchange = commit;
      i.onblur = commit;
      wrap.append(l, document.createElement("br"), i);
      return wrap;
    };

    dnSizes.append(mkDnSize("Font size (px)", "fontSize"));
    dnWrap.appendChild(dnSizes);

    dnWrap.appendChild(
      this._colorRow(
        "Active date color",
        "dnActiveColor",
        dn.activeColor || "#000000",
        (v) =>
          this._patch({
            dateNav: { ...(this._config.dateNav || {}), activeColor: v },
          })
      )
    );
    dnWrap.appendChild(
      this._colorRow(
        "Inactive date color",
        "dnInactiveColor",
        dn.inactiveColor || "#999999",
        (v) =>
          this._patch({
            dateNav: { ...(this._config.dateNav || {}), inactiveColor: v },
          })
      )
    );

    // Break Session Styling
    const bsWrap = document.createElement("div");
    bsWrap.className = "section";

    const bsNote = document.createElement("div");
    bsNote.style.fontSize = "11px";
    bsNote.style.opacity = "0.7";
    bsNote.style.margin = "0 0 8px";
    bsNote.textContent =
      'Applies to sessions with the "Break session?" custom field set to Yes.';
    bsWrap.appendChild(bsNote);

    const bs = this._config.breakStyle || {};

    bsWrap.appendChild(
      this._colorRow(
        "Break time column bg",
        "breakGutterBg",
        bs.gutterBg || "#e8eaed",
        (v) =>
          this._patch({
            breakStyle: { ...(this._config.breakStyle || {}), gutterBg: v },
          })
      )
    );

    bsWrap.appendChild(
      this._colorRow(
        "Break time text color",
        "breakGutterText",
        bs.gutterText || "#5f5e5a",
        (v) =>
          this._patch({
            breakStyle: { ...(this._config.breakStyle || {}), gutterText: v },
          })
      )
    );

    bsWrap.appendChild(
      this._colorRow(
        "Break card bg",
        "breakCardBg",
        bs.cardBg || "#f7f7f5",
        (v) =>
          this._patch({
            breakStyle: { ...(this._config.breakStyle || {}), cardBg: v },
          })
      )
    );

    bsWrap.appendChild(
      this._checkbox("Hide speakers on breaks", bs.hideSpeakers !== false, (v) =>
        this._patch({
          breakStyle: { ...(this._config.breakStyle || {}), hideSpeakers: v },
        })
      )
    );

    bsWrap.appendChild(document.createElement("br"));

    bsWrap.appendChild(
      this._checkbox(
        "Hide description on breaks",
        bs.hideDescription === true,
        (v) =>
          this._patch({
            breakStyle: {
              ...(this._config.breakStyle || {}),
              hideDescription: v,
            },
          })
      )
    );

    // Break icon size
    const bsIconSizeWrap = document.createElement("div");
    bsIconSizeWrap.className = "row field";
    const bsIconSizeLabel = this._label("Break icon size (px)");
    const bsIconSizeInput = document.createElement("input");
    bsIconSizeInput.type = "number";
    bsIconSizeInput.min = "10";
    bsIconSizeInput.max = "48";
    bsIconSizeInput.value = bs.iconSize ?? 20;
    const commitIconSize = () => {
      const raw = bsIconSizeInput.value.trim();
      const val = raw === "" ? 20 : Math.max(10, Math.min(48, Number(raw) || 20));
      this._patch({
        breakStyle: { ...(this._config.breakStyle || {}), iconSize: val },
      });
    };
    bsIconSizeInput.onchange = commitIconSize;
    bsIconSizeInput.onblur = commitIconSize;
    bsIconSizeWrap.append(bsIconSizeLabel, bsIconSizeInput);
    bsWrap.appendChild(bsIconSizeWrap);

    secBreaks.block.appendChild(bsWrap);

    // Session Type Styling (plenary vs focus)
    const stWrap = document.createElement("div");
    stWrap.className = "section";

    // Master toggle — off by default so existing events are unchanged
    featWrap.appendChild(
      this._checkbox(
        "Show session-type accent bar",
        this._config.showAccentBar === true,
        (v) => this._patch({ showAccentBar: v })
      )
    );
    const stNote = document.createElement("div");
    stNote.style.fontSize = "11px";
    stNote.style.opacity = "0.7";
    stNote.style.margin = "4px 0 10px";
    stNote.textContent =
      'Off by default. When on, every card gets a top accent bar. Sessions with a "Focus session?" custom field set to "Yes" use the focus colour (bar + gutter); all others use the plenary colour. Colours are set under Session Types.';
    featWrap.appendChild(stNote);

    stWrap.appendChild(
      this._colorRow(
        "Plenary accent",
        "plenaryAccent",
        this._config.plenaryAccent || "#f7a325",
        (v) => this._patch({ plenaryAccent: v })
      )
    );

    stWrap.appendChild(
      this._colorRow(
        "Focus accent",
        "focusAccent",
        this._config.focusAccent || "#1a7f8e",
        (v) => this._patch({ focusAccent: v })
      )
    );

    const accentNote = document.createElement("div");
    accentNote.style.fontSize = "11px";
    accentNote.style.opacity = "0.7";
    accentNote.style.margin = "2px 0 8px";
    accentNote.textContent =
      "The Plenary / Focus accents also colour: the time column (and its text), speaker names, \u201cshow more\u201d, and the active date tab.";
    stWrap.appendChild(accentNote);
    // Legend toggle (default off — most events are single-track)
    featWrap.appendChild(
      this._checkbox(
        "Show focus legend (needs the accent bar on)",
        this._config.showFocusLegend === true,
        (v) => this._patch({ showFocusLegend: v })
      )
    );
    featWrap.appendChild(document.createElement("br"));
    featWrap.appendChild(document.createElement("br"));

    // Editable focus label (used in the legend)
    stWrap.appendChild(this._label("Focus legend label"));
    stWrap.appendChild(document.createElement("br"));
    const focusLabelInput = document.createElement("input");
    focusLabelInput.type = "text";
    focusLabelInput.placeholder = "Focus";
    focusLabelInput.value =
      typeof this._config.focusLabel === "string"
        ? this._config.focusLabel
        : "Focus";
    focusLabelInput.style.width = "100%";
    focusLabelInput.onchange = () =>
      this._patch({ focusLabel: focusLabelInput.value });
    stWrap.appendChild(focusLabelInput);

    // Editable plenary label (used in the legend)
    stWrap.appendChild(document.createElement("br"));
    stWrap.appendChild(this._label("Plenary legend label"));
    stWrap.appendChild(document.createElement("br"));
    const plenaryLabelInput = document.createElement("input");
    plenaryLabelInput.type = "text";
    plenaryLabelInput.placeholder = "plenary";
    plenaryLabelInput.value =
      typeof this._config.plenaryLabel === "string"
        ? this._config.plenaryLabel
        : "plenary";
    plenaryLabelInput.style.width = "100%";
    plenaryLabelInput.onchange = () =>
      this._patch({ plenaryLabel: plenaryLabelInput.value });
    stWrap.appendChild(plenaryLabelInput);

    secTypes.block.appendChild(stWrap);

    secDateNav.block.appendChild(dnWrap);

    // Sort dropdown
    const sortWrap = document.createElement("div");
    sortWrap.className = "section";
    sortWrap.append(this._label("Sort"), document.createElement("br"));

    const sort = document.createElement("select");
    ["dateTimeAsc", "dateTimeDesc", "nameAsc"].forEach((v) => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent =
        v === "dateTimeAsc"
          ? "Date & time (asc)"
          : v === "dateTimeDesc"
          ? "Date & time (desc)"
          : "Name (A→Z)";
      if (this._config.sort === v) opt.selected = true;
      sort.append(opt);
    });
    sort.onchange = () => this._patch({ sort: sort.value });
    sortWrap.append(sort);
    secLayout.block.append(sortWrap);

    // Group by day checkbox stays
    secLayout.block.append(
      this._checkbox("Group by day", !!this._config.groupByDay, (v) =>
        this._patch({ groupByDay: v })
      )
    );

    // Speaker order
    const soWrap = document.createElement("div");
    soWrap.className = "section";
    soWrap.appendChild(this._label("Speaker order"));
    soWrap.appendChild(document.createElement("br"));

    const soSelect = document.createElement("select");
    soSelect.style.width = "100%";
    [
      { value: "alphabetical", label: "Alphabetical (by first name)" },
      { value: "sessionOrder", label: "Session order (drag & drop in Cvent)" },
    ].forEach((opt) => {
      const o = document.createElement("option");
      o.value = opt.value;
      o.textContent = opt.label;
      if ((this._config.speakerOrder || "alphabetical") === opt.value) {
        o.selected = true;
      }
      soSelect.appendChild(o);
    });
soSelect.onchange = () => {
      this._patch({ speakerOrder: soSelect.value });
    };

    soWrap.appendChild(soSelect);
    secLayout.block.appendChild(soWrap);

    // Hide the sticky date navigation (checked = hidden). First thing in the
    // Date Navigation section, above the sizing/colour controls.
    const hideNavWrap = document.createElement("div");
    hideNavWrap.className = "field";
    hideNavWrap.append(
      this._checkbox("Hide date nav bar", !!this._config.hideDateNav, (v) =>
        this._patch({ hideDateNav: v })
      )
    );
    secDateNav.block.prepend(hideNavWrap);
    // Date nav behaviour lives in "New Features".
    const dnModeWrap = document.createElement("div");
    dnModeWrap.className = "section";
    // Behaviour of a day click: scroll to it, or show only that day.
    dnModeWrap.appendChild(this._label("Date nav behavior"));
    dnModeWrap.appendChild(document.createElement("br"));
    const dnMode = document.createElement("select");
    [
      ["jump", "Jump — all days listed, click scrolls to the day"],
      ["filter", "Filter — all days shown; a day tab narrows to that day, 'All days' clears"],
    ].forEach(([v, label]) => {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = label;
      dnMode.appendChild(o);
    });
    dnMode.value = this._config.dateNavMode === "filter" ? "filter" : "jump";
    dnMode.style.width = "100%";
    dnMode.onchange = () => this._patch({ dateNavMode: dnMode.value });
    dnModeWrap.appendChild(dnMode);
    secNew.block.appendChild(dnModeWrap);

    // Concurrent session tiles — when ON, overlapping sessions render as
    // side-by-side tiles in a time grid. When OFF (default), all sessions render
    // in a single column regardless of overlap (the classic layout).
    featWrap.append(
      this._checkbox(
        "Show session filters (type / location / category / tags)",
        !!this._config.showFilters,
        (v) => this._patch({ showFilters: v })
      )
    );
    const filtersNote = document.createElement("div");
    filtersNote.style.fontSize = "11px";
    filtersNote.style.opacity = "0.7";
    filtersNote.style.margin = "4px 0 10px";
    filtersNote.textContent =
      "Adds a row of filter chips under the date nav. A facet only appears when the agenda has two or more values for it. Type uses the Plenary / Focus labels; breaks hide when a type is chosen.";
    featWrap.append(filtersNote);
    featWrap.append(
      this._checkbox(
        "Enable concurrent session tiles",
        !!this._config.concurrentTiles,
        (v) => this._patch({ concurrentTiles: v })
      )
    );
    const concurrentNote = document.createElement("div");
    concurrentNote.style.fontSize = "11px";
    concurrentNote.style.opacity = "0.7";
    concurrentNote.style.margin = "4px 0 0";
    concurrentNote.textContent =
      "Off = every session in a single column (classic). On = overlapping sessions shown as side-by-side tiles.";
    featWrap.append(concurrentNote);
    secNew.block.appendChild(featWrap);

    // Description Display Options (Radio Button Group)
    const descFieldset = document.createElement("fieldset");
    descFieldset.style.margin = "12px 0";
    const legend = document.createElement("legend");
    legend.textContent = "Description Display";
    legend.style.fontWeight = "600";
    descFieldset.append(legend);

    // Helper to make radio rows
    const makeRadio = (label, value, checked) => {
      const wrap = document.createElement("label");
      wrap.style.display = "flex";
      wrap.style.alignItems = "center";
      wrap.style.gap = "6px";
      wrap.style.margin = "4px 0";

      const rb = document.createElement("input");
      rb.type = "radio";
      rb.name = "descriptionMode";
      rb.value = value;
      rb.checked = checked;

      rb.onchange = () => {
        if (!rb.checked) return;

        if (value === "none") {
          this._patch({
            showDescription: false,
            showDescriptionLimited: false,
          });
        }

        if (value === "full") {
          this._patch({
            showDescription: true,
            showDescriptionLimited: false,
          });
        }

        if (value === "limited") {
          this._patch({
            showDescription: true,
            showDescriptionLimited: true,
          });
        }
      };

      wrap.append(rb, document.createTextNode(label));
      return wrap;
    };

    // Add three radio options
    descFieldset.append(
      makeRadio(
        "Hide description",
        "none",
        !this._config.showDescription && !this._config.showDescriptionLimited
      ),

      makeRadio(
        "Show full description",
        "full",
        this._config.showDescription && !this._config.showDescriptionLimited
      ),

      makeRadio(
        "Show limited description (2 lines + “Show more”)",
        "limited",
        this._config.showDescriptionLimited === true
      )
    );

    // Add to panel
    secLayout.block.append(descFieldset);

    secCards.block.append(
      this._colorRow(
        "Card Bg",
        "cardBg",
        this._config.cardBg || "#ffffff",
        (v) => this._patch({ cardBg: v })
      )
    );

    // Card Border Controls
    const borderFieldset = document.createElement("fieldset");
    borderFieldset.style.margin = "12px 0";

    const borderLegend = document.createElement("legend");
    borderLegend.textContent = "Card Border";
    borderFieldset.append(borderLegend);

    // width
    const borderWidthWrap = document.createElement("div");
    borderWidthWrap.className = "row field";

    const borderWidthLabel = this._label("Width (px)");
    const borderWidthInput = document.createElement("input");
    borderWidthInput.type = "number";
    borderWidthInput.min = "0";
    borderWidthInput.step = "0.5";
    borderWidthInput.value = this._config.cardBorder?.width ?? 0.5;

    borderWidthInput.oninput = () => {
      this._patch({
        cardBorder: {
          ...(this._config.cardBorder || {}),
          width: Number(borderWidthInput.value) || 0,
        },
      });
    };

    borderWidthWrap.append(borderWidthLabel, borderWidthInput);

    // style
    const borderStyleWrap = document.createElement("div");
    borderStyleWrap.className = "row field";

    const borderStyleLabel = this._label("Style");

    const borderStyleSelect = document.createElement("select");
    ["solid", "dashed", "dotted", "none"].forEach((style) => {
      const opt = document.createElement("option");
      opt.value = style;
      opt.textContent = style;
      if ((this._config.cardBorder?.style || "solid") === style) {
        opt.selected = true;
      }
      borderStyleSelect.append(opt);
    });

    borderStyleSelect.onchange = () => {
      this._patch({
        cardBorder: {
          ...(this._config.cardBorder || {}),
          style: borderStyleSelect.value,
        },
      });
    };

    borderStyleWrap.append(borderStyleLabel, borderStyleSelect);

    // color
    const borderColorWrap = document.createElement("div");
    borderColorWrap.className = "row field";

    const borderColorLabel = this._label("Color");

    const borderColorInput = document.createElement("input");
    borderColorInput.type = "color";
    borderColorInput.value = this._config.cardBorder?.color || "#cccccc";

    borderColorInput.onchange = () => {
      this._patch({
        cardBorder: {
          ...(this._config.cardBorder || {}),
          color: borderColorInput.value,
        },
      });
    };

    borderColorWrap.append(borderColorLabel, borderColorInput);

    // assemble
    borderFieldset.append(borderWidthWrap, borderStyleWrap, borderColorWrap);

    secCards.block.append(borderFieldset);


    // Typography (Agenda)
    const typoAgenda = document.createElement("div");
    typoAgenda.className = "grid";
    secTypoAgenda.block.append(typoAgenda);

    const AGENDA_TYPO_KEYS = [
      ["agendaHeader", "Agenda Header"],
      ["agendaSubheader", "Agenda Subheader"],
      ["eventDate", "Event Date (day header)"],
      ["sessionName", "Session Name"],
      ["sessionLocation", "Session Location"],
      ["sessionCategory", "Session Category"],
      ["sessionTime", "Session Start/End Time"],
      ["sessionDescription", "Session Description"],
      ["speakerName", "Speaker Name (card)"],
      ["speakerTitle", "Speaker Title (card)"],
      ["speakerCompany", "Speaker Company (card)"],
    ];

    AGENDA_TYPO_KEYS.forEach(([key, label]) => {
      const opts =
        key === "speakerName"
          ? { noColor: true, colorNote: "Colour follows the Plenary / Focus accent (Session Types)." }
          : {};
      typoAgenda.append(this._typographyBlock(key, label, opts));
    });

    // ============================
    // SPEAKER MODAL
    // ============================

    const modalBlock = secModal.block;

    // -------------------------
    // Modal Typography
    // -------------------------

    const h3ModalTypo = document.createElement("h3");
    h3ModalTypo.textContent = "Modal Typography";
    modalBlock.append(h3ModalTypo);

    const typoModal = document.createElement("div");
    typoModal.className = "grid";
    modalBlock.append(typoModal);

    const MODAL_TYPO_KEYS = [
      ["modalSpeakerName", "Modal Speaker Name"],
      ["modalSpeakerTitle", "Modal Speaker Title"],
      ["modalSpeakerCompany", "Modal Speaker Company"],
      ["modalSpeakerBio", "Modal Speaker Bio"],
      ["modalSessionsHeader", "Modal Sessions Header"],
      ["modalSessionName", "Modal Session Name"],
      ["modalSessionDateTime", "Modal Session Date & Time"],
    ];

    MODAL_TYPO_KEYS.forEach(([key, label]) => {
      typoModal.append(this._typographyBlock(key, label));
    });

    // ---- Translations: per-language overrides for the planner-typed text.
    // Blank = fall back to the English value above.
    {
      const note = document.createElement("div");
      note.style.fontSize = "11px";
      note.style.opacity = "0.7";
      note.style.margin = "0 0 10px";
      note.textContent =
        "Optional translations for the text you type elsewhere in this panel. Shown when the attendee's language selector matches. Leave a field blank to fall back to the English value.";
      secTranslations.block.appendChild(note);

      const FIELDS = [
        ["headerText", "Header", "Agenda"],
        ["subheaderText", "Subheader", "Here's what's scheduled for the event"],
        ["headerEyebrow", "Eyebrow text (Editorial header)", ""],
        ["plenaryLabel", "Plenary legend label", "plenary"],
        ["focusLabel", "Focus legend label", "Focus"],
      ];
      const LANGS = [
        ["es", "Spanish (es)"],
        ["pt", "Portuguese (pt)"],
      ];
      // Keep a handle on every translation input so the "English: …" hint can
      // follow edits to the base text live (the panel doesn't rebuild on
      // change; see _patch).
      this._translationInputs = [];
      LANGS.forEach(([lang, langLabel]) => {
        const h3 = document.createElement("h3");
        h3.textContent = langLabel;
        secTranslations.block.appendChild(h3);
        const current = (this._config.translations || {})[lang] || {};
        FIELDS.forEach(([key, label, dflt]) => {
          const wrap = document.createElement("div");
          wrap.className = "field";
          wrap.appendChild(this._label(label));
          wrap.appendChild(document.createElement("br"));
          const input = document.createElement("input");
          input.type = "text";
          input.style.width = "100%";
          input.value = typeof current[key] === "string" ? current[key] : "";
          this._translationInputs.push({ key, dflt, input });
          input.onchange = () => {
            const all = { ...(this._config.translations || {}) };
            all[lang] = { ...(all[lang] || {}), [key]: input.value };
            this._patch({ translations: all });
          };
          wrap.appendChild(input);
          secTranslations.block.appendChild(wrap);
        });
      });
    }

    this._refreshTranslationHints();

    [
      secHeader,
      secNew,
      secLayout,
      secDateNav,
      secCards,
      secTypes,
      secBreaks,
      secTypoAgenda,
      secModal,
      secTranslations,
    ].forEach((s) => panel.append(s.details));
  }

  // ===========================================================
  // UI HELPERS
  // ===========================================================

  _details(title, open = true) {
    const d = document.createElement("details");
    d.open = open;
    const sum = document.createElement("summary");
    const chev = document.createElement("span");
    chev.className = "chev";
    chev.textContent = "▶";
    sum.append(chev, document.createTextNode(" " + title));
    d.append(sum);
    return d;
  }

  _label(text) {
    const l = document.createElement("label");
    l.textContent = text;
    return l;
  }

  _checkbox(text, checked, onChange) {
    const wrap = document.createElement("label");
    wrap.style.display = "inline-flex";
    wrap.style.alignItems = "center";
    wrap.style.gap = "6px";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !!checked;

    cb.onchange = () => onChange(!!cb.checked);

    wrap.append(cb, document.createTextNode(text));
    return wrap;
  }

  _colorRow(labelText, id, current, onChange) {
    const wrap = document.createElement("div");
    wrap.className = "row field";

    const lbl = this._label(labelText);

    const picker = document.createElement("input");
    picker.type = "color";
    picker.id = id;
    picker.value = current;

    const hexInput = this._makeHexInput(current, (withHash) => {
      if (withHash !== picker.value) picker.value = withHash;
      onChange(withHash);
    });

    picker.onchange = () => {
      const v = picker.value || "#000000";
      hexInput.value = v.toUpperCase();
      onChange(v);
    };

    wrap.append(lbl, picker, hexInput);
    return wrap;
  }

  // ===========================================================
  // TYPOGRAPHY BLOCK
  // ===========================================================

  _typographyBlock(key, label, { noColor = false, colorNote = "" } = {}) {
    const defaults = this._makeDefaultTypography();
    const current =
      (this._config.typography && this._config.typography[key]) || {};
    const merged = Object.assign({}, defaults[key] || {}, current);

    const fs = document.createElement("fieldset");

    const lg = document.createElement("legend");
    lg.textContent = label;
    fs.append(lg);

    // ---------------------------
    // Font Sizes
    // ---------------------------

    const rowSizes = document.createElement("div");
    rowSizes.className = "row field";

    const mkSize = (lbl, prop) => {
      const wrap = document.createElement("div");
      const l = this._label(lbl);

      const i = document.createElement("input");
      i.type = "number";
      i.min = "8";
      i.max = "72";
      i.placeholder = "";
      i.value = merged[prop] !== undefined ? merged[prop] : "";

      // i.oninput = () => {
      //   const val =
      //     i.value === ""
      //       ? undefined
      //       : Math.max(10, Math.min(72, Number(i.value) || undefined));

      //   this._patch({
      //     typography: {
      //       ...this._config.typography,
      //       [key]: {
      //         ...(this._config.typography?.[key] || {}),
      //         [prop]: val,
      //       },
      //     },
      //   });
      // };

      const commitSize = () => {
        const raw = i.value.trim();

        const val =
          raw === "" ? undefined : Math.max(10, Math.min(72, Number(raw)));

        this._patch({
          typography: {
            ...this._config.typography,
            [key]: {
              ...(this._config.typography?.[key] || {}),
              [prop]: val,
            },
          },
        });
      };

      i.onchange = commitSize;
      i.onblur = commitSize;

      wrap.append(l, document.createElement("br"), i);
      return wrap;
    };

    // One size field: tablet / phone sizes scale from the built-in defaults.
    rowSizes.append(mkSize("Font size (px)", "fontSize"));

    fs.append(rowSizes);

    // ---------------------------
    // Color
    // ---------------------------

    const rowColor = document.createElement("div");
    rowColor.className = "row field";

    const colorWrap = document.createElement("div");
    const colorLbl = this._label("Color");

    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.value =
      this._config.typography?.[key]?.color ??
      this._makeDefaultTypography()?.[key]?.color ??
      "#000000";

    colorWrap.append(colorLbl, document.createElement("br"), colorInput);

    const hexWrap = document.createElement("div");
    const hexLbl = this._label("HEX");

    const initialHex =
      this._config.typography?.[key]?.color ??
      this._makeDefaultTypography()?.[key]?.color ??
      "#000000";

    const hexInput = this._makeHexInput(initialHex, (withHash) => {
      if (withHash !== colorInput.value) colorInput.value = withHash;

      this._patch({
        typography: {
          ...this._config.typography,
          [key]: {
            ...(this._config.typography?.[key] || {}),
            color: withHash,
          },
        },
      });
    });

    hexWrap.append(hexLbl, document.createElement("br"), hexInput);

    colorInput.onchange = () => {
      const v = colorInput.value || "#000000";
      hexInput.value = v.toUpperCase();

      this._patch({
        typography: {
          ...this._config.typography,
          [key]: {
            ...(this._config.typography?.[key] || {}),
            color: v,
          },
        },
      });
    };

    if (noColor) {
      const note = document.createElement("div");
      note.style.fontSize = "11px";
      note.style.opacity = "0.7";
      note.textContent = colorNote || "Colour follows the accent.";
      fs.append(note);
    } else {
      rowColor.append(colorWrap, hexWrap);
      fs.append(rowColor);
    }

    // ---------------------------
    // Bold / Italic / Underline
    // ---------------------------

    const rowBIU = document.createElement("div");
    rowBIU.className = "row field";

    rowBIU.append(
      this._flag(key, "bold", "Bold"),
      this._flag(key, "italic", "Italic"),
      this._flag(key, "underline", "Underline")
    );

    fs.append(rowBIU);

    return fs;
  }

  // ---------------------------
  // Bold / Italic / Underline helper
  // ---------------------------

  _flag(key, prop, label) {
    const wrap = document.createElement("label");
    wrap.style.display = "inline-flex";
    wrap.style.alignItems = "center";
    wrap.style.gap = "6px";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !!this._config.typography?.[key]?.[prop];

    cb.onchange = () => {
      this._patch({
        typography: {
          ...this._config.typography,
          [key]: {
            ...(this._config.typography?.[key] || {}),
            [prop]: cb.checked,
          },
        },
      });
    };

    wrap.append(cb, document.createTextNode(label));
    return wrap;
  }

  // ===========================================================
  // HEX INPUT HELPERS
  // ===========================================================

  _normalizeHex(v) {
    if (!v) return "";
    let s = v.trim().replace(/^#/, "").toUpperCase();
    if (s.length === 3)
      s = s
        .split("")
        .map((ch) => ch + ch)
        .join("");
    return s;
  }

  _isValidHex6(v) {
    return /^[0-9A-F]{6}$/.test(v);
  }

  _makeHexInput(initialHex, onValidHex) {
    const hex = document.createElement("input");
    hex.type = "text";
    hex.className = "hex";
    hex.placeholder = "#RRGGBB";
    hex.value = initialHex ? `#${this._normalizeHex(initialHex)}` : "#000000";

    const apply = () => {
      const norm = this._normalizeHex(hex.value);
      if (this._isValidHex6(norm)) {
        const withHash = `#${norm}`;
        hex.style.borderColor = "#ccc";
        hex.value = withHash;
        onValidHex(withHash);
      } else {
        hex.style.borderColor = "#d33";
      }
    };

    hex.addEventListener("change", apply);
    hex.addEventListener("blur", apply);

    hex.addEventListener("input", () => {
      const norm = this._normalizeHex(hex.value);
      hex.style.borderColor = this._isValidHex6(norm) ? "#0a0" : "#d33";
    });

    return hex;
  }

  // ===========================================================
  // STATE PATCHING
  // ===========================================================

  // Placeholder on each translation field = the CURRENT English value of
  // that text, so editing e.g. the focus label elsewhere updates the hint.
  _refreshTranslationHints() {
    (this._translationInputs || []).forEach(({ key, dflt, input }) => {
      const base =
        typeof this._config[key] === "string" && this._config[key].trim()
          ? this._config[key].trim()
          : dflt;
      input.placeholder = base ? `English: ${base}` : "(blank = auto)";
    });
  }

  _patch(patch) {
    const merged = { ...this._config, ...patch };

    // Deep merge typography
    if (patch.typography) {
      merged.typography = {
        ...(this._config.typography || {}),
        ...patch.typography,
      };
    }

    // Deep merge modalColors
    if (patch.modalColors) {
      merged.modalColors = {
        ...(this._config.modalColors || {}),
        ...patch.modalColors,
      };
    }

    this._config = merged;
    this.setConfiguration(this._config);
    this._refreshTranslationHints();
  }
}
