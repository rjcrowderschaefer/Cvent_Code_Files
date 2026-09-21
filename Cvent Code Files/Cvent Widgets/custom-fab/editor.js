// Editor UI shown to the Cvent planner in Site Designer when they add or
// select this widget.
//
// Note: the two forms are mocked - they validate and confirm but post
// nowhere. There is deliberately no endpoint field yet; add one here (and
// the matching fetch in widget.js) once a destination is agreed.

const FIELDS = [
  { group: "Button" },
  {
    key: "hintText",
    label: "Hover hint",
    placeholder: "Connect with Bloomberg",
    hint: "Appears above the button on hover, and is the button's screen-reader label.",
  },
  { group: "Menu options" },
  { key: "demoLabel", label: "Option 1", placeholder: "Request a demo" },
  { key: "contactLabel", label: "Option 2", placeholder: "Contact Bloomberg" },
  { key: "questionLabel", label: "Option 3", placeholder: "Submit a question" },
  { group: "Contact panel" },
  { key: "phoneAmericas", label: "Americas phone", placeholder: "+1 212 318 2000" },
  { key: "phoneEmea", label: "EMEA phone", placeholder: "+44 20 7330 7500" },
  { key: "phoneApac", label: "Asia Pacific phone", placeholder: "+65 6212 1000" },
  { key: "eventEmail", label: "Event team email", placeholder: "events@bloomberg.net" },
  {
    key: "supportUrl",
    label: "Customer support URL",
    placeholder: "https://professional.bloomberg.com/support/customer-support/",
    hint: "Behind the 'Already a customer?' card. Opens in a new tab.",
  },
  { group: "Dropdown options" },
  {
    key: "demoAreas",
    label: "Areas of interest",
    placeholder: "Market data, Trading solutions, Risk",
    multiline: true,
    hint: "Comma-separated. Fills the 'Area of interest' dropdown on the demo form.",
  },
  {
    key: "questionTopics",
    label: "Question topics",
    placeholder: "Fixed income, Macro & policy",
    multiline: true,
    hint: "Comma-separated. Should mirror this event's themes so questions route to the right moderator.",
  },
  {
    key: "countries",
    label: "Countries",
    placeholder: "United States, United Kingdom",
    multiline: true,
    hint: "Comma-separated. Fills the 'Country' dropdown on the demo form.",
  },
  { group: "Attention nudge" },
  {
    key: "nudgeEnabled",
    type: "checkbox",
    default: true,
    label: "Nudge scrolling visitors",
    hint: "After the visitor scrolls, the button pings and briefly shows its hint. Stops for good once they hover or open it.",
  },
  {
    key: "nudgeCount",
    label: "How many times",
    placeholder: "3",
    hint: "Set to 0 to disable.",
  },
  {
    key: "nudgeIntervalSeconds",
    label: "Seconds between nudges",
    placeholder: "12",
    hint: "Minimum 3.",
  },
  {
    key: "nudgeCtaText",
    label: "Nudge CTA text",
    placeholder: "Request a demo",
    hint: "Revealed when the button expands leftwards during a nudge.",
  },
  { group: "Tracking" },
  {
    key: "tacticId",
    label: "Tactic ID",
    placeholder: "e.g. 123456",
    hint: "Stored with the widget for when the forms are connected to a destination. Not yet sent anywhere.",
  },
];

