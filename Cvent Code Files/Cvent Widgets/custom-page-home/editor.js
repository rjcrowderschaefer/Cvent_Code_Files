// editor.js — Home PAGE widget editor.
// One collapsible group per page section: an on/off toggle plus that
// section's copy and links. Speakers and sessions are picked from live event
// data (the same SDK calls the widget uses). Text fields commit on `change`
// (blur / Enter), never `input`: the panel re-renders on every patch and would
// otherwise steal focus mid-typing (Playbook §7).
import { HOME_DEFAULTS, mergeHomeConfig, deriveAbout, BUILD, SECTIONS } from "./widget.js";
import { extractUrl } from "./page-kit.js";

const SECTION_LABELS = {
  hero: "Hero",
  facts: "Facts strip",
  speakers: "Featured speakers",
  about: "About the event",
  themes: "Themes",
  program: "Program highlights",
  cta: "Request to attend panel",
  more: "More from Bloomberg",
};

export default class HomePageEditor extends HTMLElement {
  constructor({ setConfiguration, initialConfiguration } = {}) {
    super();
    this.setConfiguration = setConfiguration;
    this._config = mergeHomeConfig(initialConfiguration || {});
    if (!initialConfiguration) setConfiguration?.(this._config);
    this._open = new Set(["general"]);  // which groups are expanded (survives re-render)
    this._speakers = [];                // roster for the picker
    this._sessions = [];
    this._loading = false;
    this._filter = "";
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this._render();
    this._loadRoster();
  }

  onConfigurationUpdate(newConfig) {
    this._config = mergeHomeConfig(newConfig || {});
    this._render();
  }

  // ---- config plumbing -----------------------------------------------------
  _patch(patch) {
    this._config = mergeHomeConfig({ ...this._config, ...patch });
    this.setConfiguration?.(this._config);
    this._render();
  }
  _patchSection(section, partial) {
    this._patch({ [section]: { ...this._config[section], ...partial } });
  }
  _patchItem(section, index, partial) {
    const items = this._config[section].items.map((it, i) => (i === index ? { ...it, ...partial } : it));
    this._patchSection(section, { items });
  }

  // ---- roster (speakers + sessions) ----------------------------------------
  _sdk(name) {
    if (this.cventSdk?.[name]) return this.cventSdk[name].bind(this.cventSdk);
    if (typeof this[name] === "function") return this[name].bind(this);
    if (typeof window !== "undefined" && typeof window[name] === "function") return window[name];
    return undefined;
  }

  // First time the editor opens on an event: copy the Cvent event description
  // into the About fields (split into body / numbered list / list eyebrow), so
  // the fields show exactly what the page shows and planners edit real copy.
  // Runs once per widget (about.seeded); clearing the fields afterwards sticks.
  async _seedAbout() {
    const a = this._config.about || {};
    if (a.seeded || a.body || a.listItems || a.listEyebrow) return;
    try {
      const info = (await this._sdk("getEventInfo")?.()) || {};
      const d = deriveAbout(info.description);
      if (!d.body && !d.listItems) return;
      this._patchSection("about", { ...d, seeded: true });
    } catch (e) {
      console.warn("[home editor] getEventInfo error:", e);
    }
  }

  async _loadRoster() {
    if (this._loading) return;
    this._loading = true;
    this._seedAbout();
    try {
      const gen = await this._sdk("getSessionGenerator")?.("dateTimeAsc", 200);
      const sessions = [];
      if (gen) {
        for await (const page of gen) {
          const batch = Array.isArray(page) ? page : Array.isArray(page?.sessions) ? page.sessions : Array.isArray(page?.records) ? page.records : [];
          sessions.push(...batch);
          if (sessions.length >= 200) break;
        }
      } else {
        console.warn("[home editor] getSessionGenerator not available.");
      }
      this._sessions = sessions;
      const ids = [...new Set(sessions.flatMap((s) => (s.speakers || []).map((sp) => String(sp?.id || sp?.speakerId || ""))).filter(Boolean))];
      const getSpeakers = this._sdk("getSpeakers");
      if (ids.length && getSpeakers) {
        const map = (await getSpeakers(ids)) || {};
        this._speakers = Object.values(map)
          .filter((s) => s && !s.failureReason)
          .sort((a, b) => this._name(a).localeCompare(this._name(b)));
      }
    } catch (e) {
      console.warn("[home editor] roster error:", e);
    } finally {
      this._loading = false;
      this._render();
    }
  }
  _name(s) {
    return [s?.firstName, s?.lastName].filter(Boolean).join(" ");
  }

