/* v0.3.25: Totalplay mosaic channels act as full-width, clickable category
 * separators. They have no EPG; regular TV and Audio/Música rows are unchanged.
 */
import './totalplay-stb-v0324-responsive.js?v=0.3.25';

const TP_MOSAIC_CARD = customElements.get('totalplay-stb-card');
if (!TP_MOSAIC_CARD) throw new Error('Totalplay card unavailable');

function tpMosaicTitle(channel) {
  return String(channel.name || '').replace(/^mosaico(?:\s+\d+)?\s*/i, '')
    .replace(/^\((.*)\)$/, '$1').trim() || channel.category || 'Mosaico';
}
const TP_MOSAIC_CSS = `
/* The banner overlays the complete *visible* timeline, including on horizontal scroll. */
.guide-scroll .grow.tp-mosaic-row{min-height:68px!important;background:transparent!important}
.guide-scroll .grow.tp-mosaic-row .ch.tp-mosaic-button{
  position:sticky!important;left:0!important;z-index:4!important;cursor:pointer!important;
  width:var(--tp24-viewport,100%)!important;max-width:var(--tp24-viewport,100%)!important;
  flex:0 0 var(--tp24-viewport,100%)!important;min-height:68px!important;
  padding:6px 9px!important;display:flex!important;align-items:center!important;
  border:0!important;border-bottom:1px solid var(--tp-line)!important;
  gap:0!important;background:var(--tp-bg)!important;box-sizing:border-box!important;
}
.guide-scroll .grow.tp-mosaic-row .tp-mosaic-banner{
  flex:1 1 auto!important;min-width:0!important;display:flex!important;align-items:center!important;
  gap:10px!important;min-height:54px!important;padding:9px 14px!important;
  border:1px solid color-mix(in srgb,var(--tp-blue) 62%,#ffffff)!important;
  border-radius:12px!important;
  background:linear-gradient(105deg,color-mix(in srgb,var(--tp-blue) 46%,#ffffff) 0%,
    color-mix(in srgb,var(--tp-blue) 28%,#ffffff) 76%,
    color-mix(in srgb,var(--tp-blue) 19%,#ffffff) 100%)!important;
  box-shadow:inset 0 1px #ffffffaa,0 2px 6px #0003!important;
  color:#17202c!important;
}
.guide-scroll .grow.tp-mosaic-row .tp-mosaic-number{
  flex:0 0 auto!important;min-width:33px!important;font-variant-numeric:tabular-nums!important;
  font-size:15px!important;font-weight:850!important;color:#17202c!important;
}
.guide-scroll .grow.tp-mosaic-row .tp-mosaic-title{
  flex:1 1 auto!important;min-width:0!important;font-size:15px!important;
  line-height:1.2!important;font-weight:790!important;overflow-wrap:anywhere!important;
  white-space:normal!important;color:#17202c!important;
}
.guide-scroll .grow.tp-mosaic-row .tp-mosaic-hint{
  flex:0 0 auto!important;font-size:11px!important;color:#354153!important;
  white-space:nowrap!important;border:1px solid #17202c33!important;border-radius:999px!important;
  padding:5px 10px!important;background:#ffffff66!important;
}
.guide-scroll .grow.tp-mosaic-row .tp-mosaic-button:hover .tp-mosaic-banner,
.guide-scroll .grow.tp-mosaic-row .tp-mosaic-button:focus-visible .tp-mosaic-banner{
  border-color:var(--tp-blue)!important;box-shadow:0 0 0 2px var(--tp-blue),0 2px 7px #0004!important;
}
@media(max-width:580px){
 .guide-scroll .grow.tp-mosaic-row{min-height:57px!important}
 .guide-scroll .grow.tp-mosaic-row .ch.tp-mosaic-button{min-height:57px!important;padding:5px!important}
 .guide-scroll .grow.tp-mosaic-row .tp-mosaic-banner{min-height:47px!important;padding:8px 10px!important;gap:7px!important}
 .guide-scroll .grow.tp-mosaic-row .tp-mosaic-number{min-width:28px!important;font-size:13px!important}
 .guide-scroll .grow.tp-mosaic-row .tp-mosaic-title{font-size:13px!important}
 .guide-scroll .grow.tp-mosaic-row .tp-mosaic-hint{display:none!important}
}
`;
const tpOldMosaicRender = TP_MOSAIC_CARD.prototype._renderGuide;
TP_MOSAIC_CARD.prototype._renderGuide = function () {
  tpOldMosaicRender.call(this);
  const byNumber = this._tpOfficialCatalog?.byNumber;
  if (!byNumber || !this._rows) return;
  for (const row of [...this._rows.children]) {
    const button = row.querySelector?.('.ch');
    const number = button?.querySelector?.('.ch-num')?.textContent?.trim();
    const channel = byNumber.get(String(number));
    if (channel?.type !== 'M' || !button) continue;
    row.classList.add('tp-mosaic-row');
    button.classList.add('tp-mosaic-button');
    const banner = document.createElement('span');
    banner.className = 'tp-mosaic-banner';
    const channelNumber = document.createElement('strong');
    channelNumber.className = 'tp-mosaic-number';
    channelNumber.textContent = String(channel.number);
    const label = document.createElement('span');
    label.className = 'tp-mosaic-title';
    label.textContent = tpMosaicTitle(channel);
    const hint = document.createElement('span');
    hint.className = 'tp-mosaic-hint';
    hint.textContent = 'Abrir mosaico';
    banner.append(channelNumber, label, hint);
    // Keep the existing button and click handler; remove only its old logo/timeline markup.
    button.replaceChildren(banner);
    button.title = `${channel.number} ${channel.name} · Abrir mosaico`;
    row.replaceChildren(button);
  }
};
const tpOldMosaicConfig = TP_MOSAIC_CARD.prototype.setConfig;
TP_MOSAIC_CARD.prototype.setConfig = function (config) {
  tpOldMosaicConfig.call(this, config);
  const root = this.shadowRoot;
  if (root && !root.querySelector('#tp-mosaic-banner-v0325')) {
    const style = document.createElement('style');
    style.id = 'tp-mosaic-banner-v0325';
    style.textContent = TP_MOSAIC_CSS;
    root.appendChild(style);
  }
  root?.querySelector('.tp-version-badge')?.replaceChildren('v0.3.25');
  this._renderGuide();
};
