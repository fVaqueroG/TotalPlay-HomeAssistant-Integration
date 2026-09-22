/* Totalplay card v0.3.20: black-first corporate styling and compact logo/status header.
 * Preserve the functioning programme guide, logos, app page, remote and EPG controls.
 */
import './totalplay-stb-v0319.js?v=0.3.20';

const TP_BLACK_CARD = customElements.get('totalplay-stb-card');
if (!TP_BLACK_CARD) throw new Error('Totalplay card did not load');

const TP_BLACK_CSS = `
:host {--tp-blue:#e63654;--tp-ink:#f5f5f5;--tp-sub:#aaaeb5;--tp-bg:#101010;--tp-line:#373737}
ha-card {background:#101010!important;border:1px solid #303030!important;border-radius:16px!important;color:var(--tp-ink)!important}
.frame {background:#101010!important}
.header {background:#161616!important;border:1px solid #303030!important;border-radius:13px!important;padding:12px 14px!important;gap:10px!important}
.header .brand {display:flex!important;flex:1 1 235px;flex-direction:column!important;align-items:flex-start!important;justify-content:center;gap:5px!important;min-width:0}
.header .brand-title {display:none!important}
.tp-brand-logo {width:154px!important;max-width:min(154px,48vw)!important;height:31px!important;object-fit:contain!important;object-position:left center!important}
.tp-brand-bottom {display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:7px!important;flex-wrap:wrap!important;min-width:0;max-width:100%;line-height:1.2}
.tp-brand-bottom .tp-version-badge {display:inline-flex!important;align-items:center;flex:none;border:1px solid #494949!important;background:#242424!important;color:#ededed!important;padding:3px 7px!important;border-radius:7px!important;font-size:10px!important;font-weight:700!important;white-space:nowrap!important}
.tp-brand-bottom .meta {font-size:11px!important;color:#b7b7b7!important;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:0 1 auto}
.tp-brand-bottom .tp-input-warning {flex-basis:100%;margin-top:1px;color:#ffbd74!important}
.header .mark {background:#282828!important;border:1px solid #3d3d3d!important}
.header .tabs {background:#191919!important;border:1px solid #393939!important;border-radius:12px!important}
.header .tabs .tab {color:#dedede!important}
.header .tabs .tab.on,.header .tabs .tp-remote-trigger.on {background:#373737!important;color:#fff!important;border-color:#e63654!important;box-shadow:inset 0 -2px #e63654!important}
.header .tabs .tp-remote-trigger {background:#202020!important;border-color:#3c3c3c!important;color:#eee!important}
.header .tp-power-helper {background:#202020!important;border-color:#3c3c3c!important}
.search,.category {background:#191919!important;border-color:#3b3b3b!important;color:#f5f5f5!important}
.search:focus,.category:focus {border-color:#e63654!important}
.btn,.pill,.app {background:#1b1b1b!important;border-color:#3a3a3a!important;color:#eee!important}
.pill.on {background:#333!important;border:1px solid #e63654!important;color:#fff!important}
.guide-scroll {background:#111!important;border-color:#343434!important;scrollbar-color:#555 transparent!important}
.guide-scroll .grow .ch,.guide-scroll .grow.head .ch {background:#171717!important;color:#f2f2f2!important}
.guide-scroll .grow.head,.guide-scroll .grow .times {background:#202020!important}
.guide-scroll .grow .timeline {background-color:#121212!important}
.ch-num {color:#eee!important}
.ch-logo {background:#242424!important;border:1px solid #414141!important;color:#fafafa!important}
.programme {background:#202020!important;border-color:#353535!important;color:#f2f2f2!important}
.programme.live {background:#292929!important;border:1px solid #dd4962!important}
.guide-scroll .grow .now,.guide-scroll .grow .now:before {background:#ec4363!important}
.btn:hover,.app:hover,.programme:hover,.ch:hover {border-color:#e63654!important}
.apps-only .app {background:#1c1c1c!important;border-color:#383838!important}
@media(max-width:580px) {
  .header {padding:10px!important;gap:7px!important}
  .header .brand {flex:1 1 100%!important;gap:4px!important}
  .tp-brand-logo {width:137px!important;max-width:52vw!important;height:29px!important}
  .tp-brand-bottom {gap:6px!important}
  .tp-brand-bottom .meta {max-width:calc(100vw - 100px)}
}
`;
const TP_BLACK_REMOTE_CSS = `
:host {--tp-blue:#e63654;--tp-ink:#f5f5f5;--tp-sub:#adaeb3;--tp-bg:#121212;--tp-line:#3e3e3e}
.remote {background:#151515!important;border:1px solid #404040!important;box-shadow:0 24px 80px #000c!important}
.remote-head {border-bottom-color:#3c3c3c!important}
.remote .dpad {background:radial-gradient(circle,#303030,#1a1a1a 68%,#111)!important;border-color:#535353!important}
.remote .dpad .rkey.ok {background:#e63654!important;border:1px solid #ff7188!important;color:#fff!important}
.remote .rkey {background:#242424!important;border-color:#424242!important;color:#f5f5f5!important}
.remote .rkey:active {background:#6b2736!important}
.remote .rkey.ok {background:#e63654!important}
.remote details {background:#1d1d1d!important;border-color:#404040!important}
`;

const tpBlackPreviousSetConfig = TP_BLACK_CARD.prototype.setConfig;
TP_BLACK_CARD.prototype.setConfig = function(config) {
  tpBlackPreviousSetConfig.call(this, config);
  const root = this.shadowRoot;
  if (!root) return;
  if (!root.querySelector('#tp-black-theme-v0320')) {
    const style = document.createElement('style');
    style.id = 'tp-black-theme-v0320';
    style.textContent = TP_BLACK_CSS;
    root.appendChild(style);
  }
  const brand = root.querySelector('.header .brand') || root.querySelector('.brand');
  const title = brand?.querySelector('.brand-title');
  const badge = root.querySelector('.tp-version-badge');
  const status = this._tv;
  const statusRow = status?.parentElement;
  if (brand && statusRow && badge) {
    statusRow.classList.add('tp-brand-bottom');
    // The badge used to be nested inside the redundant "Totalplay TV" title.
    // Move the same element next to the live TV status instead of cloning it.
    if (badge.parentElement !== statusRow) statusRow.insertBefore(badge, status);
    if (title && title !== statusRow) title.remove();
    badge.textContent = 'v0.3.20';
    badge.title = 'Frontend card version currently loaded';
  }
  const remoteRoot = this._remotePortal?.shadowRoot;
  if (remoteRoot && !remoteRoot.querySelector('#tp-black-remote-v0320')) {
    const style = document.createElement('style');
    style.id = 'tp-black-remote-v0320';
    style.textContent = TP_BLACK_REMOTE_CSS;
    remoteRoot.appendChild(style);
  }
};
