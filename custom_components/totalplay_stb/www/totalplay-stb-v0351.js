/* v0.3.51: Configurable timed closing for the Totalplay popup card. */
import './totalplay-stb-v0350.js?v=0.3.51';
import './totalplay-stb-popup-auto-close-v0351.js?v=0.3.51';

const TP51_FULL = customElements.get('totalplay-stb-card');
const TP51_POPUP = customElements.get('totalplay-stb-popup-card');
if (!TP51_FULL || !TP51_POPUP) throw new Error('Totalplay card types unavailable');

const tp51PreviousFullConfig = TP51_FULL.prototype.setConfig;
TP51_FULL.prototype.setConfig = function(config) {
  tp51PreviousFullConfig.call(this, config);
  this.shadowRoot?.querySelector('.tp-version-badge')?.replaceChildren('v0.3.51');
};
