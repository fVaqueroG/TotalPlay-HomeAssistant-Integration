/* v0.3.24: Size the EPG for the visible dashboard on small and large tablets.
 * Keep the header, search, categories and controls outside the guide scroller.
 */
import './totalplay-stb-v0324.js?v=0.3.24';

const TP_FIT_CARD = customElements.get('totalplay-stb-card');
if (!TP_FIT_CARD) throw new Error('Totalplay card unavailable');

TP_FIT_CARD.prototype._tpFitGuideHeight = function () {
  const scroll = this._scroll;
  if (!scroll || !this.isConnected || typeof window === 'undefined') return;
  const viewport = window.visualViewport;
  // visualViewport accounts for browser controls and tablet orientation.
  const viewportBottom = viewport ? viewport.offsetTop + viewport.height : window.innerHeight;
  const guideTop = scroll.getBoundingClientRect().top;
  if (guideTop < -20 || guideTop >= viewportBottom - 70) return;
  const footer = this._feedback?.getBoundingClientRect();
  const footerReserve = footer?.height ? Math.min(footer.height, 45) : 0;
  const usable = Math.floor(viewportBottom - guideTop - footerReserve - 12);
  const height = Math.max(140, usable);
  const cssHeight = `${height}px`;
  if (scroll.style.height !== cssHeight) {
    scroll.style.setProperty('height', cssHeight, 'important');
    scroll.style.setProperty('max-height', cssHeight, 'important');
    scroll.style.setProperty('min-height', '140px', 'important');
  }
};

TP_FIT_CARD.prototype._tpQueueGuideFit = function () {
  if (this._tpGuideFitQueued || typeof requestAnimationFrame !== 'function') return;
  this._tpGuideFitQueued = true;
  requestAnimationFrame(() => {
    this._tpGuideFitQueued = false;
    this._tpFitGuideHeight();
  });
};

const tpFitPreviousRender = TP_FIT_CARD.prototype._renderGuide;
TP_FIT_CARD.prototype._renderGuide = function () {
  tpFitPreviousRender.call(this);
  const sources=this._guide?.sources;
  if (this._guideStatus && Array.isArray(sources)) {
    this._guideStatus.title=sources.map(s=>
      `${s.name}: ${s.scheduled} stations with programmes`).join(' · ');
  }
  this._tpQueueGuideFit();
};

const tpFitPreviousSetConfig = TP_FIT_CARD.prototype.setConfig;
TP_FIT_CARD.prototype.setConfig = function (config) {
  tpFitPreviousSetConfig.call(this, config);
  if (!this._tpResponsiveResize) {
    this._tpResponsiveResize = () => this._tpQueueGuideFit();
    window.addEventListener('resize', this._tpResponsiveResize, {passive:true});
    window.visualViewport?.addEventListener('resize', this._tpResponsiveResize, {passive:true});
  }
  this._tpQueueGuideFit();
};

const tpFitPreviousDisconnected = TP_FIT_CARD.prototype.disconnectedCallback;
TP_FIT_CARD.prototype.disconnectedCallback = function () {
  if (this._tpResponsiveResize) {
    window.removeEventListener('resize', this._tpResponsiveResize);
    window.visualViewport?.removeEventListener('resize', this._tpResponsiveResize);
    this._tpResponsiveResize = null;
  }
  tpFitPreviousDisconnected?.call(this);
};

const tpFitPreviousConnected = TP_FIT_CARD.prototype.connectedCallback;
TP_FIT_CARD.prototype.connectedCallback = function () {
  tpFitPreviousConnected?.call(this);
  if (this._config && !this._tpResponsiveResize) {
    this._tpResponsiveResize = () => this._tpQueueGuideFit();
    window.addEventListener('resize', this._tpResponsiveResize, {passive:true});
    window.visualViewport?.addEventListener('resize', this._tpResponsiveResize, {passive:true});
    this._tpQueueGuideFit();
  }
};
