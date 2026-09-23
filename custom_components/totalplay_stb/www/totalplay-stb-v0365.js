/* v0.3.65: Three distinct appearance choices. Light retains the complete
 * v0.3.64 light treatment; Dark is an intentional midnight/plum Totalplay
 * design; System uses the active Home Assistant theme rather than legacy
 * black-first colors. Keep the existing cards, artwork and interaction logic.
 */
import './totalplay-stb-v0364.js?v=0.3.65';

const TP65_FULL = customElements.get('totalplay-stb-card');
const TP65_POPUP = customElements.get('totalplay-stb-popup-card');
if (!TP65_FULL || !TP65_POPUP) throw new Error('Totalplay appearance: card components unavailable');
const tp65Mode = config => config?.theme === 'dark' ? 'dark' : config?.theme === 'light' ? 'light' : 'system';

/* The legacy v0.3.20 sheet forces black surfaces with !important. All surfaces
 * below are explicitly styled for Dark/System; Light stays in v0.3.64.
 * The selectors have a host attribute to outrank those old selectors.
 */
const TP65_CARD_CSS = `
:host([data-tp-palette="dark"]) {
  color-scheme:dark;--tp-ink:#f3effb!important;--tp-sub:#bdb6ce!important;
  --tp-bg:#151725!important;--tp-line:#40394f!important;
  --tp65-canvas:#151725;--tp65-header:#242136;--tp65-panel:#1c1b2d;
  --tp65-control:#2a263b;--tp65-active:#44304c;--tp65-line:#484057;
  --tp65-ink:#f3effb;--tp65-muted:#bdb6ce;--tp65-program:#28243a;
  --tp65-live:#472c49;--tp65-timeline:#171a2a;
  --tp-blue:var(--tp-custom-accent,#ed407e)!important;
}
:host([data-tp-palette="system"]) {
  color-scheme:normal;--tp-ink:var(--primary-text-color,#f2f2f2)!important;
  --tp-sub:var(--secondary-text-color,#aeb3bf)!important;
  --tp-bg:var(--ha-card-background,var(--card-background-color,#1b1b1b))!important;
  --tp-line:var(--divider-color,#484848)!important;
  --tp65-canvas:var(--ha-card-background,var(--card-background-color,#1b1b1b));
  --tp65-header:var(--secondary-background-color,var(--card-background-color,#242424));
  --tp65-panel:var(--ha-card-background,var(--card-background-color,#1b1b1b));
  --tp65-control:var(--secondary-background-color,var(--card-background-color,#242424));
  --tp65-active:color-mix(in srgb,var(--primary-color,#ed407e) 14%,var(--tp65-control));
  --tp65-line:var(--divider-color,#484848);
  --tp65-ink:var(--primary-text-color,#f2f2f2);
  --tp65-muted:var(--secondary-text-color,#aeb3bf);
  --tp65-program:var(--secondary-background-color,var(--card-background-color,#242424));
  --tp65-live:color-mix(in srgb,var(--primary-color,#ed407e) 17%,var(--tp65-program));
  --tp65-timeline:var(--ha-card-background,var(--card-background-color,#1b1b1b));
  --tp-blue:var(--primary-color,#ed407e)!important;
}
:host([data-tp-palette]) ha-card,
:host([data-tp-palette]) .frame,
:host([data-tp-palette]) .apps-only,
:host([data-tp-palette]) .apps-grid,
:host([data-tp-palette]) .apps-strip {
  background:var(--tp65-canvas)!important;color:var(--tp65-ink)!important;
}
:host([data-tp-palette]) ha-card {border-color:var(--tp65-line)!important}
:host([data-tp-palette]) .header {
  background:var(--tp65-header)!important;color:var(--tp65-ink)!important;
  border-color:var(--tp65-line)!important;
}
:host([data-tp-palette]) .header .tabs,
:host([data-tp-palette]) .header .mark,
:host([data-tp-palette]) .header .tabs .tp-remote-trigger,
:host([data-tp-palette]) .header .tp-power-helper,
:host([data-tp-palette]) .search,
:host([data-tp-palette]) .category,
:host([data-tp-palette]) .btn,
:host([data-tp-palette]) .pill,
:host([data-tp-palette]) .app,
:host([data-tp-palette]) .tp-wide-controls .btn {
  background:var(--tp65-control)!important;color:var(--tp65-ink)!important;
  border-color:var(--tp65-line)!important;
}
:host([data-tp-palette]) .header .tabs .tab {color:var(--tp65-ink)!important}
:host([data-tp-palette]) .header .tabs .tab.on,
:host([data-tp-palette]) .header .tabs .tp-remote-trigger.on,
:host([data-tp-palette]) .pill.on {
  background:var(--tp65-active)!important;color:var(--tp65-ink)!important;
  border-color:var(--tp-blue)!important;
}
:host([data-tp-palette]) .tp-brand-bottom .tp-version-badge {
  background:var(--tp65-control)!important;color:var(--tp65-ink)!important;
  border-color:var(--tp65-line)!important;
}
:host([data-tp-palette]) .tp-brand-bottom .meta,
:host([data-tp-palette]) .header .meta,
:host([data-tp-palette]) .ch-now,
:host([data-tp-palette]) .guide-info,
:host([data-tp-palette]) .selection,
:host([data-tp-palette]) .feedback,
:host([data-tp-palette]) .programme small,
:host([data-tp-palette]) .app small,
:host([data-tp-palette]) .muted {
  color:var(--tp65-muted)!important;
}
:host([data-tp-palette]) .guide-scroll {
  background:var(--tp65-canvas)!important;color:var(--tp65-ink)!important;
  border-color:var(--tp65-line)!important;
}
:host([data-tp-palette]) .guide-scroll .grow .ch,
:host([data-tp-palette]) .guide-scroll .grow.head .ch,
:host([data-tp-palette]) .guide-scroll .grow.head,
:host([data-tp-palette]) .guide-scroll .grow .times {
  background:var(--tp65-header)!important;color:var(--tp65-ink)!important;
  border-color:var(--tp65-line)!important;
}
:host([data-tp-palette]) .guide-scroll .grow .timeline {
  background-color:var(--tp65-timeline)!important;color:var(--tp65-ink)!important;
}
:host([data-tp-palette]) .programme {
  background:var(--tp65-program)!important;color:var(--tp65-ink)!important;
  border-color:var(--tp65-line)!important;
}
:host([data-tp-palette]) .programme.live {
  background:var(--tp65-live)!important;color:var(--tp65-ink)!important;
  border-color:var(--tp-blue)!important;
}
:host([data-tp-palette]) .programme strong,
:host([data-tp-palette]) .ch-name,
:host([data-tp-palette]) .remote-title {color:var(--tp65-ink)!important}
/* Original transparent white brand art stays untouched in both modes. */
:host([data-tp-palette="system"]) .tp-brand-logo {
  filter:drop-shadow(0 0 1px var(--secondary-text-color,#3b3b3b))!important;
}
`;
const TP65_REMOTE_CSS = `
:host([data-tp-palette="dark"]) {
  color-scheme:dark;--tp-ink:#f3effb!important;--tp-sub:#bdb6ce!important;
  --tp-bg:#1c1b2d!important;--tp-line:#484057!important;
  --tp65-remote:#211e32;--tp65-key:#302b43;--tp65-dpad:#3c324b;
  --tp65-edge:#554661;--tp65-text:#f3effb;
}
:host([data-tp-palette="system"]) {
  color-scheme:normal;--tp-ink:var(--primary-text-color,#f2f2f2)!important;
  --tp-sub:var(--secondary-text-color,#aeb3bf)!important;
  --tp-bg:var(--card-background-color,#1b1b1b)!important;
  --tp-line:var(--divider-color,#484848)!important;
  --tp65-remote:var(--card-background-color,#1b1b1b);
  --tp65-key:var(--secondary-background-color,#292929);
  --tp65-dpad:var(--secondary-background-color,#292929);
  --tp65-edge:var(--divider-color,#484848);
  --tp65-text:var(--primary-text-color,#f2f2f2);
}
:host([data-tp-palette]) .remote {
  background:var(--tp65-remote)!important;color:var(--tp65-text)!important;
  border-color:var(--tp65-edge)!important;
}
:host([data-tp-palette]) .remote-title {color:var(--tp65-text)!important}
:host([data-tp-palette]) .remote-head {border-color:var(--tp65-edge)!important}
:host([data-tp-palette]) .remote .rkey,
:host([data-tp-palette]) .remote .tp-remote-close,
:host([data-tp-palette]) .remote details {
  background:var(--tp65-key)!important;color:var(--tp65-text)!important;
  border-color:var(--tp65-edge)!important;
}
:host([data-tp-palette]) .remote .dpad {
  background:var(--tp65-dpad)!important;border-color:var(--tp65-edge)!important;
}
:host([data-tp-palette]) .remote .dpad .rkey.ok,
:host([data-tp-palette]) .remote .rkey.ok {
  background:var(--tp-blue,var(--primary-color,#ed407e))!important;color:#fff!important;
  border-color:var(--tp-blue,var(--primary-color,#ed407e))!important;
}
`;
const TP65_LAUNCHER_CSS = `
:host([data-tp-palette="dark"]) {color-scheme:dark}
:host([data-tp-palette="dark"]) ha-card {
  background:#242136!important;color:#f3effb!important;border-color:#484057!important;
}
:host([data-tp-palette="dark"]) button,
:host([data-tp-palette="dark"]) .tp-p-title {color:#f3effb!important}
:host([data-tp-palette="system"]) {color-scheme:normal}
:host([data-tp-palette="system"]) ha-card {
  background:var(--ha-card-background,var(--card-background-color,#1b1b1b))!important;
  color:var(--primary-text-color,#f2f2f2)!important;
  border-color:var(--divider-color,#484848)!important;
}
:host([data-tp-palette="system"]) button,
:host([data-tp-palette="system"]) .tp-p-title {color:var(--primary-text-color,#f2f2f2)!important}
:host([data-tp-palette="system"]) .tp42-logo,
:host([data-tp-palette="system"]) .tp53-logo,
:host([data-tp-palette="system"]) .tp56-vertical-logo,
:host([data-tp-palette="system"]) .tp-p-logo,
:host([data-tp-palette="system"]) .tp44-brand-image {
  filter:drop-shadow(0 0 1px var(--secondary-text-color,#3b3b3b))!important;
}
`;
const TP65_DIALOG_CSS = `
dialog.tp-stb-popup-dialog[data-tp-palette="dark"] {
  background:#151725!important;color:#f3effb!important;border-color:#484057!important;color-scheme:dark;
}
dialog.tp-stb-popup-dialog[data-tp-palette="dark"] .tp-stb-popup-head {
  background:#242136!important;color:#f3effb!important;border-color:#484057!important;
}
dialog.tp-stb-popup-dialog[data-tp-palette="dark"] .tp-stb-popup-close {
  background:#302b43!important;color:#f3effb!important;border-color:#484057!important;
}
dialog.tp-stb-popup-dialog[data-tp-palette="dark"] .tp-stb-popup-body {
  background:#151725!important;color:#f3effb!important;
}
dialog.tp-stb-popup-dialog[data-tp-palette="system"] {
  background:var(--card-background-color,#1b1b1b)!important;
  color:var(--primary-text-color,#f2f2f2)!important;
  border-color:var(--divider-color,#484848)!important;color-scheme:normal;
}
dialog.tp-stb-popup-dialog[data-tp-palette="system"] .tp-stb-popup-head,
dialog.tp-stb-popup-dialog[data-tp-palette="system"] .tp-stb-popup-body {
  background:var(--card-background-color,#1b1b1b)!important;
  color:var(--primary-text-color,#f2f2f2)!important;
}
dialog.tp-stb-popup-dialog[data-tp-palette="system"] .tp-stb-popup-close {
  background:var(--secondary-background-color,#292929)!important;
  color:var(--primary-text-color,#f2f2f2)!important;
  border-color:var(--divider-color,#484848)!important;
}
`;
function tp65Style(root,id,content) {
  if (!root || root.querySelector('#'+id)) return;
  const style=document.createElement('style');style.id=id;style.textContent=content;
  root.appendChild(style);
}
/* The remote portal and native dialog live on document.body, outside the
 * dashboard's HA theme scope. Mirror only the currently resolved HA variables
 * when System is selected; remove them when selecting a fixed palette. */
