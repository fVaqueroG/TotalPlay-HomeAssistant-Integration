/* Totalplay v0.3.74 — configurable accent + channel-number visibility.
 * Preserve the Totalplay logo and segmented brand stripe. The selected accent
 * changes interactive states; channel numbers remain text-only and readable.
 */
import './totalplay-stb-v0373.js?v=0.3.74';

const TP74_CARD=customElements.get('totalplay-stb-card');
const TP74_POPUP=customElements.get('totalplay-stb-popup-card');
const TP74_EDITOR=customElements.get('totalplay-stb-card-editor');
const TP74_POPUP_EDITOR=customElements.get('totalplay-stb-popup-card-editor');
if(!TP74_CARD||!TP74_POPUP||!TP74_EDITOR)throw new Error('Totalplay accent controls unavailable');

const TP74_ACCENTS=Object.freeze({
  magenta:Object.freeze({label:'Magenta',hex:'#C52B6B'}),
  cyan:Object.freeze({label:'Cyan Blue',hex:'#34A1C3'}),
  violet:Object.freeze({label:'Violet',hex:'#8F60A6'}),
  gold:Object.freeze({label:'Gold',hex:'#E3A947'}),
  lime:Object.freeze({label:'Lime',hex:'#A7C62C'}),
  red:Object.freeze({label:'Red',hex:'#CB3048'})
});
const tp74Hex=(value,fallback='#C52B6B')=>{
  const text=String(value||'').trim();
  if(/^#[0-9a-f]{6}$/i.test(text))return text.toUpperCase();
  if(/^#[0-9a-f]{3}$/i.test(text))return '#'+[...text.slice(1)].map(ch=>ch+ch).join('').toUpperCase();
  return fallback;
};
function tp74Preset(config){
  const explicit=String(config?.accent_preset||'').trim().toLowerCase();
  if(Object.hasOwn(TP74_ACCENTS,explicit)||explicit==='custom')return explicit;
  const saved=config?.accent_color;
  if(saved){
    const hex=tp74Hex(saved);
    const match=Object.entries(TP74_ACCENTS).find(([,item])=>item.hex===hex);
    return match?.[0]||'custom';
  }
  return 'magenta';
}
function tp74Accent(config){
  const preset=tp74Preset(config);
  return preset==='custom'?tp74Hex(config?.accent_color):TP74_ACCENTS[preset].hex;
}
function tp74Ink(hex){
  const color=tp74Hex(hex);
  const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255)
    .map(v=>v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4));
  const lum=0.2126*rgb[0]+0.7152*rgb[1]+0.0722*rgb[2];
  return lum>0.34?'#0E1420':'#FFFFFF';
}
function tp74ApplyAccent(target,config){
  if(!target?.style)return;
  const accent=tp74Accent(config);
  target.style.setProperty('--tp-primary',accent);
  target.style.setProperty('--tp-blue',accent);
  target.style.setProperty('--primary-color',accent);
  target.style.setProperty('--mdc-theme-primary',accent);
  target.style.setProperty('--tp-accent-ink',tp74Ink(accent));
  target.dataset.tpAccent=tp74Preset(config);
}
const TP74_FIX_CSS=`
:host .ch-num,
:host .channel b{
  color:var(--tp-primary,#C52B6B)!important;
  background:transparent!important;
  background-color:transparent!important;
  box-shadow:none!important;
}
:host .now-line,
:host .now-line::before{
  background:var(--tp-primary,#C52B6B)!important;
}
:host .remote .dpad .rkey.ok,
:host .remote .rkey.ok,
:host .primary{
  background:var(--tp-primary,#C52B6B)!important;
  border-color:var(--tp-primary,#C52B6B)!important;
  color:var(--tp-accent-ink,#fff)!important;
}
`;
function tp74Style(root){
  if(!root||root.querySelector?.('#tp74-accent-fixes'))return;
  const style=document.createElement('style');
  style.id='tp74-accent-fixes';style.textContent=TP74_FIX_CSS;root.appendChild(style);
}
function tp74ApplyCard(card){
  tp74ApplyAccent(card,card._config);
  tp74Style(card.shadowRoot);
  const portal=card._remotePortal;
  if(portal){
    tp74ApplyAccent(portal,card._config);
    tp74Style(portal.shadowRoot);
  }
  card.shadowRoot?.querySelector('.tp-version-badge')?.replaceChildren('v0.3.74');
}
function tp74ApplyPopup(popup){
  tp74ApplyAccent(popup,popup._config);
  tp74Style(popup.shadowRoot);
  if(popup._dialog){
    tp74ApplyAccent(popup._dialog,popup._config);
    if(popup._popupCard)tp74ApplyCard(popup._popupCard);
  }
}
function tp74AccentField(owner,root,klass,onchange){
  if(!root||root.querySelector('[data-tp74-accent-field]'))return null;
  const config=owner?._config||{};
  const preset=tp74Preset(config);
  const accent=tp74Accent(config);
  const field=document.createElement('label');
  field.className=klass;
  field.dataset.tp74AccentField='true';
  const title=document.createElement('span');title.textContent='Accent color';
  const select=document.createElement('select');
  select.dataset.tp74Accent='true';
  for(const [key,item] of Object.entries(TP74_ACCENTS)){
    const option=document.createElement('option');
    option.value=key;option.textContent=item.label+' · '+item.hex;select.appendChild(option);
  }
  const custom=document.createElement('option');
  custom.value='custom';custom.textContent='Custom';select.appendChild(custom);
  select.value=preset;
  const picker=document.createElement('input');
  picker.type='color';picker.value=accent;picker.disabled=preset!=='custom';
  picker.title='Custom accent color';
  const help=document.createElement('small');
  help.textContent='Changes selected controls and highlights; Totalplay logo colors stay unchanged.';
  select.addEventListener('change',()=>{
    const key=select.value;
    picker.disabled=key!=='custom';
    const color=key==='custom'?picker.value:TP74_ACCENTS[key].hex;
    picker.value=color;
    onchange({accent_preset:key,accent_color:color});
  });
  picker.addEventListener('change',()=>{
    select.value='custom';picker.disabled=false;
    onchange({accent_preset:'custom',accent_color:picker.value.toUpperCase()});
  });
  field.append(title,select,picker,help);
  return field;
}

