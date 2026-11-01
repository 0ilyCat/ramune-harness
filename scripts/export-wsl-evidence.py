import hashlib
import json
import pathlib
import shutil
import sys

root = pathlib.Path.home() / '.local/share/ramune-harness-final-qa-20261101'
destination = pathlib.Path(sys.argv[1])
sources = list((root / 'data/runs').glob('*'))
sources += [p for p in (root / 'data/artifacts').rglob('*')
            if p.name in ['stdout.log', 'stderr.log', 'manifest.json']]
manifest = []
for source in sorted(p for p in sources if p.is_file()):
    target = destination / 'wsl' / source.relative_to(root)
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(source, target)
    raw = source.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    assert hashlib.sha256(target.read_bytes()).hexdigest() == digest
    manifest.append({'path': str(target.relative_to(destination)),
                     'bytes': len(raw), 'sha256': digest})
(destination / 'wsl-manifest.json').write_text(json.dumps(manifest, indent=2))
print(json.dumps({'files': len(manifest), 'rawFilesRewritten': False}))
