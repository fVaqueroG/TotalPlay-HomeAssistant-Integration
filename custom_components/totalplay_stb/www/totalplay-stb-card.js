/* Totalplay Channels, Apps & Remote v0.2.4. All source data is optional. */
const TP_CSS=`:host{display:block}ha-card{padding:16px}.top{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}.title{font-weight:600;font-size:19px}.small,.program,.status{font-size:12px;color:var(--secondary-text-color)}.heading{font-weight:600;margin:15px 0 8px}.tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(125px,1fr));gap:8px}.tile,.key,.toggle{font:inherit;color:var(--primary-text-color);background:var(--card-background-color);border:1px solid var(--divider-color);border-radius:12px;padding:10px;cursor:pointer}.tile{display:flex;flex-direction:column;gap:5px;min-height:90px;text-align:left}.number{font-size:22px;color:var(--primary-color);font-weight:700}.program{overflow-wrap:anywhere}.tile:disabled,.key:disabled{opacity:.45}.remote{border:1px solid var(--divider-color);border-radius:12px;padding:8px;margin:10px 0}.row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin:7px 0}.key{min-height:48px}.key.digit{font-size:22px;min-height:62px}.active{background:var(--primary-color);color:var(--text-primary-color,white)}.status{min-height:1em;margin-top:10px}.error{color:var(--error-color)}.category{box-sizing:border-box;padding:8px;margin-bottom:10px;background:var(--card-background-color);color:var(--primary-text-color);border:1px solid var(--divider-color);border-radius:8px}`;
const TP_DEFAULT={title:"Totalplay TV",channels:[],apps:[{name:"Netflix",number:"333"}],epg:true,previous_channel_command:"KEY_TV_SWAP",lineup:true};
const tpEl=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
const tpValid=value=>/^[0-9]{1,4}$/.test(String(value??"").trim())&&Number(value)>0;
const tpNorm=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");
const tpPlayers=hass=>Object.entries(hass?.states||{}).filter(([id,state])=>id.startsWith("media_player.")&&Object.prototype.hasOwnProperty.call(state.attributes||{},"last_requested_channel"));
function tpGuideMatch(guide,ch){
 const list=guide?.channels||[];
 if(ch.epg_id)return list.find(g=>g.id===ch.epg_id)||null;
 const wanted=tpNorm(ch.name);
 if(!wanted)return null;
 const names=g=>Array.isArray(g.names)&&g.names.length?g.names:[g.name];
 // Never resolve an ambiguous station using a substring or channel number.
 const exact=list.filter(g=>names(g).some(name=>tpNorm(name)===wanted));
 if(exact.length===1)return exact[0];
 if(exact.length>1)return null;
 // A suffix like HD, SD, México or MX is not a different station.
 const base=name=>tpNorm(name).replace(/(?:highdefinition|mexico|hd|sd|mx)+$/g,"");
 const stripped=base(ch.name);
 if(!stripped)return null;
 const possible=list.filter(g=>names(g).some(name=>base(name)===stripped));
 return possible.length===1?possible[0]:null;
}
class TotalplayStbCard extends HTMLElement{
 static getConfigElement(){return document.createElement("totalplay-stb-card-editor");}
 static getStubConfig(hass){return {entity:tpPlayers(hass)[0]?.[0]||"",title:"Totalplay TV"};}
 setConfig(config){if(!config||typeof config!=="object")throw Error("Totalplay card needs configuration");if(config.entity&&(!String(config.entity).startsWith("media_player.")))throw Error("Select a Totalplay media player");this._config={...TP_DEFAULT,...config};if(!Array.isArray(this._config.channels)||!Array.isArray(this._config.apps))throw Error("channels and apps must be lists");if(!this.shadowRoot)this.attachShadow({mode:"open"});this._remoteOpen=this._remoteOpen||false;this._tab=this._tab||"navigate";this._build();}
 set hass(hass){this._hass=hass;this._render();this._loadGuide();this._loadLineup();}
 getCardSize(){return 6;}
 _button(label,command,cls="key"){const b=tpEl("button",cls,label);b.type="button";b.setAttribute("aria-label",label);if(command)b.addEventListener("click",()=>this._command(command));return b;}
 _row(items){const row=tpEl("div","row");for(const [label,key] of items)row.appendChild(key?this._button(label,key):tpEl("div"));return row;}
 _build(){const root=this.shadowRoot;root.replaceChildren(tpEl("style","",TP_CSS));const card=tpEl("ha-card");const top=tpEl("div","top");top.appendChild(tpEl("div","title",this._config.title));this._source=tpEl("div","small");top.appendChild(this._source);const toggle=this._button("Remote ▾",null,"toggle");toggle.onclick=()=>{this._remoteOpen=!this._remoteOpen;toggle.textContent=this._remoteOpen?"Remote ▴":"Remote ▾";this._remote.hidden=!this._remoteOpen;};top.appendChild(toggle);card.appendChild(top);
 this._remote=tpEl("div","remote");this._remote.hidden=!this._remoteOpen;card.appendChild(this._remote);this._drawRemote();
 card.appendChild(tpEl("div","heading","Channels"));
 this._guideStatus=tpEl("div","small",this._config.epg?"TV guide: loading…":"TV guide disabled");
 this._guideStatus.setAttribute("role","status");card.appendChild(this._guideStatus);
 const byNumber=new Map((this._config.lineup?(this._reference?.channels||[]):[]).map(ch=>[String(ch.number),{...ch}]));
 for(const ch of this._config.channels){const key=String(ch.number);byNumber.set(key,{...(byNumber.get(key)||{}),...ch});}
 const allChannels=[...byNumber.values()].filter(ch=>tpValid(ch.number)).sort((a,b)=>Number(a.number)-Number(b.number));
 const groups=["All",...[...new Set(allChannels.map(ch=>ch.category||"Custom"))]];
 if(!groups.includes(this._category))this._category="All";
 const category=tpEl("select","category");category.setAttribute("aria-label","Channel category");
 for(const label of groups){const option=tpEl("option","",label);option.value=label;category.appendChild(option);}
 category.value=this._category;category.onchange=()=>{this._category=category.value;this._build();};card.appendChild(category);
 const channels=tpEl("div","tiles");this._programs=[];
 for(const ch of allChannels){if(this._category!=="All"&&(ch.category||"Custom")!==this._category)continue;if(!tpValid(ch.number))continue;const tile=tpEl("button","tile");tile.type="button";tile.appendChild(tpEl("div","number",String(ch.number)));tile.appendChild(tpEl("div","",String(ch.name||`Channel ${ch.number}`)));const program=tpEl("div","program","Programme information unavailable");tile.appendChild(program);this._programs.push({ch,program});tile.onclick=()=>this._play("channel",String(ch.number));channels.appendChild(tile);}if(!channels.childElementCount)channels.appendChild(tpEl("div","small","Configure channel numbers in the visual editor."));card.appendChild(channels);
 card.appendChild(tpEl("div","heading","Apps"));const apps=tpEl("div","tiles");
 const appsByNumber=new Map((this._config.lineup?(this._reference?.apps||[]):[]).map(app=>[String(app.number),{...app}]));
 for(const app of this._config.apps){const key=String(app.number);appsByNumber.set(key,{...(appsByNumber.get(key)||{}),...app});}
 for(const app of [...appsByNumber.values()].sort((a,b)=>Number(a.number)-Number(b.number))){const tile=tpEl("button","tile");tile.type="button";tile.appendChild(tpEl("div","",String(app.name||"App")));tile.appendChild(tpEl("div","small",tpValid(app.number)?`Channel ${app.number}`:"Set app channel in editor"));tile.disabled=!tpValid(app.number);tile.onclick=()=>this._play("app",String(app.number));apps.appendChild(tile);}card.appendChild(apps);this._feedback=tpEl("div","status");this._feedback.setAttribute("role","status");card.appendChild(this._feedback);root.appendChild(card);this._render();}
 _drawRemote(){const p=this._remote;p.replaceChildren();const tabs=tpEl("div","row");for(const [id,label] of [["navigate","Navigation"],["media","Playback"],["numbers","Keypad"]]){const b=this._button(label,null,this._tab===id?"key active":"key");b.onclick=()=>{this._tab=id;this._drawRemote();};tabs.appendChild(b);}p.appendChild(tabs);
 if(this._tab==="navigate"){p.appendChild(this._row([["Menu","KEY_MENU"],["Guide","KEY_GUIDE"],["Power","on_off"]]));p.appendChild(this._row([["",null],["▲","up"],["",null]]));p.appendChild(this._row([["◀","left"],["OK","ok"],["▶","right"]]));p.appendChild(this._row([["",null],["▼","down"],["",null]]));p.appendChild(this._row([["Back","back"],["Mute","mute"],["Info","KEY_TV_AUDIO"]]));p.appendChild(this._row([["Vol −","volume_down"],["Pause / Play","play_pause"],["Vol +","volume_up"]]));p.appendChild(this._row([["CH −","channel_down"],["Previous",this._config.previous_channel_command],["CH +","channel_up"]]));}
 else if(this._tab==="media"){p.appendChild(this._row([["Vol −","volume_down"],["Mute","mute"],["Vol +","volume_up"]]));p.appendChild(this._row([["Rewind","prev"],["Pause / Play","play_pause"],["Forward","next"]]));p.appendChild(this._row([["Previous","prev_track"],["Stop","stop"],["Next","next_track"]]));p.appendChild(this._row([["Audio","audio"],["Back","back"],["CH +","channel_up"]]));}
 else {for(const digits of [["1","2","3"],["4","5","6"],["7","8","9"]])p.appendChild(this._row(digits.map(d=>[d,d])));p.appendChild(this._row([["Previous",this._config.previous_channel_command],["0","0"],["Delete","delete"]]));}
 }
 _remoteEntity(){if(this._config.remote)return this._config.remote;const players=this._hass?.states||{},entry=players[this._config.entity];const deviceId=entry?.attributes?.friendly_name;void deviceId;const guessed=`remote.${String(this._config.entity||"").slice(13).replace(/_media_player$/,"")}_remote`;return players[guessed]?guessed:null;}
 _render(){if(!this._hass||!this._config||!this._source)return;const decoder=this._hass.states[this._config.entity];if(!decoder){this._source.textContent="Select an available Totalplay decoder";}else{const tvId=decoder.attributes.connected_tv_entity,wanted=decoder.attributes.connected_tv_source,tv=tvId?this._hass.states[tvId]:null,actual=tv?.attributes?.source;this._source.textContent=!tvId||!wanted?"No TV/input linked":!actual||actual==="unknown"||actual==="unavailable"?`TV input unknown · target ${wanted}`:String(actual).trim().toLowerCase()===String(wanted).trim().toLowerCase()?`TV input: ${actual} ✓`:`TV input: ${actual} · target ${wanted}`;}
 const now=Date.now();
 if(this._guideStatus){
  const guide=this._guide,visible=this._programs||[];
  const matches=visible.map(({ch})=>tpGuideMatch(guide,ch)).filter(Boolean);
  const onAir=matches.filter(g=>g.schedule?.some(p=>Date.parse(p.start)<=now&&now<Date.parse(p.stop))).length;
  this._guideStatus.textContent=!this._config.epg?"TV guide disabled":
   !guide?"TV guide: loading…":
   guide.error?`TV guide unavailable (${guide.error}); channel control still works`:
   `TV guide: ${onAir} on-air / ${matches.length} matched channels shown (${guide.channels?.length||0} stations in guide). Unmatched channels can be mapped in the visual editor.`;
 }
 for(const {ch,program} of this._programs||[]){const state=ch.program_entity?this._hass.states[ch.program_entity]:null,attrs=state?.attributes||{},sensor=attrs.current_program||attrs.program_title||attrs.program||attrs.title||state?.state;let title=typeof sensor==="string"&&!['unknown','unavailable','none'].includes(sensor.toLowerCase())?sensor:"";let next="";if(!title&&this._config.epg){const match=tpGuideMatch(this._guide,ch);const schedule=match?.schedule||[];const current=schedule.find(p=>Date.parse(p.start)<=now&&now<Date.parse(p.stop));const following=schedule.find(p=>Date.parse(p.start)>now);if(current){title=current.title;next=following?.title||"";}else if(following){next=following.title;}}program.textContent=title?`Now: ${title}${next?` · Next: ${next}`:""}`:next?`Next: ${next}`:"Programme information unavailable";program.title=next?`Next: ${next}`:"";}}
 async _loadLineup(){
  if(!this._hass||!this._config?.lineup||this._lineupLoading||this._lineupLoaded)return;
  this._lineupLoading=true;
  try{
   const response=await fetch("/totalplay_stb/lineup.txt",{cache:"no-store"});
   if(!response.ok)throw Error(`Lineup HTTP ${response.status}`);
   const text=await response.text(),channels=[],apps=[];
   for(const line of text.split(/\r?\n/)){
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
 async _loadGuide(){
  if(!this._hass||!this._config?.epg||this._loadingGuide)return;
  if(this._guideFetched&&Date.now()-this._guideFetched<5*60*1000)return;
  this._loadingGuide=true;
  try{
   const guide=await this._hass.callApi("GET","totalplay_stb/epg");
   if(!Array.isArray(guide?.channels))throw Error("Invalid guide response");
   this._guide=guide;
  }catch(error){
   this._guide={channels:[],error:"Cannot load XMLTV from Home Assistant"};
   console.warn("Totalplay EPG unavailable:",error);
  }finally{this._guideFetched=Date.now();this._loadingGuide=false;this._render();}
 }
 async _send(domain,service,data,message){if(!this._hass||this._busy)return;this._busy=true;this._feedback.className="status";this._feedback.textContent=message;try{await this._hass.callService(domain,service,data);this._feedback.textContent="Command sent";}catch(error){this._feedback.className="status error";this._feedback.textContent=error?.message||"Command failed";}finally{this._busy=false;}}
 _command(command){const remote=this._remoteEntity();if(!remote){this._feedback.textContent="Select a Totalplay remote entity in the card editor";return;}return this._send("remote","send_command",{entity_id:remote,command},`Sending ${command}…`);}
 _play(type,id){if(!tpValid(id)||!this._hass?.states?.[this._config.entity]){this._feedback.textContent="Select an available Totalplay decoder";return;}return this._send("media_player","play_media",{entity_id:this._config.entity,media_content_type:type,media_content_id:id},type==="app"?`Launching app on channel ${id}…`:`Selecting channel ${id}…`);}
}

/* The card picker calls getConfigElement(); editor emits config-changed on every edit. */
class TotalplayStbCardEditor extends HTMLElement{
 setConfig(config){this._config={...TP_DEFAULT,...config,channels:[...(config.channels||[])],apps:[...(config.apps||TP_DEFAULT.apps)]};if(!this.shadowRoot)this.attachShadow({mode:"open"});this._draw();}
 set hass(hass){this._hass=hass;this._draw();this._loadGuideOptions();}
 async _loadGuideOptions(){
  if(!this._hass||!this._config?.epg||this._guideOptionsLoaded||this._guideOptionsLoading)return;
  this._guideOptionsLoading=true;
  try{
   const guide=await this._hass.callApi("GET","totalplay_stb/epg");
   if(Array.isArray(guide?.channels)&&!guide.error){
    this._guideOptions=guide.channels.filter(g=>g.id&&g.name)
      .sort((a,b)=>a.name.localeCompare(b.name));
   }
  }catch(error){console.warn("Totalplay editor EPG options unavailable:",error);}
  finally{this._guideOptionsLoading=false;this._guideOptionsLoaded=true;this._draw();}
 }
 _change(patch){this._config={...this._config,...patch};this.dispatchEvent(new CustomEvent("config-changed",{detail:{config:this._config},bubbles:true,composed:true}));}
 _field(container,label,value,onchange,type="text"){const wrap=tpEl("label","field");wrap.appendChild(tpEl("span","",label));const input=tpEl("input");input.type=type;input.value=value??"";input.addEventListener("change",()=>onchange(input.value));wrap.appendChild(input);container.appendChild(wrap);return input;}
 _select(container,label,options,value,onchange){const wrap=tpEl("label","field");wrap.appendChild(tpEl("span","",label));const select=tpEl("select");for(const [id,name] of options){const option=tpEl("option","",name);option.value=id;select.appendChild(option);}select.value=value||"";select.addEventListener("change",()=>onchange(select.value));wrap.appendChild(select);container.appendChild(wrap);return select;}
 _draw(){if(!this.shadowRoot||!this._config)return;const root=this.shadowRoot;root.replaceChildren();const style=tpEl("style","",`:host{display:block}.field{display:flex;flex-direction:column;gap:5px;margin:10px 0}.field>span{font-size:13px;color:var(--secondary-text-color)}input,select{box-sizing:border-box;width:100%;border:1px solid var(--divider-color);border-radius:8px;background:var(--card-background-color);color:var(--primary-text-color);padding:10px;font:inherit}.editor-row{border:1px solid var(--divider-color);padding:10px;border-radius:10px;margin:8px 0}button{padding:8px;margin:4px;border-radius:8px;border:1px solid var(--divider-color);background:var(--card-background-color);color:var(--primary-text-color)}h4{margin:18px 0 8px}`);root.appendChild(style);
 const players=tpPlayers(this._hass),options=[["","Select a Totalplay decoder"],...players.map(([id,state])=>[id,`${state.attributes.friendly_name||id} (${id})`])];if(this._config.entity&&!options.some(([id])=>id===this._config.entity))options.push([this._config.entity,this._config.entity]);
 this._select(root,"Totalplay decoder",options,this._config.entity,entity=>this._change({entity}));const remoteList=Object.entries(this._hass?.states||{}).filter(([id])=>id.startsWith("remote."));this._select(root,"Totalplay remote",[["","Try matching decoder remote automatically"],...remoteList.map(([id,state])=>[id,`${state.attributes.friendly_name||id} (${id})`])],this._config.remote,remote=>this._change({remote}));
 this._field(root,"Card title",this._config.title,title=>this._change({title}));
 const lineupRow=tpEl("label","field"),lineupToggle=tpEl("input");lineupToggle.type="checkbox";lineupToggle.style.width="auto";lineupToggle.checked=!!this._config.lineup;lineupToggle.onchange=()=>this._change({lineup:lineupToggle.checked});lineupRow.appendChild(lineupToggle);lineupRow.appendChild(tpEl("span","","Show bundled community channel and app reference lineup"));root.appendChild(lineupRow);
 const epgRow=tpEl("label","field");const checkbox=tpEl("input");checkbox.type="checkbox";checkbox.style.width="auto";checkbox.checked=!!this._config.epg;checkbox.onchange=()=>this._change({epg:checkbox.checked});epgRow.appendChild(checkbox);epgRow.appendChild(tpEl("span","","Show XMLTV Now / Next when available"));root.appendChild(epgRow);
 const editRows=(kind)=>{root.appendChild(tpEl("h4","",kind==="channels"?"TV channels and EPG mapping":"App launch channels"));for(const [index,item] of this._config[kind].entries()){const row=tpEl("div","editor-row");this._field(row,"Channel number",item.number,val=>this._replace(kind,index,{number:val}));this._field(row,"Name",item.name,val=>this._replace(kind,index,{name:val}));if(kind==="channels"){if(this._guideOptions?.length){
   const options=[["","Match station name automatically"],...this._guideOptions.map(g=>[g.id,`${g.name} (${g.id})`])];
   if(item.epg_id&&!options.some(([id])=>id===item.epg_id))options.push([item.epg_id,item.epg_id]);
   this._select(row,"EPG station for this channel (optional)",options,item.epg_id,val=>this._replace(kind,index,{epg_id:val}));
  }else{
   this._field(row,"EPG channel ID (optional; name matching is automatic)",item.epg_id,val=>this._replace(kind,index,{epg_id:val}));
  }this._field(row,"Home Assistant program sensor (optional)",item.program_entity,val=>this._replace(kind,index,{program_entity:val}));}const remove=tpEl("button","","Remove");remove.type="button";remove.onclick=()=>{const list=[...this._config[kind]];list.splice(index,1);this._change({[kind]:list});this._draw();};row.appendChild(remove);root.appendChild(row);}const add=tpEl("button","",`Add ${kind==="channels"?"channel":"app"}`);add.type="button";add.onclick=()=>{this._change({[kind]:[...this._config[kind],{name:"",number:""}]});this._draw();};root.appendChild(add);};editRows("channels");editRows("apps");root.appendChild(tpEl("p","field","Guide names and IDs belong to the XMLTV provider, not the decoder. Only assign Totalplay channel numbers verified for your region and package."));}
 _replace(kind,index,patch){const list=this._config[kind].map((item,i)=>i===index?{...item,...patch}:item);this._change({[kind]:list});}
}
if(!customElements.get("totalplay-stb-card"))customElements.define("totalplay-stb-card",TotalplayStbCard);
if(!customElements.get("totalplay-stb-card-editor"))customElements.define("totalplay-stb-card-editor",TotalplayStbCardEditor);
window.customCards=window.customCards||[];
if(!window.customCards.some(card=>card.type==="totalplay-stb-card"))window.customCards.push({type:"totalplay-stb-card",name:"Totalplay Channels, Apps & Remote",description:"Choose a Totalplay decoder with visual configuration; channels, apps, XMLTV Now/Next and on-card remote",preview:true});
