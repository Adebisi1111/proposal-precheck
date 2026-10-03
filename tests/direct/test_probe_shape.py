"""Does the probe contract load at all?

`invalid_contract runner malformed` on 61997 is a structural rejection. Check it
locally and for free: gltest's direct_deploy compiles and mounts the contract,
so a malformed contract fails here without spending a wei.
"""
import pytest


def test_web_probe_contract_mounts(direct_vm, direct_deploy):
    c = direct_deploy("contracts/_web_probe.py")
    assert c is not None


def test_milestone_contract_mounts(direct_vm, direct_deploy):
    c = direct_deploy("contracts/proposal_precheck_v3.py")
    assert c is not None
