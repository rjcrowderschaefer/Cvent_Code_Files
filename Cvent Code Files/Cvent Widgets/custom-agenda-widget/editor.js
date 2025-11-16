// editor.js
// Planner-facing editor. Recreates your index.html + main.js control surface inside Shadow DOM
// and persists values via setConfiguration. No mock data required.

export default class ExampleAgendaEditor extends HTMLElement {
  constructor({ setConfiguration, initialConfiguration }) {
    super();
    this.setConfiguration = setConfiguration;
    this._config = initialConfiguration ?? this._getDefaultConfig();

    if (!initialConfiguration) {
      setConfiguration(this._config);
    }

    // Track whether a speaker modal is open
    this._modalIsOpen = false;

    this.attachShadow({ mode: "open" });
  }

  onConfigurationUpdate(newConfig) {
    this._config = newConfig || this._config;
    this._renderUI(); // Refresh with latest
  }

  connectedCallback() {
    // Listen for modal open / close events from AgendaItem.js
    window.addEventListener("cvent-speaker-modal-open", () => {
      this._modalIsOpen = true;
      this._renderUI();
    });

    window.addEventListener("cvent-speaker-modal-close", () => {
      this._modalIsOpen = false;
      this._renderUI();
    });

    this._renderUI();
  }

  // ============================
  // DEFAULT CONFIG
  // ============================

  _getDefaultConfig() {
    return {
      sort: "dateTimeAsc",
      maxResults: 100,
      groupByDay: true,
      showDescription: true,
      gutterBg: "#e8eef9",
      cardBg: "#ffffff",
      modalColors: {
        headerBg: "#ffffff",
        dividerColor: "#eeeeee",
        contentBg: "#ffffff"
      },
      typography: this._makeDefaultTypography()
    };
  }

  _makeDefaultTypography() {
    const base = {
      fontSize: 16,
      fontSizeMd: 15,
      fontSizeSm: 14,
      color: "#222222",
      bold: false,
      italic: false,
      underline: false
    };

    return {
      eventDate: { ...base, bold: true, fontSize: 18, color: "#003366" },

      sessionName: { ...base, fontSize: 20, bold: true, color: "#111111" },
      sessionTime: { ...base, fontSize: 14, color: "#555555" },
      sessionDescription: { ...base, fontSize: 15, color: "#333333" },

      speakerName: { ...base, fontSize: 15, bold: true, color: "#000000" },
      speakerTitle: { ...base, fontSize: 14, italic: true, color: "#333333" },
      speakerCompany: { ...base, fontSize: 14, color: "#555555" },

      modalName: { ...base, fontSize: 22, bold: true },
      modalSpeakerName: { ...base, fontSize: 18, bold: true },
      modalSpeakerTitle: { ...base, fontSize: 16, italic: true },
      modalSpeakerCompany: { ...base, fontSize: 16, color: "#444444" },
      modalSpeakerBio: { ...base, fontSize: 15, color: "#333333" },
      modalSessionsHeader: { ...base, fontSize: 16, bold: true },
      modalSessionName: { ...base, fontSize: 14 },
      modalSessionDateTime: { ...base, fontSize: 13, color: "#555555" }
    };
  }

  // ============================
  // MAIN RENDER FUNCTION
  // ============================

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
      input[type="number"] { width:90px; }
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

    // Sort dropdown
    const sortWrap = document.createElement("div");
    sortWrap.className = "section";
    sortWrap.append(this._label("Sort"), document.createElement("br"));

