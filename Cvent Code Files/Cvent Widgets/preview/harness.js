// harness.js — mounts the real editor.js + widget.js side by side against the mock SDK.
import { createMockSdk } from "./mock-sdk.js";

const WIDGET_DIR = "../custom-agenda-widget";
const STORE_KEY = "agenda-preview-config";
const $ = (id) => document.getElementById(id);

const loadStored = () => { try { return JSON.parse(localStorage.getItem(STORE_KEY) || "null"); } catch { return null; } };
const saveStored = (cfg) => { try { localStorage.setItem(STORE_KEY, JSON.stringify(cfg)); } catch {} };

// Cvent hands widgets a theme object; the widget reads theme.header / theme.paragraph
// (font family + weight) as typography bases.
const THEME = {
  header: { fontFamily: "Inter, Helvetica, Arial, sans-serif", fontWeight: 600, color: "#17201c" },
  paragraph: { fontFamily: "Inter, Helvetica, Arial, sans-serif", fontWeight: 400, color: "#17201c" },
};

async function main() {
  const status = $("status");
  const bust = `?v=${Date.now()}`; // defeat module caching on every reload
  // widget.js imports "./AgendaItem.js" with a fixed specifier, so it can't be
  // cache-busted from here. Re-fetch it with cache:"reload" first: that refreshes
  // the HTTP cache entry the module loader is about to read.
  await fetch(`${WIDGET_DIR}/AgendaItem.js`, { cache: "reload" });
  const [{ default: Widget }, { default: Editor }, dump] = await Promise.all([
    import(`${WIDGET_DIR}/widget.js${bust}`),
    import(`${WIDGET_DIR}/editor.js${bust}`),
    fetch(`./data/agenda-dump.json${bust}`).then((r) => r.json()),
  ]);

  if (!customElements.get("preview-agenda-widget")) customElements.define("preview-agenda-widget", Widget);
  if (!customElements.get("preview-agenda-editor")) customElements.define("preview-agenda-editor", Editor);

  const sdk = createMockSdk(dump);
  window.getSpeakers = sdk.getSpeakers; // fallback path AgendaItem.js also checks

  let widget = null;
  let currentConfig = loadStored() || {};

  const mountWidget = (cfg) => {
    const host = $("widget-host");
    if (widget) { widget.remove(); widget = null; }
    widget = new Widget({ configuration: cfg, theme: THEME });
    widget.cventSdk = sdk; // must be set BEFORE append (connectedCallback renders)
    host.appendChild(widget);
  };

  const setConfiguration = (cfg) => {
    currentConfig = cfg || {};
    saveStored(currentConfig);
    if (widget) widget.onConfigurationUpdate(currentConfig); else mountWidget(currentConfig);
    status.textContent = `config updated ${new Date().toLocaleTimeString()}`;
  };

  const editor = new Editor({ setConfiguration, initialConfiguration: currentConfig });
  $("editor-host").appendChild(editor);
  // The editor merges defaults into the incoming config; use its merged view as the starting point.
  currentConfig = editor._config || editor.config || currentConfig;
  mountWidget(currentConfig);

  // --- toolbar -------------------------------------------------------------
  $("lang").value = document.documentElement.lang || "en";
  $("lang").onchange = (e) => { document.documentElement.lang = e.target.value; mountWidget(currentConfig); };
  $("reset").onclick = () => { try { localStorage.removeItem(STORE_KEY); } catch {} location.reload(); };
  $("remount").onclick = () => mountWidget(currentConfig);
  $("width").onchange = (e) => { $("stage").style.maxWidth = e.target.value; window.dispatchEvent(new Event("resize")); };

  const ev = dump.eventInfo || {};
  status.textContent = `${dump.sessions?.length ?? 0} sessions · tz ${ev.timezone || "?"} · event "${ev.title || ev.name || ev.code || ""}"`;
}

main().catch((e) => { console.error(e); $("status").textContent = "harness failed: " + e.message; });
