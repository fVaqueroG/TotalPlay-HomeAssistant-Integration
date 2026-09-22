# Compact Totalplay popup card

The integration includes two independent Lovelace card types. The original `custom:totalplay-stb-card` remains the full-size guide. The optional `custom:totalplay-stb-popup-card` is a one-row button; tapping it opens the **same full card** (Guide, Apps and Remote) in a responsive popup. No Browser Mod or other popup integration is required.

After installing the tagged integration and restarting Home Assistant, choose **Edit dashboard → Add card → Totalplay — Popup button** or add the YAML below:

```yaml
type: custom:totalplay-stb-popup-card
entity: media_player.your_totalplay_decoder
remote: remote.your_totalplay_decoder
title: Totalplay
lineup: true
epg: true
```

The popup uses all the standard full-card options, including custom channel/EPG mappings, apps, accent color and selected decoder. Copy any custom YAML from the existing full card and change only the `type` to `custom:totalplay-stb-popup-card`. The optional `popup_title` changes just the button and popup heading.

The full guide is created only when the popup opens and is removed on close. The popup is responsive on tablets and desktop, closes with the Close button, Escape or a backdrop click, and receives live Home Assistant state updates while open. It does not change the original full card, decoder commands, or configured HDMI source behavior.
