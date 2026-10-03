
// Two questions the harness raised:
//  1. get_check said exists:false while list_space/verify_hash saw the record
//     -> stale read, or a real inconsistency?
//  2. rejected_hashes stayed 0 after a refusal
//     -> my increment is rolled back by the raise?
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

const id = '0x' + crypto.randomBytes(32).toString('hex');
const BODY = 'This proposal allocates 250,000 USDC from the community treasury to a third-party security firm to perform quarterly audits of the core lending protocol with full scope and milestones.';
const SNAP = 'https://hub.snapshot.org/graphql';

// deliberate mismatch, to see if the audit counter survives the raise
const tx = await client.writeContract({ address:C, functionName:'check_proposal',
  args:[id, SNAP, 'T', BODY, sha('lie'), 's.eth'], fees: feeOpts });
console.log('mismatch tx:', tx);

for (const wait of [3, 10, 25]) {
  await sleep(wait * 1000);
  const n = await read('get_rejected_hashes', []);
  const rec = await read('get_check', [id]);
  console.log(`t+${wait}s  rejected_hashes=${n}  get_check.exists=${rec.exists}`);
}

// now a GOOD one and re-read the same record repeatedly
const id2 = '0x' + crypto.randomBytes(32).toString('hex');
const tx2 = await client.writeContract({ address:C, functionName:'check_proposal',
  args:[id2, SNAP, 'T', BODY, sha(BODY), 's.eth'], fees: feeOpts });
console.log('good tx:', tx2);
for (let i = 1; i <= 4; i++) {
  await sleep(8000);
  const rec = await read('get_check', [id2]);
  const list = await read('list_space', ['s.eth']);
  console.log(`poll ${i}: get_check.exists=${rec.exists} | in list=${JSON.stringify(list.proposals).includes(id2)}`);
}
