// editor.js
// Planner-facing editor. Renders configuration controls inside Shadow DOM
// and persists values via setConfiguration. Follows agenda widget editor patterns.

export default class FeaturedSpeakersEditor extends HTMLElement {
  constructor({ setConfiguration, initialConfiguration } = {}) {
    super();
    this.setConfiguration = setConfiguration;

    // Deep-merge defaults with any saved configuration
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
      if (!mergedTypography[key]) mergedTypography[key] = incomingTypography[key];
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

    // Planner roster: populated via onSpeakersUpdate (Cvent injects this)
    // Shape: [{ id, firstName, lastName, title, company, profilePictureUri }]
    this._allSpeakers = [];

    if (!initialConfiguration) {
      setConfiguration(this._config);
    }

    this.attachShadow({ mode: "open" });
  }

  // Called by Cvent when the planner's speaker roster changes
  onSpeakersUpdate(speakers) {
    this._allSpeakers = Array.isArray(speakers) ? speakers : [];
    this._safeRenderUI();
  }

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
      if (!mergedTypography[key]) mergedTypography[key] = incomingTypography[key];
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

  // =============================================
  // DEFAULT CONFIG
  // =============================================

  _getDefaultConfig() {
    return {
      headerText: "Featured Speakers",
      subheaderText: "Meet the experts taking the stage",
      featuredSpeakerIds: [],       // string[] — IDs the planner has selected
      columns: 3,                   // grid columns (1–6)
      cardGap: "16px",
      cardLayout: "vertical",       // "vertical" | "horizontal"
      cardBg: "#ffffff",
      accentColor: "#f7a325",
      showMoreColor: "#f7a325",
      cardBorder: {
        width: 1,
        style: "solid",
        color: "#000000",
      },
      showBio: false,
      showBioLimited: false,
      showSessions: true,
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
      fontSize: 16,
      fontSizeMd: 14,
      fontSizeSm: 13,
      color: "#000000",
      bold: false,
      italic: false,
      underline: false,
    };

    return {
      widgetHeader: {
        ...base,
        fontSize: 40,
        fontSizeMd: 32,
        fontSizeSm: 24,
        bold: false,
      },
      widgetSubheader: {
        ...base,
        fontSize: 20,
        fontSizeMd: 18,
        fontSizeSm: 14,
      },
      speakerName: {
        ...base,
        fontSize: 18,
        fontSizeMd: 16,
        fontSizeSm: 14,
        bold: true,
        color: "#f7a325",
      },
      speakerTitle: {
        ...base,
        fontSize: 14,
        fontSizeMd: 13,
        fontSizeSm: 12,
        italic: true,
      },
      speakerCompany: {
        ...base,
        fontSize: 14,
        fontSizeMd: 13,
        fontSizeSm: 12,
      },
      speakerBio: {
        ...base,
        fontSize: 13,
        fontSizeMd: 12,
        fontSizeSm: 12,
      },
      modalSpeakerName: {
        ...base,
        bold: true,
      },
      modalSpeakerTitle: {
        ...base,
        fontSize: 16,
        fontSizeMd: 14,
        fontSizeSm: 13,
        italic: true,
      },
      modalSpeakerCompany: {
        ...base,
        fontSize: 16,
        fontSizeMd: 14,
        fontSizeSm: 13,
      },
      modalSpeakerBio: {
        ...base,
        fontSize: 15,
        fontSizeMd: 14,
        fontSizeSm: 13,
      },
      modalSessionsHeader: {
        ...base,
        fontSize: 16,
        fontSizeMd: 14,
        fontSizeSm: 13,
        bold: true,
      },
      modalSessionName: {
        ...base,
        fontSize: 14,
        fontSizeMd: 13,
        fontSizeSm: 12,
        bold: true,
      },
      modalSessionDateTime: {
        ...base,
        fontSize: 14,
        fontSizeMd: 13,
        fontSizeSm: 12,
      },
    };
  }

  // =============================================
  // RENDER
  // =============================================

