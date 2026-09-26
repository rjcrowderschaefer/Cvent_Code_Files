// editor.js — Bloomberg Insights widget editor.
// Text fields commit on `change` (blur / Enter), never `input`: the panel
// re-renders on every patch and would otherwise steal focus mid-typing
// (Playbook §7). The "Check" button runs the same request the widget makes, so
// the planner sees how many articles the filters or link list resolve to.
import {
  INSIGHTS_DEFAULTS, mergeInsightsConfig, API_BASE, TOPICS, TYPES, SERIES,
  fetchJson, parseRefs, normalizePost, parseInsightsUrl, resolveFacetSlugs,
  filterQueryUrl, insightsPageUrl,
} from "./widget.js";

const TR_LANGS = [["es", "Spanish"], ["pt", "Portuguese"]];
const TR_KEYS = [["eyebrow", "Eyebrow"], ["heading", "Heading"], ["intro", "Intro"], ["viewAllLabel", "View-all link label"]];
const FACET_KEY = { topic: "topicIds", type: "typeIds", series: "seriesIds" };

export default class InsightsEditor extends HTMLElement {
  constructor({ setConfiguration, initialConfiguration } = {}) {
    super();
    this.setConfiguration = setConfiguration;
    this._config = mergeInsightsConfig(initialConfiguration || {});
    // Seed defaults only for a brand-new widget (same as the agenda / speakers
    // editors). Saved configs are migrated in memory and written back on the
    // planner's first edit; widget.js runs the same merge, so both agree.
    if (!initialConfiguration) setConfiguration?.(this._config);
    this._open = new Set(["content"]);
    this._status = "";        // result of the last check / link import
    this._busy = false;
    this._topics = TOPICS;    // refreshed from the API on connect
    this._types = TYPES;
    this._pasted = "";
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this._render();
    this._refreshLists();
  }

  onConfigurationUpdate(newConfig) {
    this._config = mergeInsightsConfig(newConfig || {});
    this._render();
  }

  _patch(patch) {
    this._config = mergeInsightsConfig({ ...this._config, ...patch });
    this.setConfiguration?.(this._config);
    this._render();
  }
  _patchTr(lang, key, value) {
    const tr = { ...(this._config.translations || {}) };
    tr[lang] = { ...(tr[lang] || {}), [key]: value };
    this._patch({ translations: tr });
  }

  // Topics and types can be listed from the API (series can't — see widget.js).
  async _refreshLists() {
    const clean = (list) => (Array.isArray(list) ? list : [])
      .filter((x) => x && x.id && x.count > 0 && x.slug !== "uncategorized")
      .map((x) => ({ id: x.id, slug: x.slug, name: new DOMParser().parseFromString(x.name, "text/html").body.textContent }))
      .sort((a, b) => a.name.localeCompare(b.name));
    try {
      const [cats, types] = await Promise.all([
        fetchJson(`${API_BASE}categories?per_page=100&_fields=id,name,slug,count`),
        fetchJson(`${API_BASE}type?per_page=100&_fields=id,name,slug,count`),
      ]);
      const c = clean(cats), t = clean(types);
      if (c.length) this._topics = c;
      if (t.length) this._types = t;
      this._render();
    } catch (e) {
      /* keep the built-in lists */
    }
  }

  _series() {
    const extra = (this._config.extraSeries || []).filter((x) => !SERIES.some((s) => s.id === Number(x.id)));
    return [...SERIES, ...extra];
  }

  // ---- paste an Insights link ------------------------------------------------
  async _importLink(url) {
    const parsed = parseInsightsUrl(url);
    if (!parsed) { this._setStatus("warn", "That isn't a bloomberg.com/professional/insights link."); return; }
    const n = parsed.topic.length + parsed.type.length + parsed.series.length;
    this._setStatus("busy", n ? "Reading the link…" : "No filters in that link, so it will show all Insights.");
    const r = await resolveFacetSlugs(parsed);
    const extraSeries = [...(this._config.extraSeries || [])];
    r.series.forEach((s) => { if (!SERIES.some((x) => x.id === s.id) && !extraSeries.some((x) => x.id === s.id)) extraSeries.push(s); });
    this._pasted = "";
    this._patch({
      source: "filter",
      topicIds: r.topics.map((x) => x.id),
      typeIds: r.types.map((x) => x.id),
      seriesIds: r.series.map((x) => x.id),
      extraSeries,
    });
    if (r.missing.length) { this._setStatus("warn", `Applied the link, but couldn't find ${r.missing.join(", ")}.`); return; }
    await this._runCheck();
  }

