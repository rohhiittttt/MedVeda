import re
import sys
from pathlib import Path

app_path = Path("python_service/app.py")
content = app_path.read_text(encoding="utf-8")

# 1. Update AgentChatRequest to include fileBase64, fileMimeType, fileName
target_req = """class AgentChatRequest(BaseModel):
    message: Optional[str] = None
    query: Optional[str] = None
    patientId: Optional[str] = "MV-MED-2026-1024"
    patientInfo: Optional[Dict[str, Any]] = None
    language: Optional[str] = "auto"
    audioBase64: Optional[str] = None
    context: Optional[Dict[str, Any]] = None"""

replacement_req = """class AgentChatRequest(BaseModel):
    message: Optional[str] = None
    query: Optional[str] = None
    patientId: Optional[str] = "MV-MED-2026-1024"
    patientInfo: Optional[Dict[str, Any]] = None
    language: Optional[str] = "auto"
    audioBase64: Optional[str] = None
    context: Optional[Dict[str, Any]] = None
    fileBase64: Optional[str] = None
    fileMimeType: Optional[str] = None
    fileName: Optional[str] = None"""

if target_req in content:
    content = content.replace(target_req, replacement_req, 1)
    print("AgentChatRequest successfully updated with fileBase64 fields.")
else:
    print("Warning: target_req not found directly, check exact string.")

# Write back
app_path.write_text(content, encoding="utf-8")
print("Done step 1.")
