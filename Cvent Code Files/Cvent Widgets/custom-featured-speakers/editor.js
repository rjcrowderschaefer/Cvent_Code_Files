// editor.js
// Planner-facing editor for the Featured Speakers widget (NYCW design).
// Renders configuration controls inside Shadow DOM and persists values via
// setConfiguration. Sections: Section text, Layout, Colours, Speaker selection,
// Modal, Typography (section) and Typography (modal).

export default class FeaturedSpeakersEditor extends HTMLElement {
  constructor({ setConfiguration, initialConfiguration } = {}) {
    super();
    this.setConfiguration = setConfiguration;

    this._config = this._mergeWithDefaults(initialConfiguration || {});
    this._allSpeakers = [];
    this._speakersLoading = false;
    this._rosterFilter = "";

    if (!initialConfiguration) {
      setConfiguration(this._config);
    }

    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this._safeRenderUI();
    this._loadSpeakers();
  }

  onConfigurationUpdate(newConfig) {
    this._config = this._mergeWithDefaults(newConfig || {});
    this._safeRenderUI();
  }

  _mergeWithDefaults(incoming) {
    const defaults = this._getDefaultConfig();
    const mergedTypography = {};
    const dT = defaults.typography || {};
    const iT = incoming.typography || {};
    Object.keys(dT).forEach((k) => { mergedTypography[k] = { ...(dT[k] || {}), ...(iT[k] || {}) }; });
    Object.keys(iT).forEach((k) => { if (!mergedTypography[k]) mergedTypography[k] = iT[k]; });

    return {
      ...defaults,
      ...incoming,
      colors: { ...(defaults.colors || {}), ...(incoming.colors || {}) },
      typography: mergedTypography,
    };
  }

  // =============================================
  // SPEAKER LOADING (roster for the selector)
  // =============================================

  _resolveGetSpeakers() {
    if (this.cventSdk?.getSpeakers) return this.cventSdk.getSpeakers.bind(this.cventSdk);
    if (typeof this.getSpeakers === "function") return this.getSpeakers.bind(this);
    if (typeof window !== "undefined" && typeof window.getSpeakers === "function") return window.getSpeakers;
    return undefined;
  }

  async _loadSpeakers() {
    if (this._speakersLoading) return;
    this._speakersLoading = true;

    try {
      let gen = null;
      if (this.cventSdk?.getSessionGenerator) gen = await this.cventSdk.getSessionGenerator("dateTimeAsc", 200);
      else if (typeof this.getSessionGenerator === "function") gen = await this.getSessionGenerator("dateTimeAsc", 200);

      if (!gen) {
        console.warn("[editor.js] getSessionGenerator not available; cannot load speaker roster.");
        return;
      }

      const sessions = [];
      for await (const page of gen) {
        const batch = Array.isArray(page) ? page
          : Array.isArray(page?.sessions) ? page.sessions
          : Array.isArray(page?.records) ? page.records : [];
        if (batch.length) sessions.push(...batch);
        if (sessions.length >= 200) break;
      }

      const idSet = new Set();
      sessions.forEach((sess) => {
        const list = Array.isArray(sess.resolvedSpeakers) ? sess.resolvedSpeakers
          : Array.isArray(sess.speakers) ? sess.speakers.map((x) => (x && x.speaker ? x.speaker : x)).filter(Boolean)
          : [];
        list.forEach((sp) => {
          const id = sp?.id || sp?.speakerId;
          if (id) idSet.add(String(id));
        });
      });

      const ids = [...idSet];
      if (!ids.length) {
        console.warn("[editor.js] No speaker IDs found in sessions.");
        return;
      }

      const getSpeakers = this._resolveGetSpeakers();
      if (!getSpeakers) {
        console.warn("[editor.js] getSpeakers not available.");
        return;
      }

      const map = await getSpeakers(ids);
      if (!map || typeof map !== "object") {
        console.warn("[editor.js] getSpeakers returned unexpected shape:", map);
        return;
      }

      const speakers = Object.values(map).filter((s) => s && !s.failureReason);
      speakers.sort((a, b) => {
        const aName = `${a?.firstName || ""} ${a?.lastName || ""}`.trim().toLowerCase();
        const bName = `${b?.firstName || ""} ${b?.lastName || ""}`.trim().toLowerCase();
        return aName.localeCompare(bName);
      });

      this._allSpeakers = speakers;
      this._safeRenderUI();
    } catch (e) {
      console.warn("[editor.js] _loadSpeakers error:", e);
    } finally {
      this._speakersLoading = false;
    }
  }

  // =============================================
  // DEFAULT CONFIG (NYCW tokens)
  // =============================================

