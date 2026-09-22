/* v0.3.50: Approved vertical Totalplay logo with white 'Total' text. */
import './totalplay-stb-v0349.js?v=0.3.50';

const TP50_POPUP = customElements.get('totalplay-stb-popup-card');
const TP50_CARD = customElements.get('totalplay-stb-card');
if (!TP50_POPUP || !TP50_CARD) throw new Error('Totalplay card types unavailable');

const TP50_VERTICAL_URL = '/totalplay_stb/artwork/brand/vertical?v=0.3.50';

const tp50PreviousPopupConfig = TP50_POPUP.prototype.setConfig;
TP50_POPUP.prototype.setConfig = function(config) {
  tp50PreviousPopupConfig.call(this, config);
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
  image.src = TP50_VERTICAL_URL;
  current.replaceWith(image);
};

const tp50PreviousCardConfig = TP50_CARD.prototype.setConfig;
TP50_CARD.prototype.setConfig = function(config) {
  tp50PreviousCardConfig.call(this, config);
  this.shadowRoot?.querySelector('.tp-version-badge')?.replaceChildren('v0.3.50');
};
