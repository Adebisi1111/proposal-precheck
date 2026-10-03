# { "Depends": "py-genlayer:5jycge4q8k23462jtb0b9fyey1s9qz928sz2nbrd9mg4sxqg2qng" }

"""Control probe: can the 2.x runner on 61997 fetch the web at all?

The earlier claim that web.render contracts "fail to deploy on 61997" was
attributed to the base class, not the web primitive. That was never tested.
This deploys on 61997 and fetches, so the question gets a real answer.
"""

import json

import genlayer as gl
from genlayer import u256


class WebControl(gl.contract.Contract):
    result: str

    def __init__(self):
        pass

    @gl.public.write
    def probe(self, url: str) -> str:
        out = []
        for mode in ("text", "raw"):
            try:
                got = gl.nondet.web.render(url, mode=mode)
                out.append(f"{mode}=REACHED:{len(str(got))}")
            except Exception as e:
                out.append(f"{mode}=ERR:{type(e).__name__}")
        self.result = "|".join(out)
        return self.result

    @gl.public.write
    def probe_get(self, url: str) -> str:
        try:
            got = gl.nondet.web.get(url, key="")
            self.result = f"get=REACHED:{len(str(got))}"
        except Exception as e:
            self.result = f"get=ERR:{type(e).__name__}"
        return self.result

    @gl.public.view
    def last(self) -> str:
        return self.result
