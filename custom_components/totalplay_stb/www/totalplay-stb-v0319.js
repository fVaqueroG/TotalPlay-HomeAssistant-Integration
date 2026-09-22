/* Totalplay card v0.3.19: branded guide, station artwork and conservative lineup additions.
 * Keep the v0.3.18 cached EPG, dedicated Apps page, remote and tuning logic.
 */
import './totalplay-stb-v0318.js?v=0.3.19';

const TP_BRAND_CARD = customElements.get('totalplay-stb-card');
const TP_BRAND_EDITOR = customElements.get('totalplay-stb-card-editor');
if (!TP_BRAND_CARD || !TP_BRAND_EDITOR) throw Error('Totalplay card or editor did not load');

// Additional channel numbers listed by internetencasa.mx (May 2026), absent
// from the existing reference lineup. Never override the user's number/name
// or replace conflicting entries from the previous reference source.
const TP_REFERENCE_ADDITIONS = Object.freeze([
  ['4','N+ Foro','Local'],['8','La Octava','Local'],['9','Canal 9','Local'],
  ['21','Canal 21','Local'],['34','Mexiquense TV','Local'],
  ['40','ADN 40','Local'],['45','Canal del Congreso','Local'],
  ['116','Las Estrellas -2','National'],['143','Canal 22','National'],
  ['144','Canal Once','National'],['164','Ingenio TV','National'],
  ['166','Aprende TV','National'],
]);
const TP_TOTALPLAY_LOGO = '/totalplay_stb_cache/brand/totalplay-horizontal.svg';
const TP_TOTALPLAY_LOGO_REMOTE = 'https://www.totalplay.com.mx/assetsv2/img/header/totalplay-logoWhite.svg';
const TP_BRAND_CSS = `
:host {--tp-blue:#ed4a86;--tp-ink:#f6f4fb;--tp-sub:#b9b5c8;--tp-bg:#1e1e28;--tp-line:#484257}
ha-card {background:#1e1e28!important;border:1px solid #494055;border-radius:19px!important;color:var(--tp-ink)}
.frame {background:linear-gradient(145deg,#252131 0%,#1e1e28 48%,#171822 100%)!important}
.header {padding:11px 13px;border:1px solid #4d3d59;border-radius:15px;background:linear-gradient(115deg,#46233c 0%,#30243f 40%,#22233b 100%);gap:9px}
.header .brand {gap:10px;min-width:0}
.header .mark {background:linear-gradient(145deg,#f45086,#8849be)!important}
.tp-brand-logo {width:145px;max-width:42vw;height:36px;display:block;object-fit:contain;flex:none}
.header .brand-title {font-size:14px;font-weight:700;color:#fff;letter-spacing:.01em}
.header .meta {font-size:11px;color:#d1c9d8}
.tp-version-badge {border-radius:20px;padding:3px 7px;border:1px solid #74546d;color:#f8e9f1;font-size:10px;font-weight:650;white-space:nowrap}
.header .tabs {background:#211d2b;border:1px solid #62455f}
.header .tabs .tab.on,.header .tabs .tp-remote-trigger.on {background:linear-gradient(120deg,#ed4a86,#9353a9)!important;border-color:#f08cb0;color:white}
.search:focus,.category:focus {border-color:#ed4a86}
.guide-scroll {background:#1c1b27;border-color:#54465d;scrollbar-color:#96506f transparent}
.guide-scroll .grow .ch,.guide-scroll .grow.head .ch {background:#23202f!important}
.guide-scroll .grow.head,.guide-scroll .grow .times {background:#292235!important}
.guide-scroll .grow .timeline {background-color:#1d1b29!important}
.guide-scroll .grow .now {background:#ffbc62!important}
.guide-scroll .grow .now:before {background:#ffbc62!important}
.ch-num {color:#ffc477!important}
.ch-logo {width:37px!important;height:32px!important;flex:0 0 37px!important;background:#332c3e!important;border:1px solid #534661;border-radius:8px!important;overflow:hidden;display:grid;place-items:center}
.ch-logo img {display:block;width:100%;height:100%;object-fit:contain;padding:2px}
.programme.live {background:linear-gradient(110deg,#542944,#3b2e50)!important;border-color:#e46ba0!important}
.pill.on {background:linear-gradient(110deg,#dc4487,#9654b8)!important;border-color:transparent!important}
.btn:hover,.app:hover,.programme:hover,.ch:hover {border-color:#c968a4!important}
.apps-only .app {background:linear-gradient(150deg,#302438,#232131)!important;border-color:#5e4864!important}
@media(max-width:580px) {.header {padding:9px}.tp-brand-logo {width:120px;height:30px}.header .brand-title {font-size:12px}.ch-logo {width:32px!important;height:29px!important;flex-basis:32px!important}}
`;
const TP_BRAND_REMOTE_CSS = `
:host {--tp-blue:#ed4a86;--tp-ink:#f6f4fb;--tp-sub:#c1b9cc;--tp-bg:#1e1e28;--tp-line:#554760}
.remote {background:linear-gradient(155deg,#302035,#211f30 45%,#1b1c27 100%)!important;border-color:#76536d!important}
.remote-title {color:#fff}
.remote .dpad {background:radial-gradient(circle,#513049 0%,#29263a 65%,#201f2b 100%)!important;border-color:#9d5a84!important}
.remote .dpad .rkey.ok {background:linear-gradient(145deg,#ef568d,#9553a9)!important}
.remote .rkey:active {background:#76365d!important}
.remote .rkey {border-color:#624b64}
`;
function tpSafeArtwork(value) {
  if (typeof value !== 'string' || value.length > 512 || /[\u0000-\u001f]/.test(value)) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
const tpPriorBrandChannels = TP_BRAND_CARD.prototype._channels;
TP_BRAND_CARD.prototype._channels = function() {
  const original = tpPriorBrandChannels.call(this);
  if (!this._config?.lineup) return original;
  if (this._tpExtraBase === original) return this._tpExtraChannels;
  const byNumber = new Map(original.map(ch => [String(ch.number),ch]));
  for (const [number,name,category] of TP_REFERENCE_ADDITIONS) {
    if (!byNumber.has(number)) byNumber.set(number,{number,name,category});
  }
  this._tpExtraBase = original;
  this._tpExtraChannels = [...byNumber.values()].sort((a,b)=>Number(a.number)-Number(b.number));
  return this._tpExtraChannels;
};

const tpPriorBrandRender = TP_BRAND_CARD.prototype._renderGuide;
TP_BRAND_CARD.prototype._renderGuide = function() {
  tpPriorBrandRender.call(this);
  if (!this._guide?.channels?.length || !this._rows?.children?.length) return;
  const stations = new Map(this._guide.channels.map(station=>[station.id,station]));
  const channels = new Map(this._channels().map(ch=>[String(ch.number),ch]));
  for (const row of this._rows.children) {
    const number = row.querySelector?.('.ch-num')?.textContent;
    const badge = row.querySelector?.('.ch-logo');
    const channel = channels.get(String(number));
    if (!badge || !channel) continue;
    const station = stations.get(channel.epg_id);
    // Explicit user artwork takes precedence, then the exact XMLTV station.
    // Never choose a logo from an ambiguously matched channel name.
    const source = tpSafeArtwork(channel.logo_url || channel.logo) || tpSafeArtwork(station?.logo);
    if (!source) continue;
    const fallback = badge.textContent;
    const image = document.createElement('img');
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';
    image.referrerPolicy = 'no-referrer';
    image.src = source;
    image.addEventListener('error',()=>{if(image.parentNode===badge)badge.textContent=fallback;},{once:true});
    badge.replaceChildren(image);
  }
};

const tpPriorBrandSetConfig = TP_BRAND_CARD.prototype.setConfig;
TP_BRAND_CARD.prototype.setConfig = function(config) {
  this._tpExtraBase = null;
  tpPriorBrandSetConfig.call(this,config);
  const root = this.shadowRoot;
  if (!root) return;
  if (!root.querySelector('#tp-brand-style-v0319')) {
    const style = document.createElement('style');
    style.id = 'tp-brand-style-v0319';
    style.textContent = TP_BRAND_CSS;
    root.appendChild(style);
  }
  const brand = root.querySelector('.brand');
  const mark = brand?.querySelector('.mark');
  if (brand && mark && !brand.querySelector('.tp-brand-logo')) {
    const logo = document.createElement('img');
    logo.className = 'tp-brand-logo';
    logo.src = TP_TOTALPLAY_LOGO;
    logo.alt = 'Totalplay';
    logo.loading = 'eager';
    logo.addEventListener('load',()=>{mark.style.display='none';},{once:true});
    let brandFallbackTried = false;
    logo.addEventListener('error',()=>{
      if (!brandFallbackTried) {
        brandFallbackTried = true;
        logo.src = TP_TOTALPLAY_LOGO_REMOTE;
        return;
      }
      logo.remove();mark.style.display='grid';
    });
    brand.insertBefore(logo,mark);
  }
  const remoteRoot=this._remotePortal?.shadowRoot;
  if (remoteRoot&&!remoteRoot.querySelector('#tp-brand-remote-v0319')) {
    const style=document.createElement('style');
    style.id='tp-brand-remote-v0319';
    style.textContent=TP_BRAND_REMOTE_CSS;
    remoteRoot.appendChild(style);
  }
  root.querySelector('.tp-version-badge')?.replaceChildren('Card v0.3.19');
  // The previous setConfig built the guide before this module installed the
  // style and reference additions. Paint any newly available channel logos.
  this._renderGuide();
};

const tpPriorBrandEditor = TP_BRAND_EDITOR.prototype._draw;
TP_BRAND_EDITOR.prototype._draw = function() {
  tpPriorBrandEditor.call(this);
  const root=this.shadowRoot;
  if (!root || !this._config || root.querySelector('#tp-logo-editor-v0319')) return;
  const group=document.createElement('div');
  group.id='tp-logo-editor-v0319';group.className='group';
  const heading=document.createElement('strong');heading.textContent='Channel logo override';
  const number=document.createElement('input');number.type='number';number.min='1';number.max='9999';number.placeholder='Totalplay channel number';
  const url=document.createElement('input');url.type='url';url.placeholder='https://example.com/channel-logo.png';
  const hint=document.createElement('p');hint.className='help';hint.textContent='Leave URL blank to use EPG artwork or channel initials. Only HTTPS images are accepted.';
  const feedback=document.createElement('p');feedback.className='help';
  const existing=()=>{
    const match=(this._config.channels||[]).find(ch=>String(ch.number)===String(number.value));
    url.value=match?.logo_url||'';
  };
  number.addEventListener('change',existing);
  const save=document.createElement('button');save.type='button';save.textContent='Save channel logo';
  save.addEventListener('click',()=>{
    const n=String(number.value||'').trim();
    if (!/^[0-9]{1,4}$/.test(n)||Number(n)<1) {feedback.textContent='Enter a valid channel number.';return;}
    const artwork=String(url.value||'').trim();
    if (artwork&&!tpSafeArtwork(artwork)) {feedback.textContent='Enter an HTTPS image URL.';return;}
    const channels=[...(this._config.channels||[])];
    const i=channels.findIndex(ch=>String(ch.number)===n);
    if(i>=0)channels[i]={...channels[i],logo_url:artwork};
    else if(artwork)channels.push({number:n,logo_url:artwork});
    this._change({channels});
    feedback.textContent=`Logo saved for channel ${n}.`;
  });
  group.append(heading,number,url,hint,save,feedback);
  root.appendChild(group);
};
