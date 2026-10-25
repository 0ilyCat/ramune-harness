import net from 'node:net';
const [listenHost, allowedClient, portText = '18317'] = process.argv.slice(2);
const port = Number(portText);
if (!net.isIPv4(listenHost) || !net.isIPv4(allowedClient) || !Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('必须指定 WSL 虚拟网卡地址、客户端地址及有效端口');
const sockets = new Set();
const server = net.createServer(client => {
  if (client.remoteAddress !== allowedClient) { client.destroy(); return; }
  const upstream = net.connect({ host: '127.0.0.1', port: 8317 });
  sockets.add(client); sockets.add(upstream);
  const close = () => { sockets.delete(client); sockets.delete(upstream); client.destroy(); upstream.destroy(); };
  client.on('error', close); upstream.on('error', close); client.on('close', close); upstream.on('close', close);
  client.pipe(upstream); upstream.pipe(client);
});
server.listen({ host: listenHost, port, exclusive: true }, () => console.log(`WSL TCP 转发已启动：${listenHost}:${port} → 127.0.0.1:8317；仅允许 ${allowedClient}`));
function stop() { for (const socket of sockets) socket.destroy(); server.close(); }
process.on('SIGINT', stop); process.on('SIGTERM', stop);
