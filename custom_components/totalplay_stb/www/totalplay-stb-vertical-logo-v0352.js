/* v0.3.52: Render the bundled vertical Totalplay logo directly from HA.
 * Bypass earlier stacked image handlers, cache URL mutations and image races.
 * The popup trigger itself remains full-width; only its logo has a fixed size.
 */
const TP52_POPUP = customElements.get('totalplay-stb-popup-card');
if (!TP52_POPUP) throw new Error('Totalplay popup card unavailable');

const TP52_VERTICAL_STATIC = '/totalplay_stb/totalplay-vertical-logo.png?v=0.3.52';
const TP52_VERTICAL_BACKEND = '/totalplay_stb/artwork/brand/vertical?v=0.3.52';
const TP52_CSS = `
  :host([data-popup-brand="vertical_logo"]),
  :host([data-popup-brand="vertical_logo"]) ha-card,
  :host([data-popup-brand="vertical_logo"]) button {
    display:block; width:100% !important; max-width:100% !important;
    min-width:0 !important; box-sizing:border-box;
  }
  :host([data-popup-brand="vertical_logo"]) button {
    display:flex; align-items:center; justify-content:center;
  }
  :host([data-popup-brand="vertical_logo"]) .tp44-brand.tp44-vertical_logo {
    display:flex; align-items:center; justify-content:center;
    width:100%; min-width:0; flex:0 1 auto;
  }
  :host([data-popup-brand="vertical_logo"]) .tp52-vertical-logo {
    display:block; width:88px; height:88px; max-width:100%;
    object-fit:contain; flex:none;
  }
`;
const tp52PreviousConfig = TP52_POPUP.prototype.setConfig;
TP52_POPUP.prototype.setConfig = function(config) {
  tp52PreviousConfig.call(this, config);
  if (config?.popup_button_style !== 'vertical_logo') return;
  const root = this.shadowRoot;
  const brand = this._button?.querySelector('.tp44-brand');
  if (!root || !brand) return;

  if (!root.querySelector('#tp52-vertical-logo-style')) {
    const style = document.createElement('style');
    style.id = 'tp52-vertical-logo-style';
    style.textContent = TP52_CSS;
    root.appendChild(style);
  }

  // Replace *all* previous contents, including text fallback from an earlier
  // failed image load, rather than only replacing a currently present <img>.
  const image = document.createElement('img');
  image.className = 'tp44-brand-image tp44-vertical_logo-image tp52-vertical-logo';
  image.alt = '';
  image.decoding = 'async';
  image.loading = 'eager';
  let triedBackend = false;
  image.onerror = () => {
    if (!image.isConnected) return;
    if (!triedBackend) {
      triedBackend = true;
      image.src = TP52_VERTICAL_BACKEND;
      return;
    }
    const fallback = document.createElement('span');
    fallback.className = 'tp42-wordmark-fallback';
    fallback.textContent = 'Totalplay';
    image.replaceWith(fallback);
  };
  brand.replaceChildren(image);
  // Set src after insertion so cached-image load/error is never lost.
  image.src = TP52_VERTICAL_STATIC;
};
