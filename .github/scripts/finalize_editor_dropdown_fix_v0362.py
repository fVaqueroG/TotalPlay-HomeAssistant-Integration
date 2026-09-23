from pathlib import Path
path=Path('custom_components/totalplay_stb/www/totalplay-stb-card.js')
s=path.read_text()
old="if(this._editorDrawn&&this.matches(':focus-within'))return;"
new="if(this._editorDrawn&&this.shadowRoot.activeElement?.tagName==='SELECT')return;"
assert s.count(old)==1,(s.count(old), 'Expected main visual editor draw guard')
s=s.replace(old,new,1)
path.write_text(s)
print('PASS: native selects remain open but Add/Remove override buttons still redraw the editor')
