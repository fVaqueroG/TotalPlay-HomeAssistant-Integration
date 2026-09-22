/* v0.3.31: Packaging fix for the persistent EPG mapping release. */
import './totalplay-stb-v0330.js?v=0.3.31';

const TP_31_CARD = customElements.get('totalplay-stb-card');
if (!TP_31_CARD) throw new Error('Totalplay card unavailable');

const tp31PreviousSetConfig = TP_31_CARD.prototype.setConfig;
TP_31_CARD.prototype.setConfig = function (config) {
  tp31PreviousSetConfig.call(this, config);
  const badge = this.shadowRoot?.querySelector('.tp-version-badge');
  if (badge) {
    badge.textContent = 'v0.3.31';
    badge.title = '135 persistent repository EPG mappings · card override > repository mapping > automatic match';
  }
};
