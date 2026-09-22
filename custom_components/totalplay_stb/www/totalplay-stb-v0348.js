/* v0.3.48: Use the exact user-uploaded Totalplay icon asset. */
import './totalplay-stb-v0347.js?v=0.3.48';

const TP48_POPUP = customElements.get('totalplay-stb-popup-card');
const TP48_CARD = customElements.get('totalplay-stb-card');
if (!TP48_POPUP || !TP48_CARD) throw new Error('Totalplay card types unavailable');

const TP48_ICON_URL = '/totalplay_stb/artwork/brand/icon?v=0.3.48';

const tp48PreviousPopupConfig = TP48_POPUP.prototype.setConfig;
TP48_POPUP.prototype.setConfig = function(config) {
  tp48PreviousPopupConfig.call(this, config);
  if (config?.popup_button_style !== 'icon') return;
  if (/^(?:mdi|hass|hacs):[a-z0-9][a-z0-9-]*$/i.test(String(config.popup_icon || '').trim())) return;

  const current = this.shadowRoot?.querySelector('.tp44-brand .tp44-icon-image');
  if (!current) return;

  const image = current.cloneNode(false);
  image.src = TP48_ICON_URL;
  image.onerror = () => {
    if (!image.isConnected) return;
    const fallback = document.createElement('span');
    fallback.className = 'tp42-wordmark-fallback';
    fallback.textContent = '▶';
    image.replaceWith(fallback);
  };
  current.replaceWith(image);
};

const tp48PreviousCardConfig = TP48_CARD.prototype.setConfig;
TP48_CARD.prototype.setConfig = function(config) {
  tp48PreviousCardConfig.call(this, config);
  this.shadowRoot?.querySelector('.tp-version-badge')?.replaceChildren('v0.3.48');
};
