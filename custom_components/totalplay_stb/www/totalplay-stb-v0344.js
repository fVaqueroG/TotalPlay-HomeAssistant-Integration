/* v0.3.44: Persistent backend artwork cache plus real Totalplay popup assets. */
import './totalplay-stb-v0343.js?v=0.3.44';
import './totalplay-stb-brand-assets-v0344.js?v=0.3.44';

const TP44_FULL = customElements.get('totalplay-stb-card');
const TP44_POPUP = customElements.get('totalplay-stb-popup-card');
if (!TP44_FULL || !TP44_POPUP) throw new Error('Totalplay cards unavailable');

const tp44FullConfig = TP44_FULL.prototype.setConfig;
TP44_FULL.prototype.setConfig = function(config) {
  tp44FullConfig.call(this, config);
  this.shadowRoot?.querySelector('.tp-version-badge')?.replaceChildren('v0.3.44');
};
