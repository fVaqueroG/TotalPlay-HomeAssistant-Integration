/* Verify the linked switch is optional and never toggles without a click. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '../custom_components/totalplay_stb/www');
const entry = fs.readFileSync(path.join(root, 'totalplay-stb-v0311.js'), 'utf8');
const init = fs.readFileSync(path.join(root, '../__init__.py'), 'utf8');
assert.match(entry, /totalplay-stb-v0310\.js\?v=0\.3\.11/);
assert.match(init, /_CARD_URL, str\(www \/ "totalplay-stb-v0317\.js"\)/);
assert.match(init, /"\/totalplay_stb\/totalplay-stb-v0316\.js"/);
assert.match(init, /"\/totalplay_stb\/totalplay-stb-v0315\.js"/);
assert.match(init, /"\/totalplay_stb\/totalplay-stb-v0311\.js"/);
assert.match(init, /"\/totalplay_stb\/totalplay-stb-v0310\.js"/);

class Node {
  constructor(tag = 'div') {
    this.tagName = tag.toUpperCase(); this.children = []; this.hidden = false;
    this.listeners = {}; this.attrs = {}; this.textContent = ''; this.className = '';
    this.classList = {toggle:(name,on)=>{this.attrs[name]=on;},add:(name)=>{this.attrs[name]=true;}};
  }
  appendChild(child) {this.children.push(child); child.parentElement=this; return child;}
  insertBefore(child,before) {const i=this.children.indexOf(before);if(i<0)return this.appendChild(child);this.children.splice(i,0,child);child.parentElement=this;return child;}
  addEventListener(type, fn) {this.listeners[type]=fn;}
  setAttribute(key,value) {this.attrs[key]=value;}
  replaceChildren(...children) {this.textContent=children.filter(x=>typeof x==='string').join('');}
}
class Card {
  constructor() {this.root=new Node();this.header=new Node();this.meta=new Node();this.badge=new Node();this._tv=new Node();this.meta.appendChild(this._tv);
    this.shadowRoot={querySelector:selector=>({'.header':this.header,'.tp-version-badge':this.badge}[selector]||null),appendChild:el=>this.root.appendChild(el)};
  }
  setConfig(config) {this._config=config;}
  set hass(value) {this._hass=value; this.baseSetCalls=(this.baseSetCalls||0)+1;}
}
const sandbox={customElements:{get:()=>Card},document:{createElement:tag=>new Node(tag)}};
vm.createContext(sandbox);
vm.runInContext(entry.replace(/^import .*;\s*/m,''),sandbox);
const makeHass = state => ({states:{'media_player.totalplay':{attributes:{connected_power_switch_entity:'switch.decoder_plug',tv_input_check:'verified'}},
  'switch.decoder_plug':{state}},calls:[],async callService(domain, action, data){this.calls.push({domain,action,data});}});
(async()=>{
  const card=new Card(); card.hass=makeHass('off'); card.setConfig({entity:'media_player.totalplay'});
  assert.equal(card.badge.textContent,'Card v0.3.11');
  assert.equal(card._tpPowerButton.hidden,false);
  assert.equal(card._tpPowerButton.disabled,false);
  assert.equal(card._tpPowerButton.attrs['aria-pressed'],'false');
  assert.equal(card._tpInputWarning.hidden,true);
  assert.equal(card._hass.calls.length,0,'Configuration never toggles a plug');
  await card._togglePowerHelper();
  assert.equal(card._hass.calls.length,1);
  assert.equal(card._hass.calls[0].domain,'switch');
  assert.equal(card._hass.calls[0].action,'turn_on');
  assert.equal(card._hass.calls[0].data.entity_id,'switch.decoder_plug');
  card.hass=makeHass('on');
  assert.equal(card.baseSetCalls,2,'Existing Home Assistant state setter is preserved');
  assert.equal(card._tpPowerButton.attrs['aria-pressed'],'true');
  await card._togglePowerHelper(); assert.equal(card._hass.calls[0].action,'turn_off');
  card.hass=makeHass('unavailable');
  assert.equal(card._tpPowerButton.disabled,true);
  await card._togglePowerHelper();assert.equal(card._hass.calls.length,0);
  const wrong=makeHass('off');wrong.states['media_player.totalplay'].attributes.tv_input_check='switch_unsupported';
  card.hass=wrong;assert.equal(card._tpInputWarning.hidden,false);
  assert.match(card._tpInputWarning.textContent,/cannot switch/);
  const optional=new Card();optional.hass={states:{'media_player.totalplay':{attributes:{}}}};
  optional.setConfig({entity:'media_player.totalplay'});
  assert.equal(optional._tpPowerButton.hidden,true,'No switch means no decorative power control');
  console.log('PASS: optional switch, explicit on/off, availability, HDMI warning, card version and HA setter');
})().catch(error=>{console.error(error);process.exitCode=1;});
