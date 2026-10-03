"""Shared helpers for Proposal Pre-Check direct-mode tests."""


def to_hex(addr) -> str:
    """Return hex for an address-like value."""
    if hasattr(addr, "as_hex"):
        return addr.as_hex
    if isinstance(addr, bytes):
        try:
            from genlayer.py.types import Address
            return str(Address(addr))
        except Exception:
            return "0x" + addr.hex()
    s = str(addr)
    if s.startswith("0x") or s.startswith("0X"):
        return s
    return "0x" + s


import re
from pathlib import Path

import pytest

CONTRACT = Path(__file__).resolve().parents[2] / "contracts" / "proposal_precheck_v3.py"
LOCAL_COPY = CONTRACT.parent / "_local_pin_proposal_precheck.py"
LOCAL_PIN = "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6"


@pytest.fixture(scope="session", autouse=True)
def _local_pin_copy():
    src = CONTRACT.read_text()
    LOCAL_COPY.write_text(re.sub(r"py-genlayer:[a-z0-9]+", LOCAL_PIN, src, count=1))
    yield
    LOCAL_COPY.unlink(missing_ok=True)
