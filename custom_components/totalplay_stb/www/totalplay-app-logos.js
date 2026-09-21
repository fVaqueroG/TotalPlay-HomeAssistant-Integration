/* Totalplay Apps logos v0.3.8. App logos are visual only; launch routing is unchanged. */
import './totalplay-pages-remote.js?v=0.3.7';

const TP_LOGO_CARD = customElements.get('totalplay-stb-card');
const TP_LOGO_EDITOR = customElements.get('totalplay-stb-card-editor');
if (!TP_LOGO_CARD || !TP_LOGO_EDITOR) throw new Error('Totalplay card or editor did not load');

const TP_APP_LOGO_CSS = `
.apps-only .apps-grid {grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:12px}
.apps-only .app {min-height:108px;padding:14px 9px 10px;gap:10px;position:relative}
.apps-only .app-logo-image {display:block;width:64px;height:64px;max-width:100%;object-fit:contain;border-radius:13px;background:transparent}
.apps-only .app-logo {font-size:13px;letter-spacing:normal;text-align:center;overflow-wrap:anywhere}
.apps-only .app-num {font-size:11px}
.apps-only .tp-app-logo-note {font-size:11px;color:var(--tp-sub);margin:8px 0}
@media(max-width:580px) {.apps-only .apps-grid {grid-template-columns:repeat(auto-fill,minmax(95px,1fr));gap:8px}.apps-only .app {min-height:96px}}
`;
const TP_CANONICAL_PROVIDERS = Object.freeze({
  netflix: 'netflix', disney: 'disney plus', disneyplus: 'disney plus',
  primevideo: 'amazon prime video', amazonprimevideo: 'amazon prime video',
  max: 'max', hbomax: 'max', paramount: 'paramount plus', paramountplus: 'paramount plus',
  vix: 'vix', vixpremium: 'vix',
  pluto: 'pluto tv', plutotv: 'pluto tv',
  crunchyroll: 'crunchyroll', mubi: 'mubi',
  clarovideo: 'claro video',
});
const tpLogoName = value => String(value || '').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const tpAppName = value => tpLogoName(String(value || '').replace(/\s*\([^)]*\)\s*/g, ''));
const tpProviderName = value => tpLogoName(value);
const tpValidLogoPath = path => typeof path === 'string' && /^\/[a-zA-Z0-9_-]+\.(?:png|jpe?g)$/.test(path);

function tpLogoForApp(app, providers) {
  if (!Array.isArray(providers)) return null;
  const explicit = Number(app?.tmdb_provider_id);
  const name = tpAppName(app?.name);
  const target = TP_CANONICAL_PROVIDERS[name];
  const valid = providers.filter(p => tpValidLogoPath(p.logo_path));
  let candidates;
  if (explicit > 0) {
    candidates = valid.filter(p => Number(p.provider_id) === explicit);
  } else if (name === 'appletv' || name === 'appletvplus') {
    // '+' is stripped during normalization. Use the Apple TV+ subscription
    // provider ID, never the distinct Apple TV Store purchase/rental service.
    candidates = valid.filter(p => Number(p.provider_id) === 350);
  } else if (name === 'youtube') {
    // Prefer the generic YouTube brand, when TMDB lists it. If the provider
    // catalog has only YouTube Premium, use its YouTube-branded logo as a
    // visual fallback; this does not change which Totalplay app launches.
    candidates = valid.filter(p => tpProviderName(p.provider_name) === 'youtube');
    if (!candidates.length) candidates = valid.filter(p => tpProviderName(p.provider_name) === 'youtubepremium');
  } else {
    candidates = valid.filter(p => target && tpProviderName(p.provider_name) === tpProviderName(target));
  }
  if (!candidates.length) return null;
  const paths = [...new Set(candidates.map(p => p.logo_path))];
  return paths.length === 1 ? `https://image.tmdb.org/t/p/w154${paths[0]}` : null;
}

const tpOldRenderApps = TP_LOGO_CARD.prototype._renderApps;
const tpOldSetConfig = TP_LOGO_CARD.prototype.setConfig;
const tpOldSwitch = TP_LOGO_CARD.prototype._switch;
const tpOldEditorDraw = TP_LOGO_EDITOR.prototype._draw;

TP_LOGO_CARD.prototype._renderApps = function () {
  tpOldRenderApps.call(this);
  if (!this._appsAll) return;
  const apps = this._appsList();
  const buttons = [...this._appsAll.children].filter(node => node.tagName?.toLowerCase() === 'button');
  for (const [i, app] of apps.entries()) {
    const button = buttons[i];
    const text = button?.querySelector('.app-logo');
    if (!button || !text) continue;
    const logo = tpLogoForApp(app, this._tpLogoProviders);
    if (!logo) continue;
    const image = document.createElement('img');
    image.className = 'app-logo-image';
    image.src = logo;
    image.alt = `${app.name} logo`;
    image.loading = 'lazy';
    image.decoding = 'async';
    image.addEventListener('error', () => { image.remove(); text.hidden = false; }, {once:true});
    text.hidden = true;
    button.insertBefore(image, text);
    button.title = `${app.name} · channel ${app.number}`;
  }
  const note = this._appsPanel?.querySelector('.tp-app-logo-note');
  if (note) {
    note.textContent = !this._config?.tmdb_api_key
      ? 'Enter your TMDB API key in the card editor to load app logos.'
      : this._tpLogoError || (this._tpLogoProviders?.length ? 'App logos: TMDB · unmatched apps use text labels.' : 'Loading app logos from TMDB…');
  }
};

