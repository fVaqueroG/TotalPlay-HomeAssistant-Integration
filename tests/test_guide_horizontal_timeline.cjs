/* Render a multi-hour EPG inside a two-hour-wide responsive viewport. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.join(__dirname,'../custom_components/totalplay_stb/www');
const code=fs.readFileSync(path.join(root,'totalplay-stb-v0316.js'),'utf8');
const base=fs.readFileSync(path.join(root,'totalplay-guide-v3.js'),'utf8');
assert.match(code,/import '\.\/totalplay-stb-v0315\.js\?v=0\.3\.16'/);
assert.match(code,/position:sticky!important;left:0!important/);
assert.match(code,/--tp-total-width/);
assert.match(code,/ResizeObserver/);
assert.match(code,/tp-wide-controls/);
const props={};
class Element {
  constructor(tag='div',cls='',text=''){
    this.tagName=tag.toUpperCase();this.className=cls;this.textContent=text;
    this.children=[];this.attrs={};this.style={left:'',width:'',setProperty:(k,v)=>{props[k]=v;}};
    this.classList={toggle:()=>{}};
  }
  append(...children){for(const child of children)this.appendChild(child);}
  appendChild(child){this.children.push(child);return child;}
  replaceChildren(...children){this.children=children;}
  setAttribute(key,value){this.attrs[key]=value;}
  querySelector(selector){return this.nodes?.[selector]||null;}
}
const now=Date.now();
const live={title:'Live show',start:new Date(now-5*60000).toISOString(),stop:new Date(now+25*60000).toISOString()};
const later={title:'Future show',start:new Date(now+5*3600000).toISOString(),stop:new Date(now+6*3600000).toISOString()};
const channel={number:'1',name:'Azteca Uno',epg_id:'Azteca.mx',category:'Local'};
const row=new Element();row.nodes={'.ch-num':new Element('span','','1'),'.ch-now':new Element('div','','Local'),'.timeline':new Element()};
const times=new Element();
const scroll=new Element();scroll.clientWidth=1198;scroll.scrollLeft=0;
scroll.scrollWidth=3900;scroll.style={setProperty:(k,v)=>{props[k]=v;}};
const rows={children:[row]};
class Card {
  _channels(){return[channel];}
  _btn(text,handler,cls){const el=new Element('button',cls,text);el.onclick=handler;return el;}
  _play(kind,number){this.tuned=[kind,number];}
  _renderGuide(){this.rendered=(this.rendered||0)+1;this._scroll.scrollLeft=0;}
}
const sandbox={
  document:{createElement:tag=>new Element(tag)},
  customElements:{get:name=>name==='totalplay-stb-card'?Card:null},
  console,
};
vm.createContext(sandbox);
vm.runInContext(code.replace(/^import .*;\s*/m,''),sandbox);
const card=new Card();
card._scroll=scroll;card._times=times;card._rows=rows;
card._guide={channels:[{id:'Azteca.mx',name:'Azteca Uno',schedule:[live,later]}]};
card._selected=new Element();
card._renderGuide();
assert.equal(Number(props['--tp-slot-width']),250,'Four half-hours fill the guide viewport');
assert.ok(times.children.length>=12,'Six hours of programme slots are rendered');
assert.equal(Number(props['--tp-total-width']),times.children.length*250);
const timeline=row.nodes['.timeline'];
assert.ok(timeline.children.some(p=>p.className==='programme live'),'Current programme remains tunable');
const future=timeline.children.find(p=>p.className==='programme'&&p.children[0]?.textContent==='Future show');
assert.ok(future,'A programme beyond two hours must be visible after sideways scrolling');
assert.ok(parseFloat(future.style.left)>40,'Later programme has a horizontal offset');
future.onclick();
assert.match(card._selected.textContent,/Future show/);
assert.equal(card.tuned,undefined,'Upcoming programmes must not tune a channel');
timeline.children.find(p=>p.className==='programme live').onclick();
assert.equal(card.tuned[1],'1');
scroll.scrollLeft=500;
scroll.clientWidth=598;
card._renderGuide();
assert.equal(Number(props['--tp-slot-width']),100,'Resize preserves two-hour window');
assert.equal(scroll.scrollLeft,200,'Resize keeps the same selected time, rather than jumping to Now');
assert.equal(card.rendered,2,'Original card rendering remains active');
console.log('PASS: full available EPG, fixed channel column CSS, two-hour viewport, future shows, and time-preserving resize');
