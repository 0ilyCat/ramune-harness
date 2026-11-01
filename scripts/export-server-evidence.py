import json, pathlib, shutil, hashlib, tarfile

root = pathlib.Path.home() / '.local/share/ramune-harness-qa-20261101'
dest = root / 'evidence-export/server'
dest.mkdir(parents=True, exist_ok=True)
sources = [p for p in (root / 'evidence').rglob('*') if p.is_file()]
sources += [p for p in (root / 'data/runs').glob('*') if p.is_file()]
sources += [p for p in (root / 'data/artifacts').rglob('*') if p.is_file() and p.name in ['stdout.log', 'stderr.log', 'manifest.json', 'native-transcript.jsonl']]
sources += list(root.glob('*.response.json'))
manifest = []
for path in sorted(set(sources)):
    relative = path.relative_to(root)
    target = dest / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(path, target)
    data = path.read_bytes()
    assert hashlib.sha256(data).hexdigest() == hashlib.sha256(target.read_bytes()).hexdigest()
    manifest.append({'path': str(pathlib.Path('server') / relative), 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
(root / 'evidence-export/server-manifest.json').write_text(json.dumps(manifest, indent=2))
with tarfile.open(root / 'raw-evidence.tar.gz', 'w:gz') as archive:
    archive.add(root / 'evidence-export/server', arcname='server')
    archive.add(root / 'evidence-export/server-manifest.json', arcname='server-manifest.json')
print(json.dumps({'files': len(manifest), 'bytes': sum(m['bytes'] for m in manifest), 'archive': str(root / 'raw-evidence.tar.gz'), 'rawFilesRewritten': False}))
