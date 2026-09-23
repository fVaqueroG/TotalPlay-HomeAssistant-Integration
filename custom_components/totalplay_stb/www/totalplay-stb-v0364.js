/* v0.3.64: Complete Light theme for the legacy black-first Totalplay UI.
 * v0.3.20 hard-coded #101010 and white text with !important, so changing
 * inherited theme variables alone could not recolor the card. Keep the
 * approved transparent logos; add a subtle edge only in Light mode.
 */
import './totalplay-stb-v0363.js?v=0.3.64';

const TP64_FULL = customElements.get('totalplay-stb-card');
const TP64_POPUP = customElements.get('totalplay-stb-popup-card');
if (!TP64_FULL || !TP64_POPUP) throw new Error('Totalplay card components unavailable');

const TP64_LIGHT_CARD = `
:host([data-tp-light="yes"]) {color-scheme:light;--tp-ink:#182436!important;--tp-sub:#58697d!important;--tp-bg:#fff!important;--tp-line:#d8e0e9!important}
:host([data-tp-light="yes"]) ha-card {background:#fff!important;color:#182436!important;border-color:#d8e0e9!important}
:host([data-tp-light="yes"]) .frame {background:#fff!important;color:#182436!important}
:host([data-tp-light="yes"]) .header {background:#f6f8fc!important;color:#182436!important;border-color:#d8e0e9!important}
:host([data-tp-light="yes"]) .header .mark,
:host([data-tp-light="yes"]) .header .tabs,
:host([data-tp-light="yes"]) .header .tabs .tp-remote-trigger,
:host([data-tp-light="yes"]) .header .tp-power-helper {background:#edf2f7!important;border-color:#d8e0e9!important;color:#182436!important}
:host([data-tp-light="yes"]) .header .tabs .tab {color:#26384e!important}
:host([data-tp-light="yes"]) .header .tabs .tab.on,
:host([data-tp-light="yes"]) .header .tabs .tp-remote-trigger.on {background:#e5eaf3!important;color:#182436!important;border-color:var(--tp-blue)!important}
:host([data-tp-light="yes"]) .header .brand-title,
:host([data-tp-light="yes"]) .header .meta,
:host([data-tp-light="yes"]) .tp-brand-bottom .meta {color:#58697d!important}
:host([data-tp-light="yes"]) .tp-brand-bottom .tp-version-badge {background:#edf2f7!important;color:#26384e!important;border-color:#d8e0e9!important}
:host([data-tp-light="yes"]) .search,
:host([data-tp-light="yes"]) .category,
:host([data-tp-light="yes"]) .btn,
:host([data-tp-light="yes"]) .pill,
:host([data-tp-light="yes"]) .app,
:host([data-tp-light="yes"]) .tp-wide-controls .btn {background:#f2f5fa!important;color:#182436!important;border-color:#d8e0e9!important}
:host([data-tp-light="yes"]) .pill.on {background:#e5eaf3!important;color:#182436!important;border-color:var(--tp-blue)!important}
:host([data-tp-light="yes"]) .guide-scroll {background:#fff!important;color:#182436!important;border-color:#d8e0e9!important;scrollbar-color:#b9c7d8 transparent!important}
:host([data-tp-light="yes"]) .guide-scroll .grow .ch,
:host([data-tp-light="yes"]) .guide-scroll .grow.head .ch {background:#f6f8fc!important;color:#182436!important;border-color:#d8e0e9!important}
:host([data-tp-light="yes"]) .guide-scroll .grow.head,
:host([data-tp-light="yes"]) .guide-scroll .grow .times {background:#eaf0f7!important;color:#182436!important}
:host([data-tp-light="yes"]) .guide-scroll .grow .timeline {background-color:#fff!important;color:#182436!important}
:host([data-tp-light="yes"]) .guide-scroll .grow .time {color:#58697d!important}
:host([data-tp-light="yes"]) .ch-num {color:var(--tp-blue)!important}
:host([data-tp-light="yes"]) .ch-name,
:host([data-tp-light="yes"]) .programme strong {color:#182436!important}
:host([data-tp-light="yes"]) .ch-now,
:host([data-tp-light="yes"]) .programme small,
:host([data-tp-light="yes"]) .guide-info,
:host([data-tp-light="yes"]) .selection,
:host([data-tp-light="yes"]) .feedback {color:#58697d!important}
:host([data-tp-light="yes"]) .programme,
:host([data-tp-light="yes"]) .programme.live {background:#edf2fa!important;border-color:#cbd6e5!important;color:#182436!important}
:host([data-tp-light="yes"]) .programme.live {background:#dce9fc!important;border-color:var(--tp-blue)!important}
:host([data-tp-light="yes"]) .apps-only,
:host([data-tp-light="yes"]) .apps-strip,
:host([data-tp-light="yes"]) .apps-grid {background:#fff!important;color:#182436!important}
:host([data-tp-light="yes"]) .apps-only .app,
:host([data-tp-light="yes"]) .apps-strip .app {background:#f2f5fa!important;border-color:#d8e0e9!important;color:#182436!important}
:host([data-tp-light="yes"]) .app small,
:host([data-tp-light="yes"]) .meta,
:host([data-tp-light="yes"]) .muted {color:#58697d!important}
/* The original Totalplay wordmark has white lettering: outline the artwork,
   without replacing its colors, baking in a background, or changing assets. */
:host([data-tp-light="yes"]) .tp-brand-logo {
  filter:drop-shadow(0 0 1px #283a50) drop-shadow(0 0 2px #283a50) drop-shadow(0 1px 1px #283a50)!important;
}
`;

