/**
 * Cvent Custom Widget — widget.js (skeleton)
 * Orchestrates data fetch + rendering. Reads sessions/event info from the SDK,
 * handles the timezone + language quirks, and hands each item to a component
 * element for rendering.
 *
 * See CVENT_WIDGET_PLAYBOOK.md for the "why" behind each pattern.
 */

// The custom element tag your component file (ITEM.js) defines.
const ITEM_TAG = "my-widget-item";

export default class MyWidget extends HTMLElement {
  constructor() {
    super();
    this.configuration = {};
    this.theme = {};
    this.attachShadow({ mode: "open" });
  }

  // Fired by the host when editor config changes → re-render.
  onConfigurationUpdate(newConfig) {
    this.configuration = newConfig || {};
    const container = this.shadowRoot?.firstElementChild;
    if (container) {
      container.innerHTML = "";
      this._renderInto(container);
    }
  }

  connectedCallback() {
    const container = document.createElement("div");
    this.shadowRoot.appendChild(container);
    this._renderInto(container);
  }

  // ============================================================
  // TIMEZONE — Cvent maps some zones to DST-stripped IANA zones.
  // Only remap DST-stripped zones for regions that DO observe DST.
  // Verify each mapping empirically. See Playbook §2.
  // ============================================================
  _tzNormalize(raw) {
    const MAP = {
      "Atlantic/Reykjavik": "Europe/London", // Cvent "London" → needs BST
      // add more only after confirming via getEventInfo()
    };
    return (raw && MAP[raw]) || raw;
  }

  // ============================================================
  // LANGUAGE — the runtime selector lives in <html lang>, NOT the
  // event default. Fall back to event default, then English.
  // See Playbook §3.
  // ============================================================
  _mapLang(code) {
    const c = (code || "").toLowerCase();
    if (c.startsWith("es")) return "es";
    if (c.startsWith("pt")) return "pt";
    if (c.startsWith("en")) return "en";
    return null;
  }
  _dateLocale() {
    const l = this._lang || "en";
    return l === "es" ? "es" : l === "pt" ? "pt-BR" : "en-US";
  }
  _capFirst(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }

  // ============================================================
  // CUSTOM FIELDS — your extension mechanism. Match name
  // case-insensitively + trimmed. See Playbook §6.
  // ============================================================
  _getCustomField(session, name) {
    return session?.sessionCustomFields?.find(
      (f) => f.name?.trim().toLowerCase() === name.trim().toLowerCase()
    );
  }
  _getCustomFieldValues(session, name) {
    const f = this._getCustomField(session, name);
    return Array.isArray(f?.value)
      ? f.value.filter((v) => typeof v === "string" && v.trim())
      : [];
  }

  async _renderInto(container) {
    const cfg = this.configuration || {};
    const theme = this.theme || {};

    // ---- Event info: timezone + language ----
    let eventTz = "America/New_York";
    let lang = "en";
    try {
      const info = await this.cventSdk.getEventInfo?.();
      eventTz = this._tzNormalize(info?.timezone) || eventTz;
      const def = (info?.locales || []).find((l) => l.isDefault) ||
        (info?.locales || [])[0];
      lang =
        this._mapLang(document.documentElement.lang) ||
        this._mapLang(def?.cultureCode) ||
        "en";
    } catch (e) {
      console.warn("getEventInfo error:", e);
    }
    this._eventTz = eventTz;
    this._lang = lang;

    // ---- Fetch items (example: sessions) ----
    const items = await this._fetchItems(cfg);

    // ---- Render each item via the component element ----
    items.forEach((item) => {
      container.appendChild(this._renderItem(item, theme, cfg));
    });
  }

  // Replace with your real data fetch (e.g. getSessionGenerator).
  async _fetchItems(cfg) {
    return [];
  }

  // The widget↔component handshake: set props BEFORE append.
  // BOTH files must be current for this to work. See Playbook §4.
  _renderItem(item, theme, cfg) {
    const el = document.createElement(ITEM_TAG);
    el.item = item;
    el.theme = theme;
    el.config = {
      ...cfg,
      eventTz: this._eventTz,
      lang: this._lang,
      // pass any hydration functions or shared data here
    };
    return el;
  }
}

customElements.define("my-custom-widget", MyWidget);
