/* v0.3.23: Per-card Totalplay accent, contrast-safe artwork and taller tablet guide.
 * Keep the official Premium lineup, user EPG mappings and decoder controls.
 */
import './totalplay-stb-v0322.js?v=0.3.23';

const TP_THEME_CARD = customElements.get('totalplay-stb-card');
const TP_THEME_EDITOR = customElements.get('totalplay-stb-card-editor');
if (!TP_THEME_CARD || !TP_THEME_EDITOR) throw new Error('Totalplay card/editor unavailable');

const TP_LOGO_ACCENTS = Object.freeze({
  pink: ['Rosa', '#ed407e'], purple: ['Morado', '#9c59be'],
  blue: ['Azul', '#348de4'], cyan: ['Turquesa', '#27b9d2'],
  green: ['Verde', '#4abb67'], yellow: ['Amarillo', '#efc331'],
  orange: ['Naranja', '#f29135'],
});
const TP_CARD_THEME_CSS = `
/* Override older hard-coded coral accents in the imported frontend. */
:host { --tp-blue:var(--tp-custom-accent,#ed407e)!important; }
.header .tabs .tab.on,.header .tabs .tp-remote-trigger.on,
.header .tabs .tp-remote-trigger:focus-visible {
  border-color:var(--tp-blue)!important;box-shadow:inset 0 -2px var(--tp-blue)!important;
}
.pill.on {border-color:var(--tp-blue)!important;box-shadow:inset 0 -2px var(--tp-blue)!important;
  background:color-mix(in srgb,var(--tp-blue) 18%,#292929)!important;color:#fff!important}
.btn:hover,.app:hover,.programme:hover,.ch:hover,
.search:focus,.category:focus {border-color:var(--tp-blue)!important}
.programme.live {border-color:var(--tp-blue)!important}
.guide-scroll .grow .now,.guide-scroll .grow .now:before {background:var(--tp-blue)!important}
.ch-num {color:var(--tp-blue)!important}
.remote .dpad .rkey.ok,.remote .rkey.ok {background:var(--tp-blue)!important;
  border-color:var(--tp-blue)!important;color:#fff!important}
/* A mid-light neutral canvas and two-sided outline keep both dark and white
   official channel logos readable against the otherwise black card. */
.guide-scroll .grow:not(.head) .ch .ch-logo,
.guide-scroll.tp-wide-tight .grow:not(.head) .ch .ch-logo {
  background:linear-gradient(135deg,#f0f2f5,#c4cad2)!important;
  border:1px solid #a0a6b0!important;border-radius:11px!important;
  padding:4px!important;overflow:hidden!important;
  box-shadow:inset 0 1px 2px #ffffffa6,0 1px 3px #0007!important;
}
.guide-scroll .grow .ch .ch-logo img,
.guide-scroll .grow .ch .ch-logo img[data-tp-official] {
  width:100%!important;height:100%!important;object-fit:contain!important;
  padding:0!important;transform:none!important;
  filter:drop-shadow(0 1px 1px #000a) drop-shadow(0 -1px 1px #ffff)!important;
}
.apps-only .app-logo-image,.apps-strip .app-logo-image {
  background:linear-gradient(135deg,#f0f2f5,#c4cad2)!important;
  border:1px solid #a0a6b0!important;border-radius:12px!important;padding:5px!important;
  filter:drop-shadow(0 1px 1px #0007)!important;
}
/* The old guide stops at 69vh. Give tablets a little more vertical room,
   retaining scrolling within the guide so its toolbar stays accessible. */
.guide-scroll {height:76dvh!important;max-height:76dvh!important;}
@media(max-height:620px){.guide-scroll{height:70dvh!important;max-height:70dvh!important;}}
`;

