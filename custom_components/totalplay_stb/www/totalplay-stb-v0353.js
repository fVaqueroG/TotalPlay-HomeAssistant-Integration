/* v0.3.53: Restore vertical logo display without v0.3.52's extra image and CSS layer.
 * The approved PNG remains served by Home Assistant's packaged-artwork backend.
 * Retain the v0.3.51 popup auto-close behavior and the full-width trigger.
 */
import './totalplay-stb-v0351.js?v=0.3.53';

const TP53_POPUP = customElements.get('totalplay-stb-popup-card');
const TP53_FULL = customElements.get('totalplay-stb-card');
if (!TP53_POPUP || !TP53_FULL) throw new Error('Totalplay card types unavailable');

const TP53_VERTICAL_URL = '/totalplay_stb/artwork/brand/vertical?v=0.3.53';
const TP53_STYLE = `
  :host([data-popup-brand="vertical_logo"]) ha-card,
  :host([data-popup-brand="vertical_logo"]) button {
    width:100% !important; max-width:100% !important; min-width:0 !important;
    box-sizing:border-box;
  }
  :host([data-popup-brand="vertical_logo"]) button {
    display:flex !important; align-items:center !important;
    justify-content:center !important; min-height:110px;
  }
  :host([data-popup-brand="vertical_logo"]) .tp53-brand {
    position:relative; display:flex !important; align-items:center !important;
    justify-content:center !important; width:100%; min-width:0;
    min-height:92px; flex:1 1 auto;
  }
  :host([data-popup-brand="vertical_logo"]) .tp53-logo {
    display:block !important; width:auto !important; height:92px !important;
    max-width:min(100%,180px) !important; min-width:1px;
    object-fit:contain !important; opacity:1 !important;
    visibility:visible !important; flex:0 0 auto;
  }
  :host([data-popup-brand="vertical_logo"]) .tp53-logo-fallback {
    display:none; color:var(--primary-text-color,#fff);
    font-size:20px; font-weight:800; text-align:center;
  }
  :host([data-popup-brand="vertical_logo"]) .tp53-brand[data-logo-failed] .tp53-logo-fallback {
    display:block;
  }
`;

const tp53PreviousPopupConfig = TP53_POPUP.prototype.setConfig;
TP53_POPUP.prototype.setConfig = function(config) {
  tp53PreviousPopupConfig.call(this, config);
  if (config?.popup_button_style !== 'vertical_logo') return;
  const root = this.shadowRoot;
  const button = this._button;
  if (!root || !button) return;
  if (!root.querySelector('#tp53-vertical-style')) {
    const style = document.createElement('style');
    style.id = 'tp53-vertical-style';
    style.textContent = TP53_STYLE;
    root.appendChild(style);
  }
  const brand = document.createElement('span');
  brand.className = 'tp42-brand tp44-brand tp44-vertical_logo tp53-brand';
  brand.setAttribute('aria-hidden','true');
  const logo = document.createElement('img');
  logo.className = 'tp44-brand-image tp44-vertical_logo-image tp53-logo';
  logo.alt = 'Totalplay';
  logo.decoding = 'async';
  logo.loading = 'eager';
  const fallback = document.createElement('span');
  fallback.className = 'tp53-logo-fallback';
  fallback.textContent = 'Totalplay';
  logo.onerror = () => {
    if (!logo.isConnected) return;
    logo.remove();
    brand.setAttribute('data-logo-failed','');
  };
  brand.append(logo,fallback);
  const previous = button.querySelector('.tp44-brand,.tp42-brand,.tp-p-mark,.tp-p-logo,.tp-p-icon,.tp-p-logo-fallback');
  if (previous) previous.replaceWith(brand);
  else button.prepend(brand);
  this.setAttribute('data-popup-brand','vertical_logo');
  button.setAttribute('aria-label',`Open ${config.popup_title || config.title || 'Totalplay'} guide and remote`);
  // Always use the packaged PNG backend. Never retry the old SVG or the
  // v0.3.52 static URL; either failure now produces a visible fallback.
  logo.src = TP53_VERTICAL_URL;
};

const tp53PreviousFullConfig = TP53_FULL.prototype.setConfig;
TP53_FULL.prototype.setConfig = function(config) {
  tp53PreviousFullConfig.call(this,config);
  this.shadowRoot?.querySelector('.tp-version-badge')?.replaceChildren('v0.3.53');
};
