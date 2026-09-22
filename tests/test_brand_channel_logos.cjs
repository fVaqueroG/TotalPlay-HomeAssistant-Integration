/* Brand, channel-list and logo regression without Home Assistant or network. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../custom_components/totalplay_stb/www/totalplay-stb-v0319.js'),'utf8');
assert.match(source,/import '\.\/totalplay-stb-v0318\.js\?v=0\.3\.19'/);
assert.match(source,/totalplay\.com\.mx\/assetsv2\/img\/header\/totalplay-logoWhite\.svg/);
assert.match(source,/Channel logo override/);
class Node {
  constructor(tag='div',cls='',text='') {
    this.tagName=tag.toUpperCase();this.className=cls;this.textContent=text;
    this.children=[];this.handlers={};this.style={display:''};this.id='';
  }
  append(...nodes){for(const n of nodes)this.appendChild(n);}
  appendChild(node){if(typeof node==='string'){this.textContent+=node;return node;}node.parentNode=this;this.children.push(node);return node;}
  insertBefore(node,other){node.parentNode=this;const i=this.children.indexOf(other);this.children.splice(i<0?this.children.length:i,0,node);return node;}
  replaceChildren(...nodes){this.children=[];this.textContent='';this.append(...nodes);}
  querySelector(selector){const wanted=selector.slice(1);const hit=this.children.find(n=>selector[0]==='#'?n.id===wanted:selector[0]==='.'?n.className?.split(' ').includes(wanted):n.tagName===selector.toUpperCase());return hit||this.children.map(n=>n.querySelector?.(selector)).find(Boolean)||null;}
  addEventListener(event,handler){this.handlers[event]=handler;}
  remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);}
  setAttribute(name,value){this[name]=value;}
}
class Card {
  _channels(){return this._config.channels||[];}
  _renderGuide(){
    // The actual guide replaces its rows on every render; simulate that here.
    this.renders=(this.renders||0)+1;
    const row=new Node('div','grow');row.append(new Node('span','ch-num','5'),new Node('span','ch-logo','CA'));
    this._rows.children=[row];
  }
  setConfig(config){
    this._config=config;this.shadowRoot=new Node('shadow');
    const brand=new Node('div','brand');brand.appendChild(new Node('div','mark','▶'));
    this.shadowRoot.append(brand,new Node('span','tp-version-badge','old'));
    this._remotePortal={shadowRoot:new Node('shadow')};
    this._rows={children:[]};
  }
}
class Editor {_draw(){this.shadowRoot=new Node('shadow');}}
const sandbox={customElements:{get:name=>name==='totalplay-stb-card'?Card:name==='totalplay-stb-card-editor'?Editor:null},document:{createElement:tag=>new Node(tag)},URL,console};
vm.createContext(sandbox);
vm.runInContext(source.replace(/^import .*;\s*/m,''),sandbox);
const card=new Card();
card._guide={channels:[{id:'canal5.mx',name:'Canal 5',logo:'https://example.org/canal5.png'}]};
card.setConfig({lineup:true,channels:[{number:'5',name:'Canal 5',epg_id:'canal5.mx'}]});
assert.equal(card.shadowRoot.querySelector('.tp-version-badge').textContent,'Card v0.3.19');
assert.equal(card.shadowRoot.querySelector('#tp-brand-style-v0319').tagName,'STYLE');
assert.equal(card._remotePortal.shadowRoot.querySelector('#tp-brand-remote-v0319').tagName,'STYLE');
const logo=card.shadowRoot.querySelector('.tp-brand-logo');
assert.equal(logo.src,'https://www.totalplay.com.mx/assetsv2/img/header/totalplay-logoWhite.svg');
const mark=card.shadowRoot.querySelector('.mark');
logo.handlers.load();assert.equal(mark.style.display,'none');
const stations=card._channels();
assert.equal(stations.find(ch=>ch.number==='5').name,'Canal 5','Original channel is not replaced');
assert.equal(stations.find(ch=>ch.number==='4').name,'N+ Foro','Reference omission is filled');
assert.equal(stations.find(ch=>ch.number==='143').name,'Canal 22');
assert.equal(card._channels(),stations,'Reference additions preserve cached channel array');
card._renderGuide();
const badge=card._rows.children[0].querySelector('.ch-logo');
const image=badge.querySelector('img');
assert.equal(image.src,'https://example.org/canal5.png','XMLTV image renders');
image.handlers.error();
assert.equal(badge.textContent,'CA','Failed image restores channel initials');
card.setConfig({lineup:true,channels:[{number:'5',name:'Canal 5',epg_id:'canal5.mx',logo_url:'https://example.org/override.svg'}]});
card._renderGuide();
assert.equal(card._rows.children[0].querySelector('img').src,'https://example.org/override.svg','Explicit image takes precedence');
assert.equal(card._channels().some(ch=>ch.number==='4'),true);
const empty=new Card();empty.setConfig({lineup:false,channels:[]});
assert.equal(empty._channels().length,0,'Custom-only cards do not receive reference numbers');
console.log('PASS: Totalplay header, remote theme, EPG and manual channel logos, fallback, source additions, badge');
