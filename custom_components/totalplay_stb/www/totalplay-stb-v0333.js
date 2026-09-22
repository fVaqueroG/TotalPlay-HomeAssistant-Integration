/* v0.3.33: Restore card registration by loading the complete versioned frontend.
 * All imported JS dependencies are registered automatically by __init__.py.
 * Preserve the persistent 137-channel mapping, including Totalplay 6 and 167.
 */
import './totalplay-stb-v0332.js?v=0.3.33';

const TP_33_CARD = customElements.get('totalplay-stb-card');
if (!TP_33_CARD) throw new Error('Totalplay card unavailable');

const tp33PreviousConfig = TP_33_CARD.prototype.setConfig;
TP_33_CARD.prototype.setConfig = function (config) {
  tp33PreviousConfig.call(this, config);
  const badge = this.shadowRoot?.querySelector('.tp-version-badge');
  if (badge) badge.textContent = 'v0.3.33';
};
