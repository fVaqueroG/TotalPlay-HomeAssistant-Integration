/* v0.3.32: Persistent Multimedios Plus XMLTV mapping for Totalplay 6 / 167.
 * Add to the existing repository mapping logic without affecting other channels.
 */
import './totalplay-stb-v0331.js?v=0.3.32';

const TP_32_CARD = customElements.get('totalplay-stb-card');
if (!TP_32_CARD) throw new Error('Totalplay card unavailable');

const TP_32_MULTIMEDIOS_ID = 'Canal.Multimedios.Plus.mx';
const TP_32_MULTIMEDIOS_CHANNELS = new Set(['6', '167']);
const tp32PriorChannels = TP_32_CARD.prototype._channels;
TP_32_CARD.prototype._channels = function () {
  const channels = tp32PriorChannels.call(this);
  if (!this._guide?.channels?.some(station => station.id === TP_32_MULTIMEDIOS_ID)) return channels;
  const explicit = new Set((this._config?.channels || [])
    .filter(channel => String(channel.epg_id || '').trim())
    .map(channel => String(channel.number)));
  return channels.map(channel => {
    const number = String(channel.number);
    if (!TP_32_MULTIMEDIOS_CHANNELS.has(number) || explicit.has(number)
        || channel.type === 'M' || channel.type === 'I') return channel;
    // Guard against a future official lineup reusing these channel numbers.
    const name = String(channel.name || '').normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (name !== 'canal6') return channel;
    return {...channel, epg_id: TP_32_MULTIMEDIOS_ID, tp_repo_epg: true};
  });
};

const tp32PriorRender = TP_32_CARD.prototype._renderGuide;
TP_32_CARD.prototype._renderGuide = function () {
  tp32PriorRender.call(this);
  if (!this._guideStatus || !this._guide?.channels?.length) return;
  const status = String(this._guideStatus.textContent || '');
  const previous = status.match(/(\d+)\/135 repository EPG mappings available/);
  if (!previous) return;
  const hasStation = this._guide.channels.some(station => station.id === TP_32_MULTIMEDIOS_ID);
  const additional = hasStation ? this._channels().filter(channel =>
    TP_32_MULTIMEDIOS_CHANNELS.has(String(channel.number)) &&
    channel.epg_id === TP_32_MULTIMEDIOS_ID && channel.tp_repo_epg).length : 0;
  this._guideStatus.textContent = status.replace(previous[0],
    `${Number(previous[1]) + additional}/137 repository EPG mappings available`);
};

const tp32PriorConfig = TP_32_CARD.prototype.setConfig;
TP_32_CARD.prototype.setConfig = function (config) {
  tp32PriorConfig.call(this, config);
  const badge = this.shadowRoot?.querySelector('.tp-version-badge');
  if (badge) badge.textContent = 'v0.3.32';
};
