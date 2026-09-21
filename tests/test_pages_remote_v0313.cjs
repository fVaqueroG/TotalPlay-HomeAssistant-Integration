/* Regression for v0.3.13 page navigation and remote placement. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const file = path.join(__dirname, '../custom_components/totalplay_stb/www/totalplay-stb-v0313.js');
const code = fs.readFileSync(file, 'utf8');
assert.match(code, /import '\.\/totalplay-stb-v0311\.js\?v=0\.3\.13';/);
class Element {
  constructor(tag = 'div') {
    this.tag = tag; this.children = []; this.hidden = false; this.attrs = {};
    this.classList = {removed: [], remove: name => this.classList.removed.push(name)};
  }
  appendChild(child) {this.children.push(child); child.parentElement = this; return child;}
  setAttribute(name, value) {this.attrs[name] = value;}
  remove() {this.removed = true;}
  querySelector(selector) {
    return this.children.find(child => selector.startsWith('#')
      ? child.id === selector.slice(1)
      : child.className?.split(' ').includes(selector.slice(1))) || null;
  }
}
class Card {
  setConfig(config) {
    this._config = config;
    this._tab = this._tab || 'guide';
    this._appStrip = new Element();
    this._remoteTab = new Element('button');
    this._remoteTab.className = 'tp-remote-trigger';
    this._remotePortal = new Element();
    this._remotePortal.shadowRoot = new Element('shadow');
    this.shadowRoot = new Element('shadow');
    this.tabs = this.shadowRoot.appendChild(new Element());
    this.tabs.className = 'tabs';
    this.badge = this.shadowRoot.appendChild(new Element());
    this.badge.className = 'tp-version-badge';
    this._guidePanel = new Element();
    this._appsPanel = new Element();
  }
  _switch(tab) {
    this._tab = tab;
    this._guidePanel.hidden = tab !== 'guide';
    this._appsPanel.hidden = tab !== 'apps';
  }
}
const sandbox = {
  customElements: {get: name => name === 'totalplay-stb-card' ? Card : null},
  document: {createElement: tag => new Element(tag)}, console,
};
vm.createContext(sandbox);
vm.runInContext(code.replace(/^import .*;\s*/m, ''), sandbox);
const card = new Card();
card.setConfig({title: 'Totalplay'});
assert.equal(card._appStrip.removed, true, 'Guide must have no persistent app strip');
assert.equal(card._remoteTab.parentElement, card.tabs, 'Remote icon belongs beside Guide and Apps');
assert.equal(card.tabs.children.at(-1), card._remoteTab);
assert.equal(card._remotePortal.hidden, true, 'Remote stays closed until tapped');
assert.equal(card._remoteOpen, false);
assert.equal(card.badge.textContent, 'Card v0.3.13');
assert.equal(card._remoteTab.attrs['aria-haspopup'], 'dialog');
assert.match(card.shadowRoot.querySelector('#tp-page-control-v0313').textContent, /\.apps-strip/);
assert.match(card._remotePortal.shadowRoot.querySelector('#tp-popup-control-v0313').textContent, /\.dpad/);
card._switch('apps');
assert.equal(card._guidePanel.hidden, true, 'Apps is a distinct page');
assert.equal(card._appsPanel.hidden, false);
const previous = card._config;
card.setConfig(previous);
assert.equal(card._tab, 'apps', 'Rebuild preserves chosen page');
assert.equal(card._remotePortal.hidden, true, 'Rebuild never opens remote');
console.log('PASS: dedicated Guide and Apps pages, compact remote trigger, closed floating control and v0.3.13 badge');
