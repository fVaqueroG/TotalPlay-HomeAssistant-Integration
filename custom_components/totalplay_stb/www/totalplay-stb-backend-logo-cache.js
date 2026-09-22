/* v0.3.43: Force official artwork through the Home Assistant backend cache.
 * This compatibility layer also protects clients that still have an older
 * catalogue module cached in the browser.
 */
const TP43_CARD = customElements.get('totalplay-stb-card');
const TP43_POPUP = customElements.get('totalplay-stb-popup-card');
if (!TP43_CARD || !TP43_POPUP) throw new Error('Totalplay cards unavailable');

const TP43_CACHE = '/totalplay_stb_cache';
const TP43_BRAND_LOCAL = `${TP43_CACHE}/brand/totalplay-horizontal.svg`;
const TP43_BRAND_REMOTE = 'https://www.totalplay.com.mx/assetsv2/img/header/totalplay-logoWhite.svg';

function tp43LocalizeCatalog(card) {
  const catalog = card?._tpOfficialCatalog;
  if (!catalog) return;
  for (const entry of [...(catalog.channels || []), ...(catalog.apps || [])]) {
    if (!entry?._tp43RemoteLogo) {
      const alreadyLocal = String(entry.logo_url || '').startsWith(TP43_CACHE);
      entry._tp43RemoteLogo = alreadyLocal ? entry.logo_fallback_url : entry.logo_url;
      entry._tp43RemoteFallback = alreadyLocal
        ? entry.logo_second_fallback_url : entry.logo_fallback_url;
    }
    const folder = entry.type === 'I' ? 'apps' : 'channels';
    entry.logo_url = `${TP43_CACHE}/${folder}/${entry.number}.png`;
    entry.logo_fallback_url = entry._tp43RemoteLogo || null;
    entry.logo_second_fallback_url = entry._tp43RemoteFallback || null;
  }
}

function tp43InstallFallback(image, entry, remove) {
  if (!image || !entry) return;
  const fallbacks = [entry.logo_fallback_url, entry.logo_second_fallback_url].filter(Boolean);
  let index = 0;
  image.onerror = () => {
    while (index < fallbacks.length) {
      const next = fallbacks[index++];
      if (next && image.src !== next) {
        image.src = next;
        return;
      }
    }
    remove?.();
  };
}

const tp43GuideRender = TP43_CARD.prototype._renderGuide;
TP43_CARD.prototype._renderGuide = function () {
  tp43LocalizeCatalog(this);
  tp43GuideRender.call(this);
  const byNumber = this._tpOfficialCatalog?.byNumber;
  if (!byNumber || !this._rows) return;
  for (const row of this._rows.children) {
    const number = row.querySelector?.('.ch-num')?.textContent?.trim();
    const badge = row.querySelector?.('.ch-logo');
    const image = badge?.querySelector('img[data-tp-official]');
    const entry = byNumber.get(String(number));
    if (!image || !entry) continue;
    tp43InstallFallback(image, entry, () => {
      if (image.parentElement === badge) {
        badge.replaceChildren(String(entry.name || '').trim().slice(0, 2).toUpperCase());
      }
    });
  }
};

const tp43AppsRender = TP43_CARD.prototype._renderApps;
TP43_CARD.prototype._renderApps = function () {
  tp43LocalizeCatalog(this);
  tp43AppsRender.call(this);
  const apply = (grid, entries) => {
    if (!grid) return;
    const buttons = [...grid.children].filter(el => el.tagName === 'BUTTON');
    entries.forEach((entry, index) => {
      const image = buttons[index]?.querySelector('.app-logo-image');
      const text = buttons[index]?.querySelector('.app-logo');
      if (!image) return;
      tp43InstallFallback(image, entry, () => {
        image.remove();
        if (text) text.hidden = false;
      });
    });
  };
  const apps = this._appsList?.() || [];
  apply(this._appsAll, apps);
  apply(this._appsRow, apps.slice(0, 6));
};

function tp43LocalBrandImage(className) {
  const image = document.createElement('img');
  image.className = className;
  image.alt = className === 'tp-brand-logo' ? 'Totalplay' : '';
  image.decoding = 'async';
  image.src = TP43_BRAND_LOCAL;
  let triedRemote = false;
  image.onerror = () => {
    if (!triedRemote) {
      triedRemote = true;
      image.src = TP43_BRAND_REMOTE;
      return;
    }
    image.remove();
  };
  return image;
}

const tp43CardConfig = TP43_CARD.prototype.setConfig;
TP43_CARD.prototype.setConfig = function (config) {
  tp43CardConfig.call(this, config);
  const old = this.shadowRoot?.querySelector('.tp-brand-logo');
  if (old && old.getAttribute('src') !== TP43_BRAND_LOCAL) {
    old.replaceWith(tp43LocalBrandImage('tp-brand-logo'));
  }
  this.shadowRoot?.querySelector('.tp-version-badge')?.replaceChildren('v0.3.43');
};

const tp43PopupConfig = TP43_POPUP.prototype.setConfig;
TP43_POPUP.prototype.setConfig = function (config) {
  tp43PopupConfig.call(this, config);
  for (const old of this.shadowRoot?.querySelectorAll('.tp42-logo') || []) {
    if (old.getAttribute('src') === TP43_BRAND_LOCAL) continue;
    old.replaceWith(tp43LocalBrandImage('tp42-logo'));
  }
};
