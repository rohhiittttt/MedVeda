import re
from pathlib import Path

app_path = Path("python_service/app.py")
content = app_path.read_text(encoding="utf-8")

start_marker = "def chat_medical_assistant_agent(req: AgentChatRequest):"
end_marker = 'if __name__ == "__main__":'

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

NEW_CHAT_FUNCTION = '''def chat_medical_assistant_agent(req: AgentChatRequest):
    """
    Dedicated Medical AI Assistant Agent with Calibrated Guardrails:
    1. Calibrated symptom triage: provisional assessment for basic/straightforward ailments,
       1-2 clarifying questions, safe OTC-only medications (no prescription needed),
       non-doctor disclaimer, refusal of complex/prescription ailments + doctor proposal.
    2. Multimodal upload analysis:
       - Lab Reports: parameter breakdown, normal vs abnormal, insights grounded strictly in report findings.
       - Medications: active salt extraction, OTC status, alternatives with the EXACT SAME chemical composition only.
    3. Action capabilities: appointment booking, facility locator, medicine reminders, navigation.
    4. Voice audio synthesis via gTTS in Hindi & English.
    """
    raw_query = (req.query or req.message or "").strip()
    detected_lang = detect_language(raw_query, req.language)
    patient_id = req.patientId or "MV-MED-2026-1024"
    patient_info = req.patientInfo or MOCK_PATIENTS_EHR.get(patient_id, {}).get("patient", {"name": "Ramesh Mahto"})

    # 1. EMERGENCY GUARDRAIL CHECK (G1 Immediate Bypass)
    if is_emergency_query(raw_query):
        if detected_lang == "hi":
            emergency_text = (
                "🚨 **आपातकालीन स्थिति का पता चला!**\\n\\n"
                "आपके द्वारा बताए गए लक्षण (जैसे सीने में तेज दर्द, सांस लेने में गंभीर तकलीफ) जीवन के लिए खतरा हो सकते हैं।\\n"
                "कृपया ऑनलाइन जवाब की प्रतीक्षा न करें और तत्काल नजदीकी अस्पताल जाएँ अथवा 108 नंबर पर कॉल करें।"
            )
        else:
            emergency_text = (
                "🚨 **CRITICAL MEDICAL EMERGENCY DETECTED!**\\n\\n"
                "The symptoms described (acute chest pain, severe breathing distress, loss of consciousness) indicate a potentially life-threatening emergency.\\n"
                "Do NOT wait for an online reply. Call 108 (Ambulance) immediately or go to the nearest emergency room."
            )
        
        audio_b64 = synthesize_speech_base64(emergency_text, detected_lang)
        return {
            "success": True,
            "data": {
                "answer": emergency_text,
                "detectedLanguage": detected_lang,
                "audioBase64": audio_b64,
                "urgencyLevel": "RED",
                "isEmergency": True,
                "actionCards": [
                    {
                        "type": "EMERGENCY_ACTIONS",
                        "title": "Immediate Emergency Contacts",
                        "ambulancePhone": "108",
                        "emergencyPhone": "112",
                        "nearestHospital": FACILITIES_DB[0]
                    }
                ]
            }
        }

    # 2. MULTIMODAL UPLOAD ANALYSIS (Images/PDFs of reports or medicine strips)
    if req.fileBase64:
        doc_analysis = analyze_multimodal_document(
            file_b64=req.fileBase64,
            mime_type=req.fileMimeType or "image/jpeg",
            user_query=raw_query,
            detected_lang=detected_lang
        )
        doc_type = doc_analysis.get("documentType", "medication")

        if doc_type == "medication":
            ans_text = doc_analysis.get("explanationHi" if detected_lang == "hi" else "explanationEn") or (
                f"Analysis of {doc_analysis.get('primaryName', 'medication')}: Active Composition is {doc_analysis.get('activeComposition')}. Suggested alternatives have the exact same chemical composition."
            )
            audio_b64 = synthesize_speech_base64(ans_text, detected_lang)
            return {
                "success": True,
                "data": {
                    "answer": ans_text,
                    "detectedLanguage": detected_lang,
                    "audioBase64": audio_b64,
                    "urgencyLevel": "GREEN" if doc_analysis.get("isOtc") else "YELLOW",
                    "actionCards": [
                        {
                            "type": "MEDICINE_INFO_CARD",
                            "title": f"Medication Analysis: {doc_analysis.get('primaryName', 'Medicine')}",
                            "primaryName": doc_analysis.get("primaryName"),
                            "activeComposition": doc_analysis.get("activeComposition"),
                            "strength": doc_analysis.get("strength"),
                            "therapeuticClass": doc_analysis.get("therapeuticClass"),
                            "isOtc": doc_analysis.get("isOtc", True),
                            "indication": doc_analysis.get("indication"),
                            "usageAdvice": doc_analysis.get("usageAdvice"),
                            "brandAlternatives": doc_analysis.get("brandAlternatives", []),
                            "disclaimer": doc_analysis.get("disclaimer")
                        }
                    ]
                }
            }
        else:
            # Lab Report
            ans_text = doc_analysis.get("explanationHi" if detected_lang == "hi" else "explanationEn") or (
                f"Diagnostic Report Analysis for {doc_analysis.get('title', 'Lab Test')}: Grounded summary strictly based on reported values."
            )
            audio_b64 = synthesize_speech_base64(ans_text, detected_lang)
            return {
                "success": True,
                "data": {
                    "answer": ans_text,
                    "detectedLanguage": detected_lang,
                    "audioBase64": audio_b64,
                    "urgencyLevel": "YELLOW",
                    "actionCards": [
                        {
                            "type": "LAB_REPORT_CARD",
                            "title": doc_analysis.get("title", "Laboratory Pathology Report"),
                            "facilityOrLab": doc_analysis.get("facilityOrLab", "Diagnostic Center"),
                            "date": doc_analysis.get("date", "Recent"),
                            "parameters": doc_analysis.get("parameters", []),
                            "groundedSummary": doc_analysis.get("groundedSummary", ""),
                            "disclaimer": doc_analysis.get("disclaimer", "AI is not a doctor. Discuss these values with a physician.")
                        },
                        {
                            "type": "HEALTH_GUIDANCE_ACTIONS",
                            "urgency": "YELLOW",
                            "options": [
                                {"label": "👨‍⚕️ Consult Doctor for Report Review", "doctorId": "doc_2", "route": "#feature2"},
                                {"label": "💊 Check Medicine Stock (Feature 06)", "route": "#feature6"}
                            ]
                        }
                    ]
                }
            }

    # 3. COMPLEX CONDITION OR PRESCRIPTION-ONLY REQUEST CHECK (CALIBRATED GUARDRAIL 1)
    # If the user asks to prescribe medicines that require a doctor's permission (antibiotics, steroids, BP/heart meds),
    # or mentions a non-straightforward/complex condition (high fever >3 days, dengue, typhoid, severe pain):
    is_complex, complex_reason = check_complex_or_prescription(raw_query)
    if is_complex:
        if detected_lang == "hi":
            ans_text = (
                "🛑 **डॉक्टर परामर्श अनिवार्य है (AI सीमा):**\\n\\n"
                "यह स्थिति सामान्य या सीधी नहीं है और इसके लिए डॉक्टर द्वारा व्यक्तिगत नैदानिक जांच तथा डॉक्टर के पर्चे (प्रिस्क्रिप्शन) वाली दवाओं की आवश्यकता है। "
                "AI के रूप में मैं इसका निदान नहीं कर सकता और न ही डॉक्टर के पर्चे वाली दवाइयाँ बता सकता हूँ।\\n\\n"
                f"• **कारण:** {complex_reason}\\n\\n"
                "कृपया सही निदान और सुरक्षित उपचार के लिए तुरंत प्रमाणित डॉक्टर से परामर्श लें। आप नीचे दिए गए विशेषज्ञ डॉक्टरों में से तुरंत अपॉइंटमेंट बुक कर सकते हैं।"
            )
        else:
            ans_text = (
                "🛑 **Physician Consultation Required (AI Boundary):**\\n\\n"
                "I cannot answer this or prescribe prescription medications. This condition/medication is not straightforward and requires direct doctor intervention, clinical examination, and prescription-only medications. "
                "As an AI assistant, I cannot prescribe prescription drugs or manage complex conditions.\\n\\n"
                f"• **Reason:** {complex_reason}\\n\\n"
                "Please consult a certified physician immediately for an accurate diagnosis and treatment plan. You can book a direct consultation with our network specialists below."
            )
        audio_b64 = synthesize_speech_base64(ans_text, detected_lang)
        return {
            "success": True,
            "data": {
                "answer": ans_text,
                "detectedLanguage": detected_lang,
                "audioBase64": audio_b64,
                "urgencyLevel": "ORANGE",
                "actionCards": [
                    {
                        "type": "DOCTOR_REFERRAL_REQUIRED_CARD",
                        "title": "Doctor Consultation Required",
                        "reason": complex_reason,
                        "options": [
                            {"label": "👨‍⚕️ Book Consultation with Dr. Rajesh Verma", "doctorId": "doc_2", "route": "#feature2"},
                            {"label": "🏥 View Sadar Hospital OPD & Emergency", "route": "#feature1"}
                        ]
                    }
                ]
            }
        }

    # 4. DIRECT MEDICINE INQUIRY & ALTERNATIVES (Text query about medicine & same-composition alternatives)
    med_lookup = lookup_medicine(raw_query)
    is_asking_med = bool(med_lookup) or any(
        re.search(pat, raw_query, re.IGNORECASE) for pat in [
            r'\\b(?:tell\\s+me\\s+about|what\\s+is|alternative\\s+for|substitute\\s+for|same\\s+composition|dosage\\s+of)\\b.*\\b(?:dolo|crocin|calpol|telma|cetzine|gelusil|medicine|tablet|syrup)\\b',
            r'(?:दवा\\s*के\\s*बारे\\s*में|समान\\s*दवा|वैकल्पिक\\s*दवा|साल्ट|डोलो|क्रोसिन|टेलमा|सिट्रिजिन|गैलुसिल)'
        ]
    )
    if is_asking_med and not any(bk in raw_query.lower() for bk in ["book appointment", "अपॉइंटमेंट बुक", "डॉक्टर बुक"]):
        if med_lookup:
            med_info = med_lookup
        else:
            gen_res = analyze_multimodal_document(None, None, raw_query, detected_lang)
            if gen_res.get("documentType") == "medication":
                med_info = gen_res
            else:
                med_info = SAME_COMPOSITION_MEDS_DB[0]

        if detected_lang == "hi":
            ans_text = (
                f"**{med_info.get('primaryName', 'दवा')} ({med_info.get('activeComposition', '')}) की जानकारी:**\\n\\n"
                f"• **उपयोग:** {med_info.get('indication', '')}\\n"
                f"• **प्रकार:** {'🟢 बिना पर्चे वाली OTC दवा (आसानी से उपलब्ध)' if med_info.get('isOtc') else '🔴 डॉक्टर के पर्चे (प्रिस्क्रिप्शन) वाली दवा'}\\n"
                f"• **खुराक व सलाह:** {med_info.get('usageAdvice', '')}\\n\\n"
                f"**समान रासायनिक साल्ट (Exact Same Composition) वाली वैकल्पिक ब्रांड्स:**\\n" +
                "\\n".join([f"• **{alt['brand']}** ({alt.get('manufacturer', '')}) — {alt['salt']} [{alt.get('priceEst', '')}]" for alt in med_info.get("brandAlternatives", [])]) +
                f"\\n\\n*सख्त सुरक्षा नियम: सभी सूचीबद्ध विकल्प समान सक्रिय साल्ट ({med_info.get('activeComposition')}) साझा करते हैं। डॉक्टर की सलाह के बिना कभी भी दवा का डोज या प्रकार न बदलें।*"
            )
        else:
            ans_text = (
                f"**Medicine Information: {med_info.get('primaryName')} ({med_info.get('activeComposition')}):**\\n\\n"
                f"• **Therapeutic Indication:** {med_info.get('indication')}\\n"
                f"• **Classification:** {'🟢 Over-The-Counter (OTC - Easily available without prescription)' if med_info.get('isOtc') else '🔴 Prescription-Only (Doctor consultation required)'}\\n"
                f"• **Dosage & Precautions:** {med_info.get('usageAdvice')}\\n\\n"
                f"**Verified Alternatives with EXACT SAME Chemical Composition:**\\n" +
                "\\n".join([f"• **{alt['brand']}** ({alt.get('manufacturer', '')}) — {alt['salt']} [{alt.get('priceEst', '')}]" for alt in med_info.get("brandAlternatives", [])]) +
                f"\\n\\n*Strict Safety Guardrail: All listed alternatives share the exact same active pharmaceutical ingredient ({med_info.get('activeComposition')}). For prescription drugs, always consult a physician.*"
            )

        audio_b64 = synthesize_speech_base64(ans_text, detected_lang)
        return {
            "success": True,
            "data": {
                "answer": ans_text,
                "detectedLanguage": detected_lang,
                "audioBase64": audio_b64,
                "urgencyLevel": "GREEN" if med_info.get("isOtc") else "YELLOW",
                "actionCards": [
                    {
                        "type": "MEDICINE_INFO_CARD",
                        "title": f"Medication Details: {med_info.get('primaryName')}",
                        "primaryName": med_info.get("primaryName"),
                        "activeComposition": med_info.get("activeComposition"),
                        "strength": med_info.get("strength"),
                        "therapeuticClass": med_info.get("therapeuticClass"),
                        "isOtc": med_info.get("isOtc", True),
                        "indication": med_info.get("indication"),
                        "usageAdvice": med_info.get("usageAdvice"),
                        "brandAlternatives": med_info.get("brandAlternatives", []),
                        "disclaimer": "AI is not a doctor. Verify identical composition with your pharmacist."
                    }
                ]
            }
        }

    # 5. DIRECT LAB REPORT INQUIRY (User pasted lab parameters in chat text)
    lab_keywords = ["cbc report", "hemoglobin", "platelet count", "blood sugar", "lipid profile", "creatinine", "लैब टेस्ट", "ब्लड टेस्ट", "हीमोग्लोबिन"]
    if any(k in raw_query.lower() for k in lab_keywords) and any(c in raw_query for c in ["g/dL", "mg/dL", "cumm", "normal", "range", ":", "10.", "11.", "12.", "13.", "14."]):
        report_res = analyze_multimodal_document(None, None, raw_query, detected_lang)
        ans_text = report_res.get("explanationHi" if detected_lang == "hi" else "explanationEn") or "Report parameter analysis grounded strictly in the observed values."
        audio_b64 = synthesize_speech_base64(ans_text, detected_lang)
        return {
            "success": True,
            "data": {
                "answer": ans_text,
                "detectedLanguage": detected_lang,
                "audioBase64": audio_b64,
                "urgencyLevel": "YELLOW",
                "actionCards": [
                    {
                        "type": "LAB_REPORT_CARD",
                        "title": report_res.get("title", "Laboratory Report Analysis"),
                        "facilityOrLab": report_res.get("facilityOrLab", "Diagnostic Center"),
                        "date": report_res.get("date", "Recent"),
                        "parameters": report_res.get("parameters", []),
                        "groundedSummary": report_res.get("groundedSummary", ""),
                        "disclaimer": report_res.get("disclaimer", "AI is not a doctor. Consult a physician.")
                    },
                    {
                        "type": "HEALTH_GUIDANCE_ACTIONS",
                        "urgency": "YELLOW",
                        "options": [
                            {"label": "👨‍⚕️ Book Consultation with Doctor", "doctorId": "doc_2", "route": "#feature2"}
                        ]
                    }
                ]
            }
        }

    # 6. HONESTY GUARDRAIL CHECK (G-HON Out-of-Scope Detection)
    out_of_scope_patterns = [
        r'\\b(?:order|buy|purchase)\\s+medicine\\b',
        r'\\b(?:pay|payment|credit\\s*card|debit\\s*card|upi|gateway)\\b',
        r'\\b(?:order\\s*food|pizza|burger)\\b',
        r'\\b(?:biopsy|diagnose\\s*cancer|cure\\s*cancer)\\b',
        r'(?:दवा\\s*(?:खरीद|आर्डर)|भुगतान|पैसे\\s*काट)'
    ]
    is_out_of_scope = any(re.search(pat, raw_query, re.IGNORECASE) for pat in out_of_scope_patterns)
    if is_out_of_scope:
        if detected_lang == "hi":
            ans = (
                "मैं मेदवेद में सीधे दवाइयां ऑर्डर करने या ऑनलाइन भुगतान की सुविधा नहीं देता हूँ। यह क्षमता अभी उपलब्ध नहीं है।\\n\\n"
                "परंतु मैं आपके लिए यह कर सकता हूँ:\\n"
                "• **फ़ीचर 06 (दवा उपलब्धता व लैब्स)** पर हजारीबाग की पंजीकृत फार्मेसियों में उपलब्ध स्टॉक देख सकते हैं।\\n"
                "• **फ़ीचर 02** के माध्यम से डॉक्टर से टेलीकंसल्टेशन अपॉइंटमेंट बुक कर सकते हैं।"
            )
        else:
            ans = (
                "I cannot order medicines online or process payments directly. That action is not supported in MedVeda yet.\\n\\n"
                "Here is what I CAN do for you instead:\\n"
                "• View live verified pharmacy stock in Hazaribagh via **Feature 06: Medicine Availability & Labs**.\\n"
                "• Search available doctors and book an in-person or teleconsultation appointment in **Feature 02**."
            )
        
        audio_b64 = synthesize_speech_base64(ans, detected_lang)
        return {
            "success": True,
            "data": {
                "answer": ans,
                "detectedLanguage": detected_lang,
                "audioBase64": audio_b64,
                "urgencyLevel": "GREEN",
                "actionCards": [
                    {
                        "type": "CAPABILITY_FALLBACK",
                        "title": "MedVeda Supported Alternatives",
                        "options": [
                            {"label": "💊 Check Medicine Stock (Feature 06)", "route": "#feature6"},
                            {"label": "👨‍⚕️ Book Doctor Consultation (Feature 02)", "route": "#feature2"}
                        ]
                    }
                ]
            }
        }

    # 7. NAVIGATION REQUESTS (App Guidance)
    nav_map = {
        "care-navigator": ("#feature1", "Feature 01: Care Navigator (Symptom Triage)", ["care navigator", "symptom triage", "लक्षण जांच", "अस्पताल खोजें"]),
        "teleconsult": ("#feature2", "Feature 02: Teleconsultation OPD & Queue", ["teleconsult", "opd", "queue", "टेलीकंसल्ट", "डॉक्टर कॉल"]),
        "referrals": ("#feature3", "Feature 03: Smart Referrals System", ["referral", "रिफरल"]),
        "followups": ("#feature4", "Feature 04: High-Risk Patient Follow-Ups", ["follow up", "follow-up", "फॉलो अप", "आशा वर्कर"]),
        "records": ("#feature5", "Feature 05: Interoperable Health Records (ABDM)", ["records", "health records", "prescription", "लैब टेस्ट", "मेडिकल रिकॉर्ड", "abdm"]),
        "medicine": ("#feature6", "Feature 06: Medicines Availability & Diagnostics", ["pharmacy", "medicine stock", "दवा स्टॉक", "लैब टेस्ट केंद्र"]),
        "dashboard": ("#feature7", "Feature 07: Facility Operations Dashboard", ["facility dashboard", "bed availability", "आईसीयू बेड"]),
        "schemes": ("#feature8", "Feature 08: Govt Health Schemes (PM-JAY)", ["scheme", "pmjay", "ayushman", "सरकारी योजना", "आयुष्मान"]),
        "command-center": ("#feature9", "Feature 09: District Admin Command Center", ["command center", "surveillance", "कमांड सेंटर"])
    }

    matched_nav = None
    for key, (route, title, kws) in nav_map.items():
        if any(re.search(rf'\\b{re.escape(w)}\\b', raw_query, re.IGNORECASE) for w in kws):
            if any(term in raw_query.lower() for term in ["go to", "take me to", "navigate", "open", "show me", "खोलें", "पर ले जाएं", "दिखाएं"]):
                matched_nav = {"route": route, "title": title}
                break

    if matched_nav:
        ans = (
            f"निश्चय ही! मैं आपको **{matched_nav['title']}** पर ले जा रहा हूँ। आप नीचे दिए गए बटन पर भी क्लिक कर सकते हैं।"
            if detected_lang == "hi"
            else f"Certainly! Navigating you to **{matched_nav['title']}**. You can also tap the button below."
        )
        audio_b64 = synthesize_speech_base64(ans, detected_lang)
        return {
            "success": True,
            "data": {
                "answer": ans,
                "detectedLanguage": detected_lang,
                "audioBase64": audio_b64,
                "urgencyLevel": "GREEN",
                "actionCards": [
                    {
                        "type": "NAVIGATE_ACTION",
                        "title": f"Jump to {matched_nav['title']}",
                        "route": matched_nav["route"],
                        "buttonLabel": f"🚀 Open {matched_nav['title'].split(':')[0]}"
                    }
                ]
            }
        }

    # 8. VIEW APPOINTMENTS REQUEST
    if any(k in raw_query.lower() for k in ["my appointment", "view appointment", "booked appointment", "अपॉइंटमेंट दिखाएं", "मेरी बुकिंग"]):
        patient_apts = [a for a in APPOINTMENTS_STORE if a["patientId"] == patient_id]
        if detected_lang == "hi":
            ans = f"रमेश जी, आपके खाते में वर्तमान में {len(patient_apts)} कन्फर्म अपॉइंटमेंट दर्ज है:"
        else:
            ans = f"Ramesh, you have {len(patient_apts)} confirmed appointment(s) in your records:"
        
        audio_b64 = synthesize_speech_base64(ans, detected_lang)
        return {
            "success": True,
            "data": {
                "answer": ans,
                "detectedLanguage": detected_lang,
                "audioBase64": audio_b64,
                "urgencyLevel": "GREEN",
                "actionCards": [
                    {
                        "type": "APPOINTMENTS_LIST",
                        "title": "Your Active Appointments",
                        "appointments": patient_apts
                    }
                ]
            }
        }

    # 9. MEDICINE REMINDER REQUEST
    if any(k in raw_query.lower() for k in ["remind", "reminder", "रिमाइंडर", "अलार्म"]):
        med_target = "Telmisartan 40mg"
        time_target = "08:00 AM"
        if "rosuvas" in raw_query.lower() or "रोसुवास" in raw_query:
            med_target = "Rosuvas 20mg"
            time_target = "09:30 PM"
        elif "ecosprin" in raw_query.lower() or "इकोस्प्रिन" in raw_query:
            med_target = "Ecosprin 75mg"
            time_target = "08:30 AM"

        ans = (
            f"मैंने आपकी दवा **{med_target}** के लिए {time_target} पर रिमाइंडर तैयार किया है। कृपया नीचे 'रिमाइंडर सेव करें' बटन पर क्लिक करके पुष्टि करें।"
            if detected_lang == "hi"
            else f"I have prepared a dosage reminder for **{med_target}** at {time_target}. Please confirm below to activate it."
        )
        audio_b64 = synthesize_speech_base64(ans, detected_lang)
        return {
            "success": True,
            "data": {
                "answer": ans,
                "detectedLanguage": detected_lang,
                "audioBase64": audio_b64,
                "urgencyLevel": "GREEN",
                "actionCards": [
                    {
                        "type": "PROPOSE_REMINDER",
                        "title": "Confirm Medicine Reminder",
                        "medicineName": med_target,
                        "dosage": "1 dose",
                        "time": time_target,
                        "instruction": "After meals",
                        "patientId": patient_id
                    }
                ]
            }
        }

    # 10. NEARBY FACILITIES REQUEST
    if any(k in raw_query.lower() for k in ["nearby hospital", "emergency bed", "sadar hospital", "chc", "अस्पताल खोजें", "नजदीकी अस्पताल"]):
        ans = (
            "हजारीबाग जिले के नजदीकी सत्यापित अस्पताल और आपातकालीन केंद्र निम्नलिखित हैं:"
            if detected_lang == "hi"
            else "Here are the verified nearby healthcare facilities and emergency centers in Hazaribagh district:"
        )
        audio_b64 = synthesize_speech_base64(ans, detected_lang)
        return {
            "success": True,
            "data": {
                "answer": ans,
                "detectedLanguage": detected_lang,
                "audioBase64": audio_b64,
                "urgencyLevel": "GREEN",
                "actionCards": [
                    {
                        "type": "FACILITIES_LIST",
                        "title": "Verified Healthcare Facilities",
                        "facilities": FACILITIES_DB
                    }
                ]
            }
        }

    # 11. DOCTOR SEARCH & BOOKING INTENT
    booking_keywords = ["book", "appointment", "doctor", "cardiologist", "neurologist", "pediatrician", "orthopedic", "डॉक्टर", "अपॉइंटमेंट", "बुक करें", "दिखाना है"]
    if any(k in raw_query.lower() for k in booking_keywords):
        matched_doc = None
        if any(w in raw_query.lower() for w in ["cardio", "heart", "दिल", "कार्डियो", "राजेश", "verma"]):
            matched_doc = DOCTORS_DB[1]  # Dr. Rajesh Verma
        elif any(w in raw_query.lower() for w in ["neuro", "brain", "stroke", "न्यूरो", "प्रिया", "sharma"]):
            matched_doc = DOCTORS_DB[0]  # Dr. Priya Sharma
        elif any(w in raw_query.lower() for w in ["child", "pediatric", "बच्चा", "शिशु", "अनन्या", "sen"]):
            matched_doc = DOCTORS_DB[2]  # Dr. Ananya Sen
        elif any(w in raw_query.lower() for w in ["bone", "ortho", "joint", "हड्डी", "विक्रम", "malhotra"]):
            matched_doc = DOCTORS_DB[3]  # Dr. Vikram Malhotra
        elif any(w in raw_query.lower() for w in ["women", "pregnant", "gynec", "महिला", "सुनीता", "patel"]):
            matched_doc = DOCTORS_DB[4]  # Dr. Sunita Patel

        if matched_doc:
            chosen_slot = matched_doc["slots"][0]
            ans = (
                f"मैंने {matched_doc['name']} ({matched_doc['specialty']}) के साथ {chosen_slot['time']} का स्लॉट तैयार किया है।\\n"
                f"अस्पताल: {matched_doc['facilityName']}\\n\\n"
                f"कृपया नीचे दिए गए **'अपॉइंटमेंट पक्का करें'** बटन पर क्लिक करके बुकिंग की पुष्टि करें।"
                if detected_lang == "hi"
                else (
                    f"I have prepared an appointment proposal with **{matched_doc['name']}** ({matched_doc['specialty']}) for **{chosen_slot['time']}**.\\n"
                    f"Hospital: {matched_doc['facilityName']}\\n\\n"
                    f"Please tap the **'Confirm Booking'** button below to finalize your booking."
                )
            )
            audio_b64 = synthesize_speech_base64(ans, detected_lang)
            return {
                "success": True,
                "data": {
                    "answer": ans,
                    "detectedLanguage": detected_lang,
                    "audioBase64": audio_b64,
                    "urgencyLevel": "YELLOW",
                    "actionCards": [
                        {
                            "type": "CONFIRMATION_CARD",
                            "title": "Appointment Booking Confirmation",
                            "doctor": matched_doc,
                            "slot": chosen_slot,
                            "patient": {
                                "id": patient_id,
                                "name": patient_info.get("name", "Ramesh Mahto"),
                                "phone": "+91-94311-28901"
                            },
                            "urgencyTier": "ROUTINE",
                            "mode": "teleconsult"
                        }
                    ]
                }
            }
        else:
            ans = (
                "हजारीबाग के पंजीकृत विशेषज्ञ डॉक्टर निम्नलिखित हैं। आप जिस डॉक्टर से परामर्श लेना चाहते हैं, उसके 'बुक करें' बटन पर क्लिक करें:"
                if detected_lang == "hi"
                else "Here are the registered specialist doctors available in Hazaribagh. Tap 'Book Doctor' to prepare a booking confirmation:"
            )
            audio_b64 = synthesize_speech_base64(ans, detected_lang)
            return {
                "success": True,
                "data": {
                    "answer": ans,
                    "detectedLanguage": detected_lang,
                    "audioBase64": audio_b64,
                    "urgencyLevel": "YELLOW",
                    "actionCards": [
                        {
                            "type": "DOCTORS_LIST",
                            "title": "Available Medical Specialists",
                            "doctors": DOCTORS_DB
                        }
                    ]
                }
            }

    # 12. BASIC / STRAIGHTFORWARD CONDITIONS (CALIBRATED GUARDRAIL 1)
    cond_key, cond_cfg = check_basic_condition(raw_query)
    if cond_cfg:
        q1_hi = cond_cfg["questionsHi"][0]
        q2_hi = cond_cfg["questionsHi"][1]
        q1_en = cond_cfg["questionsEn"][0]
        q2_en = cond_cfg["questionsEn"][1]

        otc_hi_lines = "\\n".join([f"• **{m['name']}**: {m['dosage']} — {m['notesHi']}" for m in cond_cfg["otcMedicines"]])
        otc_en_lines = "\\n".join([f"• **{m['name']}**: {m['dosage']} — {m['notesEn']}" for m in cond_cfg["otcMedicines"]])

        if detected_lang == "hi":
            ans_text = (
                f"**संभावित प्राथमिक मूल्यांकन:** आपके द्वारा बताए गए लक्षणों के अनुसार यह **{cond_cfg['diagnosisHi']}** प्रतीत होता है।\\n\\n"
                f"⚠️ **अस्वीकरण:** AI कोई डॉक्टर नहीं है, इसलिए पूरी तरह AI के कहे पर भरोसा न करें। पक्के और सटीक निदान के लिए प्रमाणित डॉक्टर से जांच अवश्य कराएं।\\n\\n"
                f"**स्थिति की पुष्टि हेतु स्पष्टीकरण प्रश्न (ताकि पक्का हो सके कि यह सामान्य है):**\\n"
                f"1. {q1_hi}\\n"
                f"2. {q2_hi}\\n\\n"
                f"**सुरक्षित ओवर-द-काउंटर (OTC) दवाइयां (बिना पर्चे के मेडिकल स्टोर पर आसानी से उपलब्ध):**\\n"
                f"{otc_hi_lines}\\n\\n"
                f"• **घरेलू देखभाल:** {cond_cfg['homeCareHi']}\\n\\n"
                f"*सख्त सुरक्षा नियम: ये बिना पर्चे वाली सामान्य राहतकारी दवाइयां हैं। यदि लक्षण 48 घंटे में ठीक न हों या गंभीर लगें, तो कृपया नीचे दिए गए डॉक्टर से तुरंत परामर्श लें।*"
            )
        else:
            ans_text = (
                f"**Provisional Health Assessment:** Based on the symptoms described, this appears consistent with a **{cond_cfg['diagnosisEn']}**.\\n\\n"
                f"⚠️ **Medical Disclaimer:** I am an AI medical assistant, not a doctor, so please do not solely rely on what AI says. For an official and accurate medical diagnosis, please consult a certified doctor.\\n\\n"
                f"**Clarifying Questions (to confirm if this is truly straightforward):**\\n"
                f"1. {q1_en}\\n"
                f"2. {q2_en}\\n\\n"
                f"**Safe Over-The-Counter (OTC) Guidance (Easily available at medical stores without prescription):**\\n"
                f"{otc_en_lines}\\n\\n"
                f"• **Home Care:** {cond_cfg['homeCareEn']}\\n\\n"
                f"*Safety Rule: These are non-prescription OTC medications for temporary relief. If symptoms persist beyond 48 hours, worsen, or red flags appear, please consult a doctor below.*"
            )

        audio_b64 = synthesize_speech_base64(ans_text, detected_lang)
        return {
            "success": True,
            "data": {
                "answer": ans_text,
                "detectedLanguage": detected_lang,
                "audioBase64": audio_b64,
                "urgencyLevel": "YELLOW",
                "actionCards": [
                    {
                        "type": "CLARIFYING_QUESTIONS_CARD",
                        "title": "Clarifying Questions to Rule Out Red Flags",
                        "questions": cond_cfg["questionsHi"] if detected_lang == "hi" else cond_cfg["questionsEn"],
                        "quickReplies": cond_cfg.get("quickReplies", [])
                    },
                    {
                        "type": "OTC_MEDICATION_CARD",
                        "title": "Safe OTC Relief (No Prescription Required)",
                        "medicines": cond_cfg["otcMedicines"]
                    },
                    {
                        "type": "HEALTH_GUIDANCE_ACTIONS",
                        "urgency": "YELLOW",
                        "options": [
                            {"label": "👨‍⚕️ Book Routine Doctor Consult", "doctorId": "doc_2", "route": "#feature2"},
                            {"label": "🏥 Find Nearest Hospital Facility", "route": "#feature1"}
                        ]
                    }
                ]
            }
        }

    # 13. GENERAL QUERY / RECORDS LOOKUP VIA GEMINI
    records_list = MOCK_PATIENTS_EHR.get(patient_id, {}).get("records", [])
    records_context = "\\n---\\n".join([
        f"Document: {r['title']} ({r['recordedAt']}) by {r.get('doctorName', 'N/A')}\\nSummary: {r['summary']}"
        for r in records_list[:3]
    ])

    prompt = f"""You are the MedVeda Autonomous Medical Assistant Agent.
You are NOT a doctor. Follow G-NAD (Not a doctor disclaimer) and G-HON (Honesty about MedVeda bounds).
Patient: {patient_info.get('name')} ({patient_id})
Verified Patient Records:
{records_context}

Available In-Website Features:
- Feature 01: Care Navigator (Symptom triage & hospital finder)
- Feature 02: Teleconsultation OPD & Priority Queue
- Feature 03: Smart Referrals
- Feature 04: High-Risk Follow-Ups
- Feature 05: Health Records & ABDM
- Feature 06: Medicine Availability & Diagnostics
- Feature 07: Facility Operations Dashboard
- Feature 08: Govt Health Schemes (PM-JAY)
- Feature 09: District Command Center

User Query: "{raw_query}"
Language: {"Hindi (Devanagari script)" if detected_lang == "hi" else "English"}

Rules:
1. Answer strictly in the requested language ({"Hindi" if detected_lang == "hi" else "English"}).
2. Do not hallucinate external doctors, websites or capabilities. Keep everything within MedVeda.
3. Suggest appropriate MedVeda features if relevant.
4. If asked about medication, advise ONLY safe OTC medicines and suggest doctor consultation for prescription drugs.
"""

    ans_text = ""
    if GEMINI_API_KEY:
        try:
            endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
            res = requests.post(
                endpoint,
                json={"contents": [{"parts": [{"text": prompt}]}]},
                timeout=20
            )
            if res.ok:
                res_data = res.json()
                ans_text = res_data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
        except Exception as e:
            print(f"Agent Gemini fallback: {e}")

    if not ans_text:
        ans_text = (
            f"नमस्ते {patient_info.get('name')} जी, मैं आपका मेदवेद मेडिकल असिस्टेंट एजेंट हूँ। मैं आपके लिए डॉक्टर ढूंढ सकता हूँ, टेलीकंसल्टेशन अपॉइंटमेंट बुक कर सकता हूँ, और दवा के रिमाइंडर सेट कर सकता हूँ।"
            if detected_lang == "hi"
            else f"Hello {patient_info.get('name')}, I am your MedVeda Autonomous Medical Assistant Agent. I can search doctors, book appointments, find nearby hospitals, and set medicine reminders."
        )

    audio_b64 = synthesize_speech_base64(ans_text, detected_lang)
    return {
        "success": True,
        "data": {
            "answer": ans_text,
            "detectedLanguage": detected_lang,
            "audioBase64": audio_b64,
            "urgencyLevel": "GREEN",
            "actionCards": [
                {
                    "type": "QUICK_ACTIONS",
                    "options": [
                        {"label": "👨‍⚕️ Book Consultation", "route": "#feature2"},
                        {"label": "🏥 Nearby Hospitals", "route": "#feature1"},
                        {"label": "💊 Medicine Reminders", "route": "#assistant"}
                    ]
                }
            ]
        }
    }
'''

new_content = content[:start_idx] + NEW_CHAT_FUNCTION + "\n\n" + content[end_idx:]
app_path.write_text(new_content, encoding="utf-8")
print("chat_medical_assistant_agent priority order successfully updated!")
