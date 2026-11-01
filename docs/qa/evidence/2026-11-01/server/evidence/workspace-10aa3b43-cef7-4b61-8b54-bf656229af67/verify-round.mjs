import fs from 'node:fs';
const input=fs.readFileSync(0,'utf8');const matches=[...input.matchAll(/RAMUNE_VALUE=(\d+)/g)];
const state=JSON.parse(fs.readFileSync('round-state.json','utf8'));const next=state.round+1;
if(!matches.length||Number(matches.at(-1)[1])!==next*2){console.error('ROUND_REJECTED',JSON.stringify({next,expected:next*2,input}));process.exit(2)}
fs.writeFileSync('round-state.json',JSON.stringify({round:next,value:next*2}));
console.log('ROUND_ACCEPTED '+JSON.stringify({round:next,value:next*2,roundsRequired:5}));
process.exit(next===5?0:1);
