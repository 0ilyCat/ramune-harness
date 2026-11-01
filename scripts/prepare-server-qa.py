import json, pathlib, os, urllib.request, urllib.error, concurrent.futures

root = pathlib.Path.home() / '.local/share/ramune-harness-qa-20261101'
root.mkdir(parents=True, exist_ok=True)
work = root / 'workspace'
work.mkdir(exist_ok=True)
cfg = json.loads((pathlib.Path.home() / '.openclaw/openclaw.json').read_text())
providers = cfg['models']['providers']
models = ['gemini-4-argon-high', 'gemini-3.8-flash-high', 'claude-opus-5-5-high']
provider = providers['cliproxy']
known = {m['id'] for m in provider['models']}
assert all(m in known for m in models), '缺少指定的模型配置'
isolated = {
    'models': cfg['models'],
    'agents': {'defaults': {'workspace': str(work), 'model': 'cliproxy/gemini-3.8-flash-high', 'skipBootstrap': True}},
    'tools': {'allow': ['read', 'write', 'edit'], 'fs': {'workspaceOnly': True}},
    'plugins': {'enabled': False},
}
config_file = root / 'openclaw-qa.json'
config_file.write_text(json.dumps(isolated, ensure_ascii=False, indent=2))
os.chmod(config_file, 0o600)
(work / 'fixture.json').write_text(json.dumps({'seed': 0, 'verification': 'RAMUNE_REAL_OPENCLAW_20261101'}))
(work / 'round-state.json').write_text(json.dumps({'round': 0, 'value': 0}))
prompt = '请真实调用 read 工具读取当前目录 fixture.json，随后只回复其中 verification 字段的原文。禁止发送消息、联网、执行命令、改配置或修改文件。'
(root / 'smoke-prompt.txt').write_text(prompt)
print(json.dumps({'qaRoot': str(root), 'config': str(config_file), 'modelsConfigured': models, 'ambientConfigChanged': False}, ensure_ascii=False))
key = provider.get('apiKey', '')
if not isinstance(key, str): raise RuntimeError('当前 QA 需要可解析的现有 CLIProxy 凭据；未导出凭据')
base = provider['baseUrl'].rstrip('/')
def probe(model):
    payload = {'model': model, 'messages': [{'role': 'user', 'content': 'Reply exactly RAMUNE_MODEL_OK'}], 'max_tokens': 256, 'stream': False}
    req = urllib.request.Request(base + '/chat/completions', data=json.dumps(payload).encode(), headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'})
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    try:
        with opener.open(req, timeout=90) as resp:
            body = resp.read()
            (root / (model + '.response.json')).write_bytes(body)
            result = json.loads(body)
            return {'model': model, 'httpStatus': resp.status, 'response': result}
    except urllib.error.HTTPError as e:
        body = e.read(); (root / (model + '.response.json')).write_bytes(body)
        return {'model': model, 'httpStatus': e.code, 'body': body.decode(errors='replace')}
    except Exception as e: return {'model': model, 'error': str(e)}
for result in concurrent.futures.ThreadPoolExecutor(max_workers=3).map(probe, models): print(json.dumps(result, ensure_ascii=False))
