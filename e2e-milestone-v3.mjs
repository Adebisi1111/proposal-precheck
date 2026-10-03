// Live adversarial proof for the Proposal Pre-Check milestone, Studio Next 61997.
//
// The local test suite cannot run against the deployed contract: it needs the
// 2.x runner (gl.contract.Contract, genlayer.storage), which no published genvm
// release carries and Studio Next's copy is not downloadable. So this harness
// drives the DEPLOYED artifact directly — which is stronger evidence anyway.
//
// Every check reads consensus_data.execution_result from the leader. A
// transaction status of 5 comes back even when the method raised, so the status
// alone proves nothing.
import crypto from 'crypto';
import { createClient, createAccount } from 'genlayer-js';
import { studioDevnet } from 'genlayer-js/chains';

const C = process.env.ON_ADDR;
if (!C) throw new Error('ON_ADDR required');

const client = createClient({
  chain: studioDevnet,
  account: createAccount(process.env.PK),
});

let pass = 0, fail = 0;
function check(label, ok, detail = '') {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ' :: ' + detail : ''}`);
  ok ? pass++ : fail++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sha = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');

const fees = await client.estimateTransactionFees({});
const feeOpts = { distribution: fees.distribution, feeValue: fees.feeValue };

async function leaderExec(hash) {
  for (let i = 0; i < 30; i++) {
    for (const host of ['explorer-studio-dev.genlayer.com', 'explorer-studio-next.genlayer.com']) {
      try {
        const r = await fetch(`https://${host}/api/transactions/${hash}`);
        const j = await r.json();
        const lr = j?.transaction?.consensus_data?.leader_receipt;
        const e = Array.isArray(lr) ? lr[0] : lr;
        if (e?.execution_result) {
          const res = e.result ? Buffer.from(e.result, 'base64').toString().replace(/^\x00/, '') : '';
          return { exec: e.execution_result, result: res };
        }
      } catch { /* indexing race */ }
    }
    await sleep(5000);
  }
  return { exec: 'UNAVAILABLE', result: '' };
}

async function write(fn, args) {
  try {
    const tx = await client.writeContract({ address: C, functionName: fn, args, fees: feeOpts });
    return { ...(await leaderExec(tx)), tx };
  } catch (e) {
    return { exec: 'REJECTED', result: String(e.message).slice(0, 160) };
  }
}

async function read(fn, args) {
  const raw = await client.readContract({ address: C, functionName: fn, args });
  try { return JSON.parse(raw); } catch { return raw; }
}

// State commits some seconds after the leader reports SUCCESS - a read issued
// immediately after a write can still see the previous state. Poll until the
// expected value appears rather than racing it.
async function readUntil(fn, args, predicate, tries = 30, gapMs = 10000) {
  let last;
  for (let i = 0; i < tries; i++) {
    last = await read(fn, args);
    if (predicate(last)) return last;
    await sleep(gapMs);
  }
  return last;
}

const SNAP = 'https://hub.snapshot.org/graphql';
// A real proposal, long enough to clear MIN_BODY_LEN.
const BODY =
  'This proposal allocates 250,000 USDC from the community treasury to a ' +
  'third-party security firm to perform quarterly smart-contract audits of the ' +
  'core lending protocol. Scope, deliverables, payment milestones, and the ' +
  'selection process are specified in full.';
const TITLE = 'Fund the security audit retainer';
const SPACE = 'gooddao.eth';

