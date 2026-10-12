"""FastAPI HTTP service for MedVeda Government Health Scheme Finder (Feature 08).
Provides high-performance REST APIs for deterministic scheme evaluation, RAG retrieval,
interactive document gap-filling, and traceable explanations.
"""

import sys
sys.dont_write_bytecode = True
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, Query, Body
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from app.models import (
    PatientProfile,
    SchemeAssessment,
    ClarifyRequest,
    ExplainRequest,
    ExplanationResponse,
    GovernmentScheme,
    IngestionLogEntry
)
from app.rag_engine import SchemeRAGPipeline

app = FastAPI(
    title="MedVeda Government Health Scheme Finder API",
    description="Deterministic Rules Engine + RAG-Powered Scheme Discovery for Indian Healthcare Schemes",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pipeline = SchemeRAGPipeline()

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "medveda-scheme-finder",
        "schemes_indexed": len(pipeline.kb.schemes),
        "vector_chunks": len(pipeline.kb.chunks)
    }

@app.get("/api/schemes")
def list_schemes(state: Optional[str] = None):
    """Returns all verified official government schemes, optionally filtered by state."""
    schemes = list(pipeline.kb.schemes.values())
    if state:
        st = state.lower().strip()
        schemes = [
            s for s in schemes
            if s.applicable_states is None or any(st in x.lower() for x in s.applicable_states)
        ]
    return {"success": True, "count": len(schemes), "data": schemes}

@app.get("/api/schemes/{scheme_id}")
def get_scheme(scheme_id: str):
    """Retrieves full scheme metadata, criteria, and official source portal."""
    scheme = pipeline.kb.schemes.get(scheme_id)
    if not scheme:
        raise HTTPException(status_code=404, detail=f"Scheme '{scheme_id}' not found.")
    return {"success": True, "data": scheme}

@app.post("/api/schemes/assess", response_model=Dict[str, Any])
def assess_patient(
    profile: PatientProfile,
    patient_id: Optional[str] = Query(None, description="Optional patient identifier for ABDM tracking")
):
    """Primary entry point: Runs RAG retrieval, deterministic rules check, and AI ranking."""
    try:
        assessment = pipeline.assess_patient(profile, patient_id)
        return {"success": True, "data": assessment}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/schemes/assessment/{assessment_id}")
def get_assessment(assessment_id: str):
    """Retrieves complete assessment snapshot including rule engine field comparisons."""
    assessment = pipeline.assessments.get(assessment_id)
    if not assessment:
        raise HTTPException(status_code=404, detail=f"Assessment '{assessment_id}' not found.")
    return {"success": True, "data": assessment}

@app.post("/api/schemes/assessment/{assessment_id}/clarify")
def answer_clarification(assessment_id: str, req: ClarifyRequest):
    """Submits patient's answer to a clarifying document question, triggering immediate re-evaluation."""
    try:
        updated = pipeline.answer_clarification(assessment_id, req.question_id, req.answer)
        return {"success": True, "data": updated}
    except KeyError:
        raise HTTPException(status_code=404, detail="Assessment or Question not found.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/schemes/assessment/{assessment_id}/explain", response_model=Dict[str, Any])
def explain_scheme(assessment_id: str, req: ExplainRequest):
    """Generates traceable 'Why am I eligible?' or 'What could make me ineligible?' explanations."""
    try:
        explanation = pipeline.explain_scheme(assessment_id, req.scheme_id, req.perspective)
        return {"success": True, "data": explanation}
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/admin/schemes/ingest")
def trigger_ingest(payload: Dict[str, str] = Body(...)):
    """Triggers/simulates scraping/ingestion from an official government source."""
    source_url = payload.get("source_url", "https://pmjay.gov.in")
    log = pipeline.trigger_ingest(source_url)
    return {"success": True, "data": log}

@app.get("/api/admin/schemes/ingestion-log")
def get_ingestion_logs():
    """Retrieves ingestion audit logs and last-verified stamps."""
    return {"success": True, "count": len(pipeline.ingestion_logs), "data": pipeline.ingestion_logs}

if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=False)
