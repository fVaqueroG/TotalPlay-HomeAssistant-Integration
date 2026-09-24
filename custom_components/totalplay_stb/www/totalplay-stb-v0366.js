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
  font-family:inherit;font-size:13px;font-weight:700;line-height:1.2;cursor:pointer;white-space:nowrap;
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
  if (!card.closest('.tp-stb-popup-body') && document.scrollingElement)
    tp66UniquePush(list,document.scrollingElement);
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
      if (typeof node.scrollTo==='function') node.scrollTo({top:0,left:node.scrollLeft,behavior:'smooth'});
      else node.scrollTop=0;
    } else {
      card.scrollIntoView({behavior:'smooth',block:'start'});
    }
  }
  tp66Schedule(card);
}
function tp66Observe(card) {
  // Scroll events from the card's shadow root are not guaranteed to
  // reach window listeners. Watch the actual guide, apps and popup
  // containers and replace listeners when setConfig rebuilds them.
  const nodes=[card._scroll,card._appsPanel,
    card._appsPanel?.querySelector('.apps-only'),
    card.shadowRoot?.querySelector('.main > .apps-only:not(.hidden)'),
    card.closest('.tp-stb-popup-body')].filter(Boolean);
  const previous=card._tp66Nodes||[];
  const callback=card._tp66ScrollListenerLocal ||
    (card._tp66ScrollListenerLocal=()=>tp66Schedule(card));
  for(const node of previous) if(!nodes.includes(node))
    node.removeEventListener('scroll',callback);
  for(const node of nodes) if(!previous.includes(node))
    node.addEventListener('scroll',callback,{passive:true});
  card._tp66Nodes=nodes;
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
  tp66Observe(card);
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
  this.shadowRoot?.querySelector('.tp-version-badge')?.replaceChildren('v0.3.69');
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
  tp66Observe(this);tp66Schedule(this);
  return result;
};
const tp66OriginalDisconnect=TP66_CARD.prototype.disconnectedCallback;
TP66_CARD.prototype.disconnectedCallback=function() {
  if (this._tp66ScrollListener) {
    window.removeEventListener('scroll',this._tp66ScrollListener,true);
    window.removeEventListener('resize',this._tp66ScrollListener);
    this._tp66ScrollListener=null;
  }
  for (const node of this._tp66Nodes||[])
  node.removeEventListener('scroll',this._tp66ScrollListenerLocal);
this._tp66Nodes=[];
if (this._tp66Frame) cancelAnimationFrame(this._tp66Frame);
  this._tp66Frame=0;
  tp66OriginalDisconnect?.call(this);
};

