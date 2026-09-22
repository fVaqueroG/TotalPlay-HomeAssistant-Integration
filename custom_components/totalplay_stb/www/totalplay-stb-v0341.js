/* v0.3.41: Normal / Wide / Full-screen popup sizing. */
import './totalplay-stb-v0340.js?v=0.3.41';
import './totalplay-stb-popup-sizes.js?v=0.3.41';

const TP_41_FULL = customElements.get('totalplay-stb-card');
if (!TP_41_FULL || !customElements.get('totalplay-stb-popup-card') ||
    !customElements.get('totalplay-stb-popup-card-editor')) {
  throw new Error('Totalplay card and popup editor unavailable');
}
const tp41OldConfig = TP_41_FULL.prototype.setConfig;
TP_41_FULL.prototype.setConfig = function(config) {
  tp41OldConfig.call(this, config);
  this.shadowRoot?.querySelector('.tp-version-badge')?.replaceChildren('v0.3.41');
};
