/* v0.3.39: Standalone compact Lovelace card that opens the existing full card.
 * Both card types use the same Totalplay integration and standard card config.
 * Build the guide only when the popup opens; never place a full guide offscreen.
 */
const TP_POPUP_FULL = customElements.get('totalplay-stb-card');
if (!TP_POPUP_FULL) throw new Error('The full Totalplay card must load before the popup card');

const TP_POPUP_CSS = `
:host{display:block}
ha-card{background:var(--ha-card-background,var(--card-background-color,#1b1b1b));overflow:hidden;border-radius:14px}
button{display:flex;align-items:center;gap:11px;width:100%;min-height:58px;padding:10px 14px;
  border:0;background:transparent;color:var(--primary-text-color,#fff);cursor:pointer;text-align:left;font:inherit}
button:hover{background:color-mix(in srgb,var(--primary-color,#bc77d6) 12%,transparent)}
button:focus-visible{outline:2px solid var(--primary-color,#bc77d6);outline-offset:-3px}
.tp-p-mark{font-size:21px;letter-spacing:-8px;padding-right:8px;line-height:1;color:#e94b8f}
.tp-p-mark i{font-style:normal;color:#f3c853}
.tp-p-title{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:16px;font-weight:740}
.tp-p-expand{width:20px;height:20px;flex:none;opacity:.7}
`;
const TP_POPUP_DIALOG_CSS = `
dialog.tp-stb-popup-dialog{position:fixed;inset:0;box-sizing:border-box;border:1px solid var(--divider-color,#555);
  border-radius:18px;padding:0;margin:auto;width:min(1500px,calc(100vw - 18px));max-width:calc(100vw - 18px);
  height:min(1000px,calc(100dvh - 18px));max-height:calc(100dvh - 18px);
  color:var(--primary-text-color,#fff);background:var(--card-background-color,#181818);
  box-shadow:0 25px 90px #000a;overflow:hidden}
dialog.tp-stb-popup-dialog[open]{display:flex;flex-direction:column}
dialog.tp-stb-popup-dialog::backdrop{background:#000b;backdrop-filter:blur(3px)}
.tp-stb-popup-head{display:flex;align-items:center;justify-content:space-between;gap:10px;
  padding:7px 10px 7px 16px;min-height:47px;box-sizing:border-box;border-bottom:1px solid var(--divider-color,#494949)}
.tp-stb-popup-title{font-size:14px;font-weight:750;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tp-stb-popup-close{border:1px solid var(--divider-color,#555);border-radius:9px;
  color:var(--primary-text-color,#fff);background:transparent;padding:5px 12px;min-height:32px;
  font:inherit;cursor:pointer;flex:none}
.tp-stb-popup-close:hover{background:var(--secondary-background-color,#333)}
.tp-stb-popup-close:focus-visible{outline:2px solid var(--primary-color,#bc77d6);outline-offset:2px}
.tp-stb-popup-body{flex:1 1 auto;min-height:0;overflow:auto;overscroll-behavior:contain;padding:0 6px 7px;
  scrollbar-width:thin}
.tp-stb-popup-body>totalplay-stb-card{display:block;width:100%;max-width:none}
@media(max-width:580px){
  dialog.tp-stb-popup-dialog{width:calc(100vw - 8px);max-width:calc(100vw - 8px);
    height:calc(100dvh - 8px);max-height:calc(100dvh - 8px);border-radius:11px}
  .tp-stb-popup-head{min-height:42px;padding:5px 8px 5px 12px}
  .tp-stb-popup-body{padding:0 3px 4px}
}
`;

