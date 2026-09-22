/* Optional logo/icon-only trigger and editor display fixes. */
const TP_LAYOUT_POPUP = customElements.get('totalplay-stb-popup-card');
const TP_LAYOUT_EDITOR = customElements.get('totalplay-stb-popup-card-editor');
if (!TP_LAYOUT_POPUP || !TP_LAYOUT_EDITOR) throw new Error('Totalplay popup options unavailable');

const tpLayoutPreviousConfig = TP_LAYOUT_POPUP.prototype.setConfig;
TP_LAYOUT_POPUP.prototype.setConfig = function (config) {
  tpLayoutPreviousConfig.call(this, config);
  if (!this.shadowRoot) return;
  if (!this.shadowRoot.querySelector('#tp-popup-button-layout-css')) {
    const style = document.createElement('style');
    style.id = 'tp-popup-button-layout-css';
    style.textContent = `
      :host([data-popup-trigger="icon_only"]) ha-card{width:fit-content;min-width:66px;max-width:150px}
      :host([data-popup-trigger="icon_only"]) .tp-p-title,
      :host([data-popup-trigger="icon_only"]) .tp-p-expand{display:none!important}
      :host([data-popup-trigger="icon_only"]) button{justify-content:center;min-width:66px;padding:10px 12px}
      :host([data-popup-trigger="icon_only"]) .tp-p-logo{max-width:none;width:100px;height:31px}
      :host([data-popup-trigger="icon_only"]) .tp-p-icon{width:30px;height:30px}
    `;
    this.shadowRoot.appendChild(style);
  }
  this.setAttribute('data-popup-trigger', config.popup_button_style === 'icon_only' ? 'icon_only' : 'labelled');
  this._button?.setAttribute('aria-label', 'Open Totalplay guide and remote');
};

const tpLayoutPreviousDraw = TP_LAYOUT_EDITOR.prototype._draw;
TP_LAYOUT_EDITOR.prototype._draw = function () {
  tpLayoutPreviousDraw.call(this);
  const group = this.shadowRoot?.querySelector('.tp-popup-fields');
  if (!group) return;
  const conditional = document.createElement('style');
  conditional.textContent = '.tp-custom-dimensions[hidden],input[hidden]{display:none!important}';
  group.prepend(conditional);
  const layout = document.createElement('select');
  for (const [value, text] of [
    ['labelled', 'Logo/icon and label'],
    ['icon_only', 'Logo/icon only (compact tile)'],
  ]) {
    const option = document.createElement('option');
    option.value = value;option.textContent = text;
    layout.appendChild(option);
  }
  layout.value = this._config.popup_button_style === 'icon_only' ? 'icon_only' : 'labelled';
  layout.addEventListener('change', () => this._emit({popup_button_style:layout.value}));
  group.insertBefore(this._field('Button layout', layout, 'The icon-only layout uses your chosen icon, or the Totalplay logo by default.'),group.querySelector('h3')?.nextSibling || null);
};
