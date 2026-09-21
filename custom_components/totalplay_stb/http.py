"""Minimal command transport for Totalplay decoders with malformed HTTP headers.

Some DIW362 firmware replies contain ``Cache-Control : ...`` (space before
colon). Strict HTTP clients reject the header *after* the decoder has already
executed the key. Only the response status line is required for these
command-only requests; this module does not parse or trust response headers.
"""

import asyncio
import re
from urllib.parse import quote

from homeassistant.exceptions import HomeAssistantError

from .const import normalize_key

_ENDPOINT = "/RemoteControl/KeyHandling/sendKey"
_STATUS_LINE = re.compile(rb"^HTTP/1\.[01] ([1-5][0-9]{2})(?:[ \t\r\n]|$)")


async def async_send_key(host: str, port: int, key: str) -> None:
    """Send one key and check its HTTP status without parsing faulty headers.

    Never retry an ambiguous request: the decoder may have acted on it already.
    The configured host is a validated private IP, and the key is allowlisted.
    """
    normalized = normalize_key(key)
    path = f"{_ENDPOINT}?key={quote(normalized, safe='')}"
    request = (
        f"GET {path} HTTP/1.1\r\n"
        f"Host: {host}:{port}\r\n"
        "Connection: close\r\n"
        "Accept: */*\r\n"
        "\r\n"
    ).encode("ascii")
    writer: asyncio.StreamWriter | None = None

    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(host, port), timeout=3
        )
        writer.write(request)
        await asyncio.wait_for(writer.drain(), timeout=5)
        # The status line is read before the malformed response headers.
        line = await asyncio.wait_for(reader.readline(), timeout=5)
        match = _STATUS_LINE.match(line)
        if not match:
            raise HomeAssistantError(
                f"Totalplay returned no valid HTTP status for {normalized}"
            )
        status = int(match.group(1))
        if status < 200 or status >= 300:
            raise HomeAssistantError(
                f"Totalplay returned HTTP {status} for {normalized}"
            )
    except (OSError, asyncio.TimeoutError, ValueError) as exc:
        raise HomeAssistantError(
            f"Totalplay request failed for {normalized}: {exc}"
        ) from exc
    finally:
        if writer is not None:
            writer.close()
            try:
                await asyncio.wait_for(writer.wait_closed(), timeout=1)
            except (OSError, asyncio.TimeoutError):
                pass
