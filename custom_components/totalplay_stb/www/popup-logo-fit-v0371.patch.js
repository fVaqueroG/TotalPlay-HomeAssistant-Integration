/* Totalplay v0.3.71: keep the vertical popup logo fully inside its trigger. */
(() => {
  const Popup = customElements.get('totalplay-stb-popup-card');
  const Card = customElements.get('totalplay-stb-card');
  if (!Popup || !Card) throw new Error('Totalplay popup logo: card components unavailable');

  const TP71_LOGO_CSS = `
    :host([data-popup-brand="vertical_logo"]) .tp56-vertical-wrap {
      min-height:100px !important;
      overflow:visible !important;
    }
    :host([data-popup-brand="vertical_logo"]) .tp56-vertical-logo {
      display:block !important;
      width:auto !important;
      height:100px !important;
      max-width:calc(100% - 16px) !important;
      max-height:100px !important;
      object-fit:contain !important;
      object-position:center !important;
      transform:none !important;
      transform-origin:center !important;
    }
  `;

  const previousPopupConfig = Popup.prototype.setConfig;
  Popup.prototype.setConfig = function(config) {
    previousPopupConfig.call(this, config);
    if (config?.popup_button_style !== 'vertical_logo') return;
    const root = this.shadowRoot;
    if (!root || root.querySelector('#tp71-popup-logo-fit')) return;
    const style = document.createElement('style');
    style.id = 'tp71-popup-logo-fit';
    style.textContent = TP71_LOGO_CSS;
    root.appendChild(style);
  };

  const previousCardConfig = Card.prototype.setConfig;
  Card.prototype.setConfig = function(config) {
    previousCardConfig.call(this, config);
    this.shadowRoot?.querySelector('.tp-version-badge')?.replaceChildren('v0.3.71');
  };
})();
