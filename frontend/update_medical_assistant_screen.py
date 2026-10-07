import sys
from pathlib import Path

app_js_path = Path("frontend/public/app.js")
content = app_js_path.read_text(encoding="utf-8")

start_marker = "function ScreenMedicalAssistantAgent({"
end_marker = "// ==========================================\n// --- FEATURES WORKSPACE: SIDE NAVBAR ---"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

if start_idx == -1 or end_idx == -1:
    print(f"Error: Markers not found! start_idx={start_idx}, end_idx={end_idx}")
    sys.exit(1)

NEW_SCREEN_COMPONENT = """function ScreenMedicalAssistantAgent({
  actorRole,
  setActorRole,
  onBackToHome,
  onNavigate
}) {
  const [messages, setMessages] = useState([
    {
      id: 'msg-init',
      sender: 'agent',
      text: "नमस्ते! I am your MedVeda Autonomous Medical Assistant Agent. मैं आपका मेदवेद मेडिकल असिस्टेंट एजेंट हूँ।\\n\\nI can provide tentative health guidance on common basic ailments, ask clarifying questions, suggest safe Over-The-Counter (OTC) medicines (no prescription required), analyze lab reports & medicine strips with same-composition alternatives, book doctor teleconsultations, and navigate MedVeda features.\\n\\nआप मुझसे हिंदी या English में कुछ भी पूछ सकते हैं या रिपोर्ट/दवा की फोटो (📎) अपलोड कर सकते हैं!",
      detectedLanguage: 'en',
      urgencyLevel: 'GREEN',
      timestamp: 'Just now',
      actionCards: [
        {
          type: 'QUICK_ACTIONS',
          options: [
            { label: '💊 Dolo 650 Alternatives (समान दवाएं)', query: 'What is Dolo 650 and what are its same composition alternatives?' },
            { label: '🌡️ Mild Fever & Body Ache (हल्का बुखार)', query: 'I have mild fever and body ache since morning' },
            { label: '🍋 Acidity & Indigestion (एसिडिटी राहत)', query: 'मुझे पेट में हल्की गैस और एसिडिटी हो रही है' },
            { label: '👨‍⚕️ Book Cardiologist (हृदय रोग डॉक्टर)', query: 'Book an appointment with a cardiologist' },
            { label: '🏥 Nearby Hospitals & ICU Beds', query: 'Show nearby hospitals and emergency beds in Hazaribagh' }
          ]
        }
      ]
    }
  ]);

  const [inputText, setInputText] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState('auto'); // 'auto', 'hi', 'en'
  const [autoVoice, setAutoVoice] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [currentAudio, setCurrentAudio] = useState(null);
  const [playingMessageId, setPlayingMessageId] = useState(null);
  const [actionInProgress, setActionInProgress] = useState(null);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat', 'doctors', 'facilities', 'appointments'
  const [doctorsList, setDoctorsList] = useState([]);
  const [facilitiesList, setFacilitiesList] = useState([]);
  const [appointmentsList, setAppointmentsList] = useState([]);

  // Multimodal File Attachment State
  const [selectedFile, setSelectedFile] = useState(null); // { file, base64, mimeType, name, previewUrl, sizeKb }
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Auto-scroll chat to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Load backend stores data on mount
  useEffect(() => {
    fetchLiveStores();
  }, []);

  const fetchLiveStores = async () => {
    try {
      const [docRes, facRes, aptRes] = await Promise.all([
        fetch('/api/agent/doctors').then(r => r.json()).catch(() => null),
        fetch('/api/agent/facilities').then(r => r.json()).catch(() => null),
        fetch('/api/agent/appointments?patient_id=PAT-2026-1024').then(r => r.json()).catch(() => null)
      ]);
      if (docRes && docRes.success) setDoctorsList(docRes.data || []);
      if (facRes && facRes.success) setFacilitiesList(facRes.data || []);
      if (aptRes && aptRes.success) setAppointmentsList(aptRes.data || []);
    } catch (e) {
      console.warn('Could not preload agent stores:', e);
    }
  };

  const playBase64Audio = (b64Audio, msgId) => {
    if (!b64Audio) return;
    try {
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }
      const audio = new Audio(`data:audio/mp3;base64,${b64Audio}`);
      setCurrentAudio(audio);
      setPlayingMessageId(msgId);
      audio.onended = () => {
        setPlayingMessageId(null);
        setCurrentAudio(null);
      };
      audio.onerror = () => {
        setPlayingMessageId(null);
        setCurrentAudio(null);
      };
      audio.play().catch(e => console.log('Audio autoplay prevented:', e));
    } catch (err) {
      console.error('Audio playback error:', err);
      setPlayingMessageId(null);
    }
  };

  const stopAudio = () => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setCurrentAudio(null);
      setPlayingMessageId(null);
    }
  };

  // Speech Recognition (STT) via Web Speech API
  const handleToggleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please type your message.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = selectedLanguage === 'hi' ? 'hi-IN' : 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setIsListening(false);
        if (transcript) {
          setInputText(transcript);
          handleSendMessage(transcript);
        }
      };

      recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      setIsListening(false);
    }
  };

  // Multimodal File Selection Handler
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('File size exceeds 10MB limit. Please upload a smaller document or photo.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const dataUrl = uploadEvent.target.result;
      const base64Data = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      const isImg = file.type.startsWith('image/');
      setSelectedFile({
        file,
        base64: base64Data,
        mimeType: file.type || 'image/jpeg',
        name: file.name,
        previewUrl: isImg ? dataUrl : null,
        sizeKb: Math.round(file.size / 1024)
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleClearFile = () => {
    setSelectedFile(null);
  };

  const handleSendMessage = async (textToSend) => {
    const query = (textToSend || inputText).trim();
    if (!query && !selectedFile) return;
    if (isLoading) return;

    const fileToUpload = selectedFile;
    const userMsgId = `usr-${Date.now()}`;
    const userMsg = {
      id: userMsgId,
      sender: 'user',
      text: query || (fileToUpload ? `Uploaded document: ${fileToUpload.name}` : ''),
      attachedFile: fileToUpload ? {
        name: fileToUpload.name,
        mimeType: fileToUpload.mimeType,
        previewUrl: fileToUpload.previewUrl,
        sizeKb: fileToUpload.sizeKb
      } : null,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setSelectedFile(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query || (fileToUpload ? `Please analyze this uploaded document: ${fileToUpload.name}` : ''),
          language: selectedLanguage,
          patientId: 'PAT-2026-1024',
          patientInfo: {
            name: 'Ramesh Mahto',
            age: 48,
            gender: 'male',
            location: 'Katkamsandi, Hazaribagh'
          },
          fileBase64: fileToUpload ? fileToUpload.base64 : undefined,
          fileMimeType: fileToUpload ? fileToUpload.mimeType : undefined,
          fileName: fileToUpload ? fileToUpload.name : undefined
        })
      });

      const resData = await res.json();
      if (resData.success && resData.data) {
        const agentMsgId = `agt-${Date.now()}`;
        const agentMsg = {
          id: agentMsgId,
          sender: 'agent',
          text: resData.data.answer,
          detectedLanguage: resData.data.detectedLanguage || 'en',
          urgencyLevel: resData.data.urgencyLevel || 'GREEN',
          actionCards: resData.data.actionCards || [],
          audioBase64: resData.data.audioBase64,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        setMessages((prev) => [...prev, agentMsg]);

        // Auto play audio if enabled
        if (autoVoice && resData.data.audioBase64) {
          playBase64Audio(resData.data.audioBase64, agentMsgId);
        }

        // Refresh stores
        fetchLiveStores();
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            sender: 'agent',
            text: resData.error || 'Medical Assistant is temporarily unavailable. Please try again.',
            urgencyLevel: 'YELLOW',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      }
    } catch (err) {
      console.error('Agent chat error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'agent',
          text: 'Unable to reach the Python Medical Assistant service. Please check your connection.',
          urgencyLevel: 'YELLOW',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Human-in-the-Loop Confirmation: Execute Real Action in MedVeda Database
  const handleExecuteAction = async (msgId, actionCard, confirmChoice) => {
    if (!confirmChoice) {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== msgId) return m;
          return {
            ...m,
            actionCards: (m.actionCards || []).map((c) =>
              c === actionCard ? { ...c, status: 'CANCELLED' } : c
            )
          };
        })
      );
      return;
    }

    const actionKey = `${msgId}-${actionCard.type}`;
    setActionInProgress(actionKey);

    try {
      let reqBody = {};
      if (actionCard.type === 'CONFIRMATION_CARD') {
        reqBody = {
          actionType: 'CONFIRM_BOOKING',
          patientId: 'PAT-2026-1024',
          params: {
            doctorId: actionCard.doctor.id,
            slotTime: actionCard.slot.time,
            patientName: actionCard.patient?.name || 'Ramesh Mahto',
            urgencyTier: actionCard.urgencyTier || 'ROUTINE',
            mode: actionCard.mode || 'teleconsult',
            reasonNote: `Confirmed teleconsultation with ${actionCard.doctor.name}`
          },
          language: selectedLanguage === 'auto' ? (actionCard.doctor.detectedLang || 'en') : selectedLanguage
        };
      } else if (actionCard.type === 'PROPOSE_REMINDER') {
        reqBody = {
          actionType: 'SET_REMINDER',
          patientId: 'PAT-2026-1024',
          params: {
            medicineName: actionCard.medicineName,
            dosage: actionCard.dosage,
            time: actionCard.time,
            instruction: actionCard.instruction
          },
          language: selectedLanguage === 'auto' ? 'en' : selectedLanguage
        };
      }

      const res = await fetch('/api/agent/action/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody)
      });
      const data = await res.json();

      if (data.success && data.data) {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== msgId) return m;
            return {
              ...m,
              actionCards: (m.actionCards || []).map((c) => {
                if (c === actionCard) {
                  return {
                    ...c,
                    status: 'CONFIRMED',
                    executedResult: data.data
                  };
                }
                return c;
              })
            };
          })
        );

        if (autoVoice && data.data.audioBase64) {
          playBase64Audio(data.data.audioBase64, `action-res-${Date.now()}`);
        }
        fetchLiveStores();
      } else {
        alert(data.error || 'Failed to execute action. Please try again.');
      }
    } catch (e) {
      console.error('Action execution failed:', e);
      alert('Error communicating with server to confirm action.');
    } finally {
      setActionInProgress(null);
    }
  };

  const getUrgencyBadge = (level) => {
    switch (level) {
      case 'RED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-600 text-white animate-pulse">
            <span>🚨</span>
            <span>EMERGENCY 108</span>
          </span>
        );
      case 'ORANGE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-600 text-white">
            <span>🛑</span>
            <span>DOCTOR CONSULT REQUIRED</span>
          </span>
        );
      case 'YELLOW':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
            <span>ℹ️</span>
            <span>CALIBRATED HEALTH GUIDANCE</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <span>🛡️</span>
            <span>VERIFIED MEDVEDA BOUNDS</span>
          </span>
        );
    }
  };

  return (
    <div className="min-h-[calc(100vh-70px)] bg-slate-50 flex flex-col">
      {/* TOP HEADER STRIP */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 sticky top-0 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#0b2b82] to-teal-500 text-white flex items-center justify-center text-xl shadow-sm">
              🤖
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black text-slate-900 tracking-tight">
                  Medical AI Assistant Agent
                </h1>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[#0b2b82] border border-blue-200">
                  MOD 10 &bull; AUTONOMOUS
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  OTC-Safe & Multimodal
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Action-capable multilingual health agent: basic symptom triage, OTC guidance, report review & same-composition alternatives
              </p>
            </div>
          </div>

          {/* CONTROLS: TABS, LANGUAGE & AUDIO */}
          <div className="flex items-center flex-wrap gap-2">
            {/* View Tabs */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('chat')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  activeTab === 'chat'
                    ? 'bg-white text-[#0b2b82] shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                💬 Agent Chat
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('doctors')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  activeTab === 'doctors'
                    ? 'bg-white text-[#0b2b82] shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                👨‍⚕️ Doctors ({doctorsList.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('facilities')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  activeTab === 'facilities'
                    ? 'bg-white text-[#0b2b82] shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🏥 Beds ({facilitiesList.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('appointments')}
                className={`px-3 py-1 rounded-lg transition-all ${
                  activeTab === 'appointments'
                    ? 'bg-white text-[#0b2b82] shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                📅 My Bookings ({appointmentsList.length})
              </button>
            </div>

            {/* Language Selector */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-medium">
              <button
                type="button"
                onClick={() => setSelectedLanguage('auto')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  selectedLanguage === 'auto'
                    ? 'bg-[#0b2b82] text-white font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Detect automatically from message"
              >
                ⚡ Auto
              </button>
              <button
                type="button"
                onClick={() => setSelectedLanguage('hi')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  selectedLanguage === 'hi'
                    ? 'bg-[#0b2b82] text-white font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🇮🇳 हिन्दी
              </button>
              <button
                type="button"
                onClick={() => setSelectedLanguage('en')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  selectedLanguage === 'en'
                    ? 'bg-[#0b2b82] text-white font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🇬🇧 English
              </button>
            </div>

            {/* Auto Voice Toggle */}
            <button
              type="button"
              onClick={() => setAutoVoice(!autoVoice)}
              className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all ${
                autoVoice
                  ? 'bg-teal-50 text-teal-800 border-teal-200'
                  : 'bg-white text-slate-500 border-slate-200'
              }`}
              title="Toggle automatic TTS voice playback"
            >
              <span>{autoVoice ? '🔊' : '🔇'}</span>
              <span className="hidden sm:inline">Voice: {autoVoice ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* MAIN CONTAINER */}
      <div className="max-w-7xl w-full mx-auto p-4 sm:p-6 flex-1 flex flex-col">
        {/* TAB 1: CHAT & AGENT INTERACTION */}
        {activeTab === 'chat' && (
          <div className="flex-1 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {/* Quick Prompt Pill Chips */}
            <div className="p-3 bg-slate-50/70 border-b border-slate-200 flex items-center gap-2 overflow-x-auto text-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0 flex items-center gap-1">
                <span>💡</span> Try Actions:
              </span>
              <button
                type="button"
                onClick={() => handleSendMessage('What is Dolo 650 and what are its same composition alternatives?')}
                className="shrink-0 px-3 py-1 rounded-full bg-blue-50 hover:bg-blue-100 border border-blue-200 text-[#0b2b82] font-semibold transition-all"
              >
                💊 Dolo 650 & Same-Salt Alternatives
              </button>
              <button
                type="button"
                onClick={() => handleSendMessage('I have mild fever and headache since yesterday')}
                className="shrink-0 px-3 py-1 rounded-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-semibold transition-all"
              >
                🌡️ Mild Fever & Clarifying Questions
              </button>
              <button
                type="button"
                onClick={() => handleSendMessage('मुझे पेट में गैस और एसिडिटी हो रही है')}
                className="shrink-0 px-3 py-1 rounded-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-semibold transition-all"
              >
                🍋 Acidity & Indigestion (हिन्दी में OTC सलाह)
              </button>
              <button
                type="button"
                onClick={() => handleSendMessage('Can you prescribe amoxicillin or antibiotics for my infection?')}
                className="shrink-0 px-3 py-1 rounded-full bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 font-semibold transition-all"
              >
                🛑 Antibiotic Guardrail Test (AI Refusal)
              </button>
              <button
                type="button"
                onClick={() => handleSendMessage('My CBC report shows: Hemoglobin 10.4 g/dL, Platelets 220000. Please explain.')}
                className="shrink-0 px-3 py-1 rounded-full bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-800 font-semibold transition-all"
              >
                📋 Explain Lab Report (Strict Grounding)
              </button>
              <button
                type="button"
                onClick={() => handleSendMessage('Book an appointment with Dr. Rajesh Verma (Cardiologist)')}
                className="shrink-0 px-3 py-1 rounded-full bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-slate-700 hover:text-[#0b2b82] font-medium transition-all"
              >
                👨‍⚕️ Book Cardiologist
              </button>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 p-4 sm:p-6 space-y-4 overflow-y-auto max-h-[62vh] min-h-[420px] bg-slate-50/30">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.sender === 'user' ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`max-w-3xl w-full rounded-2xl p-4 shadow-2xs transition-all ${
                      msg.sender === 'user'
                        ? 'bg-[#0b2b82] text-white ml-auto max-w-xl'
                        : 'bg-white border border-slate-200/90 text-slate-800'
                    }`}
                  >
                    {/* Header meta for Assistant */}
                    {msg.sender === 'agent' && (
                      <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100 gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-blue-50 text-[#0b2b82] flex items-center justify-center text-xs font-bold border border-blue-100">
                            🤖
                          </div>
                          <span className="text-xs font-bold text-slate-900">
                            MedVeda Assistant Agent
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {msg.detectedLanguage === 'hi' ? '🇮🇳 हिन्दी' : '🇬🇧 English'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getUrgencyBadge(msg.urgencyLevel)}
                          {msg.audioBase64 && (
                            <button
                              type="button"
                              onClick={() => {
                                if (playingMessageId === msg.id) {
                                  stopAudio();
                                } else {
                                  playBase64Audio(msg.audioBase64, msg.id);
                                }
                              }}
                              className={`p-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                                playingMessageId === msg.id
                                  ? 'bg-rose-100 text-rose-700 border border-rose-200 animate-pulse'
                                  : 'bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-[#0b2b82] border border-slate-200'
                              }`}
                              title={playingMessageId === msg.id ? 'Stop Voice' : 'Play TTS Voice'}
                            >
                              <span>{playingMessageId === msg.id ? '⏹️' : '🔊'}</span>
                              <span className="text-[10px]">
                                {playingMessageId === msg.id ? 'Stop' : 'Voice'}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* User Attached File Preview in Bubble */}
                    {msg.attachedFile && (
                      <div className="mb-2.5 p-2 bg-white/15 rounded-xl border border-white/20 flex items-center gap-2 text-xs">
                        {msg.attachedFile.previewUrl ? (
                          <img
                            src={msg.attachedFile.previewUrl}
                            alt="Attached Document"
                            className="w-10 h-10 rounded-lg object-cover border border-white/40"
                          />
                        ) : (
                          <span className="text-xl">📄</span>
                        )}
                        <div className="truncate">
                          <p className="font-bold truncate">{msg.attachedFile.name}</p>
                          <p className="text-[10px] opacity-80">{msg.attachedFile.sizeKb} KB &bull; {msg.attachedFile.mimeType}</p>
                        </div>
                      </div>
                    )}

                    {/* Message Body Text */}
                    <div className="text-sm leading-relaxed whitespace-pre-line font-normal">
                      {msg.text}
                    </div>

                    {/* ACTION CARDS */}
                    {msg.actionCards && msg.actionCards.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-slate-100 space-y-3">
                        {msg.actionCards.map((card, cIdx) => (
                          <div key={cIdx}>
                            {/* 1. MEDICINE INFO & SAME COMPOSITION ALTERNATIVES CARD */}
                            {card.type === 'MEDICINE_INFO_CARD' && (
                              <div className="bg-gradient-to-br from-blue-50/80 to-slate-50 border-2 border-blue-300 rounded-xl p-4 shadow-xs">
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-2xl">💊</span>
                                    <div>
                                      <h4 className="text-sm font-black text-[#0b2b82]">
                                        {card.primaryName || 'Medication Details'}
                                      </h4>
                                      <p className="text-xs text-slate-500 font-medium">
                                        {card.therapeuticClass || 'Pharmaceutical Drug'}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                      card.isOtc
                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                        : 'bg-rose-100 text-rose-800 border border-rose-300'
                                    }`}>
                                      {card.isOtc ? '🟢 OTC (No Prescription)' : '🔴 Prescription Only'}
                                    </span>
                                  </div>
                                </div>

                                <div className="bg-white rounded-lg p-3 border border-blue-100 space-y-1.5 text-xs text-slate-700 mb-3">
                                  <div className="flex justify-between items-center py-0.5">
                                    <span className="font-semibold text-slate-500">Active Chemical Salt:</span>
                                    <span className="font-black text-[#0b2b82] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                      {card.activeComposition || card.strength}
                                    </span>
                                  </div>
                                  <div className="py-0.5">
                                    <span className="font-semibold text-slate-500">Therapeutic Indication:</span>
                                    <p className="font-medium text-slate-800 mt-0.5">{card.indication}</p>
                                  </div>
                                  {card.usageAdvice && (
                                    <div className="py-0.5 pt-1 border-t border-slate-100">
                                      <span className="font-semibold text-slate-500">Dosage & Safety Advice:</span>
                                      <p className="text-slate-700 mt-0.5">{card.usageAdvice}</p>
                                    </div>
                                  )}
                                </div>

                                {/* SAME COMPOSITION ALTERNATIVES */}
                                {card.brandAlternatives && card.brandAlternatives.length > 0 && (
                                  <div>
                                    <div className="flex items-center justify-between mb-2">
                                      <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                        <span>🔄</span> Verified Same-Composition Alternatives:
                                      </h5>
                                      <span className="text-[10px] font-mono text-teal-700 font-bold bg-teal-50 px-1.5 py-0.2 rounded">
                                        EXACT SAME SALT
                                      </span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                      {card.brandAlternatives.map((alt, aIdx) => (
                                        <div key={aIdx} className="p-2.5 rounded-lg bg-white border border-slate-200 flex flex-col justify-between">
                                          <div>
                                            <div className="flex items-center justify-between">
                                              <span className="font-bold text-xs text-slate-900">{alt.brand}</span>
                                              <span className="text-[10px] font-mono text-slate-500">{alt.priceEst}</span>
                                            </div>
                                            <p className="text-[10px] text-slate-500">{alt.manufacturer}</p>
                                            <p className="text-[10px] font-semibold text-teal-700 mt-1">Salt: {alt.salt}</p>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              if (onNavigate) onNavigate('#feature6');
                                              else window.location.hash = '#feature6';
                                            }}
                                            className="mt-2 py-1 px-2 bg-slate-50 hover:bg-blue-50 text-[#0b2b82] rounded text-[10px] font-bold border border-slate-200 transition-all flex items-center justify-center gap-1"
                                          >
                                            <span>Check Live Stock (Feature 06) &rarr;</span>
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {card.disclaimer && (
                                  <p className="text-[10px] text-slate-400 italic mt-2.5">
                                    ⚠️ {card.disclaimer}
                                  </p>
                                )}
                              </div>
                            )}

                            {/* 2. LAB REPORT PARAMETERS & GROUNDED SUMMARY CARD */}
                            {card.type === 'LAB_REPORT_CARD' && (
                              <div className="bg-white border-2 border-teal-300 rounded-xl p-4 shadow-xs">
                                <div className="flex items-start justify-between gap-2 mb-3">
                                  <div className="flex items-center gap-2">
                                    <span className="text-2xl">📋</span>
                                    <div>
                                      <h4 className="text-sm font-black text-slate-900">
                                        {card.title || 'Diagnostic Pathology Lab Report'}
                                      </h4>
                                      <p className="text-xs text-slate-500">
                                        {card.facilityOrLab} &bull; {card.date}
                                      </p>
                                    </div>
                                  </div>
                                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">
                                    REPORT GROUNDED
                                  </span>
                                </div>

                                {/* Parameters Table */}
                                {card.parameters && card.parameters.length > 0 && (
                                  <div className="overflow-x-auto rounded-lg border border-slate-200 mb-3">
                                    <table className="w-full text-xs text-left">
                                      <thead className="bg-slate-100 text-slate-700 uppercase text-[10px] font-bold">
                                        <tr>
                                          <th className="p-2">Test Parameter</th>
                                          <th className="p-2">Observed</th>
                                          <th className="p-2">Normal Range</th>
                                          <th className="p-2">Status</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                        {card.parameters.map((p, pIdx) => {
                                          const statusColor =
                                            p.status === 'NORMAL'
                                              ? 'bg-emerald-100 text-emerald-800'
                                              : p.status === 'LOW'
                                              ? 'bg-amber-100 text-amber-800'
                                              : 'bg-rose-100 text-rose-800';
                                          return (
                                            <tr key={pIdx} className="hover:bg-slate-50/50">
                                              <td className="p-2 font-bold text-slate-800">
                                                {p.name}
                                                {p.meaning && <p className="text-[10px] font-normal text-slate-500">{p.meaning}</p>}
                                              </td>
                                              <td className="p-2 font-mono font-bold text-slate-900">
                                                {p.observedValue} {p.unit}
                                              </td>
                                              <td className="p-2 font-mono text-slate-500">{p.normalRange} {p.unit}</td>
                                              <td className="p-2">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${statusColor}`}>
                                                  {p.status}
                                                </span>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}

                                {/* Grounded Summary */}
                                {card.groundedSummary && (
                                  <div className="bg-teal-50/80 border border-teal-200 rounded-lg p-3 text-xs text-teal-950 mb-3">
                                    <span className="font-bold block text-teal-900 mb-1">🔍 Report Grounded Finding:</span>
                                    <p className="leading-relaxed">{card.groundedSummary}</p>
                                  </div>
                                )}

                                {card.disclaimer && (
                                  <p className="text-[10px] text-slate-400 italic">
                                    ⚠️ {card.disclaimer}
                                  </p>
                                )}
                              </div>
                            )}

                            {/* 3. CLARIFYING QUESTIONS CARD */}
                            {card.type === 'CLARIFYING_QUESTIONS_CARD' && (
                              <div className="bg-amber-50/90 border border-amber-300 rounded-xl p-3.5 shadow-2xs">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">❓</span>
                                    <h4 className="text-xs font-black text-amber-950 uppercase tracking-wider">
                                      {card.title || 'Clarifying Questions to Rule Out Red Flags'}
                                    </h4>
                                  </div>
                                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-200 text-amber-900">
                                    TRIAGE CHECK
                                  </span>
                                </div>
                                <div className="space-y-1.5 text-xs text-amber-900 font-medium">
                                  {(card.questions || []).map((q, qIdx) => (
                                    <div key={qIdx} className="flex items-start gap-1.5 bg-white/70 p-2 rounded-lg border border-amber-200">
                                      <span className="font-bold text-amber-800">{qIdx + 1}.</span>
                                      <span>{q}</span>
                                    </div>
                                  ))}
                                </div>
                                {card.quickReplies && card.quickReplies.length > 0 && (
                                  <div className="mt-2.5 pt-2 border-t border-amber-200/80">
                                    <span className="text-[10px] font-bold text-amber-800 uppercase">Quick Reply (क्लिक करके जवाब दें):</span>
                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                      {card.quickReplies.map((qr, qrIdx) => (
                                        <button
                                          key={qrIdx}
                                          type="button"
                                          onClick={() => handleSendMessage(qr)}
                                          className="px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-900 rounded-lg text-xs font-semibold border border-amber-300 transition-all shadow-2xs"
                                        >
                                          {qr} &rarr;
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* 4. OTC MEDICATION CARD */}
                            {card.type === 'OTC_MEDICATION_CARD' && (
                              <div className="bg-emerald-50/90 border border-emerald-300 rounded-xl p-3.5 shadow-2xs">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">🟢</span>
                                    <h4 className="text-xs font-black text-emerald-950 uppercase tracking-wider">
                                      {card.title || 'Safe Over-The-Counter (OTC) Guidance'}
                                    </h4>
                                  </div>
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-200 text-emerald-900">
                                    NO PRESCRIPTION NEEDED
                                  </span>
                                </div>
                                <div className="space-y-2 mt-2">
                                  {(card.medicines || []).map((med, mIdx) => (
                                    <div key={mIdx} className="p-3 bg-white rounded-xl border border-emerald-200 text-xs shadow-2xs">
                                      <div className="flex items-center justify-between">
                                        <span className="font-bold text-slate-900 text-sm">{med.name}</span>
                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                                          {med.activeSalt}
                                        </span>
                                      </div>
                                      <p className="text-slate-700 font-medium mt-1">
                                        <strong>Dosage:</strong> {med.dosage} &bull; {med.frequency}
                                      </p>
                                      <p className="text-slate-500 text-[11px] mt-1 italic">
                                        {selectedLanguage === 'hi' ? med.notesHi : med.notesEn}
                                      </p>
                                      <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-slate-100">
                                        <button
                                          type="button"
                                          onClick={() => handleSendMessage(`Remind me to take ${med.activeSalt || med.name} at 08:00 AM`)}
                                          className="px-2.5 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded-md text-[11px] font-bold transition-all flex items-center gap-1"
                                        >
                                          <span>⏰ Set Reminder</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (onNavigate) onNavigate('#feature6');
                                            else window.location.hash = '#feature6';
                                          }}
                                          className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-[#0b2b82] rounded-md text-[11px] font-bold transition-all flex items-center gap-1"
                                        >
                                          <span>💊 Check Stock</span>
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* 5. DOCTOR REFERRAL REQUIRED CARD */}
                            {card.type === 'DOCTOR_REFERRAL_REQUIRED_CARD' && (
                              <div className="bg-rose-50 border-2 border-rose-300 rounded-xl p-4 shadow-xs">
                                <div className="flex items-start gap-2.5 mb-2">
                                  <span className="text-2xl shrink-0">🛑</span>
                                  <div>
                                    <h4 className="text-xs font-black text-rose-950 uppercase tracking-wider">
                                      {card.title || 'Doctor Consultation Required'}
                                    </h4>
                                    <p className="text-xs text-rose-800 font-medium mt-0.5">
                                      {card.reason || 'This condition requires certified medical physical examination and prescription-only medications.'}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex flex-wrap gap-2 mt-3 pt-2 border-t border-rose-200">
                                  {(card.options || []).map((opt, oIdx) => (
                                    <button
                                      key={oIdx}
                                      type="button"
                                      onClick={() => {
                                        if (opt.doctorId) handleSendMessage(`Book appointment with Dr. Rajesh Verma`);
                                        else if (opt.route) {
                                          if (onNavigate) onNavigate(opt.route);
                                          else window.location.hash = opt.route;
                                        }
                                      }}
                                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1"
                                    >
                                      <span>{opt.label}</span>
                                      <span>&rarr;</span>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* 6. CONFIRMATION CARD (Human-in-the-Loop Booking) */}
                            {card.type === 'CONFIRMATION_CARD' && (
                              <div className="bg-gradient-to-br from-blue-50/70 via-indigo-50/40 to-white rounded-xl border-2 border-blue-300 p-4 shadow-xs">
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xl">📅</span>
                                    <div>
                                      <h4 className="text-xs font-black text-[#0b2b82] uppercase tracking-wider">
                                        Action Proposal: Confirm Appointment Booking
                                      </h4>
                                      <p className="text-[11px] text-slate-600">
                                        प्रस्तावित बुकिंग की समीक्षा करें और पुष्टि करें
                                      </p>
                                    </div>
                                  </div>
                                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-100 text-[#0b2b82]">
                                    TELECONSULT OPD
                                  </span>
                                </div>

                                <div className="bg-white rounded-lg p-3 border border-blue-100 mb-3 space-y-1.5 text-xs text-slate-700">
                                  <div className="flex justify-between">
                                    <span className="font-semibold text-slate-500">Doctor:</span>
                                    <span className="font-bold text-slate-900">{card.doctor.name} ({card.doctor.qualification})</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="font-semibold text-slate-500">Specialty:</span>
                                    <span className="font-bold text-teal-700">{card.doctor.specialty}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="font-semibold text-slate-500">Hospital:</span>
                                    <span className="font-medium text-slate-800">{card.doctor.facilityName}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="font-semibold text-slate-500">Slot Time:</span>
                                    <span className="font-bold text-[#0b2b82] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                      {card.slot.time}
                                    </span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="font-semibold text-slate-500">Patient:</span>
                                    <span className="font-medium text-slate-800">{card.patient.name} ({card.patient.phone})</span>
                                  </div>
                                </div>

                                {card.status === 'CONFIRMED' ? (
                                  <div className="bg-emerald-50 border border-emerald-300 rounded-lg p-3 text-xs text-emerald-900 space-y-1">
                                    <div className="flex items-center justify-between font-bold text-emerald-800">
                                      <span className="flex items-center gap-1.5">
                                        <span>✅</span> Booking Confirmed (अपॉइंटमेंट पक्का हो गया)
                                      </span>
                                      <span className="font-mono bg-emerald-200/80 px-2 py-0.5 rounded">
                                        {card.executedResult?.appointment?.id}
                                      </span>
                                    </div>
                                    <p className="text-[11px] text-emerald-700">
                                      {card.executedResult?.smsNotification?.text}
                                    </p>
                                    <div className="pt-2 flex items-center justify-end">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (onNavigate) onNavigate('#feature2');
                                          else window.location.hash = '#feature2';
                                        }}
                                        className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white rounded font-bold text-xs flex items-center gap-1"
                                      >
                                        <span>🚀 Open Teleconsult OPD (Feature 02)</span>
                                        <span>&rarr;</span>
                                      </button>
                                    </div>
                                  </div>
                                ) : card.status === 'CANCELLED' ? (
                                  <div className="bg-slate-100 border border-slate-300 rounded-lg p-2.5 text-xs text-slate-600 flex items-center gap-1.5 font-medium">
                                    <span>❌</span> Booking proposal cancelled by user.
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-end gap-2 pt-1">
                                    <button
                                      type="button"
                                      disabled={actionInProgress !== null}
                                      onClick={() => handleExecuteAction(msg.id, card, false)}
                                      className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-600 font-bold text-xs transition-all"
                                    >
                                      Cancel (रद्द करें)
                                    </button>
                                    <button
                                      type="button"
                                      disabled={actionInProgress !== null}
                                      onClick={() => handleExecuteAction(msg.id, card, true)}
                                      className="px-4 py-1.5 rounded-lg bg-[#0b2b82] hover:bg-blue-800 text-white font-black text-xs transition-all flex items-center gap-1.5 shadow-sm"
                                    >
                                      {actionInProgress === `${msg.id}-${card.type}` ? (
                                        <span>⏳ Booking Slot...</span>
                                      ) : (
                                        <>
                                          <span>✅ Confirm Booking (पुष्टि करें)</span>
                                          <span>&rarr;</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* 7. DOCTORS LIST CARD */}
                            {card.type === 'DOCTORS_LIST' && (
                              <div className="space-y-2">
                                <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                  <span>👨‍⚕️</span> Available Specialists in Network:
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                  {(card.doctors || []).map((doc) => (
                                    <div
                                      key={doc.id}
                                      className="p-3 rounded-xl bg-white border border-slate-200 hover:border-blue-300 shadow-2xs flex flex-col justify-between"
                                    >
                                      <div>
                                        <div className="flex items-center justify-between">
                                          <h5 className="font-bold text-xs text-slate-900">{doc.name}</h5>
                                          <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded">
                                            {doc.specialty}
                                          </span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 mt-0.5">{doc.facilityName}</p>
                                        <p className="text-[10px] text-slate-400 mt-1 font-mono">
                                          Next: {doc.slots?.[0]?.time || 'Today'}
                                        </p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleSendMessage(`Book appointment with ${doc.name}`)}
                                        className="mt-2.5 w-full py-1.5 px-3 bg-blue-50 hover:bg-[#0b2b82] text-[#0b2b82] hover:text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 border border-blue-200"
                                      >
                                        <span>📅 Book Slot with Doctor</span>
                                        <span>&rarr;</span>
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* 8. FACILITIES LIST CARD */}
                            {card.type === 'FACILITIES_LIST' && (
                              <div className="space-y-2">
                                <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                  <span>🏥</span> Verified District Facilities:
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                  {(card.facilities || []).map((fac) => (
                                    <div
                                      key={fac.id}
                                      className="p-3 rounded-xl bg-white border border-slate-200 hover:border-teal-300 shadow-2xs flex flex-col justify-between"
                                    >
                                      <div>
                                        <div className="flex items-start justify-between gap-1">
                                          <h5 className="font-bold text-xs text-slate-900 leading-snug">{fac.name}</h5>
                                          <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded shrink-0">
                                            {fac.type}
                                          </span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 mt-1">{fac.address}</p>
                                        <div className="flex items-center gap-2 mt-2">
                                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                                            🛏️ {fac.emergencyBeds} Beds Ready
                                          </span>
                                          <span className="text-[10px] text-slate-500">
                                            📞 {fac.contactPhone}
                                          </span>
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (onNavigate) onNavigate('#feature1');
                                          else window.location.hash = '#feature1';
                                        }}
                                        className="mt-2.5 w-full py-1.5 px-3 bg-teal-50 hover:bg-teal-700 text-teal-800 hover:text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 border border-teal-200"
                                      >
                                        <span>📍 View in Care Navigator</span>
                                        <span>&rarr;</span>
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* 9. PROPOSE REMINDER CARD */}
                            {card.type === 'PROPOSE_REMINDER' && (
                              <div className="bg-amber-50/70 border border-amber-300 rounded-xl p-3.5 shadow-2xs">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xl">⏰</span>
                                    <div>
                                      <h4 className="text-xs font-bold text-amber-900">
                                        Dosage Reminder: {card.medicineName}
                                      </h4>
                                      <p className="text-[11px] text-amber-700">
                                        Schedule: {card.time} &bull; {card.instruction}
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                {card.status === 'CONFIRMED' ? (
                                  <div className="bg-emerald-50 border border-emerald-200 rounded p-2 text-xs text-emerald-800 font-bold flex items-center gap-1.5">
                                    <span>✅ Reminder Active: Alert set for {card.time}</span>
                                  </div>
                                ) : (
                                  <div className="flex justify-end gap-2 mt-2">
                                    <button
                                      type="button"
                                      disabled={actionInProgress !== null}
                                      onClick={() => handleExecuteAction(msg.id, card, true)}
                                      className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1"
                                    >
                                      <span>⏰ Save & Activate Reminder</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* 10. APPOINTMENTS LIST CARD */}
                            {card.type === 'APPOINTMENTS_LIST' && (
                              <div className="space-y-2">
                                {(card.appointments || []).length === 0 ? (
                                  <p className="text-xs text-slate-500 italic">No booked appointments found.</p>
                                ) : (
                                  card.appointments.map((apt) => (
                                    <div key={apt.id} className="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between">
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <span className="font-bold text-xs text-slate-900">{apt.doctorName}</span>
                                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-blue-50 text-[#0b2b82]">
                                            {apt.id}
                                          </span>
                                        </div>
                                        <p className="text-[11px] text-slate-500">{apt.facilityName} &bull; {apt.scheduledTime}</p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (onNavigate) onNavigate('#feature2');
                                          else window.location.hash = '#feature2';
                                        }}
                                        className="px-2.5 py-1 bg-blue-50 hover:bg-[#0b2b82] text-[#0b2b82] hover:text-white rounded text-xs font-bold transition-all"
                                      >
                                        Open OPD &rarr;
                                      </button>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}

                            {/* 11. NAVIGATE ACTION CARD */}
                            {card.type === 'NAVIGATE_ACTION' && (
                              <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3 flex items-center justify-between">
                                <div>
                                  <h4 className="text-xs font-bold text-[#0b2b82]">{card.title}</h4>
                                  <p className="text-[11px] text-slate-600 font-mono">{card.route}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (onNavigate) onNavigate(card.route);
                                    else window.location.hash = card.route;
                                  }}
                                  className="px-3 py-1.5 bg-[#0b2b82] hover:bg-blue-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1"
                                >
                                  <span>{card.buttonLabel || 'Open Feature'}</span>
                                  <span>&rarr;</span>
                                </button>
                              </div>
                            )}

                            {/* 12. EMERGENCY ACTIONS CARD */}
                            {card.type === 'EMERGENCY_ACTIONS' && (
                              <div className="bg-rose-50 border-2 border-rose-400 rounded-xl p-4 shadow-sm">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-2xl animate-bounce">🚨</span>
                                  <div>
                                    <h4 className="text-xs font-black text-rose-900 uppercase tracking-wider">
                                      {card.title || 'Immediate Emergency Contacts'}
                                    </h4>
                                    <p className="text-[11px] text-rose-700 font-semibold">
                                      Nearest ER: {card.nearestHospital?.name} ({card.nearestHospital?.emergencyBeds} Beds)
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 mt-3">
                                  <a
                                    href="tel:108"
                                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-black shadow-xs flex items-center gap-1.5 animate-pulse"
                                  >
                                    <span>📞 Call 108 Ambulance</span>
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (onNavigate) onNavigate('#feature1');
                                      else window.location.hash = '#feature1';
                                    }}
                                    className="px-3 py-2 bg-white hover:bg-rose-100 text-rose-900 border border-rose-300 rounded-lg text-xs font-bold transition-all"
                                  >
                                    🏥 Emergency Navigation &rarr;
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* 13. CAPABILITY FALLBACK CARD */}
                            {card.type === 'CAPABILITY_FALLBACK' && (
                              <div className="bg-amber-50/80 border border-amber-300 rounded-xl p-3.5 shadow-2xs">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-lg">🛡️</span>
                                    <h4 className="text-xs font-bold text-amber-900">
                                      {card.title || 'MedVeda Supported Alternatives'}
                                    </h4>
                                  </div>
                                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                                    G-HON SECURE
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {(card.options || []).map((opt, oIdx) => (
                                    <button
                                      key={oIdx}
                                      type="button"
                                      onClick={() => {
                                        if (onNavigate) onNavigate(opt.route);
                                        else window.location.hash = opt.route;
                                      }}
                                      className="px-3 py-1.5 bg-white hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg text-xs font-bold transition-all shadow-2xs"
                                    >
                                      {opt.label} &rarr;
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* 14. HEALTH GUIDANCE ACTIONS */}
                            {card.type === 'HEALTH_GUIDANCE_ACTIONS' && (
                              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 shadow-2xs">
                                <h4 className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                                  <span>ℹ️</span> Recommended Next Steps:
                                </h4>
                                <div className="flex flex-wrap gap-2">
                                  {(card.options || []).map((opt, oIdx) => (
                                    <button
                                      key={oIdx}
                                      type="button"
                                      onClick={() => {
                                        if (opt.doctorId) {
                                          handleSendMessage(`Book appointment with Dr. Rajesh Verma`);
                                        } else if (opt.route) {
                                          if (onNavigate) onNavigate(opt.route);
                                          else window.location.hash = opt.route;
                                        }
                                      }}
                                      className="px-3 py-1.5 bg-white hover:bg-blue-50 text-[#0b2b82] border border-blue-200 rounded-lg text-xs font-bold transition-all shadow-2xs"
                                    >
                                      {opt.label} &rarr;
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* 15. QUICK ACTIONS PILLS */}
                            {card.type === 'QUICK_ACTIONS' && (
                              <div className="flex flex-wrap gap-2 pt-1">
                                {(card.options || []).map((opt, oIdx) => (
                                  <button
                                    key={oIdx}
                                    type="button"
                                    onClick={() => {
                                      if (opt.query) {
                                        handleSendMessage(opt.query);
                                      } else if (opt.route) {
                                        if (onNavigate) onNavigate(opt.route);
                                        else window.location.hash = opt.route;
                                      }
                                    }}
                                    className="px-3 py-1 bg-white hover:bg-blue-50 text-slate-700 hover:text-[#0b2b82] rounded-lg text-xs font-semibold border border-slate-200 hover:border-blue-300 transition-all shadow-2xs"
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <span className="text-[10px] text-slate-400 mt-1 px-1">
                    {msg.timestamp}
                  </span>
                </div>
              ))}

              {/* Typing indicator */}
              {isLoading && (
                <div className="flex items-center gap-2 text-xs text-slate-500 bg-white border border-slate-200 rounded-xl px-4 py-2.5 w-fit shadow-2xs">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce"></span>
                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:0.2s]"></span>
                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-bounce [animation-delay:0.4s]"></span>
                  </div>
                  <span className="font-medium text-slate-600">
                    Agent reasoning, checking OTC safety & preparing cards...
                  </span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Footer Area */}
            <div className="p-3 sm:p-4 bg-white border-t border-slate-200">
              {/* Selected file preview pill */}
              {selectedFile && (
                <div className="mb-2 p-2 px-3 bg-blue-50/90 border border-blue-200 rounded-xl flex items-center justify-between text-xs text-blue-900 animate-fadeIn">
                  <div className="flex items-center gap-2">
                    {selectedFile.previewUrl ? (
                      <img
                        src={selectedFile.previewUrl}
                        alt="Upload preview"
                        className="w-8 h-8 rounded-lg object-cover border border-blue-200 shadow-2xs"
                      />
                    ) : (
                      <span className="text-xl">📄</span>
                    )}
                    <div>
                      <p className="font-bold text-slate-800 truncate max-w-[200px] sm:max-w-md">{selectedFile.name}</p>
                      <p className="text-[10px] text-blue-700">{selectedFile.sizeKb} KB &bull; {selectedFile.mimeType}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearFile}
                    className="p-1 rounded-full hover:bg-blue-200 text-blue-800 font-bold text-sm"
                    title="Remove attachment"
                  >
                    &times;
                  </button>
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2"
              >
                {/* Hidden File Input for Multimodal Upload */}
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*,application/pdf"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {/* Multimodal Attachment Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-3 rounded-xl border text-base flex items-center justify-center transition-all shrink-0 ${
                    selectedFile
                      ? 'bg-blue-100 text-[#0b2b82] border-blue-300 font-bold shadow-xs'
                      : 'bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-[#0b2b82] border-slate-200'
                  }`}
                  title="Upload Medicine Strip, Prescription or Lab Report (मल्टीमॉडल रिपोर्ट या दवा की फोटो अपलोड करें)"
                >
                  <span>📎</span>
                </button>

                {/* Voice Input Microphone Button */}
                <button
                  type="button"
                  onClick={handleToggleVoiceInput}
                  className={`p-3 rounded-xl border text-base flex items-center justify-center transition-all shrink-0 ${
                    isListening
                      ? 'bg-rose-500 text-white border-rose-600 animate-pulse shadow-md'
                      : 'bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-[#0b2b82] border-slate-200'
                  }`}
                  title={isListening ? 'Listening... click to stop' : 'Click to speak via Microphone'}
                >
                  <span>{isListening ? '🔴' : '🎙️'}</span>
                </button>

                {/* Text Input Box */}
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={
                    selectedLanguage === 'hi'
                      ? 'अपनी समस्या बताएं, दवा के बारे में पूछें, या रिपोर्ट अपलोड करें...'
                      : 'Describe symptoms, ask about medicine alternatives, or upload a report...'
                  }
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 text-sm focus:outline-hidden focus:ring-2 focus:ring-[#0b2b82] focus:bg-white transition-all"
                  disabled={isLoading}
                />

                {/* Send Button */}
                <button
                  type="submit"
                  disabled={(!inputText.trim() && !selectedFile) || isLoading}
                  className="px-5 py-2.5 rounded-xl bg-[#0b2b82] hover:bg-blue-800 disabled:opacity-50 text-white text-sm font-black transition-all flex items-center gap-1.5 shadow-sm shrink-0"
                >
                  <span>Send</span>
                  <span>&rarr;</span>
                </button>
              </form>

              <div className="flex items-center justify-between mt-2 px-1 text-[11px] text-slate-400">
                <span>
                  🛡️ Safe OTC Guidance &bull; Exact Same-Salt Alternatives &bull; Non-Diagnostic AI
                </span>
                <span className="hidden sm:inline">
                  ⚡ Port 8001 Python Multimodal AI Engine
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: REGISTERED DOCTORS ROSTER */}
        {activeTab === 'doctors' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Registered Specialist Doctors Database
                </h3>
                <p className="text-xs text-slate-500">
                  5 specialists available for direct appointment proposals & teleconsultation
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('chat')}
                className="px-3 py-1.5 bg-blue-50 text-[#0b2b82] rounded-lg text-xs font-bold border border-blue-200"
              >
                &larr; Back to Chat
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {doctorsList.map((doc) => (
                <div
                  key={doc.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#0b2b82] flex items-center justify-center text-xl font-bold border border-blue-100">
                        👨‍⚕️
                      </div>
                      <span className="text-[10px] font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                        {doc.specialty}
                      </span>
                    </div>
                    <h4 className="text-sm font-black text-slate-900">{doc.name}</h4>
                    <p className="text-xs text-slate-500">{doc.qualification}</p>
                    <p className="text-xs text-slate-700 font-medium mt-2">{doc.facilityName}</p>

                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <span className="text-[11px] font-bold text-slate-400 uppercase">Available Slots:</span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {(doc.slots || []).map((s, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200"
                          >
                            {s.time}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('chat');
                      handleSendMessage(`Book appointment with ${doc.name}`);
                    }}
                    className="mt-4 w-full py-2 bg-[#0b2b82] hover:bg-blue-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5"
                  >
                    <span>📅 Book Appointment Proposal</span>
                    <span>&rarr;</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: DISTRICT FACILITIES & EMERGENCY BEDS */}
        {activeTab === 'facilities' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Hazaribagh District Facilities & Emergency Capacity
                </h3>
                <p className="text-xs text-slate-500">
                  Verified network hospitals with real-time bed & ICU availability
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('chat')}
                className="px-3 py-1.5 bg-blue-50 text-[#0b2b82] rounded-lg text-xs font-bold border border-blue-200"
              >
                &larr; Back to Chat
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {facilitiesList.map((fac) => (
                <div
                  key={fac.id}
                  className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center text-xl font-bold border border-teal-100">
                        🏥
                      </div>
                      <span className="text-[10px] font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {fac.type}
                      </span>
                    </div>
                    <h4 className="text-sm font-black text-slate-900">{fac.name}</h4>
                    <p className="text-xs text-slate-500 mt-1">{fac.address}</p>

                    <div className="grid grid-cols-2 gap-2 mt-4">
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Emergency Beds</span>
                        <span className="text-sm font-black text-emerald-700">
                          {fac.emergencyBeds} Ready
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">ICU Beds</span>
                        <span className="text-sm font-black text-blue-700">
                          {fac.icuBeds} Ready
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
                      <span>📞 {fac.phone}</span>
                      <span>🚗 {fac.distanceKm} km away</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        if (onNavigate) onNavigate('#feature1');
                        else window.location.hash = '#feature1';
                      }}
                      className="px-3.5 py-1.5 bg-teal-700 hover:bg-teal-800 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                    >
                      <span>📍 View in Care Navigator</span>
                      <span>&rarr;</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('chat');
                        handleSendMessage(`Show doctors available at ${fac.name}`);
                      }}
                      className="text-xs font-bold text-[#0b2b82] hover:underline"
                    >
                      Find Doctors &rarr;
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: ACTIVE BOOKED APPOINTMENTS */}
        {activeTab === 'appointments' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Confirmed Patient Appointments
                </h3>
                <p className="text-xs text-slate-500">
                  Real-time appointments store synchronized with Feature 02 Teleconsultation OPD
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('chat')}
                className="px-3 py-1.5 bg-blue-50 text-[#0b2b82] rounded-lg text-xs font-bold border border-blue-200"
              >
                &larr; Back to Chat
              </button>
            </div>

            <div className="space-y-3">
              {appointmentsList.length === 0 ? (
                <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">
                  <span className="text-3xl block mb-2">📅</span>
                  <p className="text-sm font-semibold">No appointments booked yet.</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Ask the assistant "Book an appointment with Dr. Rajesh Verma" to schedule one now.
                  </p>
                </div>
              ) : (
                appointmentsList.map((apt) => (
                  <div
                    key={apt.id}
                    className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center text-lg shrink-0">
                        ✅
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-black text-slate-900">{apt.doctorName}</h4>
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                            {apt.id}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5">
                          {apt.specialty} &bull; {apt.facilityName}
                        </p>
                        <p className="text-xs text-[#0b2b82] font-semibold mt-1">
                          ⏰ Scheduled: {apt.scheduledTime} ({apt.mode || 'Teleconsult'})
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (onNavigate) onNavigate('#feature2');
                          else window.location.hash = '#feature2';
                        }}
                        className="px-3.5 py-1.5 bg-[#0b2b82] hover:bg-blue-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1"
                      >
                        <span>🚀 Launch Teleconsult OPD</span>
                        <span>&rarr;</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
"""

new_content = content[:start_idx] + NEW_SCREEN_COMPONENT + "\n\n" + content[end_idx:]
app_js_path.write_text(new_content, encoding="utf-8")
print("Successfully updated ScreenMedicalAssistantAgent in frontend/public/app.js!")
