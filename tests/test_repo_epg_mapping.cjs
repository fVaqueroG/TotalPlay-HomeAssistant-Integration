const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

(async () => {
  const www = path.resolve(__dirname, '../custom_components/totalplay_stb/www');
  const table = fs.readFileSync(path.join(www, 'totalplay-epg-mapping.js'), 'utf8');
  const {TP_REPO_EPG_MAPPING, TP_HISTORICAL_EPG_SELECTIONS} =
    await import(`data:text/javascript;charset=utf-8,${encodeURIComponent(table)}`);
  assert.equal(Object.keys(TP_REPO_EPG_MAPPING).length, 133);
  assert.deepEqual(Object.keys(TP_HISTORICAL_EPG_SELECTIONS).sort(), ['214', '448']);
  assert.equal(TP_REPO_EPG_MAPPING['1'], 'Canal.Azteca.Uno.mx');
  assert.equal(TP_REPO_EPG_MAPPING['2'], 'Canal.2.de.México.(Canal.Las.Estrellas.-.XEW).mx');
  assert.equal(TP_REPO_EPG_MAPPING['214'], undefined);

  class TestCard {
    _channels() { return this.channels; }
    _renderGuide() { this._guideStatus = {textContent: 'Guide'}; }
    setConfig(config) { this._config = config; this.shadowRoot = {querySelector: () => ({replaceChildren() {}})}; }
  }
  const source = fs.readFileSync(path.join(www, 'totalplay-stb-v0329.js'), 'utf8')
    .split('\n').filter(line => !line.startsWith('import ')).join('\n');
  vm.runInNewContext(source, {
    TP_REPO_EPG_MAPPING,
    customElements: {get: name => name === 'totalplay-stb-card' ? TestCard : undefined},
  }, {filename: 'totalplay-stb-v0329.js'});

  const card = new TestCard();
  const input = [
    {number: 1, name: 'Azteca uno', type: 'C', category: 'Abierta', epg_id: 'automatic'},
    {number: 2, name: 'Las Estrellas', type: 'C', category: 'Abierta', epg_id: 'automatic2'},
    {number: 7, name: 'Azteca 7', type: 'C', category: 'Abierta', epg_id: 'automatic7'},
    {number: 214, name: 'Canal Claro', type: 'C', category: 'Entretenimiento', epg_id: 'automatic214'},
    {number: 1, name: 'Audio', type: 'C', category: 'Audio', epg_id: '__totalplay_no_epg__'},
    {number: 2, name: 'Mosaico', type: 'M', category: 'Abierta', epg_id: '__totalplay_no_epg__'},
  ];
  card.channels = input;
  card._config = {channels: [{number: 2, epg_id: 'my-per-card-choice'}]};
  card._guide = {channels: [
    {id: 'Canal.Azteca.Uno.mx'}, {id: 'Canal.2.de.México.(Canal.Las.Estrellas.-.XEW).mx'},
  ]};
  const mapped = card._channels();
  assert.equal(mapped[0].epg_id, 'Canal.Azteca.Uno.mx', 'repository overrides automatic matching');
  assert.equal(mapped[1].epg_id, 'automatic2', 'explicit per-card mapping wins over repository default');
  assert.equal(mapped[2].epg_id, 'automatic7', 'unavailable repository ID preserves automatic match');
  assert.equal(mapped[3].epg_id, 'automatic214', 'historical selection is not forced');
  assert.equal(mapped[4].epg_id, '__totalplay_no_epg__', 'Audio stays excluded');
  assert.equal(mapped[5].epg_id, '__totalplay_no_epg__', 'mosaic stays excluded');
  assert.equal(mapped[0].number, 1, 'channel tuning number stays unchanged');
  card._guide = null;
  assert.equal(card._channels()[0].epg_id, 'automatic', 'before guide load keep existing result');
  card._guide = {channels: [{id: 'Canal.Azteca.Uno.mx'}]};
  card._renderGuide();
  assert.match(card._guideStatus.textContent, /1\/133 repository EPG mappings available/);

  const init = fs.readFileSync(path.resolve(www, '../__init__.py'), 'utf8');
  assert.match(init, /StaticPathConfig\(_CARD_URL, str\(www \/ "totalplay-stb-v0329.js"\)/);
  assert.match(init, /StaticPathConfig\("\/totalplay_stb\/totalplay-epg-mapping.js"/);
  assert.match(init, /StaticPathConfig\("\/totalplay_stb\/totalplay-stb-v0328.js"/);
  console.log('PASS: 133 repository mappings; unavailable IDs, card overrides and excluded channels handled safely.');
})().catch(error => {console.error(error); process.exitCode = 1;});
