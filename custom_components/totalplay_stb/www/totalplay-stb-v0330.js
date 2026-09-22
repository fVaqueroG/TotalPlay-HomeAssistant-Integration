/* v0.3.30: Workbook-backed persistent EPG mappings.
 * Keeps v0.3.29 behavior while publishing the refreshed 135-channel mapping
 * table and channel-name safety guard under a new cache-busting frontend entry.
 */
import './totalplay-stb-v0329.js?v=0.3.30';

const TP_30_CARD = customElements.get('totalplay-stb-card');
if (!TP_30_CARD) throw new Error('Totalplay card unavailable');

const tp30PreviousSetConfig = TP_30_CARD.prototype.setConfig;
TP_30_CARD.prototype.setConfig = function (config) {
  tp30PreviousSetConfig.call(this, config);
  const badge = this.shadowRoot?.querySelector('.tp-version-badge');
  if (badge) {
    badge.textContent = 'v0.3.30';
    badge.title = '135 persistent repository EPG mappings · card override > repository mapping > automatic match';
  }
};
