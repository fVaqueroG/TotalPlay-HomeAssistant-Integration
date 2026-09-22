/* Verify fast v0.3.17 EPG reuse without real Home Assistant or network. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../custom_components/totalplay_stb/www/totalplay-stb-v0317.js'),'utf8');
assert.match(code,/import '\.\/totalplay-stb-v0316\.js\?v=0\.3\.17'/);
class Card {
  setConfig(config){this._config=config;}
  _channels(){this.matches=(this.matches||0)+1;return [{number:'1',name:'Azteca Uno'}];}
  _renderGuide(){this.renders=(this.renders||0)+1;}
}
const sandbox={
  customElements:{get:name=>name==='totalplay-stb-card'?Card:null},
  console,
};
vm.createContext(sandbox);
vm.runInContext(code.replace(/^import .*;\s*/m,''),sandbox);
(async()=>{
  let fetchCount=0,resolveFirst;
  const firstRequest=new Promise(resolve=>{resolveFirst=resolve;});
  const guide={channels:[{id:'Azteca.mx',schedule:[]}]};
  const hass={callApi:(method,url)=>{
    assert.equal(method,'GET');assert.equal(url,'totalplay_stb/epg');
    fetchCount++;
    return fetchCount===1?firstRequest:Promise.resolve(guide);
  }};
  const make=()=>{const card=new Card();card._hass=hass;card.setConfig({epg:true});return card;};
  const first=make(),second=make();
  const p1=first._loadGuide(),p2=second._loadGuide();
  await Promise.resolve();
  assert.equal(fetchCount,1,'Simultaneous card mounts share a single EPG request');
  resolveFirst(guide);
  await Promise.all([p1,p2]);
  assert.equal(first._guide,guide);assert.equal(second._guide,guide);
  assert.equal(first.renders,1);assert.equal(second.renders,1);
  const third=make();
  await third._loadGuide();
  assert.equal(third._guide,guide);
  assert.equal(fetchCount,1,'A new card reuses the already loaded guide immediately');
  await third._loadGuide(true);
  assert.equal(fetchCount,2,'Explicit refresh must bypass the browser cache');
  const channels=third._channels();
  assert.equal(third._channels(),channels);
  assert.equal(third.matches,1,'Repeated guide renders reuse the channel mapping');
  third._guide={channels:[...guide.channels]};
  third._channels();
  assert.equal(third.matches,2,'A new guide invalidates the mapped channel cache');
  third.setConfig({epg:true,channels:[{number:'2'}]});
  third._channels();
  assert.equal(third.matches,3,'Changing configuration invalidates the channel cache');
  console.log('PASS: concurrent EPG fetch shared, cached schedule reused, manual refresh honored, channel mappings memoized');
})().catch(error=>{console.error(error);process.exitCode=1;});
