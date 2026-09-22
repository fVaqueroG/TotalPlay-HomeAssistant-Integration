/* Totalplay card v0.3.18: use backend-preloaded, rolling thirty-minute EPG. */
import './totalplay-stb-v0317.js?v=0.3.18';

const TP_ROLLING_CARD = customElements.get('totalplay-stb-card');
if (!TP_ROLLING_CARD) throw new Error('Totalplay card did not load');
const tpPreviousRollingSetConfig = TP_ROLLING_CARD.prototype.setConfig;
TP_ROLLING_CARD.prototype.setConfig = function(config) {
  tpPreviousRollingSetConfig.call(this, config);
  this.shadowRoot?.querySelector('.tp-version-badge')?.replaceChildren('Card v0.3.18');
};
