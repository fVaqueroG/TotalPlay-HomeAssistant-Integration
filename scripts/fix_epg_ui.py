"""One-time guarded source patch; the associated GitHub workflow removes this file."""
from pathlib import Path

path=Path('custom_components/totalplay_stb/www/totalplay-stb-card.js')
s=path.read_text(encoding='utf-8')

def replace(old,new):
    global s
    count=s.count(old)
    if count!=1:
        raise AssertionError(f'Expected exactly one patch location; got {count}: {old[:130]}')
    s=s.replace(old,new,1)

replace(
 'function tpGuideMatch(guide,ch){const list=guide?.channels||[];if(ch.epg_id)return list.find(g=>g.id===ch.epg_id)||null;const possible=list.filter(g=>tpNorm(g.name)===tpNorm(ch.name));return possible.length===1?possible[0]:null;}',
 '''function tpGuideMatch(guide,ch){
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
}''')

replace('card.appendChild(tpEl("div","heading","Channels"));',
 '''card.appendChild(tpEl("div","heading","Channels"));
 this._guideStatus=tpEl("div","small",this._config.epg?"TV guide: loading…":"TV guide disabled");
 this._guideStatus.setAttribute("role","status");card.appendChild(this._guideStatus);''')

replace(' const now=Date.now();for(const {ch,program} of this._programs||[]){',
 ''' const now=Date.now();
 if(this._guideStatus){
  const guide=this._guide,visible=this._programs||[];
  const matches=visible.map(({ch})=>tpGuideMatch(guide,ch)).filter(Boolean);
  const onAir=matches.filter(g=>g.schedule?.some(p=>Date.parse(p.start)<=now&&now<Date.parse(p.stop))).length;
  this._guideStatus.textContent=!this._config.epg?"TV guide disabled":
   !guide?"TV guide: loading…":
   guide.error?`TV guide unavailable (${guide.error}); channel control still works`:
   `TV guide: ${onAir} on-air / ${matches.length} matched channels shown (${guide.channels?.length||0} stations in guide). Unmatched channels can be mapped in the visual editor.`;
 }
 for(const {ch,program} of this._programs||[]){''')

replace('if(current){title=current.title;next=following?.title||"";}',
        'if(current){title=current.title;next=following?.title||"";}else if(following){next=following.title;}')
replace('program.textContent=title?`Now: ${title}${next?` · Next: ${next}`:""}`:"Programme information unavailable";',
        'program.textContent=title?`Now: ${title}${next?` · Next: ${next}`:""}`:next?`Next: ${next}`:"Programme information unavailable";')

old=''' async _loadGuide(){if(!this._hass||!this._config?.epg||this._loadingGuide)return;if(this._guide&&Date.now()-this._guideFetched<5*60*1000)return;this._loadingGuide=true;try{const guide=await this._hass.callApi("GET","totalplay_stb/epg");if(guide?.channels&&Array.isArray(guide.channels)){this._guide=guide;this._guideFetched=Date.now();this._render();}}catch(error){this._guideFetched=Date.now();console.warn("Totalplay EPG unavailable:",error);}finally{this._loadingGuide=false;}}'''
new=''' async _loadGuide(){
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
 }'''
replace(old,new)

replace(' set hass(hass){this._hass=hass;this._draw();}',
 ''' set hass(hass){this._hass=hass;this._draw();this._loadGuideOptions();}
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
 }''')

replace('this._field(row,"EPG channel ID (optional; name matching is automatic)",item.epg_id,val=>this._replace(kind,index,{epg_id:val}));',
 '''if(this._guideOptions?.length){
   const options=[["","Match station name automatically"],...this._guideOptions.map(g=>[g.id,`${g.name} (${g.id})`])];
   if(item.epg_id&&!options.some(([id])=>id===item.epg_id))options.push([item.epg_id,item.epg_id]);
   this._select(row,"EPG station for this channel (optional)",options,item.epg_id,val=>this._replace(kind,index,{epg_id:val}));
  }else{
   this._field(row,"EPG channel ID (optional; name matching is automatic)",item.epg_id,val=>this._replace(kind,index,{epg_id:val}));
  }''')

path.write_text(s,encoding='utf-8')
print('Patched guide matching, status, upcoming programmes and visual EPG station selector')
