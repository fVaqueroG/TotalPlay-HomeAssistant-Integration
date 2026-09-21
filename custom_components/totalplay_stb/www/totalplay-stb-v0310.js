/* Totalplay card v0.3.10: correct HBO Max label and TMDB artwork. */
import './totalplay-stb-v037.js?v=0.3.10';

const TotalplayHboCard = customElements.get('totalplay-stb-card');
if (!TotalplayHboCard) throw new Error('Totalplay card did not load');

const tpOriginalAppsList = TotalplayHboCard.prototype._appsList;
TotalplayHboCard.prototype._appsList = function () {
  return tpOriginalAppsList.call(this).map(app =>
    String(app.number) === '413' && /^(?:max|hbo\s*max)$/i.test(String(app.name || '').trim())
      ? {...app, name: 'HBO Max'} : app);
};

const tpOriginalRenderApps = TotalplayHboCard.prototype._renderApps;
TotalplayHboCard.prototype._renderApps = function () {
  const allProviders = this._tpLogoProviders;
  if (!Array.isArray(allProviders)) return tpOriginalRenderApps.call(this);
  // TMDB has used both 'Max' and 'HBO Max'. The original strict alias expects
  // 'Max'; expose the HBO Max artwork under that name when it is available,
  // without ever choosing 'Max Amazon Channel' or another lookalike service.
  const hboMax = allProviders.filter(provider =>
    String(provider.provider_name || '').trim().toLowerCase() === 'hbo max' && provider.logo_path);
  if (hboMax.length) {
    this._tpLogoProviders = [
      ...allProviders.filter(provider => !['max', 'hbo max'].includes(
        String(provider.provider_name || '').trim().toLowerCase())),
      ...hboMax.map(provider => ({...provider, provider_name: 'Max'})),
    ];
  }
  try {
    return tpOriginalRenderApps.call(this);
  } finally {
    this._tpLogoProviders = allProviders;
  }
};

const tpOriginalSetConfig = TotalplayHboCard.prototype.setConfig;
TotalplayHboCard.prototype.setConfig = function (config) {
  tpOriginalSetConfig.call(this, config);
  this.shadowRoot?.querySelector('.tp-version-badge')?.replaceChildren('Card v0.3.10');
  this._renderApps();
};
