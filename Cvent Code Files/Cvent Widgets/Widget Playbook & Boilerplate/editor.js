/**
 * Cvent Custom Widget — editor.js (skeleton)
 * Builds the settings panel. `_patch(partial)` merges into config and calls the
 * host's setConfiguration, which propagates to the widget (re-render).
 *
 * Key pattern: gate NEW/behavioral features behind a toggle that defaults OFF,
 * so existing events are unchanged until a planner opts in. See Playbook §7.
 */

export default class MyWidgetEditor extends HTMLElement {
  constructor() {
    super();
    // setConfiguration is provided by the host.
    const incoming = this.configuration || {};
    const defaults = this._getDefaultConfig();
    this._config = {
      ...defaults,
      ...incoming,
      // Deep-merge nested objects so a partial incoming config doesn't wipe
      // unset keys (Playbook §7).
      typography: { ...(defaults.typography || {}), ...(incoming.typography || {}) },
    };
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this._render();
  }

  onConfigurationUpdate(newConfig) {
    const defaults = this._getDefaultConfig();
    const incoming = newConfig || {};
    this._config = {
      ...defaults,
      ...incoming,
      typography: { ...(defaults.typography || {}), ...(incoming.typography || {}) },
    };
    this._render();
  }

  // ---- Defaults. New behavioral features default to false/off. ----
  _getDefaultConfig() {
    return {
      exampleFeatureEnabled: false, // opt-in; existing events unaffected
      exampleColor: "#f7a325",
      typography: this._makeDefaultTypography(),
    };
  }

  _makeDefaultTypography() {
    const base = { fontSize: 14, color: "#000000", bold: false, italic: false };
    return {
      title: { ...base, fontSize: 17, bold: true },
      body: { ...base, fontSize: 13 },
    };
  }

  // ---- Merge a partial into config and propagate to the widget. ----
  _patch(patch) {
    const merged = { ...this._config, ...patch };
    if (patch.typography) {
      merged.typography = {
        ...(this._config.typography || {}),
        ...patch.typography,
      };
    }
    this._config = merged;
    this.setConfiguration(this._config); // host propagates → widget re-renders
  }

  // ---- Small helpers (replace with your design system's controls) ----
  _label(text) {
    const l = document.createElement("label");
    l.textContent = text;
    l.style.fontSize = "12px";
    l.style.fontWeight = "600";
    return l;
  }
  _checkbox(text, checked, onChange) {
    const wrap = document.createElement("label");
    wrap.style.display = "inline-flex";
    wrap.style.alignItems = "center";
    wrap.style.gap = "6px";
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = !!checked;
    cb.onchange = () => onChange(cb.checked);
    wrap.append(cb, document.createTextNode(text));
    return wrap;
  }

  _render() {
    this.shadowRoot.innerHTML = "";
    const panel = document.createElement("div");
    panel.style.padding = "12px";

    // Example: an opt-in feature toggle (defaults OFF).
    panel.append(
      this._checkbox(
        "Enable example feature",
        this._config.exampleFeatureEnabled === true,
        (v) => this._patch({ exampleFeatureEnabled: v })
      )
    );

    // NOTE on <select> in a re-rendering panel: use onchange (fires on commit),
    // not oninput, or the re-render steals focus. See Playbook §7.

    this.shadowRoot.append(panel);
  }
}

customElements.define("my-custom-widget-editor", MyWidgetEditor);
