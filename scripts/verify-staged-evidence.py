import hashlib
import json
import pathlib
import subprocess

repository = pathlib.Path(__file__).resolve().parent.parent
root = pathlib.Path('docs/qa/evidence/2026-11-01')
manifest = json.loads((repository / root / 'manifest.json').read_text(encoding='utf-8'))
for entry in manifest:
    path = (root / entry['path']).as_posix()
    raw = subprocess.check_output(['git', 'show', ':' + path], cwd=repository)
    assert len(raw) == entry['bytes'], path
    assert hashlib.sha256(raw).hexdigest() == entry['sha256'], path
print(json.dumps({'verifiedStagedRawFiles': len(manifest), 'gitByteConversion': False}))
