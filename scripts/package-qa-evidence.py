import hashlib
import json
import pathlib
import re
import shutil
import sys
import zipfile

repository = pathlib.Path(__file__).resolve().parent.parent
source_label = sys.argv[1] if len(sys.argv) > 1 else 'final-qa-20261101'
destination_label = sys.argv[2] if len(sys.argv) > 2 else '2026-11-01'
assert all(re.fullmatch(r'[a-z0-9-]+', label) for label in [source_label, destination_label])
source = repository / '.ramune/evidence' / source_label
destination = repository / 'docs/qa/evidence' / destination_label
destination.mkdir(parents=True, exist_ok=True)
manifest = []
for path in sorted(source.rglob('*')):
    if not path.is_file() or path.suffix in ['.gz', '.zip']:
        continue
    relative = path.relative_to(source)
    target = destination / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(path, target)
    raw = path.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()
    assert hashlib.sha256(target.read_bytes()).hexdigest() == digest
    manifest.append({'path': relative.as_posix(), 'bytes': len(raw), 'sha256': digest})
for name in ['server-manifest.json', 'wsl-manifest.json']:
    if not (destination / name).exists():
        continue
    for entry in json.loads((destination / name).read_text()):
        raw = (destination / entry['path']).read_bytes()
        assert len(raw) == entry['bytes']
        assert hashlib.sha256(raw).hexdigest() == entry['sha256']
manifest_file = destination / 'manifest.json'
manifest_file.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
archive = destination.parent / (destination_label + '-raw-logs.zip')
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as bundle:
    for entry in manifest:
        bundle.write(destination / entry['path'], entry['path'])
    bundle.write(manifest_file, 'manifest.json')
with zipfile.ZipFile(archive) as bundle:
    for entry in manifest:
        assert hashlib.sha256(bundle.read(entry['path'])).hexdigest() == entry['sha256']
print(json.dumps({'files': len(manifest), 'bytes': sum(e['bytes'] for e in manifest),
                  'archive': str(archive), 'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
                  'rawFilesRewritten': False}))
