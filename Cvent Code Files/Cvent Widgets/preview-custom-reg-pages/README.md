# Local preview — Registration pages widget

Serve the widgets folder and open this preview:

    python3 -m http.server 8765 --directory "Cvent Code Files/Cvent Widgets"
    open http://localhost:8765/preview-custom-reg-pages/

Left: the real `editor.js`. Right: the real `widget.js` inside `frame.html`, a
stand-in for Cvent's registration page (step 2) built with Cvent's real class
names, so the injected form stylesheet (`reg-form-css.js`) applies to it too.
Each copy lands where it would sit in Cvent: banner in the header region, side
panel beside the form, confirmation above it. Open `frame.html?all=1` to see all
three modes at once. The mock SDK adds `observe`/`read` for FIRSTNAME and
EMAIL_ADDRESS (`__preview.setPerson({FIRSTNAME: "Ana"})` in the frame console).

Data: `data/reg-pages-dump.json` (AI in Finance Summit event info).
The fake page is an approximation: always confirm on the Sandbox registration
pages, including the Review step and the pending-approval page.
