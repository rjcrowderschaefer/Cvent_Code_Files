// widget.js — Bloomberg Insights widget.
//
// Shows articles, videos, podcasts, reports… from Bloomberg Professional
// Insights (bloomberg.com/professional/insights/) on a Cvent page, filtered by
// the same Topic / Type / Series facets as the Insights page
// (…/insights/?topic=markets&type=case-study&series=asia-centric), or a
// hand-picked list of articles.
//
// WHY NOT AN IFRAME: bloomberg.com sends `X-Frame-Options: SAMEORIGIN`, so the
// series page renders blank inside any Cvent frame. Instead the widget reads the
// site's public WordPress REST API (CORS-open for GET) and draws its own cards
// in the Live design system. Every card links out to the article on bloomberg.com.
//
// Requests per render (both cached for 10 minutes in sessionStorage):
//   1. posts   /wp/v2/posts?categories=<ids>&type=<ids>&series=<ids>
//              (ids comma-separated = OR within a facet; facets are ANDed —
//              same as the Insights page) or ?slug=a,b,c for hand-picked
//   2. topics  /wp/v2/categories?include=… (only when "Show topics" is on)
//
// NOTE: the /wp/v2/series route belongs to the WEBINAR taxonomy; the posts'
// series taxonomy (post_series) shares the query param but has no lookup route.
// lookupSeriesId() below resolves a series slug to its ID by scanning recent
// posts' class_list instead. See README.md.
//
// NOTE: include the file extension in imports (Cvent loads these as-is).
import { TYPE_SCALE, ensureBrandFont } from "./type-scale.js";
import {
  TOKENS, kitCss, esc, safeUrl, isExternal, resolveLang, dateLocale, plannerText,
  eyebrow, arrowLink,
} from "./page-kit.js";

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------
export const API_BASE = "https://www.bloomberg.com/professional/wp-json/wp/v2/";
export const INSIGHTS_BASE = "https://www.bloomberg.com/professional/insights/";
const POST_FIELDS = "id,date,slug,link,title,excerpt,categories,class_list,yoast_head_json.og_image";
const CACHE_TTL_MS = 10 * 60 * 1000;
const TIMEOUT_MS = 8000;
const memCache = new Map(); // url -> Promise<json>, per page load

function cacheGet(url) {
  try {
    const raw = sessionStorage.getItem(`bbg-insights:${url}`);
    if (!raw) return null;
    const { t, v } = JSON.parse(raw);
    return Date.now() - t < CACHE_TTL_MS ? v : null;
  } catch (e) {
    return null;
  }
}
function cacheSet(url, v) {
  try { sessionStorage.setItem(`bbg-insights:${url}`, JSON.stringify({ t: Date.now(), v })); } catch (e) { /* quota / private mode */ }
}

