"""Configure a Totalplay decoder, optional power helper, TV and HDMI input."""

import ipaddress

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.const import CONF_HOST, CONF_PORT
from homeassistant.core import callback
from homeassistant.helpers import selector

from .const import DEFAULT_HOST, DEFAULT_PORT, DOMAIN
from .discovery import async_discover_stbs, async_probe_stb
from .display import CONF_POWER_SWITCH, CONF_TV_ENTITY, CONF_TV_SOURCE
from .stb import CONF_STB_MODEL, DEFAULT_NEW_MODEL, STB_MODELS, configured_model

_DISCOVERY_NETWORK = "discovery_network"
_DISCOVERED_HOST = "discovered_host"
_ALLOW_UNVERIFIED = "allow_unverified"


def _tv_selector():
    """Offer connected TVs and other media players."""
    return selector.EntitySelector(selector.EntitySelectorConfig(domain="media_player"))


def _power_selector():
    """The optional power helper is an existing HA switch (e.g. smart plug)."""
    return selector.EntitySelector(selector.EntitySelectorConfig(domain="switch"))


def _source_schema(hass, tv_entity: str, selected: str = "") -> vol.Schema:
    """Use the TV's exact source_list, falling back to manual input text."""
    state = hass.states.get(tv_entity)
    source_list = state.attributes.get("source_list") if state else None
    sources = list(dict.fromkeys(source.strip() for source in source_list
                                 if isinstance(source, str) and source.strip())) if isinstance(source_list, (list, tuple)) else []
    if sources:
        if selected and selected not in sources:
            sources.append(selected)
        return vol.Schema({vol.Required(CONF_TV_SOURCE, default=selected if selected in sources else sources[0]): vol.In(sources)})
    return vol.Schema({vol.Required(CONF_TV_SOURCE, default=selected): str})


class TotalplaySTBConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Locate/verify a decoder, then set up its optional connected hardware."""

    VERSION = 1

    def __init__(self) -> None:
        self._decoder_data: dict = {}
        self._tv_entity = ""
        self._power_switch = ""
        self._discovered: dict[str, str] = {}

    async def _verified_host(self, host: str, allow_unverified: bool = False):
        """Use the exact same read-only identification for auto and manual IPs."""
        port = self._decoder_data[CONF_PORT]
        identity = await async_probe_stb(host, port)
        if identity is None and not allow_unverified:
            return False
        await self.async_set_unique_id(f"{host}:{port}")
        self._abort_if_unique_id_configured()
        self._decoder_data[CONF_HOST] = host
        return True

    async def async_step_user(self, user_input=None):
        """Enter one decoder IP or leave it blank to scan the selected subnet."""
        errors = {}
        if user_input is not None:
            host = user_input.get(CONF_HOST, "").strip()
            port = user_input[CONF_PORT]
            network = user_input.get(_DISCOVERY_NETWORK, "").strip()
            self._decoder_data = {
                CONF_PORT: port,
                CONF_STB_MODEL: user_input[CONF_STB_MODEL],
            }
            if host:
                try:
                    ip = ipaddress.ip_address(host)
                    if ip.version != 4 or not ip.is_private or ip.is_loopback:
                        raise ValueError("Host must be a private IPv4 address")
                except ValueError:
                    errors[CONF_HOST] = "invalid_host"
                else:
                    if await self._verified_host(host, user_input.get(_ALLOW_UNVERIFIED, False)):
                        return await self.async_step_display()
                    errors["base"] = "cannot_identify"
            else:
                try:
                    discovered = await async_discover_stbs(self.hass, port, network)
                except ValueError:
                    errors[_DISCOVERY_NETWORK] = "invalid_network"
                else:
                    if discovered:
                        self._discovered = {
                            device.host: f"{device.name} ({device.host})"
                            for device in discovered
                        }
                        return await self.async_step_discovered()
                    errors["base"] = "no_devices_found"
        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema({
                vol.Optional(CONF_HOST, default=DEFAULT_HOST): str,
                vol.Required(CONF_PORT, default=DEFAULT_PORT): vol.All(vol.Coerce(int), vol.Range(min=1, max=65535)),
                vol.Required(CONF_STB_MODEL, default=DEFAULT_NEW_MODEL): vol.In(STB_MODELS),
                vol.Optional(_DISCOVERY_NETWORK): str,
                vol.Optional(_ALLOW_UNVERIFIED, default=False): bool,
            }),
            errors=errors,
        )

    async def async_step_discovered(self, user_input=None):
        """Let the user choose when multiple decoders answer the scan."""
        errors = {}
        if user_input is not None:
            host = user_input[_DISCOVERED_HOST]
            if host in self._discovered and await self._verified_host(host):
                return await self.async_step_display()
            errors["base"] = "cannot_identify"
        return self.async_show_form(
            step_id="discovered",
            data_schema=vol.Schema({
                vol.Required(_DISCOVERED_HOST): vol.In(self._discovered)
            }),
            errors=errors,
        )

    async def async_step_display(self, user_input=None):
        """Link a display and an optional switch powering the STB."""
        if user_input is not None:
            self._tv_entity = user_input.get(CONF_TV_ENTITY, "") or ""
            self._power_switch = user_input.get(CONF_POWER_SWITCH, "") or ""
            if not self._tv_entity:
                return self._finish("")
            return await self.async_step_source()
        return self.async_show_form(
            step_id="display",
            data_schema=vol.Schema({
                vol.Optional(CONF_TV_ENTITY): _tv_selector(),
                vol.Optional(CONF_POWER_SWITCH): _power_selector(),
            }),
        )

    async def async_step_source(self, user_input=None):
        """Select a real TV input, or enter a manual HDMI name."""
        if user_input is not None:
            source = user_input[CONF_TV_SOURCE].strip()
            if source:
                return self._finish(source)
            return self.async_show_form(
                step_id="source", data_schema=_source_schema(self.hass, self._tv_entity),
                errors={CONF_TV_SOURCE: "invalid_source"},
            )
        return self.async_show_form(
            step_id="source", data_schema=_source_schema(self.hass, self._tv_entity),
        )

    def _finish(self, source: str):
        model = self._decoder_data[CONF_STB_MODEL]
        return self.async_create_entry(
            title=f"Totalplay {model} ({self._decoder_data[CONF_HOST]})",
            data=self._decoder_data,
            options={CONF_TV_ENTITY: self._tv_entity, CONF_TV_SOURCE: source,
                     CONF_POWER_SWITCH: self._power_switch},
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        """Edit the STB model and connected hardware without deleting the entry."""
        return TotalplayOptionsFlow()


class TotalplayOptionsFlow(config_entries.OptionsFlowWithReload):
    """Keep existing TV/source/power selections when changing the STB model."""

    def __init__(self) -> None:
        self._tv_entity = ""
        self._power_switch = ""
        self._model = ""

    def _options(self, source: str) -> dict:
        return {CONF_TV_ENTITY: self._tv_entity, CONF_TV_SOURCE: source,
                CONF_POWER_SWITCH: self._power_switch, CONF_STB_MODEL: self._model}

    async def async_step_init(self, user_input=None):
        if user_input is not None:
            self._model = user_input[CONF_STB_MODEL]
            self._tv_entity = user_input.get(CONF_TV_ENTITY, "") or ""
            self._power_switch = user_input.get(CONF_POWER_SWITCH, "") or ""
            if not self._tv_entity:
                return self.async_create_entry(data=self._options(""))
            return await self.async_step_source()
        existing = self.config_entry.options.get(CONF_TV_ENTITY, "")
        power = self.config_entry.options.get(CONF_POWER_SWITCH, "")
        schema = vol.Schema({
            vol.Required(CONF_STB_MODEL, default=configured_model(self.config_entry)): vol.In(STB_MODELS),
            vol.Optional(CONF_TV_ENTITY): _tv_selector(),
            vol.Optional(CONF_POWER_SWITCH): _power_selector(),
        })
        if existing or power:
            schema = self.add_suggested_values_to_schema(schema, {
                CONF_TV_ENTITY: existing, CONF_POWER_SWITCH: power,
            })
        return self.async_show_form(step_id="init", data_schema=schema)

    async def async_step_source(self, user_input=None):
        if user_input is not None:
            source = user_input[CONF_TV_SOURCE].strip()
            if source:
                return self.async_create_entry(data=self._options(source))
            return self.async_show_form(
                step_id="source", data_schema=_source_schema(self.hass, self._tv_entity),
                errors={CONF_TV_SOURCE: "invalid_source"},
            )
        existing_source = (
            self.config_entry.options.get(CONF_TV_SOURCE, "")
            if self._tv_entity == self.config_entry.options.get(CONF_TV_ENTITY, "") else ""
        )
        return self.async_show_form(
            step_id="source", data_schema=_source_schema(self.hass, self._tv_entity, existing_source),
        )
