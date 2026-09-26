// frame.js — runs INSIDE the breakpoint iframe. Loads the real widget.js against
// the mock SDK and exposes a tiny API the parent harness drives.

const WIDGET_DIR = "../custom-page-venue";
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
  await fetch(`${WIDGET_DIR}/FeaturedSpeaker.js`, { cache: "reload" }); // fixed-specifier import
  await fetch(`${WIDGET_DIR}/type-scale.js`, { cache: "reload" }); // fixed-specifier import
  await fetch(`${WIDGET_DIR}/page-kit.js`, { cache: "reload" }); // fixed-specifier import
  const [mod, dump] = await Promise.all([
    import(`${WIDGET_DIR}/widget.js${bust}`),
    fetch(`./data/page-venue-dump.json${bust}`).then((r) => r.json()),
  ]);
  Widget = mod.default;
  if (!customElements.get("preview-page-venue-widget")) customElements.define("preview-page-venue-widget", Widget);
  sdk = createMockSdk(dump);
  window.getSpeakers = sdk.getSpeakers;
  const ev = dump.eventInfo || {};
  dumpInfo = { sessions: dump.sessions?.length ?? 0, timezone: ev.timezone || "?", title: ev.title || ev.name || ev.code || "" };
  loadedDump = dump; // the mock SDK reads these objects live, so edits + re-mount show up
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
  // Config changes go through the widget's own onConfigurationUpdate, exactly
  // as Cvent's editor host would call it.
  update(cfg) { if (widget) widget.onConfigurationUpdate(cfg || {}); else mount(cfg); },
  setLang(lang) { document.documentElement.lang = lang; },
  info() { return dumpInfo; },
  // The editor's speaker / session pickers read the same mock SDK.
  sdk() { return sdk; },
  // Test hook: the loaded dump (mutate a session, then mount() to see it).
  data() { return loadedDump; },
};

