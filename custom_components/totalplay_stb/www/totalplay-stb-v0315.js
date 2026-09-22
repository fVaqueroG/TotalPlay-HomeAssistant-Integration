/* Totalplay card v0.3.15: recognize XMLTV IDs with dotted channel names.
 * Keep exact/manual mappings and do not infer Totalplay tuning numbers from EPG IDs.
 */
import './totalplay-stb-v0313.js?v=0.3.15';

const TP_MAPPING_CARD = customElements.get('totalplay-stb-card');
if (!TP_MAPPING_CARD) throw new Error('Totalplay card did not load');

const TP_STATION_ALIASES = Object.freeze({
  aztecauno:'azteca1', azteca1:'azteca1', aztecasiete:'azteca7', azteca7:'azteca7',
  lasestrellas:'estrellas', estrellas:'estrellas',
  canalcinco:'canal5', canal5:'canal5',
  imagentelevision:'imagentv', imagentv:'imagentv',
  discoverychannel:'discovery', discovery:'discovery',
  warnerchannel:'warnertv', warnertv:'warnertv',
  sonychannel:'sony', sony:'sony',
});
function tpStationKey(value) {
  const normalized = String(value || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/\b(?:hd|sd|uhd|4k|mexico|mex|mx|latinoamerica|latam|latino)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
  return TP_STATION_ALIASES[normalized] || normalized;
}
function tpStationKeys(station) {
  const id = String(station.id || '').replace(/\.(?:mx|com|tv|org)$/i, '');
  // XMLTV sources use identifiers such as Canal.Azteca.Uno.(México).mx.
  // Splitting on the *first* period turns all those identifiers into "Canal".
  const withoutGenericPrefix = id.replace(/^Canal[._ -]+/i, '');
  return new Set([station.name, ...(Array.isArray(station.names) ? station.names : []),
    id, withoutGenericPrefix].map(tpStationKey).filter(Boolean));
}
function tpFindDottedStation(guide, channel) {
  if (!Array.isArray(guide?.channels) || !channel) return null;
  const sought = new Set([channel.epg_name, channel.name].map(tpStationKey).filter(Boolean));
  if (!sought.size) return null;
  const candidates = guide.channels.filter(station =>
    [...tpStationKeys(station)].some(key => sought.has(key)));
  if (candidates.length === 1) return candidates[0];
  if (candidates.length < 2) return null;
  const now = Date.now();
  const active = candidates.filter(station => (station.schedule || []).some(program =>
    Date.parse(program.start) < now + 7200000 && Date.parse(program.stop) > now));
  // Different regional feeds can give different programming to identically
  // named stations. Only resolve a collision when exactly one is scheduled.
  return active.length === 1 ? active[0] : null;
}

const tpPreviousMappedChannels = TP_MAPPING_CARD.prototype._channels;
TP_MAPPING_CARD.prototype._channels = function () {
  const channels = tpPreviousMappedChannels.call(this);
  if (!Array.isArray(this._guide?.channels)) return channels;
  return channels.map(channel => {
    // Original layer already resolves manual epg_id and unambiguous display names.
    if (channel.epg_id) return channel;
    const station = tpFindDottedStation(this._guide, channel);
    return station ? {...channel, epg_id:station.id} : channel;
  });
};

const tpPreviousMappedSetConfig = TP_MAPPING_CARD.prototype.setConfig;
TP_MAPPING_CARD.prototype.setConfig = function (config) {
  tpPreviousMappedSetConfig.call(this, config);
  const badge = this.shadowRoot?.querySelector('.tp-version-badge');
  if (badge) badge.textContent = 'Card v0.3.15';
};
