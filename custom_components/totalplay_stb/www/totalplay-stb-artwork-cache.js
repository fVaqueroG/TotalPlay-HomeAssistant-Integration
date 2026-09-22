/* Use Home Assistant's persistent artwork cache for the full guide, apps,
 * official channel icons and both popup logo modes. Retain original provider
 * URLs only as an image fallback if a local cache request cannot succeed.
 */
const TP_ART_CARD = customElements.get('totalplay-stb-card');
const TP_ART_POPUP = customElements.get('totalplay-stb-popup-card');
if (!TP_ART_CARD || !TP_ART_POPUP) throw new Error('Totalplay cards unavailable');

const TP_ART_BRAND = '/totalplay_stb/artwork/brand/totalplay';
const TP_ART_CDN = /^https:\/\/imgn\.cdn\.iutpcdn\.com\/IMGS\/CHANNEL\/(SUPER_LIGHT|SUPER)\/([0-9]{1,8})-8c\.png$/i;
const tpArtLocal = source => {
  const match = TP_ART_CDN.exec(String(source || ''));
  return match ? `/totalplay_stb/artwork/${match[1].toUpperCase() === 'SUPER' ? 'super' : 'light'}/${match[2]}` : source;
};
const tpArtRetainOriginal = entry => {
  if (!entry || entry._tpArtworkLocalized) return;
  entry._tpArtworkLocalized = true;
  entry._tpArtworkOriginal = entry.logo_url;
  entry._tpArtworkOriginalFallback = entry.logo_fallback_url;
  entry.logo_url = tpArtLocal(entry.logo_url);
  if (entry.logo_fallback_url) entry.logo_fallback_url = tpArtLocal(entry.logo_fallback_url);
};
const tpArtLocalizeCatalog = card => {
  const catalog = card._tpOfficialCatalog;
  if (!catalog || catalog._tpArtworkLocalized) return;
  catalog._tpArtworkLocalized = true;
  for (const entry of [...(catalog.channels || []), ...(catalog.apps || [])]) tpArtRetainOriginal(entry);
};

// The inherited _loadLineup calls _renderGuide and _renderApps immediately
// after setting the catalog. Localize IDs BEFORE those DOM renderers run.
const tpArtPriorGuide = TP_ART_CARD.prototype._renderGuide;
TP_ART_CARD.prototype._renderGuide = function (...args) {
  tpArtLocalizeCatalog(this);
  const result = tpArtPriorGuide.apply(this, args);
  const byNumber = this._tpOfficialCatalog?.byNumber;
  if (!byNumber || !this._rows) return result;
  for (const row of this._rows.children) {
    const number = row.querySelector?.('.ch-num')?.textContent?.trim();
    const image = row.querySelector?.('img[data-tp-official]');
    const badge = image?.parentElement;
    const entry = byNumber.get(String(number));
    if (!image || !badge || !entry) continue;
    const choices = [entry.logo_url, entry.logo_fallback_url,
      entry._tpArtworkOriginal, entry._tpArtworkOriginalFallback].filter(Boolean);
    image.onerror = () => {
      const position = choices.indexOf(image.getAttribute('src'));
      if (position + 1 < choices.length) image.src = choices[position + 1];
      else if (image.parentElement === badge) badge.replaceChildren(String(entry.name || '').slice(0,2).toUpperCase());
    };
  }
  return result;
};

const tpArtPriorApps = TP_ART_CARD.prototype._renderApps;
TP_ART_CARD.prototype._renderApps = function (...args) {
  tpArtLocalizeCatalog(this);
  const result = tpArtPriorApps.apply(this, args);
  const entries = this._appsList?.() || [];
  const attach = (grid, items) => {
    if (!grid) return;
    const buttons = [...grid.children].filter(el => el.tagName === 'BUTTON');
    items.forEach((entry, index) => {
      const button = buttons[index];
      const image = button?.querySelector('.app-logo-image');
      const text = button?.querySelector('.app-logo');
      if (!image || !entry) return;
      const choices = [entry.logo_url, entry.logo_fallback_url,
        entry._tpArtworkOriginal, entry._tpArtworkOriginalFallback].filter(Boolean);
      image.onerror = () => {
        const position = choices.indexOf(image.getAttribute('src'));
        if (position + 1 < choices.length) image.src = choices[position + 1];
        else { image.remove(); if (text) text.hidden = false; }
      };
    });
  };
  attach(this._appsAll, entries);
  attach(this._appsRow, entries.slice(0, 6));
  return result;
};

// The old logo modules install an error handler that removes the logo. Clone
// their images synchronously to replace that handler before the local request
// can fail; fall back to the original official logo URL when needed.
const tpArtSwitchBrand = (brand, mark) => {
  if (!brand) return;
  const remote = brand.src;
  const image = brand.cloneNode(false);
  let triedRemote = false;
  image.addEventListener('load', () => {
    if (mark) mark.style.display = 'none';
  });
  image.addEventListener('error', () => {
    if (!image.isConnected) return;
    if (!triedRemote && remote !== TP_ART_BRAND) {
      triedRemote = true;
      image.src = remote;
      return;
    }
    if (mark) {
      mark.style.display = 'grid';
      image.remove();
    } else {
      const fallback = document.createElement('span');
      fallback.textContent = 'Totalplay';
      fallback.className = 'tp42-wordmark-fallback';
      image.replaceWith(fallback);
    }
  });
  brand.replaceWith(image);
  image.src = TP_ART_BRAND;
};

const tpArtPriorConfig = TP_ART_CARD.prototype.setConfig;
TP_ART_CARD.prototype.setConfig = function (config) {
  tpArtPriorConfig.call(this, config);
  const root = this.shadowRoot;
  tpArtSwitchBrand(root?.querySelector('img.tp-brand-logo'), root?.querySelector('.header .mark'));
};

const tpArtPriorPopupConfig = TP_ART_POPUP.prototype.setConfig;
TP_ART_POPUP.prototype.setConfig = function (config) {
  tpArtPriorPopupConfig.call(this, config);
  tpArtSwitchBrand(this.shadowRoot?.querySelector('img.tp42-logo, img.tp-p-logo'));
};
