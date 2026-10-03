import crypto from 'crypto';
import { createClient, createAccount } from 'genlayer-js';
import { studioDevnet } from 'genlayer-js/chains';

const C = process.env.ON_ADDR;
const client = createClient({ chain: studioDevnet, account: createAccount(process.env.PK) });
const fees = await client.estimateTransactionFees({});
const feeOpts = { distribution: fees.distribution, feeValue: fees.feeValue };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function leaderExec(hash) {
  for (let i = 0; i < 30; i++) {
    for (const host of ['explorer-studio-dev.genlayer.com', 'explorer-studio-next.genlayer.com']) {
      try {
        const txt = await (await fetch(`https://${host}/api/transactions/${hash}`)).text();
        if (txt.trim().startsWith('{')) {
          const j = JSON.parse(txt);
          const lr = j?.transaction?.consensus_data?.leader_receipt;
          const e = Array.isArray(lr) ? lr[0] : lr;
          if (e?.execution_result) {
            return {
              exec: e.execution_result,
              result: e.result ? Buffer.from(e.result, 'base64').toString().replace(/^\x00/, '') : '',
            };
          }
        }
      } catch { /* race */ }
    }
    await sleep(7000);
  }
  return { exec: 'UNAVAILABLE', result: '' };
}

async function read(fn, args) {
  const raw = await client.readContract({ address: C, functionName: fn, args });
  try { return JSON.parse(raw); } catch { return raw; }
}

const TARGETS = [
  ['CONTROL  static site      ', 'https://example.com'],
  ['GOVERNANCE  snapshot hub ', 'https://hub.snapshot.org/graphql'],
  ['MIRROR  ipfs gateway    ', 'https://ipfs.io/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG'],
];

for (const [label, url] of TARGETS) {
  try {
    const tx = await client.writeContract({
      address: C, functionName: 'probe', args: [url], fees: feeOpts,
    });
    const { exec, result } = await leaderExec(tx);
    console.log(`${label} exec=${exec}  ${result.slice(0, 90)}`);
  } catch (e) {
    console.log(`${label} REJECTED ${String(e.message).slice(0, 90)}`);
  }
}
