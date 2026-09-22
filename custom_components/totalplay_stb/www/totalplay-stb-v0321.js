/* v0.3.21: Totalplay.com.mx Parrilla Premium / Todos snapshot (2026-09-22).
 * Only the official numbers/names/categories/image IDs are displayed.
 * XMLTV remains a programme-data source, never a channel/branding source.
 */
import './totalplay-stb-v0320.js?v=0.3.21';

const TP_OFFICIAL_DATA_URL = '/totalplay_stb/premium-catalog.zlib.txt';
const TP_OFFICIAL_SOURCE = 'https://totalplay.com.mx/canales';
const TP_IMAGE_ROOT = 'https://imgn.cdn.iutpcdn.com/IMGS/CHANNEL/';
const TP_IMAGE_CACHE_ROOT = '/totalplay_stb_cache';
const TP_CARD = customElements.get('totalplay-stb-card');
if (!TP_CARD) throw new Error('Totalplay card unavailable');
let tpCatalogPromise;
async function tpGetOfficialCatalog() {
  if (!tpCatalogPromise) tpCatalogPromise = (async () => {
    if (typeof DecompressionStream !== 'function') throw new Error('This browser does not support the bundled channel catalogue');
    const response = await fetch(TP_OFFICIAL_DATA_URL, {cache: 'no-store'});
    if (!response.ok) throw new Error(`Official lineup HTTP ${response.status}`);
    const encoded = (await response.text()).replace(/\s+/g, '');
    const bytes = Uint8Array.from(atob(encoded), ch => ch.charCodeAt(0));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
    const [categories, rows] = JSON.parse(await new Response(stream).text());
    if (!Array.isArray(categories) || !Array.isArray(rows) || rows.length !== 313) throw new Error('Invalid Totalplay Premium catalogue');
    const seen = new Set(), channels = [], apps = [];
    for (const [number, name, group, type, lightId, superId] of rows) {
      if (!Number.isInteger(number) || number <= 0 || number > 9999 || seen.has(number)
          || typeof name !== 'string' || !name || !categories[group]
          || !['C', 'M', 'I'].includes(type) || !Number.isInteger(lightId) || lightId <= 0) {
        throw new Error('Invalid or duplicate official Totalplay channel');
      }
      seen.add(number);
      const remoteLogo = `${TP_IMAGE_ROOT}SUPER_LIGHT/${lightId}-8c.png`;
      const remoteFallback = Number.isInteger(superId) && superId > 0
        ? `${TP_IMAGE_ROOT}SUPER/${superId}-8c.png` : null;
      const entry = {
        number: String(number), name, category: categories[group], type,
        logo_url: `${TP_IMAGE_CACHE_ROOT}/${type === 'I' ? 'apps' : 'channels'}/${number}.png`,
        logo_fallback_url: remoteLogo,
        logo_second_fallback_url: remoteFallback,
      };
      (type === 'I' ? apps : channels).push(entry);
    }
    return {channels, apps, byNumber: new Map([...channels, ...apps].map(ch => [ch.number, ch]))};
  })();
  return tpCatalogPromise;
}

// The older frontend merges a community list and additional guessed channel
// numbers. No such entry may bypass the official catalogue (even via overrides).
TP_CARD.prototype._channels = function() {
  const source = this._tpOfficialCatalog?.channels || [];
  const overrides = new Map((this._config?.channels || []).map(ch => [String(ch.number), ch]));
  const base = this._config?.lineup === false ? source.filter(ch => overrides.has(ch.number)) : source;
  return base.map(ch => {
    const override = overrides.get(ch.number);
    return override ? {...ch, epg_id: override.epg_id, epg_name: override.epg_name,
      program_entity: override.program_entity} : ch;
  });
};
TP_CARD.prototype._appsList = function() {
  const source = this._tpOfficialCatalog?.apps || [];
  if (this._config?.lineup !== false) return source;
  const wanted = new Set((this._config?.apps || []).map(ch => String(ch.number)));
  return source.filter(ch => wanted.has(ch.number));
};

