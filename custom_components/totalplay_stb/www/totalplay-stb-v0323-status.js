/* v0.3.23: Show which XMLTV providers contributed programme data. */
import './totalplay-stb-v0323.js?v=0.3.23';

const TP_STATUS_CARD = customElements.get('totalplay-stb-card');
if (!TP_STATUS_CARD) throw new Error('Totalplay card unavailable');
const tpPriorStatusRender = TP_STATUS_CARD.prototype._renderGuide;
TP_STATUS_CARD.prototype._renderGuide = function () {
  tpPriorStatusRender.call(this);
  const sources = this._guide?.sources;
  if (!this._guideStatus || this._guide?.error || !Array.isArray(sources) || !sources.length) return;
  this._guideStatus.textContent += ` · ${sources.length} EPG source${sources.length === 1 ? '' : 's'}`;
  this._guideStatus.title = sources.map(s => `${s.name}: ${s.scheduled} scheduled stations`).join(' · ');
};
