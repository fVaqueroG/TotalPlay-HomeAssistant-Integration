# Totalplay STB Local Remote & Media Player (experimental)

A community Home Assistant custom integration for local HTTP remote-control commands on a **Totalplay Sagemcom DIW362 UHD** set-top box. The request paths and key names were recovered by inspecting the owner's Totalplay Control Android app. **The command protocol has not yet been verified on a physical decoder.** This project is not affiliated with Totalplay or Sagemcom.

## HACS installation

1. In Home Assistant, open **HACS → ⋮ → Custom repositories** (the menu location may vary by HACS version).
2. Add `https://github.com/fVaqueroG/TotalPlay-HomeAssistant-Integration` with category **Integration**.
3. Find and download **Totalplay STB Local Remote**, then restart Home Assistant.
4. Go to **Settings → Devices & services → Add integration → Totalplay STB Local Remote**, and enter the decoder's local IPv4 address and HTTP port (default: `80`).

If you already installed a prior version, update through HACS and restart Home Assistant. The existing configuration should load the additional media player automatically.

## Before installing: test a remote command

From Home Assistant's terminal, while a menu is displayed on the decoder:

```sh
curl -i --max-time 5 'http://DECODER_IP/RemoteControl/KeyHandling/sendKey?key=up'
```

Replace `DECODER_IP` with your decoder's private IP address. If the on-screen selection moves up, the endpoint works. HTTP 200 alone is not proof that a button press succeeded; HTTP 401/403 may indicate pairing or authorization requirements. Do not expose the decoder's HTTP port to the internet.

## Remote entity

The `remote` entity provides navigation, power toggle (`on_off`), channels, volume, playback, menu, guide, and digit commands where accepted by the decoder. Under **Developer Tools → Actions**, for example:

```yaml
action: remote.send_command
target:
  entity_id: remote.totalplay_stb_remote
data:
  command: channel_up
```

Replace the example entity ID with the actual entity ID Home Assistant creates. Supported keys include `up`, `down`, `left`, `right`, `ok`, `back`, `channel_up`, `channel_down`, `volume_up`, `volume_down`, `mute`, `play_pause`, `stop`, `on_off`, `next`, `prev`, `KEY_MENU`, `KEY_GUIDE`, and digits `0`–`9`. Additional keys and aliases are in [`const.py`](custom_components/totalplay_stb/const.py).

## Media player entity (new in v0.2.0)

A `media_player` entity shares the same Home Assistant device with the remote. It supports volume up/down, channel up/down (mapped to media next/previous track), the STB's Stop button, and numeric channel selection via `media_player.play_media` with `media_content_type: channel`. For example, to request channel 101:

```yaml
action: media_player.play_media
target:
  entity_id: media_player.totalplay_diw362_uhd_media_player
data:
  media_content_type: channel
  media_content_id: '101'
```

Replace the example entity ID with the actual one under **Settings → Devices & services → Totalplay STB → Entities**. Channel digits are sent in order with a short delay; the integration does **not** append OK or confirm the decoder switched to that channel. The `last_requested_channel` attribute is only what Home Assistant requested, **not** a reading of the current channel.

**Important state limitations:** The HTTP command endpoint has not been proven to expose actual decoder power, playback, volume level, or currently tuned channel. The media player intentionally reports **unknown** state instead of inventing on/off or playing status. It does not advertise separate turn_on/turn_off, play/pause, volume_set, or mute_set actions because the recovered on_off, play_pause and mute keys are **toggles**, not discrete commands, and no current state can be verified. Use `remote.send_command` with `on_off`, `play_pause`, or `mute` when you explicitly want a toggle. The media player cannot play external video URLs, and does not provide live TV channel names or program art yet.

This entity is suitable for command-based dashboards and automation experiments, but generic media-player cards and external software may disable controls if they require a known ON/PLAYING state. For full UI power controls and live channel information we need a verified, read-only status endpoint from this firmware or an independently measured power-state entity.

## Troubleshooting and updates

The configuration form checks TCP reachability only, not API compatibility. Keep your original Totalplay remote or app available. If a command fails, open an issue with the HTTP status, relevant Home Assistant log lines, your decoder model and firmware (if known), and whether the official Totalplay app works. Remove personal information, cookies and account identifiers first. HACS uses the repository's published GitHub releases (`v0.2.0`, etc.) to detect updates.

Contributions and test reports for other Totalplay decoder models are welcome, but no other models are confirmed compatible.
