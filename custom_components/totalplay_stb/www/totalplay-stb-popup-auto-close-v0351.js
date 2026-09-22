/* v0.3.51: Optional timed closing for the compact Totalplay popup.
 * Starts when the real dialog opens, and cancels on every manual close/unmount.
 */
const TP51_POPUP = customElements.get('totalplay-stb-popup-card');
const TP51_EDITOR = customElements.get('totalplay-stb-popup-card-editor');
if (!TP51_POPUP || !TP51_EDITOR) throw new Error('Totalplay popup components unavailable');

const TP51_DEFAULT_MINUTES = 2;
const TP51_MAX_MINUTES = 1440;
const tp51Minutes = value => {
  // Absent/invalid values preserve the two-minute default; zero disables it.
  if (value === undefined || value === null || value === '') return TP51_DEFAULT_MINUTES;
  const minutes = Number(value);
  return Number.isInteger(minutes) && minutes >= 0 && minutes <= TP51_MAX_MINUTES
    ? minutes : TP51_DEFAULT_MINUTES;
};

const tp51PreviousOpen = TP51_POPUP.prototype._openPopup;
TP51_POPUP.prototype._openPopup = function () {
  const wasOpen = !!this._dialog?.open;
  tp51PreviousOpen.call(this);
  const dialog = this._dialog;
  if (wasOpen || !dialog?.open) return;

  if (this._tp51CloseTimer !== undefined) clearTimeout(this._tp51CloseTimer);
  this._tp51CloseTimer = undefined;
  const minutes = tp51Minutes(this._config?.popup_auto_close_minutes);
  if (minutes === 0) return;

  this._tp51CloseTimer = setTimeout(() => {
    this._tp51CloseTimer = undefined;
    // Do not close a newer popup if an older dialog was already dismissed.
    if (this._dialog === dialog && dialog.open) dialog.close();
  }, minutes * 60_000);
};

const tp51PreviousCleanup = TP51_POPUP.prototype._cleanupPopup;
TP51_POPUP.prototype._cleanupPopup = function () {
  if (this._tp51CloseTimer !== undefined) {
    clearTimeout(this._tp51CloseTimer);
    this._tp51CloseTimer = undefined;
  }
  tp51PreviousCleanup.call(this);
};

// The existing editor copies popup-specific fields when the embedded full-card
// editor changes. Remember this new option so editing decoder/EPG fields does
// not silently discard the auto-close setting.
const tp51PreviousEmit = TP51_EDITOR.prototype._emit;
TP51_EDITOR.prototype._emit = function (patch) {
  if (Object.prototype.hasOwnProperty.call(patch, 'popup_auto_close_minutes')) {
    this._tp51RememberedMinutes = patch.popup_auto_close_minutes;
  } else if (this._config?.popup_auto_close_minutes === undefined &&
             this._tp51RememberedMinutes !== undefined) {
    this._config.popup_auto_close_minutes = this._tp51RememberedMinutes;
  }
  tp51PreviousEmit.call(this, patch);
};

const tp51PreviousDraw = TP51_EDITOR.prototype._draw;
TP51_EDITOR.prototype._draw = function () {
  if (this._config && Object.prototype.hasOwnProperty.call(this._config, 'popup_auto_close_minutes')) {
    this._tp51RememberedMinutes = this._config.popup_auto_close_minutes;
  }
  tp51PreviousDraw.call(this);
  const fields = this.shadowRoot?.querySelector('.tp-popup-fields');
  if (!fields) return;

  const minutes = document.createElement('input');
  minutes.type = 'number';
  minutes.min = '0';
  minutes.max = String(TP51_MAX_MINUTES);
  minutes.step = '1';
  minutes.value = String(tp51Minutes(this._config?.popup_auto_close_minutes));
  minutes.setAttribute('aria-label', 'Auto-close popup after minutes');
  minutes.addEventListener('change', () => {
    const raw = minutes.value.trim();
    const value = Number(raw);
    minutes.setCustomValidity(raw === '' || !Number.isInteger(value) ||
      value < 0 || value > TP51_MAX_MINUTES
      ? `Enter a whole number from 0 to ${TP51_MAX_MINUTES}.` : '');
    if (!minutes.reportValidity()) return;
    this._emit({popup_auto_close_minutes: value});
  });

  const field = this._field('Auto-close after (minutes)', minutes,
    'Default: 2 minutes after opening. Enter 0 to keep the popup open until you close it.');
  // Group this next to Popup size; keep the nested full-card editor untouched.
  const sizeField = [...fields.querySelectorAll('label.tp-field')]
    .find(item => item.querySelector(':scope > span')?.textContent?.trim() === 'Popup size');
  if (sizeField) sizeField.after(field);
  else fields.appendChild(field);
};
