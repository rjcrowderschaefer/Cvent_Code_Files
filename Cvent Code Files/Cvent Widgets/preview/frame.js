// frame.js — runs INSIDE the breakpoint iframe. Loads the real widget.js against
// the mock SDK and exposes a tiny API the parent harness drives.

const WIDGET_DIR = "../custom-agenda-widget";
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
  await fetch(`${WIDGET_DIR}/AgendaItem.js`, { cache: "reload" }); // fixed-specifier import
  await fetch(`${WIDGET_DIR}/type-scale.js`, { cache: "reload" }); // fixed-specifier import
  const [mod, dump] = await Promise.all([
    import(`${WIDGET_DIR}/widget.js${bust}`),
    fetch(`./data/agenda-dump.json${bust}`).then((r) => r.json()),
  ]);
  Widget = mod.default;
  if (!customElements.get("preview-agenda-widget")) customElements.define("preview-agenda-widget", Widget);
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
  // Test hook: the loaded dump (mutate a session, then mount() to see it).
  data() { return loadedDump; },
  // Add/remove three synthetic short sessions (5 / 10 / 15 min) concurrent with
  // the June 16 test block, to exercise the strip / compact tile tiers.
  setShortSamples(on) {
    if (!loadedDump) return;
    // Mutate IN PLACE: the mock SDK holds a reference to this array.
    const list = loadedDump.sessions;
    for (let i = list.length - 1; i >= 0; i--) if (list[i]._sample) list.splice(i, 1);
    if (!on) return;
    const donor = loadedDump.sessions.find((x) => /Concurrent test D/i.test(x.name)) || loadedDump.sessions[0];
    // Pool of speakers from the test block so samples can carry 1–4 of them.
    const pool = [];
    loadedDump.sessions.forEach((x) => (x.speakers || []).forEach((sp) => {
      if (!pool.some((q) => q.id === sp.id)) pool.push(sp);
    }));
    const speakers = (donor?.speakers || []).slice(0, 2);
    const mk = (id, name, startUtc, mins, tags, spk = speakers) => ({
      id: `sample-${id}`,
      name,
      code: "",
      isIncludedSession: false,
      startDateTime: startUtc,
      endDateTime: new Date(new Date(startUtc).getTime() + mins * 60000).toISOString(),
      description: "<p>Synthetic sample session added by the preview harness to test short concurrent tiles.</p>",
      location: { id: "loc-sample", name: "Test Location", code: "Test Location" },
      category: { id: "cat-sample", name: "Sample", description: "" },
      speakers: spk,
      presentationType: "Session",
      isOpenForRegistration: true,
      isWaitlistEnabled: false,
      displayPriority: 0,
      isFeatured: false,
      capacity: 0,
      waitlistCapacity: 0,
      sessionCustomFields: tags.length ? [{ id: "cf-tags", name: "Tags", type: "MultiChoice", value: tags }] : [],
      associatedRegistrationTypes: [],
      locale: "en-US",
      _sample: true,
    });
    list.push(
      mk("3", "TEST 3-min welcome", "2025-06-16T09:00:00.000Z", 3, [], pool.slice(0, 1)),
      mk("5", "TEST 5-min lightning talk with a deliberately long title to exercise the ellipsis", "2025-06-16T09:05:00.000Z", 5, ["Fuel"], pool.slice(0, 4)),
      mk("10", "TEST 10-min briefing", "2025-06-16T09:15:00.000Z", 10, [], pool.slice(0, 3)),
      mk("15", "TEST 15-min Q&A", "2025-06-16T09:30:00.000Z", 15, ["Food"], pool.slice(0, 2)),
      mk("20", "TEST 20-min compact tile", "2025-06-16T09:10:00.000Z", 20, ["Farm"], pool.slice(0, 6))
    );
  },
};
