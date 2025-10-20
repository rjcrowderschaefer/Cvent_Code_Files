CventCustomWidget.registerEditor("valid-widget", {
    render(container, config) {
      container.innerHTML = "<p>This widget has no configurable options.</p>";
    },
    save() {
      return {};
    }
  });
  