/* v0.3.36: Source checks disabled at owner's request.
 * Keep the configured HDMI target and power helper without reading live TV
 * source or displaying unverifiable input status/warnings.
 */
import './totalplay-stb-v0335.js?v=0.3.36';

const TP_36_CARD = customElements.get('totalplay-stb-card');
if (!TP_36_CARD) throw new Error('Totalplay card unavailable');

TP_36_CARD.prototype._tp35ShowLiveSource = function () {
  if (!this._config || !this._hass || !this._tv) return;
  const decoder = this._hass.states?.[this._config.entity];
  const target = decoder?.attributes?.connected_tv_source;
  this._tv.textContent = target ? `TV target: ${target}` : 'TV input not linked';
  this._tv.title = target
    ? `Configured Totalplay input: ${target}. Input requests are sent without checking the TV's current source.`
    : 'Configure a connected TV and HDMI input in the Totalplay integration options.';
  if (this._tpInputWarning) {
    this._tpInputWarning.textContent = '';
    this._tpInputWarning.hidden = true;
  }
};

// Override the old checks rather than calling through to them: older modules
// read the TV's source and may display stale confirmation warnings.
TP_36_CARD.prototype._tvStatus = function () {
  this._tp35ShowLiveSource();
};

TP_36_CARD.prototype._updatePowerHelper = function () {
  const button = this._tpPowerButton;
  if (button) {
    const id = this._linkedPowerEntity?.();
    const state = id && this._hass?.states?.[id]?.state;
    const known = state === 'on' || state === 'off';
    button.hidden = !id;
    button.disabled = Boolean(this._tpPowerBusy) || !known;
    button.classList.toggle('on', state === 'on');
    button.title = !id ? '' : !known ? `Power helper ${id} unavailable` :
      `${state === 'on' ? 'Turn off' : 'Turn on'} Totalplay power helper (${id})`;
    button.setAttribute('aria-label', button.title);
    button.setAttribute('aria-pressed', String(state === 'on'));
    this._tpPowerIcon?.setAttribute('icon', state === 'on' ? 'mdi:power-plug' : 'mdi:power-plug-off');
  }
  this._tp35ShowLiveSource();
};

const tp36PreviousConfig = TP_36_CARD.prototype.setConfig;
TP_36_CARD.prototype.setConfig = function (config) {
  tp36PreviousConfig.call(this, config);
  this.shadowRoot?.querySelector('.tp-version-badge')?.replaceChildren('v0.3.36');
  this._tp35ShowLiveSource();
};