  // ---- live check ------------------------------------------------------------
  async _runCheck() {
    const c = this._config;
    this._setStatus("busy", "Checking…");
    try {
      if (c.source === "picked") {
        const refs = parseRefs(c.pickedArticles);
        if (!refs.length) { this._setStatus("warn", "No article links entered yet."); return; }
        const slugs = refs.filter((r) => r.slug).map((r) => r.slug);
        const ids = refs.filter((r) => r.id).map((r) => r.id);
        const f = "id,slug,link,title,class_list";
        const lists = await Promise.all([
          slugs.length ? fetchJson(`${API_BASE}posts?slug=${slugs.map(encodeURIComponent).join(",")}&per_page=100&_fields=${f}`, { noCache: true }) : [],
          ids.length ? fetchJson(`${API_BASE}posts?include=${ids.join(",")}&per_page=100&_fields=${f}`, { noCache: true }) : [],
        ]);
        const posts = lists.flat().map(normalizePost);
        const missing = refs.filter((r) => !posts.some((p) => (r.id ? p.id === r.id : p.slug === r.slug)));
        const note = missing.length ? ` Not found: ${missing.map((r) => r.slug || r.id).join(", ")}.` : "";
        this._setStatus(missing.length ? "warn" : "ok", `Found ${posts.length} of ${refs.length} articles.${note}`);
        return;
      }
      // Raw fetch: the total comes from the X-WP-Total header.
      const r = await fetch(filterQueryUrl(c, 100, "id,class_list"), { credentials: "omit" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const posts = (await r.json()).map(normalizePost);
      const total = Number(r.headers.get("X-WP-Total")) || posts.length;
      if (!total) { this._setStatus("warn", "Nothing matches these filters. Try removing one."); return; }
      const byType = posts.reduce((a, p) => ((a[p.type] = (a[p.type] || 0) + 1), a), {});
      const breakdown = Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${n} ${this._types.find((t) => t.slug === k)?.name || k.replace(/-/g, " ")}`).join(", ");
      const sample = total > posts.length ? ` Latest ${posts.length}: ${breakdown}.` : ` ${breakdown}.`;
      this._setStatus("ok", `${total.toLocaleString()} match.${sample} Showing the newest ${Math.min(total, c.maxItems)}.`);
    } catch (e) {
      this._setStatus("warn", `Couldn't reach bloomberg.com (${e.message}). The live widget will show a fallback link.`);
    }
  }

  _setStatus(kind, text) {
    this._status = { kind, text };
    this._busy = kind === "busy";
    this._render();
  }

  // ---- facet picker ----------------------------------------------------------
  _facet(facet, title, list) {
    const key = FACET_KEY[facet];
    const ids = this._config[key] || [];
    const names = ids.map((id) => list.find((x) => x.id === id)?.name || `ID ${id}`);
    const set = (next) => this._patch({ [key]: next });
    const box = this._el("div", { class: "facet" });
    const head = this._el("div", { class: "facet-h" },
      this._el("span", { class: "lbl", text: title }),
      this._el("span", { class: `facet-sum ${ids.length ? "on" : ""}`, text: ids.length ? names.join(", ") : "Any" }),
      ids.length ? this._el("button", { type: "button", class: "link", text: "Clear", onclick: () => set([]) }) : null,
    );
    const ul = this._el("ul", { class: "roster" });
    const shown = [...list, ...ids.filter((id) => !list.some((x) => x.id === id)).map((id) => ({ id, name: `ID ${id}` }))];
    shown.forEach((x) => {
      const c = this._el("input", { type: "checkbox" });
      c.checked = ids.includes(x.id);
      c.onchange = () => set(c.checked ? [...ids, x.id] : ids.filter((y) => y !== x.id));
      ul.append(this._el("li", {}, this._el("label", { class: "check" }, c, this._el("span", { text: x.name }))));
    });
    box.append(head, ul);
    return box;
  }

  // ---- control helpers (same set as the page widgets) -----------------------
  _el(tag, props = {}, ...kids) {
    const n = document.createElement(tag);
    Object.entries(props).forEach(([k, v]) => {
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k.startsWith("on")) n[k] = v;
      else if (v !== undefined && v !== null && v !== false) n.setAttribute(k, v);
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
    i.onchange = () => onChange(i.value);
    return this._field(label, i, hint);
  }
  _area(label, value, onChange, { hint, rows = 4, placeholder } = {}) {
    const t = this._el("textarea", { rows: String(rows), placeholder: placeholder || "" });
    t.value = value ?? "";
    t.onchange = () => onChange(t.value);
    return this._field(label, t, hint);
  }
  _num(label, value, onChange, { min = 0, max = 100, step = 1, hint } = {}) {
    const i = this._el("input", { type: "number", min: String(min), max: String(max), step: String(step) });
    i.value = value ?? "";
    i.onchange = () => onChange(Number(i.value));
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
    options.forEach(([v, l]) => { const o = this._el("option", { value: v, text: l }); if (String(v) === String(value)) o.selected = true; s.append(o); });
    s.onchange = () => onChange(s.value);
    return this._field(label, s, hint);
  }
  _group(key, title, body) {
    const d = this._el("details", { class: "grp" });
    d.open = this._open.has(key);
    d.ontoggle = () => { d.open ? this._open.add(key) : this._open.delete(key); };
    d.append(this._el("summary", {}, this._el("span", { class: "grp-t", text: title })));
    d.append(this._el("div", { class: "grp-b" }, ...body));
    return d;
  }
  _btn(text, onclick, disabled) {
    return this._el("button", { type: "button", class: "btn", text, onclick, disabled: disabled ? "" : null });
  }

  // ---- panel -----------------------------------------------------------------
  _render() {
    const c = this._config;
    const root = this.shadowRoot;
    root.innerHTML = "";
    root.append(this._el("style", { text: EDITOR_CSS }));
    const panel = this._el("div", { class: "panel" });

    // CONTENT
    const filter = c.source !== "picked";
    const status = this._status
      ? this._el("p", { class: `status status--${this._status.kind}`, role: "status", text: this._status.text })
      : null;
    const paste = this._el("input", { type: "text", placeholder: "https://www.bloomberg.com/professional/insights/?topic=…&type=…&series=…" });
    paste.value = this._pasted;
    paste.oninput = () => { this._pasted = paste.value; };
    paste.onkeydown = (e) => { if (e.key === "Enter") { e.preventDefault(); this._importLink(paste.value); } };
    panel.append(this._group("content", "Content", [
      this._select("Source", c.source, [["filter", "Filter Insights (newest first)"], ["picked", "Hand-picked articles (my order)"]], (v) => { this._status = ""; this._patch({ source: v }); }),
      ...(filter ? [
        this._el("div", { class: "field" },
          this._el("span", { class: "lbl", text: "Copy filters from an Insights link" }),
          this._el("div", { class: "row" }, paste, this._btn("Apply", () => this._importLink(paste.value), this._busy)),
          this._el("span", { class: "hint", text: "Filter the Insights page on bloomberg.com, copy the address, paste it here. Series pages (…/insights/series/…/) work too." }),
        ),
        this._el("p", { class: "hint", text: "Tick several in one list to match any of them. Filters in different lists must all match." }),
        this._facet("topic", "Topic", this._topics),
        this._facet("type", "Type", this._types),
        this._facet("series", "Series", this._series()),
        this._area("Hide these articles", c.excludedArticles, (v) => this._patch({ excludedArticles: v }), { rows: 3, placeholder: "One article link per line", hint: "Optional. Paste links to matching articles you don't want shown." }),
      ] : [
        this._area("Article links", c.pickedArticles, (v) => this._patch({ pickedArticles: v }), {
          rows: 7,
          placeholder: "https://www.bloomberg.com/professional/insights/trading/…/\nhttps://www.bloomberg.com/professional/insights/markets/…/",
          hint: "One per line, shown in this order. Any bloomberg.com/professional/insights article works.",
        }),
      ]),
      this._num("Maximum items", c.maxItems, (v) => this._patch({ maxItems: v }), { min: 1, max: 24 }),
      this._el("div", { class: "row" }, this._btn(this._busy ? "Checking…" : "Check on bloomberg.com", () => this._runCheck(), this._busy)),
      status,
    ]));

    // HEADING
    panel.append(this._group("heading", "Heading", [
      this._text("Eyebrow", c.eyebrow, (v) => this._patch({ eyebrow: v })),
      this._text("Heading", c.heading, (v) => this._patch({ heading: v }), { hint: "Leave blank for no heading." }),
      this._area("Intro", c.intro, (v) => this._patch({ intro: v }), { rows: 2 }),
      this._text("View-all link label", c.viewAllLabel, (v) => this._patch({ viewAllLabel: v }), { hint: "Leave blank to hide the link." }),
      this._text("View-all link URL", c.viewAllUrl, (v) => this._patch({ viewAllUrl: v.trim() }), { placeholder: insightsPageUrl(c), hint: "Blank = the matching Insights page (shown greyed out). It can only carry one topic, type and series." }),
    ]));

    // LAYOUT
    panel.append(this._group("layout", "Layout", [
      this._select("Layout", c.layout, [["grid", "Grid"], ["carousel", "Carousel (scrolls sideways)"], ["list", "List (thumbnail + text rows)"]], (v) => this._patch({ layout: v })),
      c.layout !== "list" ? this._select("Cards per row (desktop)", c.columns, [[2, "2"], [3, "3"], [4, "4"]], (v) => this._patch({ columns: Number(v) }), "Drops to 2 and then 1 as the column narrows.") : null,
      c.layout === "grid" ? this._check("Feature the first item (full width)", c.featureFirst, (v) => this._patch({ featureFirst: v })) : null,
      this._select("Background", c.ground, [["white", "White"], ["tint", "Light grey"], ["dark", "Dark"]], (v) => this._patch({ ground: v })),
      this._el("p", { class: "sub", text: "Card details" }),
      this._check("Image", c.showImage, (v) => this._patch({ showImage: v })),
      this._check("Content type (Article / Video / Podcast)", c.showType, (v) => this._patch({ showType: v })),
      this._check("Publish date", c.showDate, (v) => this._patch({ showDate: v })),
      this._check("Summary", c.showExcerpt, (v) => this._patch({ showExcerpt: v })),
      c.showExcerpt ? this._num("Summary lines", c.excerptLines, (v) => this._patch({ excerptLines: v }), { min: 1, max: 6 }) : null,
      this._check("Topic tags (Markets, Trading…)", c.showTopics, (v) => this._patch({ showTopics: v })),
      this._check("“Read / Watch / Listen” prompt", c.showCta, (v) => this._patch({ showCta: v })),
      this._check("Open articles in a new tab", c.newTab, (v) => this._patch({ newTab: v })),
      this._check("Use the Bloomberg brand font", c.useBrandFont, (v) => this._patch({ useBrandFont: v })),
    ]));

    // TRANSLATIONS
    panel.append(this._group("tr", "Translations", [
      this._el("p", { class: "hint", text: "Shown when the attendee switches language. Blank = the English text above. Article titles and summaries come from bloomberg.com and stay in English." }),
      ...TR_LANGS.flatMap(([lang, name]) => [
        this._el("p", { class: "sub", text: name }),
        ...TR_KEYS.map(([key, label]) => this._text(label, c.translations?.[lang]?.[key] ?? "", (v) => this._patchTr(lang, key, v))),
      ]),
    ]));

    panel.append(this._el("div", { class: "row foot" }, this._btn("Reset to defaults", () => { this._status = ""; this._patch({ ...INSIGHTS_DEFAULTS, translations: {} }); })));
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
  .grp-b { padding: 4px 12px 14px; display: flex; flex-direction: column; gap: 10px; border-top: 1px solid #eee; }
  .field { display: flex; flex-direction: column; gap: 4px; flex: 1; }
  .lbl { font-size: 12px; font-weight: 600; }
  .hint { font-size: 11px; color: #6a6a6a; margin: 0; }
  .sub { margin: 8px 0 0; font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #555; }
  input[type=text], input[type=number], textarea, select { font: inherit; padding: 6px 8px; border: 1px solid #c8c8c8; border-radius: 4px; width: 100%; box-sizing: border-box; }
  textarea { resize: vertical; }
  .check { display: flex; align-items: center; gap: 8px; cursor: pointer; }
  .row { display: flex; gap: 8px; align-items: flex-end; }
  .types { display: flex; flex-wrap: wrap; gap: 6px 14px; align-items: center; }
  .types .lbl { width: 100%; }
  .btn { font: inherit; font-weight: 600; padding: 6px 10px; border: 1px solid #b9b9b9; border-radius: 4px; background: #f7f7f7; cursor: pointer; white-space: nowrap; }
  .btn:hover:not([disabled]) { background: #eee; }
  .btn[disabled] { opacity: .55; cursor: default; }
  .status { margin: 0; padding: 8px 10px; border-radius: 4px; font-size: 12px; }
  .status--ok { background: #e6f4ea; color: #1e6b34; }
  .status--warn { background: #fdf2e0; color: #7a4a00; }
  .status--busy { background: #f1f1f1; color: #555; }
  .foot { justify-content: flex-end; }
  .row > input { flex: 1; min-width: 0; }
  .facet { display: flex; flex-direction: column; gap: 6px; }
  .facet-h { display: flex; align-items: baseline; gap: 8px; }
  .facet-sum { flex: 1; font-size: 11px; color: #777; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .facet-sum.on { color: #1e6b34; font-weight: 600; }
  .link { font: inherit; font-size: 11px; background: none; border: 0; padding: 0; color: #2b6ce8; cursor: pointer; }
  .roster { list-style: none; margin: 0; padding: 6px; max-height: 168px; overflow: auto; border: 1px solid #e3e3e3; border-radius: 4px; display: flex; flex-direction: column; gap: 4px; }
`;
