/* v0.3.54: Restore the actual approved white-lettered vertical artwork.
 * Preserve existing full-width trigger, icon/horizontal modes, guide,
 * popup-size choices and automatic close from v0.3.51.
 */
import './totalplay-stb-v0353.js?v=0.3.54';

const TP54_POPUP = customElements.get('totalplay-stb-popup-card');
const TP54_FULL = customElements.get('totalplay-stb-card');
if (!TP54_POPUP || !TP54_FULL) throw new Error('Totalplay card types unavailable');
const TP54_VERTICAL_URL = '/totalplay_stb/artwork/brand/vertical?v=0.3.54';
const tp54PreviousPopupConfig = TP54_POPUP.prototype.setConfig;
TP54_POPUP.prototype.setConfig = function(config) {
  tp54PreviousPopupConfig.call(this, config);
  if (config?.popup_button_style !== 'vertical_logo') return;
  const image = this.shadowRoot?.querySelector('.tp53-brand .tp53-logo');
  if (image) {
    // The new URL bypasses the previous version's cached, malformed PNG.
    image.src = TP54_VERTICAL_URL;
  }
};
const tp54PreviousFullConfig = TP54_FULL.prototype.setConfig;
TP54_FULL.prototype.setConfig = function(config) {
  tp54PreviousFullConfig.call(this, config);
  this.shadowRoot?.querySelector('.tp-version-badge')?.replaceChildren('v0.3.54');
};
