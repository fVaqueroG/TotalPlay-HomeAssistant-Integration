/* Totalplay STB card: channel tiles, apps and built-in remote; no external assets. */
const STYLE = `
:host{display:block}ha-card{padding:16px}.header{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap}.heading{font-size:19px;font-weight:600}.source,.note,.program,.feedback{font-size:12px;color:var(--secondary-text-color)}.section-title{font-size:14px;font-weight:600;margin:16px 0 8px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(125px,1fr));gap:8px}.tile,.key,.tab,.toggle{font:inherit;appearance:none;color:var(--primary-text-color);background:var(--card-background-color);border:1px solid var(--divider-color);border-radius:12px;padding:10px;cursor:pointer}.tile{display:flex;flex-direction:column;gap:5px;align-items:flex-start;text-align:left;min-height:85px}.tile .number{font-size:22px;font-weight:700;color:var(--primary-color)}.tile .name{font-size:14px;font-weight:600;overflow-wrap:anywhere}.tile.app{min-height:70px}.key:focus-visible,.tile:focus-visible,.toggle:focus-visible,.tab:focus-visible{outline:2px solid var(--primary-color);outline-offset:2px}.key:disabled,.tile:disabled{opacity:.45;cursor:not-allowed}.remote-panel{border:1px solid var(--divider-color);border-radius:16px;margin:12px 0;padding:12px}.tabs,.remote-row,.pad{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px;margin-top:8px}.tab{font-size:13px}.tab[aria-selected=true],.primary{background:var(--primary-color);color:var(--text-primary-color,white)}.key{min-height:51px;text-align:center;display:flex;align-items:center;justify-content:center;gap:4px}.key.digit{min-height:66px;font-size:24px}.key.small{font-size:13px}.spacer{min-height:51px}.feedback{min-height:15px;margin-top:10px}.feedback.error{color:var(--error-color)}
`;
class TotalplayStbCard extends HTMLElement {
  setConfig(config){
    if(!config||typeof config.entity!=="string"||!config.entity.startsWith("media_player."))throw new Error("Set entity: media_player.your_totalplay_stb");
    if(config.remote!==undefined&&(!config.remote.startsWith||!config.remote.startsWith("remote.")))throw new Error("remote must be a remote.* entity ID");
    this._config={title:"Totalplay TV",channels:[],apps:[{id:"netflix",name:"Netflix",number:"333"}],previous_channel_command:"KEY_TV_SWAP",...config};
    if(!Array.isArray(this._config.channels)||!Array.isArray(this._config.apps))throw new Error("channels and apps must be lists");
    this._remoteOpen=false;this._remoteTab="navigate";
    if(!this.shadowRoot)this.attachShadow({mode:"open"});this._build();
  }
  set hass(hass){this._hass=hass;this._render();}
  getCardSize(){return 6;}
  _el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
  _button(label,command,cls="key"){
    const b=this._el("button",cls,label);b.type="button";b.setAttribute("aria-label",label);
    if(command)b.addEventListener("click",()=>this._command(command));return b;
  }
  _row(items){const r=this._el("div","remote-row");for(const [label,command] of items)r.appendChild(command?this._button(label,command):this._el("div","spacer"));return r;}
  _build(){
    const root=this.shadowRoot;root.replaceChildren(this._el("style","",STYLE));const card=this._el("ha-card");
    const header=this._el("div","header");header.appendChild(this._el("div","heading",this._config.title));
    this._sourceEl=this._el("div","source");header.appendChild(this._sourceEl);
    const toggle=this._button("Remote ▾",null,"toggle");toggle.addEventListener("click",()=>{this._remoteOpen=!this._remoteOpen;toggle.textContent=this._remoteOpen?"Remote ▴":"Remote ▾";this._remotePanel.hidden=!this._remoteOpen;});header.appendChild(toggle);card.appendChild(header);
    this._remotePanel=this._el("div","remote-panel");this._remotePanel.hidden=true;card.appendChild(this._remotePanel);this._buildRemote();
    card.appendChild(this._el("div","section-title","Channels"));const channels=this._el("div","grid");this._programEls=[];
    for(const ch of this._config.channels){const number=String(ch.number??"").trim();if(!/^[0-9]{1,4}$/.test(number)||!Number(number))continue;
      const tile=this._el("button","tile");tile.type="button";tile.appendChild(this._el("div","number",number));tile.appendChild(this._el("div","name",String(ch.name||`Channel ${number}`)));
      const program=this._el("div","program","Program information unavailable");tile.appendChild(program);this._programEls.push({ch,program});
      tile.addEventListener("click",()=>this._play("channel",number));channels.appendChild(tile);
    }
    if(!channels.childElementCount)channels.appendChild(this._el("div","note","Add channels in the card configuration."));card.appendChild(channels);
    card.appendChild(this._el("div","section-title","Apps"));const apps=this._el("div","grid");
    for(const app of this._config.apps){const name=String(app.name||app.id||"App");const number=String(app.number??(String(app.id).toLowerCase()==="netflix"?"333":"")).trim();
      const tile=this._el("button","tile app");tile.type="button";tile.appendChild(this._el("div","name",name));
      if(/^[0-9]{1,4}$/.test(number)&&Number(number)){tile.appendChild(this._el("div","note",`Channel ${number}`));tile.addEventListener("click",()=>this._play("app",number));}
      else{tile.disabled=true;tile.appendChild(this._el("div","note","Configure app channel number"));}apps.appendChild(tile);
    }
    if(!apps.childElementCount)apps.appendChild(this._el("div","note","No apps configured."));card.appendChild(apps);
    this._feedback=this._el("div","feedback");this._feedback.setAttribute("role","status");card.appendChild(this._feedback);root.appendChild(card);this._render();
  }
  _buildRemote(){
    const p=this._remotePanel;p.replaceChildren();const tabs=this._el("div","tabs");
    for(const [id,label] of [["navigate","Navigation"],["media","Playback"],["numbers","Keypad"]]){
      const tab=this._button(label,null,"tab");tab.setAttribute("aria-selected",String(this._remoteTab===id));tab.addEventListener("click",()=>{this._remoteTab=id;this._buildRemote();});tabs.appendChild(tab);
    }p.appendChild(tabs);
    if(this._remoteTab==="navigate"){
      p.appendChild(this._row([["Menu","KEY_MENU"],["Guide","KEY_GUIDE"],["Power","on_off"]]));
      p.appendChild(this._row([["",null],["▲","up"],["",null]]));p.appendChild(this._row([["◀","left"],["OK","ok"],["▶","right"]]));
      p.appendChild(this._row([["",null],["▼","down"],["",null]]));p.appendChild(this._row([["Back","back"],["Mute","mute"],["Info","KEY_TV_AUDIO"]]));
      p.appendChild(this._row([["Vol −","volume_down"],["Play / Pause","play_pause"],["Vol +","volume_up"]]));
      p.appendChild(this._row([["CH −","channel_down"],["Previous",this._config.previous_channel_command],["CH +","channel_up"]]));
    }else if(this._remoteTab==="media"){
      p.appendChild(this._row([["Vol −","volume_down"],["Mute","mute"],["Vol +","volume_up"]]));
      p.appendChild(this._row([["Rewind","prev"],["Play / Pause","play_pause"],["Forward","next"]]));
      p.appendChild(this._row([["Previous","prev_track"],["Stop","stop"],["Next","next_track"]]));
      p.appendChild(this._row([["Audio","audio"],["Back","back"],["CH +","channel_up"]]));
    }else{
      const keys=this._el("div","pad");for(const d of ["1","2","3","4","5","6","7","8","9"]){keys.appendChild(this._button(d,d,"key digit"));}
      keys.appendChild(this._button("Previous",this._config.previous_channel_command,"key small"));keys.appendChild(this._button("0","0","key digit"));keys.appendChild(this._button("Delete","delete","key small"));p.appendChild(keys);
    }
    const remote=this._remoteEntity();if(!remote)p.appendChild(this._el("div","note","Set remote: remote.your_totalplay_remote in the card configuration."));
  }
  _remoteEntity(){
    if(this._config.remote)return this._config.remote;
    const player=this._hass?.states?.[this._config.entity];const host=player?.attributes?.connected_tv_entity;
    void host;const ids=Object.keys(this._hass?.states||{}).filter(id=>id.startsWith("remote."));
    const playerName=this._config.entity.slice("media_player.".length).replace(/_media_player$/,"");
    return ids.find(id=>id===`remote.${playerName}_remote`)||null;
  }
  _render(){
    if(!this._hass||!this._config||!this._sourceEl)return;const decoder=this._hass.states[this._config.entity];
    if(!decoder)this._sourceEl.textContent="Decoder entity unavailable";
    else{const tvId=decoder.attributes.connected_tv_entity,wanted=decoder.attributes.connected_tv_source,tv=tvId?this._hass.states[tvId]:null,actual=tv?.attributes?.source;
      this._sourceEl.textContent=!tvId||!wanted?"No TV/input linked":!actual||actual==="unknown"||actual==="unavailable"?`TV input not reported · target ${wanted}`:actual.trim().toLowerCase()===wanted.trim().toLowerCase()?`TV input: ${actual} ✓`:`TV input: ${actual} · target ${wanted}`;
    }
    for(const {ch,program} of this._programEls||[]){const state=ch.program_entity?this._hass.states[ch.program_entity]:null,attrs=state?.attributes||{};
      const candidate=attrs.current_program||attrs.program_title||attrs.program||attrs.title||state?.state,title=typeof candidate==="string"?candidate.trim():"";
      program.textContent=title&&!['unknown','unavailable','none'].includes(title.toLowerCase())?`Now: ${title}`:"Program information unavailable";
      if(state&&title&&attrs.next_program)program.title=`Next: ${String(attrs.next_program)}`;
    }
  }
  async _send(domain,service,data,message){if(!this._hass||this._busy)return;this._busy=true;this._feedback.className="feedback";this._feedback.textContent=message;
    try{await this._hass.callService(domain,service,data);this._feedback.textContent="Command sent";}
    catch(e){this._feedback.className="feedback error";this._feedback.textContent=`Totalplay: ${e?.message||"Command failed"}`;}
    finally{this._busy=false;}
  }
  _command(command){const remote=this._remoteEntity();if(!remote){this._feedback.className="feedback error";this._feedback.textContent="Configure the Totalplay remote entity in this card";return;}
    return this._send("remote","send_command",{entity_id:remote,command},`Sending ${command}…`);
  }
  _play(type,id){return this._send("media_player","play_media",{entity_id:this._config.entity,media_content_type:type,media_content_id:id},type==="app"?`Launching app on channel ${id}…`:`Selecting channel ${id}…`);}
}
if(!customElements.get("totalplay-stb-card"))customElements.define("totalplay-stb-card",TotalplayStbCard);
window.customCards=window.customCards||[];
if(!window.customCards.some(card=>card.type==="totalplay-stb-card"))window.customCards.push({type:"totalplay-stb-card",name:"Totalplay Channels, Apps & Remote",description:"TV channels, app-launch channels, program sensors and on-card remote control"});
