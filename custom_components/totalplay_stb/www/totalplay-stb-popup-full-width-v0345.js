/* v0.3.45: Fill the available Lovelace card width in every popup trigger mode.
 * The logo artwork keeps its own intrinsic proportions and remains centered;
 * icon + text retains its left-aligned contents.
 */
const TP45_POPUP = customElements.get('totalplay-stb-popup-card');
if (!TP45_POPUP) throw new Error('Totalplay popup card unavailable');

const TP45_FULL_WIDTH_STYLE = `
  :host {
    display: block;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    box-sizing: border-box;
  }
  :host([data-popup-brand]) ha-card {
    display: block;
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    box-sizing: border-box;
  }
  :host([data-popup-brand]) button,
  :host([data-popup-brand="vertical_logo"]) button {
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    box-sizing: border-box;
  }
  :host([data-popup-brand="horizontal_logo"]) button,
  :host([data-popup-brand="vertical_logo"]) button,
  :host([data-popup-brand="icon"][data-popup-icon-text="no"]) button {
    justify-content: center;
  }
  :host([data-popup-brand="icon"][data-popup-icon-text="yes"]) button {
    justify-content: flex-start;
  }
  :host([data-popup-brand]) .tp44-brand-image {
    max-width: 100%;
    object-fit: contain;
  }
`;

const tp45PreviousConfig = TP45_POPUP.prototype.setConfig;
TP45_POPUP.prototype.setConfig = function(config) {
  tp45PreviousConfig.call(this, config);
  const root = this.shadowRoot;
  if (!root || root.querySelector('#tp45-popup-full-width')) return;
  const style = document.createElement('style');
  style.id = 'tp45-popup-full-width';
  style.textContent = TP45_FULL_WIDTH_STYLE;
  root.appendChild(style);
};
