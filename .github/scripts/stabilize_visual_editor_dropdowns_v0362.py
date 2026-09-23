import json
from pathlib import Path

root=Path('custom_components/totalplay_stb')
main=root/'www/totalplay-stb-card.js'
popup=root/'www/totalplay-stb-popup-options.js'
s=main.read_text()
p=popup.read_text()

def once(source,old,new,label):
    assert source.count(old)==1,(label,source.count(old))
    return source.replace(old,new,1)

s=once(s,''' setConfig(config){this._config={...TP_DEFAULT,...config,channels:[...(config.channels||[])],apps:[...(config.apps||TP_DEFAULT.apps)]};if(!this.shadowRoot)this.attachShadow({mode:'open'});this._draw();}
 set hass(hass){this._hass=hass;this._draw();this._loadGuideOptions();}''',''' setConfig(config){
   const next={...TP_DEFAULT,...config,channels:[...(config.channels||[])],apps:[...(config.apps||TP_DEFAULT.apps)]};
   const changed=JSON.stringify(this._config)!==JSON.stringify(next);
   this._config=next;
   if(!this.shadowRoot)this.attachShadow({mode:'open'});
   // Native dropdowns close if Home Assistant recreates their DOM nodes.
   if(!this._editorDrawn||(changed&&!this.matches(':focus-within')))this._draw();
 }
 set hass(hass){
   const first=!this._hass;
   this._hass=hass;
   // Refresh decoder choices once when HA becomes available, not each tick.
   if(first||!this._editorDrawn)this._draw();
   this._loadGuideOptions();
 }''','main editor setters')
s=once(s,''' _draw(){if(!this.shadowRoot||!this._config)return;const root=this.shadowRoot;root.replaceChildren(''',''' _draw(){if(!this.shadowRoot||!this._config)return;
   if(this._editorDrawn&&this.matches(':focus-within'))return;
   this._editorDrawn=true;
   const root=this.shadowRoot;root.replaceChildren(''','main editor draw guard')
s=once(s,'''this._guideOptionsLoading=false;this._draw();}}
}''','''this._guideOptionsLoading=false;
   // Loading EPG options must not collapse the user's current dropdown.
   if(!this.matches(':focus-within'))this._draw();}}
}''','async guide load')
p=once(p,'''  setConfig(config) {
    this._config = {...config};
    this._draw();
  }''','''  setConfig(config) {
    const next={...config};
    const changed=JSON.stringify(this._config)!==JSON.stringify(next);
    this._config=next;
    if(!this._drawn||(changed&&!this.matches(':focus-within')))this._draw();
  }''','popup editor setter')
p=once(p,'''  _draw() {
    const root = this.shadowRoot;
    root.replaceChildren();''','''  _draw() {
    if(this._drawn&&this.matches(':focus-within'))return;
    this._drawn=true;
    const root = this.shadowRoot;
    root.replaceChildren();''','popup editor draw guard')
manifest=root/'manifest.json'
meta=json.loads(manifest.read_text())
assert meta['version']=='0.3.61',meta['version']
meta['version']='0.3.62'
main.write_text(s)
popup.write_text(p)
manifest.write_text(json.dumps(meta,indent=2)+'\n')
print('PASS: Totalplay main and popup visual editor selects retain their DOM nodes')
