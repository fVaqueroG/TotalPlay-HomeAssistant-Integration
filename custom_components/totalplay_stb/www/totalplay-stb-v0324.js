/* v0.3.24: Show mosaics/audio/music as full-width tiles, report only real
 * guide-eligible channels, narrow the sticky column and clarify TV feedback.
 * Keep Totalplay's official catalog and every existing remote/EPG control.
 */
import './totalplay-stb-v0323.js?v=0.3.24';

const TP_24_CARD = customElements.get('totalplay-stb-card');
if (!TP_24_CARD) throw new Error('Totalplay card unavailable');

// Includes regular TV music stations at the owner's request (not just the
// Stingray Audio package); mosaic channel 700 is counted only once.
const tp24NoEpg = channel => channel?.type === 'M' ||
  ['audio', 'musica'].includes(String(channel?.category || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').trim().toLowerCase());
const TP_24_NO_EPG_ID = '__totalplay_no_epg__';

// Prevent the inherited guide and the automatic matcher from looking up
// programme schedules for mosaic/audio/music entries at any render stage.
const tp24PreviousChannels = TP_24_CARD.prototype._channels;
TP_24_CARD.prototype._channels = function () {
  const channels = tp24PreviousChannels.call(this);
  return channels.map(ch => tp24NoEpg(ch) ? {...ch, epg_id: TP_24_NO_EPG_ID} : ch);
};

const TP_24_CSS = `
/* Reclaim unused width in the old 246px channel column. */
.guide-scroll .grow:not(.head) .ch{gap:5px!important;padding:6px!important}
.guide-scroll .grow:not(.head) .ch-num{flex-basis:19px!important;width:19px!important;
  min-width:19px!important;font-size:12px!important}
.guide-scroll .grow:not(.head) .tp-channel-stack{gap:2px!important}
.guide-scroll .grow:not(.head) .ch-logo{width:94px!important;height:58px!important}
.guide-scroll .grow:not(.head) .ch-name{font-size:12px!important;line-height:1.15!important}
.guide-scroll .grow:not(.head) .ch-now{font-size:10.5px!important;line-height:1.15!important}
/* The special channel button spans the entire visible card, with no fake
   programme timeline. Sticky positioning keeps it visible when scrolling time. */
.guide-scroll .grow.tp24-full-row{min-height:82px!important}
.guide-scroll .grow.tp24-full-row .ch.tp24-full-button{
  position:sticky!important;left:0!important;z-index:4!important;
  width:var(--tp24-viewport,100%)!important;max-width:var(--tp24-viewport,100%)!important;
  flex:0 0 var(--tp24-viewport,100%)!important;min-height:82px!important;
  box-sizing:border-box!important;border:0!important;border-bottom:1px solid var(--tp-line)!important;
  display:flex!important;align-items:center!important;gap:12px!important;
  padding:7px 14px!important;text-align:left!important}
.guide-scroll .grow.tp24-full-row .ch-num{
  flex:0 0 29px!important;width:29px!important;min-width:29px!important;
  text-align:center!important;font-size:13px!important}
.guide-scroll .grow.tp24-full-row .tp-channel-stack{
  flex:1 1 auto!important;min-width:0!important;display:flex!important;
  flex-direction:row!important;justify-content:flex-start!important;
  align-items:center!important;gap:14px!important;text-align:left!important}
.guide-scroll .grow.tp24-full-row .ch-logo{
  flex:0 0 100px!important;width:100px!important;height:61px!important;
  max-width:100px!important;margin:0!important}
.guide-scroll .grow.tp24-full-row .ch-details{
  flex:1 1 auto!important;display:flex!important;flex-direction:column!important;
  align-items:flex-start!important;text-align:left!important;gap:4px!important;min-width:0!important}
.guide-scroll .grow.tp24-full-row .ch-name,
.guide-scroll .grow.tp24-full-row .ch-now{
  width:auto!important;max-width:100%!important;text-align:left!important}
.guide-scroll .grow.tp24-full-row .ch-name{font-size:14px!important}
.guide-scroll .grow.tp24-full-row .ch-now{font-size:12px!important}
.guide-scroll .grow.tp24-full-row .tp24-kind{
  margin-left:auto!important;border:1px solid var(--tp-line);border-radius:8px;
  padding:6px 10px;color:var(--tp-sub);font-size:11px;white-space:nowrap}
@media(max-width:580px){
  .guide-scroll .grow:not(.head) .ch-logo{width:75px!important;height:47px!important}
  .guide-scroll .grow.tp24-full-row .ch.tp24-full-button{gap:6px!important;padding:6px 8px!important}
  .guide-scroll .grow.tp24-full-row .ch-num{flex-basis:23px!important;width:23px!important;min-width:23px!important}
  .guide-scroll .grow.tp24-full-row .tp-channel-stack{gap:8px!important}
  .guide-scroll .grow.tp24-full-row .ch-logo{flex-basis:75px!important;width:75px!important;height:48px!important}
  .guide-scroll .grow.tp24-full-row .tp24-kind{display:none!important}
  .guide-scroll .grow.tp24-full-row .ch-name{font-size:12px!important}
}
`;

const tp24PreviousRender = TP_24_CARD.prototype._renderGuide;
TP_24_CARD.prototype._renderGuide = function () {
  tp24PreviousRender.call(this);
  const scroll=this._scroll, rows=this._rows;
  if (!scroll || !rows || !this._tpOfficialCatalog) return;
  const viewport=scroll.clientWidth || this.getBoundingClientRect?.().width || 838;
  const oldSlot=this._tpWideSlotWidth || 0;
  const oldX=scroll.scrollLeft;
  // 246px in v0.3.22 left an oversized empty channel column. A narrower
  // adaptive column preserves the 94px logo and stacked name/category.
  const columnWidth=viewport < 385 ? 151 : viewport < 580 ? 162 : viewport < 820 ? 177 : 188;
  const slotWidth=Math.max(1,(viewport-columnWidth)/4);
  const slots=Math.max(4,Number(scroll.style.getPropertyValue('--tp-slot-count'))||4);
  scroll.style.setProperty('--tp-channel-width',`${columnWidth}px`);
  scroll.style.setProperty('--tp-slot-width',`${slotWidth}px`);
  scroll.style.setProperty('--tp-total-width',`${slotWidth*slots}px`);
  scroll.style.setProperty('--tp24-viewport',`${viewport}px`);
  this._tpWideSlotWidth=slotWidth;

  const byNumber=this._tpOfficialCatalog.byNumber;
  for (const row of [...rows.children]) {
    const button=row.querySelector?.('.ch');
    const number=button?.querySelector('.ch-num')?.textContent;
    const entry=byNumber.get(String(number));
    if (!entry || !tp24NoEpg(entry) || !button) continue;
    row.classList.add('tp24-full-row');
    button.classList.add('tp24-full-button');
    row.replaceChildren(button); // Preserve click-to-tune, official logo and text.
    const label=document.createElement('span');
    label.className='tp24-kind';
    label.textContent=entry.type==='M'?'Mosaico':entry.category;
    button.appendChild(label);
    button.title=`Channel ${entry.number} · ${entry.name}`;
  }
  // The legacy renderer scales the time scroll with its own old slot size;
  // preserve the requested viewing time again after shrinking the column.
  if(oldSlot>0)scroll.scrollLeft=oldX*slotWidth/oldSlot;
  this._tpUpdateWideControls?.();

  if (this._guideStatus && this._guide && !this._guide.error) {
    const all=this._channels();
    const eligible=all.filter(ch=>!tp24NoEpg(ch));
    const stations=new Map((this._guide.channels||[]).map(st=>[st.id,st]));
    const now=Date.now();
    const matched=eligible.filter(ch=>stations.has(ch.epg_id));
    const scheduled=matched.filter(ch=>(stations.get(ch.epg_id)?.schedule||[]).some(p=>
      Date.parse(p.start)<now+8*3600000 && Date.parse(p.stop)>now));
    const excluded=all.length-eligible.length;
    const sources=this._guide.sources?.length || (this._guide.source_name?1:0);
    this._guideStatus.textContent=
      `${scheduled.length} of ${eligible.length} guide-eligible channels have upcoming programmes · `+
      `${matched.length} station matches · ${excluded} Audio/Música/Mosaico channels excluded from EPG · `+
      `${stations.size} XMLTV stations · ${sources} EPG source${sources===1?'':'s'}.`;
  }
};

// 'Music Assistant Queue' is the *reported source of the linked media player*,
// not a verified TV input. Avoid implying that HDMI 2 is currently selected.
TP_24_CARD.prototype._tvStatus=function(){
  if(!this._tv||!this._hass)return;
  const decoder=this._hass.states[this._config?.entity];
  if(!decoder){this._tv.textContent='Select the Totalplay decoder in the card editor';return;}
  const linked=decoder.attributes?.connected_tv_entity;
  const desired=decoder.attributes?.connected_tv_source;
  const state=linked?this._hass.states[linked]:null;
  const actual=state?.attributes?.source;
  if(!linked||!desired){this._tv.textContent='Decoder configured · TV input not linked';return;}
  if(!state||['unavailable','unknown'].includes(state.state)){
    this._tv.textContent=`Linked TV unavailable · target ${desired}`;return;
  }
  if(state.state==='off'){
    this._tv.textContent=`Linked TV is off · target ${desired}`;return;
  }
  if(typeof actual==='string'&&actual.trim().toLowerCase()===String(desired).trim().toLowerCase()){
    this._tv.textContent=`TV input confirmed: ${actual}`;return;
  }
  const fromMusic= /music[ _-]?assistant/i.test(String(actual||''))||
    /music[ _-]?assistant/i.test(String(linked||''));
  if(fromMusic){
    this._tv.textContent=`TV input not verified · linked player reports ${actual||'Music Assistant'} · target ${desired}`;
    this._tv.title=`Review the linked display entity in Totalplay integration options. It should be the physical TV, not a Music Assistant queue. Linked entity: ${linked}`;
    return;
  }
  const available=state.attributes?.source_list;
  if(Array.isArray(available)&&!available.some(src=>
    typeof src==='string'&&src.trim().toLowerCase()===String(desired).trim().toLowerCase())){
    this._tv.textContent=`Linked player cannot confirm ${desired} · reports ${actual||'unknown input'}`;
    this._tv.title=`Check the linked physical TV entity in Totalplay integration options: ${linked}`;
    return;
  }
  this._tv.textContent=actual?`TV input: ${actual} · target ${desired}`:`TV input unknown · target ${desired}`;
};

const tp24PreviousSetConfig=TP_24_CARD.prototype.setConfig;
TP_24_CARD.prototype.setConfig=function(config){
  tp24PreviousSetConfig.call(this,config);
  const root=this.shadowRoot;
  if(root&&!root.querySelector('#tp24-guide-css')){
    const style=document.createElement('style');style.id='tp24-guide-css';
    style.textContent=TP_24_CSS;root.appendChild(style);
  }
  const badge=root?.querySelector('.tp-version-badge');
  if(badge)badge.textContent='v0.3.24';
  this._tvStatus();
  this._renderGuide();
};
