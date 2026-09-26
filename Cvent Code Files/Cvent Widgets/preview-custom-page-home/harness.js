// harness.js — parent page: mounts the real editor.js on the left and drives the
// widget that lives inside the breakpoint iframe (frame.html) on the right.
const WIDGET_DIR = "../custom-page-home";
const STORE_KEY = "page-home-preview-config";
const $ = (id) => document.getElementById(id);

const loadStored = () => { try { return JSON.parse(localStorage.getItem(STORE_KEY) || "null"); } catch { return null; } };
const saveStored = (cfg) => { try { localStorage.setItem(STORE_KEY, JSON.stringify(cfg)); } catch {} };

// Breakpoint presets: width x height of the frame. "fill" = use the available
// stage height. Heights mimic real devices so scrolling feels right.
const PRESETS = {
  desktop: { w: 1440, h: "fill", label: "desktop 1440" },
  laptop: { w: 1024, h: "fill", label: "1024" },
  tablet: { w: 768, h: 1024, label: "tablet 768" },
  mobile: { w: 390, h: 844, label: "mobile 390" },
};

async function main() {
  const status = $("status");
  const frame = $("frame");
  const bust = `?v=${Date.now()}`;

  // Load the editor here; the widget loads inside the frame.
  const [{ default: Editor }] = await Promise.all([
    import(`${WIDGET_DIR}/editor.js${bust}`),
    new Promise((resolve) => {
      frame.addEventListener("load", resolve, { once: true });
      frame.src = `./frame.html${bust}`;
    }),
  ]);
  // The frame loads its script via a dynamic import, which can finish after the
  // iframe's load event; wait for the API to appear rather than assuming it.
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

  if (!customElements.get("preview-page-home-editor")) customElements.define("preview-page-home-editor", Editor);

  let currentConfig = loadStored();
  if (!currentConfig) {
    // First run: seed with the AI in Finance Summit example copy.
    try { currentConfig = await fetch(`./data/example-config.json${bust}`).then((r) => r.json()); } catch { currentConfig = {}; }
  }
  const setConfiguration = (cfg) => {
    currentConfig = cfg || {};
    saveStored(currentConfig);
    api.update(currentConfig);
    status.textContent = `config updated ${new Date().toLocaleTimeString()}`;
  };
  const editor = new Editor({ setConfiguration, initialConfiguration: currentConfig });
  editor.cventSdk = api.sdk?.(); // before append: connectedCallback loads the roster
  $("editor-host").appendChild(editor);
  currentConfig = editor._config || editor.config || currentConfig;

  api.setLang($("lang").value || "en");
  api.mount(currentConfig);

  // --- breakpoints -----------------------------------------------------------
  const applyPreset = (key) => {
    const p = PRESETS[key] || PRESETS.desktop;
    const stage = $("stage");
    const avail = stage.clientHeight - 24;
    frame.style.width = `${p.w}px`;
    frame.style.height = `${p.h === "fill" ? avail : Math.min(p.h, avail)}px`;
    $("size").textContent = `${p.w} × ${Math.round(parseFloat(frame.style.height))}`;
    // Layout mode (grid vs stack, typography scale) is decided at render time,
    // so re-render after a width change, like a reload on a real device would.
    api.update(currentConfig);
    try { localStorage.setItem("page-home-preview-bp", key); } catch {}
  };
  let bp = "desktop";
  try { bp = localStorage.getItem("page-home-preview-bp") || "desktop"; } catch {}
  $("width").value = bp;
  applyPreset(bp);
  $("width").onchange = (e) => applyPreset(e.target.value);
  window.addEventListener("resize", () => applyPreset($("width").value));

  // --- toolbar ---------------------------------------------------------------
  $("lang").onchange = (e) => { api.setLang(e.target.value); api.mount(currentConfig); };
  $("reset").onclick = () => { try { localStorage.removeItem(STORE_KEY); } catch {} location.reload(); };
  $("remount").onclick = () => api.mount(currentConfig);

  const info = api.info() || {};
  status.textContent = `${info.sessions} sessions · tz ${info.timezone} · event "${info.title}"`;
}

main().catch((e) => { console.error(e); $("status").textContent = "harness failed: " + e.message; });
