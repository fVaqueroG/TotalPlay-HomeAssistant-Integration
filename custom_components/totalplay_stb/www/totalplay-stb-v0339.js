/* v0.3.39: Keep the full Totalplay card and register an optional compact
 * totalplay-stb-popup-card that opens that exact card in a native modal.
 */
import './totalplay-stb-v0338.js?v=0.3.39';
import './totalplay-stb-popup-card.js?v=0.3.39';

const TP_39_FULL_CARD = customElements.get('totalplay-stb-card');
if (!TP_39_FULL_CARD || !customElements.get('totalplay-stb-popup-card')) {
  throw new Error('Totalplay full or popup card is unavailable');
}
const tp39PreviousConfig=TP_39_FULL_CARD.prototype.setConfig;
TP_39_FULL_CARD.prototype.setConfig=function(config){
  tp39PreviousConfig.call(this,config);
  this.shadowRoot?.querySelector('.tp-version-badge')?.replaceChildren('v0.3.39');
};
