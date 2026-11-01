import hashlib
import json
import pathlib
import shutil
import zipfile

repository = pathlib.Path(__file__).resolve().parent.parent
source = repository / '.ramune/evidence/final-qa-20261101'
destination = repository / 'docs/qa/evidence/2026-11-01'
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
    for entry in json.loads((destination / name).read_text()):
        raw = (destination / entry['path']).read_bytes()
        assert len(raw) == entry['bytes']
        assert hashlib.sha256(raw).hexdigest() == entry['sha256']
manifest_file = destination / 'manifest.json'
manifest_file.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
archive = destination.parent / '2026-11-01-raw-logs.zip'
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
