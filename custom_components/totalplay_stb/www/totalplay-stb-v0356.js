/* v0.3.56: Render the approved vertical Totalplay logo in a clean trigger.
 * Rebuild only Vertical Logo mode after all legacy popup layers have run.
 * This avoids stale image handlers/CSS while preserving popup behaviour.
 */
import './totalplay-stb-v0355.js?v=0.3.56';

const TP56_POPUP = customElements.get('totalplay-stb-popup-card');
const TP56_FULL = customElements.get('totalplay-stb-card');
if (!TP56_POPUP || !TP56_FULL) throw new Error('Totalplay card types unavailable');

const TP56_VERTICAL_URL = '/totalplay_stb/artwork/brand/vertical?v=0.3.56';
const TP56_STYLE = `
  :host([data-popup-brand="vertical_logo"]) {
    display:block !important;
    width:100% !important;
    max-width:100% !important;
    min-width:0 !important;
  }
  :host([data-popup-brand="vertical_logo"]) ha-card,
  :host([data-popup-brand="vertical_logo"]) button {
    display:block;
    width:100% !important;
    max-width:100% !important;
    min-width:0 !important;
    box-sizing:border-box;
  }
  :host([data-popup-brand="vertical_logo"]) button {
    display:flex !important;
    align-items:center !important;
    justify-content:center !important;
    min-height:112px !important;
    padding:8px 14px !important;
  }
  .tp56-vertical-wrap {
    display:flex !important;
    align-items:center !important;
    justify-content:center !important;
    width:100% !important;
    min-width:0 !important;
    min-height:96px;
    overflow:hidden;
  }
  .tp56-vertical-logo {
    display:block !important;
    width:auto !important;
    height:92px !important;
    max-width:min(100%,190px) !important;
    max-height:92px !important;
    object-fit:contain !important;
    opacity:1 !important;
    visibility:visible !important;
    flex:0 0 auto;
  }
  .tp56-vertical-fallback {
    display:none;
    color:var(--primary-text-color,#fff);
    font-size:20px;
    font-weight:800;
    line-height:1.2;
  }
  .tp56-vertical-wrap[data-failed] .tp56-vertical-fallback {
    display:block;
  }
`;

const tp56PreviousPopupConfig = TP56_POPUP.prototype.setConfig;
TP56_POPUP.prototype.setConfig = function(config) {
  tp56PreviousPopupConfig.call(this, config);
  if (config?.popup_button_style !== 'vertical_logo') return;

  const root = this.shadowRoot;
  const button = this._button;
  if (!root || !button) return;

  if (!root.querySelector('#tp56-vertical-logo-style')) {
    const style = document.createElement('style');
    style.id = 'tp56-vertical-logo-style';
    style.textContent = TP56_STYLE;
    root.appendChild(style);
  }

  const wrap = document.createElement('span');
  wrap.className = 'tp56-vertical-wrap';
  wrap.setAttribute('aria-hidden', 'true');

  const image = document.createElement('img');
  image.className = 'tp56-vertical-logo';
  image.alt = '';
  image.decoding = 'async';
  image.loading = 'eager';

  const fallback = document.createElement('span');
  fallback.className = 'tp56-vertical-fallback';
  fallback.textContent = 'Totalplay';

  image.addEventListener('load', () => {
    wrap.removeAttribute('data-failed');
  });
  image.addEventListener('error', () => {
    if (!image.isConnected) return;
    image.remove();
    wrap.setAttribute('data-failed', '');
  }, {once:true});

  wrap.append(image, fallback);
  // Remove all older logo elements/handlers in this mode. The click listener
  // stays on the existing button, so popup behaviour is unchanged.
  button.replaceChildren(wrap);

  this.setAttribute('data-popup-trigger', 'vertical_logo');
  this.setAttribute('data-popup-brand', 'vertical_logo');
  this.setAttribute('data-popup-icon-text', 'no');
  button.setAttribute(
    'aria-label',
    `Open ${config.popup_title || config.title || 'Totalplay'} guide and remote`
  );

  // Assign only after insertion so even an immediate cached load/error is seen.
  image.src = TP56_VERTICAL_URL;
};

const tp56PreviousFullConfig = TP56_FULL.prototype.setConfig;
TP56_FULL.prototype.setConfig = function(config) {
  tp56PreviousFullConfig.call(this, config);
  this.shadowRoot?.querySelector('.tp-version-badge')?.replaceChildren('v0.3.56');
};
