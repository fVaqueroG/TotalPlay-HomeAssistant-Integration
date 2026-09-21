# Totalplay STB Local Remote & IPTV Guide (experimental)

Community Home Assistant integration for local HTTP control of the Totalplay Sagemcom DIW362 UHD decoder. Not affiliated with Totalplay or Sagemcom. The owner's hardware confirmed local channel selection and Netflix launch by channel 333, followed by OK. The decoder's actual tuned channel, power state and native EPG are **not** available as verified feedback; `last_requested_channel` is only the last command sent by Home Assistant.

## Install and update through HACS

Add `https://github.com/fVaqueroG/TotalPlay-HomeAssistant-Integration` in **HACS → Custom repositories → Integration**, install the latest tagged version, and restart Home Assistant. In **Settings → Devices & services**, add or configure **Totalplay STB Local Remote** using the decoder's LAN address and HTTP port (usually 80). You may optionally link the connected TV and HDMI input. The integration will not call `select_source` if the TV does not report that feature or if it is already on the target input; decoder commands remain usable if input switching is unsupported. Do not expose the decoder's HTTP endpoint to the internet.

The card's JavaScript module is automatically registered when the integration starts in Home Assistant's UI-managed Lovelace resource mode. It reuses the URL `/totalplay_stb/totalplay-stb-card.js?v=<installed-version>` and updates one existing resource instead of adding duplicates. In YAML-managed resource mode, register this path manually as a JavaScript module. Existing cards and their decoder/remote settings are preserved by upgrades. If HACS does not offer a new tagged release, use **Redownload → select the tagged version**, then restart Home Assistant and refresh its frontend.

## The IPTV guide card (v0.3.0+)

Open **Edit dashboard → Add card → By card → Totalplay IPTV Guide & Remote**. The default **Guide** view has a scrollable program timeline with a sticky channel column, time marker, category pills and program/channel search. The **Apps** tab contains separate numbered app-launch tiles. The **Remote** toggle reveals a compact remote with D-pad/OK, channel and volume rockers, Back/Menu/Guide, playback, previous channel, and a collapsible number pad. The layout adjusts to narrow dashboards and mobile devices. On desktop the remote may open alongside the guide; close it with the Remote button when you need more guide space.

When a channel has an EPG schedule in the current time window, the guide can show its current/upcoming program blocks. By default, **Programs only** prioritizes channels with guide data; uncheck it to see **all** reference channels, including unmatched ones. The on-card guide status displays the count of matched stations and channels with program listings, or an explicit download/API error. Program titles in the earlier *mockup* were examples, not Totalplay programming. The real card never substitutes invented schedules.

## EPG setup if programs are missing

The integration fetches third-party Mexican XMLTV from `https://iptv-epg.org/files/epg-mx.xml` using Home Assistant and caches it for 15 minutes (failed fetches retry after five minutes). The feed's coverage, availability, and schedule accuracy are outside our control. Its channel IDs do **not** correspond to Totalplay channel numbers, and the community lineup may contain channels not included in that guide or in your subscription.

If guide status reports an **API error**, visit `/api/totalplay_stb/epg` in your Home Assistant browser session to inspect whether the feed was downloaded; check the Home Assistant log for `Totalplay optional EPG unavailable`. Decoder control does not depend on the EPG. If the feed loads but a channel has no programs, open the card's **visual editor → Link your channel to an EPG station**. Enter the actual Totalplay channel number, select the correct XMLTV station from the dropdown, and save; this stores an `epg_id` override in that card's configuration. Repeat for any mismatched channels. The editor also supports overriding a channel name, alternate EPG name, program sensor, and individual app launch numbers. A guide match does not prove access to a particular channel.

## Channel and app actions

The local API sends `channel_up` once to dismiss an open decoder menu before a complete channel or app selection. After a 100 ms pause, digits are sent **50 ms apart**; short channel numbers are zero-padded to three digits. App launches additionally wait five seconds after the number before pressing OK (Netflix is confirmed on channel 333). This preparatory key is **not** sent before individual remote/keypad buttons. The button labeled Previous sends `KEY_TV_SWAP` by default; the APK has also been observed issuing `prev_track` in its previous-channel handler. Power is a toggle with no confirmed status feedback.

## Optional YAML card configuration

```yaml
type: custom:totalplay-stb-card
entity: media_player.your_totalplay_decoder
remote: remote.your_totalplay_decoder
title: Totalplay TV
lineup: true
epg: true
channels:
  - number: '101'
    name: Azteca Uno
    # epg_id: ProviderStation.mx  # Replace with the ID from your actual guide.
apps:
  - name: Netflix
    number: '333'
```

Channel overrides with the same number as a bundled channel update that channel rather than duplicating it. The reference lineup comes from the community [TV Channel Lists](https://www.tvchannellists.com/w/List_of_channels_on_Totalplay) page, not the connected decoder. It varies by package, region and date and is bundled locally in `www/lineup.txt` (no runtime dependency on that site).

## Development and validation

`.github/workflows/validate.yml` runs Python command/EPG regression tests, JavaScript syntax checks, guide matching tests, HACS validation and Home Assistant hassfest. `.github/workflows/publish-release.yml` creates a tagged HACS release when `manifest.json` changes. A green CI result does not replace testing the guide and remote against the owner's actual Home Assistant instance and decoder.
