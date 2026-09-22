/* Totalplay card v0.3.17: faster EPG reuse without changing guide coverage or tuning. */
import './totalplay-stb-v0316.js?v=0.3.17';

const TP_FAST_CARD = customElements.get('totalplay-stb-card');
if (!TP_FAST_CARD) throw new Error('Totalplay card did not load');

// These values live only in the current browser tab. The server retains its
// separate 15-minute XMLTV cache and authenticates every HTTP request.
const TP_GUIDE_REUSE_MS = 5 * 60 * 1000;
const tpSharedGuide = {guide:null, fetched:0, pending:null};
const tpPreviousFastLoadGuide = TP_FAST_CARD.prototype._loadGuide;
TP_FAST_CARD.prototype._loadGuide = async function(force=false) {
  if (!this._hass || !this._config?.epg || this._loadingGuide) return;
  const now = Date.now();
  if (!force && this._fetched && now-this._fetched < TP_GUIDE_REUSE_MS) return;
  if (!force && tpSharedGuide.guide && now-tpSharedGuide.fetched < TP_GUIDE_REUSE_MS) {
    if (this._guide !== tpSharedGuide.guide) {
      this._guide = tpSharedGuide.guide;
      this._renderGuide();
    }
    this._fetched = now;
    return;
  }
  this._loadingGuide = true;
  // Multiple dashboard cards mounted together share one authenticated call.
  // A manual refresh bypasses the in-memory cache, but joins a running call.
  const request = tpSharedGuide.pending || Promise.resolve().then(() =>
    this._hass.callApi('GET', 'totalplay_stb/epg'));
  if (!tpSharedGuide.pending) tpSharedGuide.pending = request;
  try {
    const guide = await request;
    if (!Array.isArray(guide?.channels)) throw Error('The guide returned no channel list');
    this._guide = guide;
    if (!guide.error && guide.channels.length) {
      tpSharedGuide.guide = guide;
      tpSharedGuide.fetched = Date.now();
    }
  } catch (error) {
    // Keep useful programme data when a reload fails; expose the failure.
    const previous = this._guide?.channels?.length ? this._guide : tpSharedGuide.guide;
    this._guide = previous
      ? {...previous, error:`Home Assistant guide request failed: ${error?.message||error}`,
         using_cached_guide:true}
      : {channels:[], error:`Home Assistant guide request failed: ${error?.message||error}`};
    console.warn('Totalplay EPG:', error);
  } finally {
    if (tpSharedGuide.pending === request) tpSharedGuide.pending = null;
    this._fetched = Date.now();
    this._loadingGuide = false;
    this._renderGuide();
  }
};

// The XMLTV name/ID lookup is comparatively expensive across hundreds of
// lineup channels. Reuse its result during repeated renders and row paging;
// rebuild automatically after EPG, lineup or card configuration changes.
const tpPreviousFastChannels = TP_FAST_CARD.prototype._channels;
TP_FAST_CARD.prototype._channels = function() {
  const cache = this._tpFastChannelCache;
  if (cache && cache.guide === this._guide && cache.lineup === this._reference &&
      cache.config === this._config) return cache.channels;
  const channels = tpPreviousFastChannels.call(this);
  this._tpFastChannelCache = {
    guide:this._guide, lineup:this._reference, config:this._config, channels,
  };
  return channels;
};

const tpPreviousFastSetConfig = TP_FAST_CARD.prototype.setConfig;
TP_FAST_CARD.prototype.setConfig = function(config) {
  this._tpFastChannelCache = null;
  tpPreviousFastSetConfig.call(this, config);
  this.shadowRoot?.querySelector('.tp-version-badge')?.replaceChildren('Card v0.3.17');
};
