/* v0.3.44: Use backend-cached Totalplay brand assets for popup triggers.
 * Horizontal: Totalplay site wordmark.
 * Vertical: Wikimedia Logo_TotalPlay.svg supplied by the user.
 * Icon: Totalplay icon-only artwork supplied by the user, unless an HA icon is selected.
 */
const TP44_POPUP = customElements.get('totalplay-stb-popup-card');
const TP44_EDITOR = customElements.get('totalplay-stb-popup-card-editor');
if (!TP44_POPUP || !TP44_EDITOR) throw new Error('Totalplay popup components unavailable');

const TP44_ASSETS = Object.freeze({
  horizontal_logo: {
    local: '/totalplay_stb/artwork/brand/totalplay',
    remote: 'https://www.totalplay.com.mx/assetsv2/img/header/totalplay-logoWhite.svg',
  },
  vertical_logo: {
    local: '/totalplay_stb/artwork/brand/vertical',
    remote: 'https://upload.wikimedia.org/wikipedia/commons/b/bf/Logo_TotalPlay.svg',
  },
  icon: {
    local: '/totalplay_stb/artwork/brand/icon',
    remote: 'https://yt3.googleusercontent.com/ytc/AIdro_n3v9pBXNjsF96o5V5Gv3HTk1a3NgyNoWwLVYlJ_rdZy6k=s160-c-k-c0x00ffffff-no-rj',
  },
});

const tp44Mode = config => {
  const mode = config?.popup_button_style;
  return ['vertical_logo', 'horizontal_logo', 'icon'].includes(mode)
    ? mode : 'horizontal_logo';
};
const tp44CustomIcon = value => {
  const icon = String(value || '').trim();
  return /^(?:mdi|hass|hacs):[a-z0-9][a-z0-9-]*$/i.test(icon) ? icon : '';
};
const tp44Image = (mode) => {
  const source = TP44_ASSETS[mode];
  const image = document.createElement('img');
  image.className = `tp44-brand-image tp44-${mode}-image`;
  image.alt = '';
  image.decoding = 'async';
  image.loading = 'eager';
  image.src = source.local;
  let triedRemote = false;
  image.addEventListener('error', () => {
    if (!image.isConnected) return;
    if (!triedRemote) {
      triedRemote = true;
      image.src = source.remote;
      return;
    }
    const fallback = document.createElement('span');
    fallback.className = 'tp42-wordmark-fallback';
    fallback.textContent = mode === 'icon' ? '▶' : 'Totalplay';
    image.replaceWith(fallback);
  });
  return image;
};

const TP44_STYLE = `
  .tp44-brand-image{display:block;object-fit:contain;flex:0 0 auto}
  :host([data-popup-brand="horizontal_logo"]) .tp44-horizontal_logo-image{
    width:130px;height:34px;max-width:46vw
  }
  :host([data-popup-brand="vertical_logo"]) button{
    width:106px;min-width:106px;min-height:108px;padding:8px
  }
  :host([data-popup-brand="vertical_logo"]) .tp44-vertical_logo-image{
    width:88px;height:88px
  }
  :host([data-popup-brand="icon"]) .tp44-icon-image{
    width:42px;height:42px;border-radius:10px
  }
  :host([data-popup-brand="icon"]) .tp44-ha-icon{
    width:31px;height:31px;color:var(--primary-color,#bc77d6)
  }
  :host([data-popup-brand="icon"][data-popup-icon-text="no"]) button{
    min-width:62px;min-height:58px;justify-content:center
  }
  :host([data-popup-brand="icon"][data-popup-icon-text="yes"]) ha-card{width:100%}
  :host([data-popup-brand="icon"][data-popup-icon-text="yes"]) button{
    width:100%;min-width:0;min-height:58px;justify-content:flex-start
  }
  :host([data-popup-brand="icon"][data-popup-icon-text="yes"]) .tp-p-title{
    display:block!important;flex:1 1 auto;min-width:0;overflow:hidden;
    text-overflow:ellipsis;white-space:nowrap
  }
  :host([data-popup-brand="icon"][data-popup-icon-text="yes"]) .tp-p-expand{
    display:block!important;flex:0 0 auto
  }
`;

const tp44PriorConfig = TP44_POPUP.prototype.setConfig;
TP44_POPUP.prototype.setConfig = function(config) {
  tp44PriorConfig.call(this, config);
  const root = this.shadowRoot;
  const button = this._button;
  if (!root || !button) return;

  if (!root.querySelector('#tp44-real-brand-assets')) {
    const style = document.createElement('style');
    style.id = 'tp44-real-brand-assets';
    style.textContent = TP44_STYLE;
    root.appendChild(style);
  }

  const mode = tp44Mode(config);
  const existing = button.querySelector(
    '.tp42-brand,.tp44-brand,.tp-p-mark,.tp-p-logo,.tp-p-icon,.tp-p-logo-fallback'
  );
  const brand = document.createElement('span');
  brand.className = `tp42-brand tp44-brand tp44-${mode}`;
  brand.setAttribute('aria-hidden', 'true');

  if (mode === 'icon') {
    const selected = tp44CustomIcon(config.popup_icon);
    if (selected) {
      const icon = document.createElement('ha-icon');
      icon.className = 'tp44-ha-icon';
      icon.setAttribute('icon', selected);
      brand.appendChild(icon);
    } else {
      brand.appendChild(tp44Image('icon'));
    }
  } else {
    brand.appendChild(tp44Image(mode));
  }

  if (existing) existing.replaceWith(brand);
  else button.prepend(brand);

  const showText = mode === 'icon' && config.popup_icon_with_text === true;
  this.setAttribute('data-popup-trigger', mode);
  this.setAttribute('data-popup-brand', mode);
  this.setAttribute('data-popup-icon-text', showText ? 'yes' : 'no');
  button.setAttribute(
    'aria-label',
    `Open ${config.popup_title || config.title || 'Totalplay'} guide and remote`
  );
};

const tp44PriorDraw = TP44_EDITOR.prototype._draw;
TP44_EDITOR.prototype._draw = function() {
  tp44PriorDraw.call(this);
  const fields = this.shadowRoot?.querySelector('.tp-popup-fields');
  if (!fields) return;

  const findField = name => [...fields.querySelectorAll('label.tp-field')]
    .find(field => field.querySelector(':scope > span')?.textContent?.trim() === name);
  const iconField = findField('Compact card icon');
  const customField = findField('Custom icon (optional)');

  if (iconField) {
    const select = iconField.querySelector('select');
    const first = select?.querySelector('option[value=""]');
    if (first) first.textContent = 'Totalplay icon logo (default)';
    const hint = iconField.querySelector('small');
    if (hint) hint.textContent =
      'Leave this on Totalplay icon logo, or choose a Home Assistant icon.';
  }

  const graphicField = findField('Button graphic');
  const graphicHelp = graphicField?.querySelector('small');
  if (graphicHelp) graphicHelp.textContent =
    'Vertical, Horizontal and the default Icon use backend-cached Totalplay artwork.';

  const mode = tp44Mode(this._config);
  if (iconField) iconField.hidden = mode !== 'icon';
  if (customField) customField.hidden = mode !== 'icon';
};