  _getDefaultConfig() {
    return {
      eyebrowText: "",
      headerText: "Featured Speakers",
      introText: "Select a speaker to read their bio.",
      moreText: "",
      noteText: "",
      featuredSpeakerIds: [],
      tileSize: 200,
      gridGapRow: 36,
      gridGapCol: 24,
      gridAlign: "center",
      hoverPrompt: "Click to view bio",
      showAccentRule: true,
      companyAliases: [],
      useBrandFont: true,
      showSessions: true,
      modalEyebrowText: "Speaker",
      eyebrowFromCategory: false,
      categoryLabels: [],
      sessionsHeaderText: "Sessions",
      colors: {
        ink: "#141416",
        muted: "#5C5C5A",
        faint: "#6F6F6D",
        hair: "#E4E4E0",
        placeholder: "#EDEDEA",
        accent: "#9C5F00",
        tagBg: "#F0F0EE",
        tagInk: "#3F3F3D",
        modalBar: "#F7A325",
        accentRule: "#F7A325",
        mainAccent: "#F7A325",
        bioInk: "#3F3F3D",
        focus: "#2B6CE8",
      },
      typography: this._makeDefaultTypography(),
    };
  }

  _makeDefaultTypography() {
    const base = { italic: false, underline: false };
    return {
      eyebrow:              { ...base, fontSize: 11,   fontSizeMd: 11,   fontSizeSm: 11,   color: "#5C5C5A", bold: true },
      header:               { ...base, fontSize: 28,   fontSizeMd: 24,   fontSizeSm: 20,   color: "#141416", bold: true },
      intro:                { ...base, fontSize: 15,   fontSizeMd: 14,   fontSizeSm: 13,   color: "#5C5C5A", bold: false },
      more:                 { ...base, fontSize: 15,   fontSizeMd: 15,   fontSizeSm: 14,   color: "#9C5F00" },
      note:                 { ...base, fontSize: 13,   fontSizeMd: 13,   fontSizeSm: 13,   color: "#6F6F6D", bold: false, italic: true },
      speakerName:          { ...base, fontSize: 15.5, fontSizeMd: 15.5, fontSizeSm: 15,   color: "#141416", bold: true },
      speakerRole:          { ...base, fontSize: 13,   fontSizeMd: 13,   fontSizeSm: 13,   color: "#5C5C5A", bold: false },
      speakerTag:           { ...base, fontSize: 10.5, fontSizeMd: 10.5, fontSizeSm: 10.5, color: "#3F3F3D", bold: true },
      modalEyebrow:         { ...base, fontSize: 11,   fontSizeMd: 11,   fontSizeSm: 11,   color: "#9C5F00", bold: true },
      modalName:            { ...base, fontSize: 29,   fontSizeMd: 27,   fontSizeSm: 24,   color: "#141416", bold: true },
      modalRole:            { ...base, fontSize: 15,   fontSizeMd: 15,   fontSizeSm: 14,   color: "#5C5C5A", bold: false },
      modalTag:             { ...base, fontSize: 10.5, fontSizeMd: 10.5, fontSizeSm: 10.5, color: "#3F3F3D", bold: true },
      modalBio:             { ...base, fontSize: 14.5, fontSizeMd: 14.5, fontSizeSm: 14,   color: "#3F3F3D", bold: false },
      modalSessionsHeader:  { ...base, fontSize: 11,   fontSizeMd: 11,   fontSizeSm: 11,   color: "#5C5C5A", bold: true },
      modalSessionName:     { ...base, fontSize: 14.5, fontSizeMd: 14.5, fontSizeSm: 14,   color: "#141416", bold: true },
      modalSessionDateTime: { ...base, fontSize: 13,   fontSizeMd: 13,   fontSizeSm: 13,   color: "#5C5C5A", bold: false },
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
    detailsState.forEach((wasOpen, i) => { if (newDetails[i]) newDetails[i].open = wasOpen; });
    this.scrollTop = scrollTop;
  }

  _renderUI() {
    this.shadowRoot.innerHTML = "";

    const style = document.createElement("style");
    style.textContent = `
      :host { display: block; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
      .panel { padding: 14px; }
      .section { margin: 10px 0 14px; }
      .field { margin: 8px 0; }
      .row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
      .hint { font-size: 11px; color: #777; margin-top: 3px; }
      fieldset { border: 1px solid #ddd; border-radius: 8px; padding: 10px; margin: 10px 0; }
      legend { padding: 0 6px; font-weight: 600; }
      label { font-size: 12px; opacity: .85; }
      input[type="text"], textarea {
        width: 100%; box-sizing: border-box; padding: 6px 8px;
        border: 1px solid #ccc; border-radius: 6px; font: inherit; font-size: 13px;
      }
      textarea { min-height: 64px; resize: vertical; }
      input[type="number"] {
        width: 90px; min-width: 90px;
        pointer-events: auto; user-select: text; -webkit-user-select: text; cursor: text;
      }
      input[type="color"] { width: 48px; height: 28px; padding: 0; border: none; background: transparent; }
      h3 { margin: 14px 0 6px; font-size: 13px; }
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
      .speaker-roster {
        display: flex; flex-direction: column; gap: 6px;
        max-height: 320px; overflow-y: auto;
        border: 1px solid #e7e7e7; border-radius: 8px;
        padding: 8px; background: #fafafa;
      }
      .speaker-row {
        display: flex; align-items: center; gap: 10px;
        padding: 7px 10px; border-radius: 6px;
        border: 1px solid transparent; cursor: pointer;
        background: #fff; transition: background 0.12s, border-color 0.12s;
      }
      .speaker-row:hover { border-color: #ccc; }
      .speaker-row.selected { border-color: #185FA5; background: #e6f1fb; }
      .sp-avatar { width: 32px; height: 32px; border-radius: 2px; object-fit: cover; flex-shrink: 0; background: #e0e0e0; }
      .sp-info { flex: 1; min-width: 0; }
      .sp-name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .sp-meta { font-size: 11px; color: #666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .selected-order {
        font-size: 11px; font-weight: 700; color: #fff; background: #185FA5;
        border-radius: 50%; width: 20px; height: 20px;
        display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      }
      .roster-empty { padding: 16px; text-align: center; font-size: 13px; color: #888; }
      .selected-summary { font-size: 12px; color: #555; margin: 6px 0 10px; }
      .clear-btn {
        font-size: 11px; color: #c00; cursor: pointer;
        text-decoration: underline; background: none; border: none; padding: 0; margin-left: 8px;
      }
      .search-input { margin-bottom: 8px; }
      .list-head { display: flex; align-items: center; justify-content: space-between; font-size: 12px; font-weight: 600; margin: 12px 0 4px; }
      .list-head:first-of-type { margin-top: 4px; }
      .selected-list { margin-bottom: 4px; }
      .speaker-row[draggable="true"] { cursor: grab; }
      .speaker-row.dragging { opacity: .4; }
      .speaker-row.drop-before { box-shadow: 0 -2px 0 0 #185FA5; }
      .speaker-row.drop-after { box-shadow: 0 2px 0 0 #185FA5; }
      .grip { color: #9a9a9a; font-size: 16px; line-height: 1; width: 10px; flex-shrink: 0; user-select: none; }
      .add-mark { width: 20px; height: 20px; border-radius: 50%; border: 1px solid #ccc; color: #666; font-size: 14px; line-height: 18px; text-align: center; flex-shrink: 0; }
      .speaker-row:hover .add-mark { border-color: #185FA5; color: #185FA5; }
      .remove-btn { appearance: none; border: 0; background: transparent; color: #999; font-size: 18px; line-height: 1; cursor: pointer; padding: 2px 4px; border-radius: 4px; flex-shrink: 0; }
      .remove-btn:hover { color: #c00; background: #fbe9e9; }
      .alias-table { display: flex; flex-direction: column; gap: 6px; }
      .alias-row { display: grid; grid-template-columns: 1fr 1fr 28px; gap: 6px; align-items: center; }
      .alias-head { font-size: 11px; color: #666; font-weight: 600; }
      .alias-row input[type="text"] { width: 100%; }
      .small-btn { margin-top: 8px; font: inherit; font-size: 12px; padding: 5px 10px; border: 1px solid #ccc; border-radius: 6px; background: #fff; cursor: pointer; }
      .small-btn:hover { border-color: #185FA5; color: #185FA5; }
      .chip { font: inherit; font-size: 11px; margin: 4px 4px 0 0; padding: 3px 8px; border: 1px solid #ddd; border-radius: 12px; background: #fff; cursor: pointer; color: #333; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .chip:hover { border-color: #185FA5; color: #185FA5; }
    `;
    this.shadowRoot.append(style);

    const panel = document.createElement("div");
    panel.className = "panel";
    this.shadowRoot.append(panel);

    // =============================================
    // SECTION 1: SECTION TEXT
    // =============================================
    const textDetails = this._details("Section Text");
    const textBlock = this._block(textDetails);

    this._appendTextInput(textBlock, "Eyebrow (small uppercase label; leave blank to hide)", "eyebrowText", "e.g. Meet the experts");
    this._appendTextInput(textBlock, "Heading", "headerText", "Featured Speakers");
    this._appendTextArea(textBlock, "Intro paragraph", "introText", "Select a speaker to read their bio.");
    this._appendTextInput(textBlock, "“More coming” line (accent colour; leave blank to hide)", "moreText", "More speakers being announced shortly");
    this._appendTextArea(textBlock, "Disclosure note (italic, below the grid; leave blank to hide)", "noteText", "");
    textBlock.append(
      this._checkbox("Show accent rule under the heading (as on the agenda widget)", this._config.showAccentRule !== false, (v) => this._patch({ showAccentRule: v }))
    );
    panel.append(textDetails);

    // =============================================
    // SECTION 2: LAYOUT
    // =============================================
    const layoutDetails = this._details("Layout & Tiles");
    const layoutBlock = this._block(layoutDetails);

    layoutBlock.append(
      this._numberRow("Tile size (px, square photo)", this._config.tileSize ?? 200, 120, 400, (v) => this._patch({ tileSize: v })),
      this._numberRow("Row gap (px)", this._config.gridGapRow ?? 36, 0, 120, (v) => this._patch({ gridGapRow: v })),
      this._numberRow("Column gap (px)", this._config.gridGapCol ?? 24, 0, 120, (v) => this._patch({ gridGapCol: v }))
    );

    const alignFs = document.createElement("fieldset");
    const alignLg = document.createElement("legend");
    alignLg.textContent = "Grid alignment";
    alignFs.append(alignLg);
    [["Centred", "center"], ["Left", "left"]].forEach(([label, value]) => {
      const wrap = document.createElement("label");
      wrap.style.cssText = "display:flex;align-items:center;gap:6px;margin:4px 0;";
      const rb = document.createElement("input");
      rb.type = "radio";
      rb.name = "gridAlign";
      rb.checked = (this._config.gridAlign || "center") === value;
      rb.onchange = () => { if (rb.checked) this._patch({ gridAlign: value }); };
      wrap.append(rb, document.createTextNode(label));
      alignFs.append(wrap);
    });
    layoutBlock.append(alignFs);

    this._appendTextInput(layoutBlock, "Photo hover prompt (leave blank to disable)", "hoverPrompt", "Click to view bio");


    layoutBlock.append(
      this._checkbox("Use Bloomberg brand font (AvenirNextforBBG)", this._config.useBrandFont !== false, (v) => this._patch({ useBrandFont: v }))
    );
    const fontHint = document.createElement("div");
    fontHint.className = "hint";
    fontHint.textContent = "Off = inherit the page font from the Cvent theme.";
    layoutBlock.append(fontHint);
    panel.append(layoutDetails);

    // =============================================
    // SECTION 3: COLOURS
    // =============================================
    const colorDetails = this._details("Colours", false);
    const colorBlock = this._block(colorDetails);
    const colors = this._config.colors || {};
    const cRow = (label, key) =>
      this._colorRow(label, `c-${key}`, colors[key] || "#000000", (v) => this._patch({ colors: { ...this._config.colors, [key]: v } }));

    colorBlock.append(
      cRow("Main accent (heading underline, speaker hover)", "mainAccent"),
      cRow("Accent (“more coming” line, modal eyebrow)", "accent"),
      cRow("Modal top bar", "modalBar"),
      cRow("Primary text", "ink"),
      cRow("Secondary text (eyebrow, intro, roles)", "muted"),
      cRow("Faint text (note, placeholder initials)", "faint"),
      cRow("Bio text", "bioInk"),
      cRow("Company tag background", "tagBg"),
      cRow("Company tag text", "tagInk"),
      cRow("Hairline / dividers", "hair"),
      cRow("Photo placeholder", "placeholder"),
      cRow("Keyboard focus ring", "focus")
    );
    panel.append(colorDetails);

    // =============================================
    // SECTION 4: FEATURED SPEAKER SELECTOR
    // Two lists: "Selected speakers" (drag to reorder, click × to remove) and
    // "Available speakers" (click to add; hides anyone already selected).
    // =============================================
    const selectorDetails = this._details("Featured Speaker Selection");
    const selectorBlock = this._block(selectorDetails);

    const selectedIds = Array.isArray(this._config.featuredSpeakerIds) ? this._config.featuredSpeakerIds.map(String) : [];
    const byId = new Map(this._allSpeakers.map((sp) => [String(sp?.id || sp?.speakerId || ""), sp]));
    const spName = (sp) => `${(sp?.firstName || "").trim()} ${(sp?.lastName || "").trim()}`.trim();
    const spMeta = (sp) => [(sp?.title || sp?.designation || "").trim(), (sp?.company || sp?.organization || "").trim()].filter(Boolean).join(" · ");
    const setIds = (ids) => this._patch({ featuredSpeakerIds: ids });

    const makeAvatar = (sp) => {
      const avatar = document.createElement("img");
      avatar.className = "sp-avatar";
      avatar.src = (sp?.profilePictureUri || "").trim() ||
        "https://custom.cvent.com/437e6683a93144aaaee124507fc78642/pix/2ee8c4642e97488abc1852d9166b179b.png";
      avatar.alt = "";
      avatar.draggable = false;
      return avatar;
    };
    const makeInfo = (sp) => {
      const info = document.createElement("div");
      info.className = "sp-info";
      const nameDiv = document.createElement("div");
      nameDiv.className = "sp-name";
      nameDiv.textContent = spName(sp) || "(Unknown speaker)";
      const metaDiv = document.createElement("div");
      metaDiv.className = "sp-meta";
      metaDiv.textContent = spMeta(sp);
      info.append(nameDiv, metaDiv);
      return info;
    };

    // ---- Selected speakers (ordered, drag-and-drop) ----
    const selHead = document.createElement("div");
    selHead.className = "list-head";
    const selTitle = document.createElement("span");
    selTitle.textContent = `Selected speakers (${selectedIds.length})`;
    selHead.append(selTitle);
    if (selectedIds.length) {
      const clearBtn = document.createElement("button");
      clearBtn.type = "button";
      clearBtn.className = "clear-btn";
      clearBtn.textContent = "Clear all";
      clearBtn.onclick = () => setIds([]);
      selHead.append(clearBtn);
    }
    selectorBlock.append(selHead);

    const selHint = document.createElement("div");
    selHint.className = "hint";
    selHint.textContent = selectedIds.length
      ? "Shown on the page in this order. Drag to reorder (or use ↑ ↓ keys), × to remove."
      : "None selected — every event speaker will be shown. Click a speaker below to feature them.";
    selectorBlock.append(selHint);

    const selList = document.createElement("div");
    selList.className = "speaker-roster selected-list";
    selectorBlock.append(selList);

    let dragFrom = -1;
    const moveId = (from, to) => {
      if (from === to || from < 0 || to < 0 || from >= selectedIds.length || to >= selectedIds.length) return;
      const ids = [...selectedIds];
      const [m] = ids.splice(from, 1);
      ids.splice(to, 0, m);
      setIds(ids);
    };

    selectedIds.forEach((id, idx) => {
      const sp = byId.get(id) || { id, firstName: this._allSpeakers.length ? "(Speaker not in this event)" : "Loading…" };
      const row = document.createElement("div");
      row.className = "speaker-row selected";
      row.draggable = true;
      row.tabIndex = 0;
      row.dataset.idx = String(idx);
      row.setAttribute("role", "listitem");
      row.setAttribute("aria-label", `${idx + 1}. ${spName(sp)}`);

      const grip = document.createElement("span");
      grip.className = "grip";
      grip.textContent = "⠇";
      grip.setAttribute("aria-hidden", "true");

      const badge = document.createElement("div");
      badge.className = "selected-order";
      badge.textContent = idx + 1;

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove-btn";
      remove.textContent = "×";
      remove.setAttribute("aria-label", `Remove ${spName(sp)}`);
      remove.onclick = (e) => { e.stopPropagation(); setIds(selectedIds.filter((x) => x !== id)); };

      row.append(grip, badge, makeAvatar(sp), makeInfo(sp), remove);

      row.addEventListener("dragstart", (e) => {
        dragFrom = idx;
        row.classList.add("dragging");
        try { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", id); } catch (err) { /* noop */ }
      });
      row.addEventListener("dragend", () => { row.classList.remove("dragging"); selList.querySelectorAll(".drop-before,.drop-after").forEach((r) => r.classList.remove("drop-before", "drop-after")); });
      row.addEventListener("dragover", (e) => {
        if (dragFrom < 0) return;
        e.preventDefault();
        try { e.dataTransfer.dropEffect = "move"; } catch (err) { /* noop */ }
        const r = row.getBoundingClientRect();
        const after = e.clientY > r.top + r.height / 2;
        selList.querySelectorAll(".drop-before,.drop-after").forEach((x) => x.classList.remove("drop-before", "drop-after"));
        row.classList.add(after ? "drop-after" : "drop-before");
      });
      row.addEventListener("drop", (e) => {
        if (dragFrom < 0) return;
        e.preventDefault();
        const r = row.getBoundingClientRect();
        const after = e.clientY > r.top + r.height / 2;
        let to = idx + (after ? 1 : 0);
        if (dragFrom < to) to -= 1;
        const from = dragFrom;
        dragFrom = -1;
        moveId(from, to);
      });
      row.addEventListener("keydown", (e) => {
        if (e.key === "ArrowUp") { e.preventDefault(); moveId(idx, idx - 1); this._focusSelectedRow = idx - 1; }
        else if (e.key === "ArrowDown") { e.preventDefault(); moveId(idx, idx + 1); this._focusSelectedRow = idx + 1; }
        else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); setIds(selectedIds.filter((x) => x !== id)); }
      });

      selList.append(row);
    });

    if (!selectedIds.length) {
      const empty = document.createElement("div");
      empty.className = "roster-empty";
      empty.textContent = "No speakers selected yet.";
      selList.append(empty);
    }

    // Restore keyboard focus after a re-render caused by arrow-key reordering
    if (this._focusSelectedRow !== undefined) {
      const target = selList.querySelector(`.speaker-row[data-idx="${this._focusSelectedRow}"]`);
      this._focusSelectedRow = undefined;
      if (target) setTimeout(() => target.focus(), 0);
    }

    // ---- Available speakers (click to add) ----
    const availHead = document.createElement("div");
    availHead.className = "list-head";
    const availTitle = document.createElement("span");
    availHead.append(availTitle);
    selectorBlock.append(availHead);

    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.className = "search-input";
    searchInput.placeholder = "Search by name, title, or company…";
    searchInput.value = this._rosterFilter || "";
    selectorBlock.append(searchInput);

    const roster = document.createElement("div");
    roster.className = "speaker-roster";
    roster.setAttribute("role", "list");
    selectorBlock.append(roster);

    const renderRoster = (filter = "") => {
      roster.innerHTML = "";
      const available = this._allSpeakers.filter((sp) => !selectedIds.includes(String(sp?.id || sp?.speakerId || "")));
      availTitle.textContent = `Available speakers (${available.length})`;

      if (!this._allSpeakers.length) {
        const empty = document.createElement("div");
        empty.className = "roster-empty";
        empty.textContent = this._speakersLoading
          ? "Loading speakers…"
          : "No speakers found. Make sure speakers are assigned to sessions in this event.";
        roster.append(empty);
        return;
      }

      const lower = filter.trim().toLowerCase();
      const filtered = available.filter((sp) => !lower || `${spName(sp)} ${spMeta(sp)}`.toLowerCase().includes(lower));

      if (!filtered.length) {
        const empty = document.createElement("div");
        empty.className = "roster-empty";
        empty.textContent = available.length ? "No speakers match your search." : "All event speakers are selected.";
        roster.append(empty);
        return;
      }

      filtered.forEach((sp) => {
        const id = String(sp?.id || sp?.speakerId || "");
        const row = document.createElement("div");
        row.className = "speaker-row";
        row.tabIndex = 0;
        row.setAttribute("role", "listitem");
        row.setAttribute("aria-label", `Add ${spName(sp)}`);
        const add = document.createElement("span");
        add.className = "add-mark";
        add.textContent = "+";
        add.setAttribute("aria-hidden", "true");
        row.append(add, makeAvatar(sp), makeInfo(sp));
        const doAdd = () => setIds([...selectedIds, id]);
        row.onclick = doAdd;
        row.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); doAdd(); } });
        roster.append(row);
      });
    };

    renderRoster(searchInput.value);
    searchInput.addEventListener("input", () => { this._rosterFilter = searchInput.value; renderRoster(searchInput.value); });

    panel.append(selectorDetails);

    // =============================================
    // SECTION 4b: COMPANY TAG LABELS
    // =============================================
    const aliasDetails = this._details("Company Tag Labels", false);
    const aliasBlock = this._block(aliasDetails);
    const aliasHint = document.createElement("div");
    aliasHint.className = "hint";
    aliasHint.style.marginBottom = "8px";
    aliasHint.textContent = "Show a short label on the tile instead of the company name from Cvent. \u201cCompany contains\u201d matches case-insensitively; an exact match wins. The modal still shows the full company.";
    aliasBlock.append(aliasHint);

    const aliases = Array.isArray(this._config.companyAliases) ? this._config.companyAliases : [];
    const setAliases = (list) => this._patch({ companyAliases: list });
    const aliasTable = document.createElement("div");
    aliasTable.className = "alias-table";
    const aliasHead = document.createElement("div");
    aliasHead.className = "alias-row alias-head";
    ["Company contains", "Show as", ""].forEach((t) => { const d = document.createElement("div"); d.textContent = t; aliasHead.append(d); });
    aliasTable.append(aliasHead);
    aliases.forEach((a, i) => {
      const row = document.createElement("div");
      row.className = "alias-row";
      const m = document.createElement("input");
      m.type = "text"; m.value = a?.match || ""; m.placeholder = "e.g. Bloomberg Intelligence";
      m.onchange = () => { const l = aliases.map((x) => ({ ...x })); l[i].match = m.value; setAliases(l); };
      const lbl = document.createElement("input");
      lbl.type = "text"; lbl.value = a?.label || ""; lbl.placeholder = "e.g. BI";
      lbl.onchange = () => { const l = aliases.map((x) => ({ ...x })); l[i].label = lbl.value; setAliases(l); };
      const del = document.createElement("button");
      del.type = "button"; del.className = "remove-btn"; del.textContent = "\u00d7"; del.setAttribute("aria-label", "Remove label");
      del.onclick = () => setAliases(aliases.filter((_, j) => j !== i));
      row.append(m, lbl, del);
      aliasTable.append(row);
    });
    aliasBlock.append(aliasTable);
    const addAlias = document.createElement("button");
    addAlias.type = "button"; addAlias.className = "small-btn"; addAlias.textContent = "+ Add label";
    addAlias.onclick = () => setAliases([...aliases, { match: "", label: "" }]);
    aliasBlock.append(addAlias);

    // Quick-add from companies seen in this event
    const seen = [...new Set(this._allSpeakers.map((sp) => (sp?.company || sp?.organization || "").trim()).filter(Boolean))]
      .filter((cName) => !aliases.some((a) => { const m = (a?.match || "").trim().toLowerCase(); return m && cName.toLowerCase().includes(m); }))
      .sort((a, b) => b.length - a.length);
    if (seen.length) {
      const seenWrap = document.createElement("div");
      seenWrap.className = "hint";
      seenWrap.style.marginTop = "10px";
      seenWrap.textContent = "Companies in this event without a label (click to add): ";
      seen.slice(0, 12).forEach((cName) => {
        const chip = document.createElement("button");
        chip.type = "button"; chip.className = "chip"; chip.textContent = cName;
        chip.onclick = () => setAliases([...aliases, { match: cName, label: "" }]);
        seenWrap.append(chip);
      });
      aliasBlock.append(seenWrap);
    }
    panel.append(aliasDetails);

    // =============================================
    // SECTION 5: MODAL
    // =============================================
    const modalDetails = this._details("Speaker Modal", false);
    const modalBlock = this._block(modalDetails);

    this._appendTextInput(modalBlock, "Modal eyebrow (leave blank to hide)", "modalEyebrowText", "Speaker");

    modalBlock.append(
      this._checkbox("Eyebrow follows the speaker\u2019s Cvent speaker category", !!this._config.eyebrowFromCategory, (v) => this._patch({ eyebrowFromCategory: v }))
    );
    const catHint = document.createElement("div");
    catHint.className = "hint";
    catHint.textContent = "Uses the category set on the speaker in Cvent (e.g. \u201cModerators\u201d \u2192 \u201cModerator\u201d). Speakers without a category show the fixed eyebrow above.";
    modalBlock.append(catHint);

    if (this._config.eyebrowFromCategory) {
      const catLabels = Array.isArray(this._config.categoryLabels) ? this._config.categoryLabels : [];
      const setCat = (list) => this._patch({ categoryLabels: list });
      const catTable = document.createElement("div");
      catTable.className = "alias-table";
      catTable.style.marginTop = "10px";
      const catHead = document.createElement("div");
      catHead.className = "alias-row alias-head";
      ["Category contains", "Show as", ""].forEach((t) => { const d = document.createElement("div"); d.textContent = t; catHead.append(d); });
      catTable.append(catHead);
      catLabels.forEach((a, i) => {
        const row = document.createElement("div");
        row.className = "alias-row";
        const m = document.createElement("input");
        m.type = "text"; m.value = a?.match || ""; m.placeholder = "e.g. Panel Chairs";
        m.onchange = () => { const l = catLabels.map((x) => ({ ...x })); l[i].match = m.value; setCat(l); };
        const lbl = document.createElement("input");
        lbl.type = "text"; lbl.value = a?.label || ""; lbl.placeholder = "e.g. Chair";
        lbl.onchange = () => { const l = catLabels.map((x) => ({ ...x })); l[i].label = lbl.value; setCat(l); };
        const del = document.createElement("button");
        del.type = "button"; del.className = "remove-btn"; del.textContent = "\u00d7"; del.setAttribute("aria-label", "Remove label");
        del.onclick = () => setCat(catLabels.filter((_, j) => j !== i));
        row.append(m, lbl, del);
        catTable.append(row);
      });
      modalBlock.append(catTable);
      const addCat = document.createElement("button");
      addCat.type = "button"; addCat.className = "small-btn"; addCat.textContent = "+ Add category label";
      addCat.onclick = () => setCat([...catLabels, { match: "", label: "" }]);
      modalBlock.append(addCat);

      const seenCats = [...new Set(this._allSpeakers.map((sp) => (sp?.category?.name || "").trim()).filter(Boolean))]
        .filter((n) => !catLabels.some((a) => (a?.match || "").trim().toLowerCase() === n.toLowerCase()));
      if (seenCats.length) {
        const seenWrap = document.createElement("div");
        seenWrap.className = "hint";
        seenWrap.style.marginTop = "10px";
        seenWrap.textContent = "Categories in this event (click to add an override): ";
        seenCats.forEach((n) => {
          const chip = document.createElement("button");
          chip.type = "button"; chip.className = "chip"; chip.textContent = n;
          chip.onclick = () => setCat([...catLabels, { match: n, label: "" }]);
          seenWrap.append(chip);
        });
        modalBlock.append(seenWrap);
      }
    }

    modalBlock.append(
      this._checkbox("Show sessions this speaker appears in", !!this._config.showSessions, (v) => this._patch({ showSessions: v }))
    );
    this._appendTextInput(modalBlock, "Sessions header", "sessionsHeaderText", "Sessions");
    panel.append(modalDetails);

    // =============================================
    // SECTION 6/7: TYPOGRAPHY
    // =============================================
    const typoSectionDetails = this._details("Typography (Section & Tiles)", false);
    const typoSectionBlock = this._block(typoSectionDetails);
    const typoSection = document.createElement("div");
    typoSection.className = "grid";
    typoSectionBlock.append(typoSection);
    [
      ["eyebrow",      "Eyebrow"],
      ["header",       "Heading"],
      ["intro",        "Intro paragraph"],
      ["more",         "“More coming” line"],
      ["note",         "Disclosure note"],
      ["speakerName",  "Speaker name"],
      ["speakerRole",  "Speaker role / title"],
      ["speakerTag",   "Company tag"],
    ].forEach(([key, label]) => typoSection.append(this._typographyBlock(key, label)));
    panel.append(typoSectionDetails);

    const typoModalDetails = this._details("Typography (Modal)", false);
    const typoModalBlock = this._block(typoModalDetails);
    const typoModal = document.createElement("div");
    typoModal.className = "grid";
    typoModalBlock.append(typoModal);
    [
      ["modalEyebrow",         "Modal eyebrow"],
      ["modalName",            "Modal speaker name"],
      ["modalRole",            "Modal speaker role / title"],
      ["modalTag",             "Modal company tag"],
      ["modalBio",             "Modal bio"],
      ["modalSessionsHeader",  "Sessions header"],
      ["modalSessionName",     "Session name"],
      ["modalSessionDateTime", "Session date & time"],
    ].forEach(([key, label]) => typoModal.append(this._typographyBlock(key, label)));
    panel.append(typoModalDetails);
  }

  // =============================================
  // UI HELPERS
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

  _block(details) {
    const b = document.createElement("div");
    b.className = "block";
    details.append(b);
    return b;
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
    input.value = this._config[configKey] !== undefined ? this._config[configKey] : "";
    input.placeholder = placeholder;
    input.onchange = () => this._patch({ [configKey]: input.value });
    wrap.append(input);
    parent.append(wrap);
  }

  _appendTextArea(parent, labelText, configKey, placeholder) {
    const wrap = document.createElement("div");
    wrap.className = "section";
    wrap.append(this._label(labelText), document.createElement("br"));
    const ta = document.createElement("textarea");
    ta.value = this._config[configKey] !== undefined ? this._config[configKey] : "";
    ta.placeholder = placeholder;
    ta.onchange = () => this._patch({ [configKey]: ta.value });
    wrap.append(ta);
    parent.append(wrap);
  }

  _numberRow(labelText, current, min, max, onChange) {
    const wrap = document.createElement("div");
    wrap.className = "row field";
    const i = document.createElement("input");
    i.type = "number";
    i.min = String(min);
    i.max = String(max);
    i.value = current;
    i.onchange = () => {
      const n = Number(i.value);
      if (Number.isFinite(n)) onChange(Math.max(min, Math.min(max, n)));
    };
    wrap.append(this._label(labelText), i);
    return wrap;
  }

  _checkbox(text, checked, onChange) {
    const wrap = document.createElement("label");
    wrap.style.cssText = "display:inline-flex;align-items:center;gap:6px;margin:6px 0;";
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
    const lbl = this._label(labelText);
    lbl.style.flex = "1 1 160px";
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

    const rowSizes = document.createElement("div");
    rowSizes.className = "row field";

    const mkSize = (lbl, prop) => {
      const wrap = document.createElement("div");
      const i = document.createElement("input");
      i.type = "number";
      i.min = "8";
      i.max = "72";
      i.step = "0.5";
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
      wrap.append(this._label(lbl), document.createElement("br"), i);
      return wrap;
    };

    rowSizes.append(
      mkSize("Font size (px)", "fontSize"),
      mkSize("≤1024px (px)", "fontSizeMd"),
      mkSize("≤600px (px)", "fontSizeSm")
    );
    fs.append(rowSizes);

    const rowColor = document.createElement("div");
    rowColor.className = "row field";

    const colorWrap = document.createElement("div");
    const colorInput = document.createElement("input");
    colorInput.type = "color";
    const initialHex = merged.color || "#000000";
    colorInput.value = initialHex;
    colorWrap.append(this._label("Color"), document.createElement("br"), colorInput);

    const hexWrap = document.createElement("div");
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
    hex.value = initialHex ? "#" + this._normalizeHex(initialHex) : "#000000";

    const apply = () => {
      const norm = this._normalizeHex(hex.value);
      if (this._isValidHex6(norm)) {
        const withHash = "#" + norm;
        hex.style.borderColor = "#ccc";
        hex.value = withHash;
        onValidHex(withHash);
      } else {
        hex.style.borderColor = "#d33";
      }
    };

    hex.addEventListener("change", apply);
    hex.addEventListener("input", () => {
      hex.style.borderColor = this._isValidHex6(this._normalizeHex(hex.value)) ? "#0a0" : "#d33";
    });

    return hex;
  }

  // =============================================
  // STATE PATCHING
  // =============================================

  _patch(patch) {
    const merged = { ...this._config, ...patch };
    if (patch.typography) merged.typography = { ...(this._config.typography || {}), ...patch.typography };
    if (patch.colors) merged.colors = { ...(this._config.colors || {}), ...patch.colors };
    if (patch.companyAliases) merged.companyAliases = [...patch.companyAliases];
    if (patch.categoryLabels) merged.categoryLabels = [...patch.categoryLabels];
    this._config = merged;
    this.setConfiguration(this._config);
    // Re-render our own panel so the UI reflects the patch even if the host
    // doesn't echo onConfigurationUpdate back to the editor.
    this._safeRenderUI();
  }
}