const TP65_HA_KEYS=['--ha-card-background','--card-background-color','--primary-text-color',
  '--secondary-text-color','--secondary-background-color','--divider-color','--primary-color'];
function tp65MirrorHassTheme(source, target, mode) {
  if (!target) return;
  for (const key of TP65_HA_KEYS) {
    if (mode !== 'system' || !source || typeof getComputedStyle !== 'function') {
      target.style.removeProperty(key);continue;
    }
    const value=getComputedStyle(source).getPropertyValue(key).trim();
    if (value) target.style.setProperty(key,value);
    else target.style.removeProperty(key);
  }
}
function tp65ApplyFull(card) {
  const mode=tp65Mode(card._config);
  if (mode==='light') delete card.dataset.tpPalette;
  else card.dataset.tpPalette=mode;
  tp65Style(card.shadowRoot,'tp65-brand-and-system-card',TP65_CARD_CSS);
  const portal=card._remotePortal;
  if (portal) {
    if (mode==='light') delete portal.dataset.tpPalette;
    else portal.dataset.tpPalette=mode;
    tp65MirrorHassTheme(card,portal,mode);
    tp65Style(portal.shadowRoot,'tp65-brand-and-system-remote',TP65_REMOTE_CSS);
  }
  card.shadowRoot?.querySelector('.tp-version-badge')?.replaceChildren('v0.3.65');
}
function tp65ApplyPopup(popup) {
  const mode=tp65Mode(popup._config);
  if (mode==='light') delete popup.dataset.tpPalette;
  else popup.dataset.tpPalette=mode;
  tp65Style(popup.shadowRoot,'tp65-brand-and-system-launcher',TP65_LAUNCHER_CSS);
  const dialog=popup._dialog;
  if (dialog) {
    if (mode==='light') delete dialog.dataset.tpPalette;
    else dialog.dataset.tpPalette=mode;
    tp65MirrorHassTheme(popup,dialog,mode);
    tp65Style(dialog,'tp65-brand-and-system-dialog',TP65_DIALOG_CSS);
    if (popup._popupCard) tp65ApplyFull(popup._popupCard);
  }
}
const tp65OldFullConfig=TP65_FULL.prototype.setConfig;
TP65_FULL.prototype.setConfig=function(config) {
  const result=tp65OldFullConfig.call(this,config);tp65ApplyFull(this);return result;
};
const tp65OldFullHass=Object.getOwnPropertyDescriptor(TP65_FULL.prototype,'hass')?.set;
if (tp65OldFullHass) Object.defineProperty(TP65_FULL.prototype,'hass',{
  configurable:true,set(value) {
    tp65OldFullHass.call(this,value);if(this._config)tp65ApplyFull(this);
  },
});
const tp65OldPopupConfig=TP65_POPUP.prototype.setConfig;
TP65_POPUP.prototype.setConfig=function(config) {
  const result=tp65OldPopupConfig.call(this,config);tp65ApplyPopup(this);return result;
};
const tp65OldPopupOpen=TP65_POPUP.prototype._openPopup;
TP65_POPUP.prototype._openPopup=function(...args) {
  const result=tp65OldPopupOpen.apply(this,args);tp65ApplyPopup(this);return result;
};
const tp65OldPopupHass=Object.getOwnPropertyDescriptor(TP65_POPUP.prototype,'hass')?.set;
if(tp65OldPopupHass)Object.defineProperty(TP65_POPUP.prototype,'hass',{
  configurable:true,set(value) {
    tp65OldPopupHass.call(this,value);if(this._config)tp65ApplyPopup(this);
  },
});
