
// The earlier "counter is dead" reading was taken ~25s after the tx; state
// commits later than that. Poll until the store reflects the write.
import crypto from 'crypto';
import { createClient, createAccount } from 'genlayer-js';
import { studioDevnet } from 'genlayer-js/chains';

const C = process.env.ON_ADDR;
const client = createClient({ chain: studioDevnet, account: createAccount(process.env.PK) });
const fees = await client.estimateTransactionFees({});
const feeOpts = { distribution: fees.distribution, feeValue: fees.feeValue };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const sha = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');
const read = async (fn, a) => { const r = await client.readContract({address:C,functionName:fn,args:a}); try { return JSON.parse(r); } catch { return r; } };

const SNAP='https://hub.snapshot.org/graphql';
const BODY='This proposal allocates 250,000 USDC to a third-party security firm for quarterly audits of the core lending protocol, with full scope and milestones.';
const before = parseInt(await read('get_rejected_hashes', []), 10);
console.log('counter before:', before);

const id='0x'+crypto.randomBytes(32).toString('hex');
const tx = await client.writeContract({ address:C, functionName:'check_proposal',
  args:[id, SNAP, 'T', BODY, sha('lie'), 's.eth'], fees: feeOpts });
console.log('mismatch tx:', tx);

for (let i=1;i<=10;i++){
  await sleep(10000);
  const n = parseInt(await read('get_rejected_hashes', []), 10);
  console.log(`  t+${i*10}s  rejected_hashes=${n}${n>before?'  <-- INCREMENTED':''}`);
  if (n > before) break;
}