TP_LOGO_CARD.prototype._loadTmdbLogos = async function () {
  const key = String(this._config?.tmdb_api_key || '').trim();
  if (!key || this._tpLogoLoading || this._tpLogoLoadedKey === key) return;
  this._tpLogoLoading = true;
  this._tpLogoError = '';
  const currentRequest = (this._tpLogoRequest || 0) + 1;
  this._tpLogoRequest = currentRequest;
  try {
    const base = 'https://api.themoviedb.org/3/watch/providers/';
    const headers = {Accept: 'application/json'};
    const results = await Promise.allSettled(['movie', 'tv'].map(async type => {
      const url = `${base}${type}?api_key=${encodeURIComponent(key)}&language=en-US`;
      const response = await fetch(url, {headers});
      if (!response.ok) throw Error(`TMDB ${type} provider request: HTTP ${response.status}`);
      const json = await response.json();
      if (!Array.isArray(json.results)) throw Error(`TMDB ${type} provider list is invalid`);
      return json.results;
    }));
    if (this._tpLogoRequest !== currentRequest || this._config?.tmdb_api_key !== key) return;
    const providers = results.filter(r => r.status === 'fulfilled').flatMap(r => r.value);
    if (!providers.length) {
      const rejection = results.find(r => r.status === 'rejected');
      throw Error(rejection?.reason?.message || 'TMDB returned no provider logos');
    }
    const unique = new Map();
    for (const provider of providers) {
      if (!provider?.provider_id || !provider?.provider_name) continue;
      const id = String(provider.provider_id);
      if (!unique.has(id) || (!unique.get(id).logo_path && provider.logo_path)) unique.set(id, provider);
    }
    this._tpLogoProviders = [...unique.values()];
    this._tpLogoLoadedKey = key;
  } catch (error) {
    if (this._tpLogoRequest !== currentRequest) return;
    const message = String(error?.message || 'TMDB logo request failed');
    this._tpLogoError = `App logos unavailable: ${message}. App launching still works.`;
  } finally {
    if (this._tpLogoRequest === currentRequest) {
      this._tpLogoLoading = false;
      this._renderApps();
    }
  }
};

TP_LOGO_CARD.prototype._switch = function (tab) {
  tpOldSwitch.call(this, tab);
  if (tab === 'apps') this._loadTmdbLogos();
};
TP_LOGO_CARD.prototype.setConfig = function (config) {
  const key = String(config?.tmdb_api_key || '').trim();
  if (key !== this._tpLogoLoadedKey) {
    this._tpLogoRequest = (this._tpLogoRequest || 0) + 1;
    this._tpLogoProviders = null;
    this._tpLogoLoadedKey = null;
    this._tpLogoLoading = false;
    this._tpLogoError = '';
  }
  tpOldSetConfig.call(this, config);
  if (this._appsPanel && !this._appsPanel.querySelector('.tp-app-logo-note')) {
    const note = document.createElement('div');
    note.className = 'tp-app-logo-note';
    const grid = this._appsAll;
    this._appsPanel.insertBefore(note, grid || null);
  }
  if (this.shadowRoot && !this.shadowRoot.querySelector('#tp-app-logo-style')) {
    const style = document.createElement('style');
    style.id = 'tp-app-logo-style';
    style.textContent = TP_APP_LOGO_CSS;
    this.shadowRoot.appendChild(style);
  }
  this.shadowRoot?.querySelector('.tp-version-badge')?.replaceChildren('Card v0.3.8');
  this._renderApps();
  if (this._tab === 'apps') this._loadTmdbLogos();
};

TP_LOGO_EDITOR.prototype._draw = function () {
  tpOldEditorDraw.call(this);
  const root = this.shadowRoot;
  if (!root || !this._config || root.querySelector('#tp-tmdb-api-key')) return;
  const section = document.createElement('div');
  section.className = 'group';
  const label = document.createElement('label');
  label.className = 'field';
  const title = document.createElement('span');
  title.textContent = 'TMDB API key (v3) · Apps logos';
  const input = document.createElement('input');
  input.id = 'tp-tmdb-api-key';
  input.type = 'password';
  input.autocomplete = 'off';
  input.value = this._config.tmdb_api_key || '';
  input.placeholder = 'Enter your TMDB v3 API key';
  input.addEventListener('change', () => this._change({tmdb_api_key: input.value.trim()}));
  label.append(title, input);
  const help = document.createElement('p');
  help.className = 'help';
  help.textContent = 'TMDB logos load only on the Apps page. This key is stored in your Lovelace card configuration and is visible to dashboard editors; do not enter a private account password or an unrestricted credential. Unknown apps keep their text labels.';
  section.append(label, help);
  root.appendChild(section);
};
