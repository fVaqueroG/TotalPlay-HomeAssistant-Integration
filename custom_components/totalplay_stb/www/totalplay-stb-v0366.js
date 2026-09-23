/* v0.3.66: One-click return to the beginning of long Totalplay lists.
 * Guide, Apps, popup body, and the surrounding dashboard have separate
 * scroll containers. Never reset horizontal EPG/time navigation or tune state.
 */
import './totalplay-stb-v0365.js?v=0.3.66';

const TP66_CARD = customElements.get('totalplay-stb-card');
if (!TP66_CARD) throw new Error('Totalplay card unavailable for back-to-top control');

const TP66_STYLE = `
.tp66-back-top {
  position:fixed;z-index:25;
  right:clamp(14px,2.7vw,32px);
  bottom:calc(18px + env(safe-area-inset-bottom,0px));
  display:inline-flex;align-items:center;justify-content:center;gap:7px;
  min-height:44px;min-width:44px;padding:10px 14px;border-radius:999px;
  border:1px solid var(--tp-line,var(--divider-color,#596176));
  background:var(--tp65-control,var(--tp-bg,var(--card-background-color,#242136)));
  color:var(--tp-ink,var(--primary-text-color,#fff));
  font:700 13px/1.2 inherit;cursor:pointer;white-space:nowrap;
  box-shadow:0 4px 16px #0006;touch-action:manipulation;
}
.tp66-back-top[hidden]{display:none!important}
.tp66-back-top:hover {border-color:var(--tp-blue,var(--primary-color,#ed407e));
  background:var(--tp65-active,color-mix(in srgb,var(--tp-blue,#ed407e) 15%,var(--tp-bg,#262435)))}
.tp66-back-top:focus-visible {outline:3px solid var(--tp-blue,var(--primary-color,#ed407e));outline-offset:3px}
:host([data-tp-light="yes"]) .tp66-back-top {
  background:#fff!important;color:#182436!important;border-color:#cbd6e5!important;
  box-shadow:0 4px 16px #18243635!important;
}
:host([data-tp-light="yes"]) .tp66-back-top:hover {background:#edf2fa!important;border-color:var(--tp-blue)!important}
@media(max-width:580px) {
  .tp66-back-top{right:12px;bottom:calc(12px + env(safe-area-inset-bottom,0px));padding:10px 12px}
}
`;
const tp66Scrollable = node => node && node.scrollHeight > node.clientHeight + 24;
const tp66UniquePush = (list,node) => {if(node && !list.includes(node))list.push(node);};
function tp66Targets(card) {
  const list=[];
  const active=card._tab === 'apps';
  if (active) {
    tp66UniquePush(list,card._appsPanel?.querySelector('.apps-only'));
    tp66UniquePush(list,card._appsPanel);
    tp66UniquePush(list,card.shadowRoot?.querySelector('.main > .apps-only:not(.hidden)'));
  } else {
    tp66UniquePush(list,card._scroll || card.shadowRoot?.querySelector('.guide-scroll'));
  }
  // A native popup can scroll its body independently of the channel guide.
  tp66UniquePush(list,card.closest('.tp-stb-popup-body'));
  // Some dashboards have a scrolling panel around the entire card. Only use
  // that when it actually scrolled; return to THIS card, not the dashboard top.
  let node=card;
  for (let i=0;i<14;i++) {
    const root=node.getRootNode?.();
    node=node.parentElement || (root && root.host) || null;
    if (!node || node===document.body || node===document.documentElement) break;
    if (node.scrollHeight > node.clientHeight + 24 &&
        /auto|scroll/.test(getComputedStyle(node).overflowY)) tp66UniquePush(list,node);
  }
  if (document.scrollingElement) tp66UniquePush(list,document.scrollingElement);
  return list.filter(tp66Scrollable);
}
function tp66Refresh(card) {
  const button=card._tp66Button;
  if (!button || !button.isConnected) return;
  const rect=card.getBoundingClientRect();
  const visible=rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
  button.hidden=!visible || !tp66Targets(card).some(node=>node.scrollTop > 180);
}
function tp66Schedule(card) {
  if (card._tp66Frame || !card._tp66Button) return;
  card._tp66Frame=requestAnimationFrame(()=>{
    card._tp66Frame=0;
    if (card.isConnected) tp66Refresh(card);
  });
}
function tp66BackToTop(card) {
  const cardScroller=card._tab==='apps' ? card._appsPanel : card._scroll;
  const popupBody=card.closest('.tp-stb-popup-body');
  for (const node of tp66Targets(card)) {
    if (node.scrollTop<=0) continue;
    const insideCard = node===cardScroller || card.contains(node) || card.shadowRoot?.contains(node);
    if (insideCard || node===popupBody) {
      if (typeof node.scrollTo==='function') node.scrollTo({top:0,behavior:'smooth'});
      else node.scrollTop=0;
    } else {
      card.scrollIntoView({behavior:'smooth',block:'start'});
    }
  }
  tp66Schedule(card);
}
function tp66Ensure(card) {
  const root=card.shadowRoot;
  if (!root) return;
  if (!root.querySelector('#tp66-back-to-top-css')) {
    const style=document.createElement('style');
    style.id='tp66-back-to-top-css';style.textContent=TP66_STYLE;root.appendChild(style);
  }
  let button=root.querySelector('#tp66-back-to-top');
  if (!button) {
    button=document.createElement('button');
    button.type='button';button.id='tp66-back-to-top';button.className='tp66-back-top';
    button.hidden=true;button.title='Back to the beginning of Totalplay';
    button.setAttribute('aria-label','Back to top of Totalplay');
    const arrow=document.createElement('span');arrow.setAttribute('aria-hidden','true');arrow.textContent='↑';
    const label=document.createElement('span');label.textContent='Top';
    button.append(arrow,label);
    button.addEventListener('click',()=>tp66BackToTop(card));
    root.appendChild(button);
  }
  card._tp66Button=button;
  if (card.isConnected && !card._tp66ScrollListener) {
    card._tp66ScrollListener=()=>tp66Schedule(card);
    // Capture non-bubbling scroll events from the guide, apps, popup and HA
    // dashboard without modifying or taking ownership of any scroll container.
    window.addEventListener('scroll',card._tp66ScrollListener,true);
    window.addEventListener('resize',card._tp66ScrollListener,{passive:true});
  }
  tp66Schedule(card);
}
const tp66OriginalConfig=TP66_CARD.prototype.setConfig;
TP66_CARD.prototype.setConfig=function(config) {
  const result=tp66OriginalConfig.call(this,config);
  tp66Ensure(this);
  this.shadowRoot?.querySelector('.tp-version-badge')?.replaceChildren('v0.3.66');
  return result;
};
const tp66OriginalConnect=TP66_CARD.prototype.connectedCallback;
TP66_CARD.prototype.connectedCallback=function() {
  tp66OriginalConnect?.call(this);
  if (this._config) tp66Ensure(this);
};
const tp66OriginalSwitch=TP66_CARD.prototype._switch;
if (tp66OriginalSwitch) TP66_CARD.prototype._switch=function(...args) {
  const result=tp66OriginalSwitch.apply(this,args);
  tp66Schedule(this);
  return result;
};
const tp66OriginalDisconnect=TP66_CARD.prototype.disconnectedCallback;
TP66_CARD.prototype.disconnectedCallback=function() {
  if (this._tp66ScrollListener) {
    window.removeEventListener('scroll',this._tp66ScrollListener,true);
    window.removeEventListener('resize',this._tp66ScrollListener);
    this._tp66ScrollListener=null;
  }
  if (this._tp66Frame) cancelAnimationFrame(this._tp66Frame);
  this._tp66Frame=0;
  tp66OriginalDisconnect?.call(this);
};
