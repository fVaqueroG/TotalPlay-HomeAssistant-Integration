/* v0.3.52: Restore the approved vertical logo from a direct local PNG. */
import './totalplay-stb-v0351.js?v=0.3.52';
import './totalplay-stb-vertical-logo-v0352.js?v=0.3.52';

const TP52_FULL = customElements.get('totalplay-stb-card');
const TP52_POPUP = customElements.get('totalplay-stb-popup-card');
if (!TP52_FULL || !TP52_POPUP) throw new Error('Totalplay card types unavailable');

const tp52PreviousConfig = TP52_FULL.prototype.setConfig;
TP52_FULL.prototype.setConfig = function(config) {
  tp52PreviousConfig.call(this, config);
  this.shadowRoot?.querySelector('.tp-version-badge')?.replaceChildren('v0.3.52');
};
