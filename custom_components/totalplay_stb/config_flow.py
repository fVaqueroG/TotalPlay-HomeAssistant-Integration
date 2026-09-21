"""Configure a Totalplay decoder and the television input it uses."""

import asyncio
import ipaddress

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.const import CONF_HOST, CONF_PORT
from homeassistant.core import callback
from homeassistant.helpers import selector

from .const import DEFAULT_HOST, DEFAULT_PORT, DOMAIN
from .display import CONF_TV_ENTITY, CONF_TV_SOURCE


def _tv_selector():
    """Offer existing media players as possible connected displays."""
    return selector.EntitySelector(selector.EntitySelectorConfig(domain="media_player"))


def _source_schema(hass, tv_entity: str, selected: str = "") -> vol.Schema:
    """Choose from the TV's reported HDMI/source list when it is available."""
    state = hass.states.get(tv_entity)
    source_list = state.attributes.get("source_list") if state else None
    sources = [source for source in source_list if isinstance(source, str) and source.strip()] if isinstance(source_list, (list, tuple)) else []
    if sources:
        # Retain an existing choice when a temporarily unavailable TV stops listing it.
        if selected and selected not in sources:
            sources.append(selected)
        return vol.Schema({vol.Required(CONF_TV_SOURCE, default=selected if selected in sources else sources[0]): vol.In(sources)})
    return vol.Schema({vol.Required(CONF_TV_SOURCE, default=selected): str})


class TotalplaySTBConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Set up decoder networking, then optionally link its connected TV/input."""

    VERSION = 1

    def __init__(self) -> None:
        self._decoder_data: dict = {}
        self._tv_entity = ""

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
        """Ask which television/media player the STB is physically connected to."""
        if user_input is not None:
            self._tv_entity = user_input.get(CONF_TV_ENTITY, "")
            if not self._tv_entity:
                return self._finish("")
            return await self.async_step_source()
        return self.async_show_form(
            step_id="display",
            data_schema=vol.Schema({vol.Optional(CONF_TV_ENTITY): _tv_selector()}),
        )

    async def async_step_source(self, user_input=None):
        """Choose the TV input used by the decoder."""
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
            options={CONF_TV_ENTITY: self._tv_entity, CONF_TV_SOURCE: source},
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        """Allow users with an existing STB to set/change its connected TV."""
        return TotalplayOptionsFlow()


class TotalplayOptionsFlow(config_entries.OptionsFlowWithReload):
    """Edit the connected TV and input without deleting/re-pairing the STB."""

    def __init__(self) -> None:
        self._tv_entity = ""

    async def async_step_init(self, user_input=None):
        if user_input is not None:
            self._tv_entity = user_input.get(CONF_TV_ENTITY, "")
            if not self._tv_entity:
                return self.async_create_entry(data={CONF_TV_ENTITY: "", CONF_TV_SOURCE: ""})
            return await self.async_step_source()
        existing = self.config_entry.options.get(CONF_TV_ENTITY, "")
        schema = vol.Schema({vol.Optional(CONF_TV_ENTITY): _tv_selector()})
        if existing:
            schema = self.add_suggested_values_to_schema(schema, {CONF_TV_ENTITY: existing})
        return self.async_show_form(step_id="init", data_schema=schema)

    async def async_step_source(self, user_input=None):
        if user_input is not None:
            source = user_input[CONF_TV_SOURCE].strip()
            if source:
                return self.async_create_entry(data={CONF_TV_ENTITY: self._tv_entity, CONF_TV_SOURCE: source})
            return self.async_show_form(
                step_id="source", data_schema=_source_schema(self.hass, self._tv_entity),
                errors={CONF_TV_SOURCE: "invalid_source"},
            )
        existing_source = (
            self.config_entry.options.get(CONF_TV_SOURCE, "")
            if self._tv_entity == self.config_entry.options.get(CONF_TV_ENTITY, "")
            else ""
        )
        return self.async_show_form(
            step_id="source", data_schema=_source_schema(self.hass, self._tv_entity, existing_source),
        )
