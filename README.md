# Totalplay STB Local Remote (experimental)

A community Home Assistant custom integration for local HTTP remote-control commands on a **Totalplay Sagemcom DIW362 UHD** set-top box. The request paths and key names were recovered by inspecting the owner's Totalplay Control Android app. **The command protocol has not yet been verified on a physical decoder.** This project is not affiliated with Totalplay or Sagemcom.

## HACS installation

1. In Home Assistant, open **HACS → ⋮ → Custom repositories** (the menu location may vary by HACS version).
2. Add `https://github.com/fVaqueroG/TotalPlay-HomeAssistant-Integration` with category **Integration**.
3. Find and download **Totalplay STB Local Remote**, then restart Home Assistant.
4. Go to **Settings → Devices & services → Add integration → Totalplay STB Local Remote**, and enter the decoder's local IPv4 address and HTTP port (default: `80`).

If HACS reports that the repository is invalid, check the GitHub Actions validation status and verify that the default branch contains `custom_components/totalplay_stb/manifest.json` and `hacs.json`.

## Before installing: test the remote command

From Home Assistant's terminal, while a menu is displayed on the decoder:

```sh
curl -i --max-time 5 'http://DECODER_IP/RemoteControl/KeyHandling/sendKey?key=up'
```

Replace `DECODER_IP` with your decoder's private IP address. If the on-screen selection moves up, the endpoint works. HTTP 200 alone is not proof that a button press succeeded; HTTP 401/403 may indicate pairing or authorization requirements. Do not expose the decoder's HTTP port to the internet.

## Usage

The integration creates a `remote` entity and supports navigation, power toggle (`on_off`), channels, volume, playback, menu, guide and digit commands where accepted by the decoder. For example, under **Developer Tools → Actions**:

```yaml
action: remote.send_command
target:
  entity_id: remote.totalplay_stb_remote
data:
  command: channel_up
```

Replace the example entity ID with the actual ID Home Assistant creates. Supported keys include `up`, `down`, `left`, `right`, `ok`, `back`, `channel_up`, `channel_down`, `volume_up`, `volume_down`, `mute`, `play_pause`, `stop`, `on_off`, `next`, `prev`, `KEY_MENU`, `KEY_GUIDE`, and digits `0`–`9`. Additional keys and aliases are listed in [`const.py`](custom_components/totalplay_stb/const.py).

**Limitations:** this is a command-only preview, not a `media_player` integration. Power is a toggle, not distinct on/off commands; actual power, channel and playback states are not reported. The configuration form checks only TCP reachability, not API compatibility. Keep your original Totalplay remote or app available. No Android TV/ADB functionality is assumed.

## Troubleshooting and updates

If a command fails, open an issue with the HTTP status, relevant Home Assistant log lines, your decoder model and firmware (if known), and whether the official Totalplay app works. Remove any personal information, cookies and account identifiers first. For updates, use HACS to download the latest repository version and restart Home Assistant when prompted.

Contributions and test reports for other Totalplay decoder models are welcome, but no other models are confirmed compatible.
