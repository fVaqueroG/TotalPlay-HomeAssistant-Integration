/* Totalplay card v0.3.16: a two-hour-wide viewport over the entire available EPG.
 * Keep the existing channel list, manual EPG mapping, app, remote and tune handlers.
 */
import './totalplay-stb-v0315.js?v=0.3.16';

const TP_WIDE_CARD = customElements.get('totalplay-stb-card');
if (!TP_WIDE_CARD) throw new Error('Totalplay card did not load');

const TP_WIDE_SLOT_MS = 30 * 60 * 1000;
const TP_WIDE_TWO_HOURS = 4 * TP_WIDE_SLOT_MS;
const TP_WIDE_EIGHT_HOURS = 16 * TP_WIDE_SLOT_MS;
const TP_WIDE_CSS = `
/* Every two hours occupy exactly the available space to the right of the
   sticky channel column. Extra time extends the rows, not the card itself. */
.guide-scroll {--tp-channel-width:198px;--tp-slot-width:160px;--tp-total-width:640px}
.guide-scroll .grow {width:calc(var(--tp-channel-width) + var(--tp-total-width))!important;min-width:calc(var(--tp-channel-width) + var(--tp-total-width))!important}
.guide-scroll .grow .ch {position:sticky!important;left:0!important;width:var(--tp-channel-width)!important;flex:0 0 var(--tp-channel-width)!important;z-index:4;box-shadow:1px 0 0 var(--tp-line);background:var(--tp-bg)}
.guide-scroll .grow.head .ch {z-index:8}
.guide-scroll .grow .timeline {width:var(--tp-total-width)!important;flex:0 0 var(--tp-total-width)!important;min-width:var(--tp-total-width)!important;background:repeating-linear-gradient(90deg,transparent 0,transparent calc(var(--tp-slot-width) - 1px),var(--tp-line) calc(var(--tp-slot-width) - 1px),var(--tp-line) var(--tp-slot-width))}
.guide-scroll .grow .times {display:grid!important;grid-template-columns:repeat(var(--tp-slot-count),var(--tp-slot-width))!important;background:var(--tp-bg)!important}
.guide-scroll.tp-wide-tight .ch-logo {display:none}
.guide-scroll.tp-wide-tight .ch {gap:5px;padding:6px}
.guide-scroll.tp-wide-tight .ch-name,.guide-scroll.tp-wide-tight .ch-now {max-width:calc(var(--tp-channel-width) - 33px)}
.tp-wide-controls {display:inline-flex;align-items:center;gap:5px;flex:0 0 auto}
.tp-wide-controls .btn {padding:5px 8px;font-size:12px;min-width:32px}
@media(max-width:580px){.tp-wide-controls .btn {padding:5px 7px}}
`;
const tpWideClock = value => new Date(value).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'});
const tpWideNode = (tag,cls,text) => {
  const node=document.createElement(tag);
  if(cls)node.className=cls;
  if(text!==undefined)node.textContent=String(text);
  return node;
};
const tpPreviousWideRender = TP_WIDE_CARD.prototype._renderGuide;
TP_WIDE_CARD.prototype._renderGuide = function () {
  // Reuse the existing filtering, vertical infinite scroll, matching, remote,
  // search, channel-tuning handlers and status diagnostics.
  tpPreviousWideRender.call(this);
  const scroll=this._scroll,head=this._times,rows=this._rows;
  if(!scroll||!head||!rows)return;
  const now=Date.now(),start=Math.floor(now/TP_WIDE_SLOT_MS)*TP_WIDE_SLOT_MS;
  const horizon=now+TP_WIDE_EIGHT_HOURS;
  let lastStop=start+TP_WIDE_TWO_HOURS;
  const stations=Array.isArray(this._guide?.channels)?this._guide.channels:[];
  const byId=new Map();
  for(const station of stations){
    byId.set(station.id,station);
    for(const program of station.schedule||[]){
      const stop=Date.parse(program.stop);
      if(Number.isFinite(stop)&&stop>lastStop&&stop>start)lastStop=stop;
    }
  }
  // The backend retains eight hours of programmes. Do not invent an entire
  // day of empty slots when the provider has less data.
  const usableEnd=Math.max(start+TP_WIDE_TWO_HOURS,Math.min(lastStop,horizon));
  const slots=Math.max(4,Math.ceil((usableEnd-start)/TP_WIDE_SLOT_MS));
  const end=start+slots*TP_WIDE_SLOT_MS;
  const viewport=scroll.clientWidth||this.getBoundingClientRect?.().width||838;
  const channelWidth=viewport<360?134:viewport<580?148:198;
  const slotWidth=Math.max(1,(viewport-channelWidth)/4);
  const totalWidth=slotWidth*slots;
  const previousSlot=this._tpWideSlotWidth;
  const previousX=scroll.scrollLeft;
  this._tpWideSlotWidth=slotWidth;
  this._tpWideStart=start;
  this._tpWideEnd=end;
  scroll.classList.toggle('tp-wide-tight',channelWidth<198);
  scroll.style.setProperty('--tp-channel-width',`${channelWidth}px`);
  scroll.style.setProperty('--tp-slot-width',`${slotWidth}px`);
  scroll.style.setProperty('--tp-slot-count',String(slots));
  scroll.style.setProperty('--tp-total-width',`${totalWidth}px`);
  head.replaceChildren(...Array.from({length:slots},(_,i)=>tpWideNode('div','time',tpWideClock(start+i*TP_WIDE_SLOT_MS))));
  const channelByNumber=new Map(this._channels().map(channel=>[String(channel.number),channel]));
  for(const row of rows.children){
    const number=row.querySelector?.('.ch-num')?.textContent;
    if(!number)continue;
    const channel=channelByNumber.get(String(number));
    const timeline=row.querySelector?.('.timeline');
    if(!channel||!timeline)continue;
    const station=byId.get(channel.epg_id);
    const programmes=(station?.schedule||[]).filter(p=>{
      const from=Date.parse(p.start),to=Date.parse(p.stop);
      return Number.isFinite(from)&&Number.isFinite(to)&&from<to&&to>start&&from<end;
    });
    if(!programmes.length){
      // Preserve original no-match and optional HA programme-sensor messages.
      const currentLine=timeline.querySelector?.('.now');
      if(currentLine)currentLine.style.left=`${100*(now-start)/(end-start)}%`;
      continue;
    }
    timeline.replaceChildren();
    const current=programmes.find(p=>Date.parse(p.start)<=now&&now<Date.parse(p.stop));
    const chNow=row.querySelector?.('.ch-now');
    if(chNow)chNow.textContent=current?.title||channel.category||'';
    for(const program of programmes){
      const from=Date.parse(program.start),to=Date.parse(program.stop);
      const clippedStart=Math.max(start,from),clippedEnd=Math.min(end,to);
      if(clippedEnd<=clippedStart)continue;
      const live=from<=now&&now<to;
      const block=this._btn('',()=>{
        if(live)this._play('channel',channel.number);
        else if(this._selected)this._selected.textContent=`${channel.name} · ${program.title} · ${tpWideClock(program.start)}–${tpWideClock(program.stop)} (upcoming)`;
      },'programme'+(live?' live':''));
      block.style.left=`${100*(clippedStart-start)/(end-start)}%`;
      block.style.width=`${100*(clippedEnd-clippedStart)/(end-start)}%`;
      block.append(tpWideNode('strong','',program.title),tpWideNode('small','',`${tpWideClock(program.start)}–${tpWideClock(program.stop)}`));
      block.title=`${channel.name}: ${program.title}`;
      timeline.appendChild(block);
    }
    const marker=tpWideNode('span','now');
    marker.style.left=`${100*(now-start)/(end-start)}%`;
    timeline.appendChild(marker);
  }
  // Preserve which *time* the viewer was looking at if the dashboard resizes.
  if(previousSlot&&Math.abs(previousSlot-slotWidth)>0.5){
    scroll.scrollLeft=previousX*slotWidth/previousSlot;
  }
  this._tpUpdateWideControls?.();
};
TP_WIDE_CARD.prototype._tpUpdateWideControls = function () {
  const scroll=this._scroll;
  if(!scroll)return;
  if(this._tpWideEarlier)this._tpWideEarlier.disabled=scroll.scrollLeft<5;
  if(this._tpWideLater)this._tpWideLater.disabled=scroll.scrollLeft+scroll.clientWidth>=scroll.scrollWidth-5;
};
const tpPreviousWideSetConfig=TP_WIDE_CARD.prototype.setConfig;
TP_WIDE_CARD.prototype.setConfig=function(config){
  tpPreviousWideSetConfig.call(this,config);
  const root=this.shadowRoot;
  if(root&&!root.querySelector('#tp-wide-epg-v0316')){
    const style=tpWideNode('style');
    style.id='tp-wide-epg-v0316';
    style.textContent=TP_WIDE_CSS;
    root.appendChild(style);
  }
  if(this._guidePanel&&!this._tpWideLater){
    const info=this._guidePanel.querySelector('.guide-info');
    if(info){
      const controls=tpWideNode('span','tp-wide-controls');
      const make=(text,title,onClick)=>{
        const btn=this._btn(text,onClick,'btn');
        btn.title=title;
        btn.setAttribute('aria-label',title);
        controls.appendChild(btn);
        return btn;
      };
      const page=direction=>this._scroll?.scrollBy({left:direction*this._tpWideSlotWidth*4,behavior:'smooth'});
      this._tpWideEarlier=make('◀','Earlier programmes',()=>page(-1));
      make('Now','Return to current programmes',()=>this._scroll?.scrollTo({left:0,behavior:'smooth'}));
      this._tpWideLater=make('▶','Later programmes',()=>page(1));
      info.appendChild(controls);
    }
  }
  const scroll=this._scroll;
  if(scroll&&this._tpWideObservedScroll!==scroll){
    this._tpWideObservedScroll=scroll;
    scroll.addEventListener('scroll',()=>this._tpUpdateWideControls(),{passive:true});
    this._tpWideObserver?.disconnect();
    if(typeof ResizeObserver!=='undefined'){
      this._tpWideObserver=new ResizeObserver(()=>{
        const width=scroll.clientWidth;
        if(width&&Math.abs(width-(this._tpWideViewport||0))>1){
          this._tpWideViewport=width;
          this._renderGuide();
        }
      });
      this._tpWideObserver.observe(scroll);
    }
  }
  root?.querySelector('.tp-version-badge')?.replaceChildren('Card v0.3.16');
  this._tpUpdateWideControls();
};
