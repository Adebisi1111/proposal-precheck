
const TX='0x099d46881d9cdd2e6cb015e0621dba4230c9cb02c2d3f77b5f4607bb7c857837';
const r=await fetch(`https://explorer-studio-dev.genlayer.com/api/transactions/${TX}`);
const j=await r.json();
const lr=j?.transaction?.consensus_data?.leader_receipt;
const e=Array.isArray(lr)?lr[0]:lr;
console.log('REDEPLOY -> exec:', e?.execution_result,
  '| result:', e?.result?Buffer.from(e.result,'base64').toString().replace(/^\x00/,''):null);
