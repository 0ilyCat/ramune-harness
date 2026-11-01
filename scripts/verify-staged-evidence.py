import hashlib
import json
import pathlib
import re
import subprocess
import sys

repository = pathlib.Path(__file__).resolve().parent.parent
label = sys.argv[1] if len(sys.argv) > 1 else '2026-11-01'
assert re.fullmatch(r'[a-z0-9-]+', label)
root = pathlib.Path('docs/qa/evidence') / label
manifest = json.loads((repository / root / 'manifest.json').read_text(encoding='utf-8'))
for entry in manifest:
    path = (root / entry['path']).as_posix()
    raw = subprocess.check_output(['git', 'show', ':' + path], cwd=repository)
    assert len(raw) == entry['bytes'], path
    assert hashlib.sha256(raw).hexdigest() == entry['sha256'], path
print(json.dumps({'verifiedStagedRawFiles': len(manifest), 'gitByteConversion': False}))