  _safeRenderUI() {
    const scrollTop = this.scrollTop;
    const detailsState = [...this.shadowRoot.querySelectorAll("details")].map((d) => d.open);

    this._renderUI();

    const newDetails = [...this.shadowRoot.querySelectorAll("details")];
    detailsState.forEach((wasOpen, i) => {
      if (newDetails[i]) newDetails[i].open = wasOpen;
    });

    this.scrollTop = scrollTop;
  }

  _renderUI() {
    this.shadowRoot.innerHTML = "";

    const style = document.createElement("style");
    style.textContent = `
      :host {
        display: block;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      }
      .panel { padding: 14px; }
      .section { margin: 10px 0 14px; }
      .field { margin: 8px 0; }
      .row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
      fieldset { border: 1px solid #ddd; border-radius: 8px; padding: 10px; margin: 10px 0; }
      legend { padding: 0 6px; font-weight: 600; }
      label { font-size: 12px; opacity: .85; }
      input[type="number"] {
        width: 100px; min-width: 100px;
        pointer-events: auto; user-select: text; -webkit-user-select: text; cursor: text;
      }
      input[type="color"] { width: 48px; height: 28px; padding: 0; border: none; background: transparent; }
      h3 { margin: 14px 0 6px; }
      details { border: 1px solid #e7e7e7; border-radius: 8px; margin: 10px 0; background: #fff; }
      summary {
        list-style: none; cursor: pointer; padding: 10px 12px;
        font-weight: 600; display: flex; align-items: center; gap: 8px;
      }
      summary::-webkit-details-marker { display: none; }
      .chev { transition: transform .18s ease; }
      details[open] .chev { transform: rotate(90deg); }
      .block { padding: 0 12px 12px 12px; }
      .grid { display: grid; grid-template-columns: 1fr; gap: 10px; }
      input.hex {
        width: 92px; height: 28px; padding: 2px 6px;
        border: 1px solid #ccc; border-radius: 6px;
        font-family: ui-monospace; font-size: 12px;
      }

      /* Speaker selector */
      .speaker-roster {
        display: flex;
        flex-direction: column;
        gap: 6px;
        max-height: 320px;
        overflow-y: auto;
        border: 1px solid #e7e7e7;
        border-radius: 8px;
        padding: 8px;
        background: #fafafa;
      }
      .speaker-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 7px 10px;
        border-radius: 6px;
        border: 1px solid transparent;
        cursor: pointer;
        background: #fff;
        transition: background 0.12s, border-color 0.12s;
      }
      .speaker-row:hover { border-color: #ccc; }
      .speaker-row.selected {
        border-color: #185FA5;
        background: #e6f1fb;
      }
      .sp-avatar {
        width: 32px; height: 32px;
        border-radius: 50%; object-fit: cover; flex-shrink: 0;
        background: #e0e0e0;
      }
      .sp-info { flex: 1; min-width: 0; }
      .sp-name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .sp-meta { font-size: 11px; color: #666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .sp-check { font-size: 16px; color: #185FA5; flex-shrink: 0; }
      .selected-order {
        font-size: 11px;
        font-weight: 700;
        color: #fff;
        background: #185FA5;
        border-radius: 50%;
        width: 20px; height: 20px;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
      }
      .roster-empty {
        padding: 16px;
        text-align: center;
        font-size: 13px;
        color: #888;
      }
      .selected-summary {
        font-size: 12px;
        color: #555;
        margin: 6px 0 10px;
      }
      .clear-btn {
        font-size: 11px;
        color: #c00;
        cursor: pointer;
        text-decoration: underline;
        background: none;
        border: none;
        padding: 0;
        margin-left: 8px;
      }
      .search-input {
        width: 100%;
        box-sizing: border-box;
        padding: 6px 10px;
        border: 1px solid #ddd;
        border-radius: 6px;
        font-size: 13px;
        margin-bottom: 8px;
      }
    `;
    this.shadowRoot.append(style);

    const panel = document.createElement("div");
    panel.className = "panel";
    this.shadowRoot.append(panel);

    // =============================================
    // SECTION 1: WIDGET & CARD CONTROLS
    // =============================================

    const widgetDetails = this._details("Widget & Card Controls");
    const widgetBlock = document.createElement("div");
    widgetBlock.className = "block";
    widgetDetails.append(widgetBlock);

    // Header
    this._appendTextInput(widgetBlock, "Header", "headerText", "Featured Speakers");
    // Subheader
    this._appendTextInput(widgetBlock, "Subheader", "subheaderText", "Meet the experts taking the stage");

    // Columns
    const columnsWrap = document.createElement("div");
    columnsWrap.className = "section";
    columnsWrap.append(this._label("Columns (1–6)"), document.createElement("br"));
    const columnsInput = document.createElement("input");
    columnsInput.type = "number";
    columnsInput.min = "1";
    columnsInput.max = "6";
    columnsInput.value = this._config.columns || 3;
    columnsInput.onchange = () => {
      const v = Math.min(6, Math.max(1, Number(columnsInput.value) || 3));
      this._patch({ columns: v });
    };
    columnsWrap.append(columnsInput);
    widgetBlock.append(columnsWrap);

    // Card Layout radio
    const layoutFieldset = document.createElement("fieldset");
    const layoutLegend = document.createElement("legend");
    layoutLegend.textContent = "Card Layout";
    layoutFieldset.append(layoutLegend);

    const makeLayoutRadio = (label, value) => {
      const wrap = document.createElement("label");
      wrap.style.cssText = "display:flex;align-items:center;gap:6px;margin:4px 0;";
      const rb = document.createElement("input");
      rb.type = "radio";
      rb.name = "cardLayout";
      rb.value = value;
      rb.checked = (this._config.cardLayout || "vertical") === value;
      rb.onchange = () => { if (rb.checked) this._patch({ cardLayout: value }); };
      wrap.append(rb, document.createTextNode(label));
      return wrap;
    };
    layoutFieldset.append(
      makeLayoutRadio("Vertical (avatar on top)", "vertical"),
      makeLayoutRadio("Horizontal (avatar left, text right)", "horizontal")
    );
    widgetBlock.append(layoutFieldset);

    // Bio display options
    const bioFieldset = document.createElement("fieldset");
    const bioLegend = document.createElement("legend");
    bioLegend.textContent = "Bio Display (on card)";
    bioFieldset.append(bioLegend);

    const makeBioRadio = (label, value, checked) => {
      const wrap = document.createElement("label");
      wrap.style.cssText = "display:flex;align-items:center;gap:6px;margin:4px 0;";
      const rb = document.createElement("input");
      rb.type = "radio";
      rb.name = "bioMode";
      rb.value = value;
      rb.checked = checked;
      rb.onchange = () => {
        if (!rb.checked) return;
        if (value === "none") this._patch({ showBio: false, showBioLimited: false });
        if (value === "full") this._patch({ showBio: true, showBioLimited: false });
        if (value === "limited") this._patch({ showBio: true, showBioLimited: true });
      };
      wrap.append(rb, document.createTextNode(label));
      return wrap;
    };
    bioFieldset.append(
      makeBioRadio("Hide bio", "none", !this._config.showBio),
      makeBioRadio("Show full bio", "full", this._config.showBio && !this._config.showBioLimited),
      makeBioRadio("Show limited bio (3 lines + `Show more`)", "limited", !!this._config.showBioLimited)
    );
    widgetBlock.append(bioFieldset);

    // Show sessions in modal
    widgetBlock.append(
      this._checkbox("Show sessions in speaker modal", !!this._config.showSessions, (v) =>
        this._patch({ showSessions: v })
      )
    );

    // Colors
    widgetBlock.append(
      this._colorRow("Card background", "cardBg", this._config.cardBg || "#ffffff", (v) =>
        this._patch({ cardBg: v })
      )
    );
    widgetBlock.append(
      this._colorRow("Accent color", "accentColor", this._config.accentColor || "#f7a325", (v) =>
        this._patch({ accentColor: v })
      )
    );
    widgetBlock.append(
      this._colorRow("Show more color", "showMoreColor", this._config.showMoreColor || "#f7a325", (v) =>
        this._patch({ showMoreColor: v })
      )
    );

    // Card Border
    const borderFieldset = document.createElement("fieldset");
    const borderLegend = document.createElement("legend");
    borderLegend.textContent = "Card Border";
    borderFieldset.append(borderLegend);

    const borderWidthWrap = document.createElement("div");
    borderWidthWrap.className = "row field";
    const borderWidthInput = document.createElement("input");
    borderWidthInput.type = "number";
    borderWidthInput.min = "0";
    borderWidthInput.value = this._config.cardBorder?.width ?? 1;
    borderWidthInput.oninput = () => {
      this._patch({ cardBorder: { ...(this._config.cardBorder || {}), width: Number(borderWidthInput.value) || 0 } });
    };
    borderWidthWrap.append(this._label("Width (px)"), borderWidthInput);

    const borderStyleWrap = document.createElement("div");
    borderStyleWrap.className = "row field";
    const borderStyleSelect = document.createElement("select");
    ["solid", "dashed", "dotted", "none"].forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s;
      if ((this._config.cardBorder?.style || "solid") === s) opt.selected = true;
      borderStyleSelect.append(opt);
    });
    borderStyleSelect.onchange = () => {
      this._patch({ cardBorder: { ...(this._config.cardBorder || {}), style: borderStyleSelect.value } });
    };
    borderStyleWrap.append(this._label("Style"), borderStyleSelect);

    const borderColorWrap = document.createElement("div");
    borderColorWrap.className = "row field";
    const borderColorInput = document.createElement("input");
    borderColorInput.type = "color";
    borderColorInput.value = this._config.cardBorder?.color || "#000000";
    borderColorInput.onchange = () => {
      this._patch({ cardBorder: { ...(this._config.cardBorder || {}), color: borderColorInput.value } });
    };
    borderColorWrap.append(this._label("Color"), borderColorInput);

    borderFieldset.append(borderWidthWrap, borderStyleWrap, borderColorWrap);
    widgetBlock.append(borderFieldset);

    // Typography (widget)
    const h3Widget = document.createElement("h3");
    h3Widget.textContent = "Typography (Widget)";
    widgetBlock.append(h3Widget);

    const typoWidget = document.createElement("div");
    typoWidget.className = "grid";
    widgetBlock.append(typoWidget);

    [
      ["widgetHeader", "Widget Header"],
      ["widgetSubheader", "Widget Subheader"],
      ["speakerName", "Speaker Name"],
      ["speakerTitle", "Speaker Title"],
      ["speakerCompany", "Speaker Company"],
      ["speakerBio", "Speaker Bio (on card)"],
    ].forEach(([key, label]) => typoWidget.append(this._typographyBlock(key, label)));

    panel.append(widgetDetails);

    // =============================================
    // SECTION 2: FEATURED SPEAKER SELECTOR
    // =============================================

    const selectorDetails = this._details("Featured Speaker Selection");
    const selectorBlock = document.createElement("div");
    selectorBlock.className = "block";
    selectorDetails.append(selectorBlock);

    const selectedIds = Array.isArray(this._config.featuredSpeakerIds)
      ? this._config.featuredSpeakerIds
      : [];

    // Summary line
    const summaryLine = document.createElement("div");
    summaryLine.className = "selected-summary";
    summaryLine.textContent = selectedIds.length
      ? `${selectedIds.length} speaker${selectedIds.length > 1 ? "s" : ""} selected`
      : "No speakers selected — all event speakers will be shown";

    if (selectedIds.length) {
      const clearBtn = document.createElement("button");
      clearBtn.className = "clear-btn";
      clearBtn.textContent = "Clear all";
      clearBtn.onclick = () => this._patch({ featuredSpeakerIds: [] });
      summaryLine.append(clearBtn);
    }
    selectorBlock.append(summaryLine);

    // Search box
    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.className = "search-input";
    searchInput.placeholder = "Search speakers by name, title, or company...";
    selectorBlock.append(searchInput);

    // Roster
    const roster = document.createElement("div");
    roster.className = "speaker-roster";
    selectorBlock.append(roster);

    const renderRoster = (filter = "") => {
      roster.innerHTML = "";

      if (!this._allSpeakers.length) {
        const empty = document.createElement("div");
        empty.className = "roster-empty";
        empty.textContent = "No speakers found in this event yet.";
        roster.append(empty);
        return;
      }

      const lower = filter.toLowerCase();
      const filtered = this._allSpeakers.filter((sp) => {
        if (!lower) return true;
        const name = `${sp?.firstName || ""} ${sp?.lastName || ""}`.toLowerCase();
        const title = (sp?.title || sp?.designation || "").toLowerCase();
        const company = (sp?.company || sp?.organization || "").toLowerCase();
        return name.includes(lower) || title.includes(lower) || company.includes(lower);
      });

      if (!filtered.length) {
        const empty = document.createElement("div");
        empty.className = "roster-empty";
        empty.textContent = "No speakers match your search.";
        roster.append(empty);
        return;
      }

      filtered.forEach((sp) => {
        const id = sp?.id || sp?.speakerId;
        const orderIdx = selectedIds.indexOf(id);
        const isSelected = orderIdx !== -1;

        const row = document.createElement("div");
        row.className = "speaker-row" + (isSelected ? " selected" : "");

        // Order badge or empty spacer
        if (isSelected) {
          const badge = document.createElement("div");
          badge.className = "selected-order";
          badge.textContent = orderIdx + 1;
          row.append(badge);
        } else {
          const spacer = document.createElement("div");
          spacer.style.cssText = "width:20px;height:20px;flex-shrink:0;";
          row.append(spacer);
        }

        // Avatar
        const avatar = document.createElement("img");
        avatar.className = "sp-avatar";
        avatar.src =
          (sp?.profilePictureUri || "").trim() ||
          "https://custom.cvent.com/437e6683a93144aaaee124507fc78642/pix/2ee8c4642e97488abc1852d9166b179b.png";
        avatar.alt = "";
        row.append(avatar);

        // Info
        const info = document.createElement("div");
        info.className = "sp-info";

        const nameDiv = document.createElement("div");
        nameDiv.className = "sp-name";
        nameDiv.textContent = `${(sp?.firstName || "").trim()} ${(sp?.lastName || "").trim()}`.trim();

        const titleTxt = (sp?.title || sp?.designation || "").trim();
        const companyTxt = (sp?.company || sp?.organization || "").trim();
        const metaDiv = document.createElement("div");
        metaDiv.className = "sp-meta";
        metaDiv.textContent = [titleTxt, companyTxt].filter(Boolean).join(" · ");

        info.append(nameDiv, metaDiv);
        row.append(info);

        // Toggle selection on click
        row.onclick = () => {
          const currentIds = Array.isArray(this._config.featuredSpeakerIds)
            ? [...this._config.featuredSpeakerIds]
            : [];
          const idx = currentIds.indexOf(id);
          if (idx !== -1) {
            currentIds.splice(idx, 1);
          } else {
            currentIds.push(id);
          }
          this._patch({ featuredSpeakerIds: currentIds });
        };

        roster.append(row);
      });
    };

    renderRoster();

    searchInput.addEventListener("input", () => {
      renderRoster(searchInput.value);
    });

    panel.append(selectorDetails);

    // =============================================
    // SECTION 3: MODAL CONTROLS
    // =============================================

    const modalDetails = this._details("Speaker Modal Controls");
    const modalBlock = document.createElement("div");
    modalBlock.className = "block";
    modalDetails.append(modalBlock);

    const h3ModalColors = document.createElement("h3");
    h3ModalColors.textContent = "Modal Colors";
    modalBlock.append(h3ModalColors);

    modalBlock.append(
      this._colorRow("Header background", "modalHeaderBg", this._config.modalColors?.headerBg || "#f7a325", (v) =>
        this._patch({ modalColors: { ...this._config.modalColors, headerBg: v } })
      ),
      this._colorRow("Divider line", "modalDivider", this._config.modalColors?.dividerColor || "#555555", (v) =>
        this._patch({ modalColors: { ...this._config.modalColors, dividerColor: v } })
      ),
      this._colorRow("Content background", "modalContentBg", this._config.modalColors?.contentBg || "#ffffff", (v) =>
        this._patch({ modalColors: { ...this._config.modalColors, contentBg: v } })
      )
    );

    const h3ModalTypo = document.createElement("h3");
    h3ModalTypo.textContent = "Typography (Modal)";
    modalBlock.append(h3ModalTypo);

    const typoModal = document.createElement("div");
    typoModal.className = "grid";
    modalBlock.append(typoModal);

    [
      ["modalSpeakerName", "Modal Speaker Name"],
      ["modalSpeakerTitle", "Modal Speaker Title"],
      ["modalSpeakerCompany", "Modal Speaker Company"],
      ["modalSpeakerBio", "Modal Speaker Bio"],
      ["modalSessionsHeader", "Modal Sessions Header"],
      ["modalSessionName", "Modal Session Name"],
      ["modalSessionDateTime", "Modal Session Date & Time"],
    ].forEach(([key, label]) => typoModal.append(this._typographyBlock(key, label)));

    panel.append(modalDetails);
  }

  // =============================================
  // UI HELPERS  (mirrors editor.js patterns exactly)
  // =============================================

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

  _appendTextInput(parent, labelText, configKey, placeholder) {
    const wrap = document.createElement("div");
    wrap.className = "section";
    wrap.append(this._label(labelText), document.createElement("br"));
    const input = document.createElement("input");
    input.type = "text";
    input.value = this._config[configKey] !== undefined ? this._config[configKey] : placeholder;
    input.placeholder = placeholder;
    input.style.width = "100%";
    input.onchange = () => this._patch({ [configKey]: input.value });
    wrap.append(input);
    parent.append(wrap);
  }

  _checkbox(text, checked, onChange) {
    const wrap = document.createElement("label");
    wrap.style.cssText = "display:inline-flex;align-items:center;gap:6px;";
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

  _typographyBlock(key, label) {
    const defaults = this._makeDefaultTypography();
    const current = (this._config.typography && this._config.typography[key]) || {};
    const merged = Object.assign({}, defaults[key] || {}, current);

    const fs = document.createElement("fieldset");
    const lg = document.createElement("legend");
    lg.textContent = label;
    fs.append(lg);

    // Font sizes
    const rowSizes = document.createElement("div");
    rowSizes.className = "row field";

    const mkSize = (lbl, prop) => {
      const wrap = document.createElement("div");
      const l = this._label(lbl);
      const i = document.createElement("input");
      i.type = "number";
      i.min = "8";
      i.max = "72";
      i.value = merged[prop] !== undefined ? merged[prop] : "";

      const commit = () => {
        const raw = i.value.trim();
        const val = raw === "" ? undefined : Math.max(8, Math.min(72, Number(raw)));
        this._patch({
          typography: {
            ...this._config.typography,
            [key]: { ...(this._config.typography?.[key] || {}), [prop]: val },
          },
        });
      };
      i.onchange = commit;
      i.onblur = commit;
      wrap.append(l, document.createElement("br"), i);
      return wrap;
    };

    rowSizes.append(mkSize("Font size (px)", "fontSize"), mkSize("≤1024px (px)", "fontSizeMd"), mkSize("≤600px (px)", "fontSizeSm"));
    fs.append(rowSizes);

    // Color
    const rowColor = document.createElement("div");
    rowColor.className = "row field";

    const colorWrap = document.createElement("div");
    const colorLbl = this._label("Color");
    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.value =
      this._config.typography?.[key]?.color ?? this._makeDefaultTypography()?.[key]?.color ?? "#000000";
    colorWrap.append(colorLbl, document.createElement("br"), colorInput);

    const hexWrap = document.createElement("div");
    const initialHex = this._config.typography?.[key]?.color ?? this._makeDefaultTypography()?.[key]?.color ?? "#000000";
    const hexInput = this._makeHexInput(initialHex, (withHash) => {
      if (withHash !== colorInput.value) colorInput.value = withHash;
      this._patch({
        typography: {
          ...this._config.typography,
          [key]: { ...(this._config.typography?.[key] || {}), color: withHash },
        },
      });
    });
    hexWrap.append(this._label("HEX"), document.createElement("br"), hexInput);

    colorInput.onchange = () => {
      const v = colorInput.value || "#000000";
      hexInput.value = v.toUpperCase();
      this._patch({
        typography: {
          ...this._config.typography,
          [key]: { ...(this._config.typography?.[key] || {}), color: v },
        },
      });
    };

    rowColor.append(colorWrap, hexWrap);
    fs.append(rowColor);

    // Bold / Italic / Underline
    const rowBIU = document.createElement("div");
    rowBIU.className = "row field";
    rowBIU.append(this._flag(key, "bold", "Bold"), this._flag(key, "italic", "Italic"), this._flag(key, "underline", "Underline"));
    fs.append(rowBIU);

    return fs;
  }

  _flag(key, prop, label) {
    const wrap = document.createElement("label");
    wrap.style.cssText = "display:inline-flex;align-items:center;gap:6px;";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !!this._config.typography?.[key]?.[prop];
    cb.onchange = () => {
      this._patch({
        typography: {
          ...this._config.typography,
          [key]: { ...(this._config.typography?.[key] || {}), [prop]: cb.checked },
        },
      });
    };
    wrap.append(cb, document.createTextNode(label));
    return wrap;
  }

  // =============================================
  // HEX INPUT HELPERS
  // =============================================

  _normalizeHex(v) {
    if (!v) return "";
    let s = v.trim().replace(/^#/, "").toUpperCase();
    if (s.length === 3) s = s.split("").map((ch) => ch + ch).join("");
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

  // =============================================
  // STATE PATCHING
  // =============================================

  _patch(patch) {
    const merged = { ...this._config, ...patch };

    if (patch.typography) {
      merged.typography = { ...(this._config.typography || {}), ...patch.typography };
    }
    if (patch.modalColors) {
      merged.modalColors = { ...(this._config.modalColors || {}), ...patch.modalColors };
    }

    this._config = merged;
    this.setConfiguration(this._config);
  }

  _makeDefaultTypography() {
    const base = {
      fontSize: 16,
      fontSizeMd: 14,
      fontSizeSm: 13,
      color: "#000000",
      bold: false,
      italic: false,
      underline: false,
    };
    return {
      widgetHeader:        { ...base, fontSize: 40, fontSizeMd: 32, fontSizeSm: 24, bold: false },
      widgetSubheader:     { ...base, fontSize: 20, fontSizeMd: 18, fontSizeSm: 14 },
      speakerName:         { ...base, fontSize: 18, fontSizeMd: 16, fontSizeSm: 14, bold: true, color: "#f7a325" },
      speakerTitle:        { ...base, fontSize: 14, fontSizeMd: 13, fontSizeSm: 12, italic: true },
      speakerCompany:      { ...base, fontSize: 14, fontSizeMd: 13, fontSizeSm: 12 },
      speakerBio:          { ...base, fontSize: 13, fontSizeMd: 12, fontSizeSm: 12 },
      modalSpeakerName:    { ...base, bold: true },
      modalSpeakerTitle:   { ...base, fontSize: 16, fontSizeMd: 14, fontSizeSm: 13, italic: true },
      modalSpeakerCompany: { ...base, fontSize: 16, fontSizeMd: 14, fontSizeSm: 13 },
      modalSpeakerBio:     { ...base, fontSize: 15, fontSizeMd: 14, fontSizeSm: 13 },
      modalSessionsHeader: { ...base, fontSize: 16, fontSizeMd: 14, fontSizeSm: 13, bold: true },
      modalSessionName:    { ...base, fontSize: 14, fontSizeMd: 13, fontSizeSm: 12, bold: true },
      modalSessionDateTime:{ ...base, fontSize: 14, fontSizeMd: 13, fontSizeSm: 12 },
    };
  }
}