/* Regression check for the one-row guide viewport shown on a large screen. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const file = path.join(__dirname, '../custom_components/totalplay_stb/www/totalplay-guide-layout-v036.js');
const code = fs.readFileSync(file, 'utf8');
assert.match(code, /import '\.\/totalplay-pages-remote\.js\?v=0\.3\.6'/);
assert.match(code, /\.layout,\.layout\.remote-visible \{display:flex!important;flex-direction:column!important;align-items:stretch!important/);
assert.match(code, /\.main \{[^}]*flex:1 1 auto;[^}]*height:100%;/);
assert.match(code, /\.guide-scroll \{[^}]*flex:1 1 0!important;height:0!important;/);
class Element {
  constructor(){this.children=[];this.listeners={};this.scrollTop=100;this.scrollLeft=60;this.textContent='';}
  addEventListener(type, fn){this.listeners[type]=fn;}
  fire(type, target){this.listeners[type]?.({target});}
  appendChild(child){this.children.push(child);}
}
class Card {
  setConfig(config){
    this._config=config;this._scroll=new Element();this._search=new Element();this._guideOnly=new Element();
    this._pills=new Element();this._badge=new Element();this._styles=[];
    this.shadowRoot={querySelector:(selector)=>selector==='.tp-version-badge'?this._badge:
      selector==='#tp-guide-layout-v036'?this._styles.find(s=>s.id==='tp-guide-layout-v036')||null:null,
      appendChild:(style)=>this._styles.push(style)};
  }
  _queueGuideFill(){this.fills=(this.fills||0)+1;}
}
const sandbox={customElements:{get:()=>Card},document:{createElement:()=>new Element()}};
vm.createContext(sandbox);
vm.runInContext(code.replace(/^import .*;\s*/m,''),sandbox);
const card=new Card();card.setConfig({title:'Totalplay'});
assert.equal(card._badge.textContent,'Card v0.3.6');
assert.equal(card._scroll.scrollTop,0,'Fresh page starts at first channel');
assert.equal(card._scroll.scrollLeft,0);
assert.equal(card._styles.length,1,'Only one layout override');
assert.equal(card.fills,1,'Guide fills the available viewport');
card._scroll.scrollTop=300;card._search.fire('input');assert.equal(card._scroll.scrollTop,0);
card._scroll.scrollTop=300;card._guideOnly.fire('change');assert.equal(card._scroll.scrollTop,0);
card._scroll.scrollTop=300;card._pills.fire('click',{closest:selector=>selector==='.pill'});assert.equal(card._scroll.scrollTop,0);
console.log('PASS: guide fills full screen card, frontend version and filter scroll reset');
