/* v0.3.63: Keep the existing Totalplay guide and popup intact; expose the
 * actual card appearance selector in both visual editors, including older
 * browser-cached editor modules in the historical import chain.
 */
import './totalplay-stb-v0357.js?v=0.3.63';

const TP63_FULL = customElements.get('totalplay-stb-card');
const TP63_POPUP = customElements.get('totalplay-stb-popup-card');
const TP63_EDITOR = customElements.get('totalplay-stb-card-editor');
const TP63_POPUP_EDITOR = customElements.get('totalplay-stb-popup-card-editor');
if (!TP63_FULL || !TP63_POPUP || !TP63_EDITOR) {
  throw new Error('Totalplay full card, popup or visual editor was not loaded');
}
const tp63Theme = value => ['system', 'light', 'dark'].includes(value) ? value : 'system';
const tp63Palettes = {
  light: {'--card-background-color':'#ffffff','--ha-card-background':'#ffffff','--primary-text-color':'#182436','--secondary-text-color':'#58697d','--secondary-background-color':'#edf2f7','--divider-color':'#d8e0e9','--ha-card-border-color':'#d8e0e9','--tp-bg':'#ffffff','--tp-ink':'#182436','--tp-muted':'#58697d','--tp-edge':'#d8e0e9'},
  dark: {'--card-background-color':'#171b24','--ha-card-background':'#171b24','--primary-text-color':'#f2f5fb','--secondary-text-color':'#aab6c8','--secondary-background-color':'#283142','--divider-color':'#465267','--ha-card-border-color':'#465267','--tp-bg':'#171b24','--tp-ink':'#f2f5fb','--tp-muted':'#aab6c8','--tp-edge':'#465267'},
};
function tp63ApplyTheme(target, selected) {
  if (!target) return;
  for (const key of Object.keys(tp63Palettes.light)) target.style.removeProperty(key);
  target.style.removeProperty('color-scheme');
  const chosen = tp63Palettes[tp63Theme(selected)];
  if (!chosen) return; // System inherits Home Assistant's theme.
  for (const [name, value] of Object.entries(chosen)) target.style.setProperty(name,value);
  target.style.setProperty('color-scheme',tp63Theme(selected));
}
if (typeof window.tpApplyCardTheme !== 'function') window.tpApplyCardTheme = tp63ApplyTheme;

function tp63ThemeField(root) {
  return [...(root?.querySelectorAll('label.edit-field') || [])]
    .find(label => label.querySelector(':scope > span')?.textContent?.trim() === 'Theme' && label.querySelector('select')) || null;
}
function tp63MakeSelect(value, callback) {
  const select = document.createElement('select');
  select.dataset.tp63Theme = 'true';
  for (const [id, title] of [['system','System (Home Assistant)'], ['light','Light'], ['dark','Dark']]) {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = title;
    select.appendChild(option);
  }
  select.value = tp63Theme(value);
  select.addEventListener('change', () => callback(select.value));
  return select;
}

// Some older nested modules were published with fixed query versions; their
// cached editor may not contain the Theme field even after HACS updated.
// Keep the existing field if available; otherwise insert one after Card title.
const tp63BaseEditorDraw = TP63_EDITOR.prototype._draw;
TP63_EDITOR.prototype._draw = function (...args) {
  const result = tp63BaseEditorDraw.apply(this,args);
  const root = this.shadowRoot;
  if (!root || !this._config) return result;
  let field = tp63ThemeField(root);
  if (!field) {
    field = document.createElement('label');
    field.className = 'edit-field';
    const title = document.createElement('span');
    title.textContent = 'Theme';
    field.append(title,tp63MakeSelect(this._config.theme, mode => this._change({theme:mode})));
    const titleField = [...root.querySelectorAll('label.edit-field')]
      .find(label => label.querySelector(':scope > span')?.textContent?.trim() === 'Card title');
    if (titleField) titleField.after(field);
    else root.prepend(field);
  }
  if (this._tp63HideTheme) field.hidden = true; // Popup has its own top-level theme option.
  return result;
};

// Make the popup editor's theme selection immediately visible next to its
// size/button options; its nested full-card editor continues to control the
// same saved theme, but does not show a confusing second selector.
if (TP63_POPUP_EDITOR?.prototype?._draw) {
  const tp63BasePopupDraw = TP63_POPUP_EDITOR.prototype._draw;
  TP63_POPUP_EDITOR.prototype._draw = function (...args) {
    const result = tp63BasePopupDraw.apply(this,args);
    const fields = this.shadowRoot?.querySelector('.tp-popup-fields');
    if (!fields) return result;
    const field = document.createElement('label');
    field.className = 'tp-field';
    const title = document.createElement('span');
    title.textContent = 'Theme';
    const select = tp63MakeSelect(this._config?.theme, mode => this._emit({theme:mode}));
    const help = document.createElement('small');
    help.textContent = 'Choose Light, Dark or the Home Assistant system theme for the button and popup.';
    field.append(title,select,help);
    const heading = fields.querySelector('h3');
    if (heading) heading.after(field);
    else fields.prepend(field);
    if (this._fullEditor) {
      this._fullEditor._tp63HideTheme = true;
      const duplicate = tp63ThemeField(this._fullEditor.shadowRoot);
      if (duplicate) duplicate.hidden = true;
    }
    return result;
  };
}

const tp63OldFullConfig = TP63_FULL.prototype.setConfig;
TP63_FULL.prototype.setConfig = function(config) {
  const result = tp63OldFullConfig.call(this,config);
  tp63ApplyTheme(this,this._config?.theme);
  this.shadowRoot?.querySelector('.tp-version-badge')?.replaceChildren('v0.3.63');
  return result;
};
const tp63OldFullHass = Object.getOwnPropertyDescriptor(TP63_FULL.prototype,'hass')?.set;
if (tp63OldFullHass) {
  Object.defineProperty(TP63_FULL.prototype,'hass',{
    configurable:true,
    set(value){tp63OldFullHass.call(this,value);tp63ApplyTheme(this,this._config?.theme);},
  });
}
const tp63OldPopupConfig = TP63_POPUP.prototype.setConfig;
TP63_POPUP.prototype.setConfig = function(config) {
  const result = tp63OldPopupConfig.call(this,config);
  tp63ApplyTheme(this,this._config?.theme);
  if (this._dialog) tp63ApplyTheme(this._dialog,this._config?.theme);
  return result;
};
const tp63OldPopupOpen = TP63_POPUP.prototype._openPopup;
TP63_POPUP.prototype._openPopup = function(...args) {
  const result = tp63OldPopupOpen.apply(this,args);
  if (this._dialog?.open) tp63ApplyTheme(this._dialog,this._config?.theme);
  return result;
};
