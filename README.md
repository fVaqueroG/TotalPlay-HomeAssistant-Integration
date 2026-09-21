# Totalplay STB Local Remote & Media Player (experimental)

A community Home Assistant integration for local HTTP control of the **Totalplay Sagemcom DIW362 UHD** decoder. Not affiliated with Totalplay or Sagemcom. Channel selection, volume, and launching Netflix via channel 333 followed by an OK command were tested on the owner's hardware. The STB's current channel, power status, and its own EPG have not been confirmed readable.

## Installation and TV connection

Add `https://github.com/fVaqueroG/TotalPlay-HomeAssistant-Integration` to **HACS → Custom repositories → Integration**, download the latest **versioned release**, and restart Home Assistant. Add **Totalplay STB Local Remote** under **Settings → Devices & services** with the decoder's LAN address and local HTTP port (usually 80). In setup or its later **Configure** options, optionally select the TV/media-player entity physically connected to this decoder and its HDMI input. Existing entities and configuration do not need to be removed on update.

When you select a channel or launch an app, the integration checks the TV's reported `source`; it calls `media_player.select_source` only if the TV positively reports a **different** input. If the TV is off or its current input is unknown, it does not switch inputs blindly. Individual decoder navigation/volume buttons do not force an input change. Keep decoder HTTP access restricted to your LAN.

## Add the card from the visual **By card** picker (v0.2.4+)

After installing the updated integration and restarting Home Assistant, go to **Settings → Dashboards → Resources** (three-dot menu if necessary), and register `/totalplay_stb/totalplay-stb-card.js?v=0.2.4` as a **JavaScript module**. If an older version of this same URL is already registered, **edit that resource** to append/change `?v=0.2.4`; do not add a duplicate. Reload the Home Assistant frontend, then select **Edit dashboard → Add card → By card → Totalplay Channels, Apps & Remote**. Open its **visual editor** to choose your Totalplay `media_player` entity, optional decoder `remote` entity, card title, reference lineup, guide display, and overrides for individual channels/apps. The card is available in the picker after its JavaScript resource is loaded; installing an integration alone does not automatically add its frontend resource.

The default reference lineup is bundled locally in `custom_components/totalplay_stb/www/lineup.txt`. It contains the TV and audio channel names/numbers and app-launch channel numbers from the community [TV Channel Lists page](https://www.tvchannellists.com/w/List_of_channels_on_Totalplay), last edited there on June 15, 2026, transcribed and reviewed September 21, 2026. It is **not a live or package-specific Totalplay listing** and can differ by city, subscription, decoder firmware and date. The decoder has no verified lineup-feedback API. Disable **Show bundled community channel and app reference lineup** in the editor to use only your own configured channels/apps, or add channel-number overrides for changed names, EPG IDs and sensor mappings. The list is shipped with the integration; it does not access TV Channel Lists at runtime or use any browser challenge token. The card includes a channel-category selector so the reference lineup does not have to be browsed as one long section.

Apps appear separately from ordinary TV channels. An app tile sends its numbered launch channel, waits five seconds for the launch screen, then sends `ok`. Netflix channel **333**, followed by the separate `ok` key, was confirmed on physical hardware; other app-channel sequences and the combined five-second timing should be checked on your decoder. The community list contains some alternate app channel numbers, and its Disney+ Apps section disagrees with its channel table (`337` versus `335`); the editor leaves these choices editable and marks the extra `337` alternative as unverified.

The **Remote** panel includes navigation/D-pad/OK, Back, Menu, Guide, volume/channel, playback and a single-digit number pad. Select the remote entity from the visual editor if it cannot be inferred from the decoder's entity ID. The Previous key defaults to `KEY_TV_SWAP`, and may be changed with `previous_channel_command` in YAML if your firmware uses a different key. Power and some media actions are toggles because actual decoder state is not exposed. Complete channel selections are padded to at least three digits (`1` → `001`, `12` → `012`) and sent at 100 ms spacing. Individual keypad taps remain one digit each.

### Automatic Mexican program guide (Now / Next)

When **Show XMLTV Now / Next** is enabled, the card reads a cached, authenticated Home Assistant endpoint at `/api/totalplay_stb/epg`. The integration obtains guide data from the public Mexican XMLTV feed `https://iptv-epg.org/files/epg-mx.xml`, caches successful responses for 15 minutes, and retries a failed feed after five minutes. The public guide was reachable in testing on September 21, 2026; future availability, completeness and schedule accuracy are outside this project's control. Home Assistant downloads the XMLTV once per cache period, not once per individual dashboard browser, and parses explicit program start/end time zones.

XMLTV channel **IDs are not Totalplay channel numbers**. The card tries a unique exact channel-name match after normalization, and otherwise shows **Programme information unavailable** instead of guessing. Duplicate names, provider spelling differences, and unavailable stations may require setting `epg_id` on a channel in the visual editor. Optional `program_entity` overrides the XMLTV data when its Home Assistant sensor provides a current title. Now and Next are displayed where supported; a guide match does not prove that a channel is included in your subscription. The guide does not provide any live playback stream.

## Manual/YAML card configuration (optional)

```yaml
type: custom:totalplay-stb-card
entity: media_player.living_room_totalplay_diw362_uhd_media_player
remote: remote.living_room_totalplay_diw362_uhd_remote
title: Totalplay TV
lineup: true
epg: true
channels:
  - number: '101'
    name: Azteca Uno
    # epg_id: AztecaUno.mx  # Example only: use an actual XMLTV channel ID.
    # program_entity: sensor.my_existing_channel_101_guide
apps:
  - name: Netflix
    number: '333'
```

An explicit `channels` item with the same channel number overrides that item in the reference lineup, so you can set a precise EPG ID or custom name without duplicating a tile. An explicit `apps` item overrides an app tile with the same launch channel. Set `lineup: false` to use only the arrays provided in this YAML configuration.

## Home Assistant service examples

Select a numbered channel:

```yaml
action: media_player.play_media
target:
  entity_id: media_player.living_room_totalplay_diw362_uhd_media_player
data:
  media_content_type: channel
  media_content_id: '12'
```

Launch Netflix via its verified launch channel:

```yaml
action: media_player.play_media
target:
  entity_id: media_player.living_room_totalplay_diw362_uhd_media_player
data:
  media_content_type: app
  media_content_id: netflix
```

Other app launches use their **numeric launch channel** as the app `media_content_id`. App launching does not select a streaming profile or play an individual title. To send a decoder key directly, call `remote.send_command` on the configured Totalplay `remote` entity with `command: ok` or another supported key.

## HACS update and frontend cache notes

The manifest version and GitHub release tag are kept in sync by `.github/workflows/publish-release.yml`. If HACS does not detect the versioned release, refresh the repository information or choose **Redownload → select the versioned release** rather than `main` or an old commit. That action only replaces integration files; you do not need to delete your configured Totalplay device. After installing, restart Home Assistant. If the dashboard still displays an older card, edit its **existing** Resources URL to use the current `?v=` value above and reload the frontend. Keep exactly one registration of the card resource.

## Limitations and transport compatibility

`last_requested_channel` is the channel requested by Home Assistant, **not** confirmation of the one currently tuned. The remote endpoint offers no verified channel/power/playback-state or volume-level feedback. Some firmware returns malformed HTTP headers (`Cache-Control : no-cache, private`); our local transport checks the status line rather than parsing those invalid headers and does not retry ambiguous commands, which might otherwise press a key twice. Non-2xx responses still raise errors. Regression tests cover the transport, channel entry, EPG parsing, and dashboard JavaScript syntax.
