/* v0.3.22: Restore EPG matches against the official Totalplay catalog.
 * Channel artwork, number, name and category remain official; XMLTV supplies
 * programme schedules only. Keep the remote, controls and application page.
 */
import './totalplay-stb-v0321.js?v=0.3.22';

const TP_EPG_CARD = customElements.get('totalplay-stb-card');
if (!TP_EPG_CARD) throw new Error('Totalplay card unavailable');

const TP_EPG_ALIASES = Object.freeze({
  aztecauno:'azteca1', azteca1:'azteca1',
  aztecasiete:'azteca7', azteca7:'azteca7',
  canalcinco:'canal5', canal5:'canal5',
  lasestrellas:'estrellas', estrellas:'estrellas',
  imagentelevision:'imagen', imagentv:'imagen', imagen:'imagen',
  forotv:'nforotv', nforotv:'nforotv',
  canalonce:'once', oncetv:'once', once:'once',
  nuevenu9ve:'nueve', nu9ve:'nueve', nueve:'nueve',
  canal6:'canal6', multimedios:'canal6',
  warnertv:'warner', warnerchannel:'warner', warner:'warner',
  sonychannel:'sony', sony:'sony',
  discoverychannel:'discovery', discovery:'discovery',
  nationalgeographic:'natgeo', natgeo:'natgeo',
  investigationdiscovery:'id', id:'id',
});
function tpEpgKey(value) {
  const name = String(value || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/\b(?:hd|sd|fhd|uhd|4k|mexico|mex|mx|latinoamerica|latam|latino|nacional)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
  return TP_EPG_ALIASES[name] || name;
}
function tpEpgNameKeys(value, fromId = false) {
  const raw = String(value || '');
  const items = [raw];
  if (fromId) {
    // XMLTV IDs can look like Canal.Azteca.Uno.(México).mx, while the
    // display name is simply Azteca uno. Do not interpret IDs as channel numbers.
    items.push(raw.replace(/^canal[._ -]+/i, ''));
    items.push(raw.replace(/\.(?:mx|tv|com|net|org)$/i, ''));
    items.push(raw.replace(/^canal[._ -]+/i, '').replace(/\.(?:mx|tv|com|net|org)$/i, ''));
  }
  return [...new Set(items.map(tpEpgKey).filter(key => key.length >= 3))];
}
function tpEpgIndex(guide) {
  const stations = new Map(), byKey = new Map();
  for (const station of guide?.channels || []) {
    if (!station?.id) continue;
    stations.set(station.id, station);
    const keys = new Set([
      ...tpEpgNameKeys(station.name),
      ...(Array.isArray(station.names) ? station.names.flatMap(name => tpEpgNameKeys(name)) : []),
      ...tpEpgNameKeys(station.id, true),
    ]);
    for (const key of keys) {
      if (!byKey.has(key)) byKey.set(key, new Set());
      byKey.get(key).add(station);
    }
  }
  return {stations, byKey};
}
function tpEpgStationFor(channel, index) {
  // Honor explicit card mappings. If an explicit station no longer exists,
  // leave it unresolved rather than silently substituting a different feed.
  if (channel.epg_id) return index.stations.get(channel.epg_id) || null;
  const keys = tpEpgNameKeys(channel.epg_name || channel.name);
  const candidates = new Set();
  for (const key of keys) for (const station of index.byKey.get(key) || []) candidates.add(station);
  if (candidates.size === 1) return [...candidates][0];
  if (candidates.size < 2) return null;
  // A duplicate station name can represent multiple regional schedules.
  // Choose only when exactly one matching station has programmes in the window.
  const now = Date.now();
  const active = [...candidates].filter(station => (station.schedule || []).some(p =>
    Date.parse(p.start) < now + 8 * 3600000 && Date.parse(p.stop) > now));
  return active.length === 1 ? active[0] : null;
}

// v0.3.21 intentionally bypassed the legacy community lineup, but it also
// bypassed v0.3.15's automatic EPG station mapping. Restore the latter without
// allowing unofficial channels or overwriting official catalog metadata.
const tpOfficialChannels = TP_EPG_CARD.prototype._channels;
TP_EPG_CARD.prototype._channels = function() {
  const official = tpOfficialChannels.call(this);
  if (!this._guide?.channels?.length || !official.length) return official;
  const cache = this._tpOfficialEpgCache;
  if (cache?.guide === this._guide && cache.catalog === this._tpOfficialCatalog &&
      cache.config === this._config) return cache.channels;
  const index = tpEpgIndex(this._guide);
  const channels = official.map(channel => {
    if (channel.epg_id) return channel;
    const station = tpEpgStationFor(channel, index);
    return station ? {...channel, epg_id:station.id} : channel;
  });
  this._tpOfficialEpgCache = {guide:this._guide, catalog:this._tpOfficialCatalog,
    config:this._config, channels};
  return channels;
};

const TP_CHANNEL_STACK_CSS = `
/* Keep the number at the side, with a readable vertical logo/name/category. */
.guide-scroll .grow:not(.head){min-height:128px!important}
.guide-scroll .grow:not(.head) .timeline{min-height:128px!important}
.guide-scroll .grow:not(.head) .ch{min-height:128px!important;align-items:center!important;
  justify-content:flex-start!important;gap:7px!important;padding:8px 9px!important}
.guide-scroll .grow:not(.head) .ch-num{flex:0 0 22px!important;width:22px!important;
  min-width:22px!important;align-self:center!important;text-align:center!important;font-size:13px!important}
.guide-scroll .grow .ch .tp-channel-stack{display:flex!important;flex:1 1 auto!important;
  flex-direction:column!important;justify-content:center!important;align-items:center!important;
  min-width:0!important;gap:3px!important;text-align:center!important}
.guide-scroll .grow .ch .ch-logo,.guide-scroll.tp-wide-tight .grow .ch .ch-logo{
  display:grid!important;place-items:center!important;flex:0 0 auto!important;
  width:94px!important;height:59px!important;max-width:100%!important;
  margin:0 auto!important;background:transparent!important;border:0!important;
  border-radius:0!important;overflow:visible!important;font-size:22px!important}
.guide-scroll .grow .ch .ch-logo img,.guide-scroll .grow .ch .ch-logo img[data-tp-official]{
  display:block!important;width:100%!important;height:100%!important;max-width:100%!important;
  object-fit:contain!important;padding:0!important;transform:scale(1.08)}
.guide-scroll .grow .ch .ch-details{display:flex!important;flex-direction:column!important;
  align-items:center!important;gap:2px!important;min-width:0!important;max-width:100%!important;width:100%!important}
.guide-scroll .grow .ch .ch-name,.guide-scroll.tp-wide-tight .ch-name{
  width:100%!important;max-width:100%!important;white-space:normal!important;
  overflow:visible!important;overflow-wrap:anywhere!important;text-overflow:clip!important;
  text-align:center!important;font-weight:750!important;font-size:12px!important;line-height:1.2!important}
.guide-scroll .grow .ch .ch-now,.guide-scroll.tp-wide-tight .ch-now{
  width:100%!important;max-width:100%!important;white-space:normal!important;
  overflow:visible!important;overflow-wrap:anywhere!important;text-overflow:clip!important;
  text-align:center!important;font-size:11px!important;line-height:1.15!important;margin:0!important}
@media(max-width:580px){
  .guide-scroll .grow:not(.head){min-height:114px!important}
  .guide-scroll .grow:not(.head) .timeline{min-height:114px!important}
  .guide-scroll .grow:not(.head) .ch{min-height:114px!important;gap:4px!important;padding:6px!important}
  .guide-scroll .grow .ch .ch-logo,.guide-scroll.tp-wide-tight .grow .ch .ch-logo{
    width:76px!important;height:48px!important}
  .guide-scroll .grow .ch .ch-name{font-size:11px!important}
  .guide-scroll .grow .ch .ch-now{font-size:10px!important}
}
`;

const tpPriorEpgRender = TP_EPG_CARD.prototype._renderGuide;
TP_EPG_CARD.prototype._renderGuide = function() {
  const previousX = this._scroll?.scrollLeft || 0;
  const previousSlot = this._tpWideSlotWidth || 0;
  tpPriorEpgRender.call(this);
  const scroll = this._scroll;
  if (!scroll || !this._rows) return;
  const catalog = this._tpOfficialCatalog?.byNumber;
  if (!catalog) return;
  for (const row of this._rows.children) {
    const button = row.querySelector?.('.ch');
    const number = button?.querySelector('.ch-num');
    const logo = button?.querySelector('.ch-logo');
    const details = button?.querySelector('.ch-details');
    const entry = catalog.get(String(number?.textContent));
    if (!entry || !logo || !details || !number) continue;
    if (!button.querySelector('.tp-channel-stack')) {
      const stack = document.createElement('span');
      stack.className = 'tp-channel-stack';
      stack.append(logo, details);
      button.append(number, stack);
    }
    const title = details.querySelector('.ch-name');
    const category = details.querySelector('.ch-now');
    if (title) title.textContent = entry.name;
    if (category) category.textContent = entry.category;
  }
  // The inherited wide-guide module sizes the time slots against its old
  // 198px column. Recompute both values together to avoid timeline clipping.
  const viewport = scroll.clientWidth || this.getBoundingClientRect?.().width || 838;
  const columnWidth = viewport < 370 ? 170 : viewport < 580 ? 192 : viewport < 740 ? 220 : 246;
  const slotWidth = Math.max(1, (viewport - columnWidth) / 4);
  const count = Math.max(4, Number(scroll.style.getPropertyValue('--tp-slot-count')) || 4);
  scroll.style.setProperty('--tp-channel-width', `${columnWidth}px`);
  scroll.style.setProperty('--tp-slot-width', `${slotWidth}px`);
  scroll.style.setProperty('--tp-total-width', `${slotWidth * count}px`);
  this._tpWideSlotWidth = slotWidth;
  if (previousSlot > 0) scroll.scrollLeft = previousX * slotWidth / previousSlot;
  this._tpUpdateWideControls?.();
  if (this._guide?.channels?.length && !this._guide.error && this._guideStatus) {
    const all = this._channels();
    const now = Date.now();
    const matched = all.filter(ch => ch.epg_id && this._guide.channels.some(s => s.id === ch.epg_id));
    const scheduled = matched.filter(ch => this._guide.channels.some(s => s.id === ch.epg_id &&
      (s.schedule || []).some(p => Date.parse(p.start) < now + 8 * 3600000 && Date.parse(p.stop) > now)));
    this._guideStatus.textContent = `${scheduled.length} of ${all.length} channels have upcoming programmes · ` +
      `${matched.length} station matches · ${this._guide.channels.length} XMLTV stations available. ` +
      'Unmatched channels may be absent from the public guide; EPG mappings can be set in the card editor.';
  }
};

const tpPriorEpgSetConfig = TP_EPG_CARD.prototype.setConfig;
TP_EPG_CARD.prototype.setConfig = function(config) {
  this._tpOfficialEpgCache = null;
  tpPriorEpgSetConfig.call(this, config);
  const root = this.shadowRoot;
  if (root && !root.querySelector('#tp-channel-stack-v0322')) {
    const style = document.createElement('style');
    style.id = 'tp-channel-stack-v0322';
    style.textContent = TP_CHANNEL_STACK_CSS;
    root.appendChild(style);
  }
  const badge = root?.querySelector('.tp-version-badge');
  if (badge) {badge.textContent = 'v0.3.22'; badge.title = 'Official Totalplay Premium / Todos · enhanced EPG matching';}
  this._renderGuide();
};
