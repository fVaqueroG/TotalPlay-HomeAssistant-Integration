"""Configuration form for the local Totalplay HTTP remote."""

import asyncio
import ipaddress

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.const import CONF_HOST, CONF_PORT

from .const import DEFAULT_HOST, DEFAULT_PORT, DOMAIN


class TotalplaySTBConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Set up the Totalplay remote after a non-mutating TCP connectivity check."""

    VERSION = 1

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
                    _, writer = await asyncio.wait_for(
                        asyncio.open_connection(host, port), timeout=3
                    )
                except (OSError, asyncio.TimeoutError):
                    errors["base"] = "cannot_connect"
                else:
                    return self.async_create_entry(
                        title=f"Totalplay STB {host}", data={CONF_HOST: host, CONF_PORT: port}
                    )
                finally:
                    if writer is not None:
                        writer.close()
                        try:
                            await writer.wait_closed()
                        except OSError:
                            pass
        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema(
                {
                    vol.Required(CONF_HOST, default=DEFAULT_HOST): str,
                    vol.Required(CONF_PORT, default=DEFAULT_PORT): vol.All(
                        vol.Coerce(int), vol.Range(min=1, max=65535)
                    ),
                }
            ),
            errors=errors,
        )
