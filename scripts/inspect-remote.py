import json, os, pathlib, subprocess, urllib.request, urllib.error

config_path = pathlib.Path.home() / '.openclaw/openclaw.json'
cfg = json.loads(config_path.read_text())
proxy_config = pathlib.Path.home() / '.cli-proxy-api/config.yaml'
print(json.dumps({'proxyConfig': str(proxy_config), 'listenConfig': [line for line in proxy_config.read_text().splitlines() if line.startswith(('host:', 'port:'))]}, ensure_ascii=False))
providers = cfg.get('models', {}).get('providers', {})
print(json.dumps({'config': str(config_path), 'providers': {k: {'baseUrl': v.get('baseUrl'), 'api': v.get('api'), 'models': [m.get('id') for m in v.get('models', [])]} for k,v in providers.items()}, 'agentsDefaultModel': cfg.get('agents', {}).get('defaults', {}).get('model')}, ensure_ascii=False))
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
for name, provider in providers.items():
    base = provider.get('baseUrl', '').rstrip('/')
    if not base.startswith(('http://127.0.0.1:', 'http://localhost:')): continue
    key = provider.get('apiKey', '')
    if isinstance(key, dict): key = os.environ.get(key.get('id', ''), '')
    if not isinstance(key, str): continue
    if key.startswith('${') and key.endswith('}'): key = os.environ.get(key[2:-1], '')
    req = urllib.request.Request(base + ('/models' if base.endswith('/v1') else '/v1/models'), headers={'Authorization':'Bearer '+key})
    try:
        with opener.open(req, timeout=15) as resp:
            data = json.load(resp)
            print(json.dumps({'provider': name, 'catalogStatus': resp.status, 'models': [m['id'] for m in data.get('data', [])]}, ensure_ascii=False))
    except Exception as e: print(json.dumps({'provider': name, 'error': str(e)}, ensure_ascii=False))
