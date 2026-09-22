/* v0.3.46: Use the user's transparent, packaged Totalplay icon in Icon mode.
 * Keep the wide trigger and all guide/popup settings from v0.3.45.
 */
import './totalplay-stb-v0345.js?v=0.3.46';

const TP46_POPUP = customElements.get('totalplay-stb-popup-card');
const TP46_CARD = customElements.get('totalplay-stb-card');
if (!TP46_POPUP || !TP46_CARD) throw new Error('Totalplay card types unavailable');

const TP46_ICON_URL = '/totalplay_stb/artwork/brand/icon?v=0.3.46';
const TP46_ICON_CSS = `
  :host([data-popup-brand="icon"]) .tp44-icon-image {
    width: 46px; height: 46px; max-width: 100%;
    object-fit: contain; border-radius: 0 !important;
    background: transparent !important;
  }
`;
const tp46PreviousPopupConfig = TP46_POPUP.prototype.setConfig;
TP46_POPUP.prototype.setConfig = function(config) {
  tp46PreviousPopupConfig.call(this, config);
  if (config?.popup_button_style !== 'icon') return;
  // Respect an explicitly chosen Home Assistant icon.
  if (/^(?:mdi|hass|hacs):[a-z0-9][a-z0-9-]*$/i.test(String(config.popup_icon || '').trim())) return;
  const root = this.shadowRoot;
  const previous = root?.querySelector('.tp44-brand .tp44-icon-image');
  if (!previous) return;
  if (!root.querySelector('#tp46-icon-style')) {
    const style = document.createElement('style');
    style.id = 'tp46-icon-style';
    style.textContent = TP46_ICON_CSS;
    root.appendChild(style);
  }
  // A fresh element removes the old module's external-image error handler.
  const icon = document.createElement('img');
  icon.className = previous.className;
  icon.alt = '';
  icon.decoding = 'async';
  icon.loading = 'eager';
  icon.onerror = () => {
    const fallback = document.createElement('span');
    fallback.textContent = '▶';
    fallback.className = 'tp42-wordmark-fallback';
    if (icon.isConnected) icon.replaceWith(fallback);
  };
  previous.replaceWith(icon);
  icon.src = TP46_ICON_URL;
};

const tp46PreviousCardConfig = TP46_CARD.prototype.setConfig;
TP46_CARD.prototype.setConfig = function(config) {
  tp46PreviousCardConfig.call(this, config);
  this.shadowRoot?.querySelector('.tp-version-badge')?.replaceChildren('v0.3.46');
};
