import sqlite3, pathlib, json
root = pathlib.Path.home() / '.local/share/ramune-harness-qa-20261101/native-smoke-state'
for path in root.rglob('*.sqlite'):
    conn = sqlite3.connect(f'file:{path}?mode=ro', uri=True)
    tables = [r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")]
    relevant = {name: [r[1] for r in conn.execute('PRAGMA table_info("' + name.replace('"', '""') + '")')] for name in tables if any(s in name for s in ['message', 'session', 'transcript', 'turn', 'event'])}
    print(json.dumps({'db':str(path), 'tables':relevant}, ensure_ascii=False))
    conn.close()
