/* Totalplay v0.3.73 — cooler dark palette aligned with Streaming Browser.
 * Keep Totalplay brand accents and logo artwork unchanged; only neutral dark
 * surfaces move from plum to cool navy/slate.
 */
import './totalplay-stb-v0372.js?v=0.3.73';

const TP73_CARD=customElements.get('totalplay-stb-card');
const TP73_POPUP=customElements.get('totalplay-stb-popup-card');
if(!TP73_CARD||!TP73_POPUP)throw new Error('Totalplay cool dark palette: card components unavailable');

const TP73_DARK_CARD=`
:host([data-tp-palette="dark"]){
  color-scheme:dark;
  --tp-ink:#F4F4F8!important;
  --tp-sub:#B8C1D1!important;
  --tp-bg:#151B2A!important;
  --tp-line:#45506A!important;
  --tp65-canvas:#151B2A!important;
  --tp65-header:#182230!important;
  --tp65-panel:#151B2A!important;
  --tp65-control:#232B3C!important;
  --tp65-active:color-mix(in srgb,var(--tp-primary,#C52B6B) 18%,#232B3C)!important;
  --tp65-line:#45506A!important;
  --tp65-ink:#F4F4F8!important;
  --tp65-muted:#B8C1D1!important;
  --tp65-program:#1E2636!important;
  --tp65-live:color-mix(in srgb,var(--tp-primary,#C52B6B) 18%,#1E2636)!important;
  --tp65-timeline:#0E1420!important;
}
:host([data-tp-palette="dark"]) ha-card,
:host([data-tp-palette="dark"]) .frame,
:host([data-tp-palette="dark"]) .apps-only,
:host([data-tp-palette="dark"]) .apps-grid,
:host([data-tp-palette="dark"]) .apps-strip{
  background:#151B2A!important;color:#F4F4F8!important;
}
:host([data-tp-palette="dark"]) .header{
  background:#182230!important;color:#F4F4F8!important;border-color:#45506A!important;
}
:host([data-tp-palette="dark"]) .search,
:host([data-tp-palette="dark"]) .category,
:host([data-tp-palette="dark"]) .btn,
:host([data-tp-palette="dark"]) .pill,
:host([data-tp-palette="dark"]) .app,
:host([data-tp-palette="dark"]) .tp-wide-controls .btn,
:host([data-tp-palette="dark"]) .header .tabs,
:host([data-tp-palette="dark"]) .header .mark,
:host([data-tp-palette="dark"]) .header .tp-power-helper{
  background:#232B3C!important;color:#F4F4F8!important;border-color:#45506A!important;
}
:host([data-tp-palette="dark"]) .guide-scroll .grow .ch,
:host([data-tp-palette="dark"]) .guide-scroll .grow.head .ch,
:host([data-tp-palette="dark"]) .guide-scroll .grow.head,
:host([data-tp-palette="dark"]) .guide-scroll .grow .times{
  background:#182230!important;color:#F4F4F8!important;border-color:#45506A!important;
}
:host([data-tp-palette="dark"]) .guide-scroll .grow .timeline{
  background-color:#0E1420!important;
}
:host([data-tp-palette="dark"]) .programme{
  background:#1E2636!important;color:#F4F4F8!important;border-color:#45506A!important;
}
`;

const TP73_DARK_REMOTE=`
:host([data-tp-palette="dark"]){
  color-scheme:dark;
  --tp-ink:#F4F4F8!important;
  --tp-sub:#B8C1D1!important;
  --tp-bg:#151B2A!important;
  --tp-line:#45506A!important;
  --tp65-remote:#151B2A!important;
  --tp65-key:#232B3C!important;
  --tp65-dpad:#1E2636!important;
  --tp65-edge:#45506A!important;
  --tp65-text:#F4F4F8!important;
}
:host([data-tp-palette="dark"]) .remote{
  background:#151B2A!important;color:#F4F4F8!important;border-color:#45506A!important;
}
:host([data-tp-palette="dark"]) .remote .rkey,
:host([data-tp-palette="dark"]) .remote .tp-remote-close,
:host([data-tp-palette="dark"]) .remote details{
  background:#232B3C!important;color:#F4F4F8!important;border-color:#45506A!important;
}
:host([data-tp-palette="dark"]) .remote .dpad{
  background:#1E2636!important;border-color:#45506A!important;
}
`;

