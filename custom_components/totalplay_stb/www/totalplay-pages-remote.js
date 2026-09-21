/* Totalplay card frontend v0.3.5: separate Guide/Apps and floating remote. */
import './totalplay-epg-responsive.js?v=0.3.5';

const TotalplayPagesCard = customElements.get('totalplay-stb-card');
if (!TotalplayPagesCard) throw new Error('Totalplay guide did not load');

const TP_PAGES_CSS = `
.apps-strip {display:none!important}
.tp-remote-trigger {display:inline-grid;place-items:center;width:42px;height:42px;padding:7px;flex:none}
.tp-remote-trigger ha-icon {--mdc-icon-size:23px}
.tp-remote-trigger.on {background:var(--tp-blue);color:white;border-color:var(--tp-blue)}
.header .tabs {flex:0 1 auto}
@media(max-width:580px) {.tp-remote-trigger {order:2;margin-left:auto}.tabs {order:3}}
`;
const TP_REMOTE_PORTAL_CSS = `
:host {position:fixed;inset:0;z-index:10000;display:block;--tp-blue:#597aff;--tp-bg:var(--card-background-color,#151821);--tp-ink:var(--primary-text-color,#f4f6fb);--tp-sub:var(--secondary-text-color,#a8b0c0);--tp-line:var(--divider-color,#384155)}
:host([hidden]) {display:none!important}
.tp-remote-backdrop {position:fixed;inset:0;width:100%;height:100%;padding:0;margin:0;background:rgba(0,0,0,.64);border:0;border-radius:0;cursor:default}
.remote {position:fixed;right:clamp(12px,4vw,56px);top:50%;transform:translateY(-50%);z-index:1;width:min(320px,calc(100vw - 24px));max-width:calc(100vw - 24px);max-height:min(88dvh,750px);overflow-y:auto;overflow-x:hidden;margin:0;padding:16px;border-radius:22px;background:var(--tp-bg);color:var(--tp-ink);box-shadow:0 22px 80px #0009;overscroll-behavior:contain}
.remote-head {gap:8px}
.remote-title {flex:1}
.tp-remote-close {width:35px;min-width:35px;min-height:35px;font-size:23px;line-height:1;padding:0}
.remote .rkey {border-radius:11px;min-height:40px}
.remote .dpad {border-radius:50%;width:178px;height:178px}
.remote .dpad .ok {border-radius:50%;width:58px;height:58px}
.remote .remote-actions {margin-bottom:12px}
.remote button:focus-visible {outline:2px solid var(--tp-blue);outline-offset:2px}
@media(max-width:580px) {.remote {right:50%;transform:translate(50%,-50%);width:min(320px,calc(100vw - 24px));max-height:90dvh;padding:13px}}
`;

const tpOriginalSetConfig = TotalplayPagesCard.prototype.setConfig;
const tpOriginalSwitch = TotalplayPagesCard.prototype._switch;
const tpOriginalConnected = TotalplayPagesCard.prototype.connectedCallback;
const tpOriginalDisconnected = TotalplayPagesCard.prototype.disconnectedCallback;

TotalplayPagesCard.prototype._removeRemotePortal = function () {
  if (this._remoteEscapeHandler) {
    document.removeEventListener('keydown', this._remoteEscapeHandler);
    this._remoteEscapeHandler = null;
  }
  this._remotePortal?.remove();
  this._remotePortal = null;
  this._remoteOpen = false;
};

