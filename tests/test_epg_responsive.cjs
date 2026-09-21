/* Check the browser module's matching layer without Home Assistant dependencies. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const www = path.join(__dirname, '../custom_components/totalplay_stb/www');
const base = fs.readFileSync(path.join(www, 'totalplay-guide-v3.js'), 'utf8');
const addon = fs.readFileSync(path.join(www, 'totalplay-epg-responsive.js'), 'utf8');
assert.match(addon, /^import '\.\/totalplay-guide-v3\.js';/);
const types = new Map();
const sandbox = {
  HTMLElement: class {},
  window: {innerWidth: 1200, customCards: []},
  customElements: {get: name => types.get(name), define: (name, klass) => types.set(name, klass)},
  console,
};
vm.createContext(sandbox);
vm.runInContext(base, sandbox);
vm.runInContext(addon.replace(/^import '\.\/totalplay-guide-v3\.js';\s*/, ''), sandbox);
const Card = types.get('totalplay-stb-card');
const card = Object.create(Card.prototype);
card._config = {lineup: true, epg: true, channels: [], apps: []};
card._reference = {channels: [{number: '101', name: 'Azteca Uno HD'}, {number: '102', name: 'Discovery Channel'}, {number: '103', name: 'Fox Sports'}]};
const future = [{title: 'Real source title', start: new Date(Date.now()-60000).toISOString(), stop: new Date(Date.now()+60000).toISOString()}];
card._guide = {channels: [
  {id: 'Azteca1.mx', name: 'Azteca 1', schedule: future},
  {id: 'Discovery.mx', name: 'Discovery HD', names: ['Discovery Channel HD'], schedule: future},
  {id: 'FoxSportsA.mx', name: 'Fox Sports', schedule: future},
  {id: 'FoxSportsB.mx', name: 'Fox Sports HD', schedule: future},
]};
const mapped = card._channels();
assert.equal(mapped.find(ch => ch.number === '101').epg_id, 'Azteca1.mx');
assert.equal(mapped.find(ch => ch.number === '102').epg_id, 'Discovery.mx');
assert.equal(mapped.find(ch => ch.number === '103').epg_id, undefined, 'Ambiguous station must not be guessed');
card._config.channels = [{number: '101', epg_id: 'ManuallyChosen.mx'}];
assert.equal(card._channels().find(ch => ch.number === '101').epg_id, 'ManuallyChosen.mx', 'Manual mapping must win');
assert.match(addon, /100dvh/);
assert.match(addon, /\.guide-scroll \{flex:1/);
assert.match(addon, /\.layout\.remote-visible \.remote \{position:absolute/);
assert.equal(sandbox.window.customCards.filter(card => card.type === 'totalplay-stb-card').length, 1);
console.log('PASS: clear station aliases, ambiguous match safety, manual mapping precedence, responsive guide and remote overlay');
