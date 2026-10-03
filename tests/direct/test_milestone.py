"""Adversarial tests for the Proposal Pre-Check milestone.

The security property under test: a verdict must only ever be produced from
proposal text the CONTRACT fetched. If any path lets caller-supplied text
through, a proposer can launder a real proposal through a sanitised paraphrase
and collect a clean PASS.
"""

import inspect
import json

import pytest

GOOD = {
    "data": {"proposal": {
        "id": "0xabc",
        "title": "Fund the security audit retainer",
        "body": (
            "This proposal allocates 250,000 USDC from the community treasury "
            "to a third-party security firm to perform quarterly smart-contract "
            "audits of the core lending protocol. Scope, deliverables, payment "
            "milestones, and the selection process are specified in full."
        ),
        "state": "active",
        "author": "0xauthor",
        "space": {"id": "gooddao.eth"},
    }}
}

TINY = {
    "data": {"proposal": {
        "id": "0xabc", "title": "t", "body": "do a thing",
        "state": "active", "author": "0xa", "space": {"id": "s.eth"},
    }}
}


HUB = r"hub\.snapshot\.org/graphql"


def _mock(vm, payload, status=200):
    vm.mock_web(HUB, {"method": "GET", "status": status,
                       "body": json.dumps(payload)})


def _mock_raw(vm, body, status=200):
    vm.mock_web(HUB, {"method": "GET", "status": status, "body": body})


@pytest.fixture
def contract(direct_deploy):
    return direct_deploy("contracts/proposal_precheck_v2.py")


@pytest.fixture
def llm(direct_vm):
    """Answer the assessment prompt deterministically."""
    direct_vm.mock_llm(
        r"You are reviewing a live DAO governance proposal",
        json.dumps({
            "verdict": "PASS",
            "confidence": 88,
            "reasoning": "Scope and payment milestones are clearly specified.",
        }),
    )
    return direct_vm


# --------------------------------------------------------------------------
# The core property: the verdict is bound to fetched text, not caller text
# --------------------------------------------------------------------------

def test_caller_cannot_supply_the_body(direct_vm, contract):
    """A single-argument signature means there is nowhere to pass text in."""
    params = list(inspect.signature(contract.check_proposal).parameters)
    assert params == ["proposal_id"], params


def test_fetched_title_and_body_win_over_caller_claims(direct_vm, contract, llm):
    _mock(direct_vm, GOOD)
    direct_vm.sender = "0xproposer"
    contract.check_proposal("0xabc")

    rec = json.loads(contract.get_check("0xabc"))
    assert rec["exists"], rec
    # title came from the source, not the caller
    assert rec["title"] == "Fund the security audit retainer", rec["title"]
    assert rec["space"] == "gooddao.eth", rec["space"]
    assert rec["proposer"] == "0xauthor", rec["proposer"]
    assert rec["source_fetched"] is True, rec


def test_verdict_binds_to_a_hash_of_the_fetched_bytes(direct_vm, contract, llm):
    _mock(direct_vm, GOOD)
    contract.check_proposal("0xabc")
    rec = json.loads(contract.get_check("0xabc"))
    assert rec["body_hash"], rec
    assert rec["body_len"] > 80, rec
    # the hash is exposed on its own so a reviewer can verify what was judged
    h = json.loads(contract.get_body_hash("0xabc"))
    assert h["body_hash"] == rec["body_hash"], h
    assert h["source_fetched"] is True, h


def test_same_text_yields_the_same_hash(direct_vm, contract, llm):
    _mock(direct_vm, GOOD)
    contract.check_proposal("0xabc")
    first = json.loads(contract.get_body_hash("0xabc"))["body_hash"]
    assert first == contract._hash_body(GOOD["data"]["proposal"]["body"])


def test_hash_is_real_sha256_not_a_weak_accumulator(direct_vm, contract, llm):
    """A known-answer test, so a rolling accumulator cannot pass silently.

    Determinism and difference tests BOTH hold for `acc*31 % 1e9+7`, so on their
    own they prove nothing about hash strength. The hash is what binds a verdict
    to specific text, so it has to be a real cryptographic digest.
    """
    import hashlib as _hl

    body = GOOD["data"]["proposal"]["body"]
    expected = _hl.sha256(body.encode("utf-8")).hexdigest()
    got = contract._hash_body(body)

    assert got == expected, f"not SHA-256: got {got}, expected {expected}"
    # A SHA-256 digest is 64 hex chars; a rolling accumulator is short.
    assert len(got) == 64, got


