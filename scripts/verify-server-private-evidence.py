import json
import pathlib

root = pathlib.Path.home() / '.local/share/ramune-harness-qa-20261101'
configuration = json.loads((root / 'openclaw-qa.json').read_text())
keys = [p.get('apiKey') for p in configuration['models']['providers'].values()]
keys = [k.encode() for k in keys if isinstance(k, str) and len(k) >= 6]
assert keys, '无法核验实际私有凭据，拒绝假报扫描通过'
matches = []
for path in (root / 'evidence-export/server').rglob('*'):
    if path.is_file() and any(key in path.read_bytes() for key in keys):
        matches.append(str(path.relative_to(root / 'evidence-export')))
print(json.dumps({'scannedActualProviderKeys': len(keys), 'matchingFiles': matches}))
assert not matches, '导出证据包含实际凭据，不可发布'