  // ---- control helpers -----------------------------------------------------
  _el(tag, props = {}, ...kids) {
    const n = document.createElement(tag);
    Object.entries(props).forEach(([k, v]) => {
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k.startsWith("on")) n[k] = v;
      else if (v !== undefined && v !== null) n.setAttribute(k, v);
    });
    kids.flat().forEach((k) => k && n.append(k));
    return n;
  }
  _field(label, control, hint) {
    return this._el("label", { class: "field" }, this._el("span", { class: "lbl", text: label }), control, hint ? this._el("span", { class: "hint", text: hint }) : null);
  }
  _text(label, value, onChange, { hint, placeholder } = {}) {
    const i = this._el("input", { type: "text", placeholder: placeholder || "" });
    i.value = value ?? "";
    // URL fields keep only the link, whatever was pasted (a <source> tag, a
    // whole code block, &amp; entities…).
    const isUrl = /URL/.test(label);
    i.onchange = () => onChange(isUrl ? extractUrl(i.value) : i.value);
    const field = this._field(label, i, hint);
    if (isUrl && value) {
      const clean = extractUrl(value);
      if (clean !== String(value).trim()) {
        const warn = this._el("span", { class: "hint warn", text: clean
          ? "This field contains code, not just a link. The widget uses the link inside it; click Clean up to keep only that."
          : "No link found in this field. Paste just the address, starting with https://" });
        field.append(warn);
        if (clean) field.append(this._el("button", { type: "button", class: "link", text: "Clean up", onclick: () => onChange(clean) }));
      } else if (!/^(https?:\/\/|\/|#|mailto:|tel:)/i.test(clean)) {
        field.append(this._el("span", { class: "hint warn", text: "This doesn’t look like a web address. It should start with https://" }));
      }
    }
    return field;
  }
  _area(label, value, onChange, { hint, rows = 4, placeholder } = {}) {
    const t = this._el("textarea", { rows: String(rows), placeholder: placeholder || "" });
    t.value = value ?? "";
    t.onchange = () => onChange(t.value);
    return this._field(label, t, hint);
  }
  _num(label, value, onChange, { min = 0, max = 100, step = 1, hint, allowBlank = false } = {}) {
    const i = this._el("input", { type: "number", min: String(min), max: String(max), step: String(step) });
    i.value = value ?? "";
    i.onchange = () => onChange(allowBlank && i.value.trim() === "" ? "" : Number(i.value));
    return this._field(label, i, hint);
  }
  _check(label, checked, onChange) {
    const c = this._el("input", { type: "checkbox" });
    c.checked = !!checked;
    c.onchange = () => onChange(c.checked);
    return this._el("label", { class: "check" }, c, this._el("span", { text: label }));
  }
  _select(label, value, options, onChange, hint) {
    const s = this._el("select");
    options.forEach(([v, l]) => { const o = this._el("option", { value: v, text: l }); if (v === value) o.selected = true; s.append(o); });
    s.onchange = () => onChange(s.value);
    return this._field(label, s, hint);
  }
  _group(key, title, show, onToggle, body) {
    const d = this._el("details", { class: "grp" });
    d.open = this._open.has(key);
    d.ontoggle = () => { d.open ? this._open.add(key) : this._open.delete(key); };
    const sum = this._el("summary", {}, this._el("span", { class: "grp-t", text: title }));
    if (onToggle) {
      const pill = this._el("span", { class: `pill ${show ? "on" : "off"}`, text: show ? "On" : "Off" });
      sum.append(pill);
    }
    d.append(sum);
    const inner = this._el("div", { class: "grp-b" });
    if (onToggle) inner.append(this._check("Show this section", show, onToggle));
    inner.append(...body);
    d.append(inner);
    return d;
  }

  // ---- image URL field with live thumbnail + load check -----------------------
  _imageField(label, value, onChange, hint) {
    const wrap = this._text(label, value, onChange, { hint, placeholder: "https://custom.cvent.com/…/image.jpg" });
    const url = String(value || "").trim();
    if (!url) return wrap;
    const box = this._el("div", { class: "thumb" });
    const status = this._el("span", { class: "hint", text: "Checking image…" });
    if (!/^(https?:\/\/|\/)/i.test(url)) {
      status.textContent = "This doesn’t look like a web address. It should start with https://";
      status.classList.add("warn");
      wrap.append(status);
      return wrap;
    }
    const img = this._el("img", { alt: "" });
    img.onload = () => {
      const small = img.naturalWidth && img.naturalWidth < 1600;
      status.textContent = `${img.naturalWidth} × ${img.naturalHeight}px${small ? " — low resolution for a full-width band; 2400px wide or more recommended." : ""}`;
      status.classList.toggle("warn", !!small);
    };
    img.onerror = () => {
      status.textContent = "This image didn’t load. Check the link is public and points to the image file itself.";
      status.classList.add("warn");
      box.remove();
    };
    img.src = url;
    box.append(img);
    wrap.append(box, status);
    return wrap;
  }

  // ---- speaker picker (ordered) --------------------------------------------
  _speakerPicker() {
    const ids = (this._config.speakers.featuredSpeakerIds || []).map(String);
    const set = (next) => this._patchSection("speakers", { featuredSpeakerIds: next });
    const wrap = this._el("div", { class: "picker" });
    wrap.append(this._el("span", { class: "lbl", text: `Featured speakers (${ids.length} selected, shown in this order)` }));

    const chosen = this._el("ol", { class: "chosen" });
    ids.forEach((id, i) => {
      const sp = this._speakers.find((s) => String(s.id) === id);
      const up = this._el("button", { type: "button", class: "mini", "aria-label": "Move up", text: "↑", onclick: () => { if (i) { const n = [...ids]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; set(n); } } });
      const dn = this._el("button", { type: "button", class: "mini", "aria-label": "Move down", text: "↓", onclick: () => { if (i < ids.length - 1) { const n = [...ids]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; set(n); } } });
      const rm = this._el("button", { type: "button", class: "mini", "aria-label": "Remove", text: "✕", onclick: () => set(ids.filter((x) => x !== id)) });
      chosen.append(this._el("li", {}, this._el("span", { class: "nm", text: sp ? this._name(sp) : `(not in this event) ${id.slice(0, 8)}…` }), up, dn, rm));
    });
    if (ids.length) wrap.append(chosen);

    if (this._loading && !this._speakers.length) {
      wrap.append(this._el("p", { class: "hint", text: "Loading speakers…" }));
      return wrap;
    }
    if (!this._speakers.length) {
      wrap.append(this._el("p", { class: "hint", text: "No speakers found. Speakers appear here once they are assigned to sessions." }));
      return wrap;
    }
    const q = this._el("input", { type: "search", placeholder: "Filter speakers" });
    q.value = this._filter;
    q.oninput = () => { this._filter = q.value; const next = buildList(); list.replaceWith(next); list = next; };
    wrap.append(q);
    const buildList = () => {
      const ul = this._el("ul", { class: "roster" });
      const f = this._filter.trim().toLowerCase();
      this._speakers
        .filter((s) => !f || `${this._name(s)} ${s.company || ""}`.toLowerCase().includes(f))
        .forEach((s) => {
          const id = String(s.id);
          const c = this._el("input", { type: "checkbox" });
          c.checked = ids.includes(id);
          c.onchange = () => set(c.checked ? [...ids, id] : ids.filter((x) => x !== id));
          ul.append(this._el("li", {}, this._el("label", { class: "check" }, c, this._el("span", { text: `${this._name(s)}${s.company ? ` · ${s.company}` : ""}` }))));
        });
      return ul;
    };
    let list = buildList();
    wrap.append(list);
    return wrap;
  }

  // ---- session picker ------------------------------------------------------
  _sessionPicker() {
    const ids = (this._config.program.sessionIds || []).map(String);
    const wrap = this._el("div", { class: "picker" });
    wrap.append(this._el("span", { class: "lbl", text: `Picked sessions (${ids.length})` }));
    if (!this._sessions.length) {
      wrap.append(this._el("p", { class: "hint", text: this._loading ? "Loading sessions…" : "No sessions found." }));
      return wrap;
    }
    const ul = this._el("ul", { class: "roster" });
    this._sessions.forEach((s) => {
      const id = String(s.id);
      const c = this._el("input", { type: "checkbox" });
      c.checked = ids.includes(id);
      c.onchange = () => this._patchSection("program", { sessionIds: c.checked ? [...ids, id] : ids.filter((x) => x !== id) });
      ul.append(this._el("li", {}, this._el("label", { class: "check" }, c, this._el("span", { text: `${s.name || "(untitled)"}${s.isFeatured ? " ★" : ""}` }))));
    });
    wrap.append(ul);
    return wrap;
  }

  // ---- panel ---------------------------------------------------------------
  _render() {
    const c = this._config;
    const S = (k) => (partial) => this._patchSection(k, partial);
    const root = this.shadowRoot;
    root.innerHTML = "";
    root.append(this._el("style", { text: EDITOR_CSS }));
    const panel = this._el("div", { class: "panel" });

    panel.append(this._group("general", "General", true, null, [
      this._select("Request to attend buttons", c.registerMode, [["native", "Use Cvent’s Register button (recommended)"], ["url", "Link to a URL"]], (v) => this._patch({ registerMode: v }),
        "Cvent’s button keeps registration type and path logic. The widget’s buttons click the site’s own Register button (normally the one in the header)."),
      ...(c.registerMode === "url" ? [] : [
        this._text("Cvent button label to match", c.nativeRegisterLabel, (v) => this._patch({ nativeRegisterLabel: v.trim() }), { placeholder: c.hero.primaryLabel || "Request to attend", hint: "The exact text on Cvent’s Register button. Blank = the hero button label." }),
        this._text("Or: CSS selector (advanced)", c.nativeRegisterSelector, (v) => this._patch({ nativeRegisterSelector: v.trim() }), { placeholder: ".my-register-button button", hint: "Use when the label is not unique, e.g. a CSS class you added to a native Register Button widget." }),
      ]),
      this._text(c.registerMode === "url" ? "Registration URL" : "Fallback registration URL", c.registerUrl, (v) => this._patch({ registerUrl: v.trim() }), { hint: c.registerMode === "url" ? "Every “Request to attend” button links here." : "Used only if Cvent’s button can’t be found on the page." }),
      this._check("Use the Bloomberg brand font", c.useBrandFont !== false, (v) => this._patch({ useBrandFont: v })),
      this._check("Full-width backgrounds (edge to edge)", c.fullBleed !== false, (v) => this._patch({ fullBleed: v })),
      this._el("p", { class: "hint", text: "Stretches each section’s background (hero video, grey and dark bands) to the window edges; text stays centred. If backgrounds are still cut off, also set the Cvent section and column holding this widget to full width with no side padding." }),
    ]));

    // ---- Page layout: section order + spacing ----
    const order = c.order;
    const moveTo = (i, j) => { const n = [...order]; const [x] = n.splice(i, 1); n.splice(j, 0, x); this._patch({ order: n }); };
    const orderList = this._el("ol", { class: "chosen order" });
    order.forEach((k, i) => {
      const on = c[k]?.show !== false;
      orderList.append(this._el("li", {},
        this._el("span", { class: `nm ${on ? "" : "off"}`, text: `${SECTION_LABELS[k] || k}${on ? "" : " (off)"}` }),
        this._el("button", { type: "button", class: "mini", "aria-label": `Move ${SECTION_LABELS[k]} up`, text: "↑", onclick: () => i && moveTo(i, i - 1) }),
        this._el("button", { type: "button", class: "mini", "aria-label": `Move ${SECTION_LABELS[k]} down`, text: "↓", onclick: () => i < order.length - 1 && moveTo(i, i + 1) }),
      ));
    });
    panel.append(this._group("layout", "Page layout", true, null, [
      this._el("span", { class: "lbl", text: "Section order (top to bottom)" }),
      orderList,
      this._el("button", { type: "button", class: "link", text: "Reset to the default order", onclick: () => this._patch({ order: [...HOME_DEFAULTS.order] }) }),
      this._num("Space between sections (%)", c.sectionSpacing, (v) => this._patch({ sectionSpacing: v }), { min: 20, max: 200, step: 10,
        hint: "100 = the standard spacing. Lower is tighter, higher is roomier. Turn sections on or off in their own groups below." }),
    ]));

    const h = c.hero;
    panel.append(this._group("hero", SECTION_LABELS.hero, h.show, (v) => S("hero")({ show: v }), [
      this._text("Background video URL (MP4)", h.videoUrl, (v) => S("hero")({ videoUrl: v.trim() }), { hint: "Use a permanent link (e.g. the Cvent file library). Vimeo links with timed tokens expire." }),
      this._text("Poster image URL", h.posterUrl, (v) => S("hero")({ posterUrl: v.trim() }), { hint: "Shown while the video loads and for visitors who turn off motion." }),
      this._num("Video focal point, desktop (% from left)", h.focalX, (v) => S("hero")({ focalX: v })),
      this._num("Video focal point, mobile (% from left)", h.focalXMobile, (v) => S("hero")({ focalXMobile: v }), { hint: "50 = centre. 65 = 15% right of centre." }),
      this._num("Darken video, desktop (%)", h.scrimDesktop, (v) => S("hero")({ scrimDesktop: v }), { max: 80 }),
      this._num("Darken video, mobile (%)", h.scrimMobile, (v) => S("hero")({ scrimMobile: v }), { max: 80 }),
      this._text("Event logo image URL", h.logoUrl, (v) => S("hero")({ logoUrl: v.trim() }), { hint: "Leave blank to set the event title as text instead." }),
      this._text("Logo alt text", h.logoAlt, (v) => S("hero")({ logoAlt: v })),
      ...(h.logoUrl ? [
        this._num("Logo width, desktop (px)", h.logoWidth, (v) => S("hero")({ logoWidth: v }), { min: 120, max: 1800, step: 10 }),
        this._num("Logo width, tablet (px)", h.logoWidthTablet, (v) => S("hero")({ logoWidthTablet: v }), { min: 120, max: 1400, step: 10 }),
        this._num("Logo width, mobile (% of screen)", h.logoWidthMobile, (v) => S("hero")({ logoWidthMobile: v }), { min: 30, max: 160, step: 5,
          hint: "Over 100% is fine when the PNG has empty transparent space around the lockup." }),
        this._num("Space under logo, desktop (px)", h.logoGap, (v) => S("hero")({ logoGap: v }), { min: -200, max: 240 }),
        this._num("Space under logo, tablet (px)", h.logoGapTablet, (v) => S("hero")({ logoGapTablet: v }), { min: -200, max: 240, allowBlank: true,
          hint: "Blank = same as desktop. Raise it if the lockup touches the date line at tablet size." }),
        this._num("Space under logo, mobile (px)", h.logoGapMobile, (v) => S("hero")({ logoGapMobile: v }), { min: -200, max: 240,
          hint: "Negative values pull the next line up, to cancel transparent space at the bottom of the PNG." }),
      ] : []),
      this._text("Title, bold part", h.titleStrong, (v) => S("hero")({ titleStrong: v }), { hint: "Blank = event title minus its last word." }),
      this._text("Title, light part", h.titleLight, (v) => S("hero")({ titleLight: v }), { hint: "Blank = last word of the event title." }),
      this._text("Eyebrow", h.eyebrow, (v) => S("hero")({ eyebrow: v }), { placeholder: "Bloomberg Live · New York" }),
      this._check("Show date, time and venue line", h.showFacts, (v) => S("hero")({ showFacts: v })),
      this._area("Intro line", h.lede, (v) => S("hero")({ lede: v }), { rows: 2 }),
      this._text("Primary button label", h.primaryLabel, (v) => S("hero")({ primaryLabel: v })),
      this._text("Secondary button label", h.secondaryLabel, (v) => S("hero")({ secondaryLabel: v })),
      this._text("Secondary button URL", h.secondaryUrl, (v) => S("hero")({ secondaryUrl: v.trim() }), { hint: "Usually the Agenda page." }),
      this._check("Show countdown", h.showCountdown, (v) => S("hero")({ showCountdown: v })),
    ]));

    const f = c.facts;
    panel.append(this._group("facts", SECTION_LABELS.facts, f.show, (v) => S("facts")({ show: v }), [
      this._check("Dock onto the bottom of the hero", f.docked !== false, (v) => S("facts")({ docked: v })),
      this._el("p", { class: "hint", text: "Docking works when this section sits directly under the hero. Values fill in from the event automatically. Type here only to override." }),
      ...[["date", "Date"], ["venue", "Venue"], ["program", "Program"], ["speakers", "Speakers"]].flatMap(([k, n]) => [
        this._el("p", { class: "sub", text: n }),
        this._text("Label", f[`${k}Label`], (v) => S("facts")({ [`${k}Label`]: v })),
        this._text("Value", f[`${k}Value`], (v) => S("facts")({ [`${k}Value`]: v })),
        this._text("Detail", f[`${k}Detail`], (v) => S("facts")({ [`${k}Detail`]: v })),
      ]),
    ]));

    const sp = c.speakers;
    panel.append(this._group("speakers", SECTION_LABELS.speakers, sp.show, (v) => S("speakers")({ show: v }), [
      this._text("Eyebrow", sp.eyebrow, (v) => S("speakers")({ eyebrow: v })),
      this._text("Heading", sp.heading, (v) => S("speakers")({ heading: v })),
      this._text("Link label", sp.linkLabel, (v) => S("speakers")({ linkLabel: v })),
      this._text("Link URL", sp.linkUrl, (v) => S("speakers")({ linkUrl: v.trim() }), { hint: "Usually the Speakers page." }),
      this._speakerPicker(),
      this._text("Bio pop-up eyebrow", sp.modalEyebrowText, (v) => S("speakers")({ modalEyebrowText: v })),
      this._check("List the speaker’s sessions in the bio pop-up", sp.showSessions, (v) => S("speakers")({ showSessions: v })),
    ]));

    const a = c.about;
    panel.append(this._group("about", SECTION_LABELS.about, a.show, (v) => S("about")({ show: v }), [
      this._text("Eyebrow", a.eyebrow, (v) => S("about")({ eyebrow: v })),
      this._text("Heading", a.heading, (v) => S("about")({ heading: v })),
      this._area("Body", a.body, (v) => S("about")({ body: v, seeded: true }), { rows: 9, hint: "Filled from the Cvent event description the first time; edit freely. Leave a blank line between paragraphs. The first paragraph is set larger." }),
      this._text("List eyebrow", a.listEyebrow, (v) => S("about")({ listEyebrow: v, seeded: true }), { placeholder: "The program will explore" }),
      this._area("Numbered list", a.listItems, (v) => S("about")({ listItems: v, seeded: true }), { rows: 4, hint: "One item per line, shown as a numbered list beside the body. Blank = one column." }),
      this._el("button", { type: "button", class: "link", text: "Refill from the Cvent event description",
        onclick: async () => {
          try {
            const info = (await this._sdk("getEventInfo")?.()) || {};
            this._patchSection("about", { ...deriveAbout(info.description), seeded: true });
          } catch (e) { console.warn("[home editor] getEventInfo error:", e); }
        } }),
    ]));

    const t = c.themes;
    panel.append(this._group("themes", SECTION_LABELS.themes, t.show, (v) => S("themes")({ show: v }), [
      this._el("p", { class: "hint", text: "Themes are not in Cvent’s event data, so they are written here. Until at least one theme has a title or text, the page shows a placeholder." }),
      this._text("Eyebrow", t.eyebrow, (v) => S("themes")({ eyebrow: v })),
      this._text("Heading", t.heading, (v) => S("themes")({ heading: v })),
      this._el("p", { class: "sub", text: "Background image (optional)" }),
      this._imageField("Image URL", t.bgImageUrl, (v) => S("themes")({ bgImageUrl: v.trim() }),
        "Cvent doesn’t let custom widgets open the asset library, so paste a link: upload the image in Cvent (site designer image library or the event’s Files), open it, and copy its address. Use at least 2400px wide, JPG or WebP."),
      ...(t.bgImageUrl ? [
        this._num("Focal point, % from left", t.bgFocalX, (v) => S("themes")({ bgFocalX: v })),
        this._num("Focal point, % from top", t.bgFocalY, (v) => S("themes")({ bgFocalY: v })),
        this._num("Darken image (%)", t.bgOverlay, (v) => S("themes")({ bgOverlay: v }), { max: 90, hint: "Keeps the heading and cards readable. 60–80 suits most photos." }),
      ] : []),
      ...t.items.flatMap((it, i) => [
        this._el("p", { class: "sub", text: `Theme ${i + 1}` }),
        this._text("Kicker", it.kicker, (v) => this._patchItem("themes", i, { kicker: v }), { placeholder: `0${i + 1} / Short label` }),
        this._text("Title", it.title, (v) => this._patchItem("themes", i, { title: v })),
        this._area("Text", it.body, (v) => this._patchItem("themes", i, { body: v }), { rows: 3 }),
      ]),
      this._el("p", { class: "hint", text: "A theme with no title and no text is hidden." }),
    ]));

    const p = c.program;
    panel.append(this._group("program", SECTION_LABELS.program, p.show, (v) => S("program")({ show: v }), [
      this._text("Eyebrow", p.eyebrow, (v) => S("program")({ eyebrow: v })),
      this._text("Heading", p.heading, (v) => S("program")({ heading: v })),
      this._text("Link label", p.linkLabel, (v) => S("program")({ linkLabel: v })),
      this._text("Link URL", p.linkUrl, (v) => S("program")({ linkUrl: v.trim() }), { hint: "Usually the Agenda page. Rows link here too." }),
      this._select("Which sessions", p.source, [["auto", "Sessions marked Featured in Cvent (★)"], ["picked", "The sessions I pick below"]], (v) => S("program")({ source: v }),
        "Featured = the session’s Featured setting in Cvent. With none marked, the first sessions that have speakers are shown."),
      this._num("Maximum rows", p.limit, (v) => S("program")({ limit: v }), { min: 1, max: 12 }),
      this._sessionPicker(),
    ]));

    const ct = c.cta;
    panel.append(this._group("cta", SECTION_LABELS.cta, ct.show, (v) => S("cta")({ show: v }), [
      this._text("Eyebrow", ct.eyebrow, (v) => S("cta")({ eyebrow: v })),
      this._text("Heading", ct.heading, (v) => S("cta")({ heading: v }), { hint: "Blank = “Join us on <event date>”." }),
      this._text("Text", ct.body, (v) => S("cta")({ body: v }), { hint: "Blank = date, time and venue." }),
      this._text("Button label", ct.buttonLabel, (v) => S("cta")({ buttonLabel: v })),
    ]));

    const m = c.more;
    panel.append(this._group("more", SECTION_LABELS.more, m.show, (v) => S("more")({ show: v }), [
      this._select("Layout", m.layout, [["cards", "Cards: image on top (recommended)"], ["tiles", "Tiles: text over the image"], ["list", "List: text only, compact"]], (v) => S("more")({ layout: v }),
        "Cards and tiles use each link’s image; without one, cards show text only and tiles a dark panel."),
      this._text("Eyebrow", m.eyebrow, (v) => S("more")({ eyebrow: v })),
      this._text("Heading", m.heading, (v) => S("more")({ heading: v }), { placeholder: "Discover more from Bloomberg" }),
      this._area("Intro line", m.intro, (v) => S("more")({ intro: v }), { rows: 2 }),
      this._el("p", { class: "sub", text: "Background image (optional)" }),
      this._imageField("Background image URL", m.bgImageUrl, (v) => S("more")({ bgImageUrl: v.trim() }),
        "Turns the section dark with the photo behind it. Paste a link to an image uploaded in Cvent, at least 2400px wide."),
      ...(m.bgImageUrl ? [
        this._num("Focal point, % from left", m.bgFocalX, (v) => S("more")({ bgFocalX: v })),
        this._num("Focal point, % from top", m.bgFocalY, (v) => S("more")({ bgFocalY: v })),
        this._num("Darken image (%)", m.bgOverlay, (v) => S("more")({ bgOverlay: v }), { max: 90 }),
      ] : []),
      ...m.items.flatMap((it, i) => [
        this._el("p", { class: "sub", text: `Link ${i + 1}` }),
        this._text("Title", it.title, (v) => this._patchItem("more", i, { title: v })),
        this._text("Text", it.body, (v) => this._patchItem("more", i, { body: v })),
        this._text("Link label", it.linkLabel, (v) => this._patchItem("more", i, { linkLabel: v })),
        this._text("Link URL", it.url, (v) => this._patchItem("more", i, { url: v.trim() })),
        ...(m.layout === "list" ? [] : [this._imageField("Image URL", it.imageUrl, (v) => this._patchItem("more", i, { imageUrl: v.trim() }), "Shown on cards and tiles. Landscape, about 1200 × 675px.")]),
      ]),
    ]));

    panel.append(this._el("p", { class: "hint build", text: `Home page widget · build ${BUILD}` }));
    root.append(panel);
  }
}

