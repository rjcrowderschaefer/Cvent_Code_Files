// frame.js — runs INSIDE the breakpoint iframe. Loads the real widget.js against
// the mock SDK (event info only) and the mock WordPress API, and exposes a tiny
// API the parent harness drives.

const WIDGET_DIR = "../custom-bloomberg-insights";
const THEME = {
  header: { fontFamily: "Inter, Helvetica, Arial, sans-serif", fontWeight: 600, color: "#17201c" },
  paragraph: { fontFamily: "Inter, Helvetica, Arial, sans-serif", fontWeight: 400, color: "#17201c" },
};

let Widget = null;
let sdk = null;
let widget = null;
let loadedDump = null;
let widgetModule = null;
const mode = () => { try { return localStorage.getItem("insights-preview-data") || "dump"; } catch { return "dump"; } };

async function load() {
  const bust = `?v=${Date.now()}`;
  const [{ createMockSdk }, { installMockFetch }] = await Promise.all([
    import(`./mock-sdk.js${bust}`),
    import(`./mock-fetch.js${bust}`),
  ]);
  // widget.js imports these with fixed specifiers that can't be cache-busted.
  await fetch(`${WIDGET_DIR}/type-scale.js`, { cache: "reload" });
  await fetch(`${WIDGET_DIR}/page-kit.js`, { cache: "reload" });
  loadedDump = await fetch(`./data/insights-dump.json${bust}`).then((r) => r.json());
  installMockFetch(window, () => loadedDump, mode);
  const mod = await import(`${WIDGET_DIR}/widget.js${bust}`);
  widgetModule = mod;
  mod.clearInsightsCache(); // sessionStorage survives reloads; start from the selected data mode
  Widget = mod.default;
  if (!customElements.get("preview-insights-widget")) customElements.define("preview-insights-widget", Widget);
  sdk = createMockSdk(loadedDump);
}

function mount(cfg) {
  const host = document.getElementById("widget-host");
  if (widget) { widget.remove(); widget = null; }
  widget = new Widget({ configuration: cfg || {}, theme: THEME });
  widget.cventSdk = sdk; // before append: connectedCallback renders
  host.appendChild(widget);
}

window.__preview = {
  ready: load(),
  mount,
  update(cfg) { if (widget) widget.onConfigurationUpdate(cfg || {}); else mount(cfg); },
  setLang(lang) { document.documentElement.lang = lang; },
  info() {
    const s = loadedDump?.series || {};
    return { posts: loadedDump?.posts?.length ?? 0, series: s.slug || "", captured: (loadedDump?.capturedAt || "").slice(0, 10), mode: mode() };
  },
  sdk() { return sdk; },
  // Test hook: mutate a post, then mount() to see it. Clears the widget's cache.
  data() { widgetModule?.clearInsightsCache?.(); return loadedDump; },
};
