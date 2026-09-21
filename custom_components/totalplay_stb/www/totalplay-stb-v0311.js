/* Totalplay card v0.3.11: optional linked switch and TV-input feedback. */
import './totalplay-stb-v0310.js?v=0.3.11';

const TP_POWER_CARD = customElements.get('totalplay-stb-card');
if (!TP_POWER_CARD) throw new Error('Totalplay card did not load');

const TP_POWER_CSS = `
.tp-power-helper {display:inline-flex;align-items:center;justify-content:center;flex:none;width:42px;height:42px;padding:6px}
.tp-power-helper ha-icon {--mdc-icon-size:23px}
.tp-power-helper.on {color:var(--success-color,#65d8a3);border-color:var(--success-color,#65d8a3)}
.tp-input-warning {color:var(--warning-color,#f5bb6d);font-size:11px;line-height:1.3;margin-top:2px}
@media(max-width:580px) {.tp-power-helper {order:2}}
`;
const TP_SOURCE_WARNINGS = Object.freeze({
  tv_unavailable:'TV unavailable: HDMI input not verified',
  tv_off:'TV is off: HDMI input not verified',
  source_unknown:'TV does not report its source or allow switching',
  switch_unsupported:'TV reports a different input but cannot switch it',
  source_not_listed:'Configured HDMI input is missing from TV source list',
  switch_failed:'TV rejected the HDMI input change',
  switch_unconfirmed:'HDMI change was requested but not confirmed by the TV',
});

TP_POWER_CARD.prototype._linkedPowerEntity = function () {
  const player = this._hass?.states?.[this._config?.entity];
  const id = player?.attributes?.connected_power_switch_entity || this._config?.power_switch_entity || '';
  return /^switch\.[a-z0-9_]+$/.test(id) ? id : '';
};
TP_POWER_CARD.prototype._updatePowerHelper = function () {
  const button = this._tpPowerButton;
  if (!button) return;
  const id = this._linkedPowerEntity();
  button.hidden = !id;
  if (id) {
    const state = this._hass?.states?.[id]?.state;
    const known = state === 'on' || state === 'off';
    button.disabled = this._tpPowerBusy || !known;
    button.classList.toggle('on', state === 'on');
    const on = state === 'on';
    button.title = !known ? `Power helper ${id} unavailable` :
      `${on ? 'Turn off' : 'Turn on'} Totalplay power helper (${id})`;
    button.setAttribute('aria-label', button.title);
    button.setAttribute('aria-pressed', String(on));
    this._tpPowerIcon?.setAttribute('icon', on ? 'mdi:power-plug' : 'mdi:power-plug-off');
  }
  const status = this._hass?.states?.[this._config?.entity]?.attributes?.tv_input_check;
  const warning = this._tpInputWarning;
  if (warning) {
    warning.textContent = TP_SOURCE_WARNINGS[status] || '';
    warning.hidden = !warning.textContent;
  }
};
TP_POWER_CARD.prototype._togglePowerHelper = async function () {
  const id = this._linkedPowerEntity();
  const state = this._hass?.states?.[id]?.state;
  if (this._tpPowerBusy || !id || !['on','off'].includes(state)) return;
  this._tpPowerBusy = true;
  this._updatePowerHelper();
  try {
    // Explicit button press only: selecting a channel never cuts power to a
    // decoder or assumes that powering a smart plug means the STB has booted.
    await this._hass.callService('switch', state === 'on' ? 'turn_off' : 'turn_on', {entity_id:id});
  } catch (error) {
    if (this._feedback) {
      this._feedback.textContent = `Power helper failed: ${error?.message || 'Home Assistant service error'}`;
      this._feedback.classList?.add('error');
    }
  } finally {
    this._tpPowerBusy = false;
    this._updatePowerHelper();
  }
};

const tpOriginalPowerSetConfig = TP_POWER_CARD.prototype.setConfig;
TP_POWER_CARD.prototype.setConfig = function (config) {
  tpOriginalPowerSetConfig.call(this, config);
  const root = this.shadowRoot;
  if (root && !root.querySelector('#tp-power-helper-css')) {
    const style = document.createElement('style');
    style.id = 'tp-power-helper-css';
    style.textContent = TP_POWER_CSS;
    root.appendChild(style);
  }
  const header = root?.querySelector('.header');
  if (header) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn tp-power-helper';
    button.hidden = true;
    const icon = document.createElement('ha-icon');
    icon.setAttribute('icon', 'mdi:power-plug-off');
    button.appendChild(icon);
    button.addEventListener('click', () => this._togglePowerHelper());
    header.insertBefore(button, this._remoteTab || this._time || null);
    this._tpPowerButton = button;
    this._tpPowerIcon = icon;
  }
  const meta = this._tv?.parentElement;
  if (meta) {
    const warning = document.createElement('div');
    warning.className = 'tp-input-warning';
    warning.hidden = true;
    meta.appendChild(warning);
    this._tpInputWarning = warning;
  }
  root?.querySelector('.tp-version-badge')?.replaceChildren('Card v0.3.11');
  this._updatePowerHelper();
};

// The base card owns the HA state setter; preserve it and update the optional
// switch button whenever Home Assistant publishes the linked switch's state.
let tpHassOwner = TP_POWER_CARD.prototype;
while (tpHassOwner && !Object.getOwnPropertyDescriptor(tpHassOwner, 'hass')) {
  tpHassOwner = Object.getPrototypeOf(tpHassOwner);
}
const tpPreviousHass = tpHassOwner && Object.getOwnPropertyDescriptor(tpHassOwner, 'hass');
if (tpPreviousHass?.set) {
  Object.defineProperty(TP_POWER_CARD.prototype, 'hass', {
    configurable:true,
    get:tpPreviousHass.get,
    set(hass) {
      tpPreviousHass.set.call(this, hass);
      this._updatePowerHelper();
    },
  });
}
