import json
import pathlib
import sys

profile = pathlib.Path.home() / '.local/share/ramune-harness-final-qa-20261101/claude-settings.json'
settings = json.loads(profile.read_text())
keys = [value.encode() for name, value in settings['env'].items()
        if ('TOKEN' in name or 'API_KEY' in name) and isinstance(value, str) and len(value) >= 6]
assert keys, '没有可核验的实际私有凭据'
root = pathlib.Path(sys.argv[1])
matches = [str(path.relative_to(root)) for path in root.rglob('*')
           if path.is_file() and any(key in path.read_bytes() for key in keys)]
print(json.dumps({'scannedActualKeys': len(keys), 'matchingFiles': matches}))
assert not matches, '证据中包含实际凭据，不可发布'