TotalplayPagesCard.prototype._mountRemotePortal = function () {
  if (this._remotePortal || !this._remote || !this._remoteTab || !document.body) return;
  const portal = document.createElement('div');
  portal.className = 'tp-totalplay-remote-portal';
  portal.hidden = true;
  const shadow = portal.attachShadow({mode:'open'});
  const style = document.createElement('style');
  // Move the original remote (and its existing command listeners) rather than
  // implementing a second decoder-control path. Shadow styles remain scoped.
  style.textContent = (this.shadowRoot?.querySelector('style')?.textContent || '') + TP_REMOTE_PORTAL_CSS;
  const backdrop = document.createElement('button');
  backdrop.type = 'button';
  backdrop.className = 'tp-remote-backdrop';
  backdrop.setAttribute('aria-label', 'Close Totalplay remote');
  backdrop.addEventListener('click', () => this._toggleRemote(false));
  const head = this._remote.querySelector('.remote-head');
  if (head && !head.querySelector('.tp-remote-close')) {
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'rkey tp-remote-close';
    close.textContent = '×';
    close.title = 'Close remote';
    close.setAttribute('aria-label', 'Close remote');
    close.addEventListener('click', () => this._toggleRemote(false));
    head.appendChild(close);
  }
  this._remote.hidden = false;
  this._remote.setAttribute('role', 'dialog');
  this._remote.setAttribute('aria-label', 'Totalplay remote control');
  shadow.append(style, backdrop, this._remote);
  document.body.appendChild(portal);
  this._remotePortal = portal;
};

TotalplayPagesCard.prototype._toggleRemote = function (requested) {
  this._mountRemotePortal();
  if (!this._remotePortal) return;
  const open = typeof requested === 'boolean' ? requested : this._remotePortal.hidden;
  this._remoteOpen = open;
  this._remotePortal.hidden = !open;
  this._remoteTab?.classList.toggle('on', open);
  this._remoteTab?.setAttribute('aria-expanded', String(open));
  if (open) {
    this._remoteEscapeHandler = this._remoteEscapeHandler || (event => {
      if (event.key === 'Escape') {
        event.preventDefault();
        this._toggleRemote(false);
      }
    });
    document.addEventListener('keydown', this._remoteEscapeHandler);
    this._remotePortal.shadowRoot.querySelector('.tp-remote-close')?.focus();
  } else {
    if (this._remoteEscapeHandler) {
      document.removeEventListener('keydown', this._remoteEscapeHandler);
      this._remoteEscapeHandler = null;
    }
    this._remoteTab?.focus();
  }
};

TotalplayPagesCard.prototype._switch = function (tab) {
  tpOriginalSwitch.call(this, tab);
  // The guide search, filters, and EPG status belong to the guide page alone.
  this._search?.parentElement?.classList.toggle('hidden', tab !== 'guide');
  this._pills?.classList.toggle('hidden', tab !== 'guide');
  if (tab === 'guide') this._queueGuideFill?.();
};

TotalplayPagesCard.prototype.setConfig = function (config) {
  this._removeRemotePortal();
  // The original card defaults to a permanently open desktop sidebar.
  this._remoteOpen = false;
  tpOriginalSetConfig.call(this, config);
  this._appStrip?.remove();
  this._layout?.classList.remove('remote-visible');
  const root = this.shadowRoot;
  if (root && !root.querySelector('#tp-pages-style')) {
    const style = document.createElement('style');
    style.id = 'tp-pages-style';
    style.textContent = TP_PAGES_CSS;
    root.appendChild(style);
  }
  const badge = root?.querySelector('.tp-version-badge');
  if (badge) badge.textContent = 'Card v0.3.5';
  const trigger = this._remoteTab;
  const header = root?.querySelector('.header');
  if (trigger && header) {
    trigger.className = 'btn tp-remote-trigger';
    trigger.title = 'Control';
    trigger.setAttribute('aria-label', 'Open Totalplay remote');
    trigger.setAttribute('aria-expanded', 'false');
    const icon = document.createElement('ha-icon');
    icon.setAttribute('icon','mdi:remote-tv');
    trigger.replaceChildren(icon);
    header.insertBefore(trigger, this._time || null);
  }
  this._mountRemotePortal();
  this._switch(this._tab === 'apps' ? 'apps' : 'guide');
};

TotalplayPagesCard.prototype.connectedCallback = function () {
  tpOriginalConnected?.call(this);
  this._mountRemotePortal();
};
TotalplayPagesCard.prototype.disconnectedCallback = function () {
  this._removeRemotePortal();
  tpOriginalDisconnected?.call(this);
};
