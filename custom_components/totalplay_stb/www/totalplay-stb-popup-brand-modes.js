/* Popup trigger branding v0.3.42. Reuse the official Totalplay wordmark
 * from the full card; arrange it vertically without a separate remote asset.
 * The size presets, guide, EPG and full card are untouched.
 */
const TP42_POPUP = customElements.get('totalplay-stb-popup-card');
const TP42_EDITOR = customElements.get('totalplay-stb-popup-card-editor');
if (!TP42_POPUP || !TP42_EDITOR) throw new Error('Totalplay popup components unavailable');

const TP42_LOGO = 'https://www.totalplay.com.mx/assetsv2/img/header/totalplay-logoWhite.svg';
const TP42_DEFAULT_ICON = 'mdi:television-play';
const tp42Icon = value => /^(?:mdi|hass|hacs):[a-z0-9][a-z0-9-]*$/i.test(String(value || '').trim())
  ? String(value).trim() : TP42_DEFAULT_ICON;
const tp42Mode = config => {
  const value = config?.popup_button_style;
  if (value === 'vertical_logo' || value === 'horizontal_logo' || value === 'icon') return value;
  // Accept prior v0.3.40/41 configurations without breaking their chosen icon.
  return (value === 'icon_only' || value === 'labelled') && config?.popup_icon
    ? 'icon' : 'horizontal_logo';
};
const tp42LogoImage = () => {
  const image = document.createElement('img');
  image.className = 'tp42-logo';
  image.alt = '';
  image.decoding = 'async';
  image.src = TP42_LOGO;
  image.addEventListener('error', () => {
    if (!image.isConnected) return;
    const fallback = document.createElement('span');
    fallback.className = 'tp42-wordmark-fallback';
    fallback.textContent = 'totalplay';
    image.replaceWith(fallback);
  }, {once:true});
  return image;
};
const TP42_CSS = `
  :host([data-popup-brand]) ha-card{width:fit-content;max-width:100%;min-width:0}
  :host([data-popup-brand]) button{width:100%;min-width:62px;gap:10px;
    padding:9px 12px;justify-content:center}
  :host([data-popup-brand]) .tp-p-title,
  :host([data-popup-brand]) .tp-p-expand{display:none!important}
  .tp42-brand{display:flex;align-items:center;justify-content:center;flex:0 0 auto;min-width:0}
  .tp42-horizontal{width:130px;height:34px}
  .tp42-logo{display:block;width:100%;height:100%;object-fit:contain}
  .tp42-wordmark-fallback{font-size:17px;font-weight:800;white-space:nowrap;letter-spacing:-.4px}
  :host([data-popup-brand="vertical_logo"]) button{min-width:106px;min-height:100px;padding:10px 12px}
  .tp42-vertical{width:100px;min-height:76px;flex-direction:column;gap:8px}
  .tp42-vertical-symbol{display:flex;justify-content:center;align-items:center;height:33px;
    gap:0;line-height:1;letter-spacing:-8px;font-size:32px;padding-right:8px}
  .tp42-vertical-symbol span:first-child{color:#e9458a}
  .tp42-vertical-symbol span:last-child{color:#f3c853}
  .tp42-vertical .tp42-logo{width:100px;height:26px}
  :host([data-popup-brand="horizontal_logo"]) button{min-height:54px}
  :host([data-popup-brand="icon"]) .tp42-icon{width:30px;height:30px;color:var(--primary-color,#bc77d6)}
  :host([data-popup-brand="icon"][data-popup-icon-text="yes"]) ha-card{width:100%}
  :host([data-popup-brand="icon"][data-popup-icon-text="yes"]) button{
    justify-content:flex-start;min-height:54px;min-width:0}
  :host([data-popup-brand="icon"][data-popup-icon-text="yes"]) .tp-p-title{
    display:block!important;flex:1 1 auto;min-width:0;overflow:hidden;
    text-overflow:ellipsis;white-space:nowrap}
  :host([data-popup-brand="icon"][data-popup-icon-text="yes"]) .tp-p-expand{
    display:block!important;flex:0 0 auto}
`;

