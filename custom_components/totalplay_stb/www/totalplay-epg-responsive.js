/* Totalplay card frontend v0.3.4: guide, scroll, and EPG enhancements. */
import './totalplay-guide-v3.js';

const TP_CARD_VERSION = '0.3.4';
const TotalplayCard = customElements.get('totalplay-stb-card');
if (!TotalplayCard) throw new Error('Totalplay base card failed to load');

const ALIASES = Object.freeze({
  canalcinco: 'canal5', canal5: 'canal5',
  lasestrellas: 'estrellas', estrellas: 'estrellas',
  aztecauno: 'azteca1', azteca1: 'azteca1',
  aztecasiete: 'azteca7', azteca7: 'azteca7',
  discoverychannel: 'discovery', discovery: 'discovery',
  cartoonnetwork: 'cartoonnetwork',
  historychannel: 'history', history: 'history',
  aande: 'ae', aeteve: 'ae',
});
function guideKey(value) {
  const text = String(value || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\b(?:hd|sd|uhd|4k|mexico|mex|latinoamerica|latam|latino)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
  return ALIASES[text] || text;
}
function stationKeys(station) {
  return new Set([station?.name, ...(station?.names || []), String(station?.id || '').split('.')[0]]
    .map(guideKey).filter(Boolean));
}
function findStation(guide, channel) {
  if (!guide?.channels?.length || !channel) return null;
  if (channel.epg_id) return guide.channels.find(s => s.id === channel.epg_id) || null;
  const wanted = new Set([channel.epg_name, channel.name].map(guideKey).filter(Boolean));
  if (!wanted.size) return null;
  const candidates = guide.channels.filter(station =>
    [...stationKeys(station)].some(key => wanted.has(key)));
  if (candidates.length === 1) return candidates[0];
  const scheduled = candidates.filter(station => (station.schedule || []).some(program =>
    Number.isFinite(Date.parse(program.start)) && Number.isFinite(Date.parse(program.stop)) &&
    Date.parse(program.stop) > Date.now() && Date.parse(program.start) < Date.now() + 7200000));
  return scheduled.length === 1 ? scheduled[0] : null;
}
const originalChannels = TotalplayCard.prototype._channels;
TotalplayCard.prototype._channels = function () {
  return originalChannels.call(this).map(channel => {
    if (channel.epg_id) return channel;
    const station = findStation(this._guide, channel);
    return station ? {...channel, epg_id: station.id} : channel;
  });
};

// If a short first batch does not fill the viewport, render another batch.
// Schedule after layout, never in a tight synchronous loop; stop when all
// filtered channels are visible or a real scrolling region exists.
TotalplayCard.prototype._queueGuideFill = function () {
  if (this._guideFillQueued || !this._guideHasMore || this._tab !== 'guide' ||
      !this._scroll || typeof requestAnimationFrame !== 'function') return;
  this._guideFillQueued = true;
  requestAnimationFrame(() => {
    this._guideFillQueued = false;
    const scroll = this._scroll;
    if (!scroll || this._tab !== 'guide' || !this._guideHasMore || this._autoGrowing ||
        !scroll.clientHeight || scroll.scrollHeight > scroll.clientHeight + 100) return;
    this._autoGrowing = true;
    try {
      this._limit += 35;
      this._renderGuide();
    } finally {
      this._autoGrowing = false;
    }
  });
};
const originalRenderGuide = TotalplayCard.prototype._renderGuide;
TotalplayCard.prototype._renderGuide = function () {
  originalRenderGuide.call(this);
  this._guideHasMore = Boolean(this._more && !this._more.hidden);
  if (this._more) this._more.hidden = true;
  if (this._backToTop && this._scroll) this._backToTop.hidden = this._scroll.scrollTop < 240;
  this._queueGuideFill();
  if (!this._guideStatus || !this._guide || this._guide.error || !this._config?.epg) return;
  const guide = this._guide;
  const activeStations = guide.channels.filter(station => (station.schedule || []).some(program =>
    Date.parse(program.stop) > Date.now() && Date.parse(program.start) < Date.now() + 7200000));
  const allChannels = this._channels();
  const matched = allChannels.filter(channel => findStation(guide, channel));
  if (!activeStations.length) {
    const total = guide.programme_count ?? 'unknown';
    const valid = guide.valid_timestamp_count ?? 'unknown';
    this._guideStatus.textContent = `EPG downloaded ${guide.channels.length} stations and ${total} source programmes, but none has a current or upcoming listing. Valid timestamps: ${valid}. The feed may be stale or its programme times unsupported; this is not a channel-mapping error.`;
    this._guideStatus.classList.add('problem');
  } else if (!matched.length) {
    const examples = activeStations.slice(0, 4).map(s => s.name).join(', ');
    this._guideStatus.textContent = `EPG downloaded: ${activeStations.length} stations have programs now or soon, but none match your Totalplay lineup. Link a channel to its XMLTV station in the visual editor. Examples in feed: ${examples}.`;
    this._guideStatus.classList.add('problem');
  } else {
    this._guideStatus.classList.remove('problem');
    this._guideStatus.textContent += ` · ${activeStations.length} EPG stations have current/upcoming programs. ${matched.length} lineup channels linked.`;
  }
};

const RESPONSIVE_CSS = `
:host {display:block; min-height:0}
ha-card {height:min(760px,max(280px,calc(100dvh - 175px))); display:flex; flex-direction:column; overflow:hidden}
.frame {display:flex; flex-direction:column; min-height:0; flex:1; overflow:hidden}
.header,.tools,.pills,.feedback {flex:none}
.layout {flex:1; min-height:0; overflow:hidden}
.main {display:flex; flex-direction:column; min-width:0; min-height:0; overflow:hidden}
.main>section:not(.hidden):not(.apps-only) {display:flex; flex-direction:column; flex:1; min-height:0; overflow:hidden}
.main>section.apps-only:not(.hidden) {display:block; flex:1; min-height:0; overflow:auto}
.guide-info,.selection,.apps-strip,.showmore {flex:none}
.guide-info {max-height:78px; overflow:auto; align-items:flex-start}
.guide-scroll {flex:1 1 0; height:0; min-height:68px; max-height:none!important; overflow-x:auto; overflow-y:auto; touch-action:pan-x pan-y; -webkit-overflow-scrolling:touch; overscroll-behavior:contain}
.showmore {display:none!important}
.tp-back-to-top {white-space:nowrap;flex:none;font-size:12px;padding:6px 10px}
.brand-title {display:flex; align-items:center; gap:7px; overflow:visible; white-space:normal}
.tp-version-badge {display:inline-flex; flex:none; align-items:center; border:1px solid var(--tp-line); border-radius:7px; padding:2px 6px; color:var(--tp-sub); background:color-mix(in srgb,var(--tp-ink) 7%,var(--tp-bg)); font-size:10px; font-weight:650; white-space:nowrap; letter-spacing:0}
.remote {min-height:0; max-height:100%; overflow:auto}
@media(max-width:1100px) {
  .layout.remote-visible {display:block; position:relative; grid-template-columns:none}
  .layout.remote-visible .remote {position:absolute; inset:0 0 auto auto; z-index:20; width:min(100%,390px); max-width:100%; max-height:100%; overflow:auto; margin:0}
}
@media(max-width:580px) {
  ha-card {height:min(650px,max(270px,calc(100dvh - 155px)))}
  .frame {padding:10px}
  .apps-strip {display:none}
  .guide-info {max-height:92px}
  .pills {max-height:43px}
}
`;
const originalSetConfig = TotalplayCard.prototype.setConfig;
TotalplayCard.prototype.setConfig = function (config) {
  // Show the full channel list by default. An EPG-only filter can hide nearly
  // every channel when the feed is unavailable, leaving nothing to scroll.
  if (this._onlyGuide === undefined) this._onlyGuide = Boolean(config?.programs_only ?? false);
  originalSetConfig.call(this, config);
  if (this.shadowRoot && !this.shadowRoot.querySelector('#totalplay-responsive-epg')) {
    const style = document.createElement('style');
    style.id = 'totalplay-responsive-epg';
    style.textContent = RESPONSIVE_CSS;
    this.shadowRoot.appendChild(style);
  }
  const heading = this.shadowRoot?.querySelector('.brand-title');
  if (heading && !heading.querySelector('.tp-version-badge')) {
    const badge = document.createElement('span');
    badge.className = 'tp-version-badge';
    badge.textContent = `Card v${TP_CARD_VERSION}`;
    badge.title = 'Version of the Totalplay card JavaScript loaded in this browser';
    heading.appendChild(badge);
  }
  const scroll = this._scroll;
  if (!scroll || this._autoScrollNode === scroll) return;
  this._autoScrollNode = scroll;
  const info = this._guidePanel?.querySelector('.guide-info');
  if (info) {
    const top = document.createElement('button');
    top.type = 'button';
    top.className = 'btn tp-back-to-top';
    top.textContent = '↑ Back to top';
    top.title = 'Return to the first channel';
    top.hidden = true;
    top.addEventListener('click', () => scroll.scrollTo({top: 0, behavior: 'smooth'}));
    info.appendChild(top);
    this._backToTop = top;
  }
  scroll.addEventListener('scroll', () => {
    if (this._scroll !== scroll) return;
    if (this._backToTop) this._backToTop.hidden = scroll.scrollTop < 240;
    if (this._tab !== 'guide' || this._autoGrowing || !this._guideHasMore) return;
    const remaining = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight;
    if (remaining > Math.max(160, scroll.clientHeight * .35)) return;
    this._autoGrowing = true;
    try {
      this._limit += 35;
      this._renderGuide();
    } finally {
      this._autoGrowing = false;
    }
  }, {passive: true});
  this._queueGuideFill();
};