const EDITOR_CSS = `
  :host { display: block; font: 13px/1.4 system-ui, -apple-system, sans-serif; color: #1a1a1a; }
  .panel { padding: 10px; display: flex; flex-direction: column; gap: 8px; }
  .grp { border: 1px solid #ddd; border-radius: 6px; background: #fff; }
  .grp summary { cursor: pointer; padding: 10px 12px; display: flex; justify-content: space-between; align-items: center; font-weight: 600; list-style: none; }
  .grp summary::-webkit-details-marker { display: none; }
  .grp summary::after { content: "▾"; color: #888; margin-left: 8px; }
  .grp[open] summary::after { content: "▴"; }
  .grp-t { flex: 1; }
  .pill { font-size: 11px; font-weight: 700; padding: 1px 8px; border-radius: 10px; }
  .pill.on { background: #e6f4ea; color: #1e6b34; }
  .pill.off { background: #f1f1f1; color: #777; }
  .grp-b { padding: 4px 12px 14px; display: flex; flex-direction: column; gap: 10px; border-top: 1px solid #eee; }
  .field { display: flex; flex-direction: column; gap: 4px; }
  .lbl { font-size: 12px; font-weight: 600; }
  .hint { font-size: 11px; color: #6a6a6a; margin: 0; }
  .sub { margin: 8px 0 0; font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #555; }
  input[type=text], input[type=number], input[type=search], textarea, select { font: inherit; padding: 6px 8px; border: 1px solid #c8c8c8; border-radius: 4px; width: 100%; box-sizing: border-box; }
  textarea { resize: vertical; }
  .link { align-self: flex-start; font: inherit; font-size: 12px; font-weight: 600; color: #1b4eae; background: none; border: 0; padding: 0; cursor: pointer; text-decoration: underline; }
  .thumb { border: 1px solid #ddd; border-radius: 4px; overflow: hidden; background: #f4f4f4; aspect-ratio: 16 / 7; }
  .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .hint.warn { color: #a3300b; }
  .order .nm.off { color: #999; }
  .check { display: flex; align-items: center; gap: 8px; cursor: pointer; }
  .picker { display: flex; flex-direction: column; gap: 6px; }
  .chosen { margin: 0; padding: 0 0 0 18px; display: flex; flex-direction: column; gap: 4px; }
  .chosen li { display: flex; align-items: center; gap: 4px; }
  .chosen .nm { flex: 1; }
  .mini { font: inherit; font-size: 12px; width: 26px; height: 24px; border: 1px solid #ccc; border-radius: 4px; background: #fafafa; cursor: pointer; }
  .roster { list-style: none; margin: 0; padding: 6px; max-height: 220px; overflow: auto; border: 1px solid #e3e3e3; border-radius: 4px; display: flex; flex-direction: column; gap: 4px; }
`;
