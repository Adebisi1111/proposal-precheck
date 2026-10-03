# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

# Proposal Pre-Check — MILESTONE 1
#
# The original accepted proposal_id/title/description from the CALLER and asked
# an AI whether it looked sound. That made the verdict only as trustworthy as
# the text it was handed: anyone could launder a proposal through a sanitised
# paraphrase and collect a clean PASS. The verdict was verifiable; the INPUT
# was self-asserted.
#
# What this changes:
#   1. The proposal body is FETCHED from the canonical DAO source over
#      gl.nondet.web.render. The caller supplies only an id.
#   2. The verdict binds to a hash of the exact fetched bytes, so a reviewer
#      can prove precisely what text was judged.
#   3. A fetch failure REFUSES the check. There is no fallback to caller text —
#      that fallback is the flaw being removed.
#   4. Per-space listing so a DAO's proposals can be enumerated on-chain.
#   5. Aggregated per-space statistics.
#
# Deliberate design note: item 3 is the security property. A pre-check that
# silently degrades to trusting the caller is worse than one that refuses,
# because the caller cannot tell the difference.

import hashlib
import json
from urllib.parse import quote as _urlquote
from dataclasses import dataclass
from datetime import datetime, timezone
from genlayer import *

SNAPSHOT_GRAPHQL = "https://hub.snapshot.org/graphql"

# A body shorter than this is not a real proposal; refuse rather than judge it.
MIN_BODY_LEN = 80

PASS = "PASS"
FAIL = "FAIL"
REVIEW = "REVIEW"
VALID_VERDICTS = (PASS, FAIL, REVIEW)


def _ids(blob: str) -> list:
    """Split the newline-joined space index back into a list."""
    return [x for x in blob.split("\n") if x]


@allow_storage
@dataclass
class ProposalCheck:
    proposal_id: str
    space: str
    title: str
    body_hash: str
    body_len: u256
    body_excerpt: str
    proposer: str
    timestamp: u256
    verdict: str
    reasoning: str
    confidence: u256
    source_fetched: bool


