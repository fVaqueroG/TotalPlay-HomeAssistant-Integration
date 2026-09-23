/* Popup-only presentation and editor options. The full-size Totalplay card is unchanged. */
const TP_OPTIONS_POPUP = customElements.get('totalplay-stb-popup-card');
if (!TP_OPTIONS_POPUP) throw new Error('Totalplay popup card must load before popup options');

// Use the exact brand asset already used by the full Totalplay card.
const TP_OPTIONS_LOGO = 'https://www.totalplay.com.mx/assetsv2/img/header/totalplay-logoWhite.svg';
const TP_OPTIONS_SIZES = Object.freeze({
  auto: null,
  small: ['680px', '560px'],
  medium: ['960px', '720px'],
  large: ['1250px', '900px'],
  fullscreen: ['calc(100vw - 8px)', 'calc(100dvh - 8px)'],
  custom: null,
});
const TP_OPTIONS_ICON_CHOICES = Object.freeze([
  ['', 'Totalplay logo (default)'],
  ['mdi:television-play', 'TV / Play'],
  ['mdi:television', 'Television'],
  ['mdi:remote-tv', 'TV remote'],
  ['mdi:play-circle-outline', 'Play'],
  ['mdi:view-dashboard', 'Dashboard'],
  ['mdi:video-input-hdmi', 'HDMI'],
  ['mdi:apps', 'Apps'],
]);
const tpOptionsSize = value => Object.hasOwn(TP_OPTIONS_SIZES, value) ? value : 'auto';
const tpOptionsDimension = value => {
  const text = String(value ?? '').trim();
  return /^(?:\d{2,4}px|\d{1,3}(?:vw|vh|dvh|%))$/i.test(text) ? text : '';
};
const tpOptionsIcon = value => {
  const icon = String(value ?? '').trim();
  return /^(?:mdi|hass|hacs):[a-z0-9][a-z0-9-]*$/i.test(icon) ? icon : '';
};

const tpOptionsBaseConfig = TP_OPTIONS_POPUP.prototype.setConfig;
TP_OPTIONS_POPUP.prototype.setConfig = function (config) {
  tpOptionsBaseConfig.call(this, config);
  const root = this.shadowRoot;
  if (!root) return;
  if (!root.querySelector('#tp-popup-options-style')) {
    const style = document.createElement('style');
    style.id = 'tp-popup-options-style';
    style.textContent = `
      .tp-p-logo{display:block;flex:0 0 auto;width:92px;max-width:33%;height:26px;object-fit:contain;object-position:left center}
      .tp-p-icon{display:block;flex:0 0 auto;width:27px;height:27px;color:var(--primary-color,#bc77d6)}
      .tp-p-mark{flex:0 0 auto}
      .tp-p-logo-fallback{font-size:16px;font-weight:850;letter-spacing:-.4px;white-space:nowrap}
    `;
    root.appendChild(style);
  }
  const mark = root.querySelector('.tp-p-mark');
  if (!mark) return;
  const selected = tpOptionsIcon(config.popup_icon);
  if (selected) {
    const icon = document.createElement('ha-icon');
    icon.className = 'tp-p-icon';
    icon.setAttribute('icon', selected);
    icon.setAttribute('aria-hidden', 'true');
    mark.replaceWith(icon);
    return;
  }
  const logo = document.createElement('img');
  logo.className = 'tp-p-logo';
  logo.alt = '';
  logo.decoding = 'async';
  logo.src = TP_OPTIONS_LOGO;
  logo.addEventListener('error', () => {
    if (!logo.isConnected) return;
    const fallback = document.createElement('span');
    fallback.className = 'tp-p-logo-fallback';
    fallback.textContent = 'Totalplay';
    logo.replaceWith(fallback);
  }, {once:true});
  mark.replaceWith(logo);
};

