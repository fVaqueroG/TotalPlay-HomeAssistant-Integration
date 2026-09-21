/* Totalplay card v0.3.13: dedicated Guide and Apps pages with an on-demand remote. */
import './totalplay-stb-v0311.js?v=0.3.13';

const TP_PAGE_CARD = customElements.get('totalplay-stb-card');
if (!TP_PAGE_CARD) throw new Error('Totalplay card did not load');

// The inherited pages/remote module owns the actual command handlers, Escape
// handling and portal lifecycle. Only move its trigger and restyle that portal.
const PAGE_CSS = `
.apps-strip,.guide-panel .apps-strip {display:none!important}
.header .tabs {display:flex!important;order:3;width:100%;min-width:0;align-items:center;gap:5px;flex-wrap:nowrap;padding:4px}
.header .tabs .tab {flex:1 1 0;min-width:0;white-space:nowrap}
.header .tabs .tp-remote-trigger {display:inline-grid!important;place-items:center;order:initial!important;margin:0!important;flex:0 0 43px;width:43px;height:40px;min-width:43px;padding:7px;border:1px solid var(--tp-line);border-radius:10px}
.header .tabs .tp-remote-trigger.on {border-color:var(--tp-blue)}
.main>.apps-only:not(.hidden) {padding-top:10px;overflow:auto}
.main>.apps-only .apps-grid {grid-template-columns:repeat(auto-fill,minmax(105px,1fr));align-content:start}
.main>.apps-only .app {min-height:98px;border-radius:14px}
@media(min-width:660px) {.header .tabs {order:initial;width:auto;flex:0 1 360px}.header .tabs .tab {flex:1 1 auto}}
@media(max-width:580px) {.header {gap:8px}.header .tabs {order:3!important;width:100%!important}.header .tabs .tp-remote-trigger {order:initial!important;margin:0!important}.main>.apps-only .apps-grid {grid-template-columns:repeat(3,minmax(0,1fr))}}
`;
const POPUP_CSS = `
:host {--tp-blue:var(--primary-color,#597aff)}
.tp-remote-backdrop {background:rgba(5,7,14,.72);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)}
.remote {left:50%!important;right:auto!important;top:50%!important;transform:translate(-50%,-50%)!important;width:min(370px,calc(100vw - 24px))!important;max-height:min(92dvh,820px)!important;border:1px solid var(--tp-line);border-radius:24px!important;padding:17px!important;background:var(--tp-bg)!important;box-shadow:0 24px 90px #000b!important;scrollbar-width:thin}
.remote-head {padding-bottom:10px;margin-bottom:12px;border-bottom:1px solid var(--tp-line)}
.remote-title {font-size:15px;letter-spacing:.01em}
.remote-head .power {flex:0 0 38px;width:38px;min-height:38px;border-radius:50%!important}
.remote .tp-remote-close {flex:0 0 38px;border-radius:50%!important;background:color-mix(in srgb,var(--tp-ink) 8%,var(--tp-bg))}
.remote-actions {display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-bottom:14px!important}
.remote .rkey {min-width:0;min-height:42px;border-radius:13px!important;background:color-mix(in srgb,var(--tp-ink) 5%,var(--tp-bg));transition:background .12s ease,transform .12s ease}
.remote .rkey:active {transform:scale(.94);background:color-mix(in srgb,var(--tp-blue) 27%,var(--tp-bg))}
.remote .dpad-wrap {display:grid;grid-template-columns:53px minmax(0,1fr) 53px;gap:7px;margin:9px 0 14px;align-items:center}
.remote .rocker {display:grid;gap:7px}
.remote .rocker .rkey {min-height:55px;padding:7px 0;font-size:12px}
.remote .dpad {width:min(190px,100%);height:auto;aspect-ratio:1;border:2px solid color-mix(in srgb,var(--tp-blue) 45%,var(--tp-line));background:radial-gradient(circle,color-mix(in srgb,var(--tp-blue) 11%,var(--tp-bg)),var(--tp-bg) 70%);box-shadow:inset 0 2px 15px #0002}
.remote .dpad .rkey {background:transparent;border:0;border-radius:50%!important;min-width:40px;min-height:40px;font-size:21px}
.remote .dpad .rkey.ok {background:var(--tp-blue)!important;border:0;color:white;box-shadow:0 2px 12px color-mix(in srgb,var(--tp-blue) 28%,transparent);font-size:14px}
.remote .rrow {gap:7px;margin-top:8px}
.remote details {border-radius:14px;margin-top:13px;padding:8px}
.remote summary {padding:7px}
.remote .rrow .digit {font-size:20px}
@media(max-width:390px) {.remote {padding:12px!important}.remote .dpad-wrap {grid-template-columns:47px minmax(0,1fr) 47px;gap:4px}.remote .dpad {width:min(178px,100%)}}
`;

const tpPagePreviousSetConfig = TP_PAGE_CARD.prototype.setConfig;
TP_PAGE_CARD.prototype.setConfig = function (config) {
  tpPagePreviousSetConfig.call(this, config);
  // Remove the duplicate app strip even if a base-card rebuild creates it.
  this._appStrip?.remove();
  const root = this.shadowRoot;
  if (root && !root.querySelector('#tp-page-control-v0313')) {
    const style = document.createElement('style');
    style.id = 'tp-page-control-v0313';
    style.textContent = PAGE_CSS;
    root.appendChild(style);
  }
  const tabs = root?.querySelector('.tabs');
  if (tabs && this._remoteTab) {
    // Keep the remote as a single icon next to Guide and Apps, rather than
    // letting it wrap onto an otherwise empty row on narrow dashboards.
    tabs.appendChild(this._remoteTab);
    this._remoteTab.title = 'Open Totalplay remote';
    this._remoteTab.setAttribute('aria-label', 'Open Totalplay remote');
    this._remoteTab.setAttribute('aria-haspopup', 'dialog');
  }
  const portalRoot = this._remotePortal?.shadowRoot;
  if (portalRoot && !portalRoot.querySelector('#tp-popup-control-v0313')) {
    const style = document.createElement('style');
    style.id = 'tp-popup-control-v0313';
    style.textContent = POPUP_CSS;
    portalRoot.appendChild(style);
  }
  const badge = root?.querySelector('.tp-version-badge');
  if (badge) badge.textContent = 'Card v0.3.13';
  // Switching pages never exposes the floating control until explicitly opened.
  if (this._remotePortal) this._remotePortal.hidden = true;
  this._remoteOpen = false;
  this._remoteTab?.setAttribute('aria-expanded', 'false');
  this._remoteTab?.classList.remove('on');
  this._switch(this._tab === 'apps' ? 'apps' : 'guide');
};
