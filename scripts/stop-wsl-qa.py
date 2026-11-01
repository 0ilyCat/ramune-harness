import pathlib, os, signal
root = pathlib.Path.home() / '.local/share/ramune-harness-final-qa-20261101'
pid = int((root / 'server.pid').read_text())
cmd = pathlib.Path(f'/proc/{pid}/cmdline').read_bytes().replace(b'\0', b' ').decode()
if str(root / 'app/dist/server/index.js') not in cmd: raise RuntimeError('PID 不是本次 QA 服务，不停止')
os.kill(pid, signal.SIGTERM)
print('已请求本次 WSL QA 服务正常退出')
