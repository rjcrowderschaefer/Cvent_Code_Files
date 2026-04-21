// editor.js
// Planner-facing editor. Recreates your index.html + main.js control surface inside Shadow DOM
// and persists values via setConfiguration. No mock data required.

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
    const incomingTypography = incoming.typography || {};
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
    const incomingTypography = incoming.typography || {};
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
      modalColors: {
        ...(defaults.modalColors || {}),
        ...(incoming.modalColors || {}),
      },
      typography: mergedTypography,
    };

    this._safeRenderUI();
  }

  connectedCallback() {
    this._safeRenderUI();
  }

  // ============================
  // DEFAULT CONFIG
  // ============================

  _getDefaultConfig() {
    return {
      headerText: "Agenda",
      subheaderText: "Here's what's scheduled for the event",
      sort: "dateTimeAsc",
      maxResults: 100,
      groupByDay: true,
      showDescription: true,
      showDescriptionLimited: false,
      gutterBg: "#f7a325",
      cardBg: "#ffffff",
      cardBorder: {
        width: 1,
        style: "solid",
        color: "#000000",
      },
      showMoreColor: "#f7a325",
      modalColors: {
        headerBg: "#f7a325",
        dividerColor: "#555555",
        contentBg: "#ffffff",
      },
      typography: this._makeDefaultTypography(),
    };
  }

  _makeDefaultTypography() {
    const base = {
      fontSize: 22,
      fontSizeMd: 18,
      fontSizeSm: 14,
      color: "#000000",
      bold: false,
      italic: false,
      underline: false,
    };

    return {
      agendaHeader: {
        ...base,
        fontSize: 40,
        fontSizeMd: 32,
        fontSizeSm: 24,
        bold: false,
      },
      agendaSubheader: {
        ...base,
        fontSize: 20,
        fontSizeMd: 18,
        fontSizeSm: 14,
      },
      eventDate: {
        ...base,
        fontSize: 22,
        fontSizeMd: 18,
        fontSizeSm: 14,
        bold: true,
      },
      sessionName: {
        ...base,
        fontSize: 25,
        fontSizeMd: 21,
        fontSizeSm: 17,
        bold: true,
      },
      sessionTime: {
        ...base,
        fontSize: 14,
        fontSizeMd: 14,
        fontSizeSm: 12,
        bold: true,
        color: "#FFFFFF",
      },
      sessionDescription: {
        ...base,
        fontSize: 16,
        fontSizeMd: 14,
        fontSizeSm: 12,
      },
      sessionLocation: {
        ...base,
        fontSize: 14,
        fontSizeMd: 12,
        fontSizeSm: 10,
      },
      sessionCategory: {
        ...base,
        fontSize: 14,
        fontSizeMd: 12,
        fontSizeSm: 10,
      },
      speakerName: {
        ...base,
        fontSize: 18,
        fontSizeMd: 16,
        fontSizeSm: 14,
        bold: true,
        color: "#F7A325",
      },

      speakerTitle: {
        ...base,
        fontSize: 15,
        fontSizeMd: 13,
        fontSizeSm: 11,
        italic: true,
      },
      speakerCompany: {
        ...base,
        fontSize: 15,
        fontSizeMd: 13,
        fontSizeSm: 11,
      },
      modalName: {
        ...base,
        bold: true,
      },
      modalSpeakerName: {
        ...base,
        bold: true,
      },
      modalSpeakerTitle: {
        ...base,
        fontSize: 18,
        fontSizeMd: 16,
        fontSizeSm: 14,
        italic: true,
      },
      modalSpeakerCompany: {
        ...base,
        fontSize: 18,
        fontSizeMd: 16,
        fontSizeSm: 14,
      },
      modalSpeakerBio: {
        ...base,
        fontSize: 16,
        fontSizeMd: 14,
        fontSizeSm: 12,
      },
      modalSessionsHeader: {
        ...base,
        fontSize: 18,
        fontSizeMd: 16,
        fontSizeSm: 14,
        bold: true,
      },
      modalSessionName: {
        ...base,
        fontSize: 16,
        fontSizeMd: 14,
        fontSizeSm: 12,
        bold: true,
      },
      modalSessionDateTime: {
        ...base,
        fontSize: 16,
        fontSizeMd: 14,
        fontSizeSm: 12,
      },
    };
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
    // AGENDA & CARD CONTROLS
    // ============================

    const agendaDetails = this._details("Agenda & Card Controls");
    const agendaBlock = document.createElement("div");
    agendaBlock.className = "block";
    agendaDetails.append(agendaBlock);

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
    agendaBlock.appendChild(headerWrap);

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
    agendaBlock.appendChild(subheaderWrap);

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
    agendaBlock.append(sortWrap);

    // Group by day checkbox stays
    agendaBlock.append(
      this._checkbox("Group by day", !!this._config.groupByDay, (v) =>
        this._patch({ groupByDay: v })
      )
    );

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
    agendaBlock.append(descFieldset);

    // Colors
    agendaBlock.append(
      this._colorRow(
        "Time Column Bg",
        "gutterBg",
        this._config.gutterBg || "#e8eef9",
        (v) => this._patch({ gutterBg: v })
      )
    );

    agendaBlock.append(
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
    borderWidthInput.value = this._config.cardBorder?.width ?? 1;

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
    borderColorInput.value = this._config.cardBorder?.color || "#000000";

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

    agendaBlock.append(borderFieldset);

    agendaBlock.append(
      this._colorRow(
        "Show More Color",
        "showMoreColor",
        this._config.showMoreColor || "#0066cc",
        (v) => this._patch({ showMoreColor: v })
      )
    );

    // Typography (Agenda)
    const h3Agenda = document.createElement("h3");
    h3Agenda.textContent = "Typography (Agenda)";
    agendaBlock.append(h3Agenda);

    const typoAgenda = document.createElement("div");
    typoAgenda.className = "grid";
    agendaBlock.append(typoAgenda);

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
      typoAgenda.append(this._typographyBlock(key, label));
    });

    panel.append(agendaDetails);

    // ============================
    // MODAL CONTROLS (always visible)
    // ============================

    const modalDetails = this._details("Speaker Modal Controls");
    const modalBlock = document.createElement("div");
    modalBlock.className = "block";
    modalDetails.append(modalBlock);

    // -------------------------
    // Modal Color Controls
    // -------------------------

    const h3ModalColors = document.createElement("h3");
    h3ModalColors.textContent = "Modal Colors";
    modalBlock.append(h3ModalColors);

    modalBlock.append(
      this._colorRow(
        "Header background",
        "modalHeaderBg",
        this._config.modalColors?.headerBg || "#ffffff",
        (v) =>
          this._patch({
            modalColors: { ...this._config.modalColors, headerBg: v },
          })
      )
    );

    modalBlock.append(
      this._colorRow(
        "Divider line",
        "modalDivider",
        this._config.modalColors?.dividerColor || "#eeeeee",
        (v) =>
          this._patch({
            modalColors: { ...this._config.modalColors, dividerColor: v },
          })
      )
    );

    modalBlock.append(
      this._colorRow(
        "Content background",
        "modalContentBg",
        this._config.modalColors?.contentBg || "#ffffff",
        (v) =>
          this._patch({
            modalColors: { ...this._config.modalColors, contentBg: v },
          })
      )
    );

    // -------------------------
    // Modal Typography
    // -------------------------

    const typoModal = document.createElement("div");
    typoModal.className = "grid";
    modalBlock.append(typoModal);

    const MODAL_TYPO_KEYS = [
      ["modalName", "Modal Name (top header)"],
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

    panel.append(modalDetails);
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

  _typographyBlock(key, label) {
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

    rowSizes.append(
      mkSize("Font size (px)", "fontSize"),
      mkSize("≤1024px (px)", "fontSizeMd"),
      mkSize("≤600px (px)", "fontSizeSm")
    );

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

    rowColor.append(colorWrap, hexWrap);
    fs.append(rowColor);

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
  }
}
