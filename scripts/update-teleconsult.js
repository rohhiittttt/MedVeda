import fs from 'node:fs';
import path from 'node:path';

const appPath = path.resolve('frontend/public/app.js');
let content = fs.readFileSync(appPath, 'utf8');

const targetFunctionStart = 'function ScreenTeleconsultBooking({ pathActor, onBookSuccess, onBack, onEmergencyEscalate }) {';
const nextFunctionStart = 'function ScreenTeleconsultQueue({ appointment, onJoinCall, onBack }) {';

const startIndex = content.indexOf(targetFunctionStart);
const endIndex = content.indexOf(nextFunctionStart);

if (startIndex === -1 || endIndex === -1) {
  console.error('Target functions not found in app.js!');
  process.exit(1);
}

const replacement = `function ScreenTeleconsultBooking({ pathActor, onBookSuccess, onBack, onEmergencyEscalate }) {
  const [bookingStep, setBookingStep] = useState(1);
  const [patientName, setPatientName] = useState(pathActor === 'worker' ? 'Ramesh Mahto' : 'Sita Devi');
  const [age, setAge] = useState('48 years');
  const [sex, setSex] = useState('female');
  const [selectedSpecialty, setSelectedSpecialty] = useState('Neurology');
  const [selectedDoctorId, setSelectedDoctorId] = useState('doc_1');
  const [selectedDate, setSelectedDate] = useState('Today / 11 Oct');
  const [selectedSlot, setSelectedSlot] = useState('11:30 AM');
  const [symptoms, setSymptoms] = useState('Throbbing headache on right temple for 3 days, mild light sensitivity.');
  const [riskFlags, setRiskFlags] = useState(['Hypertension']);
  const [showEmergencyModal, setShowEmergencyModal] = useState(false);
  const [bookingConfirmed, setBookingConfirmed] = useState(null);

  const SPECIALTY_OPTIONS = [
    { id: 'Neurology', label: 'Neurology', code: 'NE', desc: 'Brain, stroke, epilepsy, nerve disorders and headache' },
    { id: 'General Medicine', label: 'General Medicine', code: 'GM', desc: 'Primary diagnosis, fevers, infections and chronic illness' },
    { id: 'Cardiology', label: 'Cardiology', code: 'CD', desc: 'Heart disease, hypertension, ECG and chest symptoms' },
    { id: 'Orthopedics', label: 'Orthopedics', code: 'OR', desc: 'Bone fractures, joint pain, arthritis and spine care' },
    { id: 'Pediatrics', label: 'Pediatrics', code: 'PD', desc: 'Infant, child health, immunization and development' },
    { id: 'Obstetrics & Gynecology', label: 'Obstetrics & Gynecology', code: 'OB', desc: "Maternal health, high-risk pregnancy and women's health" },
    { id: 'Neurosurgery', label: 'Neurosurgery', code: 'NS', desc: 'Brain tumors, neuro-trauma, spine surgery and aneurysms' },
    { id: 'ENT', label: 'ENT', code: 'EN', desc: 'Ear, nose, throat, sinusitis and hearing assessment' },
    { id: 'Ophthalmology', label: 'Ophthalmology', code: 'OP', desc: 'Eye pain, vision impairment, glaucoma and cataract' },
    { id: 'Dermatology', label: 'Dermatology', code: 'DM', desc: 'Skin rash, eczema, psoriasis, acne and allergic dermatitis' },
    { id: 'Psychiatry', label: 'Psychiatry', code: 'PS', desc: 'Mental health, anxiety, depression and clinical wellness' },
    { id: 'Pulmonology / Respiratory Medicine', label: 'Pulmonology / Respiratory Medicine', code: 'PM', desc: 'Asthma, COPD, chronic cough, TB and chest care' },
    { id: 'Gastroenterology', label: 'Gastroenterology', code: 'GE', desc: 'Liver, stomach, jaundice, ulcers and digestive care' }
  ];

  const availableDoctorsList = [
    {
      id: 'doc_1',
      name: 'Dr. Priya Sharma',
      degrees: 'MBBS, MD, DM',
      specialty: 'Neurologist',
      rating: 4.9,
      experience: '12 years experience',
      image: 'doctor-priya.jpg',
      isRecommended: true,
      availabilityText: 'Available today',
      availabilityColor: 'text-emerald-600',
      isVerified: true
    },
    {
      id: 'doc_2',
      name: 'Dr. Sameer K. Jha',
      degrees: 'MBBS, MD',
      specialty: 'Neurologist',
      rating: 4.8,
      experience: '9 years experience',
      image: 'doctor-sameer.jpg',
      isRecommended: false,
      availabilityText: 'Available tomorrow',
      availabilityColor: 'text-slate-500',
      isVerified: false
    },
    {
      id: 'doc_3',
      name: 'Dr. Ananya Verma',
      degrees: 'MBBS, DM',
      specialty: 'Neurologist',
      rating: 4.7,
      experience: '8 years experience',
      image: 'doctor-ananya.jpg',
      isRecommended: false,
      availabilityText: 'Limited slots',
      availabilityColor: 'text-amber-600',
      isVerified: false
    }
  ];

  const activeDoctor = availableDoctorsList.find((d) => d.id === selectedDoctorId) || availableDoctorsList[0];

  const handleSymptomCheck = (text) => {
    setSymptoms(text);
    const lower = text.toLowerCase();
    if (pathActor === 'self' && (lower.includes('chest pain') || lower.includes('face drop') || lower.includes('cant breathe') || lower.includes('unconscious'))) {
      setShowEmergencyModal(true);
    }
  };

  const handleBook = () => {
    const isCritical = symptoms.toLowerCase().includes('chest pain') || symptoms.toLowerCase().includes('face drop');
    const urgency = isCritical ? 'RED' : 'YELLOW';

    const cleanAge = typeof age === 'string' ? parseInt(age.replace(/\\\\D/g, '')) || 48 : age;

    const bookingPayload = {
      patientName,
      patientAge: cleanAge,
      patientSex: sex,
      patientLocation: 'Hazaribagh, Jharkhand',
      specialty: selectedSpecialty,
      doctorId: activeDoctor.id,
      doctorName: activeDoctor.name,
      facilityId: 'fac_sbmch',
      scheduledTime: \`\${selectedDate} · \${selectedSlot}\`,
      urgencyTier: urgency,
      bookedBy: pathActor,
      workerName: pathActor === 'worker' ? 'ASHA Anita Kumari' : undefined,
      highRiskFlags: riskFlags,
      symptomsSummary: symptoms
    };

    fetch(getApiUrl('/api/v1/teleconsult/book'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bookingPayload)
    })
      .then((res) => res.json())
      .then((json) => {
        setBookingConfirmed(json.data);
      })
      .catch((err) => {
        console.error('Booking failed, using local mock:', err);
        setBookingConfirmed({
          appointment: {
            id: 'APT-MOCK-8821',
            patientName,
            patientAge: cleanAge,
            patientSex: sex,
            doctorName: activeDoctor.name,
            specialty: selectedSpecialty,
            scheduledTime: \`\${selectedDate} · \${selectedSlot}\`,
            urgencyTier: urgency,
            bookedBy: pathActor,
            workerName: pathActor === 'worker' ? 'ASHA Anita Kumari' : undefined,
            highRiskFlags: riskFlags
          },
          smsSimulation: {
            recipient: pathActor === 'worker' ? 'Frontline Worker (ASHA Anita)' : patientName,
            messageText: \`MedVeda: Teleconsult confirmed for \${patientName} with \${activeDoctor.name} (\${selectedSpecialty}) on \${selectedDate} at \${selectedSlot}. ID: APT-MOCK-8821.\`,
            sentAt: new Date().toISOString()
          }
        });
      });
  };

  if (bookingConfirmed) {
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-2xs text-center space-y-6 animate-in fade-in duration-200">
        <div className="w-14 h-14 rounded-2xl bg-blue-50 text-[#1565C0] flex items-center justify-center mx-auto shadow-2xs">
          <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <div>
          <span className="text-[11px] font-bold text-[#1565C0] uppercase tracking-wider block mb-1">
            Slot Allocation Confirmed
          </span>
          <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Appointment Scheduled</h3>
          <p className="text-xs text-slate-500 font-mono mt-1">
            Reference ID: <span className="font-semibold text-slate-800">{bookingConfirmed.appointment.id}</span>
          </p>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-left text-xs space-y-2.5">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
            <span>Consultation Overview</span>
            <span className="text-[#1565C0]">Confirmed</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5 text-slate-700">
            <div>
              <span className="text-slate-400 block text-[10px]">Patient</span>
              <strong className="text-slate-900">{bookingConfirmed.appointment.patientName}</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Consulting Specialist</span>
              <strong className="text-slate-900">{bookingConfirmed.appointment.doctorName}</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Department</span>
              <span className="font-semibold">{bookingConfirmed.appointment.specialty}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px]">Assigned Slot</span>
              <span className="font-semibold">{bookingConfirmed.appointment.scheduledTime}</span>
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 text-left text-white space-y-2">
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span>SMS CONFIRMATION SIMULATION</span>
            <span className="text-emerald-400 font-semibold">DISPATCHED</span>
          </div>
          <p className="text-xs text-slate-200 font-mono leading-relaxed">
            {bookingConfirmed.smsSimulation.messageText}
          </p>
          <div className="text-[10px] text-slate-400 pt-1">
            Recipient: {bookingConfirmed.smsSimulation.recipient} &bull; {new Date().toLocaleTimeString()}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onBookSuccess(bookingConfirmed.appointment)}
          className="w-full py-3.5 bg-[#1565C0] hover:bg-blue-700 text-white font-bold rounded-xl text-sm shadow-xs transition-colors cursor-pointer"
        >
          Proceed to Priority Queue &rarr;
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 space-y-6 animate-in fade-in duration-200">
      {/* Emergency Intercept Modal */}
      {showEmergencyModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full border border-slate-300 shadow-xl space-y-4">
            <div>
              <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                Clinical Safety Intercept
              </span>
              <h3 className="text-lg font-bold text-slate-900">Acute Red-Flag Criteria Detected</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                The symptoms you entered match acute emergency criteria (Cardiac, Stroke, or Severe Respiratory Compromise). Standard teleconsultation is not suitable for life-threatening acute emergencies.
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-700">
              <strong className="block text-slate-900 mb-0.5">Clinical Protocol:</strong>
              Patients presenting with acute red-flags should be immediately routed to the nearest 24x7 emergency medical center.
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowEmergencyModal(false);
                  onEmergencyEscalate();
                }}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg transition-colors cursor-pointer"
              >
                Redirect to Emergency Care Navigator (Feature 01) &rarr;
              </button>
              <button
                type="button"
                onClick={() => setShowEmergencyModal(false)}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
              >
                Dismiss and Continue Teleconsultation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Header Card (Matching Reference Screenshots) */}
      <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/90 shadow-2xs flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="5" y="3" width="14" height="18" rx="2" />
              <line x1="9" y1="9" x2="15" y2="9" />
              <line x1="9" y1="13" x2="15" y2="13" />
              <line x1="9" y1="17" x2="12" y2="17" />
            </svg>
          </div>
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {bookingStep === 1 ? 'Patient & Case Registration' : 'Find Your Specialist'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-normal mt-0.5">
              {bookingStep === 1
                ? 'Capture patient details and clinical information before matching a specialist.'
                : 'Choose a doctor and book a time that works for you'}
            </p>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-blue-200/80 bg-blue-50/60 text-blue-700 font-semibold text-xs shrink-0">
          <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <span>{pathActor === 'worker' ? 'Assisted care' : 'Patient Direct'}</span>
        </div>
      </div>

      {/* Stepper Bar (3 Connected Progress Bars & Labels) */}
      <div className="grid grid-cols-3 gap-4 pt-1">
        {/* Step 1 */}
        <div
          className="cursor-pointer"
          onClick={() => setBookingStep(1)}
        >
          <div className="h-1 bg-[#1565C0] rounded-full mb-2" />
          <div className={\`text-xs sm:text-sm font-bold \${bookingStep === 1 ? 'text-[#1565C0]' : 'text-slate-600'}\`}>
            Patient details
          </div>
        </div>

        {/* Step 2 */}
        <div
          className="cursor-pointer"
          onClick={() => setBookingStep(2)}
        >
          <div className={\`h-1 rounded-full mb-2 \${bookingStep >= 2 ? 'bg-[#1565C0]' : 'bg-slate-200'}\`} />
          <div className={\`text-xs sm:text-sm font-bold \${bookingStep === 2 ? 'text-[#1565C0]' : 'text-slate-400'}\`}>
            Specialist matching
          </div>
        </div>

        {/* Step 3 */}
        <div>
          <div className="h-1 bg-slate-200 rounded-full mb-2" />
          <div className="text-xs sm:text-sm font-semibold text-slate-400">
            Booking confirmation
          </div>
        </div>
      </div>

      {/* STEP 1: PATIENT & CASE REGISTRATION */}
      {bookingStep === 1 && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-6 sm:p-8 space-y-7 animate-in fade-in duration-200">
          {/* 1. Patient Information */}
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                  1. Patient Information
                </h3>
              </div>
              <span className="text-xs text-slate-400 font-normal">
                Required fields marked *
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Patient full name *
                </label>
                <input
                  type="text"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-slate-900 text-sm font-semibold focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                  placeholder="Full name"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Age *
                </label>
                <input
                  type="text"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-slate-900 text-sm font-semibold focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                  placeholder="e.g. 48 years"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Biological sex
                </label>
                <select
                  value={sex}
                  onChange={(e) => setSex(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 text-slate-900 text-sm font-semibold focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white"
                >
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Medical specialty *
                </label>
                <select
                  value={selectedSpecialty}
                  onChange={(e) => setSelectedSpecialty(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-blue-400 text-[#1565C0] text-sm font-bold focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-blue-50/20"
                >
                  {SPECIALTY_OPTIONS.map((spec) => (
                    <option key={spec.id} value={spec.id}>
                      {spec.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 2. Symptoms & Chief Complaint */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                2. Symptoms &amp; Chief Complaint
              </h3>
            </div>
            <p className="text-xs text-slate-500 font-normal mb-3">
              Document the patient's reported symptoms, duration and relevant details.
            </p>

            <textarea
              rows={3}
              value={symptoms}
              onChange={(e) => handleSymptomCheck(e.target.value)}
              placeholder="Describe symptoms, duration and severity..."
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-800 text-sm font-medium focus:border-blue-500 focus:ring-1 focus:ring-blue-500 bg-white leading-relaxed resize-none"
            />
            <div className="text-right mt-1">
              <span className="text-xs text-slate-400 font-normal">
                Patient-reported information
              </span>
            </div>
          </div>

          {/* 3. Clinical Risk Factors */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-4 h-4 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="m4.93 4.93 4.24 4.24" />
                <path d="m14.83 9.17 4.24-4.24" />
                <path d="m14.83 14.83 4.24 4.24" />
                <path d="m9.17 14.83-4.24 4.24" />
                <circle cx="12" cy="12" r="4" />
              </svg>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                3. Clinical Risk Factors
              </h3>
            </div>
            <p className="text-xs text-slate-500 font-normal mb-3.5">
              Select all relevant conditions or risk categories.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { id: 'Hypertension', label: 'Hypertension' },
                { id: 'Diabetes', label: 'Diabetes' },
                { id: 'Cardiac history', label: 'Cardiac history' },
                { id: 'Pregnancy', label: 'Pregnancy' },
                { id: 'Infant (<2 years)', label: 'Infant (<2 years)' },
                { id: 'Elderly (>65 years)', label: 'Elderly (>65 years)' }
              ].map((rf) => {
                const isSelected = riskFlags.includes(rf.id);
                return (
                  <button
                    key={rf.id}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setRiskFlags(riskFlags.filter((f) => f !== rf.id));
                      } else {
                        setRiskFlags([...riskFlags, rf.id]);
                      }
                    }}
                    className={\`p-3 rounded-xl border text-left flex items-center gap-2.5 transition-all cursor-pointer \${
                      isSelected
                        ? 'border-blue-400 bg-blue-50/70 text-blue-700 font-semibold shadow-2xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium'
                    }\`}
                  >
                    {isSelected ? (
                      <div className="w-4 h-4 rounded-full bg-[#1565C0] text-white flex items-center justify-center shrink-0">
                        <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0" />
                    )}
                    <span className="text-xs sm:text-sm">{rf.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 mt-3 pt-1">
              <svg className="w-4 h-4 text-emerald-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              <span>Patient information should be verified before booking.</span>
            </div>
          </div>

          {/* Action Row */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs sm:text-sm transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <span>&larr;</span>
              <span>Back to Path</span>
            </button>

            <button
              type="button"
              onClick={() => setBookingStep(2)}
              className="px-6 py-2.5 rounded-lg bg-[#1565C0] hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm shadow-xs transition-colors cursor-pointer flex items-center gap-2"
            >
              <span>Continue to Specialist</span>
              <span>&rarr;</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: FIND YOUR SPECIALIST (Matching User's Reference Screenshot) */}
      {bookingStep === 2 && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Available Specialists (7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-sm font-bold text-slate-900">Available Specialists</h3>
                <span className="text-xs text-slate-400 font-medium">3 doctors</span>
              </div>

              <div className="space-y-3.5">
                {availableDoctorsList.map((doc) => {
                  const isSelected = selectedDoctorId === doc.id;
                  return (
                    <div
                      key={doc.id}
                      onClick={() => setSelectedDoctorId(doc.id)}
                      className={\`rounded-2xl p-4 transition-all cursor-pointer flex items-center gap-4 bg-white \${
                        isSelected
                          ? 'border-2 border-blue-500 shadow-xs'
                          : 'border border-slate-200 hover:border-slate-300'
                      }\`}
                    >
                      <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-slate-100 shadow-2xs">
                        <img
                          src={doc.image}
                          alt={doc.name}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-sm font-bold text-slate-900 truncate">
                            {doc.name}
                          </h4>
                          {doc.isVerified && (
                            <svg className="w-4 h-4 text-blue-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                              <path fillRule="evenodd" d="M8.603 3.799A4.49 4.49 0 0112 2.25c1.357 0 2.573.6 3.397 1.549a4.49 4.49 0 013.498 1.307 4.491 4.491 0 011.307 3.497A4.49 4.49 0 0121.75 12a4.49 4.49 0 01-1.549 3.397 4.491 4.491 0 01-1.307 3.497 4.491 4.491 0 01-3.497 1.307A4.49 4.49 0 0112 21.75a4.49 4.49 0 01-3.397-1.549 4.49 4.49 0 01-3.498-1.306 4.491 4.491 0 01-1.307-3.498A4.49 4.49 0 012.25 12c0-1.357.6-2.573 1.549-3.397a4.49 4.49 0 011.307-3.497 4.49 4.49 0 013.497-1.307zm7.007 6.387a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>

                        <p className="text-xs text-slate-500 font-normal mt-0.5">
                          {doc.specialty} &middot; {doc.degrees}
                        </p>

                        <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium mt-1">
                          <span className="text-amber-500">★</span>
                          <span>{doc.rating}</span>
                          <span className="text-slate-300">&middot;</span>
                          <span>{doc.experience}</span>
                        </div>

                        <div className="flex items-center gap-2 mt-2">
                          {doc.isRecommended && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                              Recommended
                            </span>
                          )}
                          <span className={\`text-xs font-medium \${doc.availabilityColor}\`}>
                            {doc.availabilityText}
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0 pl-2">
                        <div className={\`w-5 h-5 rounded-full border-2 flex items-center justify-center \${
                          isSelected ? 'border-blue-600' : 'border-slate-300'
                        }\`}>
                          {isSelected && <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Book a Slot (5 cols) */}
            <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/90 p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-blue-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 leading-tight">Book a Slot</h3>
                  <p className="text-[11px] text-slate-400">Select your preferred date</p>
                </div>
              </div>

              {/* 3 Date Option Cards */}
              <div className="space-y-2">
                {[
                  { id: 'Today / 11 Oct', label: 'Today', date: '11 Oct' },
                  { id: 'Tomorrow / 12 Oct', label: 'Tomorrow', date: '12 Oct' },
                  { id: 'Tue / 13 Oct', label: 'Tue', date: '13 Oct' }
                ].map((d) => {
                  const isDateSelected = selectedDate === d.id;
                  return (
                    <div
                      key={d.id}
                      onClick={() => setSelectedDate(d.id)}
                      className={\`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between \${
                        isDateSelected
                          ? 'border-blue-500 bg-blue-50/20 shadow-2xs'
                          : 'border-slate-200 hover:bg-slate-50'
                      }\`}
                    >
                      <div>
                        <span className="text-slate-400 text-[11px] block">{d.label}</span>
                        <strong className="text-slate-900 text-xs">{d.date}</strong>
                      </div>
                      {isDateSelected && (
                        <div className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center">
                          <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="h-px bg-slate-100 my-2" />

              {/* Morning Slots */}
              <div>
                <span className="text-xs font-bold text-slate-700 block mb-2">Morning</span>
                <div className="grid grid-cols-2 gap-2">
                  {['09:00 AM', '10:00 AM', '11:30 AM'].map((slot) => {
                    const isSlotSelected = selectedSlot === slot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className={\`py-2 px-3 rounded-lg text-xs font-semibold border transition-all text-center cursor-pointer \${
                          isSlotSelected
                            ? 'bg-[#1565C0] text-white border-[#1565C0] shadow-2xs font-bold'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }\`}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Afternoon Slots */}
              <div>
                <span className="text-xs font-bold text-slate-700 block mb-2">Afternoon</span>
                <div className="grid grid-cols-2 gap-2">
                  {['12:30 PM', '02:00 PM', '03:30 PM'].map((slot) => {
                    const isSlotSelected = selectedSlot === slot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className={\`py-2 px-3 rounded-lg text-xs font-semibold border transition-all text-center cursor-pointer \${
                          isSlotSelected
                            ? 'bg-[#1565C0] text-white border-[#1565C0] shadow-2xs font-bold'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }\`}
                      >
                        {slot}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Your Selection Summary Box */}
              <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-3.5 space-y-1">
                <span className="text-[11px] font-bold text-[#1565C0] block uppercase tracking-wide">
                  Your selection
                </span>
                <div className="text-xs font-bold text-slate-900">
                  {activeDoctor.name}
                </div>
                <div className="text-xs text-slate-600 font-medium">
                  {selectedDate} &middot; {selectedSlot}
                </div>
                <div className="text-xs text-[#1565C0] font-medium flex items-center gap-1.5 pt-1">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="6" width="14" height="12" rx="2" />
                    <path d="M16 10l5-3v10l-5-3" />
                  </svg>
                  <span>Online consultation</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Action Row (Matching Reference Screenshot) */}
          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setBookingStep(1)}
              className="text-xs sm:text-sm font-semibold text-slate-400 hover:text-slate-700 transition-colors cursor-pointer flex items-center gap-1"
            >
              <span>&larr;</span>
              <span>Back to patient details</span>
            </button>

            <button
              type="button"
              onClick={handleBook}
              className="px-7 py-3 bg-[#0f172a] hover:bg-black text-white font-bold text-sm rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-2"
            >
              <span>Confirm Appointment</span>
              <span>&rarr;</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}\n\n`;

content = content.slice(0, startIndex) + replacement + content.slice(endIndex);
fs.writeFileSync(appPath, content, 'utf8');
console.log('Successfully updated ScreenTeleconsultBooking in frontend/public/app.js!');