def test_different_text_yields_a_different_hash(direct_vm, contract, llm):
    _mock(direct_vm, GOOD)
    contract.check_proposal("0xabc")
    first = json.loads(contract.get_body_hash("0xabc"))["body_hash"]
    other = GOOD["data"]["proposal"]["body"] + " Additional clause."
    assert contract._hash_body(other) != first


# --------------------------------------------------------------------------
# Refuse on failure - the fallback is the flaw, so it must not exist
# --------------------------------------------------------------------------

@pytest.mark.parametrize("payload", [
    {"errors": [{"message": "not found"}]},
    {"data": {"proposal": None}},
    {"data": {"proposal": {"id": "0xabc", "body": None}}},
])
def test_refuses_when_source_has_no_usable_proposal(direct_vm, contract, payload):
    _mock(direct_vm, payload)
    with pytest.raises(Exception) as ei:
        contract.check_proposal("0xabc")
    assert "Cannot verify proposal at source" in str(ei.value), ei.value
    assert json.loads(contract.get_check("0xabc"))["exists"] is False


def test_refuses_when_body_is_too_short(direct_vm, contract):
    _mock(direct_vm, TINY)
    with pytest.raises(Exception) as ei:
        contract.check_proposal("0xabc")
    assert "too short" in str(ei.value), ei.value


def test_refuses_when_source_returns_non_json(direct_vm, contract):
    _mock_raw(direct_vm, "<html>503 upstream</html>")
    with pytest.raises(Exception) as ei:
        contract.check_proposal("0xabc")
    assert "not JSON" in str(ei.value), ei.value


def test_refuses_when_source_is_empty(direct_vm, contract):
    _mock_raw(direct_vm, "")
    with pytest.raises(Exception) as ei:
        contract.check_proposal("0xabc")
    assert "empty response" in str(ei.value), ei.value


def test_refuses_when_source_is_unreachable(direct_vm, contract):
    # no mock registered at all -> the fetch raises
    with pytest.raises(Exception) as ei:
        contract.check_proposal("0xabc")
    assert "Cannot verify proposal at source" in str(ei.value), ei.value


def test_no_fallback_to_caller_text_on_failure(direct_vm, contract):
    """The single most important test: failure must not silently succeed."""
    _mock_raw(direct_vm, "garbage")
    with pytest.raises(Exception):
        contract.check_proposal("0xabc")
    # nothing stored, so nothing to trust later
    assert contract.get_checks_count() == "0"


# --------------------------------------------------------------------------
# Input validation and duplicate handling
# --------------------------------------------------------------------------

@pytest.mark.parametrize("bad", ["", "   "])
def test_rejects_blank_proposal_id(direct_vm, contract, bad):
    _mock(direct_vm, GOOD)
    with pytest.raises(Exception) as ei:
        contract.check_proposal(bad)
    assert "proposal_id is required" in str(ei.value), ei.value


def test_rejects_duplicate_check(direct_vm, contract, llm):
    _mock(direct_vm, GOOD)
    contract.check_proposal("0xabc")
    with pytest.raises(Exception) as ei:
        contract.check_proposal("0xabc")
    assert "already checked" in str(ei.value), ei.value
    assert contract.get_checks_count() == "1"


# --------------------------------------------------------------------------
# Per-space listing and stats - new functionality
# --------------------------------------------------------------------------

def test_space_listing_and_stats(direct_vm, contract, llm):
    _mock(direct_vm, GOOD)
    contract.check_proposal("0xabc")
    listing = json.loads(contract.list_space("gooddao.eth"))
    assert listing["proposals"] == ["0xabc"], listing

    stats = json.loads(contract.get_space_stats("gooddao.eth"))
    assert stats["total"] == 1, stats
    assert stats["pass"] + stats["fail"] + stats["review"] == 1, stats
    assert 0 <= stats["avg_confidence"] <= 100, stats


def test_empty_space_reports_zero_not_an_error(direct_vm, contract):
    assert json.loads(contract.list_space("nothing.eth"))["proposals"] == []
    s = json.loads(contract.get_space_stats("nothing.eth"))
    assert s["total"] == 0 and s["avg_confidence"] == 0, s


def test_unknown_proposal_reads_as_absent(direct_vm, contract):
    assert json.loads(contract.get_check("0xnope"))["exists"] is False
    assert json.loads(contract.get_body_hash("0xnope"))["exists"] is False


def test_version_identifies_the_milestone(direct_vm, contract):
    assert "milestone-1" in contract.contract_version()