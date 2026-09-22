/* v0.3.35: Display the live HA source of the configured physical TV.
 * Follow every HA state update, whether triggered by Totalplay, the TV remote,
 * another dashboard, or the TV integration. Never infer the input from a
 * successful select_source call or an unrelated media player's source.
 */
import './totalplay-stb-v0334.js?v=0.3.35';

const TP_35_CARD = customElements.get('totalplay-stb-card');
if (!TP_35_CARD) throw new Error('Totalplay card unavailable');

function tp35SameSource(actual, target) {
  const a = String(actual || '').trim().toLowerCase();
  const b = String(target || '').trim().toLowerCase();
  if (!a || !b) return false;
  if (a === b) return true;
  return /^hdmi\s*\d+$/.test(a) && /^hdmi\s*\d+$/.test(b) &&
    a.replace(/\s+/g, '') === b.replace(/\s+/g, '');
}

function tp35LiveState(card) {
  const decoder = card._hass?.states?.[card._config?.entity];
  const linked = decoder?.attributes?.connected_tv_entity || '';
  const target = decoder?.attributes?.connected_tv_source || '';
  const tv = linked ? card._hass?.states?.[linked] : null;
  const raw = tv?.attributes?.source;
  const source = typeof raw === 'string' && raw.trim() &&
    !['unknown', 'unavailable'].includes(raw.trim().toLowerCase()) ? raw.trim() : '';
  const name = tv?.attributes?.friendly_name || linked;
  return {linked, target, tv, source, name};
}

function tp35OtherDisplays(card, linked, target) {
  if (!target) return [];
  return Object.entries(card._hass?.states || {})
    .filter(([id, state]) => id.startsWith('media_player.') && id !== linked &&
      !['off', 'unavailable', 'unknown'].includes(state?.state) &&
      Array.isArray(state?.attributes?.source_list) &&
      state.attributes.source_list.some(source => tp35SameSource(source, target)) &&
      typeof state.attributes.source === 'string' && state.attributes.source.trim())
    .map(([id, state]) => ({id, name:state.attributes.friendly_name || id,
      source:state.attributes.source.trim()}))
    .slice(0, 4);
}

TP_35_CARD.prototype._tp35ShowLiveSource = function () {
  if (!this._config || !this._hass || !this._tv) return;
  const {linked, target, tv, source, name} = tp35LiveState(this);
  const warning = this._tpInputWarning;
  const showWarning = text => {
    if (!warning) return;
    warning.textContent = text;
    warning.hidden = !text;
  };
  if (!linked || !target) {
    this._tv.textContent = 'TV input not linked';
    this._tv.title = 'Choose the physical TV and its Totalplay HDMI input in Totalplay integration options.';
    showWarning('');
    return;
  }
  if (!tv || ['unavailable', 'unknown'].includes(tv.state)) {
    this._tv.textContent = `Linked TV unavailable · target ${target}`;
    this._tv.title = `Configured TV entity: ${linked}`;
    showWarning(`The linked TV entity ${linked} is unavailable.`);
    return;
  }
  if (tv.state === 'off') {
    this._tv.textContent = `${name}: off · Totalplay input ${target}`;
    this._tv.title = `Configured TV entity: ${linked}`;
    showWarning('');
    return;
  }
  if (source) {
    const confirmed = tp35SameSource(source, target);
    this._tv.textContent = confirmed
      ? `${name}: ${source} · Totalplay input confirmed`
      : `${name}: ${source} · Totalplay input ${target}`;
    this._tv.title = `Live HA source from ${linked}: ${source}. Configured Totalplay input: ${target}.`;
    showWarning(confirmed ? '' : `TV currently reports ${source}; Totalplay is connected to ${target}.`);
    return;
  }
  const candidates = tp35OtherDisplays(this, linked, target);
  this._tv.textContent = `${name}: no source reported · target ${target}`;
  const possible = candidates.map(c => `${c.name} (${c.id}) reports ${c.source}`).join(' · ');
  this._tv.title = `Linked entity: ${linked}. Its Home Assistant state has no source attribute.` +
    (possible ? ` Other TVs reporting an HDMI source: ${possible}.` : '') +
    ' Change the linked TV under Settings > Devices & services > Totalplay > Configure.';
  showWarning(possible
    ? `Linked player ${linked} has no live source. ${possible}. Link the physical TV in Totalplay integration options.`
    : `Linked player ${linked} does not expose a current source. Check that Totalplay is linked to your physical TV entity.`);
};

// Previous layers already call _tvStatus and _updatePowerHelper from the HA
// setter. Override both to use the SAME freshly received HA state every time.
const tp35PreviousTVStatus = TP_35_CARD.prototype._tvStatus;
TP_35_CARD.prototype._tvStatus = function () {
  tp35PreviousTVStatus.call(this);
  this._tp35ShowLiveSource();
};
const tp35PreviousPower = TP_35_CARD.prototype._updatePowerHelper;
TP_35_CARD.prototype._updatePowerHelper = function () {
  tp35PreviousPower.call(this);
  this._tp35ShowLiveSource();
};

// Also explicitly refresh after each incoming HA websocket state snapshot so
// a source change from the TV remote updates the header with no card action.
const tp35Hass = Object.getOwnPropertyDescriptor(TP_35_CARD.prototype, 'hass');
if (tp35Hass?.set) {
  Object.defineProperty(TP_35_CARD.prototype, 'hass', {
    configurable: true,
    get: tp35Hass.get,
    set(hass) {
      tp35Hass.set.call(this, hass);
      this._tp35ShowLiveSource();
    },
  });
}

const tp35PreviousConfig = TP_35_CARD.prototype.setConfig;
TP_35_CARD.prototype.setConfig = function (config) {
  tp35PreviousConfig.call(this, config);
  this.shadowRoot?.querySelector('.tp-version-badge')?.replaceChildren('v0.3.35');
  this._tp35ShowLiveSource();
};
