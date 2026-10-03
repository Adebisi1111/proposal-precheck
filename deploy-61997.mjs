// Deploy to Studio Next (61997) using genlayer-js 2.0.0-rc.1's native
// studioDevnet chain.
//
// Two things the 1.1.8 path could not do:
//   1. studioDevnet is not in 1.1.8's preset list at all
//   2. 1.1.8's deployContract sent transactions with no fee distribution,
//      which consensus v0.6 rejects at admission with NO_MAJORITY
import fs from 'fs';
import { createClient, createAccount } from 'genlayer-js';
import { studioDevnet } from 'genlayer-js/chains';

const PK = process.env.DEPLOY_PK;
if (!PK) { console.error('DEPLOY_PK not set'); process.exit(1); }
const CONTRACT = process.env.CONTRACT_PATH
  || '/home/administrator/proposal-precheck/contracts/_web_probe.py';

const client = createClient({ chain: studioDevnet, account: createAccount(PK) });
const code = fs.readFileSync(CONTRACT);
console.log('chain id   :', studioDevnet.id);
console.log('rpc        :', studioDevnet.rpcUrls.default.http[0]);
console.log('bytes      :', code.length);

// Consensus v0.6 requires a non-zero fee distribution. Ask the SDK for one
// rather than hard-coding a value: a zero fee is rejected at admission with
// FeeValueMustBeNonZero, and a wildly wrong one wastes real GEN.
const fees = await client.estimateTransactionFees({});
console.log('fee estimate:', JSON.stringify(fees, (k, v) =>
  typeof v === 'bigint' ? v.toString() : v));

const tx = await client.deployContract({
  code: new Uint8Array(code),
  args: [],
  fees: { distribution: fees.distribution, feeValue: fees.feeValue },
});
console.log('Deploy TX  :', tx);

const receipt = await client.waitForTransactionReceipt({
  hash: tx, waitUntil: 'decided', retries: 300, interval: 3000, fullTransaction: true,
});
console.log('status     :', receipt?.status);
const ca = receipt?.data?.contract_address ?? receipt?.contract_address ?? receipt?.logs?.[0]?.address;
console.log('contract   :', ca);
if (ca) fs.writeFileSync('/tmp/probe_61997.txt', ca);
