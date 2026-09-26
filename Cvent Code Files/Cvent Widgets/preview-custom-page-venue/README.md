# Local preview — Venue page widget

Serve the widgets folder and open this preview:

    python3 -m http.server 8765 --directory "Cvent Code Files/Cvent Widgets"
    open http://localhost:8765/preview-custom-page-venue/

Left: the real `editor.js`. Right: the real `widget.js` in a device-sized frame,
against the mock SDK fed by `data/page-venue-dump.json` (AI in Finance Summit).
First run seeds the editor with `data/example-config.json`; "reset config" returns to it.
Images and the Google map need network access to custom.cvent.com / maps.google.com.
