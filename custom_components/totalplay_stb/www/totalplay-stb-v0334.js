/* v0.3.34: Refresh linked-TV source feedback after delayed HA state updates.
 * The TV's reported source, not a successful select_source call, confirms HDMI.
 */
import './totalplay-stb-v0333.js?v=0.3.34';

const TP_34_CARD = customElements.get('totalplay-stb-card');
if (!TP_34_CARD) throw new Error('Totalplay card unavailable');

function tp34SameSource(actual, target) {
  const a = String(actual || '').trim().toLowerCase();
  const b = String(target || '').trim().toLowerCase();
  return a === b || (a.startsWith('hdmi') && b.startsWith('hdmi') &&
    a.replace(/\s+/g, '') === b.replace(/\s+/g, ''));
}

const tp34PreviousTVStatus = TP_34_CARD.prototype._tvStatus;
TP_34_CARD.prototype._tvStatus = function () {
  tp34PreviousTVStatus.call(this);
  const decoder = this._hass?.states?.[this._config?.entity];
  const linked = decoder?.attributes?.connected_tv_entity;
  const desired = decoder?.attributes?.connected_tv_source;
  const state = linked && this._hass?.states?.[linked];
  if (!state || !desired || !this._tv ||
      ['off', 'unknown', 'unavailable'].includes(state.state)) return;
  const reported = state.attributes?.source;
  const check = decoder.attributes?.tv_input_check;
  if (typeof reported === 'string' && reported.trim()) {
    // The older renderer compares exact labels; "HDMI2" and "HDMI 2" are
    // the same physical input even if the integration formats them differently.
    if (tp34SameSource(reported, desired)) {
      this._tv.textContent = `TV input confirmed: ${reported}`;
      this._tv.title = `Reported by linked display ${linked}`;
    }
    return;
  }
  this._tv.textContent = check === 'checking'
    ? `Checking TV input · target ${desired}`
    : check === 'switch_unconfirmed'
      ? `TV input not reported · requested ${desired}`
      : `TV input not reported · target ${desired}`;
  this._tv.title = `${linked} is not reporting its current input. The Totalplay card cannot confirm HDMI until that TV entity exposes a source.`;
};

const tp34PreviousPowerStatus = TP_34_CARD.prototype._updatePowerHelper;
TP_34_CARD.prototype._updatePowerHelper = function () {
  tp34PreviousPowerStatus.call(this);
  const warning = this._tpInputWarning;
  if (!warning) return;
  const decoder = this._hass?.states?.[this._config?.entity];
  const linked = decoder?.attributes?.connected_tv_entity;
  const desired = decoder?.attributes?.connected_tv_source;
  const state = linked && this._hass?.states?.[linked];
  const actual = state?.attributes?.source;
  const check = decoder?.attributes?.tv_input_check;
  if (typeof actual === 'string' && tp34SameSource(actual, desired) && desired) {
    // A real, newly reported source supersedes a stale backend warning.
    warning.textContent = '';
    warning.hidden = true;
  } else if (check === 'checking') {
    warning.textContent = 'Checking the TV-reported HDMI input…';
    warning.hidden = false;
  } else if (check === 'source_mismatch' && typeof actual === 'string' && actual.trim()) {
    warning.textContent = `TV reports ${actual}; configured Totalplay input is ${desired}`;
    warning.hidden = false;
  }
};

const tp34PreviousSetConfig = TP_34_CARD.prototype.setConfig;
TP_34_CARD.prototype.setConfig = function (config) {
  tp34PreviousSetConfig.call(this, config);
  this.shadowRoot?.querySelector('.tp-version-badge')?.replaceChildren('v0.3.34');
  this._tvStatus();
  this._updatePowerHelper();
};
