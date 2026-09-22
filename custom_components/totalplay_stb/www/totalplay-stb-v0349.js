/* v0.3.49: Approved vertical Totalplay logo with white 'Total' text. */
import './totalplay-stb-v0348.js?v=0.3.49';

const TP49_POPUP = customElements.get('totalplay-stb-popup-card');
const TP49_CARD = customElements.get('totalplay-stb-card');
if (!TP49_POPUP || !TP49_CARD) throw new Error('Totalplay card types unavailable');

const TP49_VERTICAL_URL = '/totalplay_stb/artwork/brand/vertical?v=0.3.49';

const tp49PreviousPopupConfig = TP49_POPUP.prototype.setConfig;
TP49_POPUP.prototype.setConfig = function(config) {
  tp49PreviousPopupConfig.call(this, config);
  if (config?.popup_button_style !== 'vertical_logo') return;

  const current = this.shadowRoot?.querySelector('.tp44-brand .tp44-vertical_logo-image');
  if (!current) return;

  const image = current.cloneNode(false);
  image.onerror = () => {
    if (!image.isConnected) return;
    const fallback = document.createElement('span');
    fallback.className = 'tp42-wordmark-fallback';
    fallback.textContent = 'Totalplay';
    image.replaceWith(fallback);
  };
  image.src = TP49_VERTICAL_URL;
  current.replaceWith(image);
};

const tp49PreviousCardConfig = TP49_CARD.prototype.setConfig;
TP49_CARD.prototype.setConfig = function(config) {
  tp49PreviousCardConfig.call(this, config);
  this.shadowRoot?.querySelector('.tp-version-badge')?.replaceChildren('v0.3.49');
};
