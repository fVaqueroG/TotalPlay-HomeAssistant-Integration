/* v0.3.40: Keep existing Totalplay guide; add popup sizes, icons and button layouts. */
import './totalplay-stb-v0339.js?v=0.3.40';
import './totalplay-stb-popup-options.js?v=0.3.40';
import './totalplay-stb-popup-layout.js?v=0.3.40';

const TP_40_FULL = customElements.get('totalplay-stb-card');
const TP_40_POPUP = customElements.get('totalplay-stb-popup-card');
const TP_40_EDITOR = customElements.get('totalplay-stb-popup-card-editor');
if (!TP_40_FULL || !TP_40_POPUP || !TP_40_EDITOR) {
  throw new Error('Totalplay guide or popup options unavailable');
}
const tp40OldConfig = TP_40_FULL.prototype.setConfig;
TP_40_FULL.prototype.setConfig = function (config) {
  tp40OldConfig.call(this, config);
  this.shadowRoot?.querySelector('.tp-version-badge')?.replaceChildren('v0.3.40');
};
