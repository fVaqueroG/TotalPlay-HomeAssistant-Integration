"""Configure a Totalplay decoder, optional power helper, TV and HDMI input."""

import asyncio
import ipaddress

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.const import CONF_HOST, CONF_PORT
from homeassistant.core import callback
from homeassistant.helpers import selector

from .const import DEFAULT_HOST, DEFAULT_PORT, DOMAIN
from .display import CONF_POWER_SWITCH, CONF_TV_ENTITY, CONF_TV_SOURCE


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
        # Keep the selected source when the TV is temporarily unavailable or
        # reports a changed source list, so reconfiguration never erases it.
        if selected and selected not in sources:
            sources.append(selected)
        return vol.Schema({vol.Required(CONF_TV_SOURCE, default=selected if selected in sources else sources[0]): vol.In(sources)})
    return vol.Schema({vol.Required(CONF_TV_SOURCE, default=selected): str})


class TotalplaySTBConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Set up decoder networking and optional connected hardware."""

    VERSION = 1

    def __init__(self) -> None:
        self._decoder_data: dict = {}
        self._tv_entity = ""
        self._power_switch = ""

    async def async_step_user(self, user_input=None):
        """Validate the host and check TCP reachability before saving."""
        errors = {}
        if user_input is not None:
            host = user_input[CONF_HOST].strip()
            port = user_input[CONF_PORT]
            try:
                ip = ipaddress.ip_address(host)
                if ip.version != 4 or not ip.is_private or ip.is_loopback:
                    raise ValueError("Host must be a private IPv4 address")
            except ValueError:
                errors[CONF_HOST] = "invalid_host"
            else:
                await self.async_set_unique_id(f"{host}:{port}")
                self._abort_if_unique_id_configured()
                writer = None
                try:
                    _, writer = await asyncio.wait_for(asyncio.open_connection(host, port), timeout=3)
                except (OSError, asyncio.TimeoutError):
                    errors["base"] = "cannot_connect"
                else:
                    self._decoder_data = {CONF_HOST: host, CONF_PORT: port}
                    return await self.async_step_display()
                finally:
                    if writer is not None:
                        writer.close()
                        try:
                            await writer.wait_closed()
                        except OSError:
                            pass
        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema({
                vol.Required(CONF_HOST, default=DEFAULT_HOST): str,
                vol.Required(CONF_PORT, default=DEFAULT_PORT): vol.All(vol.Coerce(int), vol.Range(min=1, max=65535)),
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
        return self.async_create_entry(
            title=f"Totalplay STB {self._decoder_data[CONF_HOST]}",
            data=self._decoder_data,
            options={CONF_TV_ENTITY: self._tv_entity, CONF_TV_SOURCE: source,
                     CONF_POWER_SWITCH: self._power_switch},
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        """Edit the connected hardware without deleting/re-pairing the STB."""
        return TotalplayOptionsFlow()


class TotalplayOptionsFlow(config_entries.OptionsFlowWithReload):
    """Preserve existing TV/source/power selections when changing one option."""

    def __init__(self) -> None:
        self._tv_entity = ""
        self._power_switch = ""

    async def async_step_init(self, user_input=None):
        if user_input is not None:
            self._tv_entity = user_input.get(CONF_TV_ENTITY, "") or ""
            self._power_switch = user_input.get(CONF_POWER_SWITCH, "") or ""
            if not self._tv_entity:
                return self.async_create_entry(data={CONF_TV_ENTITY: "", CONF_TV_SOURCE: "",
                                                     CONF_POWER_SWITCH: self._power_switch})
            return await self.async_step_source()
        existing = self.config_entry.options.get(CONF_TV_ENTITY, "")
        power = self.config_entry.options.get(CONF_POWER_SWITCH, "")
        schema = vol.Schema({vol.Optional(CONF_TV_ENTITY): _tv_selector(),
                             vol.Optional(CONF_POWER_SWITCH): _power_selector()})
        if existing or power:
            schema = self.add_suggested_values_to_schema(schema, {
                CONF_TV_ENTITY: existing, CONF_POWER_SWITCH: power,
            })
        return self.async_show_form(step_id="init", data_schema=schema)

    async def async_step_source(self, user_input=None):
        if user_input is not None:
            source = user_input[CONF_TV_SOURCE].strip()
            if source:
                return self.async_create_entry(data={CONF_TV_ENTITY: self._tv_entity,
                                                     CONF_TV_SOURCE: source,
                                                     CONF_POWER_SWITCH: self._power_switch})
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
