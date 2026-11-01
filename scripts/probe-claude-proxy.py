import json
import pathlib
import sys
import urllib.error
import urllib.request

settings = json.loads(pathlib.Path(sys.argv[1]).read_text())
environment = settings['env']
base = environment['ANTHROPIC_BASE_URL'].rstrip('/')
key = environment.get('ANTHROPIC_AUTH_TOKEN') or environment['ANTHROPIC_API_KEY']
opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
catalog_request = urllib.request.Request(base + '/v1/models', headers={'Authorization': 'Bearer ' + key})
with opener.open(catalog_request, timeout=30) as response:
    ids = [entry['id'] for entry in json.load(response)['data']]
print(json.dumps({'stage': 'catalog', 'gemini38': [identifier for identifier in ids if '3.8' in identifier], 'profileModel': settings.get('model')}, ensure_ascii=False))
model = 'gemini-3.8-flash-high'
assert model in ids, '指定的 Gemini 3.8 模型不在实际目录'
body = json.dumps({'model': model, 'max_tokens': 128, 'messages': [{'role': 'user', 'content': 'Reply exactly RAMUNE_GEMINI38_OK'}]}).encode()
request = urllib.request.Request(base + '/v1/messages', data=body, headers={
    'Authorization': 'Bearer ' + key, 'x-api-key': key,
    'anthropic-version': '2023-06-01', 'Content-Type': 'application/json'})
try:
    with opener.open(request, timeout=120) as response:
        print(json.dumps({'stage': 'messages', 'model': model, 'httpStatus': response.status, 'response': json.load(response)}, ensure_ascii=False))
except urllib.error.HTTPError as error:
    print(json.dumps({'stage': 'messages', 'model': model, 'httpStatus': error.code, 'body': error.read().decode(errors='replace')}, ensure_ascii=False))
    sys.exit(1)
