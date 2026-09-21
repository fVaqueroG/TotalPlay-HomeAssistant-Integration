/* Totalplay guide enhancements: retain the original card, editor, and service routing. */
import './totalplay-guide-v3.js';

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
  // A hand-picked station is authoritative. Do not replace it with a guess.
  if (channel.epg_id) return guide.channels.find(s => s.id === channel.epg_id) || null;
  const wanted = new Set([channel.epg_name, channel.name].map(guideKey).filter(Boolean));
  if (!wanted.size) return null;
  const candidates = guide.channels.filter(station =>
    [...stationKeys(station)].some(key => wanted.has(key)));
  if (candidates.length === 1) return candidates[0];
  // Never map two similarly named stations arbitrarily. Use guide activity
  // only if exactly one of the ambiguous stations actually has programmes.
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

const originalRenderGuide = TotalplayCard.prototype._renderGuide;
TotalplayCard.prototype._renderGuide = function () {
  originalRenderGuide.call(this);
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

// Keep the guide in the available viewport and let its timeline scroll within
// the card. Opening the remote does not increase the height of the guide.
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
.guide-scroll {flex:1; min-height:68px; max-height:none!important; overflow:auto}
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
  originalSetConfig.call(this, config);
  if (this.shadowRoot && !this.shadowRoot.querySelector('#totalplay-responsive-epg')) {
    const style = document.createElement('style');
    style.id = 'totalplay-responsive-epg';
    style.textContent = RESPONSIVE_CSS;
    this.shadowRoot.appendChild(style);
  }
};
