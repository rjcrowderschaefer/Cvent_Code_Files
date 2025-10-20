// widget.js

class ValidWidget extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
    }
  
    async connectedCallback() {
      const container = this.shadowRoot;
      container.innerHTML = `<p>Loading widget...</p>`;
  
      try {
        const widgetContext = await CventCustomWidget.init();
        const eventObjects = await widgetContext.getEventObjects({
          objects: ["Event", "Session"]
        });
  
        const { Event, Session } = eventObjects;
  
        container.innerHTML = `
          <style>
            h2 { color: #004c97; font-family: Arial, sans-serif; }
            ul { list-style-type: none; padding: 0; }
            li { padding: 4px 0; }
          </style>
          <div>
            <h2>${Event.name}</h2>
            <ul>
              ${Session.map(s => `<li>${s.name}</li>`).join("")}
            </ul>
          </div>
        `;
      } catch (error) {
        container.innerHTML = `<p>Error loading widget data.</p>`;
        console.error("Widget error:", error);
      }
    }
  }
  
  // The name here must match your config.json value
  customElements.define("valid-widget", ValidWidget);
  