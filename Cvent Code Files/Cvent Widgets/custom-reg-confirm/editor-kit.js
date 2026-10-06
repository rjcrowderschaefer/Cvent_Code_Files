// editor-kit.js — shared settings-panel building blocks for the Bloomberg Live
// INNER-PAGE widgets (Agenda, Speakers, Venue, Contact).
//
// CANONICAL COPY: "Widget Playbook & Boilerplate/editor-kit.js". Every inner
// page widget folder carries an IDENTICAL copy (same rule as page-kit.js).
//
// A page editor extends PageEditor and implements:
//   merge(cfg)        the widget's merge function (defaults + saved config)
//   get defaults()    the widget's defaults (for "reset order")
//   get labels()      { sectionKey: "Label" } for the Page layout list
//   get title()       "Agenda page widget" (editor footer)
//   get build()       the widget's BUILD stamp
//   needsRoster()     true to load sessions + speakers for pickers
//   groups(c)         array of <details> groups for the page's own sections
// Text fields commit on `change` (blur / Enter), never `input`: the panel
// re-renders on every patch and would otherwise steal focus (Playbook §7).
import { extractUrl, PAGE_KIT_BUILD } from "./page-kit.js";

// Shown in the editor footer next to the widget build, so a stale copy of this
// file in Cvent is visible (the banner image fields live here).
export const EDITOR_KIT_BUILD = "kit-2026-09-26f";

export class PageEditor extends HTMLElement {
  constructor({ setConfiguration, initialConfiguration } = {}) {
    super();
    this.setConfiguration = setConfiguration;
    this._config = this.merge(initialConfiguration || {});
    if (!initialConfiguration) setConfiguration?.(this._config);
    this._open = new Set(["general"]);
    this._speakers = [];
    this._sessions = [];
    this._eventInfo = null;
    this._loading = false;
    this._filters = {};
    this.attachShadow({ mode: "open" });
  }

  // ---- subclass hooks ------------------------------------------------------
  merge(cfg) { return cfg; }
  get defaults() { return {}; }
  get labels() { return {}; }
  get title() { return "Page widget"; }
  get build() { return ""; }
  needsRoster() { return false; }
  groups() { return []; }
  onRoster() {}

  connectedCallback() {
    this._render();
    this._loadRoster();
  }

  onConfigurationUpdate(newConfig) {
    this._config = this.merge(newConfig || {});
    this._render();
  }

  // ---- config plumbing -----------------------------------------------------
  _patch(patch) {
    this._config = this.merge({ ...this._config, ...patch });
    this.setConfiguration?.(this._config);
    this._render();
  }
  _patchSection(section, partial) {
    this._patch({ [section]: { ...this._config[section], ...partial } });
  }
  _patchItem(section, index, partial, key = "items") {
    const items = this._config[section][key].map((it, i) => (i === index ? { ...it, ...partial } : it));
    this._patchSection(section, { [key]: items });
  }

  // ---- data for pickers ----------------------------------------------------
  _sdk(name) {
    if (this.cventSdk?.[name]) return this.cventSdk[name].bind(this.cventSdk);
    if (typeof this[name] === "function") return this[name].bind(this);
    if (typeof window !== "undefined" && typeof window[name] === "function") return window[name];
    return undefined;
  }

