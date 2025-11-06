class AgendaWithSpeakersEditor extends HTMLElement {
  constructor({ setConfiguration, initialConfiguration }) {
    super();
    this.setConfiguration = setConfiguration;

    const defaults = {
      sort: 'dateTimeAsc',           // 'dateTimeAsc' | 'dateTimeDesc' | 'nameAsc'
      maxResults: 100,               // 10–300
      groupByDay: true,
      showDescription: false,
      // Typography controls: undefined => use event theme defaults
      typography: {
        eventDate:           { fontSize: undefined, color: undefined, bold: undefined, italic: undefined, underline: undefined },
        sessionName:         { fontSize: undefined, color: undefined, bold: undefined, italic: undefined, underline: undefined },
        sessionTime:         { fontSize: undefined, color: undefined, bold: undefined, italic: undefined, underline: undefined },
        sessionDescription:  { fontSize: undefined, color: undefined, bold: undefined, italic: undefined, underline: undefined },
        speakerName:         { fontSize: undefined, color: undefined, bold: undefined, italic: undefined, underline: undefined },
        speakerTitle:        { fontSize: undefined, color: undefined, bold: undefined, italic: undefined, underline: undefined },
        speakerCompany:      { fontSize: undefined, color: undefined, bold: undefined, italic: undefined, underline: undefined }
      }
    };

    this._config = { ...defaults, ...(initialConfiguration || {}) };
    if (!initialConfiguration) this.setConfiguration(this._config);

    this.attachShadow({ mode: 'open' });

    const title = document.createElement('h2');
    title.textContent = 'Agenda Settings v21';
    title.style.fontFamily = 'Rubik';
    title.style.margin = '0 0 8px 0';

    // Sort selector
    const sortLabel = document.createElement('label');
    sortLabel.textContent = 'Sort sessions:';
    sortLabel.style.display = 'block';
    sortLabel.style.fontFamily = 'Rubik';
    sortLabel.style.margin = '8px 0 4px 0';

    const sortSelect = document.createElement('select');
    [
      ['dateTimeAsc',  'Date & time (asc)'],
      ['dateTimeDesc', 'Date & time (desc)'],
      ['nameAsc',      'Name (A→Z)']
    ].forEach(([val, txt]) => {
      const o = document.createElement('option');
      o.value = val; o.textContent = txt;
      if (this._config.sort === val) o.selected = true;
      sortSelect.append(o);
    });
    sortSelect.onchange = () =>
      this.setConfiguration({ ...this._config, sort: sortSelect.value });

    // Max results
    const maxLabel = document.createElement('label');
    maxLabel.textContent = 'Max sessions to show (10–300):';
    maxLabel.style.display = 'block';
    maxLabel.style.fontFamily = 'Rubik';
    maxLabel.style.margin = '8px 0 4px 0';

    const maxInput = document.createElement('input');
    maxInput.type = 'number';
    maxInput.min = '10';
    maxInput.max = '300';
    maxInput.value = this._config.maxResults;
    maxInput.onchange = () => {
      const v = Math.max(10, Math.min(300, Number(maxInput.value) || 100));
      this.setConfiguration({ ...this._config, maxResults: v });
    };

    // Toggles
    const mkToggle = (label, key) => {
      const wrap = document.createElement('label');
      wrap.style.display = 'block';
      wrap.style.fontFamily = 'Rubik';
      wrap.style.margin = '6px 0';
      const i = document.createElement('input');
      i.type = 'checkbox';
      i.checked = !!this._config[key];
      i.onchange = () =>
        this.setConfiguration({ ...this._config, [key]: i.checked });
      const t = document.createElement('span');
      t.textContent = ' ' + label;
      wrap.append(i, t);
      return wrap;
    };

    // Typography controls
    const typoHeader = document.createElement('h3');
    typoHeader.textContent = 'Typography (sizes in px; clear to use event defaults)';
    typoHeader.style.fontFamily = 'Rubik';
    typoHeader.style.margin = '16px 0 8px 0';

    const typoContainer = document.createElement('div');
    typoContainer.style.display = 'grid';
    typoContainer.style.gridTemplateColumns = 'repeat(auto-fit, minmax(260px, 1fr))';
    typoContainer.style.gap = '10px';

    const mkTypographyControls = (key, label) => {
      const block = document.createElement('fieldset');
      block.style.border = '1px solid #ddd';
      block.style.borderRadius = '8px';
      block.style.padding = '8px';
    
      const legend = document.createElement('legend');
      legend.textContent = label;
      legend.style.fontFamily = 'Rubik';
    
      // --- Size ---
      const sizeLabel = document.createElement('label');
      sizeLabel.textContent = 'Font size (px)';
      sizeLabel.style.display = 'block';
    
      const sizeInput = document.createElement('input');
      sizeInput.type = 'number';
      sizeInput.min = '10';
      sizeInput.max = '72';
      sizeInput.placeholder = 'default';
      sizeInput.value = this._config.typography?.[key]?.fontSize ?? '';
      sizeInput.oninput = () => {
        const val = sizeInput.value === ''
          ? undefined
          : Math.max(10, Math.min(72, Number(sizeInput.value) || undefined));
        const t = {
          ...this._config.typography,
          [key]: { ...(this._config.typography?.[key] || {}), fontSize: val }
        };
        this.setConfiguration({ ...this._config, typography: t });
      };
    
      // --- Color ---
      const colorLabel = document.createElement('label');
      colorLabel.textContent = 'Color';
      colorLabel.style.display = 'block';
    
      const colorInput = document.createElement('input');
      colorInput.type = 'color';
      colorInput.value = this._config.typography?.[key]?.color || '#000000';
      colorInput.onchange = () => {
        const val = colorInput.value || undefined;
        const t = {
          ...this._config.typography,
          [key]: { ...(this._config.typography?.[key] || {}), color: val }
        };
        this.setConfiguration({ ...this._config, typography: t });
      };
    
      // --- Style flags: Bold / Italic / Underline ---
      const stylesRow = document.createElement('div');
      stylesRow.style.display = 'flex';
      stylesRow.style.gap = '12px';
      stylesRow.style.margin = '8px 0';
    
      const mkFlag = (flagKey, flagLabel) => {
        const wrap = document.createElement('label');
        wrap.style.display = 'inline-flex';
        wrap.style.alignItems = 'center';
        wrap.style.gap = '6px';
    
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !!this._config.typography?.[key]?.[flagKey];
        cb.onchange = () => {
          const t = {
            ...this._config.typography,
            [key]: {
              ...(this._config.typography?.[key] || {}),
              [flagKey]: cb.checked // true/false; reset button will set undefined
            }
          };
          this.setConfiguration({ ...this._config, typography: t });
        };
    
        const txt = document.createElement('span');
        txt.textContent = flagLabel;
    
        wrap.append(cb, txt);
        return wrap;
      };
    
      stylesRow.append(
        mkFlag('bold', 'Bold'),
        mkFlag('italic', 'Italic'),
        mkFlag('underline', 'Underline')
      );
    
      // --- Reset ---
      const resetBtn = document.createElement('button');
      resetBtn.type = 'button';
      resetBtn.textContent = 'Use event default';
      resetBtn.onclick = () => {
        const t = {
          ...this._config.typography,
          [key]: {
            fontSize: undefined,
            color: undefined,
            bold: undefined,
            italic: undefined,
            underline: undefined
          }
        };
        this.setConfiguration({ ...this._config, typography: t });
        sizeInput.value = '';
        colorInput.value = '#000000';
        // clear checkboxes to reflect "undefined" (theme default)
        stylesRow.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = false; });
      };
    
      block.append(
        legend,
        sizeLabel, sizeInput,
        colorLabel, colorInput,
        stylesRow,
        resetBtn
      );
      return block;
    };    

    const fields = [
      ['eventDate',          'Event Date (day header)'],
      ['sessionName',        'Session Name'],
      ['sessionTime',        'Session Date & Start/End'],
      ['sessionDescription', 'Session Description'],   // NEW
      ['speakerName',        'Speaker Name'],
      ['speakerTitle',       'Speaker Title'],
      ['speakerCompany',     'Speaker Company']
    ];
    fields.forEach(([key, label]) =>
      typoContainer.append(mkTypographyControls(key, label))
    );

    this.shadowRoot.append(
      title,
      sortLabel,
      sortSelect,
      maxLabel,
      maxInput,
      mkToggle('Group sessions by day', 'groupByDay'),
      mkToggle('Show session description', 'showDescription'),
      typoHeader,
      typoContainer
    );
  }

  onConfigurationUpdate(newConfig) {
    this._config = newConfig;
    // (UI persists; no dynamic re-render needed for these simple controls)
  }
}
export default AgendaWithSpeakersEditor;
