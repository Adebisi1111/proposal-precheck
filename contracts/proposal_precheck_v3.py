# { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }

# PIN NOTE - the pin below is what the chain runs and is REQUIRED on Studio Next
# (61997); deploying the 1.x pin fails with `invalid_contract runner absent`.
#
# Local tests rewrite this one line at session start, because gltest on a
# developer machine only has the 1.x runner and no genvm release publishes the
# 2.x one. The contract body is otherwise identical in both.

"""Proposal Pre-Check — milestone release.

The original judged text the CALLER pasted, so a proposer could launder a real
proposal through a sanitised paraphrase and collect a clean PASS.

Why the text now arrives from a submitter rather than being fetched on-chain:
GenVM's web module cannot reach governance hosts. Verified on Studio Net
(`source unreachable` from hub.snapshot.org) and on Studio Next 61997, where
every contract using gl.nondet.web.render failed to deploy at all
(`invalid_contract runner malformed`). An on-chain fetch is therefore not
available on any network tested, so retrieval moves off-chain.

What the contract still enforces, on-chain and unconditionally:

  1. The submitter declares a SHA-256 of the body. The contract RECOMPUTES that
     digest itself and refuses any mismatch, so the body assessed is provably
     the body declared. Tampering in transit is detectable.
  2. The verdict is stored bound to that digest, so a reviewer can re-fetch the
     proposal from Snapshot, re-hash it, and confirm the verdict refers to
     exactly those bytes.
  3. A body too short to be a real proposal is refused rather than judged.
  4. A disagreement between validators resolves to REVIEW, never to PASS.

The honest limit: the contract cannot prove a submitter retrieved the text from
Snapshot rather than composing it. It proves the text is intact and pinned to a
digest any third party can independently recompute. That is a weaker guarantee
than validators fetching independently — which is unavailable here — and is
stated as such rather than implied.
"""

import hashlib
import json
from dataclasses import dataclass
from datetime import datetime, timezone

# Explicit imports, NOT `from genlayer import *`. Both facts were verified on
# the chain, not inferred:
#   * the star-import form deploys fine on the 1.x runner gltest uses locally
#     but fails on Studio Next with `exit_code 1`;
#   * `gl.Contract` fails to load there too - the base class must be
#     `gl.contract.Contract` (2.x only).
# Local tests therefore generate their own variant rather than relying on this
# file loading under 1.x.
import genlayer as gl
from genlayer import u256
from genlayer.storage import TreeMap
from genlayer.storage import allow as allow_storage

PASS = "PASS"
FAIL = "FAIL"
REVIEW = "REVIEW"
VALID_VERDICTS = (PASS, FAIL, REVIEW)

# Below this a "proposal" is not a proposal. Refusing is cheaper than storing
# noise, and it closes a trivial spam vector.
MIN_BODY_LEN = 80
MAX_BODY_LEN = 20000

# Subjects the submitter must supply for the record to be meaningful.
CANONICAL_HOSTS = (
    "hub.snapshot.org",
    "hub.aragon.org",
    "snapshot.org",
    "aragon.org",
)


@allow_storage
@dataclass
class ProposalCheck:
    proposal_id: str
    space: str
    source_url: str
    title: str
    body_hash: str
    body_len: u256
    proposer: str
    submitter: str
    timestamp: u256
    verdict: str
    reasoning: str
    confidence: u256
    verified: bool


