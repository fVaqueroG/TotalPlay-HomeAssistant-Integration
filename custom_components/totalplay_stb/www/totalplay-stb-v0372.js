/* Totalplay v0.3.72 — Corporate Image v1.0
 * Preserve every existing Totalplay logo asset unchanged. The interface now
 * uses a stable brand hierarchy derived from the current segmented logo:
 * Magenta primary; Cyan-Blue and Violet secondary; Gold/Lime accents; Red for
 * strong/power emphasis. Light/Dark/System keep their surface behavior while
 * brand interaction colors stay recognizably Totalplay.
 */
import './totalplay-stb-v0366.js?v=0.3.72';

const TP72_CARD = customElements.get('totalplay-stb-card');
const TP72_POPUP = customElements.get('totalplay-stb-popup-card');
if (!TP72_CARD || !TP72_POPUP) throw new Error('Totalplay Corporate Image: card components unavailable');

const TP72_TOKENS = `
  --tp-primary:#c52b6b;
  --tp-primary-hover:#b5225e;
  --tp-secondary-blue:#34a1c3;
  --tp-secondary-violet:#8f60a6;
  --tp-accent-gold:#e3a947;
  --tp-accent-lime:#a7c62c;
  --tp-accent-red:#cb3048;
  --tp-focus:#34a1c3;
  --tp-brand-stripe:linear-gradient(90deg,
    #e3a947 0 16.66%,#34a1c3 16.66% 33.33%,#8f60a6 33.33% 50%,
    #a7c62c 50% 66.66%,#cb3048 66.66% 83.33%,#c52b6b 83.33% 100%);
`;

const TP72_CARD_CSS = `
:host{${TP72_TOKENS}--tp-blue:var(--tp-primary)!important}
:host ha-card{position:relative!important}
:host ha-card::before{
  content:"";position:absolute;z-index:50;top:0;left:0;right:0;height:3px;
  background:var(--tp-brand-stripe);pointer-events:none;
}
:host([data-tp-light="yes"]) {
  --tp-blue:var(--tp-primary)!important;
  --tp72-active:color-mix(in srgb,var(--tp-primary) 12%,#ffffff);
}
:host([data-tp-palette="dark"]) {
  --tp-blue:var(--tp-primary)!important;
  --tp72-active:color-mix(in srgb,var(--tp-primary) 24%,#2a263b);
}
:host([data-tp-palette="system"]) {
  --tp-blue:var(--tp-primary)!important;
  --tp72-active:color-mix(in srgb,var(--tp-primary) 15%,var(--secondary-background-color,var(--card-background-color,#242424)));
}
:host .header .tabs .tab.on,
:host .header .tabs .tp-remote-trigger.on,
:host .pill.on,
:host .primary{
  background:var(--tp72-active,color-mix(in srgb,var(--tp-primary) 16%,var(--tp-bg)))!important;
  border-color:var(--tp-primary)!important;
}
:host .ch-num,
:host .channel b,
:host .now-line,
:host .now-line::before{color:var(--tp-primary)!important;background-color:var(--tp-primary)!important}
:host .programme.live{border-color:var(--tp-primary)!important}
:host .btn:focus-visible,
:host .tab:focus-visible,
:host .key:focus-visible,
:host .channel:focus-visible,
:host .programme:focus-visible,
:host .program-block:focus-visible,
:host .app:focus-visible,
:host .app-tile:focus-visible,
:host .pill:focus-visible,
:host .tp66-back-top:focus-visible{
  outline:3px solid var(--tp-focus)!important;outline-offset:2px!important;
}
:host .btn:hover,
:host .key:hover,
:host .app:hover,
:host .app-tile:hover,
:host .channel:hover,
:host .programme:hover,
:host .program-block:hover,
:host .tp66-back-top:hover{
  border-color:color-mix(in srgb,var(--tp-primary) 55%,var(--tp-line,var(--divider-color)))!important;
}
:host .key.power,
:host .rkey.power{color:var(--tp-accent-red)!important}
:host .tp66-back-top{
  --tp-blue:var(--tp-primary)!important;
}
`;

const TP72_REMOTE_CSS = `
:host{${TP72_TOKENS}--tp-blue:var(--tp-primary)!important}
:host .remote{position:relative!important}
:host .remote::before{
  content:"";position:absolute;left:22px;right:22px;top:0;height:3px;border-radius:0 0 3px 3px;
  background:var(--tp-brand-stripe);pointer-events:none;
}
:host .remote .dpad .rkey.ok,
:host .remote .rkey.ok{
  background:var(--tp-primary)!important;color:#fff!important;border-color:var(--tp-primary)!important;
}
:host .remote .rkey:focus-visible,
:host .remote .tp-remote-close:focus-visible,
:host .remote summary:focus-visible{
  outline:3px solid var(--tp-focus)!important;outline-offset:2px!important;
}
:host .remote .rkey.power{color:var(--tp-accent-red)!important}
`;

