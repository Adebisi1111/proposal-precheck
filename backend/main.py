from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import os
import json
import subprocess
import asyncio

app = FastAPI(title="Proposal Pre-Check Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CONTRACT_ADDRESS = os.getenv("CONTRACT_ADDRESS", "0xE2cEFCC1C449dBD8BBa32858a09eD72738A6976c")

class ProposalRequest(BaseModel):
    proposal_id: str
    title: str
    description: str

class ProposalResponse(BaseModel):
    proposal_id: str
    verdict: str
    reasoning: str
    confidence: int
    status: str
    contract: str

def run_cmd(args, input_data=None):
    cmd = ["genlayer"] + args
    if input_data:
        result = subprocess.run(cmd, input=input_data, capture_output=True, text=True, timeout=120)
    else:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    return result

@app.get("/")
async def root():
    return FileResponse("static/index.html")

@app.get("/api/health")
async def health():
    return {"status": "ok", "contract": CONTRACT_ADDRESS, "network": "GenLayer Bradbury"}

@app.post("/api/precheck", response_model=ProposalResponse)
async def precheck_proposal(request: ProposalRequest):
    if not request.proposal_id or not request.title or not request.description:
        raise HTTPException(status_code=400, detail="proposal_id, title, and description required")
    
    try:
        # Call the contract to check the proposal
        result = run_cmd([
            "write", CONTRACT_ADDRESS, "check_proposal",
            "--args", request.proposal_id,
            "--args", request.title,
            "--args", request.description
        ], input_data="test1234")
        
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail=f"Contract call failed: {result.stderr}")
        
        # Wait for finalization
        await asyncio.sleep(10)
        
        # Read the result
        check_result = run_cmd([
            "call", CONTRACT_ADDRESS, "get_check",
            "--args", request.proposal_id
        ], input_data="test1234")
        
        output = check_result.stdout
        
        # Parse the output - look for JSON in the output
        data = {"proposal_id": request.proposal_id, "verdict": "REVIEW", "reasoning": output, "confidence": 50}
        
        # Try to extract JSON from output
        try:
            json_start = output.find('{')
            json_end = output.rfind('}') + 1
            if json_start >= 0 and json_end > json_start:
                json_str = output[json_start:json_end]
                parsed = json.loads(json_str)
                data = {
                    "proposal_id": parsed.get("proposal_id", request.proposal_id),
                    "verdict": parsed.get("verdict", "REVIEW"),
                    "reasoning": parsed.get("reasoning", "No reasoning available"),
                    "confidence": parsed.get("confidence", 50)
                }
        except json.JSONDecodeError:
            pass
        
        return ProposalResponse(
            proposal_id=data["proposal_id"],
            verdict=data["verdict"],
            reasoning=data["reasoning"],
            confidence=data["confidence"],
            status="success",
            contract=CONTRACT_ADDRESS
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="GenLayer transaction timed out")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/check/{proposal_id}")
async def get_check(proposal_id: str):
    try:
        result = run_cmd([
            "call", CONTRACT_ADDRESS, "get_check",
            "--args", proposal_id
        ], input_data="test1234")
        return {"output": result.stdout, "contract": CONTRACT_ADDRESS}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/stats")
async def get_stats():
    try:
        result = run_cmd([
            "call", CONTRACT_ADDRESS, "get_checks_count"
        ], input_data="test1234")
        return {"output": result.stdout, "contract": CONTRACT_ADDRESS}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
