// harness.js — parent page: mounts the real editor.js on the left and drives the
// widget that lives inside the breakpoint iframe (frame.html) on the right.
const WIDGET_DIR = "../custom-bloomberg-insights";
const STORE_KEY = "insights-preview-config";
const MODE_KEY = "insights-preview-data";
const BP_KEY = "insights-preview-bp";
const $ = (id) => document.getElementById(id);

const loadStored = () => { try { return JSON.parse(localStorage.getItem(STORE_KEY) || "null"); } catch { return null; } };
const saveStored = (cfg) => { try { localStorage.setItem(STORE_KEY, JSON.stringify(cfg)); } catch {} };
const getMode = () => { try { return localStorage.getItem(MODE_KEY) || "dump"; } catch { return "dump"; } };

const PRESETS = {
  desktop: { w: 1440, h: "fill" },
  laptop: { w: 1024, h: "fill" },
  tablet: { w: 768, h: 1024 },
  mobile: { w: 390, h: 844 },
};

async function main() {
  const status = $("status");
  const frame = $("frame");
  const bust = `?v=${Date.now()}`;

  // The editor's "Check" and "Look up ID" buttons call the same API, so the
  // parent window gets the mock too.
  const [{ installMockFetch }, dump] = await Promise.all([
    import(`./mock-fetch.js${bust}`),
    fetch(`./data/insights-dump.json${bust}`).then((r) => r.json()),
  ]);
  installMockFetch(window, () => dump, getMode);
  await fetch(`${WIDGET_DIR}/type-scale.js`, { cache: "reload" });
  await fetch(`${WIDGET_DIR}/page-kit.js`, { cache: "reload" });
  await fetch(`${WIDGET_DIR}/widget.js`, { cache: "reload" }); // editor imports it with a fixed specifier

  const [{ default: Editor }] = await Promise.all([
    import(`${WIDGET_DIR}/editor.js${bust}`),
    new Promise((resolve) => {
      frame.addEventListener("load", resolve, { once: true });
      frame.src = `./frame.html${bust}`;
    }),
  ]);
  const api = await new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      const a = frame.contentWindow && frame.contentWindow.__preview;
      if (a) return resolve(a);
      if (Date.now() - started > 10000) return reject(new Error("frame API never appeared"));
      setTimeout(tick, 50);
    };
    tick();
  });
  await api.ready;

  if (!customElements.get("preview-insights-editor")) customElements.define("preview-insights-editor", Editor);

  let currentConfig = loadStored();
  const setConfiguration = (cfg) => {
    currentConfig = cfg || {};
    saveStored(currentConfig);
    api.update(currentConfig);
    status.textContent = `config updated ${new Date().toLocaleTimeString()}`;
  };
  // No stored config = first run: the editor seeds defaults via setConfiguration.
  const editor = new Editor({ setConfiguration, initialConfiguration: currentConfig || undefined });
  editor.cventSdk = api.sdk?.();
  $("editor-host").appendChild(editor);
  currentConfig = editor._config || currentConfig || {};

  api.setLang($("lang").value || "en");
  api.mount(currentConfig);

  // --- breakpoints -----------------------------------------------------------
  const applyPreset = (key) => {
    const p = PRESETS[key] || PRESETS.desktop;
    const avail = $("stage").clientHeight - 24;
    frame.style.width = `${p.w}px`;
    frame.style.height = `${p.h === "fill" ? avail : Math.min(p.h, avail)}px`;
    $("size").textContent = `${p.w} × ${Math.round(parseFloat(frame.style.height))}`;
    try { localStorage.setItem(BP_KEY, key); } catch {}
  };
  let bp = "desktop";
  try { bp = localStorage.getItem(BP_KEY) || "desktop"; } catch {}
  $("width").value = bp;
  applyPreset(bp);
  $("width").onchange = (e) => applyPreset(e.target.value);
  window.addEventListener("resize", () => applyPreset($("width").value));

  // --- toolbar ---------------------------------------------------------------
  $("lang").onchange = (e) => { api.setLang(e.target.value); };
  $("data").value = getMode();
  $("data").onchange = (e) => { try { localStorage.setItem(MODE_KEY, e.target.value); } catch {} location.reload(); };
  $("reset").onclick = () => { try { localStorage.removeItem(STORE_KEY); } catch {} location.reload(); };
  $("remount").onclick = () => { api.data(); api.mount(currentConfig); };

  const info = api.info() || {};
  status.textContent = `data: ${info.mode} · ${info.posts} posts in dump (${info.captured}) · series "${info.series}"`;
}

main().catch((e) => { console.error(e); $("status").textContent = "harness failed: " + e.message; });
