/* Totalplay v0.3.69: coordinate Android Back through loading and popup teardown. */
(() => {
  const Card = customElements.get('totalplay-stb-card');
  const Popup = customElements.get('totalplay-stb-popup-card');
  if (!Card || !Popup) throw new Error('Totalplay Back: card not registered');
  const mobile = () => navigator.maxTouchPoints > 0 || matchMedia('(pointer:coarse)').matches;
  /* SHARED_BACK_MANAGER */
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
