const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'static')));

const CONTRACT_ADDRESS =
  process.env.CONTRACT_ADDRESS || '0x51FaC52B4C9ebEeaDcBbd45c9142117E69e17204';
const PRIVATE_KEY = process.env.PRIVATE_KEY || '';

// Studio Next. genlayer-js 1.x does not export this chain; 2.0.0-rc.1 does.
const CHAIN_NAME = process.env.CHAIN_NAME || 'studioDevnet';

const SNAPSHOT_API = 'https://hub.snapshot.org/graphql';

const sha256 = (s) =>
  crypto.createHash('sha256').update(s, 'utf8').digest('hex');

function getClient(account) {
  const { createClient } = require('genlayer-js');
  const chains = require('genlayer-js/chains');
  const chain = chains[CHAIN_NAME];
  if (!chain) {
    throw new Error(`chain ${CHAIN_NAME} not found in genlayer-js/chains`);
  }
  return account ? createClient({ chain, account }) : createClient({ chain });
}

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    contract: CONTRACT_ADDRESS,
    network: CHAIN_NAME,
    has_private_key: !!PRIVATE_KEY,
  });
});

app.get('/healthz', (req, res) => res.send('ok'));

// Retrieve the canonical proposal text from Snapshot. Retrieval is off-chain
// because GenVM's web module cannot reach governance hosts on any tested chain;
// the contract verifies the digest of whatever arrives here.
async function fetchProposalFromSnapshot(proposalId) {
  const query =
    `query { proposal(id: "${proposalId.replace(/"/g, '')}") ` +
    '{ id title body state author space { id } } }';
  const res = await fetch(SNAPSHOT_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const doc = await res.json();
  if (doc.errors || !doc.data || !doc.data.proposal) return null;
  return doc.data.proposal;
}

// Distinguish "consensus is still working" from "the contract refused" or
// "the contract is unreachable". The previous version treated every read error
// as "not ready", so a permanently broken contract looked like a slow network.
async function leaderExecution(txHash) {
  for (const host of [
    'explorer-studio-dev.genlayer.com',
    'explorer-studio-next.genlayer.com',
  ]) {
    try {
      const r = await fetch(`https://${host}/api/transactions/${txHash}`);
      const j = await r.json();
      const lr = j?.transaction?.consensus_data?.leader_receipt;
      const e = Array.isArray(lr) ? lr[0] : lr;
      if (e?.execution_result) {
        return {
          exec: e.execution_result,
          result: e.result
            ? Buffer.from(e.result, 'base64').toString().replace(/^\x00/, '')
            : '',
        };
      }
    } catch {
      /* indexing race */
    }
  }
  return null;
}

app.post('/api/precheck', async (req, res) => {
  try {
    const { proposal_id } = req.body;
    if (!proposal_id) {
      return res.status(400).json({ detail: 'proposal_id required' });
    }
    if (!PRIVATE_KEY) {
      return res
        .status(500)
        .json({ detail: 'PRIVATE_KEY not set. Add it in Render Environment.' });
    }
    if (!PRIVATE_KEY.startsWith('0x')) {
      return res.status(500).json({ detail: 'PRIVATE_KEY must start with 0x' });
    }

    // Allow the caller to pass text directly; otherwise retrieve it.
    let { title, body, space } = req.body;
    let sourceUrl = req.body.source_url;

    if (!body) {
      const p = await fetchProposalFromSnapshot(proposal_id);
      if (!p || !p.body) {
        return res.status(404).json({
          detail: `proposal ${proposal_id} not found at Snapshot`,
        });
      }
      title = title || p.title;
      body = p.body;
      space = space || (p.space && p.space.id) || '';
      sourceUrl = sourceUrl || SNAPSHOT_API;
    } else {
      sourceUrl = sourceUrl || SNAPSHOT_API;
      title = title || proposal_id;
    }

    const bodyHash = sha256(body);

    const { privateKeyToAccount } = require('viem/accounts');
    const client = getClient(privateKeyToAccount(PRIVATE_KEY));
    const fees = await client.estimateTransactionFees({});

    const txHash = await client.writeContract({
      address: CONTRACT_ADDRESS,
      functionName: 'check_proposal',
      args: [proposal_id, sourceUrl, title, body, bodyHash, space],
      fees: { distribution: fees.distribution, feeValue: fees.feeValue },
    });

    // Hold this request only briefly. Render's proxy returns 502 on a
    // long-held connection, which looked like a failed submission even though
    // the write landed. Return 202 with the tx and let the client poll
    // /api/check/:id, which is cheap and repeatable.
    let final = null;
    for (let i = 0; i < 3; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      final = await leaderExecution(txHash);
      if (final) break;
    }

    if (final && final.exec !== 'SUCCESS') {
      return res.status(422).json({
        proposal_id,
        verdict: 'REJECTED',
        reasoning: final.result || 'the contract refused this submission',
        status: 'refused',
        tx_hash: txHash,
        contract: CONTRACT_ADDRESS,
      });
    }

    // One quick read: if consensus was fast the record may already be there.
    let data = null;
    try {
      const parsed = JSON.parse(
        await client.readContract({
          address: CONTRACT_ADDRESS,
          functionName: 'get_check',
          args: [proposal_id],
        })
      );
      if (parsed.exists) data = parsed;
    } catch {
      /* not committed yet */
    }

    if (!data) {
      return res.status(202).json({
        proposal_id,
        verdict: 'PENDING',
        reasoning:
          'Submitted. GenLayer validators are assessing it; this page will ' +
          'update when the verdict is committed.',
        confidence: 0,
        status: 'pending',
        tx_hash: txHash,
        contract: CONTRACT_ADDRESS,
      });
    }

    res.json({
      proposal_id: data.proposal_id || proposal_id,
      verdict: data.verdict || 'REVIEW',
      reasoning: data.reasoning || 'No reasoning available',
      confidence: data.confidence || 0,
      body_hash: data.body_hash,
      body_hash_matches: data.body_hash === bodyHash,
      status: 'success',
      tx_hash: txHash,
      contract: CONTRACT_ADDRESS,
    });
  } catch (err) {
    console.error('Precheck error:', err);
    res.status(500).json({ detail: err.message });
  }
});

app.get('/api/check/:proposal_id', async (req, res) => {
  try {
    const client = getClient();
    const check = await client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: 'get_check',
      args: [req.params.proposal_id],
    });
    res.json(JSON.parse(check));
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// Lets a reviewer confirm a verdict without trusting this service.
app.get('/api/verify/:proposal_id', async (req, res) => {
  try {
    const client = getClient();
    const out = await client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: 'verify_hash',
      args: [req.params.proposal_id, req.query.body || ''],
    });
    res.json(JSON.parse(out));
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const client = getClient();
    const count = await client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: 'get_checks_count',
      args: [],
    });
    res.json({ total_checks: parseInt(count), contract: CONTRACT_ADDRESS });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.get('/api/space/:space', async (req, res) => {
  try {
    const client = getClient();
    const out = await client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: 'get_space_stats',
      args: [req.params.space],
    });
    res.json(JSON.parse(out));
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'static', 'index.html'));
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
