(function () {
  const DEFAULT_IFRAME_URL = "https://professional.bloomberg.com/explore/pro-tips-hub-form/";
  let attempts = 0;
  const maxAttempts = 20;

  function initContactWidget() {
    // Hard stop: If the widget already exists, do nothing
    if (document.getElementById("bbg-contact-widget")) {
      return;
    }

    attempts++;

    // 1. Search for the main button container
    const buttonContainer = document.querySelector(".bbg-contact-button");
    console.log(`[ContactWidget] Attempt #${attempts}: Searching for ".bbg-contact-button"...`);

    // If the container isn't found yet, retry
    if (!buttonContainer) {
      if (attempts >= maxAttempts) {
        console.warn(`[ContactWidget] Button container not found after ${maxAttempts} attempts.`);
        return;
      }
      setTimeout(initContactWidget, 500);
      return;
    }

    // 2. Locate the anchor link INSIDE the button container
    const ctaLink = buttonContainer.querySelector(".bbg-contact-cta a");

    // Extract the href, or fall back to the default URL if it's somehow missing
    const dynamicIframeUrl = ctaLink ? ctaLink.getAttribute("href") : DEFAULT_IFRAME_URL;
    console.log(`[ContactWidget] Found link! Using URL: ${dynamicIframeUrl}`);

    // Double-check guard right before appending to prevent race condition duplicates
    if (document.getElementById("bbg-contact-widget")) return;

    const spacer = document.createElement("div");
    spacer.className = "bbg-contact-spacer";
    spacer.setAttribute("aria-hidden", "true");

    const widget = document.createElement("div");
    widget.id = "bbg-contact-widget";
    widget.innerHTML = `
      <div class="custom-css-scope">
        <div class="bbg-demo-overlay" aria-hidden="true">
          <section class="bbg-demo-panel" role="dialog" aria-modal="true" aria-label="Request a demo">
            <header class="bbg-demo-header">
              <div class="bbg-demo-title">
                <strong>Contact Sales</strong>
                <span>Request a Bloomberg demo</span>
              </div>
              <button class="bbg-demo-close" type="button" aria-label="Close request demo form">&times;</button>
            </header>
            <iframe
              class="bbg-demo-frame"
              title="Bloomberg request demo form"
              src="${dynamicIframeUrl}"
              loading="lazy"
              referrerpolicy="strict-origin-when-cross-origin"
            ></iframe>
          </section>
        </div>
      </div>
    `;

    document.body.appendChild(spacer);
    document.body.appendChild(widget);

    // 3. Build the "minimize" control that lives on the floating button itself
    //    (separate from the modal close button above). Clicking it collapses
    //    the button down to a small "Have questions?" pill; clicking that pill
    //    restores it to its original size/position.
    const minimizeToggle = document.createElement("button");
    minimizeToggle.type = "button";
    minimizeToggle.className = "bbg-contact-minimize-toggle";
    minimizeToggle.setAttribute("aria-label", "Minimize contact widget");
    minimizeToggle.textContent = "-"; // plain ASCII hyphen (avoids encoding issues on paste)

    const minimizedLabel = document.createElement("span");
    minimizedLabel.className = "bbg-contact-minimized-label";
    minimizedLabel.innerHTML = `
      <span class="bbg-contact-minimized-icon" aria-hidden="true">&#128172;</span>
      <span>Have questions?</span>
    `;

    buttonContainer.appendChild(minimizeToggle);
    buttonContainer.appendChild(minimizedLabel);

    function setMinimized(minimized) {
      buttonContainer.classList.toggle("is-minimized", minimized);
    }

    minimizeToggle.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation(); // don't let this bubble up and open the modal
      setMinimized(true);
    });

    const overlay = widget.querySelector(".bbg-demo-overlay");
    const close = widget.querySelector(".bbg-demo-close");

    function openDemo() {
      overlay.classList.add("is-open");
      overlay.setAttribute("aria-hidden", "false");
      buttonContainer.setAttribute("aria-expanded", "true");
      document.body.style.overflow = "hidden";
      close.focus();
    }

    function closeDemo() {
      overlay.classList.remove("is-open");
      overlay.setAttribute("aria-hidden", "true");
      buttonContainer.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
      buttonContainer.focus();
    }

    // 4. Attach the click event to the main container
    buttonContainer.addEventListener("click", function (event) {
      // Prevent the default anchor link behavior (opening a new tab)
      event.preventDefault();

      // If the widget is minimized, the first click just restores it
      if (buttonContainer.classList.contains("is-minimized")) {
        setMinimized(false);
        return;
      }

      openDemo();
    });

    close.addEventListener("click", closeDemo);

    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) closeDemo();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && overlay.classList.contains("is-open")) {
        closeDemo();
      }
    });
  }

  // Kick off the initial search
  initContactWidget();
})();
