/* v0.3.43: Persistent backend image cache for official channel icons, apps
 * and the Totalplay logo. Preserve all existing guide and popup behavior.
 */
import './totalplay-stb-v0342.js?v=0.3.43';
import './totalplay-stb-artwork-cache.js?v=0.3.43';

const TP43_FULL = customElements.get('totalplay-stb-card');
const TP43_POPUP = customElements.get('totalplay-stb-popup-card');
if (!TP43_FULL || !TP43_POPUP) throw new Error('Totalplay cards unavailable');
const tp43PriorConfig = TP43_FULL.prototype.setConfig;
TP43_FULL.prototype.setConfig = function (config) {
  tp43PriorConfig.call(this, config);
  this.shadowRoot?.querySelector('.tp-version-badge')?.replaceChildren('v0.3.43');
};
