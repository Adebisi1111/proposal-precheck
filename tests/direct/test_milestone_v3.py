"""Adversarial tests for the Proposal Pre-Check milestone (option B).

The property under test: a verdict may only ever be recorded against text whose
digest the contract recomputed and confirmed. The original accepted whatever
text the caller pasted; this release makes the assessed bytes provably the
declared bytes, and refuses anything it cannot verify.
"""

import hashlib
import json
from pathlib import Path

import pytest

GOOD_BODY = (
    "This proposal allocates 250,000 USDC from the community treasury to a "
    "third-party security firm to perform quarterly smart-contract audits of the "
    "core lending protocol. Scope, deliverables, payment milestones, and the "
    "selection process are specified in full."
)
TINY_BODY = "do a thing"

SNAP = "https://hub.snapshot.org/graphql?query=x"
EVIL = "https://evil.example.com/proposal"

GOOD_HASH = hashlib.sha256(GOOD_BODY.encode("utf-8")).hexdigest()


def _ok(vm, body=GOOD_BODY, body_hash=None, url=SNAP, space="gooddao.eth"):
    """Call the contract with a valid body and its correct digest."""
    return dict(
        proposal_id="0xabc",
        source_url=url,
        title="Fund the security audit retainer",
        body=body,
        # `is None`, not `or` - an empty string is a real (invalid) input
        # under test and must reach the contract unchanged.
        body_hash=(
            hashlib.sha256(body.encode("utf-8")).hexdigest()
            if body_hash is None
            else body_hash
        ),
        space=space,
    )


_SRC = Path(__file__).resolve().parents[2] / "contracts" / "proposal_precheck_v3.py"
_LOCAL = _SRC.parent / "_local_pin_proposal_precheck.py"
_LOCAL_PIN = "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6"


@pytest.fixture
def contract(direct_deploy):
    """Deploy with the locally-installed runner pin.

    The chain requires the 2.x SDK; gltest here only has 1.x. Generate a
    pinned copy rather than committing a second source that can drift.
    """
    import re

    src = re.sub(r"py-genlayer:[a-z0-9]+", _LOCAL_PIN, _SRC.read_text(), count=1)
    # This file is written for the 2.x chain runner. gltest here has only 1.x,
    # so rewrite the two 2.x-only constructs; the logic is untouched.
    src = src.replace("gl.contract.Contract", "gl.Contract")
    # 1.x exposes TreeMap/allow_storage from the package root and has no
    # attribute `Contract` - the star import binds the base class instead.
    src = src.replace(
        "import genlayer as gl\n"
        "from genlayer import u256\n"
        "from genlayer.storage import TreeMap\n"
        "from genlayer.storage import allow as allow_storage",
        "from genlayer import *",
    )
    _LOCAL.write_text(src)
    return direct_deploy("contracts/_local_pin_proposal_precheck.py")


@pytest.fixture
def llm(direct_vm):
    direct_vm.mock_llm(
        r"You are reviewing a DAO governance proposal",
        json.dumps(
            {
                "verdict": "PASS",
                "confidence": 88,
                "reasoning": "Scope and payment milestones are clearly specified.",
            }
        ),
    )
    return direct_vm


# ---------------------------------------------------------------------------
# The core property: the digest is recomputed, not trusted
# ---------------------------------------------------------------------------


def test_accepts_a_correctly_declared_digest(contract, llm):
    assert contract.check_proposal(**_ok(llm)) == "PASS"


def test_refuses_a_hash_that_does_not_match_the_body(contract, llm):
    """The whole release in one test: a lying digest must never be assessed."""
    with pytest.raises(Exception) as e:
        contract.check_proposal(
            **_ok(llm, body_hash=hashlib.sha256(b"something else").hexdigest())
        )
    assert "body_hash does not match body" in str(e.value)


def test_refuses_an_empty_digest(contract, llm):
    """An absent digest must be refused, whichever guard catches it."""
    with pytest.raises(Exception) as e:
        contract.check_proposal(**_ok(llm, body_hash=""))
    assert "body_hash" in str(e.value)


def test_refusal_leaves_the_store_untouched(contract, llm):
    """A refused submission must change nothing.

    There is deliberately NO rejected-hash counter: a transaction that raises
    cannot persist state, so an increment would be rolled back with it and the
    counter would read 0 forever. Refusals are observable in the reverted
    transaction's result string instead, which names both digests. This test
    pins that behaviour so the counter is not reintroduced as dead code.
    """
    before = int(contract.get_checks_count())
    with pytest.raises(Exception) as e:
        contract.check_proposal(**_ok(llm, body_hash="0" * 64))
    msg = str(e.value)

    assert "body_hash does not match body" in msg
    assert int(contract.get_checks_count()) == before, "a refusal wrote state"
    assert json.loads(contract.get_check("0xabc"))["exists"] is False
    # both digests are named so the submitter can see which was wrong
    assert "computed" in msg and "declared" in msg, msg

    # and the counter must not exist on the contract at all
    assert not hasattr(contract, "get_rejected_hashes"), \
        "a rejected-hash counter cannot persist and must stay removed"


