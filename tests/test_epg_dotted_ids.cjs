/* Verify the v0.3.15 enhancement against the real base-card and matching layer. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const www = path.join(__dirname, '../custom_components/totalplay_stb/www');
const read = file => fs.readFileSync(path.join(www, file), 'utf8');
const types = new Map();
const sandbox = {
  HTMLElement: class {},
  window: {innerWidth:1200, customCards:[]},
  customElements: {get:name => types.get(name), define:(name,klass) => types.set(name,klass)},
  console,
};
vm.createContext(sandbox);
vm.runInContext(read('totalplay-guide-v3.js'), sandbox);
vm.runInContext(read('totalplay-epg-responsive.js').replace(/^import[^\n]*\n/, ''), sandbox);
vm.runInContext(read('totalplay-stb-v0315.js').replace(/^import[^\n]*\n/, ''), sandbox);
const Card = types.get('totalplay-stb-card');
const card = Object.create(Card.prototype);
card._config = {lineup:true, epg:true, channels:[], apps:[]};
card._reference = {channels:[
  {number:'1', name:'Azteca Uno'},
  {number:'2', name:'Las Estrellas'},
  {number:'3', name:'Imagen Televisión'},
  {number:'5', name:'Canal 5'},
  {number:'6', name:'Other station'},
  {number:'7', name:'Azteca Siete'},
]};
const live = [{title:'Actual EPG listing', start:new Date(Date.now()-60000).toISOString(), stop:new Date(Date.now()+60000).toISOString()}];
card._guide = {channels:[
  {id:'Canal.Azteca.Uno.(México).mx', name:'Provider label 1', schedule:live},
  {id:'Canal.Las.Estrellas.(México).mx', name:'Provider label 2', schedule:live},
  {id:'Canal.Imagen.Televisión.(México).mx', name:'Provider label 3', schedule:live},
  {id:'Canal.Canal.5.(México).mx', name:'Provider label 4', schedule:live},
  {id:'Canal.Azteca.Siete.(México).mx', name:'Provider label 5', schedule:live},
]};
let mapped = card._channels();
for (const number of ['1','2','3','5','7']) {
  assert.ok(mapped.find(ch => ch.number === number).epg_id, `Dotted ID maps channel ${number}`);
}
assert.equal(mapped.find(ch => ch.number === '6').epg_id, undefined, 'Unknown station is not guessed');
card._config.channels = [{number:'1', epg_id:'ManuallyChosen.mx'}];
assert.equal(card._channels().find(ch => ch.number === '1').epg_id, 'ManuallyChosen.mx', 'Manual ID wins');
card._config.channels = [];
card._guide.channels.push({id:'Canal.Azteca.1.(México).mx', name:'Alternate regional station', schedule:live});
assert.equal(card._channels().find(ch => ch.number === '1').epg_id, undefined, 'Two live regional candidates remain unmapped');
assert.match(read('totalplay-stb-v0315.js'), /Card v0\.3\.15/);
console.log('PASS: dotted XMLTV IDs, channel aliases, manual overrides, and ambiguous regional feeds');
