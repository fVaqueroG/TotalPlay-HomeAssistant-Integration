/* Totalplay v0.3.68: Android Back navigates the card, not the decoder. */
(() => {
  const Card = customElements.get('totalplay-stb-card');
  const Popup = customElements.get('totalplay-stb-popup-card');
  if (!Card || !Popup) throw new Error('Totalplay mobile Back: card or popup unavailable');
  const mobile = () => navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches;
  const stack = () => (window.__fvHaCardBackStack ||= []);
  const nested = card => !!card && (!!card._remoteOpen || card._tab === 'apps');
  function step(card) {
    if (!card) return false;
    if (card._remoteOpen) {
      card._toggleRemote?.(false);
      // The remote can be a foreground portal; leave its own cancellation handler intact.
      if (card._remoteOpen) { card._remoteOpen=false; if (card._remote) card._remote.hidden=true; }
      return true;
    }
    if (card._tab === 'apps') { card._switch('guide'); return true; }
    return false;
  }
  function bridge(isOpen, onBack) {
    const id = 'totalplay-' + Math.random().toString(36).slice(2);
    let active=false, armed=false, url='';
    const top=()=>stack()[stack().length-1]===api;
    const arm=()=>{
      if(!active || armed || !isOpen())return;
      try{history.pushState({...(history.state||{}),__fvHaCardBackId:id},'',location.href);armed=true;}
      catch(error){console.warn('Totalplay mobile Back history unavailable',error);}
    };
    const pop=event=>{
      if(!active || !armed || !top() || !isOpen())return;
      if(history.state?.__fvHaCardBackId===id)return;
      armed=false;
      if(location.href!==url){api.stop(false);return;}
      event.stopImmediatePropagation();
      onBack();
      if(isOpen())arm();else api.stop(false);
    };
    const api={
      start(){
        if(active || !mobile() || !isOpen())return;
        active=true;url=location.href;stack().push(api);
        window.addEventListener('popstate',pop,true);arm();
      },
      stop(rewind=true){
        if(!active)return;
        active=false;window.removeEventListener('popstate',pop,true);
        const owners=stack(),index=owners.indexOf(api);if(index>=0)owners.splice(index,1);
        if(rewind && armed && history.state?.__fvHaCardBackId===id){armed=false;history.back();}
        armed=false;
      }
    };
    return api;
  }
  const priorOpen=Popup.prototype._openPopup;
  Popup.prototype._openPopup=function(...args){
    const result=priorOpen.apply(this,args);
    const dialog=this._dialog;
    if(!dialog || dialog._tpMobileBackBound)return result;
    dialog._tpMobileBackBound=true;
    const back=()=>{if(!step(this._popupCard))dialog.close();};
    dialog.addEventListener('cancel',event=>{event.preventDefault();back();});
    this._tpMobileBackBridge=bridge(()=>this._dialog===dialog && dialog.open,back);
    this._tpMobileBackBridge.start();
    dialog.addEventListener('close',()=>{this._tpMobileBackBridge?.stop();this._tpMobileBackBridge=null;},{once:true});
    return result;
  };
  const priorCleanup=Popup.prototype._cleanupPopup;
  Popup.prototype._cleanupPopup=function(...args){
    this._tpMobileBackBridge?.stop();this._tpMobileBackBridge=null;
    return priorCleanup.apply(this,args);
  };
  // Full card may be embedded directly on a dashboard without a popup.
  const sync=card=>{
    if(!mobile() || !card.isConnected || card.closest('.tp-stb-popup-body'))return;
    if(nested(card)){
      if(!card._tpMobileBackBridge)card._tpMobileBackBridge=bridge(()=>card.isConnected&&nested(card),()=>step(card));
      card._tpMobileBackBridge.start();
    }else{card._tpMobileBackBridge?.stop();card._tpMobileBackBridge=null;}
  };
  const priorSwitch=Card.prototype._switch;
  Card.prototype._switch=function(...args){const result=priorSwitch.apply(this,args);sync(this);return result;};
  const priorRemote=Card.prototype._toggleRemote;
  Card.prototype._toggleRemote=function(...args){const result=priorRemote.apply(this,args);sync(this);return result;};
  const priorConnected=Card.prototype.connectedCallback;
  Card.prototype.connectedCallback=function(...args){const result=priorConnected?.apply(this,args);sync(this);return result;};
  const priorDisconnected=Card.prototype.disconnectedCallback;
  Card.prototype.disconnectedCallback=function(...args){
    this._tpMobileBackBridge?.stop();this._tpMobileBackBridge=null;
    return priorDisconnected?.apply(this,args);
  };
})();
