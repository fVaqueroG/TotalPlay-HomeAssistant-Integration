# Totalplay STB Local Remote & Media Player (experimental)

A community Home Assistant custom integration for local HTTP control of the **Totalplay Sagemcom DIW362 UHD** set-top box. The command paths and keys were recovered from Totalplay Control 1.2.28. The owner confirmed channel selection, volume, channel up, and launching Netflix from channel 333 with `ok` on a DIW362 UHD at port 80. This project is not affiliated with Totalplay or Sagemcom.

## HACS installation and updates

1. In Home Assistant, open **HACS → ⋮ → Custom repositories** (menu location may vary).
2. Add `https://github.com/fVaqueroG/TotalPlay-HomeAssistant-Integration` as an **Integration**.
3. Download **Totalplay STB Local Remote** and restart Home Assistant.
4. Go to **Settings → Devices & services → Add integration → Totalplay STB Local Remote**; enter the STB's local IPv4 address and port (default `80`).

For updates, select the latest versioned release in HACS and restart Home Assistant. Existing configuration and entity IDs should be preserved. Do not expose your decoder's HTTP port to the internet.

## Remote entity

The `remote` entity provides direction keys, select, back, channel and volume steps, power toggle (`on_off`), playback toggles, menu, guide and digits where supported by the firmware. For example:

```yaml
action: remote.send_command
target:
  entity_id: remote.totalplay_stb_remote
data:
  command: channel_up
```

Use the actual remote entity ID under **Settings → Devices & services → Totalplay STB → Entities**. Full key list and aliases: [`const.py`](custom_components/totalplay_stb/const.py).

## Media player entity (v0.2.0 and later)

The `media_player` entity shares the same Home Assistant device as the remote. It supports volume up/down, channel up/down (mapped to media next/previous track), Stop and numeric channel selection. For example:

```yaml
action: media_player.play_media
target:
  entity_id: media_player.living_room_totalplay_diw362_uhd_media_player
data:
  media_content_type: channel
  media_content_id: '101'
```

Replace the example entity ID if Home Assistant assigned another one. Digits are sent in order with a short delay; the integration does not append OK for ordinary channel selection. `last_requested_channel` is the requested channel, not confirmed feedback from the decoder.

## Netflix launch (v0.2.2 and later)

On the owner's DIW362 UHD, entering channel 333 opens a Netflix launch screen, and the **center D-pad button** of the official Totalplay Control app launches Netflix. The center D-pad button sends the API key `ok`. The decoder ignored an earlier immediate OK, but a direct `key=ok` request once the launch screen was displayed successfully launched Netflix.

To perform the confirmed sequence from Home Assistant with one action:

```yaml
action: media_player.play_media
target:
  entity_id: media_player.living_room_totalplay_diw362_uhd_media_player
data:
  media_content_type: app
  media_content_id: netflix
```

This sends the three digits of channel 333, waits five seconds for its launch screen to appear, then sends `ok` using the same HTTP command transport as the working remote. The five-second timing is an initial estimate and **must be tested end-to-end** on the physical decoder. If the Netflix launch screen loads too slowly, increase `_NETFLIX_LAUNCH_WAIT_SECS` in `media_player.py` and publish a new integration version. This only opens the Netflix app; it does not select a profile, play a title, or verify whether Netflix was already open. Other apps are not supported without a separately confirmed launch sequence.

## v0.2.1: malformed HTTP header compatibility

Some DIW362 firmware sends an invalid HTTP response header, such as `Cache-Control : no-cache, private` (extra space before the colon). Earlier versions used a strict HTTP client: the decoder *executed* Volume Up or Channel Up, but Home Assistant raised `Invalid header token`. The first digit of a requested channel was sent, then the error aborted the remainder.

Starting in v0.2.1, the remote and media player use a shared, minimal HTTP transport that checks the response status line without parsing those broken headers. A real non-2xx HTTP status or missing status line still produces an error. **The integration does not retry an ambiguous command**, as doing so could press a button twice. This change allows subsequent channel digits to be sent when the decoder responds with a successful status and malformed headers. Regression tests cover the broken header, a three-digit channel sequence, a genuine 403 response and an invalid status line.

## Limitations

The current command endpoint does not provide verified STB power, current channel, playback or numeric volume state. The media player intentionally reports an unknown state. Its power, play/pause and mute keys are toggles, so separate media-player On/Off and Play/Pause actions are not advertised; use `remote.send_command` to explicitly send `on_off`, `play_pause` or `mute`. Generic media-player cards may disable controls that require a known ON/PLAYING state. Live channel names and program art are not yet available.

## Troubleshooting

A successful TCP connection does not prove the command API is available. If a command fails, provide the HTTP status or Home Assistant log details, decoder model and firmware, and whether the official Totalplay app works. Remove personal information, tokens and account IDs before sharing logs. Contributions and test reports for other Totalplay models are welcome; they are not yet confirmed compatible.