const TP72_LAUNCHER_CSS = `
:host{${TP72_TOKENS}}
:host ha-card{position:relative!important}
:host ha-card::before{
  content:"";position:absolute;z-index:5;left:0;right:0;top:0;height:3px;
  background:var(--tp-brand-stripe);pointer-events:none;
}
:host button:hover{
  background:color-mix(in srgb,var(--tp-primary) 10%,transparent)!important;
}
:host button:focus-visible{
  outline:3px solid var(--tp-focus)!important;outline-offset:-3px!important;
}
:host([data-popup-brand="icon"]) ha-icon,
:host([data-popup-brand="icon"]) .tp42-icon,
:host([data-popup-brand="icon"]) .tp44-ha-icon{
  color:var(--tp-primary)!important;
}
`;

const TP72_DIALOG_CSS = `
dialog.tp-stb-popup-dialog{${TP72_TOKENS}position:relative!important}
dialog.tp-stb-popup-dialog::after{
  content:"";position:absolute;z-index:8;top:0;left:0;right:0;height:3px;
  background:var(--tp-brand-stripe);pointer-events:none;
}
dialog.tp-stb-popup-dialog .tp-stb-popup-close:focus-visible{
  outline:3px solid var(--tp-focus)!important;outline-offset:2px!important;
}
`;

function tp72Style(root,id,css){
  if(!root)return;
  let style=root.querySelector?.('#'+id);
  if(!style){
    style=document.createElement('style');style.id=id;
    root.appendChild(style);
  }
  style.textContent=css;
}
function tp72ApplyCard(card){
  tp72Style(card.shadowRoot,'tp72-corporate-card',TP72_CARD_CSS);
  card.style.setProperty('--tp-primary','#c52b6b');
  card.style.setProperty('--tp-focus','#34a1c3');
  const portal=card._remotePortal;
  if(portal){
    tp72Style(portal.shadowRoot,'tp72-corporate-remote',TP72_REMOTE_CSS);
    portal.style.setProperty('--tp-primary','#c52b6b');
    portal.style.setProperty('--tp-focus','#34a1c3');
  }
  card.shadowRoot?.querySelector('.tp-version-badge')?.replaceChildren('v0.3.72');
}
function tp72ApplyPopup(popup){
  tp72Style(popup.shadowRoot,'tp72-corporate-launcher',TP72_LAUNCHER_CSS);
  popup.style.setProperty('--tp-primary','#c52b6b');
  popup.style.setProperty('--tp-focus','#34a1c3');
  const dialog=popup._dialog;
  if(dialog){
    tp72Style(dialog,'tp72-corporate-dialog',TP72_DIALOG_CSS);
    dialog.style.setProperty('--tp-primary','#c52b6b');
    dialog.style.setProperty('--tp-focus','#34a1c3');
    if(popup._popupCard)tp72ApplyCard(popup._popupCard);
  }
}
const tp72OldCardConfig=TP72_CARD.prototype.setConfig;
TP72_CARD.prototype.setConfig=function(config){
  const result=tp72OldCardConfig.call(this,config);tp72ApplyCard(this);return result;
};
const tp72OldCardHass=Object.getOwnPropertyDescriptor(TP72_CARD.prototype,'hass')?.set;
if(tp72OldCardHass)Object.defineProperty(TP72_CARD.prototype,'hass',{
  configurable:true,set(value){tp72OldCardHass.call(this,value);if(this._config)tp72ApplyCard(this);}
});
const tp72OldToggle=TP72_CARD.prototype._toggleRemote;
if(tp72OldToggle)TP72_CARD.prototype._toggleRemote=function(...args){
  const result=tp72OldToggle.apply(this,args);queueMicrotask(()=>tp72ApplyCard(this));return result;
};
const tp72OldPopupConfig=TP72_POPUP.prototype.setConfig;
TP72_POPUP.prototype.setConfig=function(config){
  const result=tp72OldPopupConfig.call(this,config);tp72ApplyPopup(this);return result;
};
const tp72OldPopupOpen=TP72_POPUP.prototype._openPopup;
TP72_POPUP.prototype._openPopup=function(...args){
  const result=tp72OldPopupOpen.apply(this,args);tp72ApplyPopup(this);return result;
};
const tp72OldPopupHass=Object.getOwnPropertyDescriptor(TP72_POPUP.prototype,'hass')?.set;
if(tp72OldPopupHass)Object.defineProperty(TP72_POPUP.prototype,'hass',{
  configurable:true,set(value){tp72OldPopupHass.call(this,value);if(this._config)tp72ApplyPopup(this);}
});

console.info('TOTALPLAY CORPORATE IMAGE v0.3.72');
