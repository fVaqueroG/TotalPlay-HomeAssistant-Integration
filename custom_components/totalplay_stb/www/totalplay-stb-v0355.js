/* v0.3.55: Bundle the checked, approved white-lettered vertical Totalplay logo.
 * Preserve full-width popup trigger, guide/remote, icon and horizontal branding,
 * popup sizing, and auto-close behavior from previous releases.
 */
import './totalplay-stb-v0354.js?v=0.3.55';

const TP55_POPUP = customElements.get('totalplay-stb-popup-card');
const TP55_FULL = customElements.get('totalplay-stb-card');
if (!TP55_POPUP || !TP55_FULL) throw new Error('Totalplay card types unavailable');

const tp55PreviousPopupConfig = TP55_POPUP.prototype.setConfig;
TP55_POPUP.prototype.setConfig = function(config) {
  tp55PreviousPopupConfig.call(this, config);
  if (config?.popup_button_style !== 'vertical_logo') return;
  const image = this.shadowRoot?.querySelector('.tp53-brand .tp53-logo');
  if (image) image.src = '/totalplay_stb/artwork/brand/vertical?v=0.3.55';
};

const tp55PreviousFullConfig = TP55_FULL.prototype.setConfig;
TP55_FULL.prototype.setConfig = function(config) {
  tp55PreviousFullConfig.call(this, config);
  this.shadowRoot?.querySelector('.tp-version-badge')?.replaceChildren('v0.3.55');
};