  async _loadRoster() {
    if (this._loading) return;
    this._loading = true;
    try {
      try { this._eventInfo = (await this._sdk("getEventInfo")?.()) || {}; } catch (e) { this._eventInfo = {}; }
      if (this.needsRoster()) {
        const gen = await this._sdk("getSessionGenerator")?.("dateTimeAsc", 200);
        const sessions = [];
        if (gen) {
          for await (const page of gen) {
            const batch = Array.isArray(page) ? page : Array.isArray(page?.sessions) ? page.sessions : Array.isArray(page?.records) ? page.records : [];
            sessions.push(...batch);
            if (sessions.length >= 400) break;
          }
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
      }
      this.onRoster();
    } catch (e) {
      console.warn(`[${this.title}] roster error:`, e);
    } finally {
      this._loading = false;
      this._render();
    }
  }
  _name(s) {
    return [s?.firstName, s?.lastName].filter(Boolean).join(" ");
  }

  // ---- controls --------------------------------------------------------------
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
  _hint(text) { return this._el("p", { class: "hint", text }); }
  _sub(text) { return this._el("p", { class: "sub", text }); }
  _field(label, control, hint) {
    return this._el("label", { class: "field" }, this._el("span", { class: "lbl", text: label }), control, hint ? this._el("span", { class: "hint", text: hint }) : null);
  }
  _text(label, value, onChange, { hint, placeholder, url } = {}) {
    const i = this._el("input", { type: "text", placeholder: placeholder || "" });
    i.value = value ?? "";
    const isUrl = url ?? /URL/.test(label);
    i.onchange = () => onChange(isUrl ? extractUrl(i.value) : i.value);
    const field = this._field(label, i, hint);
    if (isUrl && value) {
      const clean = extractUrl(value);
      if (clean !== String(value).trim()) {
        field.append(this._el("span", { class: "hint warn", text: clean
          ? "This field contains code, not just a link. The widget uses the link inside it; click Clean up to keep only that."
          : "No link found in this field. Paste just the address, starting with https://" }));
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
  _button(text, onclick) {
    return this._el("button", { type: "button", class: "link", text, onclick });
  }
  _group(key, title, show, onToggle, body) {
    const d = this._el("details", { class: "grp" });
    d.open = this._open.has(key);
    d.ontoggle = () => { d.open ? this._open.add(key) : this._open.delete(key); };
    const sum = this._el("summary", {}, this._el("span", { class: "grp-t", text: title }));
    if (onToggle) sum.append(this._el("span", { class: `pill ${show ? "on" : "off"}`, text: show ? "On" : "Off" }));
    d.append(sum);
    const inner = this._el("div", { class: "grp-b" });
    if (onToggle) inner.append(this._check("Show this section", show, onToggle));
    inner.append(...body.filter(Boolean));
    d.append(inner);
    return d;
  }
  _sectionGroup(key, body) {
    const s = this._config[key];
    return this._group(key, this.labels[key] || key, s.show !== false, (v) => this._patchSection(key, { show: v }), body);
  }

  // Image URL with a live thumbnail and load check.
  _imageField(label, value, onChange, hint) {
    const wrap = this._text(label, value, onChange, { hint, placeholder: "https://custom.cvent.com/…/image.jpg", url: true });
    const url = String(value || "").trim();
    if (!url || !/^(https?:\/\/|\/)/i.test(url)) return wrap;
    const box = this._el("div", { class: "thumb" });
    const status = this._el("span", { class: "hint", text: "Checking image…" });
    const img = this._el("img", { alt: "" });
    img.onload = () => { status.textContent = `${img.naturalWidth} × ${img.naturalHeight}px`; };
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

  // Ordered multi-select of speakers from the live roster.
  _speakerPicker(label, ids, set, { hint } = {}) {
    ids = (ids || []).map(String);
    const key = label;
    const wrap = this._el("div", { class: "picker" });
    wrap.append(this._el("span", { class: "lbl", text: `${label} (${ids.length} selected, shown in this order)` }));
    if (hint) wrap.append(this._hint(hint));
    const chosen = this._el("ol", { class: "chosen" });
    ids.forEach((id, i) => {
      const sp = this._speakers.find((s) => String(s.id) === id);
      const move = (j) => { const n = [...ids]; [n[i], n[j]] = [n[j], n[i]]; set(n); };
      chosen.append(this._el("li", {},
        this._el("span", { class: "nm", text: sp ? this._name(sp) : `(not in this event) ${id.slice(0, 8)}…` }),
        this._el("button", { type: "button", class: "mini", "aria-label": "Move up", text: "↑", onclick: () => i && move(i - 1) }),
        this._el("button", { type: "button", class: "mini", "aria-label": "Move down", text: "↓", onclick: () => i < ids.length - 1 && move(i + 1) }),
        this._el("button", { type: "button", class: "mini", "aria-label": "Remove", text: "✕", onclick: () => set(ids.filter((x) => x !== id)) }),
      ));
    });
    if (ids.length) wrap.append(chosen);
    if (this._loading && !this._speakers.length) { wrap.append(this._hint("Loading speakers…")); return wrap; }
    if (!this._speakers.length) { wrap.append(this._hint("No speakers found. Speakers appear here once they are assigned to sessions.")); return wrap; }
    const q = this._el("input", { type: "search", placeholder: "Filter speakers" });
    q.value = this._filters[key] || "";
    const buildList = () => {
      const ul = this._el("ul", { class: "roster" });
      const f = (this._filters[key] || "").trim().toLowerCase();
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
    q.oninput = () => { this._filters[key] = q.value; const next = buildList(); list.replaceWith(next); list = next; };
    wrap.append(q, list);
    return wrap;
  }

  // ---- shared groups ---------------------------------------------------------
  _generalGroup() {
    const c = this._config;
    return this._group("general", "General", true, null, [
      this._select("Request to attend buttons", c.registerMode, [["native", "Use Cvent’s Register button (recommended)"], ["url", "Link to a URL"]], (v) => this._patch({ registerMode: v }),
        "Cvent’s button keeps registration type and path logic. The widget’s buttons click the site’s own Register button (normally the one in the header)."),
      ...(c.registerMode === "url" ? [] : [
        this._text("Cvent button label to match", c.nativeRegisterLabel, (v) => this._patch({ nativeRegisterLabel: v.trim() }), { placeholder: c.cta.buttonLabel || "Request to attend", hint: "The exact text on Cvent’s Register button. Blank = the closing band’s button label." }),
        this._text("Or: CSS selector (advanced)", c.nativeRegisterSelector, (v) => this._patch({ nativeRegisterSelector: v.trim() }), { placeholder: ".my-register-button button", hint: "Only when the label is not unique. Leave blank otherwise." }),
      ]),
      this._text(c.registerMode === "url" ? "Registration URL" : "Fallback registration URL", c.registerUrl, (v) => this._patch({ registerUrl: v.trim() }), { hint: c.registerMode === "url" ? "Every “Request to attend” button links here." : "Used only if Cvent’s button can’t be found on the page." }),
      this._check("Use the Bloomberg brand font", c.useBrandFont !== false, (v) => this._patch({ useBrandFont: v })),
      this._check("Full-width backgrounds (edge to edge)", c.fullBleed !== false, (v) => this._patch({ fullBleed: v })),
      this._hint("Stretches each section’s background (dark banner, grey bands) to the window edges; text stays centred."),
    ]);
  }

  _layoutGroup() {
    const c = this._config;
    const order = c.order || [];
    const moveTo = (i, j) => { const n = [...order]; const [x] = n.splice(i, 1); n.splice(j, 0, x); this._patch({ order: n }); };
    const list = this._el("ol", { class: "chosen order" });
    order.forEach((k, i) => {
      const on = c[k]?.show !== false;
      const name = this.labels[k] || k;
      list.append(this._el("li", {},
        this._el("span", { class: `nm ${on ? "" : "off"}`, text: `${name}${on ? "" : " (off)"}` }),
        this._el("button", { type: "button", class: "mini", "aria-label": `Move ${name} up`, text: "↑", onclick: () => i && moveTo(i, i - 1) }),
        this._el("button", { type: "button", class: "mini", "aria-label": `Move ${name} down`, text: "↓", onclick: () => i < order.length - 1 && moveTo(i, i + 1) }),
      ));
    });
    return this._group("layout", "Page layout", true, null, [
      this._el("span", { class: "lbl", text: "Section order (top to bottom)" }),
      list,
      this._button("Reset to the default order", () => this._patch({ order: [...(this.defaults.order || [])] })),
      this._num("Space between sections (%)", c.sectionSpacing, (v) => this._patch({ sectionSpacing: v }), { min: 20, max: 200, step: 10,
        hint: "100 = the standard spacing. Lower is tighter, higher is roomier." }),
    ]);
  }

  _bannerGroup({ titleHint = "", introHint = "" } = {}) {
    const b = this._config.banner;
    const S = (p) => this._patchSection("banner", p);
    return this._sectionGroup("banner", [
      this._check("Automatic eyebrow (event · date · city)", b.autoEyebrow !== false, (v) => S({ autoEyebrow: v })),
      this._text("Eyebrow", b.eyebrow, (v) => S({ eyebrow: v }), { hint: "Overrides the automatic eyebrow." }),
      this._text("Page title", b.title, (v) => S({ title: v }), { hint: titleHint }),
      this._area("Intro", b.intro, (v) => S({ intro: v }), { rows: 3, hint: introHint }),
      this._sub("Background image (optional)"),
      this._uploadField(b, S),
      this._imageField("Or: image URL", b.bgImageUrl, (v) => S({ bgImageUrl: v.trim() }),
        "A link to an image already in Cvent (open it in Cvent and copy its address). A link wins over an uploaded image. Blank = no link."),
      ...(b.bgImageUrl || b.bgImageData ? [
        this._num("Darken image (%)", b.bgOverlay, (v) => S({ bgOverlay: v }), { max: 90, hint: "Keeps the white text readable. 50–70 suits most photos." }),
        this._num("Focal point, % from left", b.bgFocalX, (v) => S({ bgFocalX: v })),
        this._num("Focal point on mobile, % from left", b.bgFocalXMobile, (v) => S({ bgFocalXMobile: v }), { allowBlank: true, hint: "Blank = same as desktop." }),
        this._num("Focal point, % from top", b.bgFocalY, (v) => S({ bgFocalY: v })),
      ] : []),
      this._num("Minimum height (px)", b.height, (v) => S({ height: v }), { min: 0, max: 900, step: 10, allowBlank: true,
        hint: "Blank = just fits the text. Try 360–480 to show more of a photo (capped at 360 on phones)." }),
    ]);
  }

  // Upload from the computer. Custom widgets can't reach Cvent's image
  // library, so the picture is resized in the browser (max 2000px wide, JPEG)
  // and saved inside the widget's settings. Kept small on purpose: every page
  // view downloads it with the settings.
  _uploadField(b, S) {
    const wrap = this._el("div", { class: "field" });
    wrap.append(this._el("span", { class: "lbl", text: "Upload an image" }));
    const status = this._el("span", { class: "hint" });
    const input = this._el("input", { type: "file", accept: "image/jpeg,image/png,image/webp" });
    input.onchange = async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      status.classList.remove("warn");
      status.textContent = "Preparing image…";
      try {
        const data = await shrinkImage(file, 2000, 420000);
        S({ bgImageData: data });
      } catch (e) {
        status.textContent = e?.message || "That image couldn’t be read. Try a JPG or PNG.";
        status.classList.add("warn");
      }
    };
    wrap.append(input);
    if (b.bgImageData) {
      const kb = Math.round((b.bgImageData.length * 3) / 4 / 1024);
      const box = this._el("div", { class: "thumb" }, this._el("img", { alt: "", src: b.bgImageData }));
      wrap.append(box,
        this._el("span", { class: "hint", text: `Uploaded image, ${kb} KB.${b.bgImageUrl ? " Not shown while an image URL is set below." : ""}` }),
        this._button("Remove uploaded image", () => S({ bgImageData: "" })));
    } else {
      status.textContent = "JPG, PNG or WebP. Resized to 2000px wide and compressed automatically. Landscape photos work best.";
    }
    wrap.append(status);
    return wrap;
  }

  _ctaGroup() {
    const t = this._config.cta;
    const S = (p) => this._patchSection("cta", p);
    return this._sectionGroup("cta", [
      this._select("Style", t.style, [["light", "Light: on the grey band (as designed)"], ["dark", "Dark: black panel"]], (v) => S({ style: v })),
      this._text("Eyebrow", t.eyebrow, (v) => S({ eyebrow: v })),
      this._text("Heading", t.heading, (v) => S({ heading: v }), { hint: "Blank = “Join us at <venue> on <date>”." }),
      this._text("Text", t.body, (v) => S({ body: v }), { hint: "Blank = day, time and address." }),
      this._text("Button label", t.buttonLabel, (v) => S({ buttonLabel: v })),
    ]);
  }

  _render() {
    const c = this._config;
    const root = this.shadowRoot;
    root.innerHTML = "";
    root.append(this._el("style", { text: EDITOR_CSS }));
    const panel = this._el("div", { class: "panel" });
    panel.append(this._generalGroup(), this._layoutGroup(), ...this.groups(c).filter(Boolean));
    panel.append(this._el("p", { class: "hint build", text: `${this.title} · build ${this.build} · ${EDITOR_KIT_BUILD} · ${PAGE_KIT_BUILD}` }));
    root.append(panel);
  }
}

export const EDITOR_CSS = `
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
  .cats { display: flex; flex-wrap: wrap; gap: 4px; }
  .cats span { font-size: 11px; background: #f1f1f1; border-radius: 3px; padding: 1px 6px; }
`;

// Resize + compress an image file to a JPEG data URL no longer than maxChars.
export function shrinkImage(file, maxW = 2000, maxChars = 420000) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = Math.min(maxW, img.naturalWidth || maxW);
      for (let pass = 0; pass < 4; pass++) {
        const h = Math.round(((img.naturalHeight || 1) * w) / (img.naturalWidth || 1));
        const c = document.createElement("canvas");
        c.width = w; c.height = h;
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#0B0B0C"; ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        for (const q of [0.8, 0.7, 0.6, 0.5]) {
          const d = c.toDataURL("image/jpeg", q);
          if (d.length <= maxChars) return resolve(d);
        }
        w = Math.round(w * 0.8);
      }
      reject(new Error("This image is too detailed to store in the widget. Use a smaller image, or upload it to Cvent and paste its link instead."));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("That file couldn’t be read as an image. Try a JPG or PNG.")); };
    img.src = url;
  });
}
