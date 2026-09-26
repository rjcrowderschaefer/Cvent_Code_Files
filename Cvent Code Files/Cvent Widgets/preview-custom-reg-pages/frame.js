// frame.js — runs INSIDE the breakpoint iframe. Loads the real widget.js against
// the mock SDK and exposes a tiny API the parent harness drives.

const WIDGET_DIR = "../custom-reg-pages";
const THEME = {
  header: { fontFamily: "Inter, Helvetica, Arial, sans-serif", fontWeight: 600, color: "#17201c" },
  paragraph: { fontFamily: "Inter, Helvetica, Arial, sans-serif", fontWeight: 400, color: "#17201c" },
};

let Widget = null;
let sdk = null;
let widget = null;
let dumpInfo = null;
let loadedDump = null;

async function load() {
  const bust = `?v=${Date.now()}`;
  const { createMockSdk } = await import(`./mock-sdk.js${bust}`);
  await fetch(`${WIDGET_DIR}/type-scale.js`, { cache: "reload" }); // fixed-specifier import
  await fetch(`${WIDGET_DIR}/page-kit.js`, { cache: "reload" }); // fixed-specifier import
  const [mod, dump] = await Promise.all([
    import(`${WIDGET_DIR}/widget.js${bust}`),
    fetch(`./data/reg-pages-dump.json${bust}`).then((r) => r.json()),
  ]);
  Widget = mod.default;
  if (!customElements.get("preview-reg-pages-widget")) customElements.define("preview-reg-pages-widget", Widget);
  sdk = createMockSdk(dump);
  window.getSpeakers = sdk.getSpeakers;
  const ev = dump.eventInfo || {};
  dumpInfo = { sessions: dump.sessions?.length ?? 0, timezone: ev.timezone || "?", title: ev.title || ev.name || ev.code || "" };
  loadedDump = dump; // the mock SDK reads these objects live, so edits + re-mount show up
}

// Each copy goes where it would sit in Cvent: banner in the header region,
// panel beside the form, confirmation above it. ?all=1 adds the other two modes
// (same theme) so the whole page can be checked at once.
const SLOT = { banner: "slot-banner", panel: "slot-panel", confirmation: "slot-confirm" };
let extras = [];
function place(cfg) {
  const w = new Widget({ configuration: cfg || {}, theme: THEME });
  w.cventSdk = sdk; // before append: connectedCallback renders
  document.getElementById(SLOT[cfg?.mode] || SLOT.banner).appendChild(w);
  return w;
}
function mount(cfg) {
  if (widget) { widget.remove(); widget = null; }
  extras.forEach((w) => w.remove()); extras = [];
  cfg = cfg || {};
  widget = place(cfg);
  if (new URLSearchParams(location.search).has("all") || window.__all) {
    const mode = cfg.mode || "banner";
    extras = ["banner", "panel", "confirmation"].filter((m) => m !== mode).map((m) => place({ theme: cfg.theme, mode: m, panel: { contactUrl: "/contact" }, confirmation: { primaryUrl: "/agenda", secondaryUrl: "/contact" } }));
  }
}

window.__preview = {
  ready: load(),
  mount,
  // Config changes go through the widget's own onConfigurationUpdate, exactly
  // as Cvent's editor host would call it.
  update(cfg) { if (widget && (cfg || {}).mode === widget._cfg.mode) widget.onConfigurationUpdate(cfg || {}); else mount(cfg); },
  setPerson(p) { sdk.__setPerson(p); },
  setLang(lang) { document.documentElement.lang = lang; },
  info() { return dumpInfo; },
  // The editor's speaker / session pickers read the same mock SDK.
  sdk() { return sdk; },
  // Test hook: the loaded dump (mutate a session, then mount() to see it).
  data() { return loadedDump; },
};

