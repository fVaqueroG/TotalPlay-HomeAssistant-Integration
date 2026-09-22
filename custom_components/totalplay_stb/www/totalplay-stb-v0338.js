/* v0.3.38: Fit the channel scroller to the visible dashboard on tablets and
 * desktop, without constraining the whole card to an unrelated viewport height.
 * Preserve the category mosaics, EPG, remote and source-check-free v0.3.36 UI.
 */
import './totalplay-stb-v0337.js?v=0.3.38';

const TP_38_CARD = customElements.get('totalplay-stb-card');
if (!TP_38_CARD) throw new Error('Totalplay card unavailable');

const TP_38_LAYOUT = `
/* Older layers gave ha-card a fixed viewport height while the inner guide
   independently requested the remaining screen height. Flexbox then shrank the
   guide, leaving one row on the Fire tablet and empty space below on desktop.
   Make the outer card content-sized; only the guide owns a calculated height. */
:host {display:block!important;height:auto!important;min-height:0!important;max-height:none!important;}
ha-card {height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important;}
.frame,.layout,.main,.main>section:not(.hidden):not(.apps-only) {
  height:auto!important;min-height:0!important;max-height:none!important;
  overflow:visible!important;
}
.guide-scroll {
  display:block!important;flex:0 0 auto!important;
  height:var(--tp38-guide-height,320px)!important;
  max-height:var(--tp38-guide-height,320px)!important;
  min-height:190px!important;overflow-x:auto!important;overflow-y:auto!important;
  overscroll-behavior:contain;
}
/* The toolbar never scrolls away with the channel rows. */
.guide-info {max-height:none!important;overflow:visible!important;margin:5px 0 6px!important;gap:6px!important;}
.guide-info span {font-size:11px!important;line-height:1.25!important;}
.frame {padding:10px!important;}
.tools {margin:8px 0 7px!important;}
.pills {padding:1px 0 6px!important;gap:6px!important;}
.selection {margin-top:4px!important;}
.feedback {margin-top:5px!important;}
@media(max-height:850px) {
  .header {padding:8px 10px!important;gap:6px!important;}
  .search,.category {padding:7px 10px!important;min-height:36px!important;}
  .pill {padding:6px 10px!important;}
  .guide-info {margin:3px 0 5px!important;gap:4px!important;}
  .guide-info span {font-size:10.5px!important;line-height:1.2!important;}
  /* Keep official logos readable but show more than a single normal row. */
  .guide-scroll .grow:not(.head):not(.tp-mosaic-row):not(.tp24-full-row) {
    min-height:108px!important;
  }
  .guide-scroll .grow:not(.head):not(.tp-mosaic-row):not(.tp24-full-row) .timeline,
  .guide-scroll .grow:not(.head):not(.tp-mosaic-row):not(.tp24-full-row) .ch {
    min-height:108px!important;
  }
}
@media(max-width:580px) {
  .frame {padding:8px!important;}
  .header {padding:7px 9px!important;}
  .guide-info span {font-size:10px!important;}
}
`;

// The v0.3.24 layer already schedules fits on render/window/visualViewport
// resize. Replace its fit calculation, retaining those existing listeners.
TP_38_CARD.prototype._tpFitGuideHeight = function () {
  const scroll = this._scroll;
  if (!scroll || !this.isConnected || typeof window === 'undefined' ||
      (this._tab && this._tab !== 'guide')) return;
  const rect = scroll.getBoundingClientRect();
  if (!rect.width) return; // Hidden dashboard or Apps tab.

  const viewport = window.visualViewport;
  const bottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
  // Account for selection text, the optional feedback line, the frame's lower
  // padding and a visible breathing gap below the card. Do not derive height
  // from a fixed percentage of the device's total screen height.
  const selected = this._selected?.getBoundingClientRect().height || 0;
  const feedback = this._feedback?.getBoundingClientRect().height || 0;
  const reserve = Math.max(48, Math.ceil(selected + feedback + 28));
  const height = Math.max(190, Math.floor(bottom - rect.top - reserve));
  const pixels = `${height}px`;
  if (scroll.style.getPropertyValue('--tp38-guide-height').trim() === pixels &&
      scroll.style.height === pixels) return;
  scroll.style.setProperty('--tp38-guide-height', pixels);
  scroll.style.setProperty('height', pixels, 'important');
  scroll.style.setProperty('max-height', pixels, 'important');
  scroll.style.setProperty('min-height', '190px', 'important');
};

TP_38_CARD.prototype._tp38WatchLayout = function () {
  if (this._tp38LayoutObserver || !this.isConnected ||
      typeof ResizeObserver === 'undefined') return;
  this._tp38LayoutObserver = new ResizeObserver(() => this._tpQueueGuideFit?.());
  // Sidebar changes, browser zoom and container/layout edits need not trigger
  // a window resize. Observe the card itself to refit when its geometry moves.
  this._tp38LayoutObserver.observe(this);
  if (this._guidePanel) this._tp38LayoutObserver.observe(this._guidePanel);
};

const tp38OldConfig = TP_38_CARD.prototype.setConfig;
TP_38_CARD.prototype.setConfig = function (config) {
  tp38OldConfig.call(this, config);
  const root = this.shadowRoot;
  if (root && !root.querySelector('#tp38-adaptive-guide-layout')) {
    const style = document.createElement('style');
    style.id = 'tp38-adaptive-guide-layout';
    style.textContent = TP_38_LAYOUT;
    root.appendChild(style);
  }
  root?.querySelector('.tp-version-badge')?.replaceChildren('v0.3.38');
  this._tp38WatchLayout();
  this._tpQueueGuideFit?.();
};

const tp38OldSwitch = TP_38_CARD.prototype._switch;
if (tp38OldSwitch) TP_38_CARD.prototype._switch = function (...args) {
  const result = tp38OldSwitch.apply(this, args);
  if (this._tab === 'guide') this._tpQueueGuideFit?.();
  return result;
};

const tp38OldConnect = TP_38_CARD.prototype.connectedCallback;
TP_38_CARD.prototype.connectedCallback = function () {
  tp38OldConnect?.call(this);
  this._tp38WatchLayout();
  this._tpQueueGuideFit?.();
};

const tp38OldDisconnect = TP_38_CARD.prototype.disconnectedCallback;
TP_38_CARD.prototype.disconnectedCallback = function () {
  this._tp38LayoutObserver?.disconnect();
  this._tp38LayoutObserver = null;
  tp38OldDisconnect?.call(this);
};
