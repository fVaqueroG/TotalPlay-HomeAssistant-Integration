/* v0.3.29 compatibility layer: apply repository-backed Totalplay -> XMLTV IDs.
 * v0.3.30 imports this module with refreshed mapping data.
 */
import {
  TP_REPO_EPG_MAPPING,
  TP_REPO_EPG_EXPECTED_NAMES,
  TP_REPO_EPG_METADATA,
} from './totalplay-epg-mapping.js?v=0.3.30';
import './totalplay-stb-v0328.js?v=0.3.30';

const TP_MAPPED_CARD = customElements.get('totalplay-stb-card');
if (!TP_MAPPED_CARD) throw new Error('Totalplay card unavailable');

function tpRepoNameKey(value) {
  return String(value || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

const tpPreviousMappedChannels = TP_MAPPED_CARD.prototype._channels;
TP_MAPPED_CARD.prototype._channels = function () {
  const channels = tpPreviousMappedChannels.call(this);
  if (!this._guide?.channels?.length || !channels.length) return channels;

  const stationIds = new Set(this._guide.channels.map(station => String(station.id)));
  const perCardOverrides = new Set((this._config?.channels || [])
    .filter(channel => String(channel.epg_id || '').trim())
    .map(channel => String(channel.number)));

  return channels.map(channel => {
    const category = String(channel.category || '').normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
    if (channel.type === 'M' || channel.type === 'I' ||
        category === 'audio' || category === 'musica') return channel;

    const number = String(channel.number);
    if (perCardOverrides.has(number)) return channel;

    const mappedStation = TP_REPO_EPG_MAPPING[number];
    const expectedName = TP_REPO_EPG_EXPECTED_NAMES[number];
    if (!mappedStation || !expectedName) return channel;

    // Protect against a future Totalplay lineup reusing a channel number for
    // another station. Minor punctuation/accent changes are intentionally ignored.
    if (tpRepoNameKey(channel.name) !== tpRepoNameKey(expectedName)) return channel;

    // Never force an ID absent from the currently merged guide. This lets the
    // automatic matcher remain the safe fallback when a provider removes an ID.
    if (!stationIds.has(mappedStation)) return channel;

    return channel.epg_id === mappedStation
      ? {...channel, tp_repo_epg: true}
      : {...channel, epg_id: mappedStation, tp_repo_epg: true};
  });
};

const tpPreviousMappedRender = TP_MAPPED_CARD.prototype._renderGuide;
TP_MAPPED_CARD.prototype._renderGuide = function () {
  tpPreviousMappedRender.call(this);
  if (!this._guide?.channels?.length || !this._guideStatus) return;

  const stationIds = new Set(this._guide.channels.map(station => String(station.id)));
  const available = Object.values(TP_REPO_EPG_MAPPING)
    .filter(id => stationIds.has(id)).length;
  const suffix = ` · ${available}/${TP_REPO_EPG_METADATA.mapping_count} repository EPG mappings available`;
  const base = String(this._guideStatus.textContent || '')
    .replace(/\s*·\s*\d+\/\d+ repository EPG mappings available\s*$/, '');
  this._guideStatus.textContent = base + suffix;
};

const tpPreviousMappedConfig = TP_MAPPED_CARD.prototype.setConfig;
TP_MAPPED_CARD.prototype.setConfig = function (config) {
  tpPreviousMappedConfig.call(this, config);
  this.shadowRoot?.querySelector('.tp-version-badge')?.replaceChildren('v0.3.29');
};