const EDITOR_CSS = `
  :host { all: initial; }
  * { box-sizing: border-box; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
  .editor { padding: 4px 2px; }
  .banner {
    margin: 0 0 16px; padding: 10px 12px; border-radius: 6px;
    background: #fff4f2; border: 1px solid #f0c3bc;
    font-size: 12px; line-height: 1.45; color: #8a2b1d;
  }
  .group {
    margin: 22px 0 10px; padding-bottom: 6px; border-bottom: 1px solid #e6e9ee;
    font-size: 11px; font-weight: 700; letter-spacing: .08em;
    text-transform: uppercase; color: #6b6f76;
  }
  .group:first-of-type { margin-top: 4px; }
  .field { margin-bottom: 14px; }
  .field label { display: block; font-size: 13px; font-weight: 600; color: #1a1a1a; margin-bottom: 4px; }
  .field input, .field textarea {
    width: 100%; padding: 8px 10px; font-size: 14px; color: #1a1a1a; font-family: inherit;
    border: 1px solid #ccced1; border-radius: 6px; outline: none;
    transition: border-color 120ms ease, box-shadow 120ms ease;
  }
  .field textarea { min-height: 72px; resize: vertical; line-height: 1.45; }
  .field input:focus, .field textarea:focus {
    border-color: #0062dd; box-shadow: 0 0 0 3px rgba(0, 98, 221, 0.15);
  }
  .field .hint { margin-top: 4px; font-size: 12px; color: #6b6f76; line-height: 1.4; }
  .field.check { display: grid; grid-template-columns: auto 1fr; gap: 4px 8px; align-items: center; }
  .field.check label { order: 2; margin: 0; }
  .field.check input { order: 1; width: 16px; height: 16px; padding: 0; accent-color: #0062dd; }
  .field.check .hint { order: 3; grid-column: 2; margin-top: 0; }
`;

export default class BbgContactWidgetEditor extends HTMLElement {
  constructor({ initialConfiguration, setConfiguration }) {
    super();
    this.configuration = initialConfiguration || {};
    this.setConfiguration = setConfiguration;
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this.render();
  }

  // Called by Cvent when the configuration changes elsewhere (e.g. another
  // editor instance, or an initial load after the panel was already open).
  onConfigurationUpdate(newConfiguration) {
    this.configuration = newConfiguration || {};
    this.render();
  }

  render() {
    const root = this.shadowRoot;
    root.innerHTML = "";

    const style = document.createElement("style");
    style.textContent = EDITOR_CSS;
    root.appendChild(style);

    const container = document.createElement("div");
    container.className = "editor";

    const banner = document.createElement("p");
    banner.className = "banner";
    banner.innerHTML =
      "<strong>Forms are a preview.</strong> Request a demo and Submit a question validate and " +
      "show a confirmation, but send nothing anywhere. Connect a destination before publishing.";
    container.appendChild(banner);

    FIELDS.forEach((field) => {
      if (field.group) {
        const g = document.createElement("div");
        g.className = "group";
        g.textContent = field.group;
        container.appendChild(g);
        return;
      }

      const wrap = document.createElement("div");
      wrap.className = field.type === "checkbox" ? "field check" : "field";

      const label = document.createElement("label");
      label.textContent = field.label;
      label.setAttribute("for", "f-" + field.key);
      wrap.appendChild(label);

      const input = document.createElement(field.multiline ? "textarea" : "input");
      if (field.type === "checkbox") input.type = "checkbox";
      else if (!field.multiline) input.type = "text";
      input.id = "f-" + field.key;
      input.placeholder = field.placeholder || "";
      if (field.type === "checkbox") {
        // Default-on settings must treat "undefined" as true, or the box
        // would read as unchecked while the widget behaves as enabled.
        const v = this.configuration[field.key];
        input.checked = v === undefined ? field.default !== false : v !== false;
      } else {
        input.value = this.configuration[field.key] || "";
      }
      // Cvent's editor contract: the Backspace key can be swallowed by the
      // host panel in some layouts, so stop it from bubbling past the input.
      input.addEventListener("keydown", (event) => {
        if (event.key === "Backspace") event.stopPropagation();
      });
      input.addEventListener(field.type === "checkbox" ? "change" : "input", () => {
        const value = field.type === "checkbox" ? input.checked : input.value;
        this.configuration = Object.assign({}, this.configuration, { [field.key]: value });
        this.setConfiguration(this.configuration);
      });
      wrap.appendChild(input);

      if (field.hint) {
        const hint = document.createElement("div");
        hint.className = "hint";
        hint.textContent = field.hint;
        wrap.appendChild(hint);
      }

      container.appendChild(wrap);
    });

    root.appendChild(container);
  }
}
