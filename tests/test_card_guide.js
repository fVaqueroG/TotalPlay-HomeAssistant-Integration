/* Run with: node tests/test_card_guide.js. No Home Assistant instance required. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
class Element {
  constructor(tag='div') {this.tagName=tag;this.children=[];this.attributes={};this.style={};this.value='';this.textContent='';this.hidden=false;this.listeners={};this.scrollLeft=0;this.scrollTop=0;this.classList={toggle:()=>{},add:()=>{},remove:()=>{}};}
  attachShadow(){this.shadowRoot=new Element('shadow');return this.shadowRoot;}
  appendChild(child){this.children.push(child);return child;}
  append(...children){children.forEach(child=>this.appendChild(child));}
  replaceChildren(...children){this.children=[...children];}
  setAttribute(key,value){this.attributes[key]=value;}
  addEventListener(key,callback){this.listeners[key]=callback;}
  get childElementCount(){return this.children.length;}
}
const elements = new Map();
const context={HTMLElement:Element,document:{createElement:tag=>new Element(tag)},customElements:{get:name=>elements.get(name),define:(name,type)=>elements.set(name,type)},window:{customCards:[]},console,Date,Intl,Map,Set,Number,String,Object,Array,Error,RegExp,Promise,fetch:async()=>({ok:true,text:async()=> 'C|101|Azteca Uno|National\nA|333|Netflix|Apps'})};
vm.createContext(context);
const source=fs.readFileSync(path.join(__dirname,'../custom_components/totalplay_stb/www/totalplay-stb-card.js'),'utf8');
vm.runInContext(source,context);
assert.ok(elements.get('totalplay-stb-card'));
assert.ok(elements.get('totalplay-stb-card-editor'));
assert.equal(context.window.customCards.filter(c=>c.type==='totalplay-stb-card').length,1);
const Card=elements.get('totalplay-stb-card');
const card=new Card('card');
card.setConfig({entity:'media_player.totalplay',remote:'remote.totalplay',lineup:false,channels:[{number:'101',name:'Azteca Uno'}],apps:[{name:'Netflix',number:'333'}]});
const current=Date.now(),from=new Date(current-600000).toISOString(),to=new Date(current+1800000).toISOString();
const nextFrom=new Date(current+1800000).toISOString(),nextTo=new Date(current+5400000).toISOString();
card._hass={states:{'media_player.totalplay':{attributes:{connected_tv_entity:null}}},callApi:async()=>({channels:[]}),callService:async()=>{}};
card._guide={channels:[{id:'AztecaUno.mx',name:'Azteca Uno HD',schedule:[{title:'Currently showing',start:from,stop:to},{title:'Coming up',start:nextFrom,stop:nextTo}]}],error:null};
card._renderGuide();
assert.equal(card._rows.children.length,1);
const row=card._rows.children[0];
assert.equal(row.children[1].children.filter(x=>x.className?.includes('program-block')).length>=1,true,'Programme blocks should be visible for matched stations');
assert.match(card._guideStatus.textContent,/1\/1 Totalplay channels matched/);
card._remoteOpen=true;card._drawRemote();
assert.ok(card._remote.children.length>=3,'Remote should show navigation and buttons');
card._guide={channels:[],error:'Guide temporarily unavailable'};
card._renderGuide();
assert.match(card._guideStatus.textContent,/Guide unavailable/);
assert.ok(row.children[0].attributes['aria-label'].includes('101'));
console.log('PASS: card picker, visual editor, EPG timeline, guide error state, and remote rendering');
