const base = process.env.RAMUNE_URL || process.argv[2] || 'http://127.0.0.1:4321';
const root = await fetch(base); const cookie = root.headers.getSetCookie().map(v => v.split(';')[0]).join('; ');
const get = async path => { const r = await fetch(base + '/api' + path, { headers: { cookie } }); return { status: r.status, data: await r.json() }; };
console.log('QA_ENVIRONMENT ' + JSON.stringify((await get('/environment')).data));
console.log('QA_MODELS ' + JSON.stringify(await get('/models')));
const runs = (await get('/runs')).data;
if (runs.length) {
  const run = (await get('/runs/' + runs[0].id)).data;
  console.log('QA_RUN_STATUS ' + JSON.stringify({ id: run.id, status: run.status, steps: run.steps, invocations: run.invocations.map(i => ({ node: i.nodeId, status: i.status, session: i.sessionId })), rounds: run.events.filter(e => e.type === 'check.result').map(e => e.data.output?.split('\n')[0]), error: run.error }));
}
