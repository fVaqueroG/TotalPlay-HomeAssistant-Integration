/* Totalplay STB dashboard card. Bundled with the integration; no remote CDN. */
const STYLE = `
  :host { display: block; }
  ha-card { padding: 16px; }
  .header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
  .heading { font-size: 19px; font-weight: 600; }
  .source { font-size: 12px; color: var(--secondary-text-color); text-align: right; }
  .section-title { font-weight: 600; font-size: 14px; margin: 16px 0 9px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 9px; }
  .tile { appearance: none; display: flex; flex-direction: column; align-items: flex-start; justify-content: space-between; gap: 6px;
    min-height: 104px; border: 1px solid var(--divider-color); border-radius: 12px; background: var(--card-background-color);
    color: var(--primary-text-color); text-align: left; padding: 12px; cursor: pointer; font: inherit; }
  .tile:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
  .tile:disabled { opacity: .5; cursor: not-allowed; }
  .tile .number { font-weight: 700; color: var(--primary-color); font-size: 23px; line-height: 1; }
  .tile .name { font-weight: 600; font-size: 14px; overflow-wrap: anywhere; }
  .tile .program { color: var(--secondary-text-color); font-size: 12px; overflow-wrap: anywhere; }
  .tile.app { min-height: 80px; }
  .tile .appicon { color: var(--primary-color); font-size: 18px; font-weight: 800; }
  .empty, .note { font-size: 12px; color: var(--secondary-text-color); }
  .feedback { font-size: 12px; margin-top: 10px; color: var(--secondary-text-color); min-height: 15px; }
  .feedback.error { color: var(--error-color); }
`;

class TotalplayStbCard extends HTMLElement {
  setConfig(config) {
    if (!config || typeof config.entity !== "string" || !config.entity.startsWith("media_player.")) {
      throw new Error("Totalplay STB card requires entity: media_player.your_totalplay_entity");
    }
    this._config = {
      title: "Totalplay TV",
      channels: [{ number: "101", name: "Channel 101" }],
      apps: [{ id: "netflix", name: "Netflix" }],
      ...config,
    };
    if (!Array.isArray(this._config.channels) || !Array.isArray(this._config.apps)) {
      throw new Error("channels and apps must be lists");
    }
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this._build();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  getCardSize() { return 4; }

  _el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  _build() {
    const root = this.shadowRoot;
    root.replaceChildren();
    root.appendChild(this._el("style", "", STYLE));
    const card = this._el("ha-card");
    const header = this._el("div", "header");
    header.appendChild(this._el("div", "heading", this._config.title));
    this._sourceEl = this._el("div", "source");
    header.appendChild(this._sourceEl);
    card.appendChild(header);

    card.appendChild(this._el("div", "section-title", "Channels"));
    const channels = this._el("div", "grid");
    this._programEls = [];
    for (const channel of this._config.channels) {
      const number = String(channel.number ?? "").trim();
      if (!/^[0-9]{1,4}$/.test(number) || Number(number) === 0) continue;
      const tile = this._el("button", "tile");
      tile.type = "button";
      tile.appendChild(this._el("div", "number", number));
      tile.appendChild(this._el("div", "name", String(channel.name || `Channel ${number}`)));
      const program = this._el("div", "program", "Program information unavailable");
      tile.appendChild(program);
      this._programEls.push({ channel, program });
      tile.addEventListener("click", () => this._play("channel", number));
      channels.appendChild(tile);
    }
    if (!channels.childElementCount) channels.appendChild(this._el("div", "empty", "Add channels in the card configuration."));
    card.appendChild(channels);

    card.appendChild(this._el("div", "section-title", "Apps"));
    const apps = this._el("div", "grid");
    for (const app of this._config.apps) {
      const id = String(app.id || "").trim().toLowerCase();
      const tile = this._el("button", "tile app");
      tile.type = "button";
      tile.appendChild(this._el("div", "appicon", id === "netflix" ? "N" : "▣"));
      tile.appendChild(this._el("div", "name", String(app.name || id || "App")));
      if (id === "netflix") tile.addEventListener("click", () => this._play("app", "netflix"));
      else {
        tile.disabled = true;
        tile.title = "This app has no verified Totalplay launch sequence yet";
        tile.appendChild(this._el("div", "note", "Not configured"));
      }
      apps.appendChild(tile);
    }
    if (!apps.childElementCount) apps.appendChild(this._el("div", "empty", "No apps configured."));
    card.appendChild(apps);
    this._feedback = this._el("div", "feedback");
    this._feedback.setAttribute("role", "status");
    card.appendChild(this._feedback);
    root.appendChild(card);
    this._render();
  }

  _render() {
    if (!this._hass || !this._config || !this._sourceEl) return;
    const decoder = this._hass.states[this._config.entity];
    if (!decoder) {
      this._sourceEl.textContent = "Decoder entity unavailable";
    } else {
      const tvEntity = decoder.attributes.connected_tv_entity;
      const wanted = decoder.attributes.connected_tv_source;
      const tv = tvEntity ? this._hass.states[tvEntity] : null;
      const actual = tv?.attributes?.source;
      this._sourceEl.textContent = !tvEntity || !wanted
        ? "No TV/input linked"
        : !tv || !actual || actual === "unknown" || actual === "unavailable"
          ? `TV input not reported · target ${wanted}`
          : actual.trim().toLowerCase() === wanted.trim().toLowerCase()
            ? `TV input: ${actual} ✓`
            : `TV input: ${actual} · target ${wanted}`;
    }
    for (const { channel, program } of this._programEls || []) {
      // EPG is only rendered when explicitly backed by a Home Assistant sensor.
      // The requested channel number is not evidence of the currently tuned channel.
      const state = channel.program_entity ? this._hass.states[channel.program_entity] : null;
      const attributes = state?.attributes || {};
      const candidate = attributes.current_program || attributes.program_title || attributes.program || attributes.title || state?.state;
      const title = typeof candidate === "string" ? candidate.trim() : "";
      program.textContent = title && !["unknown", "unavailable", "none"].includes(title.toLowerCase())
        ? `Now: ${title}` : "Program information unavailable";
      if (state && title && attributes.next_program) program.title = `Next: ${String(attributes.next_program)}`;
    }
  }

  async _play(type, id) {
    if (!this._hass || this._busy) return;
    this._busy = true;
    this._feedback.className = "feedback";
    this._feedback.textContent = type === "app" ? "Launching Netflix…" : `Selecting channel ${id}…`;
    try {
      await this._hass.callService("media_player", "play_media", {
        entity_id: this._config.entity,
        media_content_type: type,
        media_content_id: id,
      });
      this._feedback.textContent = type === "app" ? "Netflix launch requested" : `Channel ${id} requested`;
    } catch (error) {
      this._feedback.className = "feedback error";
      this._feedback.textContent = `Totalplay: ${error?.message || "Command failed"}`;
    } finally {
      this._busy = false;
    }
  }
}

if (!customElements.get("totalplay-stb-card")) {
  customElements.define("totalplay-stb-card", TotalplayStbCard);
}
window.customCards = window.customCards || [];
if (!window.customCards.some(card => card.type === "totalplay-stb-card")) {
  window.customCards.push({
    type: "totalplay-stb-card",
    name: "Totalplay Channels & Apps",
    description: "TV channels, sensor-backed program guide and verified app launch controls",
  });
}
