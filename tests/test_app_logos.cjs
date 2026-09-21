/* Simulate TMDB logos without a real key, network, or Home Assistant. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '../custom_components/totalplay_stb/www');
const loader = fs.readFileSync(path.join(root, 'totalplay-stb-v038.js'), 'utf8');
const layout = fs.readFileSync(path.join(root, 'totalplay-guide-layout-v036.js'), 'utf8');
const code = fs.readFileSync(path.join(root, 'totalplay-app-logos.js'), 'utf8');
assert.match(loader, /totalplay-guide-layout-v036\.js\?v=0\.3\.8/);
assert.match(loader, /totalplay-app-logos\.js\?v=0\.3\.8/);
assert.match(layout, /totalplay-pages-remote\.js\?v=0\.3\.7/);
assert.match(code, /totalplay-pages-remote\.js\?v=0\.3\.7/);

class Element {
  constructor(tag='div') {this.tagName=tag.toUpperCase();this.children=[];this.className='';this.id='';this.style={};this.textContent='';this.hidden=false;this.listeners=new Map();this.attrs={};}
  appendChild(child) {this.children.push(child);child.parentElement=this;return child;}
  append(...children) {for (const child of children) this.appendChild(child);}
  replaceChildren(...children) {this.children=[];this.textContent=children.filter(child=>typeof child==='string').join('');for (const child of children) if(typeof child!=='string')this.appendChild(child);}
  insertBefore(child,before) {const i=this.children.indexOf(before);if(i<0)this.appendChild(child);else {this.children.splice(i,0,child);child.parentElement=this;}}
  remove() {const p=this.parentElement;if(p)p.children.splice(p.children.indexOf(this),1);this.removed=true;}
  setAttribute(name,value) {this.attrs[name]=value;}
  addEventListener(name,fn) {this.listeners.set(name,fn);}
  fire(name) {this.listeners.get(name)?.();}
  querySelector(selector) {const test=el=>selector[0]==='.' ? el.className?.split(' ').includes(selector.slice(1)) : selector[0]==='#' ? el.id===selector.slice(1) : false;for (const el of this.children){if(test(el))return el;const found=el.querySelector?.(selector);if(found)return found;}return null;}
}
const sample=[
  {name:'Netflix',number:'333'},
  {name:'Disney+ (alternative)',number:'206'},
  {name:'Prime Video',number:'210'},
  {name:'Max',number:'413'},
  {name:'YouTube',number:'225'},
  {name:'Apple TV+',number:'476'},
  {name:'Totalplay',number:'108'},
];
class Card {
  _appsList(){return sample;}
  _renderApps(){
    this._appsAll.replaceChildren();
    for(const app of this._appsList()){
      const b=new Element('button');b.className='app';b.addEventListener('click',()=>this.played=app.number);
      const text=new Element('span');text.className='app-logo';text.textContent=app.name;
      b.appendChild(text);this._appsAll.appendChild(b);
    }
  }
  setConfig(config){this._config=config;this._tab='guide';this._appsPanel=new Element();this._appsAll=new Element();this._appsPanel.appendChild(this._appsAll);this.shadowRoot=new Element();const badge=new Element('span');badge.className='tp-version-badge';this.shadowRoot.appendChild(badge);this._renderApps();}
  _switch(tab){this._tab=tab;}
}
class Editor {
  _draw(){this.shadowRoot=new Element();}
  _change(patch){this.saved={...this._config,...patch};}
}
let requests=[];
const fetch=async url=>{
  requests.push(url);
  return {ok:true,json:async()=>({results:[
    {provider_id:8,provider_name:'Netflix',logo_path:'/netflix.png'},
    {provider_id:337,provider_name:'Disney Plus',logo_path:'/disney.png'},
    {provider_id:119,provider_name:'Amazon Prime Video',logo_path:'/prime.png'},
    {provider_id:1899,provider_name:'Max',logo_path:'/max.png'},
    {provider_id:9999,provider_name:'Max Amazon Channel',logo_path:'/wrong.png'},
    {provider_id:2,provider_name:'Apple TV Store',logo_path:'/store.png'},
    {provider_id:350,provider_name:'Apple TV+',logo_path:'/apple.jpg'},
    {provider_id:9998,provider_name:'YouTube Premium',logo_path:'/youtube.png'},
    {provider_id:9997,provider_name:'YouTube TV',logo_path:'/youtube-tv.png'},
  ]})};
};
const sandbox={customElements:{get:name=>name==='totalplay-stb-card'?Card:Editor},document:{createElement:tag=>new Element(tag)},fetch,console};
vm.createContext(sandbox);
vm.runInContext(code.replace(/^import .*;\s*/m,'')+'\n globalThis.matchLogo = tpLogoForApp;',sandbox);
const find=sandbox.matchLogo;
const providers=[
  {provider_id:1,provider_name:'Max',logo_path:'/max.png'},
  {provider_id:2,provider_name:'Max Amazon Channel',logo_path:'/wrong.png'},
  {provider_id:350,provider_name:'Apple TV+',logo_path:'/apple.jpg'},
  {provider_id:9998,provider_name:'YouTube Premium',logo_path:'/youtube.png'},
  {provider_id:9997,provider_name:'YouTube TV',logo_path:'/youtube-tv.png'},
];
assert.equal(find({name:'Max'},providers),'https://image.tmdb.org/t/p/w154/max.png');
assert.equal(find({name:'Apple TV+'},providers),'https://image.tmdb.org/t/p/w154/apple.jpg');
assert.equal(find({name:'Apple TV+ (alternative)'},providers),'https://image.tmdb.org/t/p/w154/apple.jpg');
assert.equal(find({name:'YouTube'},providers),'https://image.tmdb.org/t/p/w154/youtube.png');
assert.equal(find({name:'YouTube'},[{provider_id:192,provider_name:'YouTube',logo_path:'/youtube-generic.png'},...providers]),'https://image.tmdb.org/t/p/w154/youtube-generic.png');
assert.equal(find({name:'Apple TV+'},[{provider_id:2,provider_name:'Apple TV Store',logo_path:'/store.png'}]),null,'Never use Apple TV Store for Apple TV+');
assert.equal(find({name:'YouTube'},[{provider_id:100,provider_name:'YouTube TV',logo_path:'/tv.png'}]),null,'Never use YouTube TV for ordinary YouTube');
assert.equal(find({name:'Netflix'},[{provider_id:8,provider_name:'Netflix',logo_path:'/../../bad.png'}]),null);
assert.equal(find({name:'Unknown',tmdb_provider_id:1},providers),'https://image.tmdb.org/t/p/w154/max.png');
const card=new Card();card.setConfig({title:'Totalplay',tmdb_api_key:'TEST_READ_ONLY_KEY'});
assert.equal(card.shadowRoot.querySelector('.tp-version-badge').textContent,'Card v0.3.8');
assert.equal(card._appsAll.children[0].querySelector('.app-logo').hidden,false,'Text remains until provider logos load');
card._switch('apps');
(async()=>{
  for(let i=0;i<4;i++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(requests.length,2,'Fetch movie and TV providers once');
  assert.ok(requests.every(url=>url.includes('api_key=TEST_READ_ONLY_KEY')));
  assert.equal(card._appsAll.children[0].querySelector('.app-logo-image').src,'https://image.tmdb.org/t/p/w154/netflix.png');
  assert.equal(card._appsAll.children[1].querySelector('.app-logo-image').src,'https://image.tmdb.org/t/p/w154/disney.png');
  assert.equal(card._appsAll.children[2].querySelector('.app-logo-image').src,'https://image.tmdb.org/t/p/w154/prime.png');
  assert.equal(card._appsAll.children[3].querySelector('.app-logo-image').src,'https://image.tmdb.org/t/p/w154/max.png');
  assert.equal(card._appsAll.children[4].querySelector('.app-logo-image').src,'https://image.tmdb.org/t/p/w154/youtube.png');
  assert.equal(card._appsAll.children[5].querySelector('.app-logo-image').src,'https://image.tmdb.org/t/p/w154/apple.jpg');
  assert.equal(card._appsAll.children[6].querySelector('.app-logo-image'),null,'Unknown app retains text');
  card._appsAll.children[4].fire('click');assert.equal(card.played,'225','YouTube app still launches channel 225');
  card._appsAll.children[5].fire('click');assert.equal(card.played,'476','Apple TV+ app still launches channel 476');
  const broken=card._appsAll.children[0].querySelector('.app-logo-image');broken.fire('error');
  assert.equal(card._appsAll.children[0].querySelector('.app-logo').hidden,false,'Broken image restores text');
  card._switch('apps');assert.equal(requests.length,2,'Provider list cached per card');
  const editor=new Editor();editor._config={apps:[]};editor._draw();
  const input=editor.shadowRoot.querySelector('#tp-tmdb-api-key');
  assert.equal(input.type,'password');input.value='TEST_READ_ONLY_KEY';input.fire('change');
  assert.equal(editor.saved.tmdb_api_key,'TEST_READ_ONLY_KEY');
  console.log('PASS: Apple TV+ and YouTube TMDB logos, exact-brand safety, launches, image fallback, caching, editor, version');
})().catch(err=>{console.error(err);process.exitCode=1;});
