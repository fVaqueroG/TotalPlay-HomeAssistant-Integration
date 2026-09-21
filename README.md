# Totalplay STB Local Remote & Media Player (experimental)

A community Home Assistant integration for local HTTP control of the **Totalplay Sagemcom DIW362 UHD** decoder. Not affiliated with Totalplay or Sagemcom. Channel selection, volume, and launching Netflix via channel 333 followed by an OK command were tested on the owner's hardware. Current channel, power status and the decoder's own EPG are not confirmed readable.

## Installation and TV connection

Add `https://github.com/fVaqueroG/TotalPlay-HomeAssistant-Integration` under **HACS → Custom repositories → Integration**, install the latest **versioned release**, then restart Home Assistant. Add **Totalplay STB Local Remote** under **Settings → Devices & services**, providing the decoder's LAN address and its local HTTP port (usually 80). In setup or **Configure**, you may select the TV/media-player entity physically connected to the decoder and the HDMI input it uses. Existing decoder entities do not need to be removed when updating.

On channel and app actions, the integration selects the configured TV input **only if** the TV positively reports a different current input. When the TV is off or its current input is unknown, it does not switch inputs blindly. Navigation and volume buttons do not switch the input. Do not expose the decoder's HTTP port to the internet.

## Automatic dashboard resource and visual card (v0.2.5+)

**You no longer need to add the JavaScript resource manually.** On Home Assistant startup, the integration registers its bundled card as a Lovelace **JavaScript module** at `/totalplay_stb/totalplay-stb-card.js?v=<installed-integration-version>`. If that exact card path is already registered once, the integration updates its URL to the installed version so future HACS upgrades refresh the browser cache. It loads existing Lovelace resources before writing and never deletes or changes unrelated resources. When it detects **multiple existing resources for the same card path**, it leaves them unchanged and logs a warning; manually keep only one under **Settings → Dashboards → Resources**. Resource registration is supported in **Lovelace storage resource mode** (the UI-managed default); if your resources are managed in YAML, add this card's module URL to the `lovelace.resources` configuration yourself. A failure to register the card does not prevent the remote/media-player entities from loading.

After installing v0.2.5+ and restarting Home Assistant, reload the browser or Home Assistant companion app. Go to **Edit dashboard → Add card → By card → Totalplay Channels, Apps & Remote**. The **visual editor** allows you to choose the Totalplay decoder `media_player`, its `remote` entity, card title, reference lineup, Mexican TV guide, and overrides for individual TV/app channels. If the card is not listed, check that its JavaScript module appears **once** in Settings → Dashboards → Resources and refresh your browser. The automatic resource registration does not bypass HACS's integration-update detection; if HACS does not show a new release, use **Redownload → select the versioned release** before restarting.

## Bundled channel and app reference lineup

The default lineup is stored locally in `custom_components/totalplay_stb/www/lineup.txt`: channel names/numbers and app-launch channel numbers from the community [TV Channel Lists page](https://www.tvchannellists.com/w/List_of_channels_on_Totalplay), referenced September 21, 2026. It is **not a live or package-specific Totalplay lineup** and may vary by region, package, decoder and date. Disable **Show bundled community channel and app reference lineup** in the editor to use only your own channels/apps. You can override individual channel numbers, names, and EPG IDs in the editor. The card has a channel-category selector so you do not have to browse one long list.

App tiles appear separately from TV channels and use the same confirmed launch sequence: send the app channel number, wait five seconds, then send `ok`. Netflix **333** followed by `ok` was confirmed on the decoder; other app shortcut numbers and timing need testing. The community reference has inconsistent alternative app channel numbers; verify the appropriate one on your decoder before relying on it. Complete channel selections are padded to at least three digits (`1` → `001`, `12` → `012`) and sent at 100 ms spacing. The keypad still sends one digit per tap.

The **Remote** panel includes D-pad/OK, Back, Menu, Guide, volume/channel, playback and number-pad controls. Choose the Totalplay remote entity in the visual editor if it cannot be inferred. The Previous Channel key currently defaults to `KEY_TV_SWAP` (the official Android app also queues `prev_track` when using its canal previo button); it is separate from the playback Previous Track key. Power is a toggle because actual decoder power state is not exposed.

## Mexican TV guide (Now / Next)

When enabled, the card reads the Home Assistant endpoint `/api/totalplay_stb/epg`. The integration fetches XMLTV from `https://iptv-epg.org/files/epg-mx.xml` and caches successful data for 15 minutes, retrying failures after five minutes. Availability and program accuracy of this third-party feed are not guaranteed. An XMLTV channel ID is **not** a Totalplay channel number: the card attempts a unique exact normalized name match and otherwise displays **Programme information unavailable**. Use an `epg_id` override in the visual editor to fix a mismatch. You may optionally use an existing Home Assistant program sensor instead. A guide match is not proof the channel is in your Totalplay subscription.

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
    # epg_id: Use an actual XMLTV channel ID when needed.
apps:
  - name: Netflix
    number: '333'
```

A channel or app explicitly added with the same channel number overrides that item in the reference lineup. Set `lineup: false` to use only your own configured items. The entity IDs above are examples: select your actual entities.

## Home Assistant service examples

```yaml
# Select channel 12:
action: media_player.play_media
target:
  entity_id: media_player.living_room_totalplay_diw362_uhd_media_player
data:
  media_content_type: channel
  media_content_id: '12'
```

```yaml
# Launch Netflix:
action: media_player.play_media
target:
  entity_id: media_player.living_room_totalplay_diw362_uhd_media_player
data:
  media_content_type: app
  media_content_id: netflix
```

Other app launches accept their numeric app channel as `media_content_id`. They open the app, not a specific title or streaming profile. To send a decoder key directly, use `remote.send_command` on the Totalplay remote entity.

## Limitations

`last_requested_channel` is a requested channel, not confirmation of the currently tuned one. The decoder's actual current channel, power, playback status and volume level are not verified readable via this endpoint. The HTTP transport tolerates invalid firmware headers (such as `Cache-Control : no-cache, private`) without resending ambiguous commands that could press a button twice. Non-2xx responses still produce errors. Tests cover command transport, channel entry, XMLTV parsing, resource-registration safety and card JavaScript syntax.
