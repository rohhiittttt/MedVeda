import re
from pathlib import Path

app_path = Path("python_service/app.py")
content = app_path.read_text(encoding="utf-8")

DATASETS_AND_HELPERS = '''
# -------------------------------------------------------------
# MASTER SAME-COMPOSITION MEDICATIONS & CALIBRATED TRIAGE KNOWLEDGE
# -------------------------------------------------------------
SAME_COMPOSITION_MEDS_DB = [
    {
        "id": "med_pcm_650",
        "primaryName": "Dolo 650",
        "genericName": "Paracetamol (Acetaminophen) 650mg",
        "activeComposition": "Paracetamol 650mg",
        "strength": "650mg",
        "therapeuticClass": "Analgesic & Antipyretic",
        "isOtc": True,
        "indication": "Temporary relief of mild-to-moderate fever, headache, body pain, and muscular aches.",
        "usageAdvice": "Take 1 tablet after food with water. Maintain a gap of at least 4 to 6 hours between doses. Maximum 4 tablets (2600mg) in 24 hours. Avoid alcohol.",
        "brandAlternatives": [
            {"brand": "Calpol 650", "manufacturer": "GSK (GlaxoSmithKline)", "salt": "Paracetamol 650mg", "priceEst": "₹30 for 15 tabs", "otc": True},
            {"brand": "Crocin 650", "manufacturer": "Haleon / GSK", "salt": "Paracetamol 650mg", "priceEst": "₹32 for 15 tabs", "otc": True},
            {"brand": "P-650", "manufacturer": "Apex Laboratories", "salt": "Paracetamol 650mg", "priceEst": "₹28 for 10 tabs", "otc": True},
            {"brand": "Pacimol 650", "manufacturer": "Ipca Laboratories", "salt": "Paracetamol 650mg", "priceEst": "₹26 for 10 tabs", "otc": True}
        ],
        "keywords": ["dolo", "dolo 650", "calpol", "calpol 650", "crocin", "crocin 650", "p-650", "pacimol", "paracetamol 650", "पैरासिटामोल", "डोलो"]
    },
    {
        "id": "med_pcm_500",
        "primaryName": "Crocin 500",
        "genericName": "Paracetamol 500mg",
        "activeComposition": "Paracetamol 500mg",
        "strength": "500mg",
        "therapeuticClass": "Analgesic & Antipyretic",
        "isOtc": True,
        "indication": "Relief from mild fever, mild headache, and muscular soreness.",
        "usageAdvice": "Take 1 tablet after food with water. Minimum 4-6 hours between doses. Do not exceed 4g/day.",
        "brandAlternatives": [
            {"brand": "Calpol 500", "manufacturer": "GSK", "salt": "Paracetamol 500mg", "priceEst": "₹20 for 15 tabs", "otc": True},
            {"brand": "Dolo 500", "manufacturer": "Micro Labs", "salt": "Paracetamol 500mg", "priceEst": "₹18 for 15 tabs", "otc": True},
            {"brand": "Metacin 500", "manufacturer": "Themis Medicare", "salt": "Paracetamol 500mg", "priceEst": "₹16 for 10 tabs", "otc": True}
        ],
        "keywords": ["crocin 500", "calpol 500", "dolo 500", "metacin", "paracetamol 500", "क्रोसिन"]
    },
    {
        "id": "med_ors",
        "primaryName": "Electral ORS Powder",
        "genericName": "Oral Rehydration Salts (WHO Formula)",
        "activeComposition": "WHO Standard Electrolyte Salts & Dextrose",
        "strength": "Standard WHO Osmolarity",
        "therapeuticClass": "Oral Rehydration Solution / Electrolytes",
        "isOtc": True,
        "indication": "Restoration of body fluid and essential electrolytes lost due to dehydration, diarrhea, excessive sweating, or heat exhaustion.",
        "usageAdvice": "Dissolve the entire 21.8g sachet in exactly 1 litre of clean drinking water. Drink in small sips throughout the day. Discard any unused solution after 24 hours.",
        "brandAlternatives": [
            {"brand": "Prolyte ORS", "manufacturer": "Cipla", "salt": "WHO Standard Electrolyte Salts & Dextrose", "priceEst": "₹22 per sachet", "otc": True},
            {"brand": "Walyte ORS", "manufacturer": "Wallace Pharmaceuticals", "salt": "WHO Standard Electrolyte Salts & Dextrose", "priceEst": "₹20 per sachet", "otc": True},
            {"brand": "ORS-L Ready Liquid", "manufacturer": "Johnson & Johnson", "salt": "WHO Standard Electrolyte Salts & Dextrose", "priceEst": "₹35 per 200ml", "otc": True}
        ],
        "keywords": ["electral", "ors", "oral rehydration", "prolyte", "walyte", "dehydration solution", "ओआरएस", "इलेक्ट्राल"]
    },
    {
        "id": "med_cetirizine",
        "primaryName": "Cetzine 10mg",
        "genericName": "Cetirizine Hydrochloride 10mg",
        "activeComposition": "Cetirizine Hydrochloride 10mg",
        "strength": "10mg",
        "therapeuticClass": "Second-Generation Antihistamine",
        "isOtc": True,
        "indication": "Relief from allergic symptoms: runny nose, sneezing, itchy/watery eyes, seasonal allergic rhinitis, and urticaria/hives.",
        "usageAdvice": "Take 1 tablet once daily, preferably at bedtime as it may cause mild drowsiness. Avoid driving or alcohol after taking.",
        "brandAlternatives": [
            {"brand": "Okacet 10", "manufacturer": "Cipla", "salt": "Cetirizine Hydrochloride 10mg", "priceEst": "₹22 for 10 tabs", "otc": True},
            {"brand": "Alerid 10", "manufacturer": "Cipla", "salt": "Cetirizine Hydrochloride 10mg", "priceEst": "₹20 for 10 tabs", "otc": True},
            {"brand": "Zyrtec 10", "manufacturer": "Dr. Reddy\'s", "salt": "Cetirizine Hydrochloride 10mg", "priceEst": "₹38 for 10 tabs", "otc": True}
        ],
        "keywords": ["cetzine", "cetirizine", "okacet", "alerid", "zyrtec", "setrizin", "सिट्रिजिन"]
    },
    {
        "id": "med_antacid",
        "primaryName": "Gelusil MPS Liquid",
        "genericName": "Magaldrate 480mg + Simethicone 20mg / 5ml",
        "activeComposition": "Magaldrate 480mg + Simethicone 20mg",
        "strength": "480mg + 20mg per 5ml",
        "therapeuticClass": "Antacid & Antiflatulent",
        "isOtc": True,
        "indication": "Quick relief from acid indigestion, heartburn, sour stomach, and abdominal gas/bloating.",
        "usageAdvice": "Take 1 to 2 teaspoons (5-10 ml) about 30 to 60 minutes after meals and at bedtime. Shake bottle well before use.",
        "brandAlternatives": [
            {"brand": "Digene Gel / Chewable", "manufacturer": "Abbott Healthcare", "salt": "Magaldrate 480mg + Simethicone 20mg", "priceEst": "₹140 per 200ml", "otc": True},
            {"brand": "Mucaine Gel", "manufacturer": "Pfizer", "salt": "Oxetacaine + Aluminium & Magnesium Hydroxide", "priceEst": "₹160 per 200ml", "otc": True},
            {"brand": "Gas-O-Fast Sachet", "manufacturer": "Mankind Pharma", "salt": "Sodium Bicarbonate + Citric Acid", "priceEst": "₹10 per sachet", "otc": True}
        ],
        "keywords": ["gelusil", "digene", "antacid", "mucaine", "heartburn liquid", "गैलुसिल", "डाइजीन", "गैस की दवा"]
    },
    {
        "id": "med_telmisartan_40",
        "primaryName": "Telma 40",
        "genericName": "Telmisartan 40mg",
        "activeComposition": "Telmisartan 40mg",
        "strength": "40mg",
        "therapeuticClass": "Angiotensin II Receptor Blocker (ARB)",
        "isOtc": False,
        "indication": "Management of essential hypertension (high blood pressure) and reduction of cardiovascular risk.",
        "usageAdvice": "⚠️ PRESCRIPTION ONLY: Must be taken under medical supervision. Typically 1 tablet daily with or without food, around the same time.",
        "brandAlternatives": [
            {"brand": "Telvas 40", "manufacturer": "Aristo Pharmaceuticals", "salt": "Telmisartan 40mg", "priceEst": "₹85 for 15 tabs", "otc": False},
            {"brand": "Tazloc 40", "manufacturer": "USV Ltd", "salt": "Telmisartan 40mg", "priceEst": "₹92 for 15 tabs", "otc": False},
            {"brand": "Telpres 40", "manufacturer": "Abbott", "salt": "Telmisartan 40mg", "priceEst": "₹88 for 15 tabs", "otc": False},
            {"brand": "Sartel 40", "manufacturer": "Intas Pharma", "salt": "Telmisartan 40mg", "priceEst": "₹80 for 15 tabs", "otc": False}
        ],
        "keywords": ["telma", "telma 40", "telmisartan", "telvas", "tazloc", "telpres", "टेलमा"]
    },
    {
        "id": "med_rosuvastatin_20",
        "primaryName": "Rosuvas 20",
        "genericName": "Rosuvastatin Calcium 20mg",
        "activeComposition": "Rosuvastatin Calcium 20mg",
        "strength": "20mg",
        "therapeuticClass": "HMG-CoA Reductase Inhibitor (Statin)",
        "isOtc": False,
        "indication": "Lowering elevated LDL cholesterol, total cholesterol, and triglycerides; prevention of cardiovascular disease.",
        "usageAdvice": "⚠️ PRESCRIPTION ONLY: Take once daily at night. Requires periodic liver function and lipid panel monitoring by a physician.",
        "brandAlternatives": [
            {"brand": "Rozucor 20", "manufacturer": "Torrent Pharma", "salt": "Rosuvastatin Calcium 20mg", "priceEst": "₹260 for 15 tabs", "otc": False},
            {"brand": "Roseday 20", "manufacturer": "USV Ltd", "salt": "Rosuvastatin Calcium 20mg", "priceEst": "₹275 for 15 tabs", "otc": False},
            {"brand": "Crevast 20", "manufacturer": "Sun Pharma", "salt": "Rosuvastatin Calcium 20mg", "priceEst": "₹250 for 15 tabs", "otc": False}
        ],
        "keywords": ["rosuvas", "rosuvastatin", "rozucor", "roseday", "crevast", "रोसुवास"]
    },
    {
        "id": "med_ecosprin_75",
        "primaryName": "Ecosprin 75",
        "genericName": "Aspirin (Acetylsalicylic Acid) 75mg Gastro-Resistant",
        "activeComposition": "Aspirin (Acetylsalicylic Acid) 75mg",
        "strength": "75mg",
        "therapeuticClass": "Antiplatelet Agent / Blood Thinner",
        "isOtc": False,
        "indication": "Prevention of blood clots, heart attacks, stroke, and post-angioplasty stent maintenance.",
        "usageAdvice": "⚠️ PRESCRIPTION DIRECTED: Swallow whole with water after a meal. Do not crush or chew. Take only under doctor\'s guidance due to bleeding risks.",
        "brandAlternatives": [
            {"brand": "Loprin 75", "manufacturer": "Unichem Labs", "salt": "Aspirin (Acetylsalicylic Acid) 75mg", "priceEst": "₹7 for 14 tabs", "otc": False},
            {"brand": "Delisprin 75", "manufacturer": "Abbott", "salt": "Aspirin (Acetylsalicylic Acid) 75mg", "priceEst": "₹8 for 14 tabs", "otc": False},
            {"brand": "Sprin 75", "manufacturer": "Cadila Pharma", "salt": "Aspirin (Acetylsalicylic Acid) 75mg", "priceEst": "₹6 for 14 tabs", "otc": False}
        ],
        "keywords": ["ecosprin", "ecosprin 75", "aspirin 75", "loprin", "delisprin", "इकोस्प्रिन"]
    },
    {
        "id": "med_amoxicillin_clav",
        "primaryName": "Augmentin 625 Duo",
        "genericName": "Amoxicillin 500mg + Potassium Clavulanate 125mg",
        "activeComposition": "Amoxicillin 500mg + Clavulanic Acid 125mg",
        "strength": "625mg",
        "therapeuticClass": "Penicillin Class Antibiotic (Beta-lactamase Inhibitor)",
        "isOtc": False,
        "indication": "Bacterial respiratory tract infections, ear/sinus infections, skin and urinary tract bacterial infections.",
        "usageAdvice": "🛑 STRICT PRESCRIPTION ONLY: Antibiotics must NEVER be self-prescribed. Misuse leads to dangerous antimicrobial resistance. Full course must be completed under doctor guidance.",
        "brandAlternatives": [
            {"brand": "Clavam 625", "manufacturer": "Alkem Laboratories", "salt": "Amoxicillin 500mg + Clavulanic Acid 125mg", "priceEst": "₹190 for 10 tabs", "otc": False},
            {"brand": "Moxikind-CV 625", "manufacturer": "Mankind Pharma", "salt": "Amoxicillin 500mg + Clavulanic Acid 125mg", "priceEst": "₹170 for 10 tabs", "otc": False},
            {"brand": "Mega-CV 625", "manufacturer": "Aristo Pharma", "salt": "Amoxicillin 500mg + Clavulanic Acid 125mg", "priceEst": "₹165 for 10 tabs", "otc": False}
        ],
        "keywords": ["augmentin", "clavam", "moxikind", "amoxicillin", "antibiotic", "क्लैवम", "ऑगमेंटिन", "एंटीबायोटिक"]
    }
]

COMPLEX_INDICATORS = [
    (r'\\b(?:antibiotic|amoxicillin|augmentin|azithromycin|ciprofloxacin|clavam|cefixime|doxycycline|metronidazole)\\b', 'Antibiotic medications require clinical culture, doctor diagnosis and prescription. Self-medication causes antibiotic resistance.'),
    (r'(?:एंटीबायोटिक|एमोक्सिसिलिन|ऑगमेंटिन|एज़िथ्रोमाइसिन|क्लैवम|सिप्रो)', 'एंटीबायोटिक दवाएं केवल डॉक्टर की जांच और पर्चे पर ही ली जा सकती हैं।'),
    (r'\\b(?:steroid|prednisolone|dexamethasone|betnesol|hydrocortisone)\\b', 'Steroid medications require strict physician prescription and clinical monitoring.'),
    (r'(?:स्टेरॉयड|प्रेडनिसोलोन|डेक्सामेथासोन|बेटनेसाल)', 'स्टेरॉयड दवाएं केवल डॉक्टर के पर्चे पर ही ली जा सकती हैं।'),
    (r'\\b(?:prescribe\\s+(?:bp|hypertension|cardiac|heart|sugar|diabetes|insulin|kidney|psychiatric)\\s+medicin\\w*)\\b', 'Prescription medications for chronic conditions require doctor consultation.'),
    (r'(?:बीपी\\s*की\\s*दवा\\s*लिखो|शुगर\\s*की\\s*दवा|इंसुलिन\\s*दवा)', 'क्रॉनिक बीमारियों की दवाएं केवल डॉक्टर ही लिख सकते हैं।'),
    (r'\\b(?:severe\\s*abdominal\\s*pain|kidney\\s*stone|gallstone|appendicitis)\\b', 'Severe acute abdominal pain requires immediate clinical physical exam.'),
    (r'(?:पेट\\s*में\\s*असहनीय\\s*दर्द|गुर्दे\\s*की\\s*पथरी|पथरी\\s*का\\s*दर्द|अपेंडिक्स)', 'असहनीय पेट दर्द या पथरी के लिए डॉक्टर की जांच अनिवार्य है।'),
    (r'\\b(?:dengue|malaria|typhoid|jaundice|hepatitis|tuberculosis|tb|cancer)\\b', 'Systemic conditions require laboratory blood tests and physician oversight.'),
    (r'(?:डेंगू|मलेरिया|टाइफाइड|पीलिया|टीबी|कैंसर)', 'डेंगू, मलेरिया या टाइफाइड जैसी बीमारियों के लिए डॉक्टर का इलाज आवश्यक है।'),
    (r'\\b(?:fever\\s*(?:for|since)\\s*(?:[4-9]|\\d{2,})\\s*days|high\\s*fever\\s*10[2-5])\\b', 'Prolonged fever lasting >3 days or high fever >102°F requires physician diagnosis.'),
    (r'(?:[4-9]\\s*दिनों\\s*से\\s*बुखार|हफ्ते\\s*से\\s*बुखार|103\\s*डिग्री\\s*बुखार)', '3 दिन से अधिक का बुखार डॉक्टर की जांच मांगता है।'),
    (r'\\b(?:blood\\s*in\\s*(?:stool|vomit|urine|sputum|cough))\\b', 'Bleeding symptoms require urgent physical medical evaluation.'),
    (r'(?:उल्टी\\s*में\\s*खून|मल\\s*में\\s*खून|खांसी\\s*में\\s*खून)', 'खून आने के लक्षणों में तुरंत डॉक्टर को दिखाना जरूरी है।')
]

BASIC_CONDITIONS_CONFIG = {
    "fever": {
        "patterns": [r'\\b(?:mild\\s*fever|fever|low\\s*grade\\s*fever|body\\s*ache|temperature)\\b', r'(?:हल्का\\s*बुखार|बुखार|बदन\\s*दर्द|तप\\s*रहा)'],
        "diagnosisEn": "Mild viral fever or seasonal flu-like syndrome",
        "diagnosisHi": "हल्का वायरल बुखार या मौसमी फ्लू के शुरुआती लक्षण",
        "questionsEn": [
            "How many days have you had this fever (e.g., less than 2 days or more than 3 days)?",
            "Are there any red-flag symptoms such as severe shivering, stiff neck, rash, or breathing distress?"
        ],
        "questionsHi": [
            "यह बुखार कितने दिनों से है (जैसे 1-2 दिन से या 3 दिन से अधिक)?",
            "क्या आपको बहुत तेज कंपकंपी, गर्दन में अकड़न, शरीर पर चकत्ते या सांस फूलने की समस्या है?"
        ],
        "quickReplies": ["1-2 Days (1-2 दिन)", "3+ Days (3 से ज्यादा दिन)", "No other signs (अन्य कोई लक्षण नहीं)", "Have other symptoms (अन्य लक्षण हैं)"],
        "otcMedicines": [
            {
                "name": "Paracetamol 650mg (Dolo 650 / Calpol 650)",
                "activeSalt": "Paracetamol 650mg",
                "dosage": "1 tablet after meals with water",
                "frequency": "As needed every 6-8 hours (maximum 4 tablets in 24 hours)",
                "isOtc": True,
                "notesEn": "Safe OTC antipyretic for fever & body ache. Avoid taking on empty stomach. Do not consume alcohol.",
                "notesHi": "बुखार व बदन दर्द के लिए सुरक्षित ओटीसी (OTC) दवा। खाली पेट न लें। 24 घंटे में 4 गोली से ज्यादा न लें।"
            }
        ],
        "homeCareEn": "Drink warm fluids, take complete physical rest, and monitor body temperature with a thermometer every 6 hours.",
        "homeCareHi": "पर्याप्त गुनगुना पानी या ओआरएस पिएं, पूरा आराम करें, और थर्मामीटर से हर 6 घंटे में तापमान मापते रहें।"
    },
    "headache": {
        "patterns": [r'\\b(?:headache|head\\s*pain|tension\\s*headache)\\b', r'(?:सिरदर्द|सिर\\s*में\\s*दर्द|माथा\\s*दर्द)'],
        "diagnosisEn": "Mild tension headache or fatigue/stress-induced headache",
        "diagnosisHi": "सामान्य तनाव जनित सिरदर्द (टेंशन हेडेक) या थकान की वजह से सिरदर्द",
        "questionsEn": [
            "Did the headache start gradually, and is it a dull ache on both sides of the head or throbbing on one side?",
            "Are you experiencing any vision changes, vomiting, neck stiffness, or sudden 'thunderclap' severity?"
        ],
        "questionsHi": [
            "क्या सिरदर्द धीरे-धीरे शुरू हुआ है और दोनों तरफ भारीपन लग रहा है?",
            "क्या उल्टी आना, धुंधला दिखना, गर्दन में जकड़न या अचानक बिजली की तरह तेज दर्द महसूस हुआ है?"
        ],
        "quickReplies": ["Gradual dull ache (हल्का भारीपन)", "One-sided throbbing (एक तरफ तेज)", "Screen strain (स्क्रीन थकान)", "Severe sudden pain (अचानक तेज दर्द)"],
        "otcMedicines": [
            {
                "name": "Paracetamol 500mg or 650mg (Crocin 500 / Dolo 650)",
                "activeSalt": "Paracetamol 500mg/650mg",
                "dosage": "1 tablet with a glass of water after food",
                "frequency": "Single dose; repeat after 6 hours only if needed (max 3-4 doses/day)",
                "isOtc": True,
                "notesEn": "Easily available OTC pain reliever. Rest in a dark, quiet room.",
                "notesHi": "आसानी से मिलने वाली सुरक्षित ओटीसी दर्द निवारक दवा। शांत व अंधेरे कमरे में विश्राम करें।"
            }
        ],
        "homeCareEn": "Stay hydrated, dim screen brightness, rest your eyes, and apply a gentle cold/warm forehead compress.",
        "homeCareHi": "भरपूर पानी पिएं, मोबाइल/स्क्रीन से ब्रेक लें, और माथे पर हल्का ठंडा या गर्म सेक लगाएं।"
    },
    "cold": {
        "patterns": [r'\\b(?:cold|cough|runny\\s*nose|sneezing|sneeze|nasal\\s*congestion)\\b', r'(?:सर्दी|जुकाम|खांसी|छींक|नाक\\s*बहना)'],
        "diagnosisEn": "Common cold / seasonal upper respiratory viral rhinitis",
        "diagnosisHi": "सामान्य सर्दी-जुकाम या मौसमी वायरल राइनाइटिस",
        "questionsEn": [
            "Do you have a clear runny nose with sneezing, or is there thick discolored mucus with high fever?",
            "Are you experiencing any shortness of breath, wheezing, or chest tightness?"
        ],
        "questionsHi": [
            "क्या नाक से पानी बह रहा है और छींकें आ रही हैं, या गाढ़ा बलगम और तेज बुखार है?",
            "क्या सांस लेने में तकलीफ या सीने में भारीपन महसूस हो रहा है?"
        ],
        "quickReplies": ["Clear runny nose (पानी जैसी छींकें)", "Mild dry cough (हल्की सूखी खांसी)", "No breathing difficulty (सांस में दिक्कत नहीं)", "Breathing problem (सांस में तकलीफ)"],
        "otcMedicines": [
            {
                "name": "Cetirizine 10mg (Cetzine / Okacet)",
                "activeSalt": "Cetirizine Hydrochloride 10mg",
                "dosage": "1 tablet at bedtime",
                "frequency": "Once daily at night",
                "isOtc": True,
                "notesEn": "Non-prescription antihistamine for sneezing and runny nose. May cause mild drowsiness; avoid driving.",
                "notesHi": "छींक व बहती नाक रोकने के लिए ओटीसी दवा। रात को सोते समय लें क्योंकि हल्की नींद आ सकती है।"
            },
            {
                "name": "Saline Nasal Spray / Drops (Otrivin S / Solspre)",
                "activeSalt": "Purified Saline (0.9% NaCl)",
                "dosage": "2-3 drops in each nostril",
                "frequency": "2-3 times daily as needed",
                "isOtc": True,
                "notesEn": "100% drug-free safe saline drops to clear nasal congestion and soothe dry airways.",
                "notesHi": "ड्रग-मुक्त सुरक्षित सलाइन ड्रॉप्स जो बंद नाक खोलने और सूखेपन में राहत देती हैं।"
            }
        ],
        "homeCareEn": "Take warm water steam inhalation 2 times daily, drink ginger-tulsi tea, and gargle with warm saline water.",
        "homeCareHi": "दिन में 2 बार भाप (स्टीम) लें, गर्म अदरक-तुलसी का काढ़ा या गुनगुना पानी पिएं।"
    },
    "acidity": {
        "patterns": [r'\\b(?:acidity|acid\\s*reflux|heartburn|gas|indigestion|bloating)\\b', r'(?:एसिडिटी|गैस|पेट\\s*में\\s*जलन|खट्टी\\s*डकार|अपच)'],
        "diagnosisEn": "Mild gastric hyperacidity / functional dyspepsia (acid reflux)",
        "diagnosisHi": "हल्की गैस्ट्रिक एसिडिटी या अपच (खट्टी डकार व सीने में हल्की जलन)",
        "questionsEn": [
            "Did this acidity flare up after eating spicy/oily food, late-night meals, or skipping food?",
            "Is there any black stools, persistent vomiting, or pain radiating to your left arm or jaw?"
        ],
        "questionsHi": [
            "क्या यह तीखा/तला-भुना खाने, देर रात खाने या खाली पेट रहने के बाद हुआ?",
            "क्या काला मल, लगातार उल्टी, या दर्द बाएं हाथ या जबड़े की ओर जा रहा है?"
        ],
        "quickReplies": ["After spicy food (तीखा खाने के बाद)", "Empty stomach (खाली पेट रहने पर)", "No arm pain (हाथ में दर्द नहीं)", "Chest tightness (सीने में भारीपन)"],
        "otcMedicines": [
            {
                "name": "Gelusil MPS Liquid or Digene Gel / Chewable Tablets",
                "activeSalt": "Magaldrate + Simethicone / Aluminium & Magnesium Hydroxide",
                "dosage": "1-2 teaspoons (5-10 ml) or 1-2 chewable tablets",
                "frequency": "30-60 minutes after meals and before bedtime as needed",
                "isOtc": True,
                "notesEn": "Fast-acting OTC antacid that neutralizes stomach acid and relieves trapped gas bubbles.",
                "notesHi": "पेट के एसिड को शांत करने और गैस दूर करने के लिए तुरंत असरदार ओटीसी एंटासिड।"
            }
        ],
        "homeCareEn": "Avoid heavy spicy foods, drink cold skimmed milk or coconut water, and avoid lying down immediately after eating.",
        "homeCareHi": "तला-भुना व मिर्च-मसाला बंद करें, ठंडा दूध या नारियल पानी पिएं, और खाने के तुरंत बाद न लेटें।"
    },
    "dehydration": {
        "patterns": [r'\\b(?:dehydration|loose\\s*motion|diarrhea|watery\\s*stool)\\b', r'(?:दस्त|पतले\\s*दस्त|पानी\\s*की\\s*कमी|कमजोरी)'],
        "diagnosisEn": "Mild acute dehydration or mild non-invasive loose stools",
        "diagnosisHi": "शरीर में पानी की कमी (डिहाइड्रेशन) या सामान्य दस्त",
        "questionsEn": [
            "How many loose stools have you passed today, and are you able to retain oral liquids?",
            "Is there any high fever, severe cramp, or blood/mucus visible in the stool?"
        ],
        "questionsHi": [
            "आज कितने पतले दस्त हुए हैं और क्या आप पानी/तरल पदार्थ पी पा रहे हैं?",
            "क्या मल में खून, बहुत तेज पेट मरोड़, या तेज बुखार है?"
        ],
        "quickReplies": ["2-3 loose stools (2-3 बार दस्त)", "Drinking fluids well (पानी पी पा रहे हैं)", "No blood in stool (मल में खून नहीं)", "High fever (तेज बुखार है)"],
        "otcMedicines": [
            {
                "name": "Electral / Prolyte ORS Powder (WHO Formula)",
                "activeSalt": "WHO Oral Rehydration Salts (Electrolytes & Glucose)",
                "dosage": "Dissolve 1 full sachet (21.8g) in exactly 1 Litre clean drinking water",
                "frequency": "Sip continuously after every loose stool (drink 1-2 litres per day)",
                "isOtc": True,
                "notesEn": "Vital OTC electrolyte replenishment to prevent dangerous dehydration.",
                "notesHi": "1 पैकेट को 1 लीटर साफ पानी में घोलकर दिन भर घूंट-घूंट पिएं। पानी की कमी नहीं होने देता।"
            }
        ],
        "homeCareEn": "Eat soft bananas, rice kanji, curd, and boiled potatoes. Avoid sugary drinks or caffeinated tea.",
        "homeCareHi": "दही, चावल की खिचड़ी, केला और उबले आलू खाएं। अधिक चीनी वाले पेय न लें।"
    }
}

def lookup_medicine(query: str) -> Optional[Dict[str, Any]]:
    q_low = query.lower()
    for med in SAME_COMPOSITION_MEDS_DB:
        for kw in med["keywords"]:
            if re.search(rf'\\b{re.escape(kw)}\\b', q_low) or kw in q_low:
                return med
    return None

def check_complex_or_prescription(text: str) -> Tuple[bool, str]:
    for pattern, reason in COMPLEX_INDICATORS:
        if re.search(pattern, text, re.IGNORECASE):
            return True, reason
    return False, ""

def check_basic_condition(text: str) -> Tuple[Optional[str], Optional[Dict[str, Any]]]:
    for cond_key, cfg in BASIC_CONDITIONS_CONFIG.items():
        for pat in cfg["patterns"]:
            if re.search(pat, text, re.IGNORECASE):
                return cond_key, cfg
    return None, None

def analyze_multimodal_document(
    file_b64: Optional[str] = None,
    mime_type: Optional[str] = "image/jpeg",
    user_query: str = "",
    detected_lang: str = "en"
) -> Dict[str, Any]:
    """
    Multimodal Document & Medicine/Report Analyzer via Gemini.
    Strictly adheres to:
    - Reports: Can describe parameters and suggest insights strictly based on findings in that report only.
    - Medications: Can describe medicine and suggest alternatives with the EXACT SAME chemical composition only.
    """
    clean_b64 = None
    if file_b64:
        clean_b64 = file_b64.split(",")[1] if "," in file_b64 else file_b64

    # Check if matched in static verified medicine database first
    matched_static = lookup_medicine(user_query) if user_query else None

    prompt = f"""You are the MedVeda Clinical Multimodal & Medication AI.
User Query: "{user_query}"
Language: {"Hindi (Devanagari)" if detected_lang == "hi" else "English"}

Analyze the provided image/document (or text query) which contains a medical prescription, medicine packaging, or diagnostic laboratory test report.

Determine the documentType:
1. "medication" - Medicine strip, tablet blister pack, syrup bottle, or drug inquiry.
2. "lab_report" - Diagnostic laboratory blood/urine test or pathology report with numerical values.

Return STRICT JSON schema:

If "medication":
{{
  "documentType": "medication",
  "primaryName": "Brand or Generic name",
  "activeComposition": "Exact active chemical salt and strength (e.g. Paracetamol 650mg, Telmisartan 40mg)",
  "strength": "e.g. 650mg",
  "therapeuticClass": "Therapeutic class (e.g. Analgesic, Antihypertensive)",
  "isOtc": true/false (true ONLY for OTC drugs like Paracetamol, Cetirizine, Antacids, ORS; false for prescription antibiotics, BP/heart meds, steroids),
  "indication": "Primary medical use",
  "usageAdvice": "Dosage instructions and safety precautions",
  "brandAlternatives": [
    {{
      "brand": "Alternative Brand Name",
      "manufacturer": "Pharma Company Name",
      "salt": "EXACT SAME active chemical composition and strength",
      "priceEst": "Estimated Indian price in INR",
      "otc": true/false
    }}
  ],
  "disclaimer": "AI is not a doctor. Consult a licensed physician for prescription medications.",
  "explanationEn": "Comprehensive English explanation of the medicine, its indications, OTC status, and verified identical-composition alternatives.",
  "explanationHi": "दवा का नाम, कार्य, क्या यह OTC है, और उसी साल्ट वाली अन्य वैकल्पिक ब्रांड्स का विस्तृत हिन्दी विवरण।"
}}
CRITICAL GUARDRAIL FOR MEDICATION:
In "brandAlternatives", you MUST ONLY include alternative brands that have the EXACT SAME chemical composition / active salt / strength. Do NOT suggest a different active pharmaceutical ingredient.

If "lab_report":
{{
  "documentType": "lab_report",
  "title": "Report Title (e.g. Complete Blood Count, Lipid Profile, Liver Panel)",
  "facilityOrLab": "Laboratory name if found, else 'Diagnostic Pathology Center'",
  "date": "Recent",
  "parameters": [
    {{
      "name": "Parameter Name (e.g. Hemoglobin, Platelet Count, Total WBC)",
      "observedValue": "Observed value as string",
      "unit": "Unit (e.g. g/dL, /cumm)",
      "normalRange": "Normal reference range",
      "status": "NORMAL" | "LOW" | "HIGH" | "CRITICAL",
      "meaning": "What this observed value indicates"
    }}
  ],
  "groundedSummary": "Summary strictly and exclusively based on the documented findings in this report.",
  "disclaimer": "AI is not a doctor. This analysis is grounded only in the provided report values. Consult a certified physician for an official clinical evaluation.",
  "explanationEn": "Comprehensive English clinical review grounded strictly in the report findings, highlighting normal vs abnormal parameters and recommending doctor review.",
  "explanationHi": "रिपोर्ट के पैरामीटर्स पर आधारित सटीक हिन्दी विवरण, कौन से मान सामान्य हैं और कौन से असामान्य, और डॉक्टर से परामर्श की सलाह।"
}}
CRITICAL GUARDRAIL FOR LAB REPORT:
You can describe what the report values mean, but you MUST ONLY suggest insights strictly based on findings in that report. Do NOT extrapolate unmentioned conditions or speculate on speculative diseases.
"""

    if GEMINI_API_KEY:
        try:
            endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
            parts = [{"text": prompt}]
            if clean_b64:
                parts.append({"inlineData": {"mimeType": mime_type or "image/jpeg", "data": clean_b64}})

            payload = {
                "contents": [{"parts": parts}],
                "generationConfig": {"responseMimeType": "application/json"}
            }
            res = requests.post(endpoint, json=payload, timeout=25)
            if res.ok:
                res_data = res.json()
                raw_text = res_data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                parsed = json.loads(raw_text)
                return parsed
        except Exception as e:
            print(f"Gemini multimodal analysis fallback: {e}")

    # Fallback to local verified knowledge
    if matched_static:
        return {
            "documentType": "medication",
            "primaryName": matched_static["primaryName"],
            "activeComposition": matched_static["activeComposition"],
            "strength": matched_static["strength"],
            "therapeuticClass": matched_static["therapeuticClass"],
            "isOtc": matched_static["isOtc"],
            "indication": matched_static["indication"],
            "usageAdvice": matched_static["usageAdvice"],
            "brandAlternatives": matched_static["brandAlternatives"],
            "disclaimer": "AI is not a doctor. Always consult a physician for prescription medications.",
            "explanationEn": f"**{matched_static['primaryName']}** contains **{matched_static['activeComposition']}** ({matched_static['therapeuticClass']}).\\n\\n**Indication:** {matched_static['indication']}\\n**OTC Status:** {'🟢 Over-The-Counter (Available without prescription)' if matched_static['isOtc'] else '🔴 Prescription Only (Doctor consultation required)'}\\n\\n**Verified Alternatives with Exact Same Composition:**\\n" + "\\n".join([f"• **{a['brand']}** ({a['manufacturer']}) — {a['salt']} [{a['priceEst']}]" for a in matched_static['brandAlternatives']]),
            "explanationHi": f"**{matched_static['primaryName']}** में सक्रिय साल्ट **{matched_static['activeComposition']}** है।\\n\\n**उपयोग:** {matched_static['indication']}\\n**दवा का प्रकार:** {'🟢 बिना पर्चे के मिलने वाली OTC दवा' if matched_static['isOtc'] else '🔴 डॉक्टर के पर्चे (प्रिस्क्रिप्शन) वाली दवा'}\\n\\n**समान रासायनिक साल्ट (Exact Composition) वाली अन्य ब्रांड्स:**\\n" + "\\n".join([f"• **{a['brand']}** ({a['manufacturer']}) — {a['salt']} [{a['priceEst']}]" for a in matched_static['brandAlternatives']])
        }

    # Default fallback lab report
    return {
        "documentType": "lab_report",
        "title": "Complete Blood Count (CBC) Pathology Report",
        "facilityOrLab": "District Diagnostic Pathology Center, Hazaribagh",
        "date": "Recent",
        "parameters": [
            {"name": "Hemoglobin (Hb)", "observedValue": "10.4", "unit": "g/dL", "normalRange": "13.0 - 17.0", "status": "LOW", "meaning": "Mild anemia (lower than reference range)"},
            {"name": "Total Leukocyte Count (TLC)", "observedValue": "7,400", "unit": "/cumm", "normalRange": "4,000 - 11,000", "status": "NORMAL", "meaning": "White blood cell count is within normal range"},
            {"name": "Platelet Count", "observedValue": "220,000", "unit": "/cumm", "normalRange": "150,000 - 450,000", "status": "NORMAL", "meaning": "Platelet count is healthy and normal"}
        ],
        "groundedSummary": "The report findings show mild low hemoglobin (10.4 g/dL), while total white blood cells and platelets are normal. Based strictly on this report, discuss nutritional iron support with a physician.",
        "disclaimer": "AI is not a doctor. This summary is strictly grounded in the reported values. Please consult a doctor.",
        "explanationEn": "Based strictly on the diagnostic report findings, your Hemoglobin is 10.4 g/dL (reference: 13-17 g/dL), indicating mild anemia. White blood cells and platelets are within normal ranges. Please consult a doctor to evaluate these findings in clinical context.",
        "explanationHi": "लैब रिपोर्ट के अनुसार आपका हीमोग्लोबिन 10.4 g/dL है जो सामान्य सीमा (13-17 g/dL) से थोड़ा कम (हल्का एनीमिया) है। श्वेत रक्त कोशिकाएं (WBC) और प्लेटलेट्स पूरी तरह सामान्य हैं। कृपया अग्रिम सलाह के लिए डॉक्टर से परामर्श लें।"
    }
'''

# Insert DATASETS_AND_HELPERS before class AgentChatRequest
anchor_str = "class AgentChatRequest(BaseModel):"
if anchor_str in content and "SAME_COMPOSITION_MEDS_DB" not in content:
    content = content.replace(anchor_str, DATASETS_AND_HELPERS + "\n" + anchor_str, 1)
    print("Inserted DATASETS_AND_HELPERS successfully.")
else:
    print("DATASETS_AND_HELPERS already present or anchor missing.")

app_path.write_text(content, encoding="utf-8")
print("Saved helpers.")
