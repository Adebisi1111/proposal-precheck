
const TX2='0x0a83cbfab5161ae0ed12eb771f62420246644b9877026def8e7e5e7f8212338d';
const r=await fetch(`https://explorer-studio-dev.genlayer.com/api/transactions/${TX2}`);
const j=await r.json();
const t=j?.transaction;
const cd=t?.consensus_data;
// what does the transaction record say about generated contracts / writes?
console.log('status_code     :', t?.status_code);
console.log('contract_address:', t?.contract_address);
console.log('consensus keys  :', Object.keys(cd||{}).join(', '));
console.log('to             :', JSON.stringify(t?.to).slice(0,120));
console.log('data           :', JSON.stringify(t?.data).slice(0,120));
const sc = cd?.state_commitments || cd?.state_receipts;
console.log('state_commitments type:', Array.isArray(sc)? 'array len '+sc.length : typeof sc);
if (Array.isArray(sc)) {
  for (const c of sc.slice(0,4)) {
    console.log('  contract:', c?.contract_address ?? c?.address, '| keys:', Object.keys(c||{}).join(','));
  }
}
