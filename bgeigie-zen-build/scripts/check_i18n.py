#!/usr/bin/env python3
"""Check that every key js/steps.js needs exists in every locale, and locales share the same keys."""
import json, pathlib, subprocess, sys
root = pathlib.Path(__file__).resolve().parent.parent
dump = subprocess.run(['node', '-e', f"import('{root}/js/steps.js').then(m=>console.log(JSON.stringify({{steps:m.STEPS.map(s=>({{id:s.id,chapter:s.chapter,tools:s.tools||[],evidence:s.evidence||[],notes:(s.notes||[]).map(n=>n.kind),parts:(s.parts||[]).map(p=>p.key)}})),chapters:m.CHAPTERS}})))"],
                      capture_output=True, text=True, check=True).stdout
d = json.loads(dump)
locs = {c: json.loads((root / 'locales' / f'{c}.json').read_text()) for c in ('en', 'ja')}


def keys(o, p=''):
    return {p + k + '.' + kk for k, v in o.items() for kk in ([''] if not isinstance(v, dict) else [])} | \
           {kk for k, v in o.items() if isinstance(v, dict) for kk in keys(v, p + k + '.')}


bad = 0
for c, L in locs.items():
    for s in d['steps']:
        st = L['steps'].get(s['id'])
        need = []
        if not st: print(c, 'missing step', s['id']); bad += 1; continue
        need += [(st, 'title'), (st, 'text')]
        need += [(st.get('notes', {}), k) for k in s['notes']]
        need += [(L['parts'], k) for k in s['parts']]
        need += [(L['tools'], k) for k in s['tools']]
        need += [(L['evidence'], k) for k in s['evidence']]
        need += [(L['chapters'], s['chapter'])]
        for o, k in need:
            if k not in o: print(c, s['id'], 'missing', k); bad += 1
    extra = set(L['steps']) - {s['id'] for s in d['steps']}
    if extra: print(c, 'unused steps', extra); bad += 1
if keys(locs['en']) != keys(locs['ja']):
    print('key mismatch en/ja:', sorted(keys(locs['en']) ^ keys(locs['ja']))[:10]); bad += 1
print('OK' if not bad else f'{bad} problems')
sys.exit(bool(bad))