class TotalplayStbPopupCard extends HTMLElement {
  static getConfigElement() {
    // One visual editor and one set of configuration options for both views.
    return document.createElement('totalplay-stb-card-editor');
  }
  static getStubConfig(hass) {
    return {...(TP_POPUP_FULL.getStubConfig?.(hass) || {}), title:'Totalplay'};
  }
  getCardSize() {return 1;}
  setConfig(config) {
    if (!config || typeof config !== 'object') throw new Error('Configure a Totalplay decoder');
    this._config = {...config};
    if (!this.shadowRoot) this.attachShadow({mode:'open'});
    const root=this.shadowRoot;
    root.replaceChildren();
    const css=document.createElement('style');css.textContent=TP_POPUP_CSS;
    const card=document.createElement('ha-card');
    const button=document.createElement('button');button.type='button';
    button.setAttribute('aria-label','Open Totalplay guide and remote');
    const mark=document.createElement('span');mark.className='tp-p-mark';mark.setAttribute('aria-hidden','true');
    mark.innerHTML='◀<i>▶</i>';
    const name=document.createElement('span');name.className='tp-p-title';
    name.textContent=this._config.popup_title || this._config.title || 'Totalplay';
    const expand=document.createElement('ha-icon');expand.className='tp-p-expand';expand.setAttribute('icon','mdi:arrow-expand');
    expand.setAttribute('aria-hidden','true');
    button.append(mark,name,expand);
    button.addEventListener('click',()=>this._openPopup());
    card.append(button);root.append(css,card);
    this._button=button;
  }
  set hass(hass) {
    this._hass=hass;
    if (this._popupCard && this._dialog?.open) this._popupCard.hass=hass;
  }
  _openPopup() {
    if (this._dialog) {
      if (this._dialog.open) return;
      this._cleanupPopup();
    }
    const dialog=document.createElement('dialog');dialog.className='tp-stb-popup-dialog';
    dialog.setAttribute('aria-label','Totalplay full guide and remote');
    const css=document.createElement('style');css.textContent=TP_POPUP_DIALOG_CSS;
    const header=document.createElement('div');header.className='tp-stb-popup-head';
    const title=document.createElement('span');title.className='tp-stb-popup-title';
    title.textContent=this._config.popup_title || this._config.title || 'Totalplay';
    const close=document.createElement('button');close.type='button';close.className='tp-stb-popup-close';
    close.textContent='✕  Close';close.setAttribute('aria-label','Close Totalplay popup');
    close.addEventListener('click',()=>dialog.close());
    header.append(title,close);
    const body=document.createElement('div');body.className='tp-stb-popup-body';
    dialog.append(css,header,body);
    dialog.addEventListener('click',event=>{
      if (event.target===dialog) dialog.close();
    });
    dialog.addEventListener('close',()=>this._cleanupPopup(),{once:true});
    this._dialog=dialog;
    document.body.appendChild(dialog);
    try {
      dialog.showModal();
      const full=document.createElement('totalplay-stb-card');
      this._popupCard=full;
      body.appendChild(full);
      const config={...this._config};
      delete config.popup_title;
      config.type='custom:totalplay-stb-card';
      full.setConfig(config);
      // The popup has a bounded viewport. Fit the existing guide to that
      // viewport, not to the bottom of the unrelated dashboard below it.
      full._tpFitGuideHeight=function(){
        const scroll=this._scroll;
        if (!scroll || !this.isConnected || this._tab==='apps') return;
        const rect=scroll.getBoundingClientRect();
        if (!rect.width) return;
        const selected=this._selected?.getBoundingClientRect().height||0;
        const feedback=this._feedback?.getBoundingClientRect().height||0;
        const bottom=Math.min(window.innerHeight-9,body.getBoundingClientRect().bottom);
        const pixels=`${Math.max(190,Math.floor(bottom-rect.top-Math.max(35,selected+feedback+18)))}px`;
        if (scroll.style.getPropertyValue('--tp38-guide-height').trim()===pixels) return;
        scroll.style.setProperty('--tp38-guide-height',pixels);
        scroll.style.setProperty('height',pixels,'important');
        scroll.style.setProperty('max-height',pixels,'important');
      };
      if (this._hass) full.hass=this._hass;
      full._tpQueueGuideFit?.();
      close.focus();
    } catch (error) {
      this._cleanupPopup();
      console.error('Could not open the Totalplay popup',error);
    }
  }
  _cleanupPopup() {
    const dialog=this._dialog;
    if (!dialog) return;
    this._dialog=null;
    this._popupCard=null;
    if (dialog.open) dialog.close();
    dialog.remove();
    if (this.isConnected) this._button?.focus();
  }
  disconnectedCallback() {this._cleanupPopup();}
}
if (!customElements.get('totalplay-stb-popup-card'))
  customElements.define('totalplay-stb-popup-card',TotalplayStbPopupCard);
window.customCards=window.customCards||[];
if (!window.customCards.some(card=>card.type==='totalplay-stb-popup-card')) {
  window.customCards.push({type:'totalplay-stb-popup-card',name:'Totalplay — Popup button',
    description:'Compact Totalplay button that opens the full guide, apps and remote in a popup',preview:false});
}