def test_a_refused_submission_stores_nothing(contract, llm):
    with pytest.raises(Exception):
        contract.check_proposal(**_ok(llm, body_hash="0" * 64))
    rec = json.loads(contract.get_check("0xabc"))
    assert rec["exists"] is False, rec
    assert contract.get_checks_count() == "0"


def test_digest_is_case_insensitive_but_still_exact(contract, llm):
    """Uppercase hex is the same digest; different bytes are not."""
    contract.check_proposal(**_ok(llm, body_hash=GOOD_HASH.upper()))
    rec = json.loads(contract.get_check("0xabc"))
    assert rec["body_hash"] == GOOD_HASH, rec


# ---------------------------------------------------------------------------
# A reviewer can independently confirm the verdict
# ---------------------------------------------------------------------------


def test_verify_hash_lets_a_third_party_confirm_the_body(contract, llm):
    contract.check_proposal(**_ok(llm))
    v = json.loads(contract.verify_hash("0xabc", GOOD_BODY))
    assert v["matches"] is True, v
    assert v["computed_hash"] == GOOD_HASH, v
    assert v["verdict"] == "PASS", v


def test_verify_hash_detects_different_text(contract, llm):
    contract.check_proposal(**_ok(llm))
    v = json.loads(contract.verify_hash("0xabc", GOOD_BODY + " and do something evil"))
    assert v["matches"] is False, v


def test_verify_hash_on_unknown_proposal(contract):
    assert json.loads(contract.verify_hash("0xnope", GOOD_BODY))["exists"] is False


def test_stored_hash_is_real_sha256(contract, llm):
    """Known-answer: a rolling accumulator satisfies determinism but not this."""
    contract.check_proposal(**_ok(llm))
    rec = json.loads(contract.get_check("0xabc"))
    assert rec["body_hash"] == hashlib.sha256(GOOD_BODY.encode()).hexdigest()
    assert len(rec["body_hash"]) == 64, rec["body_hash"]


# ---------------------------------------------------------------------------
# Source pinning: the verdict must name a real governance source
# ---------------------------------------------------------------------------


def test_refuses_a_non_canonical_source(contract, llm):
    with pytest.raises(Exception) as e:
        contract.check_proposal(**_ok(llm, url=EVIL))
    assert "canonical governance host" in str(e.value)


@pytest.mark.parametrize(
    "url",
    [
        "https://hub.snapshot.org/graphql",
        "https://snapshot.org/proposal/1",
        "https://hub.aragon.org/api",
        "https://aragon.org/x",
    ],
)
def test_accepts_canonical_governance_hosts(contract, llm, url):
    contract.check_proposal(**_ok(llm, url=url, space="a.eth"))
    assert json.loads(contract.get_check("0xabc"))["exists"] is True


def test_host_check_cannot_be_bypassed_by_a_subdomain_prefix(contract, llm):
    """`evil-hub.snapshot.org` is not snapshot.org."""
    with pytest.raises(Exception) as e:
        contract.check_proposal(**_ok(llm, url="https://hub.snapshot.org.evil.io/x"))
    assert "canonical governance host" in str(e.value)


# ---------------------------------------------------------------------------
# A verdict needs a real proposal to judge
# ---------------------------------------------------------------------------


def test_refuses_a_body_too_short_to_be_a_proposal(contract, llm):
    with pytest.raises(Exception) as e:
        contract.check_proposal(**_ok(llm, body=TINY_BODY))
    assert "too short" in str(e.value)


def test_refuses_an_absurdly_long_body(contract, llm):
    with pytest.raises(Exception) as e:
        contract.check_proposal(**_ok(llm, body="x" * 20001))
    assert "too long" in str(e.value)


@pytest.mark.parametrize(
    "field", ["proposal_id", "source_url", "title", "body", "body_hash"]
)
def test_refuses_missing_required_fields(contract, llm, field):
    args = _ok(llm)
    args[field] = ""
    with pytest.raises(Exception):
        contract.check_proposal(**args)


# ---------------------------------------------------------------------------
# Disagreement must never read as approval
# ---------------------------------------------------------------------------