// Merging multiple EPG feeds can produce equal station names with different
// station IDs. Favor a unique station in the best-ranked available source;
// never select between two regional stations from that same source by guess.
const tpThemePreviousChannels = TP_THEME_CARD.prototype._channels;
const tpEpgCanonical = Object.freeze({
  aztecauno:'azteca1',azteca1:'azteca1',aztecasiete:'azteca7',azteca7:'azteca7',
  canalcinco:'canal5',canal5:'canal5',lasestrellas:'estrellas',estrellas:'estrellas',
  imagentelevision:'imagen',imagentv:'imagen',forotv:'nforotv',nforotv:'nforotv',
  nuevenu9ve:'nueve',nu9ve:'nueve',warnerchannel:'warner',warnertv:'warner',
  sonychannel:'sony',discoverychannel:'discovery',nationalgeographic:'natgeo',
});
function tpThemeEpgKey(value) {
  const key=String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
    .replace(/\b(?:hd|sd|fhd|uhd|4k|mexico|mex|mx|latinoamerica|latam|latino|nacional)\b/g,'')
    .replace(/[^a-z0-9]/g,'');
  return tpEpgCanonical[key]||key;
}
function tpThemeEpgKeys(station) {
  const id=String(station.id||'').replace(/~tp\d+$/,'');
  return new Set([station.name,...(station.names||[]),id,
    id.replace(/^canal[._ -]+/i,''),id.replace(/\.(?:mx|tv|com|net|org)$/i,''),
    id.replace(/^canal[._ -]+/i,'').replace(/\.(?:mx|tv|com|net|org)$/i,'')]
    .map(tpThemeEpgKey).filter(key=>key.length>=3));
}
TP_THEME_CARD.prototype._channels=function(){
  const original=tpThemePreviousChannels.call(this);
  const guide=this._guide;
  if(!guide?.sources?.length || guide.sources.length<2 || !original.length)return original;
  const cached=this._tpThemeMatchCache;
  if(cached?.guide===guide&&cached?.config===this._config&&cached?.catalog===this._tpOfficialCatalog)
    return cached.channels;
  const keyed=new Map();
  for(const station of guide.channels||[]){
    for(const key of tpThemeEpgKeys(station)){
      if(!keyed.has(key))keyed.set(key,[]);
      keyed.get(key).push(station);
    }
  }
  const now=Date.now();
  const channels=original.map(channel=>{
    if(channel.epg_id)return channel;
    const key=tpThemeEpgKey(channel.epg_name||channel.name);
    const matches=keyed.get(key)||[];
    const ranked=[...new Map(matches.map(s=>[s.id,s])).values()]
      .sort((a,b)=>(a.source_rank??0)-(b.source_rank??0));
    if(!ranked.length)return channel;
    const viable=ranked.filter(s=>(s.schedule||[]).some(p=>
      Date.parse(p.start)<now+8*3600000&&Date.parse(p.stop)>now));
    const candidates=viable.length?viable:ranked;
    const firstRank=candidates[0].source_rank??0;
    const sameRank=candidates.filter(s=>(s.source_rank??0)===firstRank);
    return sameRank.length===1?{...channel,epg_id:sameRank[0].id}:channel;
  });
  this._tpThemeMatchCache={guide,config:this._config,catalog:this._tpOfficialCatalog,channels};
  return channels;
};

const tpThemePreviousSetConfig=TP_THEME_CARD.prototype.setConfig;
TP_THEME_CARD.prototype.setConfig=function(config){
  this._tpThemeMatchCache=null;
  tpThemePreviousSetConfig.call(this,config);
  const root=this.shadowRoot;
  if(!root)return;
  let style=root.querySelector('#tp-card-theme-v0323');
  if(!style){style=document.createElement('style');style.id='tp-card-theme-v0323';
    style.textContent=TP_CARD_THEME_CSS;root.appendChild(style);}
  const choice=TP_LOGO_ACCENTS[this._config?.accent_color]||TP_LOGO_ACCENTS.pink;
  this.style.setProperty('--tp-custom-accent',choice[1]);
  const badge=root.querySelector('.tp-version-badge');
  if(badge)badge.textContent='v0.3.23';
};

const tpThemePreviousEditorDraw=TP_THEME_EDITOR.prototype._draw;
TP_THEME_EDITOR.prototype._draw=function(){
  tpThemePreviousEditorDraw.call(this);
  const root=this.shadowRoot;
  if(!root||!this._config||root.querySelector('#tp-accent-editor-v0323'))return;
  const wrap=document.createElement('label');wrap.id='tp-accent-editor-v0323';
  wrap.className='field';wrap.style.cssText='display:flex;flex-direction:column;gap:7px;margin:12px 0';
  const label=document.createElement('span');label.textContent='Accent color (Totalplay logo)';
  const picker=document.createElement('select');picker.setAttribute('aria-label','Totalplay accent color');
  picker.style.cssText='width:100%;padding:10px;color:var(--primary-text-color);background:var(--card-background-color);border:1px solid var(--divider-color);border-radius:9px';
  for(const [key,[name,hex]] of Object.entries(TP_LOGO_ACCENTS)){
    const option=document.createElement('option');option.value=key;option.textContent=name;
    picker.appendChild(option);
  }
  picker.value=Object.hasOwn(TP_LOGO_ACCENTS,this._config.accent_color)?this._config.accent_color:'pink';
  const swatch=document.createElement('span');swatch.style.cssText='width:100%;height:5px;border-radius:6px';
  swatch.style.background=TP_LOGO_ACCENTS[picker.value][1];
  picker.addEventListener('change',()=>{swatch.style.background=TP_LOGO_ACCENTS[picker.value][1];
    this._change({accent_color:picker.value});});
  const hint=document.createElement('span');hint.className='help';
  hint.textContent='Changes this card only. Dark and light channel logos use a contrasting neutral tile.';
  wrap.append(label,picker,swatch,hint);
  root.insertBefore(wrap,root.firstChild?.nextSibling||null);
};