class ProposalPreCheck(gl.Contract):
    checks: TreeMap[str, ProposalCheck]
    # space -> proposal ids, so listing does not require scanning every check
    by_space: TreeMap[str, str]
    check_counter: u256
    version: str

    def __init__(self):
        pass

    def _now(self) -> int:
        return int(datetime.now(timezone.utc).timestamp())

    def _hash_body(self, body: str) -> str:
        """Content hash of the fetched body.

        A weak rolling accumulator is NOT adequate here: the hash is what binds
        a verdict to specific text, so an adversary must not be able to find a
        paraphrase collision. This is a real SHA-256 over the UTF-8 bytes.
        """
        return hashlib.sha256(body.encode("utf-8")).hexdigest()

    def _refuse(self, reason: str) -> dict:
        return {"ok": False, "title": "", "body": "", "space": "",
                "proposer": "", "error": reason}

    def _fetch_proposal(self, proposal_id: str) -> dict:
        """Pull the canonical proposal text from Snapshot.

        Returns {ok, title, body, space, proposer, error}.
        There is NO fallback path to caller-supplied text.
        """
        query = (
            "query { proposal(id: " + json.dumps(proposal_id) + ") { "
            "id title body state author space { id } } }"
        )
        # GraphQL over GET: web.render takes (url, mode), so the query travels
        # as a URL parameter rather than a POST body.
        url = SNAPSHOT_GRAPHQL + "?query=" + _urlquote(query)

        try:
            raw = gl.nondet.web.render(url, mode="text")
        except Exception:
            return self._refuse("source unreachable")

        if not raw:
            return self._refuse("source returned empty response")

        try:
            doc = json.loads(raw)
        except Exception:
            return self._refuse("source response was not JSON")

        if not doc or doc.get("errors"):
            return self._refuse("proposal not found at source")

        p = doc.get("data", {}).get("proposal")
        if not p or not p.get("body"):
            return self._refuse("proposal has no body at source")

        body = str(p.get("body") or "")
        if len(body) < MIN_BODY_LEN:
            return self._refuse("proposal body too short to assess")

        return {
            "ok": True,
            "title": str(p.get("title") or ""),
            "body": body,
            "space": str((p.get("space") or {}).get("id") or ""),
            "proposer": str(p.get("author") or ""),
            "error": "",
        }

    @gl.public.write
    def check_proposal(self, proposal_id: str) -> str:
        """Fetch a DAO proposal from its canonical source and assess it.

        The caller supplies ONLY the id. Title and body come from the source,
        so a proposer cannot pass off a paraphrase for the real proposal.
        """
        if not proposal_id or not proposal_id.strip():
            raise gl.vm.UserError("proposal_id is required")
        if self.checks.get(proposal_id, None) is not None:
            raise gl.vm.UserError(f"Proposal {proposal_id} already checked")

        fetched = self._fetch_proposal(proposal_id.strip())
        if not fetched["ok"]:
            # REFUSE. Never fall back to caller-supplied text.
            raise gl.vm.UserError(
                f"Cannot verify proposal at source: {fetched['error']}"
            )

        title = fetched["title"]
        body = fetched["body"]
        body_hash = self._hash_body(body)
        space = fetched["space"]

        def get_analysis() -> dict:
            prompt = (
                f"You are reviewing a live DAO governance proposal.\n\n"
                f"Proposal Title: '{title}'\n"
                f"DAO space: '{space}'\n\n"
                f"PROPOSAL BODY (verbatim from the governance source):\n"
                f"---\n{body[:4000]}\n---\n\n"
                f"Evaluate this proposal for:\n"
                f"1. Clarity and completeness\n"
                f"2. Feasibility\n"
                f"3. Potential risks or red flags\n"
                f"4. Alignment with typical DAO governance best practices\n\n"
                f"Respond as JSON: {{\"verdict\": \"PASS\"|\"FAIL\"|\"REVIEW\", "
                f"\"reasoning\": \"detailed explanation\", "
                f"\"confidence\": 0-100}}"
            )
            res = gl.nondet.exec_prompt(prompt, response_format="json")
            verdict = (res.get("verdict") or "").strip().upper()
            if verdict not in VALID_VERDICTS:
                verdict = REVIEW
            confidence = min(max(int(res.get("confidence") or 50), 0), 100)
            reasoning = res.get("reasoning", "")
            return {"verdict": verdict, "confidence": confidence, "reasoning": reasoning}

        principle = (
            "The verdicts must agree on whether the proposal is ready for voting. "
            "Validators must independently assess the proposal and reach the same conclusion. "
            "Confidence scores should be within 20 points."
        )

        try:
            result = gl.eq_principle.prompt_comparative(get_analysis, principle)
        except gl.vm.UserError:
            result = {"verdict": REVIEW, "confidence": 0, "reasoning": "Consensus failed"}

        self.checks[proposal_id] = ProposalCheck(
            proposal_id=proposal_id,
            space=space,
            title=title,
            body_hash=body_hash,
            body_len=u256(len(body)),
            body_excerpt=body[:600],
            proposer=fetched["proposer"],
            timestamp=u256(self._now()),
            verdict=result["verdict"],
            reasoning=result["reasoning"],
            confidence=u256(result["confidence"]),
            source_fetched=True,
        )

        # newline-joined ids: TreeMap[str, DynArray[str]] is awkward to
        # instantiate portably, and a plain string keeps storage simple.
        existing = self.by_space.get(space, "")
        self.by_space[space] = (existing + "\n" + proposal_id) if existing else proposal_id

        self.check_counter += u256(1)
        return result["verdict"]

    @gl.public.view
    def get_check(self, proposal_id: str) -> str:
        check = self.checks.get(proposal_id, None)
        if check is None:
            return json.dumps({"proposal_id": proposal_id, "exists": False})
        return json.dumps({
            "proposal_id": check.proposal_id,
            "exists": True,
            "space": check.space,
            "title": check.title,
            "body_hash": check.body_hash,
            "body_len": int(check.body_len),
            "body_excerpt": check.body_excerpt,
            "proposer": check.proposer,
            "timestamp": int(check.timestamp),
            "verdict": check.verdict,
            "reasoning": check.reasoning,
            "confidence": int(check.confidence),
            "source_fetched": bool(check.source_fetched),
        })

    @gl.public.view
    def get_body_hash(self, proposal_id: str) -> str:
        """The exact content the verdict was bound to."""
        check = self.checks.get(proposal_id, None)
        if check is None:
            return json.dumps({"proposal_id": proposal_id, "exists": False})
        return json.dumps({
            "proposal_id": check.proposal_id,
            "body_hash": check.body_hash,
            "body_len": int(check.body_len),
            "source_fetched": bool(check.source_fetched),
        })

    @gl.public.view
    def list_space(self, space: str) -> str:
        return json.dumps({"space": space, "proposals": _ids(self.by_space.get(space, ""))})

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
        return json.dumps({
            "space": space,
            "total": total,
            "pass": passed,
            "fail": failed,
            "review": review,
            "avg_confidence": (conf_sum // total) if total > 0 else 0,
        })

    @gl.public.view
    def get_checks_count(self) -> str:
        return str(len(self.checks))

    @gl.public.view
    def contract_version(self) -> str:
        return "milestone-1: source-fetched, hash-bound, refuse-on-failure"