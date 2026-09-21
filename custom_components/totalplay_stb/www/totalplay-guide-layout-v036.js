/* Totalplay frontend layout: make the IPTV guide occupy the available card space. */
import './totalplay-pages-remote.js?v=0.3.7';

const TP_LAYOUT_CARD_VERSION = '0.3.7';
const Card = customElements.get('totalplay-stb-card');
if (!Card) throw new Error('Totalplay guide card was not registered');

// The original grid used align-items:start. That left its main column at its
// minimum content height even when the card had hundreds of pixels available;
// the 68px minimum-height guide showed only one row and appeared unscrollable.
// Stretch the column and let the timeline own the remaining height.
const GUIDE_LAYOUT_CSS = `
:host {display:block;min-height:0}
ha-card {display:flex;flex-direction:column;overflow:hidden}
.frame {display:flex;flex-direction:column;flex:1 1 auto;min-height:0;height:100%;overflow:hidden}
.layout,.layout.remote-visible {display:flex!important;flex-direction:column!important;align-items:stretch!important;flex:1 1 auto;min-height:0;height:100%;overflow:hidden}
.main {display:flex;flex-direction:column;align-self:stretch;flex:1 1 auto;min-height:0;height:100%;width:100%;overflow:hidden}
.main>section:not(.hidden):not(.apps-only) {display:flex;flex-direction:column;flex:1 1 auto;height:100%;min-height:0;overflow:hidden}
.guide-scroll {display:block;flex:1 1 0!important;height:0!important;min-height:0!important;max-height:none!important;overflow-x:auto!important;overflow-y:auto!important;touch-action:pan-x pan-y;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
.guide-scroll .grow.head {position:sticky;top:0}
.main>section.apps-only:not(.hidden) {flex:1 1 auto;min-height:0;overflow:auto}
@media(max-width:580px) {.guide-scroll {min-height:0!important}}
`;

const oldSetConfig = Card.prototype.setConfig;
Card.prototype.setConfig = function (config) {
  oldSetConfig.call(this, config);
  const root = this.shadowRoot;
  if (root && !root.querySelector('#tp-guide-layout-v036')) {
    const style = document.createElement('style');
    style.id = 'tp-guide-layout-v036';
    style.textContent = GUIDE_LAYOUT_CSS;
    root.appendChild(style);
  }
  const badge = root?.querySelector('.tp-version-badge');
  if (badge) badge.textContent = `Card v${TP_LAYOUT_CARD_VERSION}`;
  // A newly built guide starts at the first channel. Filters reset the scroll,
  // while page switching and automatic loading retain the user's position.
  if (this._scroll) {
    this._scroll.scrollTop = 0;
    this._scroll.scrollLeft = 0;
  }
  if (this._guideSearchResetNode !== this._search) {
    this._guideSearchResetNode = this._search;
    this._search?.addEventListener('input', () => {
      if (this._scroll) this._scroll.scrollTop = 0;
    }, {capture:true});
    this._guideOnly?.addEventListener('change', () => {
      if (this._scroll) this._scroll.scrollTop = 0;
    }, {capture:true});
    this._pills?.addEventListener('click', event => {
      if (event.target?.closest?.('.pill') && this._scroll) this._scroll.scrollTop = 0;
    }, {capture:true});
  }
  this._queueGuideFill?.();
};
