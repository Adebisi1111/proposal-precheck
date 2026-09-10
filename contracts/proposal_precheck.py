# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from genlayer import *


@allow_storage
@dataclass
class ProposalCheck:
    id: str
    title: str
    description: str
    proposer: str
    timestamp: u256
    verdict: str
    reasoning: str
    confidence: u256
    checked: bool


class ProposalPreCheck(gl.Contract):
    checks: TreeMap[str, ProposalCheck]
    check_counter: u256

    def __init__(self):
        pass

    def _now(self) -> int:
        return int(datetime.now(timezone.utc).timestamp())

    @gl.public.write
    def check_proposal(self, proposal_id: str, title: str, description: str) -> str:
        """Check a proposal using AI consensus."""
        if not proposal_id or not title or not description:
            raise gl.vm.UserError("proposal_id, title, and description required")
        if self.checks.get(proposal_id, None) is not None:
            raise gl.vm.UserError(f"Proposal {proposal_id} already checked")

        def get_analysis() -> dict:
            prompt = (
                f"Proposal Title: '{title}'\n"
                f"Proposal Description: '{description}'\n\n"
                f"Task: Evaluate this DAO proposal for:\n"
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
            if verdict not in ("PASS", "FAIL", "REVIEW"):
                verdict = "REVIEW"
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
            result = {"verdict": "REVIEW", "confidence": 0, "reasoning": "Consensus failed"}

        self.checks[proposal_id] = ProposalCheck(
            id=proposal_id,
            title=title,
            description=description,
            proposer=str(gl.message.sender_address),
            timestamp=u256(self._now()),
            verdict=result["verdict"],
            reasoning=result["reasoning"],
            confidence=u256(result["confidence"]),
            checked=True
        )
        self.check_counter += u256(1)
        return result["verdict"]

    @gl.public.view
    def get_check(self, proposal_id: str) -> str:
        """Get proposal check result."""
        check = self.checks.get(proposal_id, None)
        if check is None:
            return json.dumps({"proposal_id": proposal_id, "exists": False})
        return json.dumps({
            "proposal_id": check.id,
            "exists": True,
            "title": check.title,
            "description": check.description,
            "proposer": check.proposer,
            "timestamp": int(check.timestamp),
            "verdict": check.verdict,
            "reasoning": check.reasoning,
            "confidence": int(check.confidence),
            "checked": check.checked
        })

    @gl.public.view
    def get_checks_count(self) -> str:
        return str(len(self.checks))

    @gl.public.view
    def now(self) -> str:
        return str(self._now())