async function main() {
  console.log('=== contract identity ===');
  const ver = await read('contract_version', []);
  check('reports the milestone', String(ver).includes('milestone-1'), String(ver));
  // Do NOT assume an empty store: this deployment may already hold records from
  // an earlier run. Every count below is a delta against this baseline.
  const baseCount = parseInt(await read('get_checks_count', []), 10);
  console.log(`        baseline checks on this deployment: ${baseCount}`);

  console.log('\n=== 1. a correctly declared digest is accepted ===');
  const id1 = '0x' + crypto.randomBytes(32).toString('hex');
  const good = await write('check_proposal',
    [id1, SNAP, TITLE, BODY, sha(BODY), SPACE]);
  check('verdict produced', good.exec === 'SUCCESS', `exec=${good.exec} ${good.result}`);
  const rec = await readUntil('get_check', [id1], (r) => r && r.exists === true);
  check('record stored', rec.exists === true, JSON.stringify(rec).slice(0, 140));
  check('stored hash matches the submitted body', rec.body_hash === sha(BODY), rec.body_hash);
  check('body length recorded', rec.body_len === BODY.length, String(rec.body_len));
  check('verdict is one of three',
    ['PASS', 'FAIL', 'REVIEW'].includes(rec.verdict), rec.verdict);
  check('source recorded', String(rec.source_url).includes('snapshot.org'), rec.source_url);
  console.log(`        verdict=${rec.verdict} confidence=${rec.confidence}`);

  console.log('\n=== 2. a LYING digest is refused (the whole release) ===');
  const id2 = '0x' + crypto.randomBytes(32).toString('hex');
  const countBefore = parseInt(await read('get_checks_count', []), 10);
  const lie = await write('check_proposal', [id2, SNAP, TITLE, BODY, sha('different text'), SPACE]);
  check('refused', lie.exec !== 'SUCCESS', `exec=${lie.exec}`);
  check('error names both digests', /body_hash does not match body/.test(lie.result),
    lie.result.slice(0, 110));
  // poll: a refused tx must leave the store unchanged once state settles
  await sleep(20000);
  check('nothing stored for it', (await read('get_check', [id2])).exists === false);
  check('store count unchanged by the refusal',
    parseInt(await read('get_checks_count', []), 10) === countBefore,
    `${countBefore} -> ${await read('get_checks_count', [])}`);
  check('refusal count reflects the good write only',
    parseInt(await read('get_checks_count', []), 10) === baseCount + 1,
    `baseline ${baseCount}, now ${await read('get_checks_count', [])}`);

  console.log('\n=== 3. a reviewer can independently confirm the verdict ===');
  const v = await readUntil('verify_hash', [id1, BODY],
    (r) => r && r.exists === true && r.matches === true);
  check('recompute matches', v.matches === true, JSON.stringify(v).slice(0, 140));
  const v2 = await read('verify_hash', [id1, BODY + ' plus something evil']);
  check('different text does NOT match', v2.matches === false, JSON.stringify(v2).slice(0, 140));

  console.log('\n=== 4. source is pinned to a canonical governance host ===');
  const id3 = '0x' + crypto.randomBytes(32).toString('hex');
  const evil = await write('check_proposal',
    [id3, 'https://evil.example.com/proposal', TITLE, BODY, sha(BODY), SPACE]);
  check('non-canonical source refused', evil.exec !== 'SUCCESS', `exec=${evil.exec}`);

  const id4 = '0x' + crypto.randomBytes(32).toString('hex');
  const lookalike = await write('check_proposal',
    [id4, 'https://hub.snapshot.org.evil.io/x', TITLE, BODY, sha(BODY), SPACE]);
  check('lookalike subdomain refused', lookalike.exec !== 'SUCCESS', `exec=${lookalike.exec}`);

  console.log('\n=== 5. a verdict needs a real proposal to judge ===');
  const id5 = '0x' + crypto.randomBytes(32).toString('hex');
  const tiny = 'do a thing';
  const short = await write('check_proposal', [id5, SNAP, TITLE, tiny, sha(tiny), SPACE]);
  check('too-short body refused', short.exec !== 'SUCCESS', `exec=${short.exec}`);

  console.log('\n=== 6. duplicates are refused ===');
  const dup = await write('check_proposal', [id1, SNAP, TITLE, BODY, sha(BODY), SPACE]);
  check('second check of the same id refused', dup.exec !== 'SUCCESS', `exec=${dup.exec}`);

  console.log('\n=== 7. space listing and stats ===');
  const baseStatsBefore = parseInt(
    (await read('get_space_stats', [SPACE])).total || 0, 10);
  const list = await readUntil('list_space', [SPACE],
    (l) => Array.isArray(l.proposals) && l.proposals.includes(id1));
  check('space lists the checked proposal',
    Array.isArray(list.proposals) && list.proposals.includes(id1), JSON.stringify(list));
  const stats = await readUntil('get_space_stats', [SPACE],
    (s) => s && s.total >= baseStatsBefore);
  check('stats include this proposal',
    stats.total >= baseStatsBefore + 1, JSON.stringify(stats));
  check('avg confidence is sane', stats.avg_confidence >= 0 && stats.avg_confidence <= 100,
    String(stats.avg_confidence));

  console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error('HARNESS FAIL:', e.message); process.exit(1); });