const tpOptionsBaseOpen = TP_OPTIONS_POPUP.prototype._openPopup;
TP_OPTIONS_POPUP.prototype._openPopup = function () {
  tpOptionsBaseOpen.call(this);
  const dialog = this._dialog;
  if (!dialog?.open) return;
  const selected = tpOptionsSize(this._config?.popup_size);
  if (selected === 'auto') return; // Preserve the previous popup's default dimensions.
  let dimensions = TP_OPTIONS_SIZES[selected];
  if (selected === 'custom') dimensions = [
    tpOptionsDimension(this._config?.popup_width) || '1100px',
    tpOptionsDimension(this._config?.popup_height) || '800px',
  ];
  const [width, height] = dimensions;
  // The existing dialog max-size rules keep every preset within the device viewport.
  dialog.style.width = `min(${width}, calc(100vw - 8px))`;
  dialog.style.height = `min(${height}, calc(100dvh - 8px))`;
  if (selected === 'fullscreen') dialog.style.borderRadius = '9px';
  requestAnimationFrame(() => this._popupCard?._tpQueueGuideFit?.());
};

class TotalplayStbPopupEditor extends HTMLElement {
  constructor() {super();this.attachShadow({mode:'open'});}
  setConfig(config) {
    const next={...config};
    const changed=JSON.stringify(this._config)!==JSON.stringify(next);
    this._config=next;
    if(!this._drawn||(changed&&!this.matches(':focus-within')))this._draw();
  }
  set hass(hass) {
    this._hass = hass;
    if (this._fullEditor) this._fullEditor.hass = hass;
  }
  _emit(patch) {
    this._config = {...this._config, ...patch, type:'custom:totalplay-stb-popup-card'};
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: {config: {...this._config}}, bubbles:true, composed:true,
    }));
  }
  _field(title, control, help) {
    const wrap = document.createElement('label');
    wrap.className = 'tp-field';
    const label = document.createElement('span');
    label.textContent = title;
    wrap.append(label, control);
    if (help) {
      const hint = document.createElement('small');
      hint.textContent = help;
      wrap.appendChild(hint);
    }
    return wrap;
  }
  _draw() {
    if(this._drawn&&this.matches(':focus-within'))return;
    this._drawn=true;
    const root = this.shadowRoot;
    root.replaceChildren();
    const style = document.createElement('style');
    style.textContent = `
      :host{display:block;color:var(--primary-text-color)}
      .tp-popup-fields{border:1px solid var(--divider-color,#555);border-radius:12px;padding:12px;margin:8px 0 16px;display:grid;gap:12px}
      .tp-popup-fields h3{font-size:15px;margin:0}
      .tp-field{display:flex;flex-direction:column;gap:5px;font-size:13px}
      .tp-field small{font-size:11px;color:var(--secondary-text-color)}
      input,select{width:100%;min-height:38px;box-sizing:border-box;padding:7px 9px;border:1px solid var(--divider-color,#555);border-radius:9px;background:var(--card-background-color);color:var(--primary-text-color);font:inherit}
      .tp-custom-dimensions{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    `;
    const fields = document.createElement('div');
    fields.className = 'tp-popup-fields';
    const heading = document.createElement('h3');
    heading.textContent = 'Compact card & popup';
    fields.appendChild(heading);

    const name = document.createElement('input');
    name.value = this._config.popup_title || '';
    name.placeholder = this._config.title || 'Totalplay';
    name.addEventListener('change', () => this._emit({popup_title:name.value.trim()}));
    fields.appendChild(this._field('Button / popup title', name, 'Leave empty to use the full card title.'));

    const size = document.createElement('select');
    const choices = [
      ['auto','Automatic (existing default)'], ['small','Small (680 × 560)'],
      ['medium','Medium (960 × 720)'], ['large','Large (1250 × 900)'],
      ['fullscreen','Full screen'], ['custom','Custom width and height'],
    ];
    for (const [value,label] of choices) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      size.appendChild(option);
    }
    size.value = tpOptionsSize(this._config.popup_size);
    fields.appendChild(this._field('Popup size', size, 'All sizes are limited to the available screen; the guide scrolls inside the popup.'));

    const custom = document.createElement('div');
    custom.className = 'tp-custom-dimensions';
    const width = document.createElement('input');
    width.value = this._config.popup_width || '';
    width.placeholder = '1100px';
    width.addEventListener('change', () => {
      const value = tpOptionsDimension(width.value);
      width.setCustomValidity(width.value.trim() && !value ? 'Use e.g. 1100px or 85vw' : '');
      width.reportValidity();
      if (!width.validity.valid) return;
      this._emit({popup_width:value});
    });
    const height = document.createElement('input');
    height.value = this._config.popup_height || '';
    height.placeholder = '800px';
    height.addEventListener('change', () => {
      const value = tpOptionsDimension(height.value);
      height.setCustomValidity(height.value.trim() && !value ? 'Use e.g. 800px or 90dvh' : '');
      height.reportValidity();
      if (!height.validity.valid) return;
      this._emit({popup_height:value});
    });
    custom.append(this._field('Width',width),this._field('Height',height));
    custom.hidden = size.value !== 'custom';
    size.addEventListener('change', () => {
      custom.hidden = size.value !== 'custom';
      this._emit({popup_size:size.value});
    });
    fields.appendChild(custom);

    const icon = document.createElement('select');
    for (const [value,label] of TP_OPTIONS_ICON_CHOICES) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      icon.appendChild(option);
    }
    const currentIcon = tpOptionsIcon(this._config.popup_icon);
    const predefined = TP_OPTIONS_ICON_CHOICES.some(([value]) => value === currentIcon);
    if (!predefined) {
      const other = document.createElement('option');
      other.value = '__custom__'; other.textContent = 'Other icon…'; icon.appendChild(other);
    } else {
      const other = document.createElement('option');
      other.value = '__custom__'; other.textContent = 'Other icon…'; icon.appendChild(other);
    }
    icon.value = predefined ? currentIcon : '__custom__';
    fields.appendChild(this._field('Compact card icon',icon,'No icon selected: show the official Totalplay logo.'));
    const customIcon = document.createElement('input');
    customIcon.placeholder = 'mdi:television-play';
    customIcon.value = predefined ? '' : currentIcon;
    customIcon.hidden = icon.value !== '__custom__';
    customIcon.addEventListener('change', () => {
      const value = tpOptionsIcon(customIcon.value);
      customIcon.setCustomValidity(customIcon.value.trim() && !value ? 'Enter an icon such as mdi:television' : '');
      customIcon.reportValidity();
      if (!customIcon.validity.valid) return;
      this._emit({popup_icon:value});
    });
    icon.addEventListener('change', () => {
      customIcon.hidden = icon.value !== '__custom__';
      if (icon.value !== '__custom__') this._emit({popup_icon:icon.value});
    });
    fields.appendChild(this._field('Custom icon (optional)',customIcon,'Use a Home Assistant icon ID, e.g. mdi:television-play.'));
    root.append(style,fields);

    // Nest the established full-card editor rather than duplicating its fields.
    const full = document.createElement('totalplay-stb-card-editor');
    this._fullEditor = full;
    full.addEventListener('config-changed', event => {
      event.stopPropagation();
      const next = event.detail?.config;
      if (!next) return;
      this._config = {...next,
        popup_title:this._config.popup_title,
        popup_size:this._config.popup_size,
        popup_icon:this._config.popup_icon,
        popup_width:this._config.popup_width,
        popup_height:this._config.popup_height,
      };
      this._emit({});
    });
    root.appendChild(full);
    full.setConfig(this._config);
    if (this._hass) full.hass = this._hass;
  }
}
if (!customElements.get('totalplay-stb-popup-card-editor')) {
  customElements.define('totalplay-stb-popup-card-editor',TotalplayStbPopupEditor);
}
TP_OPTIONS_POPUP.getConfigElement = function () {
  return document.createElement('totalplay-stb-popup-card-editor');
};
