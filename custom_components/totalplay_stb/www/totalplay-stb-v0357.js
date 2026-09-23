/* Totalplay v0.3.59 — shared FV media popup shell built into the HACS integration.
 * Keep previous full card, editor, branding, remote, fit and auto-close handlers.
 */
import './totalplay-stb-v0356.js?v=0.3.59';

const TP59_POPUP = customElements.get('totalplay-stb-popup-card');
const TP59_FULL = customElements.get('totalplay-stb-card');
if (!TP59_POPUP || !TP59_FULL) throw new Error('Totalplay popup/full card unavailable');

const TP59_SHELL = `
  dialog.tp-stb-popup-dialog {
    box-sizing: border-box !important;
    width: min(1440px, calc(100vw - 24px)) !important;
    max-width: calc(100vw - 24px) !important;
    height: min(900px, calc(100dvh - 24px)) !important;
    max-height: calc(100dvh - 24px) !important;
    border-radius: 18px !important;
    overflow: hidden !important;
  }
  dialog.tp-stb-popup-dialog[data-fv-popup-size="normal"] {
    width: min(900px, calc(100vw - 24px)) !important;
    height: min(700px, calc(100dvh - 24px)) !important;
  }
  dialog.tp-stb-popup-dialog[data-fv-popup-size="fullscreen"] {
    inset: 0 !important;
    width: 100vw !important;
    max-width: 100vw !important;
    height: 100dvh !important;
    max-height: 100dvh !important;
    border-radius: 0 !important;
    border: 0 !important;
    margin: 0 !important;
  }
  .tp-stb-popup-head {
    box-sizing: border-box !important;
    height: 48px !important;
    min-height: 48px !important;
    flex: 0 0 48px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    gap: 12px !important;
    padding: 0 12px 0 20px !important;
    border-bottom: 1px solid var(--divider-color, #8884) !important;
  }
  .tp-stb-popup-title {
    min-width: 0 !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
    font: inherit !important;
    font-size: 16px !important;
    font-weight: 600 !important;
  }
  .tp-stb-popup-close {
    box-sizing: border-box !important;
    display: grid !important;
    place-items: center !important;
    flex: 0 0 36px !important;
    width: 36px !important;
    min-width: 36px !important;
    height: 36px !important;
    min-height: 36px !important;
    padding: 0 !important;
    border: 0 !important;
    border-radius: 50% !important;
    background: var(--secondary-background-color) !important;
    color: var(--primary-text-color) !important;
    cursor: pointer !important;
  }
  .tp-stb-popup-close ha-icon { --mdc-icon-size: 22px; }
  @media (max-width: 600px) {
    dialog.tp-stb-popup-dialog {
      inset: 0 !important;
      width: 100vw !important;
      max-width: 100vw !important;
      height: 100dvh !important;
      max-height: 100dvh !important;
      margin: 0 !important;
      border-radius: 0 !important;
      border: 0 !important;
    }
    .tp-stb-popup-head {
      height: 44px !important;
      min-height: 44px !important;
      flex-basis: 44px !important;
      padding: 0 8px 0 12px !important;
    }
  }
`;

const tp59PreviousOpen = TP59_POPUP.prototype._openPopup;
TP59_POPUP.prototype._openPopup = function (...args) {
  const result = tp59PreviousOpen.apply(this, args);
  const dialog = this._dialog;
  if (!dialog?.open) return result;
  const configured = this._config?.popup_size;
  dialog.dataset.fvPopupSize = configured === 'fullscreen' ? 'fullscreen'
    : configured === 'normal' || ['auto', 'small', 'medium', 'custom'].includes(configured)
      ? 'normal' : 'wide';
  const css = document.createElement('style');
  css.textContent = TP59_SHELL;
  dialog.appendChild(css);
  const close = dialog.querySelector('.tp-stb-popup-close');
  if (close && !close.querySelector('ha-icon')) {
    const icon = document.createElement('ha-icon');
    icon.setAttribute('icon', 'mdi:close');
    close.replaceChildren(icon);
    close.title = 'Close';
  }
  requestAnimationFrame(() => this._popupCard?._tpQueueGuideFit?.());
  return result;
};

const tp59PreviousFullConfig = TP59_FULL.prototype.setConfig;
TP59_FULL.prototype.setConfig = function (config) {
  tp59PreviousFullConfig.call(this, config);
  this.shadowRoot?.querySelector('.tp-version-badge')?.replaceChildren('v0.3.59');
};
