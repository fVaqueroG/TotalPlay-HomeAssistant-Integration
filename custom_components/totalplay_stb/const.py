"""Constants for the Totalplay STB local remote preview."""

DOMAIN = "totalplay_stb"
DEFAULT_HOST = ""
DEFAULT_PORT = 80

# Keys recovered from the Totalplay Control 1.2.28 Android APK.
KEYS = frozenset({
    "up", "down", "left", "right", "ok", "back", "on_off",
    "channel_up", "channel_down", "volume_up", "volume_down", "mute",
    "play_pause", "stop", "next", "prev", "next_track", "prev_track",
    "fullscreen", "delete", "audio", "KEY_MENU", "KEY_GUIDE",
    "KEY_TV_AUDIO", "KEY_TV_VOD", "KEY_TV_SWAP", "KEY_PIP",
    "KEY_SPACE", "KEY_PAGE_PREV",
    *tuple(str(n) for n in range(10)),
})

ALIASES = {
    "select": "ok", "enter": "ok", "return": "back",
    "power": "on_off", "power_toggle": "on_off",
    "channelup": "channel_up", "ch_up": "channel_up",
    "ch_down": "channel_down", "channeldown": "channel_down",
    "vol_up": "volume_up", "vol_down": "volume_down",
    "pause": "play_pause", "play": "play_pause",
    "menu": "KEY_MENU", "guide": "KEY_GUIDE", "vod": "KEY_TV_VOD",
}


def normalize_key(key: str) -> str:
    """Convert common aliases to exact keys expected by the Totalplay API."""
    normalized = str(key).strip()
    if normalized in KEYS:
        return normalized
    normalized = ALIASES.get(normalized.lower(), normalized.lower())
    if normalized not in KEYS:
        raise ValueError(f"Unsupported Totalplay remote command: {key!r}")
    return normalized
