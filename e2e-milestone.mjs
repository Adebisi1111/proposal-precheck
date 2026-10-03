// Live milestone proof on Studio Net.
//
// Every check reads the leader's consensus_data.execution_result - a
// transaction status of 5 comes back even when the method raised, so the
// status alone proves nothing.
import { createClient, createAccount } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';

const C = process.env.ON_ADDR;
if (!C) throw new Error('ON_ADDR required');

let pass = 0, fail = 0;
function check(label, ok, detail = '') {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ' :: ' + detail : ''}`);
  ok ? pass++ : fail++;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function leaderExec(txHash) {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`https://explorer-studio.genlayer.com/api/transactions/${txHash}`);
      const j = await r.json();
      const lr = j?.transaction?.consensus_data?.leader_receipt;
      const e = Array.isArray(lr) ? lr[0] : lr;
      if (e?.execution_result) return e.execution_result;
    } catch { /* indexing race */ }
    await sleep(5000);
  }
  return 'UNAVAILABLE';
}

async function main() {
  const client = createClient({ chain: studionet, account: createAccount(process.env.PK) });

  // most views return JSON strings; contract_version returns a bare string
  const read = async (fn, args) => {
    const raw = await client.readContract({ address: C, functionName: fn, args });
    try { return JSON.parse(raw); } catch { return raw; }
  };

  console.log('=== version ===');
  const ver = await read('contract_version', []);
  check('contract reports the milestone', /milestone-1/.test(ver), ver);

  console.log('\n=== FIX 1: caller cannot supply the body ===');
  const REAL = '0x7ce0c77a1ff711d5eeffd70f8be06720bbf7d1ec07b89e111b72ad04f76c870b';
  const h1 = await client.writeContract({ address: C, functionName: 'check_proposal', args: [REAL] });
  console.log('  tx:', h1);
  const ex1 = await leaderExec(h1);
  check('real DAO proposal accepted', ex1 === 'SUCCESS', `exec=${ex1}`);

  const rec = await read('get_check', [REAL]);
  check('record exists', rec.exists === true, JSON.stringify(rec).slice(0, 200));
  check('title came from Snapshot, not the caller',
    !!rec.title && rec.title.includes('Balancer'), rec.title);
  check('space resolved from source', !!rec.space, rec.space);
  check('author resolved from source', !!rec.proposer, rec.proposer);
  check('body was actually fetched', rec.source_fetched === true, String(rec.source_fetched));
  check('real body length recorded', rec.body_len > 200, String(rec.body_len));
  check('verdict is one of the three', ['PASS', 'FAIL', 'REVIEW'].includes(rec.verdict), rec.verdict);
  console.log(`  verdict=${rec.verdict} confidence=${rec.confidence} hash=${rec.body_hash}`);

  console.log('\n=== FIX 2: verdict binds to a content hash ===');
  const bh = await read('get_body_hash', [REAL]);
  check('hash exposed for independent verification', !!bh.body_hash, JSON.stringify(bh));
  check('hash matches the record', bh.body_hash === rec.body_hash, bh.body_hash);
  check('hash is non-trivial', bh.body_hash !== '0' && bh.body_hash.length > 3, bh.body_hash);

  console.log('\n=== FIX 3: refuses rather than trusting the caller ===');
  const h2 = await client.writeContract({
    address: C, functionName: 'check_proposal',
    args: ['0x00000000000000000000000000000000000000000000000000000000deadbeef'],
  });
  const ex2 = await leaderExec(h2);
  check('non-existent proposal REFUSED (no fallback to caller text)',
    ex2 !== 'SUCCESS', `exec=${ex2}`);
  const ghost = await read('get_check', ['0x00000000000000000000000000000000000000000000000000000000deadbeef']);
  check('nothing stored for the refused proposal', ghost.exists === false, JSON.stringify(ghost));

  console.log('\n=== FIX 4: duplicate is rejected ===');
  const h3 = await client.writeContract({ address: C, functionName: 'check_proposal', args: [REAL] });
  const ex3 = await leaderExec(h3);
  check('second check of the same proposal refused', ex3 !== 'SUCCESS', `exec=${ex3}`);

  console.log('\n=== NEW: per-space listing and stats ===');
  const list = await read('list_space', [rec.space]);
  check('space lists the checked proposal',
    Array.isArray(list.proposals) && list.proposals.includes(REAL), JSON.stringify(list));
  const stats = await read('get_space_stats', [rec.space]);
  check('stats count exactly one check', stats.total === 1, JSON.stringify(stats));
  check('verdict breakdown is consistent',
    stats.pass + stats.fail + stats.review === stats.total, JSON.stringify(stats));
  const empty = await read('get_space_stats', ['nosuchspace.eth']);
  check('unknown space reads as zero, not an error',
    empty.total === 0 && empty.avg_confidence === 0, JSON.stringify(empty));

  console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
}

main().catch((e) => { console.error('HARNESS FAIL:', e.message); console.error(e.stack); process.exit(1); });