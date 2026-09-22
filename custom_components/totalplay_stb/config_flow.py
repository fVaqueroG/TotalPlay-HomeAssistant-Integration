"""Configure a Totalplay decoder, discovery, model and connected display."""

import ipaddress

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.const import CONF_HOST, CONF_PORT
from homeassistant.core import callback
from homeassistant.helpers import selector

from .const import CONF_MODEL, DEFAULT_HOST, DEFAULT_PORT, DOMAIN, UNKNOWN_MODEL
from .discovery import TotalplaySTB, async_discover_stbs, async_probe_stb
from .display import CONF_POWER_SWITCH, CONF_TV_ENTITY, CONF_TV_SOURCE


def _tv_selector():
    return selector.EntitySelector(selector.EntitySelectorConfig(domain="media_player"))


def _power_selector():
    return selector.EntitySelector(selector.EntitySelectorConfig(domain="switch"))


def _source_schema(hass, tv_entity: str, selected: str = "") -> vol.Schema:
    state = hass.states.get(tv_entity)
    source_list = state.attributes.get("source_list") if state else None
    sources = list(dict.fromkeys(source.strip() for source in source_list
                                 if isinstance(source, str) and source.strip())) if isinstance(source_list, (list, tuple)) else []
    if sources:
        if selected and selected not in sources:
            sources.append(selected)
        return vol.Schema({vol.Required(CONF_TV_SOURCE, default=selected if selected in sources else sources[0]): vol.In(sources)})
    return vol.Schema({vol.Required(CONF_TV_SOURCE, default=selected): str})


def _valid_private_ipv4(host: str) -> bool:
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return False
    return ip.version == 4 and ip.is_private and not ip.is_loopback


class TotalplaySTBConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Discover devices, or accept a manually specified private IP as a fallback."""

    VERSION = 1

    def __init__(self) -> None:
        self._decoder_data: dict = {}
        self._tv_entity = ""
        self._power_switch = ""
        self._discovered: dict[str, TotalplaySTB] = {}

    async def async_step_user(self, user_input=None):
        """Use the same read-only probe for both auto-discovery and manual IPs.

        A negative probe means 'unverified', NOT 'cannot be controlled'. An
        explicitly provided private IP must remain configurable even if the
        decoder's information API is blocked or responds unexpectedly.
        """
        errors = {}
        if user_input is not None:
            host = (user_input.get(CONF_HOST) or "").strip()
            port = user_input[CONF_PORT]
            requested_model = (user_input.get(CONF_MODEL) or "").strip()

            if not host:
                found = await async_discover_stbs(self.hass, port)
                if not found:
                    errors["base"] = "no_stb_found"
                elif len(found) == 1:
                    return await self._accept_probe(found[0], requested_model, identified=True)
                else:
                    self._discovered = {item.host: item for item in found}
                    return await self.async_step_discovered()
            elif not _valid_private_ipv4(host):
                errors[CONF_HOST] = "invalid_host"
            else:
                found = await async_probe_stb(host, port)
                if found is None:
                    # Retain the user-supplied IP. No remote key is sent during
                    # setup, and inability to fetch STB info cannot prove that
                    # the remote-control endpoint is unsupported.
                    found = TotalplaySTB(host=host, port=port)
                    return await self._accept_probe(found, requested_model, identified=False)
                return await self._accept_probe(found, requested_model, identified=True)

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema({
                vol.Optional(CONF_HOST, default=DEFAULT_HOST): str,
                vol.Required(CONF_PORT, default=DEFAULT_PORT): vol.All(vol.Coerce(int), vol.Range(min=1, max=65535)),
                vol.Optional(CONF_MODEL, default=""): str,
            }),
            errors=errors,
        )

    async def async_step_discovered(self, user_input=None):
        if user_input is not None:
            host = user_input[CONF_HOST]
            return await self._accept_probe(self._discovered[host], "", identified=True)

        choices = {
            host: f"{device.model or UNKNOWN_MODEL} — {host}"
            for host, device in self._discovered.items()
        }
        return self.async_show_form(
            step_id="discovered",
            data_schema=vol.Schema({vol.Required(CONF_HOST): vol.In(choices)}),
        )

    async def _accept_probe(self, found: TotalplaySTB, requested_model: str, *, identified: bool):
        model = requested_model or found.model or UNKNOWN_MODEL
        await self.async_set_unique_id(f"{found.host}:{found.port}")
        # Do not overwrite the existing configured model with 'Unknown' when a
        # re-add attempt cannot interrogate the STB information endpoint.
        if requested_model or found.model:
            self._abort_if_unique_id_configured(updates={CONF_MODEL: model})
        else:
            self._abort_if_unique_id_configured()
        self._decoder_data = {
            CONF_HOST: found.host,
            CONF_PORT: found.port,
            CONF_MODEL: model,
            "stb_info_verified": identified,
        }
        return await self.async_step_display()

    async def async_step_display(self, user_input=None):
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
        model = self._decoder_data.get(CONF_MODEL, UNKNOWN_MODEL)
        return self.async_create_entry(
            title=f"Totalplay {model} {self._decoder_data[CONF_HOST]}",
            data=self._decoder_data,
            options={CONF_TV_ENTITY: self._tv_entity, CONF_TV_SOURCE: source,
                     CONF_POWER_SWITCH: self._power_switch},
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        return TotalplayOptionsFlow()


class TotalplayOptionsFlow(config_entries.OptionsFlowWithReload):
    """Edit model and connected hardware without recreating the entry."""

    def __init__(self) -> None:
        self._tv_entity = ""
        self._power_switch = ""
        self._model = ""

    async def async_step_init(self, user_input=None):
        if user_input is not None:
            self._tv_entity = user_input.get(CONF_TV_ENTITY, "") or ""
            self._power_switch = user_input.get(CONF_POWER_SWITCH, "") or ""
            self._model = (user_input.get(CONF_MODEL) or UNKNOWN_MODEL).strip()
            self.hass.config_entries.async_update_entry(
                self.config_entry,
                data={**self.config_entry.data, CONF_MODEL: self._model},
            )
            if not self._tv_entity:
                return self.async_create_entry(data={CONF_TV_ENTITY: "", CONF_TV_SOURCE: "",
                                                     CONF_POWER_SWITCH: self._power_switch})
            return await self.async_step_source()

        existing = self.config_entry.options.get(CONF_TV_ENTITY, "")
        power = self.config_entry.options.get(CONF_POWER_SWITCH, "")
        model = self.config_entry.data.get(CONF_MODEL, UNKNOWN_MODEL)
        schema = vol.Schema({
            vol.Optional(CONF_MODEL, default=model): str,
            vol.Optional(CONF_TV_ENTITY): _tv_selector(),
            vol.Optional(CONF_POWER_SWITCH): _power_selector(),
        })
        if existing or power:
            schema = self.add_suggested_values_to_schema(schema, {
                CONF_MODEL: model, CONF_TV_ENTITY: existing, CONF_POWER_SWITCH: power,
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
