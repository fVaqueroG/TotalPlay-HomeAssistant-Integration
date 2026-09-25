/* Totalplay v0.3.75 — mobile popup viewport anchoring.
 * Keep the modal in the visible Android/browser viewport even when the HA
 * dashboard is scrolled. Prevent focus from scrolling the underlying page.
 */
import './totalplay-stb-v0374.js?v=0.3.75';

const TP75_POPUP=customElements.get('totalplay-stb-popup-card');
const TP75_FULL=customElements.get('totalplay-stb-card');
if(!TP75_POPUP||!TP75_FULL)throw new Error('Totalplay popup components unavailable');

const TP75_CSS=`
dialog.tp-stb-popup-dialog{
  position:fixed!important;
  box-sizing:border-box!important;
}
@media(max-width:600px),(pointer:coarse){
  dialog.tp-stb-popup-dialog,
  dialog.tp-stb-popup-dialog[data-fv-popup-size="normal"],
  dialog.tp-stb-popup-dialog[data-fv-popup-size="wide"],
  dialog.tp-stb-popup-dialog[data-fv-popup-size="fullscreen"]{
    position:fixed!important;
    inset:auto!important;
    left:var(--tp75-vv-left,0px)!important;
    top:var(--tp75-vv-top,0px)!important;
    width:var(--tp75-vv-width,100vw)!important;
    max-width:var(--tp75-vv-width,100vw)!important;
    height:var(--tp75-vv-height,100dvh)!important;
    max-height:var(--tp75-vv-height,100dvh)!important;
    margin:0!important;
    border:0!important;
    border-radius:0!important;
    transform:none!important;
  }
  dialog.tp-stb-popup-dialog .tp-stb-popup-body{
    overscroll-behavior:contain!important;
    overflow:auto!important;
  }
}
`;

function tp75Viewport(dialog){
  if(!dialog)return;
  const vv=window.visualViewport;
  const left=Math.max(0,Number(vv?.offsetLeft||0));
  const top=Math.max(0,Number(vv?.offsetTop||0));
  const width=Math.max(1,Number(vv?.width||window.innerWidth||document.documentElement.clientWidth||1));
  const height=Math.max(1,Number(vv?.height||window.innerHeight||document.documentElement.clientHeight||1));
  dialog.style.setProperty('--tp75-vv-left',left+'px');
  dialog.style.setProperty('--tp75-vv-top',top+'px');
  dialog.style.setProperty('--tp75-vv-width',width+'px');
  dialog.style.setProperty('--tp75-vv-height',height+'px');
}
function tp75Install(popup){
  const dialog=popup?._dialog;
  if(!dialog?.open)return;
  let css=dialog.querySelector('#tp75-mobile-popup-viewport');
  if(!css){
    css=document.createElement('style');
    css.id='tp75-mobile-popup-viewport';
    css.textContent=TP75_CSS;
    dialog.appendChild(css);
  }
  tp75Viewport(dialog);
  const body=dialog.querySelector('.tp-stb-popup-body');
  if(body)body.scrollTop=0;
  const sync=()=>tp75Viewport(dialog);
  popup._tp75ViewportSync=sync;
  window.visualViewport?.addEventListener('resize',sync,{passive:true});
  window.visualViewport?.addEventListener('scroll',sync,{passive:true});
  window.addEventListener('orientationchange',sync,{passive:true});
  requestAnimationFrame(()=>{
    tp75Viewport(dialog);
    body?.scrollTo?.({top:0,left:0,behavior:'auto'});
    const close=dialog.querySelector('.tp-stb-popup-close');
    try{close?.focus?.({preventScroll:true});}catch(_){/* Old WebViews. */}
    popup._popupCard?._tpQueueGuideFit?.();
  });
}
function tp75Remove(popup){
  const sync=popup?._tp75ViewportSync;
  if(!sync)return;
  window.visualViewport?.removeEventListener('resize',sync);
  window.visualViewport?.removeEventListener('scroll',sync);
  window.removeEventListener('orientationchange',sync);
  popup._tp75ViewportSync=null;
}

const tp75OldOpen=TP75_POPUP.prototype._openPopup;
TP75_POPUP.prototype._openPopup=function(...args){
  const beforeX=window.scrollX;
  const beforeY=window.scrollY;
  const result=tp75OldOpen.apply(this,args);
  const dialog=this._dialog;
  if(!dialog?.open)return result;
  tp75Install(this);
  // Some Android WebViews scroll the HA page when a newly-created dialog
  // focuses its close button. Restore the dashboard without moving the modal.
  queueMicrotask(()=>{
    if(Math.abs(window.scrollY-beforeY)>1||Math.abs(window.scrollX-beforeX)>1)
      window.scrollTo({left:beforeX,top:beforeY,behavior:'auto'});
    tp75Viewport(dialog);
  });
  return result;
};

const tp75OldCleanup=TP75_POPUP.prototype._cleanupPopup;
TP75_POPUP.prototype._cleanupPopup=function(...args){
  tp75Remove(this);
  return tp75OldCleanup.apply(this,args);
};

const tp75OldFullConfig=TP75_FULL.prototype.setConfig;
TP75_FULL.prototype.setConfig=function(config){
  const result=tp75OldFullConfig.call(this,config);
  this.shadowRoot?.querySelector('.tp-version-badge')?.replaceChildren('v0.3.75');
  return result;
};

console.info('TOTALPLAY MOBILE POPUP VIEWPORT v0.3.75');
