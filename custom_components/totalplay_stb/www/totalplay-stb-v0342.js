/* v0.3.42: Three popup trigger graphics: vertical logo, horizontal logo,
 * and an icon with optional title. Reuse the existing full card and popup.
 */
import './totalplay-stb-v0341.js?v=0.3.42';
import './totalplay-stb-popup-brand-modes.js?v=0.3.42';

const TP42_FULL = customElements.get('totalplay-stb-card');
const TP42_POPUP = customElements.get('totalplay-stb-popup-card');
const TP42_POPUP_EDITOR = customElements.get('totalplay-stb-popup-card-editor');
if (!TP42_FULL || !TP42_POPUP || !TP42_POPUP_EDITOR) {
  throw new Error('Totalplay guide or popup button options unavailable');
}
const tp42PreviousFullConfig = TP42_FULL.prototype.setConfig;
TP42_FULL.prototype.setConfig = function (config) {
  tp42PreviousFullConfig.call(this, config);
  this.shadowRoot?.querySelector('.tp-version-badge')?.replaceChildren('v0.3.42');
};
