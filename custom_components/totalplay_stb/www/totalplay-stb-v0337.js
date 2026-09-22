/* v0.3.37: Explain when the EPG is using its saved last-good guide.
 * Keep the v0.3.36 no-source-check behavior and all channel mappings.
 */
import './totalplay-stb-v0336.js?v=0.3.37';

const TP_37_CARD = customElements.get('totalplay-stb-card');
if (!TP_37_CARD) throw new Error('Totalplay card unavailable');

const tp37PriorGuide = TP_37_CARD.prototype._renderGuide;
TP_37_CARD.prototype._renderGuide = function () {
  tp37PriorGuide.call(this);
  const guide = this._guide;
  const status = this._guideStatus;
  if (!status || !guide?.using_cached_guide || guide.error ||
      !(guide.window_programme_count > 0)) return;
  status.textContent = `Saved EPG (live providers temporarily unavailable) · ${status.textContent}`;
  const errors = (guide.source_errors || []).filter(Boolean);
  status.title = errors.length ? errors.join(' · ') : 'Showing the last successful XMLTV guide.';
};

const tp37PriorConfig = TP_37_CARD.prototype.setConfig;
TP_37_CARD.prototype.setConfig = function (config) {
  tp37PriorConfig.call(this, config);
  this.shadowRoot?.querySelector('.tp-version-badge')?.replaceChildren('v0.3.37');
};
