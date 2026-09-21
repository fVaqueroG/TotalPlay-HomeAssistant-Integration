/* The Totalplay decoder's app on channel 413 is HBO Max. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '../custom_components/totalplay_stb/www');
const code = fs.readFileSync(path.join(root, 'totalplay-stb-v0310.js'), 'utf8');
assert.match(code, /import '\.\/totalplay-stb-v038\.js\?v=0\.3\.10'/);
class Card {
  _appsList() {return [{number:'413',name:'Max'}, {number:'225',name:'YouTube'}, {number:'210',name:'Prime Video'}];}
  _renderApps() {
    this.renderedApps=this._appsList();
    this.usedProviders=this._tpLogoProviders?.map(({provider_name})=>provider_name);
    return this.renderedApps;
  }
  setConfig(config) {
    this.config=config;
    this.badge={replaceChildren:(text)=>{this.badgeText=text;}};
    this.shadowRoot={querySelector:selector=>selector==='.tp-version-badge'?this.badge:null};
  }
}
const sandbox={customElements:{get:()=>Card}};
vm.createContext(sandbox);
vm.runInContext(code.replace(/^import .*;\s*/m,''), sandbox);
const card=new Card();
card._tpLogoProviders=[
  {provider_id:1899,provider_name:'HBO Max',logo_path:'/hbo.png'},
  {provider_id:9999,provider_name:'Max Amazon Channel',logo_path:'/other.png'},
  {provider_id:9998,provider_name:'Max',logo_path:'/old.png'},
];
card.setConfig({tmdb_api_key:'TEST'});
assert.equal(card.badgeText,'Card v0.3.10');
assert.equal(card.renderedApps[0].name,'HBO Max');
assert.equal(card.renderedApps[0].number,'413');
assert.equal(card.renderedApps[1].name,'YouTube');
assert.deepEqual(card.usedProviders,['Max Amazon Channel','Max'],'HBO Max artwork is preferred over legacy Max');
assert.equal(card._tpLogoProviders[0].provider_name,'HBO Max','Original provider catalog is not modified');
card._tpLogoProviders=[{provider_name:'Max',logo_path:'/max.png'}];
card._renderApps();
assert.deepEqual(card.usedProviders,['Max'],'Legacy Max art remains a valid fallback');
console.log('PASS: HBO Max channel 413 label and TMDB artwork preference, other apps, version and catalog stability');
