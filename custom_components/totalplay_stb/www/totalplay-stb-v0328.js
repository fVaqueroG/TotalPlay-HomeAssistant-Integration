/* v0.3.28: Group the guide by official category and put its mosaic first.
 * Sorting happens before filtering/pagination; tuning always uses the original
 * Totalplay channel number. This module changes display order only.
 */
import './totalplay-stb-v0325.js?v=0.3.28';

const TP_GROUP_CARD = customElements.get('totalplay-stb-card');
if (!TP_GROUP_CARD) throw new Error('Totalplay card unavailable');

const TP_MOSAIC_CATEGORY_ALIASES = Object.freeze({
  abierto: 'abierta', abierta: 'abierta', tvabierta: 'abierta',
  ninos: 'infantiles', infantil: 'infantiles', infantiles: 'infantiles',
  deportes: 'deportetotal', deporte: 'deportetotal', deportestotal: 'deportetotal',
  mundocultura: 'mundoycultura', cultura: 'mundoycultura',
  entretenimiento: 'entretenimiento', cine: 'cine', noticias: 'noticias',
  internacionales: 'internacionales', internacional: 'internacionales',
  musica: 'musica', musical: 'musica', audio: 'audio',
});
function tpGuideCategoryKey(value) {
  const normalized = String(value || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  return TP_MOSAIC_CATEGORY_ALIASES[normalized] || normalized || 'custom';
}
function tpMosaicCategoryKey(channel, regularCategories) {
  const original = String(channel.name || '').trim()
    .replace(/^mosaico(?:\s+\d+)?[\s:–-]*/i, '')
    .replace(new RegExp(`^${String(channel.number)}[\\s:–-]*`), '');
  // A mosaic may be labelled "Abierto" while the regular channel category is
  // "Abierta". Its actual number must never determine its display position.
  for (const text of [original, channel.category]) {
    const key = tpGuideCategoryKey(text);
    if (regularCategories.has(key)) return key;
  }
  // Do not assign an unrelated category if the catalog adds a new mosaic.
  return tpGuideCategoryKey(channel.category || original);
}

const tpPreviousGroupedChannels = TP_GROUP_CARD.prototype._channels;
TP_GROUP_CARD.prototype._channels = function () {
  const original = tpPreviousGroupedChannels.call(this);
  if (original.length < 2 || !original.some(ch => ch.type === 'M')) return original;

  const known = new Map();
  for (const channel of original) {
    if (channel.type !== 'M') {
      const key = tpGuideCategoryKey(channel.category);
      if (!known.has(key)) known.set(key, String(channel.category || 'Custom'));
    }
  }

  const sections = new Map();
  for (const channel of original) {
    const key = channel.type === 'M'
      ? tpMosaicCategoryKey(channel, known)
      : tpGuideCategoryKey(channel.category);
    if (!sections.has(key)) sections.set(key, {firstRegular: Infinity, firstAny: Infinity, mosaics: [], regular: []});
    const section = sections.get(key);
    const number = Number(channel.number);
    section.firstAny = Math.min(section.firstAny, number);
    if (channel.type === 'M') {
      // Use the target category for guide filtering while keeping the
      // official catalog entry, banner label, logo and tune number unchanged.
      section.mosaics.push(known.has(key) && tpGuideCategoryKey(channel.category) !== key
        ? {...channel, category: known.get(key)} : channel);
    } else {
      section.firstRegular = Math.min(section.firstRegular, number);
      section.regular.push(channel);
    }
  }

  return [...sections.values()]
    .sort((a, b) => (Number.isFinite(a.firstRegular) ? a.firstRegular : a.firstAny)
      - (Number.isFinite(b.firstRegular) ? b.firstRegular : b.firstAny)
      || a.firstAny - b.firstAny)
    .flatMap(section => [
      ...section.mosaics.sort((a, b) => Number(a.number) - Number(b.number)),
      ...section.regular.sort((a, b) => Number(a.number) - Number(b.number)),
    ]);
};

const tpPreviousGroupedConfig = TP_GROUP_CARD.prototype.setConfig;
TP_GROUP_CARD.prototype.setConfig = function (config) {
  tpPreviousGroupedConfig.call(this, config);
  this.shadowRoot?.querySelector('.tp-version-badge')?.replaceChildren('v0.3.28');
};