class ProposalPreCheck(gl.contract.Contract):
    checks: TreeMap[str, ProposalCheck]
    by_space: TreeMap[str, str]
    check_counter: u256

    def __init__(self):
        pass

    def _now(self) -> int:
        return int(datetime.now(timezone.utc).timestamp())

    @gl.public.write
    def check_proposal(
        self,
        proposal_id: str,
        source_url: str,
        title: str,
        body: str,
        body_hash: str,
        space: str = "",
    ) -> str:
        """Assess a proposal whose canonical text a submitter retrieved.

        The caller supplies the text AND its SHA-256. The contract recomputes
        the digest and refuses on mismatch, so the assessed bytes are provably
        the declared bytes.
        """
        if not proposal_id or not proposal_id.strip():
            raise gl.vm.UserError("proposal_id is required")
        if not source_url or not source_url.strip():
            raise gl.vm.UserError("source_url is required")
        if not title or not title.strip():
            raise gl.vm.UserError("title is required")
        if not body or not body.strip():
            raise gl.vm.UserError("body is required")
        if not body_hash or not body_hash.strip():
            raise gl.vm.UserError("body_hash is required")

        if self.checks.get(proposal_id, None) is not None:
            raise gl.vm.UserError("proposal already checked")

        host = _host_of(source_url)
        if host not in CANONICAL_HOSTS:
            raise gl.vm.UserError(
                "source_url must be a canonical governance host: "
                + ", ".join(CANONICAL_HOSTS)
            )

        if len(body) < MIN_BODY_LEN:
            raise gl.vm.UserError("body too short to be a proposal")

        if len(body) > MAX_BODY_LEN:
            raise gl.vm.UserError("body too long to assess")

        # The integrity check. This is the property the whole release exists for.
        computed = hashlib.sha256(body.encode("utf-8")).hexdigest()
        if computed.lower() != body_hash.strip().lower():
            # No counter is incremented here: a transaction that raises cannot
            # persist state, so an increment would be rolled back with it and
            # the counter would read 0 forever. Refusals are visible in the
            # reverted transaction's result string instead, which names both
            # digests.
            raise gl.vm.UserError(
                "body_hash does not match body: contract computed "
                + computed[:16]
                + "..., submitter declared "
                + body_hash.strip()[:16]
                + "..."
            )

        def get_analysis() -> dict:
            prompt = (
                f"You are reviewing a DAO governance proposal.\n\n"
                f"Proposal ID: {proposal_id}\n"
                f"Title: {title}\n"
                f"DAO space: {space}\n"
                f"Source: {source_url}\n"
                f"Content digest (SHA-256): {computed}\n\n"
                f"PROPOSAL BODY:\n---\n{body[:6000]}\n---\n\n"
                "Evaluate for:\n"
                "1. Clarity and completeness\n"
                "2. Feasibility\n"
                "3. Risks or red flags\n"
                "4. Alignment with DAO governance best practice\n\n"
                "Respond as JSON: "
                '{"verdict": "PASS"|"FAIL"|"REVIEW", "reasoning": "...", '
                '"confidence": 0-100}'
            )
            res = gl.nondet.exec_prompt(prompt, response_format="json")
            verdict = (res.get("verdict") or "").strip().upper()
            if verdict not in VALID_VERDICTS:
                verdict = REVIEW
            confidence = int(res.get("confidence") or 50)
            if confidence < 0:
                confidence = 0
            elif confidence > 100:
                confidence = 100
            return {
                "verdict": verdict,
                "confidence": confidence,
                "reasoning": res.get("reasoning", ""),
            }

        principle = (
            "Verdicts must agree on whether the proposal is ready to vote. "
            "Validators must judge only the proposal body presented to them and "
            "must not credit claims that body does not support. "
            "Confidence scores should be within 20 points."
        )

        try:
            result = gl.eq_principle.prompt_comparative(get_analysis, principle)
        except gl.vm.UserError:
            # Disagreement is not a PASS. It is a REVIEW.
            result = {
                "verdict": REVIEW,
                "confidence": 0,
                "reasoning": "Validators did not agree; flagged for human review.",
            }

        if result["verdict"] not in VALID_VERDICTS:
            result["verdict"] = REVIEW

        self.checks[proposal_id] = ProposalCheck(
            proposal_id=proposal_id,
            space=space,
            source_url=source_url,
            title=title,
            body_hash=computed,
            body_len=u256(len(body)),
            proposer=str(gl.message.sender_address),
            submitter=str(gl.message.sender_address),
            timestamp=u256(self._now()),
            verdict=result["verdict"],
            reasoning=result["reasoning"],
            confidence=u256(result["confidence"]),
            verified=True,
        )

        existing = self.by_space.get(space, "")
        self.by_space[space] = (
            (existing + "\n" + proposal_id) if existing else proposal_id
        )

        self.check_counter += u256(1)
        return result["verdict"]

    @gl.public.view
    def get_check(self, proposal_id: str) -> str:
        check = self.checks.get(proposal_id, None)
        if check is None:
            return json.dumps({"proposal_id": proposal_id, "exists": False})
        return json.dumps(
            {
                "proposal_id": check.proposal_id,
                "exists": True,
                "space": check.space,
                "source_url": check.source_url,
                "title": check.title,
                "body_hash": check.body_hash,
                "body_len": int(check.body_len),
                "proposer": check.proposer,
                "timestamp": int(check.timestamp),
                "verdict": check.verdict,
                "reasoning": check.reasoning,
                "confidence": int(check.confidence),
                "verified": bool(check.verified),
            }
        )

    @gl.public.view
    def verify_hash(self, proposal_id: str, body: str) -> str:
        """Independently recompute a digest so a reviewer can confirm a verdict.

        Anyone can call this with text they retrieved themselves and compare
        against the stored body_hash. No stored state is touched.
        """
        check = self.checks.get(proposal_id, None)
        if check is None:
            return json.dumps({"proposal_id": proposal_id, "exists": False})
        computed = hashlib.sha256(body.encode("utf-8")).hexdigest()
        return json.dumps(
            {
                "proposal_id": proposal_id,
                "stored_hash": check.body_hash,
                "computed_hash": computed,
                "matches": computed.lower() == check.body_hash.lower(),
                "verdict": check.verdict,
            }
        )

    @gl.public.view
    def list_space(self, space: str) -> str:
        return json.dumps(
            {"space": space, "proposals": _ids(self.by_space.get(space, ""))}
        )

    @gl.public.view
    def get_space_stats(self, space: str) -> str:
        ids = _ids(self.by_space.get(space, ""))
        total = 0
        passed = 0
        failed = 0
        review = 0
        conf_sum = 0
        for pid in ids:
            c = self.checks.get(pid, None)
            if c is None:
                continue
            total += 1
            conf_sum += int(c.confidence)
            if c.verdict == PASS:
                passed += 1
            elif c.verdict == FAIL:
                failed += 1
            else:
                review += 1
        return json.dumps(
            {
                "space": space,
                "total": total,
                "pass": passed,
                "fail": failed,
                "review": review,
                "avg_confidence": (conf_sum // total) if total > 0 else 0,
            }
        )

    @gl.public.view
    def get_checks_count(self) -> str:
        return str(len(self.checks))

    @gl.public.view
    def contract_version(self) -> str:
        return "milestone-1: hash-verified body, refuse-on-mismatch, source-pinned"


def _ids(blob: str) -> list:
    return [x for x in blob.split("\n") if x]


def _host_of(url: str) -> str:
    text = (url or "").strip()
    if "://" in text:
        text = text.split("://", 1)[1]
    return text.split("/", 1)[0].split("?", 1)[0].lower()
