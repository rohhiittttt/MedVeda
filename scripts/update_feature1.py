import os

component_code = '''// ==========================================
// --- FEATURE 01: SMART CARE NAVIGATOR (END-TO-END 3-AGENT PIPELINE) ---
// Specification Reference: docs/symptomsIntake.md, docs/featureHospitalSearch.md, docs/recommendationengine.md, docs/fdesign.md
// ==========================================

// --- Inline Accessible SVG Icons (Zero Lucide Icon Dependencies) ---
function NavPhoneIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

function NavDirectionsIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="3 11 22 2 13 21 11 13 3 11" />
    </svg>
  );
}

function NavVerifiedBadgeIcon({ className = "w-4 h-4 text-emerald-600" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function NavMapPinIcon({ className = "w-4 h-4 text-slate-500" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function NavMicIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function NavHospitalIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 21h18" />
      <path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
      <path d="M9 10h6" />
      <path d="M12 7v6" />
    </svg>
  );
}

function SmartCareNavigatorApp({ onExploreFeatures }) {
  // Step: 1 (Symptoms) | 2 (Baseline) | 3 (Clarification) | 4 (Location) | 5 (Recommendations)
  const [step, setStep] = useState(1);
  const [testMode, setTestMode] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState(null);

  // Step 1 State: Symptoms
  const [rawSymptoms, setRawSymptoms] = useState('Severe sudden chest tightness radiating to the left arm and sweating for 2 hours.');
  const [isListening, setIsListening] = useState(false);

  // Step 2 State: Baseline Demographics
  const [relationship, setRelationship] = useState('self');
  const [age, setAge] = useState(58);
  const [biologicalSex, setBiologicalSex] = useState('male');
  const [durationValue, setDurationValue] = useState(2);
  const [durationUnit, setDurationUnit] = useState('hours');
  const [onset, setOnset] = useState('sudden');
  const [reportedSeverity, setReportedSeverity] = useState('severe');
  const [historyTags, setHistoryTags] = useState(['High Blood Pressure', 'Diabetes']);

  // Step 3 State: Clarification
  const [sessionId, setSessionId] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedOptionId, setSelectedOptionId] = useState(null);
  const [customAnswerText, setCustomAnswerText] = useState('');
  const [isCustomAnswer, setIsCustomAnswer] = useState(false);
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const [canCompleteEarly, setCanCompleteEarly] = useState(false);

  // Step 4 State: Location
  const [locationType, setLocationType] = useState('gps');
  const [latitude, setLatitude] = useState(23.9925);
  const [longitude, setLongitude] = useState(85.3637);
  const [cityDistrict, setCityDistrict] = useState('Hazaribagh');
  const [stateName, setStateName] = useState('Jharkhand');
  const [isLocating, setIsLocating] = useState(false);

  // Step 5 State: Results & Recommendations
  const [phase4Intake, setPhase4Intake] = useState(null);
  const [hospitalSearchResults, setHospitalSearchResults] = useState(null);
  const [recommendationOutput, setRecommendationOutput] = useState(null);

  // Leaflet Map Reference
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  // URL Hash Sync for Back/Forward Navigation
  useEffect(() => {
    const handleHash = () => {
      const h = window.location.hash;
      if (h === '#/care/symptoms') setStep(1);
      else if (h === '#/care/baseline') setStep(2);
      else if (h === '#/care/clarification') setStep(3);
      else if (h === '#/care/location') setStep(4);
      else if (h === '#/care/recommendations') setStep(5);
    };
    window.addEventListener('popstate', handleHash);
    return () => window.removeEventListener('popstate', handleHash);
  }, []);

  const navigateToStep = (newStep) => {
    setStep(newStep);
    const routes = {
      1: '#/care/symptoms',
      2: '#/care/baseline',
      3: '#/care/clarification',
      4: '#/care/location',
      5: '#/care/recommendations'
    };
    if (routes[newStep]) {
      window.history.pushState(null, '', routes[newStep]);
    }
  };

  // Speech Recognition Handler
  const toggleSpeechRecognition = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in this browser. Please type your symptoms.');
      return;
    }
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRec();
    recognition.lang = 'en-IN';
    recognition.interimResults = false;

    if (isListening) {
      setIsListening(false);
      return;
    }

    setIsListening(true);
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setRawSymptoms((prev) => (prev ? `${prev} ${transcript}` : transcript));
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  // GPS Geolocation Handler
  const handleDetectGPS = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setLatitude(lat);
        setLongitude(lon);
        setLocationType('gps');

        try {
          const res = await fetch(`/api/v1/hospitals/geolocation/reverse?lat=${lat}&lon=${lon}`);
          if (res.ok) {
            const data = await res.json();
            setCityDistrict(data.city_district || 'Hazaribagh');
            setStateName(data.state || 'Jharkhand');
          }
        } catch (e) {
          // Keep current city
        }
        setIsLocating(false);
      },
      (err) => {
        setIsLocating(false);
        alert('Could not retrieve GPS location. Please verify your location text below.');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  // Step 1 Action -> Start Intake
  const handleStartIntake = async (e) => {
    e.preventDefault();
    if (!rawSymptoms.trim()) {
      alert('Please describe what symptoms you are experiencing.');
      return;
    }
    setLoading(true);
    setLoadingMessage('Analyzing reported symptoms against clinical guidelines...');
    setError(null);

    try {
      const res = await fetch('/api/v1/intake/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_text: rawSymptoms, input_modality: 'text' })
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      setSessionId(data.session_id);
      navigateToStep(2);
    } catch (err) {
      setError(`Failed to process symptoms: ${err.message}. Please retry.`);
    } finally {
      setLoading(false);
    }
  };

  // Step 2 Action -> Save Baseline & Fetch Question 1
  const handleSaveBaseline = async (e) => {
    e.preventDefault();
    if (!sessionId) return;
    setLoading(true);
    setLoadingMessage('Configuring clinical baseline and loading adaptive questions...');
    setError(null);

    try {
      const baselinePayload = {
        age: parseInt(age, 10),
        biological_sex: biologicalSex,
        symptom_duration_value: parseInt(durationValue, 10),
        symptom_duration_unit: durationUnit,
        onset_type: onset,
        self_reported_severity: reportedSeverity,
        location: `${cityDistrict}, ${stateName}`,
        medical_history: historyTags,
        reporting_for: relationship
      };

      const res = await fetch(`/api/v1/intake/${sessionId}/baseline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(baselinePayload)
      });
      if (!res.ok) throw new Error(`Baseline failed: ${res.status}`);

      // Fetch First Clarification Question
      const qRes = await fetch(`/api/v1/intake/${sessionId}/next-question`);
      if (!qRes.ok) throw new Error(`Question fetch failed: ${qRes.status}`);
      const qData = await qRes.json();

      setCurrentQuestion(qData.question);
      setSelectedOptionId(null);
      setCustomAnswerText('');
      setIsCustomAnswer(false);
      setQuestionsAnswered(qData.questions_asked_so_far || 0);
      setCanCompleteEarly(Boolean(qData.can_complete));

      navigateToStep(3);
    } catch (err) {
      setError(`Baseline error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Step 3 Action -> Submit Clarification Answer
  const handleSubmitAnswer = async () => {
    if (!sessionId || !currentQuestion) return;

    if (!isCustomAnswer && !selectedOptionId) {
      alert('Please select an option or choose to type your own explanation.');
      return;
    }
    if (isCustomAnswer && !customAnswerText.trim()) {
      alert('Please type your explanation.');
      return;
    }

    setLoading(true);
    setLoadingMessage('Evaluating your response and refining differential diagnosis...');
    setError(null);

    try {
      const answerPayload = isCustomAnswer
        ? {
            question_number: currentQuestion.question_number,
            answer_mode: 'free_text',
            free_text: customAnswerText
          }
        : {
            question_number: currentQuestion.question_number,
            answer_mode: 'option_selected',
            selected_option_id: selectedOptionId
          };

      const ansRes = await fetch(`/api/v1/intake/${sessionId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(answerPayload)
      });
      if (!ansRes.ok) throw new Error(`Answer error: ${ansRes.status}`);
      const ansData = await ansRes.json();

      setQuestionsAnswered(ansData.questions_answered_so_far || 0);
      setCanCompleteEarly(Boolean(ansData.can_complete_early));

      // If max questions reached or completed, proceed to location
      if (ansData.max_reached) {
        await handleFinishQuestions();
        return;
      }

      // Fetch Next Question
      const nextQRes = await fetch(`/api/v1/intake/${sessionId}/next-question`);
      if (nextQRes.ok) {
        const nextQData = await nextQRes.json();
        if (nextQData.status === 'ready_for_completion') {
          await handleFinishQuestions();
        } else {
          setCurrentQuestion(nextQData.question);
          setSelectedOptionId(null);
          setCustomAnswerText('');
          setIsCustomAnswer(false);
        }
      }
    } catch (err) {
      setError(`Failed to submit answer: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Step 3 Complete -> Finalize Phase 4
  const handleFinishQuestions = async () => {
    if (!sessionId) return;
    setLoading(true);
    setLoadingMessage('Finalizing clinical evaluation and determining required department...');
    setError(null);

    try {
      const compRes = await fetch(`/api/v1/intake/${sessionId}/complete`, { method: 'POST' });
      if (!compRes.ok) throw new Error(`Complete intake failed: ${compRes.status}`);
      const phase4 = await compRes.json();
      setPhase4Intake(phase4);
      navigateToStep(4);
    } catch (err) {
      setError(`Diagnostic completion error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Step 4 Action -> Discover & Rank Hospitals within 50 km (Agent 2 + Agent 3)
  const handleDiscoverAndRank = async () => {
    if (!phase4Intake) return;
    setLoading(true);
    setLoadingMessage('Scanning live healthcare registries within locked 50 km radius...');
    setError(null);

    try {
      // 1. Agent 2: Live Grounded Hospital Discovery
      const searchPayload = {
        session_id: sessionId,
        location: {
          latitude: latitude,
          longitude: longitude,
          manual_text: `${cityDistrict}, ${stateName}`
        },
        intake_assessment: {
          required_department: phase4Intake.required_department,
          care_setting: phase4Intake.care_setting,
          is_emergency: phase4Intake.is_emergency,
          severity: phase4Intake.severity
        },
        radius_km: 50
      };

      const searchRes = await fetch('/api/v1/hospitals/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(searchPayload)
      });
      if (!searchRes.ok) throw new Error(`Hospital search failed: ${searchRes.status}`);
      const searchOutput = await searchRes.json();
      setHospitalSearchResults(searchOutput);

      // 2. Agent 3: Multi-Criteria Clinical Scoring & Top 5 Ranking
      setLoadingMessage('Auditing 24x7 department capability and ranking top 5 closest facilities...');
      const recPayload = {
        session_id: sessionId,
        phase4_intake: phase4Intake,
        hospital_search_output: searchOutput
      };

      const recRes = await fetch('/api/v1/recommendations/rank-top5', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recPayload)
      });
      if (!recRes.ok) throw new Error(`Recommendation ranking failed: ${recRes.status}`);
      const recOutput = await recRes.json();
      setRecommendationOutput(recOutput);

      navigateToStep(5);
    } catch (err) {
      setError(`Facility discovery & ranking error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Step 5: Initialize Free OpenStreetMap Leaflet Map
  useEffect(() => {
    if (step === 5 && mapContainerRef.current && window.L && recommendationOutput) {
      const topHospitals = recommendationOutput.top_5_hospitals || [];
      const userLat = latitude || 23.9925;
      const userLon = longitude || 85.3637;

      // Clean up existing map instance if present
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      try {
        const map = window.L.map(mapContainerRef.current, {
          center: [userLat, userLon],
          zoom: 12,
          zoomControl: true,
          scrollWheelZoom: false
        });
        mapInstanceRef.current = map;

        // Free OpenStreetMap Tiles
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 18,
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        // Patient Location Pin (Blue Pulse Circle)
        const patientIcon = window.L.divIcon({
          className: 'patient-marker',
          html: `<div style="background:#0284c7;width:18px;height:18px;border-radius:50%;border:3px solid #ffffff;box-shadow:0 0 12px rgba(2,132,199,0.8);"></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9]
        });
        window.L.marker([userLat, userLon], { icon: patientIcon })
          .addTo(map)
          .bindPopup('<b>Your Current Location</b><br>Locked 50 km Catchment Center');

        // 50 km Boundary Dashed Circle
        window.L.circle([userLat, userLon], {
          radius: 50000,
          color: '#0b2b82',
          weight: 1.5,
          dashArray: '6, 6',
          fillColor: '#f0f7ff',
          fillOpacity: 0.08
        }).addTo(map);

        const bounds = [[userLat, userLon]];

        // Top 5 Hospital Pins
        topHospitals.forEach((h) => {
          const isRank1 = h.rank === 1;
          const pinColor = isRank1 ? '#0b2b82' : '#0284c7';
          const pinIcon = window.L.divIcon({
            className: 'hospital-marker',
            html: `<div style="background:${pinColor};color:#ffffff;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:12px;border:2px solid #ffffff;box-shadow:0 2px 6px rgba(0,0,0,0.3);">${h.rank}</div>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13]
          });

          const popupContent = `
            <div style="font-family:'Plus Jakarta Sans',sans-serif;padding:4px;min-width:180px;">
              <span style="font-size:10px;font-weight:800;color:${isRank1 ? '#0b2b82' : '#0284c7'};text-transform:uppercase;">Rank #${h.rank}</span>
              <h4 style="margin:2px 0 4px;font-size:13px;font-weight:800;color:#0f172a;">${h.name}</h4>
              <p style="margin:0 0 8px;font-size:11px;color:#475569;">${h.distance_display} · Approx. ${h.estimated_drive_time_mins} mins drive</p>
              <div style="display:flex;gap:4px;">
                <a href="${h.direct_call_url}" style="padding:4px 8px;background:#0b2b82;color:#ffffff;text-decoration:none;border-radius:6px;font-size:11px;font-weight:700;">Call Desk</a>
                <a href="${h.google_maps_url}" target="_blank" rel="noopener" style="padding:4px 8px;background:#f1f5f9;color:#0f172a;text-decoration:none;border-radius:6px;font-size:11px;font-weight:700;">Directions</a>
              </div>
            </div>
          `;

          window.L.marker([h.latitude, h.longitude], { icon: pinIcon })
            .addTo(map)
            .bindPopup(popupContent);

          bounds.push([h.latitude, h.longitude]);
        });

        map.fitBounds(bounds, { padding: [30, 30] });
      } catch (err) {
        console.warn('Leaflet map initialization warning:', err);
      }
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [step, recommendationOutput, latitude, longitude]);

  // Stepper Header Component
  const renderStepper = () => {
    const stepsConfig = [
      { num: 1, label: 'Symptoms' },
      { num: 2, label: 'Patient Profile' },
      { num: 3, label: 'Follow-Up' },
      { num: 4, label: 'Location' },
      { num: 5, label: 'Top 5 Hospitals' }
    ];

    return (
      <div className="w-full max-w-4xl mx-auto mb-8">
        <div className="flex items-center justify-between relative">
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-200 -translate-y-1/2 z-0" />
          {stepsConfig.map((s) => {
            const isCompleted = step > s.num;
            const isCurrent = step === s.num;
            return (
              <div key={s.num} className="relative z-10 flex flex-col items-center">
                <button
                  type="button"
                  disabled={s.num > step}
                  onClick={() => s.num < step && navigateToStep(s.num)}
                  className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all cursor-pointer ${
                    isCurrent
                      ? 'bg-[#0b2b82] text-white ring-4 ring-blue-100 shadow-sm'
                      : isCompleted
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-400 border border-slate-300'
                  }`}
                >
                  {isCompleted ? '✓' : s.num}
                </button>
                <span className={`text-[11px] font-semibold mt-1.5 hidden sm:block ${isCurrent ? 'text-[#0b2b82] font-bold' : 'text-slate-500'}`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-[85vh] bg-slate-50/60 py-6 sm:py-10 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        {/* Navigation & Mode Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Smart Care Navigator</h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Autonomous Clinical Triage & Top 5 Verified Facility Referral
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTestMode(!testMode)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer bg-white text-slate-700 border-slate-200 hover:bg-slate-100 shadow-xs"
            >
              {testMode ? '🔬 Live Testing: Active' : 'ℹ️ Standard Mode'}
            </button>
            <button
              type="button"
              onClick={onExploreFeatures}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              Back to Overview &rarr;
            </button>
          </div>
        </div>

        {/* Global Loading Spinner */}
        {loading && (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs my-6 space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full border-3 border-blue-200 border-t-[#0b2b82] animate-spin" />
            <h3 className="text-base font-bold text-slate-900">{loadingMessage}</h3>
            <p className="text-xs text-slate-500">Checking verified healthcare registries for active emergency wings...</p>
          </div>
        )}

        {/* Global Error Banner */}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs font-semibold text-red-700 mb-6 flex items-center justify-between">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} className="text-red-900 font-bold ml-4">
              Dismiss
            </button>
          </div>
        )}

        {/* Stepper Progression */}
        {!loading && renderStepper()}

        {/* PAGE 1: SYMPTOMS INTAKE */}
        {!loading && step === 1 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#0b2b82]">Step 1 of 5</span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">How can we help you feel better today?</h2>
              <p className="text-sm text-slate-600">
                Describe your symptoms in plain language. You don&rsquo;t need to use medical terms.
              </p>
            </div>

            <form onSubmit={handleStartIntake} className="space-y-5">
              <div className="relative">
                <textarea
                  rows={4}
                  value={rawSymptoms}
                  onChange={(e) => setRawSymptoms(e.target.value)}
                  placeholder="e.g. My chest feels very tight and I am sweating a lot. The pain started 2 hours ago..."
                  className="w-full p-4 rounded-xl border border-slate-200 focus:border-[#0284c7] focus:ring-3 focus:ring-blue-100 text-sm font-medium text-slate-800 placeholder-slate-400 outline-none transition-all resize-y"
                />
                <button
                  type="button"
                  onClick={toggleSpeechRecognition}
                  className={`absolute bottom-3 right-3 p-2.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
                    isListening
                      ? 'bg-red-500 text-white border-red-600 animate-pulse'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                  title="Speak Symptoms"
                >
                  <NavMicIcon className="w-4 h-4" />
                  <span>{isListening ? 'Listening...' : 'Speak'}</span>
                </button>
              </div>

              {/* Quick Sample Prompts */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-slate-500">Quick Clinical Examples:</span>
                <div className="flex flex-wrap gap-2">
                  {[
                    'Sudden facial droop, right arm weakness and slurred speech for 1 hour',
                    'Severe pressure in middle of chest spreading to left arm with sweating',
                    'Child has 103F fever, continuous cough and rapid breathing for 2 days',
                    'Severe lower right abdominal pain with nausea that started this morning'
                  ].map((sample, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setRawSymptoms(sample)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 transition-colors text-left"
                    >
                      &ldquo;{sample.slice(0, 48)}...&rdquo;
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end">
                <button
                  type="submit"
                  className="px-6 py-3 bg-[#0b2b82] hover:bg-[#071a4f] text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
                >
                  Analyze Symptoms & Continue &rarr;
                </button>
              </div>
            </form>
          </div>
        )}

        {/* PAGE 2: BASELINE PROFILE */}
        {!loading && step === 2 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#0b2b82]">Step 2 of 5</span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">Basic Patient Profile</h2>
              <p className="text-sm text-slate-600">
                Help us tailor recommendations to the patient&rsquo;s age and timing.
              </p>
            </div>

            <form onSubmit={handleSaveBaseline} className="space-y-5">
              {/* Relationship */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Who is this assessment for?</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'self', label: 'Myself' },
                    { id: 'child', label: 'My Child' },
                    { id: 'family_member', label: 'Elderly Relative' },
                    { id: 'other', label: 'Other' }
                  ].map((rel) => (
                    <button
                      key={rel.id}
                      type="button"
                      onClick={() => setRelationship(rel.id)}
                      className={`py-2 px-3 rounded-lg text-xs font-bold border text-center transition-all cursor-pointer ${
                        relationship === rel.id
                          ? 'bg-blue-50 text-[#0b2b82] border-blue-200 shadow-xs'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {rel.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Age and Sex */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Patient Age (Years)</label>
                  <input
                    type="number"
                    min="1"
                    max="110"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-800 outline-none focus:border-[#0284c7]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Biological Sex</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['male', 'female', 'other'].map((sx) => (
                      <button
                        key={sx}
                        type="button"
                        onClick={() => setBiologicalSex(sx)}
                        className={`py-2.5 rounded-lg text-xs font-bold border capitalize transition-all cursor-pointer ${
                          biologicalSex === sx
                            ? 'bg-blue-50 text-[#0b2b82] border-blue-200'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {sx}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Duration & Onset */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">When did symptoms start?</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      min="1"
                      value={durationValue}
                      onChange={(e) => setDurationValue(e.target.value)}
                      className="w-24 p-2.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-800 outline-none"
                    />
                    <select
                      value={durationUnit}
                      onChange={(e) => setDurationUnit(e.target.value)}
                      className="flex-1 p-2.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-800 outline-none bg-white"
                    >
                      <option value="minutes">Minutes ago</option>
                      <option value="hours">Hours ago</option>
                      <option value="days">Days ago</option>
                      <option value="weeks">Weeks ago</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700">Onset Manner</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'sudden', label: 'Sudden / Sharp' },
                      { id: 'gradual', label: 'Gradual / Slow' }
                    ].map((on) => (
                      <button
                        key={on.id}
                        type="button"
                        onClick={() => setOnset(on.id)}
                        className={`py-2.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          onset === on.id
                            ? 'bg-blue-50 text-[#0b2b82] border-blue-200'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {on.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Prior Medical Conditions */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Prior Medical History (Optional)</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    'High Blood Pressure',
                    'Diabetes',
                    'Heart Disease',
                    'Asthma / COPD',
                    'Previous Stroke',
                    'Kidney Disease'
                  ].map((tag) => {
                    const isChecked = historyTags.includes(tag);
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          setHistoryTags((prev) =>
                            isChecked ? prev.filter((t) => t !== tag) : [...prev, tag]
                          );
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                          isChecked
                            ? 'bg-[#0b2b82] text-white border-[#0b2b82]'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {isChecked ? `✓ ${tag}` : `+ ${tag}`}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => navigateToStep(1)}
                  className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  &larr; Back to Symptoms
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-[#0b2b82] hover:bg-[#071a4f] text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
                >
                  Proceed to Follow-up Questions &rarr;
                </button>
              </div>
            </form>
          </div>
        )}

        {/* PAGE 3: CLARIFICATION QUESTIONS */}
        {!loading && step === 3 && currentQuestion && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#0b2b82]">
                  Clinical Assessment · Question #{currentQuestion.question_number}
                </span>
                <h2 className="text-lg sm:text-xl font-black text-slate-900 mt-1">
                  {currentQuestion.question_text}
                </h2>
              </div>
              {canCompleteEarly && (
                <button
                  type="button"
                  onClick={handleFinishQuestions}
                  className="px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold hover:bg-emerald-100 transition-colors"
                >
                  Skip Remaining & Continue &rarr;
                </button>
              )}
            </div>

            {/* Answer Options */}
            {!isCustomAnswer ? (
              <div className="space-y-2.5">
                {currentQuestion.options && currentQuestion.options.map((opt) => (
                  <button
                    key={opt.option_id}
                    type="button"
                    onClick={() => setSelectedOptionId(opt.option_id)}
                    className={`w-full p-4 rounded-xl text-left border transition-all cursor-pointer flex items-center justify-between ${
                      selectedOptionId === opt.option_id
                        ? 'bg-blue-50/70 border-[#0284c7] ring-2 ring-blue-100'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-sm font-semibold text-slate-800">{opt.option_text}</span>
                    <span
                      className={`w-5 h-5 rounded-full border flex items-center justify-center text-xs font-bold ${
                        selectedOptionId === opt.option_id
                          ? 'border-[#0284c7] bg-[#0284c7] text-white'
                          : 'border-slate-300 bg-white text-transparent'
                      }`}
                    >
                      ✓
                    </span>
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => setIsCustomAnswer(true)}
                  className="text-xs font-bold text-[#0284c7] hover:underline pt-2 inline-block cursor-pointer"
                >
                  + Explain in your own words instead
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <textarea
                  rows={3}
                  value={customAnswerText}
                  onChange={(e) => setCustomAnswerText(e.target.value)}
                  placeholder="Describe your answer in plain language..."
                  className="w-full p-3.5 rounded-xl border border-slate-200 focus:border-[#0284c7] text-sm text-slate-800 outline-none"
                />
                <button
                  type="button"
                  onClick={() => setIsCustomAnswer(false)}
                  className="text-xs font-bold text-slate-500 hover:underline"
                >
                  &larr; Switch back to multiple choice
                </button>
              </div>
            )}

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">
                {questionsAnswered >= 5
                  ? `Completed minimum 5 questions (${questionsAnswered} answered)`
                  : `Answer ${5 - questionsAnswered} more for comprehensive differential`}
              </span>
              <button
                type="button"
                onClick={handleSubmitAnswer}
                className="px-6 py-3 bg-[#0b2b82] hover:bg-[#071a4f] text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
              >
                Submit Answer & Next &rarr;
              </button>
            </div>
          </div>
        )}

        {/* PAGE 4: LOCATION CONFIRMATION */}
        {!loading && step === 4 && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#0b2b82]">Step 4 of 5</span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">Confirm Your Catchment Location</h2>
              <p className="text-sm text-slate-600">
                We search and rank verified healthcare centers strictly within a locked 50 km boundary to ensure timely transit.
              </p>
            </div>

            {/* Diagnostic Snapshot (Clean & Non-Technical) */}
            {phase4Intake && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-slate-500 tracking-wider">Required Medical Department</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-blue-100 text-[#0b2b82]">
                    {phase4Intake.required_department}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Care Setting: <strong className="capitalize">{phase4Intake.care_setting}</strong> · Urgency: <strong className="capitalize">{phase4Intake.severity}</strong>
                </p>
              </div>
            )}

            <div className="space-y-4">
              {/* One-Tap GPS Button */}
              <button
                type="button"
                onClick={handleDetectGPS}
                disabled={isLocating}
                className="w-full p-4 rounded-xl bg-blue-50/70 hover:bg-blue-100/70 border border-blue-200 text-[#0b2b82] font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <NavMapPinIcon className="w-5 h-5 text-[#0b2b82]" />
                <span>{isLocating ? 'Acquiring GPS Position...' : '📍 Use My Exact GPS Coordinates (Recommended)'}</span>
              </button>

              <div className="relative flex items-center justify-center my-3">
                <div className="border-t border-slate-200 w-full" />
                <span className="bg-white px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider absolute">
                  Or Manual District
                </span>
              </div>

              {/* Manual District Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">City / District Name</label>
                  <input
                    type="text"
                    value={cityDistrict}
                    onChange={(e) => setCityDistrict(e.target.value)}
                    placeholder="e.g. Hazaribagh"
                    className="w-full p-2.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-800 outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">State</label>
                  <input
                    type="text"
                    value={stateName}
                    onChange={(e) => setStateName(e.target.value)}
                    placeholder="e.g. Jharkhand"
                    className="w-full p-2.5 rounded-lg border border-slate-200 text-sm font-semibold text-slate-800 outline-none"
                  />
                </div>
              </div>

              {/* Coordinates Preview */}
              <div className="text-[11px] text-slate-500 font-mono flex items-center gap-4 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span>Lat: {latitude.toFixed(4)}</span>
                <span>Lon: {longitude.toFixed(4)}</span>
                <span className="text-emerald-700 font-bold ml-auto">✓ 50 km Strict Boundary Active</span>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => navigateToStep(3)}
                className="px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                &larr; Back to Questions
              </button>
              <button
                type="button"
                onClick={handleDiscoverAndRank}
                className="px-6 py-3 bg-[#0b2b82] hover:bg-[#071a4f] text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
              >
                Discover & Rank Top 5 Facilities &rarr;
              </button>
            </div>
          </div>
        )}

        {/* PAGE 5: TOP 5 RECOMMENDATIONS WITH INTERACTIVE MAP */}
        {!loading && step === 5 && recommendationOutput && (
          <div className="space-y-6">
            {/* Triage Urgency Header */}
            <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-extrabold bg-red-100 text-red-800">
                  Emergency Medical Referral Plan
                </span>
                <span className="text-xs text-slate-500 font-semibold">
                  Catchment Area: {cityDistrict}, {stateName} (50 km locked radius)
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                Recommended Specialty: {recommendationOutput.patient_summary?.required_department || 'Emergency Medicine'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                {recommendationOutput.routing_advisory_note}
              </p>
            </div>

            {/* Interactive Leaflet Map (Free Map Services) */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <NavMapPinIcon className="w-4 h-4 text-[#0b2b82]" />
                  Interactive Catchment Map (Patient Location & Top 5 Centers)
                </span>
                <span className="text-[11px] font-mono text-slate-400">OpenStreetMap Live Tiles</span>
              </div>
              <div ref={mapContainerRef} className="w-full h-80 rounded-xl border border-slate-200 overflow-hidden shadow-inner" />
            </div>

            {/* Top 5 Hospital Cards */}
            <div className="space-y-4">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-600 px-1">
                Top 5 Recommended Facilities (Clinically Ranked)
              </h3>

              {recommendationOutput.top_5_hospitals && recommendationOutput.top_5_hospitals.map((hosp) => {
                const isRank1 = hosp.rank === 1;

                return (
                  <div
                    key={hosp.hospital_id || hosp.rank}
                    className={`bg-white rounded-2xl p-5 sm:p-6 transition-all shadow-xs border ${
                      isRank1
                        ? 'border-[#0b2b82] ring-2 ring-blue-100/80 shadow-md'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-white ${
                              isRank1 ? 'bg-[#0b2b82]' : 'bg-[#0284c7]'
                            }`}
                          >
                            {hosp.rank}
                          </span>
                          <h4 className="text-base sm:text-lg font-black text-slate-900">{hosp.name}</h4>
                        </div>
                        <p className="text-xs text-slate-500 font-medium">
                          {hosp.distance_display} away · Approx. {hosp.estimated_drive_time_mins} mins drive · {hosp.city_district}, {hosp.state}
                        </p>
                      </div>

                      {/* Clinical Triage Badge */}
                      <div>
                        {isRank1 ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-extrabold bg-blue-50 text-[#0b2b82] border border-blue-200">
                            🏆 Top Recommended Facility
                          </span>
                        ) : hosp.recommendation_badge === 'HIGH_SUITABILITY_BACKUP' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            🥈 Recommended Backup
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            ⚠️ Stabilization Center
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Department Verification Badge */}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                        <NavVerifiedBadgeIcon className="w-3.5 h-3.5 text-emerald-600" />
                        24x7 Emergency &amp; {recommendationOutput.patient_summary?.required_department || 'Specialty'} Unit Confirmed
                      </span>
                      {hosp.verification_booster_applied && (
                        <span className="text-[11px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                          Verified by Regional Health Directory
                        </span>
                      )}
                    </div>

                    {/* Rationale & Transit Guidance */}
                    <p className="text-xs text-slate-600 mt-3 leading-relaxed">
                      {hosp.clinical_routing_rationale}
                    </p>

                    {/* Action Buttons */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2.5">
                      <a
                        href={hosp.direct_call_url}
                        className="px-4 py-2 rounded-xl bg-[#0b2b82] hover:bg-[#071a4f] text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                      >
                        <NavPhoneIcon className="w-4 h-4" />
                        <span>Call Emergency Desk ({hosp.contact_number || '+91-6546-260000'})</span>
                      </a>
                      <a
                        href={hosp.google_maps_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                      >
                        <NavDirectionsIcon className="w-4 h-4 text-slate-600" />
                        <span>Start Turn-by-Turn Directions</span>
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Actions */}
            <div className="pt-6 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => {
                  navigateToStep(1);
                  setRawSymptoms('');
                  setSessionId(null);
                  setCurrentQuestion(null);
                  setRecommendationOutput(null);
                }}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                &larr; Start New Clinical Assessment
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50 transition-colors shadow-xs"
              >
                🖨️ Print Emergency Referral Card
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
'''

with open("frontend/public/app.js", "r", encoding="utf-8") as f:
    text = f.read()

# Replace from line 5744 to 6798
start_marker = "// --- FEATURE 01: SMART CARE NAVIGATOR"
end_marker = "// --- FEATURE 02: TELECONSULTATION & QUEUE MANAGEMENT SCREENS ---"

start_idx = text.find(start_marker)
end_idx = text.find(end_marker)

if start_idx != -1 and end_idx != -1:
    new_text = text[:start_idx] + component_code + "\n\n// ==========================================\n" + text[end_idx:]
    with open("frontend/public/app.js", "w", encoding="utf-8") as f:
        f.write(new_text)
    print("SUCCESS: Updated app.js with SmartCareNavigatorApp")
else:
    print(f"MARKERS NOT FOUND: start={start_idx}, end={end_idx}")