const TP73_DARK_LAUNCHER=`
:host([data-tp-palette="dark"]) ha-card{
  background:#151B2A!important;color:#F4F4F8!important;border-color:#45506A!important;
}
:host([data-tp-palette="dark"]) button,
:host([data-tp-palette="dark"]) .tp-p-title{color:#F4F4F8!important}
`;

const TP73_DARK_DIALOG=`
dialog.tp-stb-popup-dialog[data-tp-palette="dark"]{
  background:#151B2A!important;color:#F4F4F8!important;border-color:#45506A!important;color-scheme:dark;
}
dialog.tp-stb-popup-dialog[data-tp-palette="dark"] .tp-stb-popup-head{
  background:#182230!important;color:#F4F4F8!important;border-color:#45506A!important;
}
dialog.tp-stb-popup-dialog[data-tp-palette="dark"] .tp-stb-popup-close{
  background:#232B3C!important;color:#F4F4F8!important;border-color:#45506A!important;
}
dialog.tp-stb-popup-dialog[data-tp-palette="dark"] .tp-stb-popup-body{
  background:#151B2A!important;color:#F4F4F8!important;
}
`;

function tp73Style(root,id,css){
  if(!root)return;
  let style=root.querySelector?.('#'+id);
  if(!style){style=document.createElement('style');style.id=id;root.appendChild(style);}
  style.textContent=css;
}
function tp73ApplyCard(card){
  tp73Style(card.shadowRoot,'tp73-cool-dark-card',TP73_DARK_CARD);
  const portal=card._remotePortal;
  if(portal)tp73Style(portal.shadowRoot,'tp73-cool-dark-remote',TP73_DARK_REMOTE);
  card.shadowRoot?.querySelector('.tp-version-badge')?.replaceChildren('v0.3.73');
}
function tp73ApplyPopup(popup){
  tp73Style(popup.shadowRoot,'tp73-cool-dark-launcher',TP73_DARK_LAUNCHER);
  if(popup._dialog){
    tp73Style(popup._dialog,'tp73-cool-dark-dialog',TP73_DARK_DIALOG);
    if(popup._popupCard)tp73ApplyCard(popup._popupCard);
  }
}
const tp73OldCardConfig=TP73_CARD.prototype.setConfig;
TP73_CARD.prototype.setConfig=function(config){
  const result=tp73OldCardConfig.call(this,config);tp73ApplyCard(this);return result;
};
const tp73OldCardHass=Object.getOwnPropertyDescriptor(TP73_CARD.prototype,'hass')?.set;
if(tp73OldCardHass)Object.defineProperty(TP73_CARD.prototype,'hass',{
  configurable:true,set(value){tp73OldCardHass.call(this,value);if(this._config)tp73ApplyCard(this);}
});
const tp73OldToggle=TP73_CARD.prototype._toggleRemote;
if(tp73OldToggle)TP73_CARD.prototype._toggleRemote=function(...args){
  const result=tp73OldToggle.apply(this,args);queueMicrotask(()=>tp73ApplyCard(this));return result;
};
const tp73OldPopupConfig=TP73_POPUP.prototype.setConfig;
TP73_POPUP.prototype.setConfig=function(config){
  const result=tp73OldPopupConfig.call(this,config);tp73ApplyPopup(this);return result;
};
const tp73OldPopupOpen=TP73_POPUP.prototype._openPopup;
TP73_POPUP.prototype._openPopup=function(...args){
  const result=tp73OldPopupOpen.apply(this,args);tp73ApplyPopup(this);return result;
};
const tp73OldPopupHass=Object.getOwnPropertyDescriptor(TP73_POPUP.prototype,'hass')?.set;
if(tp73OldPopupHass)Object.defineProperty(TP73_POPUP.prototype,'hass',{
  configurable:true,set(value){tp73OldPopupHass.call(this,value);if(this._config)tp73ApplyPopup(this);}
});

console.info('TOTALPLAY COOL DARK v0.3.73');