const tp74OldCardConfig=TP74_CARD.prototype.setConfig;
TP74_CARD.prototype.setConfig=function(config){
  const result=tp74OldCardConfig.call(this,config);tp74ApplyCard(this);return result;
};
const tp74OldCardHass=Object.getOwnPropertyDescriptor(TP74_CARD.prototype,'hass')?.set;
if(tp74OldCardHass)Object.defineProperty(TP74_CARD.prototype,'hass',{
  configurable:true,set(value){tp74OldCardHass.call(this,value);if(this._config)tp74ApplyCard(this);}
});
const tp74OldToggle=TP74_CARD.prototype._toggleRemote;
if(tp74OldToggle)TP74_CARD.prototype._toggleRemote=function(...args){
  const result=tp74OldToggle.apply(this,args);queueMicrotask(()=>tp74ApplyCard(this));return result;
};
const tp74OldPopupConfig=TP74_POPUP.prototype.setConfig;
TP74_POPUP.prototype.setConfig=function(config){
  const result=tp74OldPopupConfig.call(this,config);tp74ApplyPopup(this);return result;
};
const tp74OldPopupOpen=TP74_POPUP.prototype._openPopup;
TP74_POPUP.prototype._openPopup=function(...args){
  const result=tp74OldPopupOpen.apply(this,args);tp74ApplyPopup(this);return result;
};
const tp74OldPopupHass=Object.getOwnPropertyDescriptor(TP74_POPUP.prototype,'hass')?.set;
if(tp74OldPopupHass)Object.defineProperty(TP74_POPUP.prototype,'hass',{
  configurable:true,set(value){tp74OldPopupHass.call(this,value);if(this._config)tp74ApplyPopup(this);}
});

const tp74OldEditorDraw=TP74_EDITOR.prototype._draw;
TP74_EDITOR.prototype._draw=function(...args){
  const result=tp74OldEditorDraw.apply(this,args);
  const root=this.shadowRoot;
  if(!root||!this._config)return result;
  const field=tp74AccentField(this,root,'edit-field',patch=>this._change(patch));
  if(field){
    const labels=[...root.querySelectorAll('label.edit-field')];
    const theme=labels.find(label=>label.querySelector(':scope > span')?.textContent?.trim()==='Theme');
    const title=labels.find(label=>label.querySelector(':scope > span')?.textContent?.trim()==='Card title');
    if(theme)theme.after(field);else if(title)title.after(field);else root.prepend(field);
  }
  const existing=root.querySelector('[data-tp74-accent-field]');
  if(existing&&this._tp74HideAccent)existing.hidden=true;
  return result;
};

if(TP74_POPUP_EDITOR?.prototype?._draw){
  const tp74OldPopupDraw=TP74_POPUP_EDITOR.prototype._draw;
  TP74_POPUP_EDITOR.prototype._draw=function(...args){
    const result=tp74OldPopupDraw.apply(this,args);
    const fields=this.shadowRoot?.querySelector('.tp-popup-fields');
    if(!fields)return result;
    const field=tp74AccentField(this,fields,'tp-field',patch=>this._emit(patch));
    if(field){
      const labels=[...fields.querySelectorAll('label.tp-field')];
      const theme=labels.find(label=>label.querySelector(':scope > span')?.textContent?.trim()==='Theme');
      if(theme)theme.after(field);else fields.prepend(field);
    }
    if(this._fullEditor){
      this._fullEditor._tp74HideAccent=true;
      const duplicate=this._fullEditor.shadowRoot?.querySelector('[data-tp74-accent-field]');
      if(duplicate)duplicate.hidden=true;
    }
    return result;
  };
}

const tp74Stub=TP74_CARD.getStubConfig;
if(typeof tp74Stub==='function')TP74_CARD.getStubConfig=function(...args){
  return {...tp74Stub.apply(this,args),accent_preset:'magenta',accent_color:'#C52B6B'};
};
const tp74PopupStub=TP74_POPUP.getStubConfig;
if(typeof tp74PopupStub==='function')TP74_POPUP.getStubConfig=function(...args){
  return {...tp74PopupStub.apply(this,args),accent_preset:'magenta',accent_color:'#C52B6B'};
};

console.info('TOTALPLAY ACCENT FIX v0.3.74');
