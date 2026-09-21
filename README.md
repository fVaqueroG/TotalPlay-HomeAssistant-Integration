# Totalplay STB Local Remote & Media Player (experimental)

A community Home Assistant custom integration for local HTTP control of the **Totalplay Sagemcom DIW362 UHD** set-top box. The command paths and keys were recovered from Totalplay Control 1.2.28. Channel selection, volume and launching Netflix from channel 333 with `ok` have been tested on the owner's DIW362 UHD at port 80. Not affiliated with Totalplay or Sagemcom.

## HACS installation and updates

1. In Home Assistant, add `https://github.com/fVaqueroG/TotalPlay-HomeAssistant-Integration` under **HACS → Custom repositories → Integration**.
2. Download the latest tagged release in HACS and restart Home Assistant.
3. Under **Settings → Devices & services**, add **Totalplay STB Local Remote** and enter the decoder IP and port (default `80`).
4. The next configuration screens let you select the **TV/media player physically displaying the STB**, followed by the correct **HDMI/source**. The source dropdown uses that media player's reported `source_list` where available. Linking a display is optional.

**Already installed?** After updating, go to **Settings → Devices & services → Totalplay STB Local Remote → Configure** to choose or change the attached TV and its HDMI input. Do not remove and re-add the decoder: the integration retains its existing entity IDs. The media-player entity exposes the `connected_tv_entity` and `connected_tv_source` attributes for dashboard use.

**Source check:** Before launching an app or selecting/changing a TV channel through the Totalplay `media_player`, the integration checks the attached TV's reported `source`. If it already matches, it does **nothing** to the TV. If it positively reports a different source, the integration requests `media_player.select_source` once before sending Totalplay commands. If the TV's state or source is unknown or the TV is off, the integration does **not** blindly switch inputs or power it on. Volume and Stop actions do not switch TV inputs. This behavior requires that the chosen TV media player report its current `source` accurately. TV input changes are not verified by the STB itself.

Do not expose your decoder's HTTP port to the internet.

## Totalplay Channels & Apps dashboard card (v0.2.2+)

The card is included with the integration and served at `/totalplay_stb/totalplay-stb-card.js`. After updating and restarting Home Assistant, open **Settings → Dashboards → Resources**, add that URL as a **JavaScript module**, and refresh the dashboard. Add a manual/YAML card with:

```yaml
type: custom:totalplay-stb-card
entity: media_player.living_room_totalplay_diw362_uhd_media_player
title: Totalplay TV
channels:
  - number: '101'
    name: Channel 101
  - number: '333'
    name: Netflix launch channel
apps:
  - id: netflix
    name: Netflix
```

Customize `channels` with your **actual** channel numbers and names; the sample is not an authoritative Totalplay channel guide. Tapping a channel sends `media_player.play_media` with `media_content_type: channel`. Tapping Netflix sends `media_content_type: app`, `media_content_id: netflix`. Both use the TV input check described above. Other app tiles are disabled unless a separate app launch sequence has been verified and implemented.

### Real TV program information (optional EPG sensors)

The decoder's current HTTP command API has **not** been shown to return a channel guide, current program, or current channel. The card therefore does not fabricate them. If you already have TV-guide sensors in Home Assistant, add `program_entity` to each channel to show its **actual current program** from that sensor's state or a `current_program`, `program_title`, `program` or `title` attribute:

```yaml
type: custom:totalplay-stb-card
entity: media_player.living_room_totalplay_diw362_uhd_media_player
channels:
  - number: '101'
    name: Channel 101
    program_entity: sensor.my_channel_101_now_playing
  - number: '102'
    name: Channel 102
    program_entity: sensor.my_channel_102_now_playing
apps:
  - id: netflix
    name: Netflix
```

Replace those **example** sensor IDs with entities that actually exist; this integration does not create EPG sensors. Without a configured/live sensor, the card displays **Program information unavailable**. The selected TV source is shown in the card header when available.

## Remote and media player actions

The `remote` entity provides directional keys, select, back, channel and volume steps, power toggle (`on_off`), menu, guide and digit keys where supported by the firmware. Example:

```yaml
action: remote.send_command
target:
  entity_id: remote.totalplay_stb_remote
data:
  command: channel_up
```

The `media_player` entity supports volume up/down, channel up/down (mapped to media next/previous track), Stop and numeric channel selection:

```yaml
action: media_player.play_media
target:
  entity_id: media_player.living_room_totalplay_diw362_uhd_media_player
data:
  media_content_type: channel
  media_content_id: '101'
```

The `last_requested_channel` entity attribute is **not** confirmation of which channel is tuned.

## Netflix launch (v0.2.2+)

On the owner's DIW362 UHD, selecting channel 333 displays a Netflix launch screen; sending `key=ok` once that screen has loaded opens Netflix. The combined media player action:

```yaml
action: media_player.play_media
target:
  entity_id: media_player.living_room_totalplay_diw362_uhd_media_player
data:
  media_content_type: app
  media_content_id: netflix
```

sends `3`, `3`, `3`, **waits five seconds**, then sends `ok`. The individual channel/OK commands were confirmed on the physical decoder; the automatic five-second launch timing still needs an end-to-end test. This opens Netflix only—it does not select a profile or play a title.

## Decoder HTTP response compatibility (v0.2.1+)

Some firmware replies with an invalid HTTP response header (`Cache-Control : no-cache, private`). The integration checks the HTTP status line and does not parse that malformed header; genuine non-2xx status responses still fail, and ambiguous commands are not retried. The owner confirmed that three-digit channel selection, Volume Up, and Channel Up work without the previous Home Assistant error on v0.2.1.

## Limitations

Power, playback, channel identity, numeric volume and live program details are not confirmed readable from the decoder, so the media player reports an unknown state rather than inventing it. Its power, play/pause and mute commands are toggles; use `remote.send_command` with `on_off`, `play_pause` or `mute` where explicitly intended. Some generic media-player cards disable controls when state is unknown; use the bundled channels/apps card for command-based control. If you encounter an error, include sanitized Home Assistant logs and decoder model/firmware in a GitHub issue.
