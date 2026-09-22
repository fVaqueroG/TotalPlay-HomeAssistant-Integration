/* v0.3.45: The compact Totalplay popup trigger fills its Lovelace card width. */
import './totalplay-stb-v0344.js?v=0.3.45';
import './totalplay-stb-popup-full-width-v0345.js?v=0.3.45';

const TP45_CARD = customElements.get('totalplay-stb-card');
if (!TP45_CARD) throw new Error('Totalplay full card unavailable');
const tp45PreviousConfig = TP45_CARD.prototype.setConfig;
TP45_CARD.prototype.setConfig = function(config) {
  tp45PreviousConfig.call(this, config);
  this.shadowRoot?.querySelector('.tp-version-badge')?.replaceChildren('v0.3.45');
};
