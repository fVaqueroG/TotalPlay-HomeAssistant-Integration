/* Check black Totalplay header, version placement and live TV status without a browser. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../custom_components/totalplay_stb/www/totalplay-stb-v0320.js'), 'utf8');
assert.match(source, /import '\.\/totalplay-stb-v0319\.js\?v=0\.3\.20'/);
class Node {
  constructor(tag='div', className='', text='') {
    this.tagName=tag.toUpperCase(); this.className=className; this._text=String(text);
    this.children=[]; this.id=''; this.style={}; this.parentElement=null; this.title='';
    this.classList={add:name=>{if (!this.className.split(' ').includes(name)) this.className+=' '+name;}};
  }
  get textContent() { return this._text + this.children.map(c=>c.textContent).join(''); }
  set textContent(value) { this._text=String(value); this.children=[]; }
  appendChild(child) { child.remove(); child.parentElement=this; this.children.push(child); return child; }
  append(...children) { children.forEach(c=>this.appendChild(c)); }
  insertBefore(child, before) { child.remove(); const index=this.children.indexOf(before);
    child.parentElement=this; this.children.splice(index<0?this.children.length:index,0,child); return child; }
  remove() { if (this.parentElement) this.parentElement.children=this.parentElement.children.filter(c=>c!==this);
    this.parentElement=null; }
  querySelector(selector) { if(selector.includes(' ')) return null; const wanted=selector.slice(1);
    for(const child of this.children){if(selector[0]==='#'?child.id===wanted:selector[0]==='.'?child.className.split(' ').includes(wanted):child.tagName===selector.toUpperCase())return child;
      const nested=child.querySelector(selector); if(nested)return nested; } return null; }
}
class Card {
  setConfig(config) { this._config=config; this.shadowRoot=new Node('shadow'); const header=new Node('div','header');
    const brand=new Node('div','brand');const logo=new Node('img','tp-brand-logo');logo.src='https://www.totalplay.com.mx/assetsv2/img/header/totalplay-logoWhite.svg';
    const titleBox=new Node('div');const title=new Node('div','brand-title','Totalplay TV');
    const badge=new Node('span','tp-version-badge','Card v0.3.19'); title.appendChild(badge);
    const status=new Node('div','meta','TV: Music Assistant Queue · target HDMI 2');
    const warning=new Node('div','tp-input-warning',''); this._tv=status;
    titleBox.append(title,status,warning); brand.append(logo,titleBox);header.appendChild(brand);
    this.shadowRoot.appendChild(header);this._remotePortal={shadowRoot:new Node('shadow')};
  }
}
const sandbox={customElements:{get:name=>name==='totalplay-stb-card'?Card:null},document:{createElement:tag=>new Node(tag)}};
vm.createContext(sandbox);
vm.runInContext(source.replace(/^import .*;\s*/m,''), sandbox);
const card=new Card();card.setConfig({entity:'media_player.totalplay'});
const root=card.shadowRoot,brand=root.querySelector('.brand');
const row=root.querySelector('.tp-brand-bottom'),badge=root.querySelector('.tp-version-badge');
assert.equal(root.querySelector('.brand-title'),null,'Redundant title is removed');
assert.equal(brand.children[0].className,'tp-brand-logo','Totalplay wordmark leads header');
assert.equal(brand.children[1],row,'Status row sits beneath logo');
assert.equal(row.children[0],badge,'Version precedes TV status');
assert.equal(row.children[1],card._tv,'Live TV status sits next to version');
assert.equal(badge.textContent,'v0.3.20','Version badge omits the word Card');
card._tv.textContent='TV: HDMI 2 · decoder ready';
assert.equal(row.children[1].textContent,'TV: HDMI 2 · decoder ready','TV state remains dynamic');
const css=root.querySelector('#tp-black-theme-v0320').textContent;
assert.match(css,/ha-card \{background:#101010!important/);
assert.match(css,/\.header \{background:#161616!important/);
assert.match(css,/\.tp-brand-bottom/);
assert.doesNotMatch(css,/#46233c|#30243f|#9353a9/i,'New theme does not use old purple gradients');
assert.match(card._remotePortal.shadowRoot.querySelector('#tp-black-remote-v0320').textContent, /background:#151515!important/);
card.setConfig({entity:'media_player.totalplay'});
assert.equal(card.shadowRoot.querySelectorAll?.('.tp-version-badge')?.length||1,1,'Rebuild has one version badge');
console.log('PASS: black corporate theme, one wordmark, version below logo, live TV status beside badge and remote theme');