/* Totalplay v0.3.69: coordinate Android Back through loading and popup teardown. */
(() => {
  const Card = customElements.get('totalplay-stb-card');
  const Popup = customElements.get('totalplay-stb-popup-card');
  if (!Card || !Popup) throw new Error('Totalplay Back: card not registered');
  const mobile = () => navigator.maxTouchPoints > 0 || matchMedia('(pointer:coarse)').matches;
  const manager = window.__fvHaCardBackManagerV2 ||= (() => {
    const owners = [];
    let token = null, url = null, armed = false, unwinding = false;
    let handling = false, requested = false, lastHandled = 0;
    const current = () => armed && history.state?.__fvCardBackV2 === token;
    const disarm = () => {
      if (owners.length || unwinding) return;
      armed = false; requested = false;
      window.removeEventListener('popstate', onPop, true);
    };
    const arm = () => {
      if (!owners.length || armed || unwinding) return;
      url = location.href;
      token = 'fv-back-' + Math.random().toString(36).slice(2);
      try {
        history.pushState({ ...(history.state || {}), __fvCardBackV2: token }, '', url);
        armed = true; requested = false;
      } catch (error) { console.warn('Card Back: history protection unavailable', error); }
    };
    const unwind = () => {
      if (owners.length || unwinding) return;
      if (!current()) { disarm(); return; }
      unwinding = true;
      requested = false;
      try { history.back(); } catch (error) { unwinding = false; disarm(); }
    };
    function onPop(event) {
      if (unwinding) {
        if (location.href === url) event.stopImmediatePropagation();
        unwinding = false; armed = false; requested = false;
        if (owners.length) arm(); else disarm();
        return;
      }
      if (!armed || !owners.length) return;
      if (location.href !== url) { // A genuine Home Assistant route change, not a card Back action.
        owners.length = 0; armed = false; requested = false; disarm(); return;
      }
      event.stopImmediatePropagation();
      requested = false; lastHandled = Date.now();
      // The browser may have popped into an older guard after an HA history update.
      armed = history.state?.__fvCardBackV2 === token;
      const owner = owners[owners.length - 1];
      handling = true;
      try { owner.back(); } finally { handling = false; }
      if (owners.length) { if (!armed) arm(); }
      else if (armed) unwind(); else disarm();
    }
    return {
      add(owner) {
        if (!mobile() || owners.includes(owner)) return;
        if (!owners.length && !unwinding) window.addEventListener('popstate', onPop, true);
        owners.push(owner); arm();
      },
      remove(owner) {
        const index = owners.indexOf(owner);
        if (index < 0) return;
        owners.splice(index, 1);
        if (!owners.length && !handling) unwind();
      },
      request(owner) {
        if (!owners.length || owners[owners.length - 1] !== owner) return false;
        if (requested || Date.now() - lastHandled < 300) return true;
        if (current()) {
          requested = true;
          try { history.back(); } catch (error) { requested = false; owner.back(); }
        } else {
          lastHandled = Date.now();
          owner.back();
          if (owners.length && !armed) arm();
        }
        return true;
      },
    };
  })();

  const nested = card => !!card && (!!card._remoteOpen || card._tab === 'apps');
  function step(card) {
    if (!card) return false;
    if (card._remoteOpen) {
      card._toggleRemote?.(false);
      if (card._remoteOpen) {
        card._remoteOpen = false;
        if (card._remote) card._remote.hidden = true;
      }
      return true;
    }
    if (card._tab === 'apps') { card._switch('guide'); return true; }
    return false;
  }
  const priorOpen = Popup.prototype._openPopup;
  Popup.prototype._openPopup = function (...args) {
    const result = priorOpen.apply(this, args);
    const dialog = this._dialog;
    if (!dialog || this._fvBackOwner) return result;
    const owner = { back: () => {
      if (step(this._popupCard)) return;
      manager.remove(owner);
      if (this._fvBackOwner === owner) this._fvBackOwner = null;
      if (dialog.open) dialog.close();
    } };
    this._fvBackOwner = owner;
    dialog.addEventListener('cancel', event => {
      event.preventDefault();
      if (!manager.request(owner)) owner.back();
    });
    dialog.addEventListener('close', () => {
      manager.remove(owner);
      if (this._fvBackOwner === owner) this._fvBackOwner = null;
    }, { once:true });
    manager.add(owner);
    return result;
  };
  const priorCleanup = Popup.prototype._cleanupPopup;
  Popup.prototype._cleanupPopup = function (...args) {
    if (this._fvBackOwner) { manager.remove(this._fvBackOwner); this._fvBackOwner = null; }
    return priorCleanup.apply(this, args);
  };
  const sync = card => {
    if (!mobile() || !card.isConnected || card.closest('.tp-stb-popup-body')) return;
    if (nested(card)) {
      if (!card._fvBackOwner) card._fvBackOwner = { back: () => step(card) };
      manager.add(card._fvBackOwner);
    } else if (card._fvBackOwner) { manager.remove(card._fvBackOwner); card._fvBackOwner = null; }
  };
  const priorSwitch = Card.prototype._switch;
  Card.prototype._switch = function (...args) { const result = priorSwitch.apply(this,args); sync(this); return result; };
  const priorRemote = Card.prototype._toggleRemote;
  Card.prototype._toggleRemote = function (...args) { const result = priorRemote.apply(this,args); sync(this); return result; };
  const priorConnected = Card.prototype.connectedCallback;
  Card.prototype.connectedCallback = function (...args) { const result = priorConnected?.apply(this,args); sync(this); return result; };
  const priorDisconnect = Card.prototype.disconnectedCallback;
  Card.prototype.disconnectedCallback = function (...args) {
    if (this._fvBackOwner) { manager.remove(this._fvBackOwner); this._fvBackOwner = null; }
    return priorDisconnect?.apply(this,args);
  };
})();
