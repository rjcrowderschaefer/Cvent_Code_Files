/**
 * Cvent Custom Widget — component element (skeleton, "ITEM.js")
 * Renders a single item. Owns its OWN shadow root + <style> block — CSS here is
 * NOT shared with the widget or other components. See Playbook §5.
 *
 * IMPORTANT: keep this file in sync with widget.js. The handshake (widget sets
 * el.item/theme/config before append; this reads them in connectedCallback)
 * breaks if either file is a stale version. See Playbook §4.
 */

export default class MyWidgetItem extends HTMLElement {
  constructor() {
    super();
    this.item = {};
    this.theme = {};
    this.config = {};
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    const cfg = this.config || {};
    const item = this.item || {};
    const tz = cfg.eventTz || "America/New_York";

    // ---- Styles: static CSS in a <style> block (classes), not inline. ----
    const style = document.createElement("style");
    style.textContent = `
      :host { display: block; font-family: inherit; }
      .card { border: 0.5px solid #ccc; border-radius: 10px; padding: 12px; }
      .title { font-size: 16px; font-weight: 700; }
      .time { font-size: 12px; color: #666; }
      .bio p { margin: 0 0 10px 0; }
      .bio p:last-child { margin-bottom: 0; }
    `;
    this.shadowRoot.append(style);

    const card = document.createElement("div");
    card.classList.add("card");

    // ---- Title ----
    const title = document.createElement("div");
    title.classList.add("title");
    title.textContent = item.name || "";
    card.append(title);

    // ---- Time: ALWAYS format with an explicit timeZone (Playbook §2). ----
    if (item.startDateTime) {
      const time = document.createElement("div");
      time.classList.add("time");
      const fmt = (iso) =>
        new Date(iso).toLocaleString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          timeZone: tz,
        });
      time.textContent =
        fmt(item.startDateTime) +
        (item.endDateTime ? `–${fmt(item.endDateTime)}` : "");
      card.append(time);
    }

    this.shadowRoot.append(card);
  }

  // Bios come as plain text with \r\n\r\n paragraph breaks — convert to HTML
  // or innerHTML collapses them. See Playbook §8.
  _formatBioHtml(raw) {
    const bio = (raw || "").toString();
    if (!bio.trim()) return "";
    if (/<(p|br|div|ul|ol|li)\b/i.test(bio)) return bio; // already HTML
    return bio
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
      .join("");
  }

  // Inline-SVG icon helper — recolorable, immune to Cvent global CSS (which can
  // override attribute-based fill/stroke). Set fill/stroke as INLINE styles.
  // See Playbook §5.
  _iconSvg(pathD, color, size = 12) {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    Object.assign(svg.style, {
      width: `${size}px`,
      height: `${size}px`,
      fill: "none",
      stroke: color,
      strokeWidth: "2px",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      flexShrink: "0",
      display: "block",
    });
    const path = document.createElementNS(ns, "path");
    path.setAttribute("d", pathD);
    Object.assign(path.style, { fill: "none", stroke: color });
    svg.appendChild(path);
    return svg;
  }
}

customElements.define("my-widget-item", MyWidgetItem);