export function fetchJson(url, { noCache = false } = {}) {
  if (!noCache) {
    if (memCache.has(url)) return memCache.get(url);
    const hit = cacheGet(url);
    if (hit) return Promise.resolve(hit);
  }
  const p = (async () => {
    const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = setTimeout(() => ctrl?.abort(), TIMEOUT_MS);
    try {
      const r = await fetch(url, { signal: ctrl?.signal, credentials: "omit" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      cacheSet(url, json);
      return json;
    } finally {
      clearTimeout(timer);
    }
  })();
  memCache.set(url, p);
  p.catch(() => memCache.delete(url)); // let a later render retry
  return p;
}

// Posts matching the configured facets, newest first.
export function filterQueryUrl(cfg, perPage, fields = POST_FIELDS) {
  const q = [
    cfg.topicIds?.length && `categories=${cfg.topicIds.join(",")}`,
    cfg.typeIds?.length && `type=${cfg.typeIds.join(",")}`,
    cfg.seriesIds?.length && `series=${cfg.seriesIds.join(",")}`,
    `per_page=${perPage}`, "orderby=date", "order=desc", `_fields=${fields}`,
  ].filter(Boolean);
  return `${API_BASE}posts?${q.join("&")}`;
}

export function clearInsightsCache() {
  memCache.clear();
  try { Object.keys(sessionStorage).filter((k) => k.startsWith("bbg-insights:")).forEach((k) => sessionStorage.removeItem(k)); } catch (e) { /* noop */ }
}

// "https://…/insights/trading/some-slug/"  -> "some-slug"
// "some-slug"                               -> "some-slug"
// "141663"                                  -> 141663 (post ID)
export function parseArticleRef(line) {
  const s = String(line || "").trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return { id: Number(s) };
  try {
    const u = new URL(s);
    const parts = u.pathname.split("/").filter(Boolean);
    const slug = parts[parts.length - 1];
    return slug ? { slug: slug.toLowerCase() } : null;
  } catch (e) {
    return /^[a-z0-9-]+$/i.test(s) ? { slug: s.toLowerCase() } : null;
  }
}
export const parseRefs = (text) =>
  String(text || "").split(/[\n,]+/).map(parseArticleRef).filter(Boolean);

// ---------------------------------------------------------------------------
// Facets. Copied from the Insights page's own filter lists (filterCategories /
// filterTypes / filterSeries in its inline script), 24 Sep 2026. The editor
// refreshes Topics and Types from the API; Series has no API list (see the
// header note), so new series are added by pasting an Insights link.
// ---------------------------------------------------------------------------
export const TOPICS = [
  [3715, "artificial-intelligence", "Artificial Intelligence"], [540, "commodities", "Commodities"],
  [435, "data", "Data"], [457, "financial-services", "Financial Services"], [453, "markets", "Markets"],
  [3814, "press-announcement", "Press announcement"], [534, "regional-analysis", "Regional Analysis"],
  [486, "regulation", "Regulation"], [469, "risk", "Risk"], [524, "sustainable-finance", "Sustainable Finance"],
  [3661, "technology", "Technology"], [444, "trading", "Trading"], [449, "treasury", "Treasury"],
].map(([id, slug, name]) => ({ id, slug, name }));
export const TYPES = [
  [3762, "article", "Article"], [3763, "case-study", "Case Study"], [3765, "podcast", "Podcast"],
  [3815, "press-release", "Press Release"], [3766, "qa", "Q&A"], [3767, "report", "Report"], [3768, "video", "Video"],
].map(([id, slug, name]) => ({ id, slug, name }));
export const SERIES = [
  [3751, "asia-centric", "Asia Centric"], [3741, "bloomberg-expert-access", "Bloomberg Expert Access"],
  [3739, "bloomberg-pro-tips", "Bloomberg Pro Tips"], [3743, "ffm", "Functions for the Market"],
  [3931, "global-markets-banking-summit", "Global Markets & Banking Summit"], [3770, "market-dialogues", "Market Dialogues"],
  [3742, "need-to-know", "Need to Know"], [3798, "pricing-insights", "Pricing Insights"],
  [3740, "terminal-essentials", "Terminal Essentials"],
].map(([id, slug, name]) => ({ id, slug, name }));

// Read an Insights link into facet slugs. Accepts
//   …/insights/?topic=markets&type=case-study&series=asia-centric  (comma lists ok)
//   …/insights/series/<slug>/   …/insights/category/<slug>/   …/insights/type/<slug>/
export function parseInsightsUrl(url) {
  const out = { topic: [], type: [], series: [] };
  let u;
  try { u = new URL(String(url || "").trim()); } catch (e) { return null; }
  if (!/bloomberg\.com$/i.test(u.hostname) || !/\/professional\/insights\b/.test(u.pathname)) return null;
  const list = (v) => String(v || "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
  out.topic.push(...list(u.searchParams.get("topic")), ...list(u.searchParams.get("category")));
  out.type.push(...list(u.searchParams.get("type")));
  out.series.push(...list(u.searchParams.get("series")));
  const m = u.pathname.match(/\/insights\/(series|category|type)\/([a-z0-9-]+)/i);
  if (m) out[m[1] === "category" ? "topic" : m[1]].push(m[2].toLowerCase());
  return out;
}

// Slugs -> IDs. Known lists first, then the API (topics/types) or a post scan (series).
export async function resolveFacetSlugs({ topic = [], type = [], series = [] }) {
  const missing = [];
  const bySlug = (list, slugs) => slugs.map((s) => list.find((x) => x.slug === s) || s);
  const viaApi = async (route, slugs) => {
    const known = bySlug(route === "categories" ? TOPICS : TYPES, slugs);
    const unknown = known.filter((x) => typeof x === "string");
    let found = [];
    if (unknown.length) {
      try { found = await fetchJson(`${API_BASE}${route}?slug=${unknown.join(",")}&_fields=id,slug,name`); } catch (e) { found = []; }
    }
    return known.map((x) => {
      if (typeof x !== "string") return x;
      const f = (found || []).find((y) => y.slug === x);
      if (!f) missing.push(`${route === "categories" ? "topic" : "type"} “${x}”`);
      return f ? { id: f.id, slug: f.slug, name: decode(f.name) } : null;
    }).filter(Boolean);
  };
  const topics = await viaApi("categories", topic);
  const types = await viaApi("type", type);
  const seriesOut = [];
  for (const x of bySlug(SERIES, series)) {
    if (typeof x !== "string") { seriesOut.push(x); continue; }
    const id = await lookupSeriesId(x);
    if (id) seriesOut.push({ id, slug: x, name: x.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) });
    else missing.push(`series “${x}”`);
  }
  return { topics, types, series: seriesOut, missing };
}

// The matching page on bloomberg.com, for the "View all" link. The Insights
// page filters on ONE value per facet, so the first of each is used.
export function insightsPageUrl(cfg, known = {}) {
  const find = (list, id) => list.find((x) => x.id === Number(id));
  const slugOf = (list, extra, id) => (find(list, id) || find(extra || [], id))?.slug;
  const t = cfg.topicIds?.[0], y = cfg.typeIds?.[0], s = cfg.seriesIds?.[0];
  const ts = t && slugOf(TOPICS, known.topics, t);
  const ys = y && slugOf(TYPES, known.types, y);
  const ss = s && slugOf(SERIES, cfg.extraSeries, s);
  if (ss && !ts && !ys) return `${INSIGHTS_BASE}series/${ss}/`;
  const q = [ts && `topic=${ts}`, ys && `type=${ys}`, ss && `series=${ss}`].filter(Boolean);
  return q.length ? `${INSIGHTS_BASE}?${q.join("&")}` : INSIGHTS_BASE;
}

// Resolve a series slug to its numeric ID by scanning recent posts (see header note).
export async function lookupSeriesId(slug, { pages = 5 } = {}) {
  const want = `post_series-${String(slug || "").toLowerCase()}`;
  if (want === "post_series-") return null;
  let candidates = null;
  for (let page = 1; page <= pages; page++) {
    let list;
    try {
      list = await fetchJson(`${API_BASE}posts?per_page=100&page=${page}&_fields=series,class_list`);
    } catch (e) {
      break; // past the last page returns 400
    }
    if (!Array.isArray(list) || !list.length) break;
    for (const p of list) {
      if (!(p.class_list || []).includes(want)) continue;
      const ids = (p.series || []).map(Number);
      candidates = candidates ? candidates.filter((id) => ids.includes(id)) : ids;
      if (candidates.length === 1) return candidates[0];
    }
  }
  return candidates && candidates.length ? candidates[0] : null;
}

// ---------------------------------------------------------------------------
// Normalising API posts
// ---------------------------------------------------------------------------

const decode = (html) => {
  const s = String(html ?? "");
  if (!s) return "";
  try {
    return (new DOMParser().parseFromString(`<body>${s}</body>`, "text/html").body.textContent || "")
      .replace(/\s+/g, " ").trim();
  } catch (e) {
    return s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }
};

export function normalizePost(p) {
  const cls = p.class_list || [];
  const typeCls = cls.find((c) => c.startsWith("type-") && c !== "type-post");
  const og = (p.yoast_head_json?.og_image || [])[0] || {};
  const img = safeUrl(og.url, "");
  return {
    id: p.id,
    slug: p.slug || "",
    link: safeUrl(p.link, ""),
    date: p.date || "",
    title: decode(p.title?.rendered),
    excerpt: decode(p.excerpt?.rendered),
    type: typeCls ? typeCls.slice(5) : "article",
    categories: p.categories || [],
    image: /^https:\/\//.test(img) ? img : "",
  };
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
export const INSIGHTS_DEFAULTS = {
  // content
  source: "filter",           // "filter" | "picked"
  topicIds: [],               // category IDs  (empty = any topic)
  typeIds: [],                // type-taxonomy IDs (empty = any type)
  seriesIds: [3931],          // post_series IDs (empty = any series)
  extraSeries: [],            // series added from a pasted link that aren't in SERIES: [{id, slug, name}]
  pickedArticles: "",         // one URL / slug / post ID per line (hand-picked order)
  excludedArticles: "",       // filter mode: hide these
  maxItems: 6,
  // heading
  eyebrow: "Bloomberg Insights",
  heading: "Insights from the summit",
  intro: "",
  viewAllLabel: "View all insights",
  viewAllUrl: "",             // blank = the matching Insights page
  // layout
  layout: "grid",             // "grid" | "carousel" | "list"
  columns: 3,
  featureFirst: false,
  ground: "white",            // "white" | "tint" | "dark"
  showImage: true,
  showType: true,
  showDate: true,
  showExcerpt: true,
  excerptLines: 3,
  showTopics: false,
  showCta: true,
  newTab: true,
  useBrandFont: true,
  translations: {},
};

const idList = (v) => (Array.isArray(v) ? [...new Set(v.map(Number).filter((n) => Number.isInteger(n) && n > 0))] : null);

export function mergeInsightsConfig(incoming = {}) {
  const inc = { ...(incoming || {}) };
  // v1 configs (single series + content-type slugs) → facet IDs.
  if (inc.source === "series") inc.source = "filter";
  if (!Array.isArray(inc.seriesIds) && "seriesId" in inc) inc.seriesIds = Number(inc.seriesId) ? [Number(inc.seriesId)] : [];
  if (!Array.isArray(inc.typeIds) && Array.isArray(inc.types)) {
    const all = ["article", "video", "podcast", "report"].every((t) => inc.types.includes(t));
    inc.typeIds = all ? [] : inc.types.map((t) => TYPES.find((x) => x.slug === t)?.id).filter(Boolean);
  }
  delete inc.seriesId; delete inc.seriesUrl; delete inc.types;
  const out = { ...INSIGHTS_DEFAULTS, ...inc };
  out.source = out.source === "picked" ? "picked" : "filter";
  out.topicIds = idList(inc.topicIds) ?? [];
  out.typeIds = idList(inc.typeIds) ?? [];
  out.seriesIds = idList(inc.seriesIds) ?? [...INSIGHTS_DEFAULTS.seriesIds];
  out.extraSeries = Array.isArray(inc.extraSeries) ? inc.extraSeries.filter((x) => x && Number(x.id)) : [];
  out.maxItems = clampInt(out.maxItems, 1, 24, INSIGHTS_DEFAULTS.maxItems);
  out.columns = clampInt(out.columns, 2, 4, INSIGHTS_DEFAULTS.columns);
  out.excerptLines = clampInt(out.excerptLines, 1, 6, INSIGHTS_DEFAULTS.excerptLines);
  out.translations = { ...(incoming?.translations || {}) };
  return out;
}
function clampInt(v, min, max, d) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : d;
}

// ---------------------------------------------------------------------------
// Fixed strings (en / es / pt; others fall back to English — Playbook §3)
// ---------------------------------------------------------------------------
const STRINGS = {
  en: { caseStudy: "Case Study", qa: "Q&A", "press-release": "Press Release", interview: "Interview", webinar: "Webinar", article: "Article", video: "Video", podcast: "Podcast", report: "Report", read: "Read", watch: "Watch", listen: "Listen", prev: "Previous", next: "Next", loading: "Loading insights…", unavailable: "Insights can't be loaded right now.", explore: "Explore insights on bloomberg.com", empty: "No insights to show yet.", setup: "Paste article links in the widget settings.", newTab: "(opens in a new tab)" },
  es: { caseStudy: "Caso de éxito", qa: "Preguntas y respuestas", "press-release": "Comunicado", interview: "Entrevista", webinar: "Webinar", article: "Artículo", video: "Video", podcast: "Pódcast", report: "Informe", read: "Leer", watch: "Ver", listen: "Escuchar", prev: "Anterior", next: "Siguiente", loading: "Cargando análisis…", unavailable: "No es posible cargar los análisis en este momento.", explore: "Ver análisis en bloomberg.com", empty: "Aún no hay análisis.", setup: "Pegue enlaces de artículos en la configuración.", newTab: "(se abre en una pestaña nueva)" },
  pt: { caseStudy: "Estudo de caso", qa: "Perguntas e respostas", "press-release": "Comunicado", interview: "Entrevista", webinar: "Webinar", article: "Artigo", video: "Vídeo", podcast: "Podcast", report: "Relatório", read: "Ler", watch: "Assistir", listen: "Ouvir", prev: "Anterior", next: "Próximo", loading: "Carregando análises…", unavailable: "Não foi possível carregar as análises agora.", explore: "Ver análises em bloomberg.com", empty: "Ainda não há análises.", setup: "Cole links de artigos nas configurações.", newTab: "(abre em uma nova aba)" },
};
const str = (lang, key) => (STRINGS[lang] || STRINGS.en)[key] ?? STRINGS.en[key] ?? key;
const typeLabel = (lang, type) => {
  const key = type === "case-study" ? "caseStudy" : type;
  return (STRINGS[lang] || STRINGS.en)[key] || STRINGS.en[key] || type.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
};
const ctaVerb = (lang, type) => str(lang, type === "video" ? "watch" : type === "podcast" ? "listen" : "read");

// Post dates are site-local wall-clock without a zone; show the calendar date only.
function fmtPostDate(date, lang) {
  if (!date) return "";
  const d = new Date(`${String(date).slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(dateLocale(lang), { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

// ---------------------------------------------------------------------------
// Element
// ---------------------------------------------------------------------------
export default class extends HTMLElement {
  constructor({ configuration, theme } = {}) {
    super();
    this.configuration = configuration || {};
    this.theme = theme || {};
    this.attachShadow({ mode: "open" });
    this._renderSeq = 0;
    this._langObserver = null;
    this._lang = "en";
  }

  async connectedCallback() {
    if (this.configuration?.useBrandFont !== false) ensureBrandFont();
    if (!this.shadowRoot.querySelector(".pk")) {
      const root = document.createElement("div");
      root.className = "pk";
      this.shadowRoot.append(root);
    }
    try {
      const info = (await this.cventSdk?.getEventInfo?.()) || {};
      this._eventInfo = info;
    } catch (e) {
      console.warn("[insights] getEventInfo error:", e);
      this._eventInfo = {};
    }
    this._rerender();
    this._langObserver = new MutationObserver(() => this._rerender());
    this._langObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
  }

  disconnectedCallback() {
    this._langObserver?.disconnect();
  }

  onConfigurationUpdate(newConfig) {
    this.configuration = newConfig || {};
    this._rerender();
  }

  _rerender() {
    const root = this.shadowRoot?.querySelector(".pk");
    if (root) this._renderInto(root);
  }

  // =========================================================================
  // DATA
  // =========================================================================
  async _loadItems(cfg) {
    let items = [];
    if (cfg.source === "picked") {
      const refs = parseRefs(cfg.pickedArticles).slice(0, 50);
      if (!refs.length) return { items: [], setup: true };
      const slugs = refs.filter((r) => r.slug).map((r) => r.slug);
      const ids = refs.filter((r) => r.id).map((r) => r.id);
      const calls = [];
      if (slugs.length) calls.push(fetchJson(`${API_BASE}posts?slug=${slugs.map(encodeURIComponent).join(",")}&per_page=100&_fields=${POST_FIELDS}`));
      if (ids.length) calls.push(fetchJson(`${API_BASE}posts?include=${ids.join(",")}&per_page=100&_fields=${POST_FIELDS}`));
      const lists = await Promise.all(calls);
      const all = lists.flat().map(normalizePost);
      // Keep the planner's order.
      items = refs
        .map((r) => all.find((p) => (r.id ? p.id === r.id : p.slug === r.slug)))
        .filter(Boolean);
    } else {
      // Filtering happens server-side, so only fetch what's shown (+ room for hidden ones).
      const excluded = parseRefs(cfg.excludedArticles);
      const list = await fetchJson(filterQueryUrl(cfg, Math.min(100, cfg.maxItems + excluded.length)));
      items = (Array.isArray(list) ? list : [])
        .map(normalizePost)
        .filter((p) => !excluded.some((r) => (r.id ? r.id === p.id : r.slug === p.slug)));
    }
    items = items.filter((p) => p.link && p.title).slice(0, cfg.maxItems);

    let topics = {};
    if (cfg.showTopics && items.length) {
      const ids = [...new Set(items.flatMap((p) => p.categories))].sort((a, b) => a - b);
      if (ids.length) {
        try {
          const cats = await fetchJson(`${API_BASE}categories?include=${ids.join(",")}&per_page=100&_fields=id,name`);
          (cats || []).forEach((c) => { topics[c.id] = decode(c.name); });
        } catch (e) {
          console.warn("[insights] categories error:", e);
        }
      }
    }
    return { items, topics };
  }

  // =========================================================================
  // RENDER
  // =========================================================================
  async _renderInto(root) {
    const seq = ++this._renderSeq;
    const cfg = mergeInsightsConfig(this.configuration);
    const lang = resolveLang(this._eventInfo || {});
    this._lang = lang;
    const P = (key, base) => plannerText(cfg, lang, key, base);

    const head = this._head(cfg, lang, P);
    const style = `<style>${kitCss()}${this._css(cfg)}</style>`;
    const wrap = (body, extra = "") => `
      ${style}
      <section class="pk-section pk-pad-tight ins ins--${esc(cfg.ground)}" aria-label="${esc(P("heading", cfg.heading) || P("eyebrow", cfg.eyebrow) || "Insights")}">
        <div class="pk-inner">
          ${head.top}
          ${body}
          ${extra}
        </div>
      </section>`;

    // Loading skeleton (only if nothing is on screen yet, to avoid flashing on config edits).
    if (!root.querySelector(".ins-card")) {
      root.innerHTML = wrap(this._skeleton(cfg, lang));
    }

    let data;
    try {
      data = await this._loadItems(cfg);
    } catch (e) {
      console.warn("[insights] load error:", e);
      data = { error: true, items: [] };
    }
    if (seq !== this._renderSeq) return; // a newer render started

    if (data.error || data.setup || !data.items.length) {
      const msg = data.error ? str(lang, "unavailable") : data.setup ? str(lang, "setup") : str(lang, "empty");
      const fallback = this._viewAllHref(cfg);
      root.innerHTML = wrap(`
        <div class="ins-state" role="status">
          <p class="pk-empty">${esc(msg)}</p>
          ${fallback ? arrowLink({ label: str(lang, "explore"), href: fallback, ground: cfg.ground === "dark" ? "dark" : "light", lang }) : ""}
        </div>`);
      return;
    }

    root.innerHTML = wrap(this._items(cfg, lang, data), head.bottom);
    // A dead image leaves the neutral placeholder box rather than a broken icon.
    root.querySelectorAll(".ins-media img").forEach((img) => {
      img.addEventListener("error", () => img.remove(), { once: true });
      if (img.complete && !img.naturalWidth && img.src) img.remove();
    });
    if (cfg.layout === "carousel") this._wireCarousel(root);
  }

  _viewAllHref(cfg) {
    return safeUrl(cfg.viewAllUrl || insightsPageUrl(cfg), "");
  }

  _head(cfg, lang, P) {
    const ground = cfg.ground === "dark" ? "dark" : "light";
    const href = this._viewAllHref(cfg);
    const label = P("viewAllLabel", cfg.viewAllLabel);
    const link = href && label ? arrowLink({ label, href, ground, lang }) : "";
    const heading = P("heading", cfg.heading);
    const intro = P("intro", cfg.intro);
    const eb = eyebrow(P("eyebrow", cfg.eyebrow));
    const text = `<div class="pk-head-text">${eb}${heading ? `<h2 class="pk-h2 ins-h">${esc(heading)}</h2>` : ""}${intro ? `<p class="ins-intro">${esc(intro)}</p>` : ""}</div>`;
    const top = link ? `<div class="pk-head">${text}<div class="pk-only-desktop">${link}</div></div>` : text;
    return { top, bottom: link ? `<div class="pk-only-mobile">${link}</div>` : "" };
  }

  _skeleton(cfg, lang) {
    const n = Math.min(cfg.maxItems, cfg.layout === "list" ? 3 : cfg.columns);
    const cards = Array.from({ length: n }, () => `
      <li class="ins-item"><div class="ins-card ins-card--skel" aria-hidden="true">
        ${cfg.showImage ? `<div class="ins-media"></div>` : ""}
        <div class="ins-body"><span class="skel skel--s"></span><span class="skel"></span><span class="skel skel--m"></span></div>
      </div></li>`).join("");
    return `<p class="pk-sr" role="status">${esc(str(lang, "loading"))}</p><ul class="ins-list ins-list--${esc(cfg.layout)}" style="--cols:${cfg.columns}">${cards}</ul>`;
  }

  _card(it, i, cfg, lang, topics) {
    const ext = isExternal(it.link);
    const newTab = cfg.newTab && ext;
    const feature = cfg.featureFirst && cfg.layout === "grid" && i === 0;
    const meta = [
      cfg.showType ? `<span class="ins-type">${esc(typeLabel(lang, it.type))}</span>` : "",
      cfg.showDate && it.date ? `<time datetime="${esc(it.date.slice(0, 10))}">${esc(fmtPostDate(it.date, lang))}</time>` : "",
    ].filter(Boolean);
    const topicNames = cfg.showTopics ? it.categories.map((c) => topics?.[c]).filter(Boolean).slice(0, 3) : [];
    return `
      <li class="ins-item${feature ? " ins-item--feature" : ""}">
        <article class="ins-card${feature ? " ins-card--feature" : ""}">
          ${cfg.showImage ? `<div class="ins-media">${it.image ? `<img src="${esc(it.image)}" alt="" loading="${i < cfg.columns ? "eager" : "lazy"}" decoding="async">` : ""}${it.type === "video" || it.type === "podcast" ? `<span class="ins-badge" aria-hidden="true">${it.type === "video" ? "▶" : "♪"}</span>` : ""}</div>` : ""}
          <div class="ins-body">
            ${meta.length ? `<p class="ins-meta">${meta.join(`<span class="ins-dot" aria-hidden="true"></span>`)}</p>` : ""}
            <h3 class="ins-title"><a class="ins-link" href="${esc(it.link)}"${newTab ? ' target="_blank" rel="noopener"' : ""}>${esc(it.title)}${newTab ? `<span class="pk-sr"> ${esc(str(lang, "newTab"))}</span>` : ""}</a></h3>
            ${cfg.showExcerpt && it.excerpt ? `<p class="ins-excerpt">${esc(it.excerpt)}</p>` : ""}
            ${topicNames.length ? `<p class="ins-topics">${topicNames.map((t) => `<span class="pk-tag">${esc(t)}</span>`).join("")}</p>` : ""}
            ${cfg.showCta ? `<span class="ins-cta" aria-hidden="true">${esc(ctaVerb(lang, it.type))}<span class="ins-cta-arrow">${newTab ? "↗" : "→"}</span></span>` : ""}
          </div>
        </article>
      </li>`;
  }

  _items(cfg, lang, { items, topics }) {
    const list = `<ul class="ins-list ins-list--${esc(cfg.layout)}" style="--cols:${cfg.columns}">${items.map((it, i) => this._card(it, i, cfg, lang, topics)).join("")}</ul>`;
    if (cfg.layout !== "carousel") return list;
    const ground = cfg.ground === "dark" ? "dark" : "light";
    return `
      <div class="ins-carousel">
        <div class="ins-track" tabindex="0" role="region" aria-label="${esc(cfg.heading || cfg.eyebrow || "Insights")}">${list}</div>
        <div class="ins-nav ins-nav--${ground}">
          <button type="button" class="ins-arrow" data-dir="-1" aria-label="${esc(str(lang, "prev"))}">←</button>
          <button type="button" class="ins-arrow" data-dir="1" aria-label="${esc(str(lang, "next"))}">→</button>
        </div>
      </div>`;
  }

  _wireCarousel(root) {
    const track = root.querySelector(".ins-track");
    if (!track) return;
    const btns = [...root.querySelectorAll(".ins-arrow")];
    const update = () => {
      const max = track.scrollWidth - track.clientWidth - 2;
      btns.forEach((b) => { b.disabled = b.dataset.dir === "-1" ? track.scrollLeft <= 2 : track.scrollLeft >= max; });
      root.querySelector(".ins-nav")?.toggleAttribute("hidden", max <= 0);
    };
    btns.forEach((b) => {
      b.onclick = () => {
        const item = track.querySelector(".ins-item");
        const step = item ? item.getBoundingClientRect().width + 24 : track.clientWidth * 0.8;
        const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        track.scrollBy({ left: Number(b.dataset.dir) * step, behavior: reduce ? "auto" : "smooth" });
      };
    });
    track.addEventListener("scroll", () => requestAnimationFrame(update), { passive: true });
    requestAnimationFrame(update);
  }

  // =========================================================================
  // CSS (shared kit CSS comes from page-kit.js)
  // =========================================================================
  _css(cfg) {
    const t = TOKENS;
    const S = TYPE_SCALE;
    const dark = cfg.ground === "dark";
    const ink = dark ? "#fff" : t.ink;
    const muted = dark ? t.onDark : t.muted;
    const hair = dark ? t.onDarkHair : t.hair;
    const accent = dark ? t.amberOnDark : t.amberInk;
    const title = S.title, meta = S.label, body = S.bodySmall;
    return `
    /* Container queries: the widget sizes itself to its Cvent column, not the viewport. */
    .ins { container-type: inline-size; container-name: ins; background: ${cfg.ground === "tint" ? t.tint : dark ? t.deep : "#fff"}; color: ${ink}; }
    .ins .pk-h2 { color: ${ink}; }
    .ins .pk-eyebrow { color: ${muted}; }
    .ins-intro { margin-top: 12px; max-width: 70ch; font-size: 16px; line-height: 1.5; color: ${muted}; }
    .ins .pk-head { margin-bottom: 0; }
    .ins-state { margin-top: 32px; display: flex; flex-direction: column; gap: 12px; align-items: flex-start; }
    .ins .pk-empty { color: ${muted}; }

    .ins-list { list-style: none; margin: 40px 0 0; padding: 0; display: grid; gap: 40px 32px;
      grid-template-columns: repeat(var(--cols, 3), minmax(0, 1fr)); }
    .ins-item { min-width: 0; display: flex; }
    .ins-card { position: relative; display: flex; flex-direction: column; width: 100%; }
    .ins-media { position: relative; aspect-ratio: 3 / 2; overflow: hidden; border-radius: 2px; background: ${dark ? t.panel : t.placeholder}; }
    .ins-media img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .35s ease; }
    .ins-card:hover .ins-media img { transform: scale(1.03); }
    .ins-badge { position: absolute; left: 12px; bottom: 12px; width: 36px; height: 36px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center; font-size: 13px; line-height: 1;
      background: rgba(11,11,12,.72); color: #fff; }
    .ins-body { display: flex; flex-direction: column; gap: 10px; padding-top: 18px; flex: 1; }
    .ins-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px;
      font-size: ${meta.fontSize}px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: ${muted}; }
    .ins-type { color: ${accent}; }
    .ins-dot { width: 3px; height: 3px; border-radius: 50%; background: currentColor; opacity: .7; }
    .ins-title { font-size: ${title.fontSize}px; line-height: 1.3; font-weight: 700; letter-spacing: -0.01em; color: ${ink}; }
    .ins-link { text-decoration: none; color: inherit; transition: color .15s ease; }
    /* Whole card is the click target; the title stays the link's accessible name. */
    .ins-link::after { content: ""; position: absolute; inset: 0; z-index: 1; }
    .ins-card:hover .ins-link { color: ${accent}; }
    .ins-link:focus-visible { outline: none; }
    .ins-card:has(.ins-link:focus-visible) { outline: 3px solid ${t.focus}; outline-offset: 4px; }
    .ins-excerpt { font-size: ${body.fontSize}px; line-height: 1.5; color: ${muted};
      display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: ${cfg.excerptLines}; overflow: hidden; }
    .ins-topics { display: flex; flex-wrap: wrap; gap: 6px; }
    ${dark ? `.ins .pk-tag { background: rgba(255,255,255,.1); color: ${t.onDark}; }` : ""}
    .ins-cta { margin-top: auto; padding-top: 4px; display: inline-flex; align-items: center; gap: 6px;
      font-size: 14px; font-weight: 700; color: ${accent}; transition: gap .15s ease; }
    .ins-card:hover .ins-cta { gap: 11px; }

    /* Feature card (grid, first item): spans the row, image left. */
    .ins-item--feature { grid-column: 1 / -1; }
    .ins-card--feature { display: grid; grid-template-columns: 1.25fr 1fr; gap: 40px; align-items: center;
      padding-bottom: 40px; border-bottom: 1px solid ${hair}; }
    .ins-card--feature .ins-body { padding-top: 0; }
    .ins-card--feature .ins-title { font-size: ${S.display.fontSize}px; line-height: 1.2; letter-spacing: -0.02em; }
    .ins-card--feature .ins-excerpt { font-size: 17px; }

    /* List layout: thumbnail left, text right, hairline rows. */
    .ins-list--list { grid-template-columns: minmax(0, 1fr); gap: 0; border-bottom: 1px solid ${hair}; }
    .ins-list--list .ins-card { display: grid; grid-template-columns: ${cfg.showImage ? "240px minmax(0, 1fr)" : "minmax(0, 1fr)"}; gap: 28px;
      padding: 28px 0; border-top: 1px solid ${hair}; align-items: start; }
    .ins-list--list .ins-body { padding-top: 0; }
    .ins-list--list .ins-cta { margin-top: 0; }

    /* Carousel: native horizontal scroll + snap; buttons are an enhancement. */
    .ins-carousel { position: relative; }
    .ins-track { overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; margin: 0 -4px; padding: 0 4px 4px; }
    .ins-track::-webkit-scrollbar { display: none; }
    .ins-track:focus-visible { outline: 3px solid ${t.focus}; outline-offset: 2px; }
    .ins-list--carousel { display: flex; gap: 24px; }
    .ins-list--carousel .ins-item { flex: 0 0 calc((100% - (var(--cols) - 1) * 24px) / var(--cols)); scroll-snap-align: start; }
    .ins-nav { display: flex; gap: 8px; justify-content: flex-end; margin-top: 24px; }
    .ins-nav[hidden] { display: none; }
    .ins-arrow { width: 44px; height: 44px; border-radius: 2px; border: 1px solid ${dark ? "rgba(255,255,255,.5)" : t.ink};
      background: transparent; color: ${ink}; font-family: inherit; font-size: 16px; font-weight: 700; line-height: 1; cursor: pointer;
      transition: background-color .15s ease, opacity .15s ease; }
    .ins-arrow:hover:not(:disabled) { background: ${dark ? "rgba(255,255,255,.08)" : "rgba(156,95,0,.10)"}; }
    .ins-arrow:disabled { opacity: .3; cursor: default; }
    .ins-arrow:focus-visible { outline: 3px solid ${t.focus}; outline-offset: 2px; }

    /* Skeleton */
    .ins-card--skel .ins-body { gap: 12px; }
    .skel { display: block; height: 14px; border-radius: 2px; background: ${dark ? t.panel : t.placeholder}; }
    .skel--s { width: 30%; height: 10px; }
    .skel--m { width: 70%; }
    @media (prefers-reduced-motion: no-preference) {
      .skel, .ins-card--skel .ins-media { animation: ins-pulse 1.4s ease-in-out infinite; }
    }
    @keyframes ins-pulse { 50% { opacity: .55; } }

    /* ≤ 1024px column (or tablet) */
    @container ins (max-width: 1024px) {
      .ins-list { grid-template-columns: repeat(${Math.min(cfg.columns, 2)}, minmax(0, 1fr)); gap: 32px 24px; }
      .ins-list--list { grid-template-columns: minmax(0, 1fr); gap: 0; }
      .ins-list--carousel .ins-item { flex-basis: calc((100% - 24px) / 2); }
      .ins-title { font-size: ${title.fontSizeMd}px; }
      .ins-card--feature { grid-template-columns: 1fr 1fr; gap: 28px; }
      .ins-card--feature .ins-title { font-size: ${S.display.fontSizeMd}px; }
      .ins-list--list .ins-card { grid-template-columns: ${cfg.showImage ? "180px minmax(0, 1fr)" : "minmax(0, 1fr)"}; gap: 20px; }
    }
    /* ≤ 600px column (or phone) */
    @container ins (max-width: 600px) {
      .ins-list { grid-template-columns: minmax(0, 1fr); gap: 32px; margin-top: 28px; }
      .ins-title { font-size: ${title.fontSizeSm}px; }
      .ins-excerpt { font-size: ${body.fontSizeSm}px; }
      .ins-card--feature { grid-template-columns: minmax(0, 1fr); gap: 0; padding-bottom: 32px; }
      .ins-card--feature .ins-body { padding-top: 18px; }
      .ins-card--feature .ins-title { font-size: ${S.display.fontSizeSm}px; }
      .ins-list--list .ins-card { grid-template-columns: ${cfg.showImage ? "104px minmax(0, 1fr)" : "minmax(0, 1fr)"}; gap: 16px; padding: 20px 0; }
      .ins-list--list { gap: 0; margin-top: 28px; }
      .ins-list--list .ins-excerpt { display: none; }
      .ins-list--list .ins-badge { width: 28px; height: 28px; left: 8px; bottom: 8px; font-size: 11px; }
      .ins-list--carousel .ins-item { flex-basis: 84%; }
      .ins-nav { display: none; }
    }
    `;
  }
}
