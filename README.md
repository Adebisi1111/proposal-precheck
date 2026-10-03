# Proposal Pre-Check

AI-powered DAO proposal validation on GenLayer. A proposal is assessed by a
committee of AI validators before it goes to a vote, and the verdict is stored
on-chain bound to the exact text that was judged.

## Milestone 1 — hash-verified assessment

The original judged whatever text the caller pasted, so a proposer could launder
a proposal through a sanitised paraphrase and collect a clean PASS. This release
grounds every verdict in a digest the contract computes itself.

- `check_proposal(proposal_id, source_url, title, body, body_hash, space)`
  recomputes SHA-256 over `body` and **refuses any mismatch**. The bytes assessed
  are provably the bytes declared.
- The stored verdict is bound to that digest, so a reviewer can re-fetch the
  proposal, re-hash it, and confirm the verdict refers to exactly those bytes.
- `verify_hash(proposal_id, body)` lets anyone do that check without trusting
  this service.
- `source_url` must be a canonical governance host, so `hub.snapshot.org.evil.io`
  cannot pose as Snapshot.
- Bodies too short to be a proposal are refused rather than judged.
- Any verdict outside PASS/FAIL/REVIEW, and any consensus failure, resolves to
  REVIEW — never to PASS.

### Where retrieval happens

Retrieval is off-chain: the backend fetches from Snapshot's GraphQL hub and
submits `(title, body, body_hash)`. This is not a shortcut — GenVM's web module
cannot reach governance hosts from inside a contract, on any chain tested. What
the contract guarantees on-chain is that the assessed text is intact and pinned
to a digest any third party can independently recompute. It does not, and cannot,
prove the submitter retrieved that text from Snapshot rather than composing it.
That limit is stated rather than implied.

### Refusals are not counted

There is deliberately no rejected-hash counter. A transaction that raises cannot
persist state, so an increment would be rolled back with it and the counter would
read zero forever. Refusals are observable in the reverted transaction's result
string instead, which names both digests.

## Why the original never ran

The deployed contract extended `gl.Contract`. On Studio Next that base class
does not exist — it is `gl.contract.Contract` — and the star-import form of
`genlayer` is rejected too. Both requirements are 2.x-only:

```python
import genlayer as gl
from genlayer import u256
from genlayer.storage import TreeMap
from genlayer.storage import allow as allow_storage

class ProposalPreCheck(gl.contract.Contract):
```

The contract mounted and tested cleanly under the 1.x runner gltest uses
locally while being unloadable on-chain, which is why this went unnoticed. A
contract can pass every local test and still not deploy.

## Deploy

Contract: `0x51FaC52B4C9ebEeaDcBbd45c9142117E69e17204`
Network: GenLayer Studio **dev** (chain `61997`)

```bash
export DEPLOY_PK=0x...
node deploy-61997.mjs
```

Requires `genlayer-js` 2.x for the `studioDevnet` chain definition and a
non-zero fee distribution; consensus v0.6 rejects transactions without one.

## Tests

```bash
python3.14 -m pytest tests/ -q      # 54 passing
```

Local tests generate a variant with the pin, base class and import form adjusted
for the 1.x runner, because no published genvm release carries the 2.x one. The
chain source stays canonical and is never duplicated.

The authoritative proof is the live harness, which drives the deployed contract:

```bash
PK=... ON_ADDR=0x51FaC52B4C9ebEeaDcBbd45c9142117E69e17204 node e2e-milestone-v3.mjs
```

It reads each leader's `consensus_data.execution_result` — a transaction status of
5 comes back even when a method raised, so the status alone proves nothing — and
polls for state commit rather than racing it.

## Repo

- Contract: `contracts/proposal_precheck_v3.py`
- Backend: `server.js` (Express, Studio Next, fee-aware)
- Frontend: `static/index.html`
