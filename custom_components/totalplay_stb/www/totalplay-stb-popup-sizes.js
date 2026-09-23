/* v0.3.41: Simplified popup sizing shared with the other media popup cards.
 * Only Normal, Wide and Full-screen are offered in the visual editor.
 * Legacy sizes are normalized without changing the icon/button preferences.
 */
const TP_SIZE_POPUP = customElements.get('totalplay-stb-popup-card');
const TP_SIZE_EDITOR = customElements.get('totalplay-stb-popup-card-editor');
if (!TP_SIZE_POPUP || !TP_SIZE_EDITOR) throw new Error('Totalplay popup components unavailable');

const tpSizeNormalize = size => {
  if (size === undefined || size === null || size === '') return 'wide';
  if (size === 'fullscreen') return 'fullscreen';
  if (size === 'wide' || size === 'large') return 'wide';
  return 'normal'; // Including existing auto, small, medium and custom cards.
};

const tpSizePreviousOpen = TP_SIZE_POPUP.prototype._openPopup;
TP_SIZE_POPUP.prototype._openPopup = function () {
  tpSizePreviousOpen.call(this);
  const dialog = this._dialog;
  if (!dialog?.open) return;
  const mode = tpSizeNormalize(this._config?.popup_size);
  const presets = {
    normal: ['900px', '700px'],
    wide: ['1440px', '900px'],
    fullscreen: ['calc(100vw - 8px)', 'calc(100dvh - 8px)'],
  };
  const [width, height] = presets[mode];
  // Override the older modal's 1500px / 1000px caps only as needed, and never
  // allow any size to exceed the visible tablet/desktop viewport.
  dialog.style.width = `min(${width}, calc(100vw - 8px))`;
  dialog.style.height = `min(${height}, calc(100dvh - 8px))`;
  dialog.style.maxWidth = 'calc(100vw - 8px)';
  dialog.style.maxHeight = 'calc(100dvh - 8px)';
  dialog.style.borderRadius = mode === 'fullscreen' ? '9px' : '18px';
  requestAnimationFrame(() => this._popupCard?._tpQueueGuideFit?.());
};

const tpSizePreviousDraw = TP_SIZE_EDITOR.prototype._draw;
TP_SIZE_EDITOR.prototype._draw = function () {
  tpSizePreviousDraw.call(this);
  const fields = this.shadowRoot?.querySelector('.tp-popup-fields');
  if (!fields) return;
  const selector = [...fields.querySelectorAll('label.tp-field')]
    .find(field => field.querySelector('span')?.textContent?.trim() === 'Popup size')
    ?.querySelector('select');
  if (selector) {
    selector.replaceChildren();
    for (const [value, label] of [
      ['normal','Normal'], ['wide','Wide'], ['fullscreen','Full-screen'],
    ]) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      selector.appendChild(option);
    }
    selector.value = tpSizeNormalize(this._config?.popup_size);
  }
  fields.querySelector('.tp-custom-dimensions')?.remove();
};
