/* Check real scroll events without Home Assistant or a browser runtime. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const www = path.join(__dirname, '../custom_components/totalplay_stb/www');
const base = fs.readFileSync(path.join(www, 'totalplay-guide-v3.js'), 'utf8');
const addon = fs.readFileSync(path.join(www, 'totalplay-epg-responsive.js'), 'utf8');
const types = new Map();
class Element {
  constructor() {
    this.listeners = new Map();
    this.hidden = false;
    this.scrollTop = 0;
    this.scrollLeft = 0;
    this.scrollHeight = 2450;
    this.clientHeight = 400;
    this.children = [];
  }
  addEventListener(name, listener) { this.listeners.set(name, [...(this.listeners.get(name) || []), listener]); }
  fire(name) { for (const listener of this.listeners.get(name) || []) listener(); }
  appendChild(child) { this.children.push(child); }
  scrollTo(options) { this.scrollTop = options.top; this.lastScrollOptions = options; this.fire('scroll'); }
}
const sandbox = {
  HTMLElement: class {},
  customElements: {get: name => types.get(name), define: (name, cls) => types.set(name, cls)},
  document: {createElement: () => new Element()},
  window: {innerWidth: 1200, customCards: []},
  console,
};
vm.createContext(sandbox);
vm.runInContext(base, sandbox);
const Card = types.get('totalplay-stb-card');
// Replace only the original render/build layer with lightweight simulated DOM.
// The actual addon event handler and overridden render/setConfig run unchanged.
Card.prototype._renderGuide = function () {
  this.renderCount = (this.renderCount || 0) + 1;
  this._more.hidden = this._limit >= 105;
  this._scroll.scrollHeight = this._limit * 70;
};
Card.prototype.setConfig = function (config) {
  this._config = config;
  this._limit = 35;
  this._tab = 'guide';
  this._scroll = new Element();
  this._more = new Element();
  const info = new Element();
  this._guidePanel = {querySelector: selector => selector === '.guide-info' ? info : null};
  this.shadowRoot = {querySelector: () => null, appendChild: () => {}};
  this._renderGuide();
};
vm.runInContext(addon.replace(/import '\.\/totalplay-guide-v3\.js';\s*/, ''), sandbox);
const card = Object.create(Card.prototype);
card.setConfig({epg: false, lineup: true});
const scroll = card._scroll;
assert.equal(scroll.listeners.get('scroll').length, 1, 'Bind a single scroll handler');
assert.equal(card._more.hidden, true, 'Hide Show more immediately');
assert.equal(card._backToTop.hidden, true);
scroll.scrollTop = 1900; // 150px from bottom of 35 rows
scroll.fire('scroll');
assert.equal(card._limit, 70, 'Load next batch at end of guide');
assert.equal(scroll.scrollTop, 1900, 'Append rows without jumping to first channel');
assert.equal(card._more.hidden, true);
assert.equal(card._backToTop.hidden, false, 'Show return button after scrolling');
scroll.fire('scroll');
assert.equal(card._limit, 70, 'Do not load all remaining rows from one scroll position');
scroll.scrollTop = 4450;
scroll.fire('scroll');
assert.equal(card._limit, 105);
assert.equal(card._guideHasMore, false, 'Stop when filtered rows are exhausted');
const selectionBefore = card._config;
card._backToTop.fire('click');
assert.equal(scroll.scrollTop, 0, 'Return to beginning');
assert.equal(card._config, selectionBefore, 'Keep channel, category, and search configuration');
assert.equal(card._backToTop.hidden, true);
card.setConfig({epg: false, lineup: true});
assert.equal(card._scroll.listeners.get('scroll').length, 1, 'Rebuild does not duplicate listeners');
assert.equal(card._backToTop.hidden, true);
console.log('PASS: infinite guide scroll, no manual pagination, stable scroll, top button, rebuild safety');
