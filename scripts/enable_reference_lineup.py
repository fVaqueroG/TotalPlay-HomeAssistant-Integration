"""One-time, assertion-guarded application of the Totalplay reference lineup card patch."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'custom_components' / 'totalplay_stb'
js = ROOT / 'www' / 'totalplay-stb-card.js'
backend = ROOT / '__init__.py'


def replace_once(text, before, after):
    count = text.count(before)
    if count != 1:
        raise RuntimeError(f'Expected exactly one patch anchor, found {count}: {before[:110]}')
    return text.replace(before, after, 1)


code = js.read_text(encoding='utf-8')
code = replace_once(code, 'previous_channel_command:"KEY_TV_SWAP"};', 'previous_channel_command:"KEY_TV_SWAP",lineup:true};')
code = replace_once(code, ' set hass(hass){this._hass=hass;this._render();this._loadGuide();}', ' set hass(hass){this._hass=hass;this._render();this._loadGuide();this._loadLineup();}')
code = replace_once(code,
  'card.appendChild(tpEl("div","heading","Channels"));const channels=tpEl("div","tiles");this._programs=[];for(const ch of this._config.channels){',
  '''card.appendChild(tpEl("div","heading","Channels"));
 const byNumber=new Map((this._config.lineup?(this._reference?.channels||[]):[]).map(ch=>[String(ch.number),{...ch}]));
 for(const ch of this._config.channels){const key=String(ch.number);byNumber.set(key,{...(byNumber.get(key)||{}),...ch});}
 const allChannels=[...byNumber.values()].filter(ch=>tpValid(ch.number)).sort((a,b)=>Number(a.number)-Number(b.number));
 const groups=["All",...[...new Set(allChannels.map(ch=>ch.category||"Custom"))]];
 if(!groups.includes(this._category))this._category="All";
 const category=tpEl("select","category");category.setAttribute("aria-label","Channel category");
 for(const label of groups){const option=tpEl("option","",label);option.value=label;category.appendChild(option);}
 category.value=this._category;category.onchange=()=>{this._category=category.value;this._build();};card.appendChild(category);
 const channels=tpEl("div","tiles");this._programs=[];
 for(const ch of allChannels){if(this._category!=="All"&&(ch.category||"Custom")!==this._category)continue;''')
code = replace_once(code,
  'card.appendChild(tpEl("div","heading","Apps"));const apps=tpEl("div","tiles");for(const app of this._config.apps){',
  '''card.appendChild(tpEl("div","heading","Apps"));const apps=tpEl("div","tiles");
 const appsByNumber=new Map((this._config.lineup?(this._reference?.apps||[]):[]).map(app=>[String(app.number),{...app}]));
 for(const app of this._config.apps){const key=String(app.number);appsByNumber.set(key,{...(appsByNumber.get(key)||{}),...app});}
 for(const app of [...appsByNumber.values()].sort((a,b)=>Number(a.number)-Number(b.number))){''')
code = replace_once(code,
  ' async _loadGuide(){',
  ''' async _loadLineup(){
  if(!this._hass||!this._config?.lineup||this._lineupLoading||this._lineupLoaded)return;
  this._lineupLoading=true;
  try{
   const response=await fetch("/totalplay_stb/lineup.txt",{cache:"no-store"});
   if(!response.ok)throw Error(`Lineup HTTP ${response.status}`);
   const text=await response.text(),channels=[],apps=[];
   for(const line of text.split(/\\r?\\n/)){
    if(line.startsWith("#")||!line.trim())continue;
    const [kind,number,name,category]=line.split("|");
    if(!tpValid(number)||!name||name.length>120)continue;
    if(kind==="C")channels.push({number,name,category:category||"Custom"});
    if(kind==="A")apps.push({number,name});
   }
   if(!channels.length||!apps.length)throw Error("Empty reference lineup");
   this._reference={channels,apps};this._lineupLoaded=true;this._build();
  }catch(error){this._lineupLoaded=true;console.warn("Totalplay reference lineup unavailable:",error);}
  finally{this._lineupLoading=false;}
 }
 async _loadGuide(){''')
code = replace_once(code,
  ' this._field(root,"Card title",this._config.title,title=>this._change({title}));const epgRow=',
  ''' this._field(root,"Card title",this._config.title,title=>this._change({title}));
 const lineupRow=tpEl("label","field"),lineupToggle=tpEl("input");lineupToggle.type="checkbox";lineupToggle.style.width="auto";lineupToggle.checked=!!this._config.lineup;lineupToggle.onchange=()=>this._change({lineup:lineupToggle.checked});lineupRow.appendChild(lineupToggle);lineupRow.appendChild(tpEl("span","","Show bundled community channel and app reference lineup"));root.appendChild(lineupRow);
 const epgRow=''')
code = replace_once(code,
  '.error{color:var(--error-color)}`;',
  '.error{color:var(--error-color)}.category{box-sizing:border-box;padding:8px;margin-bottom:10px;background:var(--card-background-color);color:var(--primary-text-color);border:1px solid var(--divider-color);border-radius:8px}`;')
js.write_text(code,encoding='utf-8')

source = backend.read_text(encoding='utf-8')
source = replace_once(source,
  '        card_file = Path(__file__).parent / "www" / "totalplay-stb-card.js"',
  '        card_file = Path(__file__).parent / "www" / "totalplay-stb-card.js"\n        lineup_file = Path(__file__).parent / "www" / "lineup.txt"')
source = replace_once(source,
  '[StaticPathConfig(_CARD_URL, str(card_file), False)]',
  '[StaticPathConfig(_CARD_URL, str(card_file), False),\n             StaticPathConfig("/totalplay_stb/lineup.txt", str(lineup_file), False)]')
backend.write_text(source,encoding='utf-8')
print('Patch applied: reference lineup, category selector, visual toggle and static route')