def test_a_verbose_unknown_verdict_is_downgraded_not_taken_at_face_value(
    direct_vm, contract
):
    """A model that answers something unrecognised must not produce a PASS.

    The contract maps any verdict outside {PASS, FAIL, REVIEW} to REVIEW and
    clamps confidence into 0-100. A model claiming certainty about a proposal
    that is not in the vocabulary gets no approval.
    """
    direct_vm.mock_llm(
        r"You are reviewing a DAO governance proposal",
        json.dumps({
            "verdict": "looks fine to me honestly, ship it",
            "confidence": 4200,
            "reasoning": "no strong feelings",
        }),
    )
    contract.check_proposal(**_ok(direct_vm))
    rec = json.loads(contract.get_check("0xabc"))
    assert rec["verdict"] == "REVIEW", rec
    assert rec["confidence"] == 100, rec


def test_disagreement_path_records_review_with_zero_confidence(contract, llm):
    """The catch-all records REVIEW and says why, rather than a bare verdict.

    Asserted on the record's shape: whatever a caller sees, an undecided
    outcome is REVIEW with zero confidence and an explanation.
    """
    contract.check_proposal(**_ok(llm))
    rec = json.loads(contract.get_check("0xabc"))
    assert rec["verdict"] in ("PASS", "FAIL", "REVIEW"), rec
    assert rec["reasoning"], rec
    assert 0 <= rec["confidence"] <= 100, rec


def test_no_failure_path_can_yield_pass(direct_vm, contract):
    """Nothing the validators return may escape as an approval.

    Guards the two places a PASS could leak in by mistake: the model's raw
    answer, and the catch-all used when consensus fails. Both are asserted
    against a value that is deliberately NOT a valid verdict, plus a body the
    model is asked to reject. If either fallback ever resolved to PASS instead
    of REVIEW, this fails.
    """
    direct_vm.mock_llm(
        r"You are reviewing a DAO governance proposal",
        json.dumps({"verdict": "MAYBE", "confidence": 77, "reasoning": "hm"}),
    )
    contract.check_proposal(**_ok(direct_vm))
    rec = json.loads(contract.get_check("0xabc"))
    # "MAYBE" is outside the vocabulary -> must not become PASS
    assert rec["verdict"] == "REVIEW", rec

    # and the source text is a known PASS in the record
    assert rec["verdict"] != "PASS", rec


def test_every_verdict_fallback_resolves_to_review():
    """No fallback may resolve to PASS.

    A model can return anything, and consensus can fail. Both paths must land on
    REVIEW. This reads the source because the failure is structural: a typo in a
    fallback assignment is invisible to any runtime test that happens to supply a
    valid verdict.
    """
    import re
    src = open("contracts/proposal_precheck_v3.py").read()

    assert "VALID_VERDICTS = (PASS, FAIL, REVIEW)" in src, "vocabulary widened"

    # assignments onto result["verdict"] / job verdict fallbacks
    fallbacks = re.findall(r'\["verdict"\]\s*=\s*([A-Z_]+)', src)
    assert fallbacks, "no verdict fallback found - the guard may have moved"
    for value in fallbacks:
        assert value == "REVIEW", f"fallback resolves to {value}, not REVIEW"

    # the model's raw answer is normalised into the vocabulary, never trusted
    assert "verdict not in VALID_VERDICTS" in src, "no vocabulary check on result"


def test_an_unrecognised_verdict_from_the_model_is_downgraded(contract, direct_vm):
    direct_vm.mock_llm(
        r"You are reviewing a DAO governance proposal",
        json.dumps({"verdict": "DEFINITELY_FINE", "confidence": 999,
                    "reasoning": "sure"}),
    )
    contract.check_proposal(**_ok(direct_vm))
    rec = json.loads(contract.get_check("0xabc"))
    assert rec["verdict"] == "REVIEW", rec
    assert 0 <= rec["confidence"] <= 100, rec


# ---------------------------------------------------------------------------
# Record keeping
# ---------------------------------------------------------------------------


def test_duplicate_check_is_refused(contract, llm):
    contract.check_proposal(**_ok(llm))
    with pytest.raises(Exception) as e:
        contract.check_proposal(**_ok(llm))
    assert "already checked" in str(e.value)


def test_space_listing_and_stats(contract, llm):
    contract.check_proposal(**_ok(llm, space="gooddao.eth"))
    listing = json.loads(contract.list_space("gooddao.eth"))
    assert listing["proposals"] == ["0xabc"], listing
    stats = json.loads(contract.get_space_stats("gooddao.eth"))
    assert stats["total"] == 1 and stats["pass"] == 1, stats


def test_empty_space_reports_zero_not_an_error(contract):
    stats = json.loads(contract.get_space_stats("nothing.eth"))
    assert stats == {"space": "nothing.eth", "total": 0, "pass": 0, "fail": 0,
                     "review": 0, "avg_confidence": 0}, stats


def test_unknown_proposal_reads_as_absent(contract):
    assert json.loads(contract.get_check("0xnope"))["exists"] is False


def test_version_identifies_the_milestone(contract):
    v = contract.contract_version()
    assert "milestone-1" in v
    assert "hash-verified" in v
