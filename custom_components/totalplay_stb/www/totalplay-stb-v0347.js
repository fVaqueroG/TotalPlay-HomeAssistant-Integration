/* v0.3.47: finalized bundled Totalplay popup icon asset. */
import './totalplay-stb-v0346.js?v=0.3.47';

const TP47_POPUP = customElements.get('totalplay-stb-popup-card');
const TP47_CARD = customElements.get('totalplay-stb-card');
if (!TP47_POPUP || !TP47_CARD) throw new Error('Totalplay card types unavailable');

const tp47PreviousPopupConfig = TP47_POPUP.prototype.setConfig;
TP47_POPUP.prototype.setConfig = function (config) {
  tp47PreviousPopupConfig.call(this, config);
  // Revalidate image requests for the fixed bundled asset after the v0.3.46
  // release included an incomplete encoded image.
  if (config?.popup_button_style !== 'icon') return;
  if (/^(?:mdi|hass|hacs):[a-z0-9][a-z0-9-]*$/i.test(String(config.popup_icon || '').trim())) return;
  const image = this.shadowRoot?.querySelector('.tp44-brand .tp44-icon-image');
  if (image) image.src = '/totalplay_stb/artwork/brand/icon?v=0.3.47';
};

const tp47PreviousCardConfig = TP47_CARD.prototype.setConfig;
TP47_CARD.prototype.setConfig = function (config) {
  tp47PreviousCardConfig.call(this, config);
  this.shadowRoot?.querySelector('.tp-version-badge')?.replaceChildren('v0.3.47');
};
