# Totalplay STB Local Remote & Media Player (experimental)

Community Home Assistant integration for local HTTP control of the **Totalplay Sagemcom DIW362 UHD** decoder. Not affiliated with Totalplay or Sagemcom. The owner confirmed channel changes and volume controls, plus Netflix launch through channel 333 followed by `ok`. No channel-state feedback or live EPG has been verified from the decoder.

## Install and connected-TV configuration

Add `https://github.com/fVaqueroG/TotalPlay-HomeAssistant-Integration` in **HACS → Custom repositories → Integration**. Install the latest versioned release and restart Home Assistant. Add **Totalplay STB Local Remote** under **Settings → Devices & services**, supplying the decoder's private IPv4 address and its HTTP port (usually `80`).

The setup and **Configure** options let you link the **TV/media player to which the decoder is physically connected**, and select the TV's HDMI input. These are optional for existing installations; updating does not require deleting the decoder. Before a channel or app action, the integration checks the TV's reported current input. It selects the configured input **only when the TV positively reports a different one**. When the TV is off or its input is unknown, it does not switch inputs blindly. Navigation, volume, and Stop remote actions do not force input changes.

Never expose the decoder's local HTTP port to the internet.

## Channels, apps and remote dashboard card (v0.2.3+)

Add `/totalplay_stb/totalplay-stb-card.js` under **Settings → Dashboards → Resources** as a **JavaScript module** and refresh the dashboard. Then add a manual YAML card. Set the actual `remote` entity ID from your Totalplay device's Entities list:

```yaml
type: custom:totalplay-stb-card
entity: media_player.living_room_totalplay_diw362_uhd_media_player
remote: remote.living_room_totalplay_diw362_uhd_remote
title: Totalplay TV
channels:
  - number: '1'
    name: Channel 1
  - number: '101'
    name: Channel 101
apps:
  - id: netflix
    name: Netflix
    number: '333'
  # Add other Totalplay app channels using their actual published numbers:
  # - id: another_app
  #   name: Another App
  #   number: 'YOUR_APP_CHANNEL_NUMBER'
```

**The examples are not a complete or verified Totalplay channel list.** Add the channels and apps from your decoder's actual lineup. App tiles with a valid numeric `number` send that channel, wait five seconds for its launch screen, then send `ok`, as described by the owner for the Totalplay app channels. An app tile without a configured channel number remains disabled. The five-second timing, as well as the shorter channel-entry timing, should be checked on the physical device. Netflix's channel number 333 and its separate OK launch command were confirmed on the physical decoder.

Tap **Remote** in the card header to reveal three views: **Navigation** (D-pad/OK, menu, guide, Back, channel/volume, mute and power toggle), **Playback** (rewind, play/pause, forward, previous/next, stop, audio) and **Keypad** (0–9, previous channel and delete). The remote commands go to the decoder's `remote` entity, not the connected TV, and do not change its HDMI input. The Previous key defaults to `KEY_TV_SWAP`; if it does not reproduce the official app's *canal previo* button, change `previous_channel_command` to the correct verified decoder key. Power is a toggle because decoder power-state feedback is unavailable.

**Complete channels are entered with at least three digits at 100 ms spacing:** `1` becomes `001`, `12` becomes `012`, `101` stays `101`, and a four-digit channel stays four digits. This applies both to channel tiles/`media_player.play_media` channel actions and numbered app launches. Individual number-pad button presses send exactly the one digit selected, without automatic padding. App launches still wait five seconds **after** the final channel digit before sending OK.

### Live TV programs

To display a channel's actual program title, set `program_entity` on that channel to an existing Home Assistant TV-guide sensor. The card reads its `current_program`, `program_title`, `program`, or `title` attribute, or its state. Example:

```yaml
channels:
  - number: '101'
    name: Channel 101
    program_entity: sensor.channel_101_now_playing
```

This is an **example** sensor, not one created by this integration. The Totalplay lineup website provides channel information but we have not verified a full machine-readable lineup or a decoder EPG endpoint. Channels without matching real EPG sensors display **Program information unavailable** instead of made-up programming.

## Home Assistant service examples

Select a channel (the integration pads 1 and 2 digit numbers automatically):

```yaml
action: media_player.play_media
target:
  entity_id: media_player.living_room_totalplay_diw362_uhd_media_player
data:
  media_content_type: channel
  media_content_id: '12'
```

Launch Netflix using its confirmed channel 333 shortcut:

```yaml
action: media_player.play_media
target:
  entity_id: media_player.living_room_totalplay_diw362_uhd_media_player
data:
  media_content_type: app
  media_content_id: netflix
```

Other app launches accept their **numeric Totalplay channel number** instead of `netflix` as `media_content_id`. This opens an app, not a specific title. To press a decoder key directly:

```yaml
action: remote.send_command
target:
  entity_id: remote.living_room_totalplay_diw362_uhd_remote
data:
  command: ok
```

Use the actual entity IDs in your Home Assistant installation. `last_requested_channel` reports the last *requested* channel, not a verified current channel. Power, playback, numeric volume, current channel, and actual current TV program are not readable through the confirmed command endpoint. Some generic media-player cards may disable controls while the media player state is unknown; use the bundled card for command-only operation.

## HTTP compatibility

Some DIW362 firmware returns malformed headers such as `Cache-Control : no-cache, private`. The integration's HTTP transport checks the response status line without parsing these headers and does **not** retry ambiguous commands, which could press a key twice. Genuine non-2xx responses remain errors. Regression tests cover this behavior.