const TP64_LIGHT_REMOTE = `
:host([data-tp-light="yes"]) {color-scheme:light;--tp-ink:#182436!important;--tp-sub:#58697d!important;--tp-bg:#fff!important;--tp-line:#d8e0e9!important}
:host([data-tp-light="yes"]) .remote {background:#fff!important;color:#182436!important;border-color:#cbd6e5!important}
:host([data-tp-light="yes"]) .remote-title {color:#182436!important}
:host([data-tp-light="yes"]) .remote-head {border-bottom-color:#d8e0e9!important}
:host([data-tp-light="yes"]) .remote .dpad {background:radial-gradient(circle,#edf2f9,#dce5f0 70%,#eef3f9)!important;border-color:#aebdd1!important}
:host([data-tp-light="yes"]) .remote .rkey,
:host([data-tp-light="yes"]) .remote .tp-remote-close,
:host([data-tp-light="yes"]) .remote details {background:#edf2f7!important;border-color:#cad6e5!important;color:#182436!important}
:host([data-tp-light="yes"]) .remote .rkey.ok,
:host([data-tp-light="yes"]) .remote .dpad .rkey.ok {background:var(--tp-blue,#ed407e)!important;color:#fff!important;border-color:var(--tp-blue,#ed407e)!important}
`;

const TP64_LIGHT_LAUNCHER = `
:host([data-tp-light="yes"]) {color-scheme:light}
:host([data-tp-light="yes"]) ha-card {background:#fff!important;color:#182436!important;border-color:#d8e0e9!important}
:host([data-tp-light="yes"]) button {color:#182436!important}
:host([data-tp-light="yes"]) .tp-p-title {color:#182436!important}
:host([data-tp-light="yes"]) .tp42-logo,
:host([data-tp-light="yes"]) .tp53-logo,
:host([data-tp-light="yes"]) .tp56-vertical-logo,
:host([data-tp-light="yes"]) .tp-p-logo,
:host([data-tp-light="yes"]) .tp44-brand-image {
  filter:drop-shadow(0 0 1px #283a50) drop-shadow(0 0 2px #283a50) drop-shadow(0 1px 1px #283a50)!important;
}
`;

const TP64_LIGHT_DIALOG = `
dialog.tp-stb-popup-dialog[data-tp-light="yes"] {background:#fff!important;color:#182436!important;border-color:#d8e0e9!important;color-scheme:light}
dialog.tp-stb-popup-dialog[data-tp-light="yes"] .tp-stb-popup-head {background:#f6f8fc!important;color:#182436!important;border-bottom-color:#d8e0e9!important}
dialog.tp-stb-popup-dialog[data-tp-light="yes"] .tp-stb-popup-close {background:#edf2f7!important;color:#182436!important;border-color:#d8e0e9!important}
dialog.tp-stb-popup-dialog[data-tp-light="yes"] .tp-stb-popup-body {background:#fff!important;color:#182436!important}
`;

function tp64SetStyle(root,id,css) {
  if (!root || root.querySelector('#'+id)) return;
  const style=document.createElement('style');
  style.id=id;
  style.textContent=css;
  root.appendChild(style);
}
function tp64CardAppearance(card) {
  const light=card._config?.theme==='light';
  if (light) card.dataset.tpLight='yes'; else delete card.dataset.tpLight;
  tp64SetStyle(card.shadowRoot,'tp64-complete-light-card',TP64_LIGHT_CARD);
  const portal=card._remotePortal;
  if (portal) {
    if (light) portal.dataset.tpLight='yes'; else delete portal.dataset.tpLight;
    tp64SetStyle(portal.shadowRoot,'tp64-complete-light-remote',TP64_LIGHT_REMOTE);
  }
  card.shadowRoot?.querySelector('.tp-version-badge')?.replaceChildren('v0.3.64');
}
function tp64PopupAppearance(popup) {
  const light=popup._config?.theme==='light';
  if (light) popup.dataset.tpLight='yes'; else delete popup.dataset.tpLight;
  tp64SetStyle(popup.shadowRoot,'tp64-complete-light-launcher',TP64_LIGHT_LAUNCHER);
  const dialog=popup._dialog;
  if (dialog) {
    if (light) dialog.dataset.tpLight='yes'; else delete dialog.dataset.tpLight;
    tp64SetStyle(dialog,'tp64-complete-light-dialog',TP64_LIGHT_DIALOG);
    // The actual guide/remote lives in a nested card with its own shadow root.
    if (popup._popupCard) tp64CardAppearance(popup._popupCard);
  }
}
const tp64OldFullConfig=TP64_FULL.prototype.setConfig;
TP64_FULL.prototype.setConfig=function(config) {
  const result=tp64OldFullConfig.call(this,config);
  tp64CardAppearance(this);
  return result;
};
const tp64OldFullHass=Object.getOwnPropertyDescriptor(TP64_FULL.prototype,'hass')?.set;
if (tp64OldFullHass) Object.defineProperty(TP64_FULL.prototype,'hass',{
  configurable:true,
  set(value) {tp64OldFullHass.call(this,value);if (this._config) tp64CardAppearance(this);},
});
const tp64OldPopupConfig=TP64_POPUP.prototype.setConfig;
TP64_POPUP.prototype.setConfig=function(config) {
  const result=tp64OldPopupConfig.call(this,config);
  tp64PopupAppearance(this);
  return result;
};
const tp64OldPopupOpen=TP64_POPUP.prototype._openPopup;
TP64_POPUP.prototype._openPopup=function(...args) {
  const result=tp64OldPopupOpen.apply(this,args);
  tp64PopupAppearance(this);
  return result;
};