TP_CARD.prototype._loadLineup = async function() {
  if (!this._hass || this._tpOfficialLoading || this._tpOfficialCatalog) return;
  this._tpOfficialLoading = true;
  try {
    this._tpOfficialCatalog = await tpGetOfficialCatalog();
    this._lineupLoaded = true;
    this._lineupError = null;
    this._renderGuide();
    this._renderApps();
  } catch (error) {
    this._lineupError = `Official Premium catalogue unavailable: ${error?.message || error}`;
    this._lineupLoaded = false;
    console.error('Totalplay official catalogue:', error);
    if (this._guideStatus) this._guideStatus.textContent = this._lineupError;
  } finally { this._tpOfficialLoading = false; }
};

const tpRenderGuideOld = TP_CARD.prototype._renderGuide;
TP_CARD.prototype._renderGuide = function() {
  tpRenderGuideOld.call(this);
  const byNumber = this._tpOfficialCatalog?.byNumber;
  if (!byNumber || !this._rows) return;
  for (const row of this._rows.children) {
    const number = row.querySelector?.('.ch-num')?.textContent;
    const badge = row.querySelector?.('.ch-logo');
    const entry = byNumber.get(String(number));
    if (!badge || !entry?.logo_url) continue;
    const current = badge.querySelector('img[data-tp-official]');
    if (current?.getAttribute('src') === entry.logo_url) continue;
    const initials = String(entry.name).trim().slice(0, 2).toUpperCase();
    const img = document.createElement('img');
    img.dataset.tpOfficial = '1';
    img.alt = `${entry.name} logo`;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.referrerPolicy = 'no-referrer';
    const fallbacks = [entry.logo_fallback_url, entry.logo_second_fallback_url].filter(Boolean);
    let fallbackIndex = 0;
    img.onerror = () => {
      while (fallbackIndex < fallbacks.length) {
        const next = fallbacks[fallbackIndex++];
        if (next && img.src !== next) { img.src = next; return; }
      }
      if (img.parentElement === badge) badge.replaceChildren(initials);
    };
    img.src = entry.logo_url;
    badge.replaceChildren(img);
  }
};

const tpRenderAppsOld = TP_CARD.prototype._renderApps;
TP_CARD.prototype._renderApps = function() {
  tpRenderAppsOld.call(this);
  if (!this._tpOfficialCatalog) return;
  const apps = this._appsList();
  const apply = (grid, entries) => {
    if (!grid) return;
    const buttons = [...grid.children].filter(el => el.tagName === 'BUTTON');
    entries.forEach((entry, index) => {
      const button = buttons[index];
      const text = button?.querySelector('.app-logo');
      if (!button || !text) return;
      button.querySelectorAll('.app-logo-image').forEach(img => img.remove());
      text.hidden = false;
      const image = document.createElement('img');
      image.className = 'app-logo-image';
      image.alt = `${entry.name} logo`;
      image.loading = 'lazy';
      image.decoding = 'async';
      image.referrerPolicy = 'no-referrer';
      const fallbacks = [entry.logo_fallback_url, entry.logo_second_fallback_url].filter(Boolean);
      let fallbackIndex = 0;
      image.onerror = () => {
        while (fallbackIndex < fallbacks.length) {
          const next = fallbacks[fallbackIndex++];
          if (next && image.src !== next) { image.src = next; return; }
        }
        image.remove(); text.hidden = false;
      };
      image.src = entry.logo_url;
      text.hidden = true;
      button.insertBefore(image, text);
    });
  };
  apply(this._appsAll, apps);
  apply(this._appsRow, apps.slice(0, 6));
  const note = this._appsPanel?.querySelector('.tp-app-logo-note');
  if (note) note.textContent = 'Apps and logos: official Totalplay Parrilla Premium / Todos snapshot.';
};

const tpSetConfigOld = TP_CARD.prototype.setConfig;
TP_CARD.prototype.setConfig = function(config) {
  tpSetConfigOld.call(this, config);
  const root = this.shadowRoot;
  if (root && !root.querySelector('#tp-premium-catalog-v0321')) {
    const style = document.createElement('style');
    style.id = 'tp-premium-catalog-v0321';
    style.textContent = '.ch-logo img[data-tp-official]{width:100%;height:100%;object-fit:contain;padding:1px;display:block}.apps-only .app-logo-image,.apps-strip .app-logo-image{max-width:100%;width:67px;height:59px;object-fit:contain;background:transparent}';
    root.appendChild(style);
  }
  const badge = root?.querySelector('.tp-version-badge');
  if (badge) {badge.textContent = 'v0.3.21'; badge.title = `Official Totalplay Premium / Todos · ${TP_OFFICIAL_SOURCE}`;}
  this._loadLineup();
};
