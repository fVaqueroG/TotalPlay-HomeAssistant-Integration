/* v0.3.29: Persist owner-confirmed Totalplay -> XMLTV IDs in the repository.
 * Do not change official channel numbers, ordering, names, logos or decoder tuning.
 */
import { TP_REPO_EPG_MAPPING } from './totalplay-epg-mapping.js?v=0.3.29';
import './totalplay-stb-v0328.js?v=0.3.29';

const TP_MAPPED_CARD = customElements.get('totalplay-stb-card');
if (!TP_MAPPED_CARD) throw new Error('Totalplay card unavailable');

const tpPreviousMappedChannels = TP_MAPPED_CARD.prototype._channels;
TP_MAPPED_CARD.prototype._channels = function () {
  const channels = tpPreviousMappedChannels.call(this);
  if (!this._guide?.channels?.length || !channels.length) return channels;

  const stationIds = new Set(this._guide.channels.map(station => station.id));
  const perCardOverrides = new Set((this._config?.channels || [])
    .filter(channel => String(channel.epg_id || '').trim())
    .map(channel => String(channel.number)));

  return channels.map(channel => {
    // Mosaic, Audio, Música and app entries must never be assigned TV schedules.
    const category = String(channel.category || '').normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
    if (channel.type === 'M' || channel.type === 'A' ||
        category === 'audio' || category === 'musica') return channel;

    const number = String(channel.number);
    if (perCardOverrides.has(number)) return channel;
    const mappedStation = TP_REPO_EPG_MAPPING[number];
    // A provider can remove or rename an ID. Never force an unavailable station:
    // preserve the existing automatic match (or the unmatched state) instead.
    if (!mappedStation || !stationIds.has(mappedStation)) return channel;
    return channel.epg_id === mappedStation
      ? channel : {...channel, epg_id: mappedStation};
  });
};

const tpPreviousMappedRender = TP_MAPPED_CARD.prototype._renderGuide;
TP_MAPPED_CARD.prototype._renderGuide = function () {
  tpPreviousMappedRender.call(this);
  if (!this._guide?.channels?.length || !this._guideStatus) return;
  const stationIds = new Set(this._guide.channels.map(station => station.id));
  const available = Object.values(TP_REPO_EPG_MAPPING)
    .filter(id => stationIds.has(id)).length;
  this._guideStatus.textContent +=
    ` · ${available}/${Object.keys(TP_REPO_EPG_MAPPING).length} repository EPG mappings available`;
};

const tpPreviousMappedConfig = TP_MAPPED_CARD.prototype.setConfig;
TP_MAPPED_CARD.prototype.setConfig = function (config) {
  tpPreviousMappedConfig.call(this, config);
  this.shadowRoot?.querySelector('.tp-version-badge')?.replaceChildren('v0.3.29');
};