    const sort = document.createElement("select");
    ["dateTimeAsc","dateTimeDesc","nameAsc"].forEach(v => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent =
        v === "dateTimeAsc" ? "Date & time (asc)" :
        v === "dateTimeDesc" ? "Date & time (desc)" :
        "Name (A→Z)";
      if (this._config.sort === v) opt.selected = true;
      sort.append(opt);
    });
    sort.onchange = () => this._patch({ sort: sort.value });
    sortWrap.append(sort);
    agendaBlock.append(sortWrap);

    // Checkboxes
    const checks = document.createElement("div");
    checks.className = "section row";
    checks.append(
      this._checkbox("Group by day", !!this._config.groupByDay, v => this._patch({ groupByDay: v })),
      this._checkbox("Show description", !!this._config.showDescription, v => this._patch({ showDescription: v }))
    );
    agendaBlock.append(checks);

    // Colors
    agendaBlock.append(
      this._colorRow("Time Column • Background", "gutterBg",
        this._config.gutterBg || "#e8eef9",
        v => this._patch({ gutterBg: v })
      )
    );

    agendaBlock.append(
      this._colorRow("Card Background", "cardBg",
        this._config.cardBg || "#ffffff",
        v => this._patch({ cardBg: v })
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
      ["eventDate", "Event Date (day header)"],
      ["sessionName", "Session Name"],
      ["sessionTime", "Session Date & Start/End"],
      ["sessionDescription", "Session Description"],
      ["speakerName", "Speaker Name (card)"],
      ["speakerTitle", "Speaker Title (card)"],
      ["speakerCompany", "Speaker Company (card)"]
    ];

    AGENDA_TYPO_KEYS.forEach(([key, label]) => {
      typoAgenda.append(this._typographyBlock(key, label));
    });

    panel.append(agendaDetails);

    // ============================
    // CONDITIONAL: MODAL CONTROLS
    // Show only when a speaker modal is open
    // ============================

    if (this._modalIsOpen) {
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
          v => this._patch({
            modalColors: { ...this._config.modalColors, headerBg: v }
          })
        )
      );

      modalBlock.append(
        this._colorRow(
          "Divider line",
          "modalDivider",
          this._config.modalColors?.dividerColor || "#eeeeee",
          v => this._patch({
            modalColors: { ...this._config.modalColors, dividerColor: v }
          })
        )
      );

      modalBlock.append(
        this._colorRow(
          "Content background",
          "modalContentBg",
          this._config.modalColors?.contentBg || "#ffffff",
          v => this._patch({
            modalColors: { ...this._config.modalColors, contentBg: v }
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
        ["modalSessionDateTime", "Modal Session Date & Time"]
      ];

      MODAL_TYPO_KEYS.forEach(([key, label]) => {
        typoModal.append(this._typographyBlock(key, label));
      });

      panel.append(modalDetails);
    }
  }

  // ===========================================================
  // UI HELPERS
  // ===========================================================

  _details(title) {
    const d = document.createElement("details");
    d.open = true;

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
      i.min = "10";
      i.max = "72";
      i.placeholder = "default";
      i.value = this._config.typography?.[key]?.[prop] ?? "";

      i.oninput = () => {
        const val =
          i.value === "" ? undefined :
          Math.max(10, Math.min(72, Number(i.value) || undefined));

        this._patch({
          typography: {
            ...this._config.typography,
            [key]: {
              ...(this._config.typography?.[key] || {}),
              [prop]: val
            }
          }
        });
      };

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
    colorInput.value = this._config.typography?.[key]?.color || "#000000";

    colorWrap.append(colorLbl, document.createElement("br"), colorInput);

    const hexWrap = document.createElement("div");
    const hexLbl = this._label("HEX");

    const initialHex = this._config.typography?.[key]?.color || "#000000";

    const hexInput = this._makeHexInput(initialHex, (withHash) => {
      if (withHash !== colorInput.value) colorInput.value = withHash;

      this._patch({
        typography: {
          ...this._config.typography,
          [key]: {
            ...(this._config.typography?.[key] || {}),
            color: withHash
          }
        }
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
            color: v
          }
        }
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
            [prop]: cb.checked
          }
        }
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
    if (s.length === 3) s = s.split("").map(ch => ch + ch).join("");
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
        ...patch.typography
      };
    }

    // Deep merge modalColors
    if (patch.modalColors) {
      merged.modalColors = {
        ...(this._config.modalColors || {}),
        ...patch.modalColors
      };
    }

    this._config = merged;
    this.setConfiguration(this._config);
  }
}
