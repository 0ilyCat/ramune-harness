const addresses = process.argv.slice(2);
for (const base of addresses) {
  try { const r = await fetch(`${base.replace(/\/$/, '')}/v1/models`, { signal: AbortSignal.timeout(4000) }); console.log(JSON.stringify({ base, status: r.status })); }
  catch (error) { console.log(JSON.stringify({ base, error: error.cause?.code || error.name })); }
}
