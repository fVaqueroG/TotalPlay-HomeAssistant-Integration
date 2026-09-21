/* Test the Guide/Apps view and floating remote against a small DOM simulator. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const code = fs.readFileSync(path.join(__dirname, '../custom_components/totalplay_stb/www/totalplay-pages-remote.js'), 'utf8');
assert.match(code, /import '\.\/totalplay-epg-responsive\.js\?v=0\.3\.5';/);
const allListeners = new Map();
class Element {
  constructor(tag='div') {
    this.tagName = tag; this.children = []; this.attrs = {}; this.hidden = false;
    this.listeners = new Map(); this.className = ''; this.textContent = '';
    this.classList = {classes:new Set(), toggle:(name,enabled)=> {
      if (enabled) this.classList.classes.add(name); else this.classList.classes.delete(name);
    }, remove:name=>this.classList.classes.delete(name)};
  }
  appendChild(child) {this.children.push(child); child.parentElement = this; return child;}
  append(...children) {children.forEach(child=>this.appendChild(child));}
  replaceChildren(...children) {this.children=[];this.append(...children);}
  insertBefore(child) {this.appendChild(child);}
  remove() {this.removed=true;this.parentElement?.children.splice(this.parentElement.children.indexOf(this),1);}
  setAttribute(key,value) {this.attrs[key]=value;}
  addEventListener(name,callback) {this.listeners.set(name,callback);}
  fire(name,event={}) {this.listeners.get(name)?.(event);}
  focus() {this.focused=true;}
  attachShadow() {this.shadowRoot=new Element('shadow');return this.shadowRoot;}
  querySelector(selector) {
    if (selector==='.remote-head') return this.head || null;
    if (selector==='.tp-remote-close') return this.children.find(el=>el.className?.includes('tp-remote-close')) || null;
    if (selector==='.header') return this.header || null;
    if (selector==='.tp-version-badge') return this.badge || null;
    if (selector==='style') return this.css || null;
    if (selector==='#tp-pages-style') return this.children.find(el=>el.id==='tp-pages-style') || null;
    if (selector==='.guide-info') return this.info || null;
    return this.children.find(el=>el.querySelector?.(selector))?.querySelector(selector) || null;
  }
}
class Card {
  setConfig(config) {
    this._config=config; this._tab='guide'; this._guidePanel=new Element();this._appsPanel=new Element();
    this._appStrip=new Element();this._layout=new Element();this._search=new Element('input');
    this._search.parentElement=new Element('div');this._pills=new Element();
    this._remote=new Element('aside');this._remote.head=new Element('header');
    this._remoteTab=new Element('button');this._remoteTab.className='tab';this._remoteTab.addEventListener('click',()=>this._toggleRemote());
    this._time=new Element('div');
    this.shadowRoot=new Element('shadow');this.shadowRoot.css=new Element('style');this.shadowRoot.css.textContent='.remote {color:white}';
    this.shadowRoot.header=new Element('header');this.shadowRoot.header.append(this._remoteTab,this._time);
    this.shadowRoot.badge=new Element('span');
    this._switch('guide');
  }
  _switch(tab) {this._tab=tab;this._guidePanel.hidden=tab!=='guide';this._appsPanel.hidden=tab!=='apps';}
}
const doc={body:new Element('body'),createElement:tag=>new Element(tag),
  addEventListener:(event,callback)=>allListeners.set(event,callback),
  removeEventListener:event=>allListeners.delete(event)};
const sandbox={customElements:{get:()=>Card},document:doc,console};
vm.createContext(sandbox);
vm.runInContext(code.replace(/^import .*;\s*/m,''),sandbox);
const card=new Card();
card.setConfig({title:'Totalplay'});
assert.equal(card.shadowRoot.badge.textContent,'Card v0.3.5');
assert.equal(card._appStrip.removed,true,'Guide should not render persistent Apps strip');
assert.equal(card._remoteTab.parentElement,card.shadowRoot.header,'Remote control must be a toolbar button');
assert.equal(card._remoteTab.children[0].attrs.icon,'mdi:remote-tv');
assert.equal(card._remotePortal.hidden,true,'Remote must be closed by default');
assert.equal(card._remote.parentElement,card._remotePortal.shadowRoot,'Original remote keeps its command button listeners');
card._switch('apps');
assert.equal(card._guidePanel.hidden,true);
assert.equal(card._appsPanel.hidden,false);
assert.equal(card._search.parentElement.classList.classes.has('hidden'),true,'Hide guide search on Apps page');
card._remoteTab.fire('click');
assert.equal(card._remotePortal.hidden,false,'Remote toolbar button opens popup');
assert.equal(card._tab,'apps','Opening remote does not change pages');
assert.equal(card._remoteTab.attrs['aria-expanded'],'true');
assert.ok(allListeners.has('keydown'));
card._remotePortal.shadowRoot.querySelector('.tp-remote-close').fire('click');
assert.equal(card._remotePortal.hidden,true,'Close button dismisses remote');
assert.equal(card._tab,'apps','Closing remote returns to prior page');
assert.equal(allListeners.has('keydown'),false,'Closing remote cleans up Escape listener');
card._remoteTab.fire('click');
allListeners.get('keydown')({key:'Escape',preventDefault(){}});
assert.equal(card._remotePortal.hidden,true,'Escape dismisses remote');
const oldPortal=card._remotePortal;
card.setConfig({title:'Totalplay'});
assert.equal(oldPortal.removed,true,'Reconfiguring removes old popup');
assert.equal(card._remotePortal.hidden,true,'Reconfigured popup starts closed');
card.disconnectedCallback();
assert.equal(card._remotePortal,null,'Detached card removes popup from document body');
console.log('PASS: dedicated Guide/Apps views, remote toolbar portal, close/Escape, reconfigure cleanup and card version');
