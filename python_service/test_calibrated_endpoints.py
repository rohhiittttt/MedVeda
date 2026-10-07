import sys
sys.stdout.reconfigure(encoding='utf-8')
from app import chat_medical_assistant_agent, AgentChatRequest

print("--- TEST 1: Basic Symptom (Mild fever) in English ---")
req1 = AgentChatRequest(query="I have mild fever and body ache since morning")
res1 = chat_medical_assistant_agent(req1)
assert res1["success"] is True
data1 = res1["data"]
print("Answer snippet:", data1["answer"][:180] + "...")
card_types1 = [c["type"] for c in data1.get("actionCards", [])]
print("Action Cards:", card_types1)
assert "CLARIFYING_QUESTIONS_CARD" in card_types1
assert "OTC_MEDICATION_CARD" in card_types1
print("Test 1 Passed!")

print("\n--- TEST 2: Basic Symptom (Acidity) in Hindi ---")
req2 = AgentChatRequest(query="मुझे पेट में हल्की गैस और एसिडिटी हो रही है", language="hi")
res2 = chat_medical_assistant_agent(req2)
assert res2["success"] is True
data2 = res2["data"]
print("Answer snippet:", data2["answer"][:180] + "...")
card_types2 = [c["type"] for c in data2.get("actionCards", [])]
print("Action Cards:", card_types2)
assert "CLARIFYING_QUESTIONS_CARD" in card_types2
assert "OTC_MEDICATION_CARD" in card_types2
print("Test 2 Passed!")

print("\n--- TEST 3: Complex / Prescription Query (Antibiotic) ---")
req3 = AgentChatRequest(query="Can you prescribe me amoxicillin or augmentin for my throat infection?")
res3 = chat_medical_assistant_agent(req3)
assert res3["success"] is True
data3 = res3["data"]
print("Answer snippet:", data3["answer"][:180] + "...")
card_types3 = [c["type"] for c in data3.get("actionCards", [])]
print("Action Cards:", card_types3)
assert "DOCTOR_REFERRAL_REQUIRED_CARD" in card_types3
print("Test 3 Passed!")

print("\n--- TEST 4: Medicine Inquiry (Dolo 650 & Alternatives) ---")
req4 = AgentChatRequest(query="What is Dolo 650 and what are its same composition alternatives?")
res4 = chat_medical_assistant_agent(req4)
assert res4["success"] is True
data4 = res4["data"]
print("Answer snippet:", data4["answer"][:180] + "...")
card_types4 = [c["type"] for c in data4.get("actionCards", [])]
print("Action Cards:", card_types4)
assert "MEDICINE_INFO_CARD" in card_types4
med_card = next(c for c in data4["actionCards"] if c["type"] == "MEDICINE_INFO_CARD")
print("Primary Name:", med_card.get("primaryName"))
print("Active Composition:", med_card.get("activeComposition"))
print("Alternatives:", [a.get("brand") for a in med_card.get("brandAlternatives", [])])
print("Test 4 Passed!")

print("\n--- TEST 5: Multimodal Upload (Mock Lab Report) ---")
import base64
fake_b64 = base64.b64encode(b"Sample Blood Test CBC Hemoglobin 10.4 g/dL Normal 13-17").decode("utf-8")
req5 = AgentChatRequest(query="Please explain my blood test results", fileBase64=fake_b64, fileMimeType="image/jpeg")
res5 = chat_medical_assistant_agent(req5)
assert res5["success"] is True
data5 = res5["data"]
print("Answer snippet:", data5["answer"][:180] + "...")
card_types5 = [c["type"] for c in data5.get("actionCards", [])]
print("Action Cards:", card_types5)
assert any(t in card_types5 for t in ["LAB_REPORT_CARD", "MEDICINE_INFO_CARD"])
print("Test 5 Passed!")

print("\nALL 5 BACKEND TESTS PASSED PERFECTLY!")