const tp42PreviousConfig = TP42_POPUP.prototype.setConfig;
TP42_POPUP.prototype.setConfig = function (config) {
  tp42PreviousConfig.call(this, config);
  const button = this._button;
  const root = this.shadowRoot;
  if (!button || !root) return;
  if (!root.querySelector('#tp42-brand-css')) {
    const style = document.createElement('style');
    style.id = 'tp42-brand-css';
    style.textContent = TP42_CSS;
    root.appendChild(style);
  }
  const mode = tp42Mode(config);
  const brand = document.createElement('span');
  brand.setAttribute('aria-hidden', 'true');
  brand.className = `tp42-brand tp42-${mode}`;
  if (mode === 'icon') {
    const icon = document.createElement('ha-icon');
    icon.className = 'tp42-icon';
    icon.setAttribute('icon', tp42Icon(config.popup_icon));
    brand.appendChild(icon);
  } else if (mode === 'vertical_logo') {
    // A vertical lockup using the same source logo as the full-size card.
    const symbol = document.createElement('span');
    symbol.className = 'tp42-vertical-symbol';
    for (const glyph of ['◀', '▶']) {
      const half = document.createElement('span');
      half.textContent = glyph;
      symbol.appendChild(half);
    }
    brand.append(symbol, tp42LogoImage());
  } else {
    brand.appendChild(tp42LogoImage());
  }
  const previous = button.querySelector(
    '.tp-p-mark, .tp-p-logo, .tp-p-icon, .tp-p-logo-fallback, .tp42-brand');
  if (previous) previous.replaceWith(brand);
  else button.prepend(brand);
  this.setAttribute('data-popup-trigger', mode);
  this.setAttribute('data-popup-brand', mode);
  const showText = mode === 'icon' && (config.popup_icon_with_text === true ||
    (config.popup_icon_with_text == null && config.popup_button_style === 'labelled'));
  this.setAttribute('data-popup-icon-text', showText ? 'yes' : 'no');
  button.setAttribute('aria-label', `Open ${config.popup_title || config.title || 'Totalplay'} guide and remote`);
};

const tp42PreviousDraw = TP42_EDITOR.prototype._draw;
TP42_EDITOR.prototype._draw = function () {
  tp42PreviousDraw.call(this);
  const fields = this.shadowRoot?.querySelector('.tp-popup-fields');
  if (!fields) return;
  const findField = name => [...fields.querySelectorAll('label.tp-field')]
    .find(field => field.querySelector(':scope > span')?.textContent?.trim() === name);
  findField('Button layout')?.remove();
  const iconSelectorField = findField('Compact card icon');
  const customIconField = findField('Custom icon (optional)');
  const modeField = document.createElement('label');
  modeField.className = 'tp-field';
  const heading = document.createElement('span');
  heading.textContent = 'Button graphic';
  const modeSelect = document.createElement('select');
  for (const [value, label] of [
    ['vertical_logo', 'Vertical Logo'],
    ['horizontal_logo', 'Horizontal Logo'],
    ['icon', 'Icon'],
  ]) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    modeSelect.appendChild(option);
  }
  modeSelect.value = tp42Mode(this._config);
  modeField.append(heading, modeSelect);
  const help = document.createElement('small');
  help.textContent = 'Vertical and horizontal modes use the Totalplay logo.';
  modeField.appendChild(help);
  const sizeField = findField('Popup size');
  fields.insertBefore(modeField, sizeField || fields.querySelector('h3')?.nextSibling || null);

  const textField = document.createElement('label');
  textField.className = 'tp-field tp42-icon-text-field';
  const textRow = document.createElement('span');
  textRow.style.cssText = 'display:flex;align-items:center;gap:9px';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.style.cssText = 'width:18px;height:18px;min-height:18px;flex:none';
  checkbox.checked = this._config.popup_icon_with_text === true ||
    (this._config.popup_icon_with_text == null && this._config.popup_button_style === 'labelled' && !!this._config.popup_icon);
  textRow.append(checkbox, document.createTextNode('Show text next to icon'));
  textField.appendChild(textRow);
  const textHint = document.createElement('small');
  textHint.textContent = 'Uses the Button / popup title above.';
  textField.appendChild(textHint);
  if (customIconField) customIconField.after(textField);
  else if (iconSelectorField) iconSelectorField.after(textField);
  else modeField.after(textField);

  const updateVisibility = () => {
    const active = modeSelect.value === 'icon';
    if (iconSelectorField) iconSelectorField.hidden = !active;
    if (customIconField) customIconField.hidden = !active;
    textField.hidden = !active;
  };
  const hidingStyle = document.createElement('style');
  hidingStyle.textContent = '.tp-field[hidden]{display:none!important}';
  fields.appendChild(hidingStyle);
  updateVisibility();
  modeSelect.addEventListener('change', () => {
    updateVisibility();
    this._emit({popup_button_style:modeSelect.value});
  });
  checkbox.addEventListener('change', () => this._emit({popup_icon_with_text:checkbox.checked}));
};
