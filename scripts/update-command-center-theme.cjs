const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, '..', 'frontend', 'public', 'app.js');
let content = fs.readFileSync(appJsPath, 'utf8');

const updatedWhiteBlueComponent = `
// ============================================================================
// --- FEATURE 09: DISTRICT ADMIN COMMAND CENTER (MV-DAC) ---
// --- Styled in White & Blue MedVeda Theme ---
// ============================================================================

function ScreenCommandCenter({
  actorRole,
  setActorRole,
  onBackToHome,
  onNavigateToFacilityDashboard,
  onNavigateToSchemeFinder
}) {
  // --- Geography State (Pan-India Master Data) ---
  const [states, setStates] = useState([]);
  const [selectedState, setSelectedState] = useState('jharkhand');
  const [districts, setDistricts] = useState([]);
  const [selectedDistrict, setSelectedDistrict] = useState('dist_jhk_hazaribagh');
  const [districtSearch, setDistrictSearch] = useState('');
  const [isSearchingDistricts, setIsSearchingDistricts] = useState(false);

  // --- Sub-View Tabs: S1 to S8 ---
  const [activeTab, setActiveTab] = useState('s1_overview');

  // --- Telemetry Data States ---
  const [overview, setOverview] = useState(null);
  const [facilities, setFacilities] = useState([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState('');
  const [facilityDetail, setFacilityDetail] = useState(null);
  const [reportsMatrix, setReportsMatrix] = useState(null);
  const [rules, setRules] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [alertFilter, setAlertFilter] = useState('ALL');
  const [forecasts, setForecasts] = useState([]);
  const [outbreakData, setOutbreakData] = useState(null);
  const [outbreakCluster, setOutbreakCluster] = useState('acute_fever_rash');
  const [requests, setRequests] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);

  // --- UI Feedback & Modals ---
  const [toast, setToast] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedAlertId, setExpandedAlertId] = useState(null);

  // --- Recommender & Transfer Tool State ---
  const [recommenderFacId, setRecommenderFacId] = useState('');
  const [recommenderResource, setRecommenderResource] = useState('oxygen_cylinders');
  const [recommenderQty, setRecommenderQty] = useState(15);
  const [recommendations, setRecommendations] = useState(null);
  const [recommenderLoading, setRecommenderLoading] = useState(false);

  // --- Rule Edit Modal ---
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [ruleFormData, setRuleFormData] = useState({
    id: '',
    resourceId: 'oxygen_cylinders',
    resourceName: 'Oxygen Cylinders',
    facilityId: '',
    minimumLevel: 10,
    reorderLevel: 25,
    targetBuffer: 60,
    daysOfCoverMin: 7,
    severity: 'critical'
  });

  const showToastMsg = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4500);
  };

  // --- 1. Load Pan-India States Master ---
  useEffect(() => {
    const fetchStates = async () => {
      try {
        const res = await fetch(getApiUrl('/api/command-center/geography/states'));
        const json = await res.json();
        if (json.success && json.data) {
          setStates(json.data);
        }
      } catch (err) {
        console.warn('Failed to load Indian states:', err);
      }
    };
    fetchStates();
  }, []);

  // --- 2. Load Districts for Selected State ---
  useEffect(() => {
    const fetchDistricts = async () => {
      try {
        const res = await fetch(getApiUrl(\`/api/command-center/geography/districts?state_id=\${selectedState}\`));
        const json = await res.json();
        if (json.success && json.data) {
          setDistricts(json.data);
          const exists = json.data.some(d => d.id === selectedDistrict);
          if (!exists && json.data.length > 0) {
            setSelectedDistrict(json.data[0].id);
          }
        }
      } catch (err) {
        console.warn('Failed to load districts for state:', err);
      }
    };
    fetchDistricts();
  }, [selectedState]);

  // --- 3. Load District Telemetry on District Change ---
  const loadDistrictTelemetry = async (dId = selectedDistrict) => {
    setIsRefreshing(true);
    try {
      const ovRes = await fetch(getApiUrl(\`/api/command-center/overview?district_id=\${dId}\`));
      const ovJson = await ovRes.json();
      if (ovJson.success) setOverview(ovJson.data);

      const facRes = await fetch(getApiUrl(\`/api/command-center/facilities?district_id=\${dId}\`));
      const facJson = await facRes.json();
      if (facJson.success) {
        setFacilities(facJson.data);
        if (facJson.data.length > 0 && !selectedFacilityId) {
          setSelectedFacilityId(facJson.data[0].id);
        }
      }

      const altRes = await fetch(getApiUrl(\`/api/command-center/alerts?district_id=\${dId}\`));
      const altJson = await altRes.json();
      if (altJson.success) setAlerts(altJson.data);

      const rulRes = await fetch(getApiUrl(\`/api/command-center/rules?district_id=\${dId}\`));
      const rulJson = await rulRes.json();
      if (rulJson.success) setRules(rulJson.data);

      const fcRes = await fetch(getApiUrl(\`/api/command-center/forecasts?district_id=\${dId}\`));
      const fcJson = await fcRes.json();
      if (fcJson.success) setForecasts(fcJson.data);

      const reqRes = await fetch(getApiUrl(\`/api/command-center/requests?district_id=\${dId}\`));
      const reqJson = await reqRes.json();
      if (reqJson.success) setRequests(reqJson.data);

      const repRes = await fetch(getApiUrl(\`/api/command-center/reports/matrix?district_id=\${dId}&days=7\`));
      const repJson = await repRes.json();
      if (repJson.success) setReportsMatrix(repJson.data);

      const outRes = await fetch(getApiUrl(\`/api/command-center/outbreak/watch?district_id=\${dId}&cluster=\${outbreakCluster}&days=14\`));
      const outJson = await outRes.json();
      if (outJson.success) setOutbreakData(outJson.data);

      const audRes = await fetch(getApiUrl(\`/api/command-center/audit?district_id=\${dId}\`));
      const audJson = await audRes.json();
      if (audJson.success) setAuditLogs(audJson.data);

    } catch (err) {
      console.warn('Telemetry load failed:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (selectedDistrict) {
      loadDistrictTelemetry(selectedDistrict);
    }
  }, [selectedDistrict]);

  useEffect(() => {
    if (selectedFacilityId) {
      const fetchDetail = async () => {
        try {
          const res = await fetch(getApiUrl(\`/api/command-center/facility/\${selectedFacilityId}\`));
          const json = await res.json();
          if (json.success) setFacilityDetail(json.data);
        } catch (err) {
          console.warn('Failed to load facility detail:', err);
        }
      };
      fetchDetail();
    }
  }, [selectedFacilityId]);

  useEffect(() => {
    if (selectedDistrict) {
      const fetchOutbreak = async () => {
        try {
          const res = await fetch(getApiUrl(\`/api/command-center/outbreak/watch?district_id=\${selectedDistrict}&cluster=\${outbreakCluster}&days=14\`));
          const json = await res.json();
          if (json.success) setOutbreakData(json.data);
        } catch (err) {
          console.warn('Failed to load outbreak data:', err);
        }
      };
      fetchOutbreak();
    }
  }, [outbreakCluster]);

  // --- Handlers ---
  const handleAlertAction = async (alertId, newStatus) => {
    try {
      let snoozeReason = '';
      let snoozeUntil = '';
      if (newStatus === 'snoozed') {
        snoozeReason = prompt('Enter justification for snoozing alert (Required for audit compliance):');
        if (!snoozeReason) return;
        snoozeUntil = new Date(Date.now() + 4 * 3600000).toISOString();
      }

      const res = await fetch(getApiUrl(\`/api/command-center/alerts/\${alertId}/status\`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          districtId: selectedDistrict,
          status: newStatus,
          actor: \`dho_\${actorRole}\`,
          snoozeReason,
          snoozeUntil
        })
      });
      const json = await res.json();
      if (json.success) {
        showToastMsg(\`✓ Alert marked as '\${newStatus}'. Logged in district audit trail.\`);
        loadDistrictTelemetry(selectedDistrict);
      }
    } catch (err) {
      showToastMsg('⚠️ Failed to update alert status.');
    }
  };

  const handleApplyPreset = async (presetName) => {
    try {
      const res = await fetch(getApiUrl('/api/command-center/rules/preset'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          districtId: selectedDistrict,
          preset: presetName,
          actor: \`dho_\${actorRole}\`
        })
      });
      const json = await res.json();
      if (json.success) {
        showToastMsg(\`✓ Applied seasonal preset '\${presetName}' district-wide!\`);
        loadDistrictTelemetry(selectedDistrict);
      }
    } catch (err) {
      showToastMsg('⚠️ Failed to apply seasonal preset.');
    }
  };

  const handleSendReminder = async (facilityId, facilityName) => {
    try {
      const res = await fetch(getApiUrl('/api/command-center/reports/remind'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ facilityId, actor: \`dho_\${actorRole}\` })
      });
      const json = await res.json();
      if (json.success) {
        showToastMsg(\`🔔 Urgent SLA reminder dispatched to \${facilityName}!\`);
      }
    } catch (err) {
      showToastMsg('⚠️ Failed to dispatch reminder.');
    }
  };

  const handleApproveRequest = async (requestId) => {
    try {
      const res = await fetch(getApiUrl(\`/api/command-center/requests/\${requestId}/status\`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'approved',
          actor: \`dho_\${actorRole}\`,
          notes: 'Approved for immediate emergency ambulance / cargo transfer dispatch.'
        })
      });
      const json = await res.json();
      if (json.success) {
        showToastMsg(\`✓ Request \${requestId} APPROVED! Digital dispatch authorized.\`);
        loadDistrictTelemetry(selectedDistrict);
      }
    } catch (err) {
      showToastMsg('⚠️ Failed to approve transfer request.');
    }
  };

  const handleFindDonors = async () => {
    const facId = recommenderFacId || (facilities[0]?.id || 'fac_01');
    setRecommenderLoading(true);
    try {
      const res = await fetch(getApiUrl(\`/api/command-center/transfers/recommend?facility_id=\${facId}&resource_id=\${recommenderResource}&quantity=\${recommenderQty}\`));
      const json = await res.json();
      if (json.success) {
        setRecommendations(json.data);
      }
    } catch (err) {
      showToastMsg('⚠️ Could not compute donor recommendations.');
    } finally {
      setRecommenderLoading(false);
    }
  };

  const handleCreateTransferFromDonor = async (donor) => {
    const facId = recommenderFacId || (facilities[0]?.id || 'fac_01');
    const shortageFac = facilities.find(f => f.id === facId);
    try {
      const res = await fetch(getApiUrl('/api/command-center/requests'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          districtId: selectedDistrict,
          type: 'transfer',
          fromFacilityId: donor.fromFacilityId,
          fromFacilityName: donor.fromFacilityName,
          toFacilityId: facId,
          toFacilityName: shortageFac?.name || facId,
          resourceId: recommenderResource,
          resourceName: recommenderResource.replace(/_/g, ' ').toUpperCase(),
          quantityRequested: Math.min(recommenderQty, donor.surplusAvailable),
          urgency: 'emergency',
          notes: \`AI Recommender optimal route: \${donor.distanceKm} km, ~\${donor.estimatedTravelMinutes} mins.\`,
          createdBy: \`dho_\${actorRole}\`
        })
      });
      const json = await res.json();
      if (json.success) {
        showToastMsg(\`✓ Transfer request \${json.data.id} created from \${donor.fromFacilityName}!\`);
        loadDistrictTelemetry(selectedDistrict);
      }
    } catch (err) {
      showToastMsg('⚠️ Failed to initiate transfer request.');
    }
  };

  const handleExportCsv = () => {
    if (!facilities.length) return;
    const headers = ['Facility ID', 'Name', 'Type', 'Taluka', 'Total Beds', 'Occupied Beds', 'Total ICU', 'Occupied ICU', 'Stress Level', 'Last Reported', 'Stale >24h'];
    const rows = facilities.map(f => [
      f.id,
      \`"\${f.name}"\`,
      f.type,
      \`"\${f.taluka}"\`,
      f.bedsTotal,
      f.bedsOccupied,
      f.icuTotal,
      f.icuOccupied,
      f.stressLevel,
      f.lastReportedAt,
      f.isStale ? 'YES' : 'NO'
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', \`MedVeda_\${selectedDistrict}_Report_\${new Date().toISOString().split('T')[0]}.csv\`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToastMsg('✓ Exported comprehensive district CSV report!');
  };

  // Filtered alerts
  const filteredAlerts = alerts.filter(a => {
    if (alertFilter === 'CRITICAL') return a.severity === 'critical';
    if (alertFilter === 'WARNING') return a.severity === 'warning';
    if (alertFilter === 'OPEN') return a.status === 'open';
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-800 flex flex-col font-sans selection:bg-[#0b2b82] selection:text-white">

      {/* --- TOP MISSION CONTROL HEADER & GEOGRAPHY BAR (White & Blue Theme) --- */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm backdrop-blur-md bg-opacity-95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">

            {/* Left Brand & Badge */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onBackToHome}
                className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-all shrink-0 text-xs flex items-center gap-1"
                title="Back to MedVeda Portal"
              >
                ← Home
              </button>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#0b2b82] via-[#092268] to-[#0284c7] flex items-center justify-center text-xl text-white shadow-md shadow-blue-900/10 shrink-0">
                  🛰️
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-base font-black text-slate-900 tracking-tight leading-none">
                      MedVeda District Command Center
                    </h1>
                    <span className="text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-full bg-blue-50 text-[#0b2b82] border border-blue-200 uppercase">
                      MV-DAC • SIH 2026
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-[11px] font-mono text-emerald-700 font-bold uppercase tracking-wider">
                      Surveillance Grid Live
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      Role: District Health Officer (DHO) / Administrator
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Pan-India Geography Selector Controls */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* State Dropdown */}
              <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 shadow-xs">
                <span className="text-[11px] font-bold text-slate-500 uppercase">State:</span>
                <select
                  value={selectedState}
                  onChange={(e) => setSelectedState(e.target.value)}
                  className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
                >
                  {states.map((st) => (
                    <option key={st.id} value={st.id} className="text-slate-900">
                      {st.name} ({st.region})
                    </option>
                  ))}
                </select>
              </div>

              {/* District Dropdown */}
              <div className="flex items-center gap-1.5 bg-blue-50/70 border border-blue-200 rounded-xl px-3 py-1.5 shadow-xs">
                <span className="text-[11px] font-bold text-[#0b2b82] uppercase">District:</span>
                <select
                  value={selectedDistrict}
                  onChange={(e) => setSelectedDistrict(e.target.value)}
                  className="bg-transparent text-xs font-black text-[#0b2b82] focus:outline-none cursor-pointer"
                >
                  {districts.map((d) => (
                    <option key={d.id} value={d.id} className="text-slate-900">
                      {d.name} {d.healthTier ? \`[\${d.healthTier.toUpperCase()}]\` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Refresh Telemetry Button */}
              <button
                type="button"
                onClick={() => loadDistrictTelemetry(selectedDistrict)}
                disabled={isRefreshing}
                className="px-3.5 py-1.5 rounded-xl bg-[#0b2b82] hover:bg-[#082269] text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
              >
                <span className={\`inline-block text-sm \${isRefreshing ? 'animate-spin' : ''}\`}>🔄</span>
                <span>{isRefreshing ? 'Syncing...' : 'Sync'}</span>
              </button>
            </div>

          </div>
        </div>

        {/* --- 8 SUB-VIEWS NAVIGATION TAB BAR --- */}
        <div className="border-t border-slate-200 bg-slate-50/80 px-4 sm:px-6 overflow-x-auto scrollbar-none">
          <div className="max-w-7xl mx-auto flex items-center gap-1.5 py-1.5 min-w-max">
            {[
              { id: 's1_overview', label: '📊 S1: Overview & Grid', badge: overview?.criticalAlerts ? \`\${overview.criticalAlerts} CRIT\` : null, badgeColor: 'bg-red-50 text-red-700 border-red-200' },
              { id: 's2_facilities', label: '🏥 S2: Hospital Drill-Down' },
              { id: 's3_reports', label: '📋 S3: Reporting SLA Matrix', badge: overview?.missingReportCount ? \`\${overview.missingReportCount} Stale\` : null, badgeColor: 'bg-amber-50 text-amber-800 border-amber-200' },
              { id: 's4_rules', label: '⚙️ S4: Rules & Presets' },
              { id: 's5_alerts', label: '🔔 S5: Alerts & Forecasts', count: alerts.filter(a => a.status === 'open').length },
              { id: 's6_outbreak', label: '🦠 S6: Outbreak Watch (EARS)', badge: 'CDC EARS + AI', badgeColor: 'bg-blue-50 text-[#0b2b82] border-blue-200' },
              { id: 's7_transfers', label: '🔄 S7: Transfer Requests', count: requests.filter(r => r.status === 'submitted').length },
              { id: 's8_audit', label: '🛡️ S8: Audit Trail' }
            ].map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={\`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 \${active
                    ? 'bg-[#0b2b82] text-white shadow-sm font-black'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white border border-transparent'
                  }\`}
                >
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span className={\`text-[9px] px-1.5 py-0.2 rounded-full border font-mono font-bold \${tab.badgeColor || 'bg-slate-100 text-slate-700'}\`}>
                      {tab.badge}
                    </span>
                  )}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className={\`text-[9px] px-1.5 py-0.2 rounded-full font-mono font-bold \${active ? 'bg-blue-200 text-[#0b2b82]' : 'bg-blue-50 text-[#0b2b82] border border-blue-200'}\`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* --- TOAST NOTIFICATION BANNER --- */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-white border border-blue-200 text-slate-900 px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2">
          <span className="text-xl">✨</span>
          <span className="text-xs font-bold">{toast}</span>
        </div>
      )}

      {/* --- MAIN DASHBOARD BODY CONTAINER --- */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">

        {/* =========================================================================
            SUB-VIEW S1: DISTRICT OVERVIEW & SURVEILLANCE GRID
        ========================================================================= */}
        {activeTab === 's1_overview' && (
          <div className="space-y-6">

            {/* Critical Alert Banner (If Any) */}
            {overview && overview.criticalAlerts > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center text-lg text-white animate-pulse shadow-sm">
                    🚨
                  </div>
                  <div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-red-900">
                      CRITICAL DISTRICT SURVEILLANCE ALERT ({overview.criticalAlerts} ACTIVE)
                    </h3>
                    <p className="text-xs text-red-800 font-medium mt-0.5">
                      Oxygen & ICU capacity depleted in {overview.criticalFacilities.join(', ') || 'District Center'}. Immediate diversion or transfer protocol required.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('s5_alerts')}
                  className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase shrink-0 transition-all shadow-sm"
                >
                  Inspect Alerts →
                </button>
              </div>
            )}

            {/* 5 High-Impact KPI Tiles (White Cards) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">

              {/* Tile 1: General Beds */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Beds Capacity</span>
                <div className="flex items-baseline justify-between mt-1.5">
                  <span className="text-2xl font-black text-slate-900">{overview?.totalBeds || 0}</span>
                  <span className="text-xs font-bold text-[#0284c7]">{overview?.availableBedsPercent || 0}% Free</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2.5 overflow-hidden">
                  <div
                    className="bg-[#0284c7] h-1.5 rounded-full transition-all duration-500"
                    style={{ width: \`\${overview?.availableBedsPercent || 0}%\` }}
                  ></div>
                </div>
                <span className="text-[11px] text-slate-500 font-mono mt-1.5 block">
                  {overview?.availableBeds || 0} vacant beds in district
                </span>
              </div>

              {/* Tile 2: ICU Capacity */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">ICU & Critical Beds</span>
                <div className="flex items-baseline justify-between mt-1.5">
                  <span className="text-2xl font-black text-slate-900">{overview?.totalIcuBeds || 0}</span>
                  <span className={\`text-xs font-bold \${(overview?.availableIcuPercent || 0) < 20 ? 'text-red-600' : 'text-amber-600'}\`}>
                    {overview?.availableIcuPercent || 0}% Free
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2.5 overflow-hidden">
                  <div
                    className={\`h-1.5 rounded-full transition-all duration-500 \${(overview?.availableIcuPercent || 0) < 20 ? 'bg-red-500' : 'bg-amber-500'}\`}
                    style={{ width: \`\${overview?.availableIcuPercent || 0}%\` }}
                  ></div>
                </div>
                <span className="text-[11px] text-slate-500 font-mono mt-1.5 block">
                  {overview?.availableIcuBeds || 0} ICU beds available
                </span>
              </div>

              {/* Tile 3: Facilities in Crisis */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Stressed Facilities</span>
                <div className="flex items-baseline justify-between mt-1.5">
                  <span className="text-2xl font-black text-red-600">
                    {overview?.criticalFacilities.length || 0}
                  </span>
                  <span className="text-xs font-mono text-slate-400">of {overview?.totalFacilities || 0} Total</span>
                </div>
                <div className="flex items-center gap-1.5 mt-3 text-[11px] text-slate-600">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>
                  <span className="truncate">{overview?.criticalFacilities[0] || 'All Facilities Nominal'}</span>
                </div>
              </div>

              {/* Tile 4: Epidemic Signals */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Outbreak Signals</span>
                <div className="flex items-baseline justify-between mt-1.5">
                  <span className="text-2xl font-black text-[#0b2b82]">
                    {overview?.activeOutbreakClusters || 0}
                  </span>
                  <span className="text-xs font-bold text-blue-600">CDC EARS</span>
                </div>
                <span className="text-[11px] text-slate-500 font-mono mt-3 block">
                  Active spatial clustering watch
                </span>
              </div>

              {/* Tile 5: Delinquent Reports */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Missing 24h Reports</span>
                <div className="flex items-baseline justify-between mt-1.5">
                  <span className="text-2xl font-black text-amber-600">
                    {overview?.missingReportCount || 0}
                  </span>
                  <span className="text-xs font-bold text-slate-400">SLA Breach</span>
                </div>
                <span className="text-[11px] text-slate-500 font-mono mt-3 block">
                  {overview?.facilitiesReporting || 0}/{overview?.totalFacilities || 0} submitted
                </span>
              </div>

            </div>

            {/* District Health Grid: Live Hospital Nodes (White Card) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-base font-black text-slate-900 tracking-tight">
                    District Facility Surveillance Grid ({overview?.districtName || 'Hazaribagh'}, {overview?.stateName || 'Jharkhand'})
                  </h2>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Live operational telemetry from District Hospital, Sub-District Hospitals, CHCs, and PHCs.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5"
                  >
                    <span>📥</span>
                    <span>Export CSV</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('s7_transfers')}
                    className="px-3.5 py-1.5 rounded-xl bg-[#0b2b82] hover:bg-[#082269] text-white text-xs font-bold transition-all shadow-sm"
                  >
                    Transfer Recommender →
                  </button>
                </div>
              </div>

              {/* Facilities Grid Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {facilities.map((fac) => {
                  const isCrit = fac.stressLevel === 'critical';
                  const isMod = fac.stressLevel === 'moderate';
                  const bedOccupancyPct = fac.bedsTotal > 0 ? Math.round((fac.bedsOccupied / fac.bedsTotal) * 100) : 0;
                  const icuOccupancyPct = fac.icuTotal > 0 ? Math.round((fac.icuOccupied / fac.icuTotal) * 100) : 0;

                  return (
                    <div
                      key={fac.id}
                      className={\`bg-slate-50/70 hover:bg-white border rounded-2xl p-4 transition-all hover:border-blue-300 relative flex flex-col justify-between shadow-xs hover:shadow-md \${isCrit ? 'border-red-300' : isMod ? 'border-amber-300' : 'border-slate-200'}\`}
                    >
                      <div>
                        {/* Header: Name & Type */}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-50 text-[#0b2b82] border border-blue-200">
                              {fac.type}
                            </span>
                            <h3 className="text-sm font-black text-slate-900 mt-1 leading-snug line-clamp-1">
                              {fac.name}
                            </h3>
                            <span className="text-[11px] text-slate-500 font-mono">
                              {fac.taluka} • Phone: {fac.phone}
                            </span>
                          </div>
                          <span
                            className={\`text-[10px] font-extrabold px-2 py-0.5 rounded-full border uppercase \${isCrit ? 'bg-red-50 text-red-700 border-red-200 animate-pulse' : isMod ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}\`}
                          >
                            {fac.stressLevel}
                          </span>
                        </div>

                        {/* Bed & ICU Meters */}
                        <div className="space-y-2 text-xs mt-3 bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs">
                          <div>
                            <div className="flex justify-between text-[11px] font-mono text-slate-700 mb-1">
                              <span>General Beds:</span>
                              <span className="font-bold text-slate-900">{fac.bedsOccupied}/{fac.bedsTotal} ({bedOccupancyPct}%)</span>
                            </div>
                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={\`h-1.5 rounded-full \${bedOccupancyPct >= 85 ? 'bg-red-500' : bedOccupancyPct >= 70 ? 'bg-amber-400' : 'bg-[#0b2b82]'}\`}
                                style={{ width: \`\${bedOccupancyPct}%\` }}
                              ></div>
                            </div>
                          </div>

                          {fac.icuTotal > 0 && (
                            <div>
                              <div className="flex justify-between text-[11px] font-mono text-slate-700 mb-1">
                                <span>ICU Capacity:</span>
                                <span className={\`font-bold \${icuOccupancyPct >= 80 ? 'text-red-600' : 'text-slate-900'}\`}>
                                  {fac.icuOccupied}/{fac.icuTotal} ({icuOccupancyPct}%)
                                </span>
                              </div>
                              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className={\`h-1.5 rounded-full \${icuOccupancyPct >= 80 ? 'bg-red-500' : 'bg-amber-500'}\`}
                                  style={{ width: \`\${icuOccupancyPct}%\` }}
                                ></div>
                              </div>
                            </div>
                          )}
                        </div>

                        {fac.isStale && (
                          <div className="mt-2.5 text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1 flex items-center justify-between">
                            <span>⚠️ Stale: No update in &gt;24h</span>
                            <button
                              type="button"
                              onClick={() => handleSendReminder(fac.id, fac.name)}
                              className="underline font-bold hover:text-amber-950"
                            >
                              Remind Now
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-200/80 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400 font-mono">
                          Updated: {fac.lastReportedAt ? new Date(fac.lastReportedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending'}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedFacilityId(fac.id);
                            setActiveTab('s2_facilities');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#0b2b82] border border-blue-200 text-[11px] font-bold transition-all"
                        >
                          Inspect Detail →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

        {/* =========================================================================
            SUB-VIEW S2: FACILITY DRILL-DOWN
        ========================================================================= */}
        {activeTab === 's2_facilities' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="text-xl">🏥</span>
                <div>
                  <h2 className="text-sm font-black text-slate-900">Select Health Facility to Inspect</h2>
                  <p className="text-xs text-slate-500">Drill down into bed occupancy, live supply stores, and contact logs.</p>
                </div>
              </div>
              <select
                value={selectedFacilityId}
                onChange={(e) => setSelectedFacilityId(e.target.value)}
                className="bg-slate-50 border border-blue-200 text-[#0b2b82] text-xs font-bold rounded-xl px-3 py-2 cursor-pointer focus:outline-none"
              >
                {facilities.map(f => (
                  <option key={f.id} value={f.id}>
                    [{f.type}] {f.name} ({f.taluka})
                  </option>
                ))}
              </select>
            </div>

            {facilityDetail && facilityDetail.facility && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left Card: Hospital Profile & Contacts */}
                <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
                  <div>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-50 text-[#0b2b82] border border-blue-200">
                      {facilityDetail.facility.type} • {facilityDetail.facility.taluka}
                    </span>
                    <h3 className="text-base font-black text-slate-900 mt-2">
                      {facilityDetail.facility.name}
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Registered in MedVeda Health Grid: {new Date(facilityDetail.facility.registeredAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Chief Medical Supt:</span>
                      <span className="font-bold text-slate-900">{facilityDetail.facility.contactPerson}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Emergency Landline:</span>
                      <span className="font-mono text-[#0b2b82] font-bold">{facilityDetail.facility.phone}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500 font-medium">Stress Status:</span>
                      <span className="font-bold uppercase text-red-600">{facilityDetail.facility.stressLevel}</span>
                    </div>
                  </div>

                  {/* Ward Bed Capacities */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                      Ward Bed Breakdown
                    </h4>
                    {facilityDetail.beds.map((b) => (
                      <div key={b.id} className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                        <div className="flex justify-between font-mono mb-1 text-slate-700">
                          <span className="uppercase">{b.wardType} Ward</span>
                          <span className="font-bold text-slate-900">{b.occupied}/{b.totalCapacity} ({b.occupancyRatePct}%)</span>
                        </div>
                        <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                          <div
                            className={\`h-2 rounded-full \${b.occupancyRatePct >= 80 ? 'bg-red-500' : 'bg-[#0b2b82]'}\`}
                            style={{ width: \`\${b.occupancyRatePct}%\` }}
                          ></div>
                        </div>
                        <span className="text-[10px] text-slate-500 mt-1 block">Free beds: {b.free}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right 2 Columns: Live Critical Stock Inventory & Days of Cover */}
                <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-sm font-black text-slate-900">Live Supply & Therapeutics Stock Status</h3>
                      <p className="text-xs text-slate-500">Tracked daily consumption velocity and remaining buffer.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setRecommenderFacId(selectedFacilityId);
                        setActiveTab('s7_transfers');
                      }}
                      className="px-3.5 py-1.5 rounded-xl bg-[#0b2b82] hover:bg-[#082269] text-white text-xs font-bold transition-all shadow-sm"
                    >
                      Request Stock Transfer →
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-500 uppercase font-mono text-[10px]">
                        <tr>
                          <th className="p-3">Resource / Drug</th>
                          <th className="p-3">Category</th>
                          <th className="p-3">Current Stock</th>
                          <th className="p-3">Daily Usage</th>
                          <th className="p-3">Days Cover</th>
                          <th className="p-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono">
                        {facilityDetail.stocks.map((stk) => {
                          const isLow = stk.daysOfCoverRemaining <= 3;
                          const isWarn = stk.daysOfCoverRemaining <= 7 && !isLow;

                          return (
                            <tr key={stk.id} className="hover:bg-slate-50/70">
                              <td className="p-3 font-bold text-slate-900 font-sans">{stk.resourceName}</td>
                              <td className="p-3 uppercase text-slate-500">{stk.category}</td>
                              <td className="p-3 font-bold text-[#0b2b82]">{stk.currentQuantity} {stk.unit}</td>
                              <td className="p-3 text-slate-600">{stk.dailyUsageEst} {stk.unit}/day</td>
                              <td className="p-3 font-black text-slate-900">
                                {stk.daysOfCoverRemaining} days
                              </td>
                              <td className="p-3">
                                <span className={\`px-2 py-0.5 rounded text-[10px] font-bold uppercase \${isLow ? 'bg-red-50 text-red-700 border border-red-200' : isWarn ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}\`}>
                                  {isLow ? 'CRITICAL' : isWarn ? 'WARNING' : 'NOMINAL'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            SUB-VIEW S3: REPORTING COMPLIANCE & SLA TRACKER
        ========================================================================= */}
        {activeTab === 's3_reports' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-base font-black text-slate-900">
                    Facility Reporting SLA Compliance Matrix (Last 7 Days)
                  </h2>
                  <p className="text-xs text-slate-500">
                    Mandatory 24-hour bed and stock snapshot submission tracking across {reportsMatrix?.facilities.length || 0} facilities.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-2"
                >
                  <span>📥</span>
                  <span>Export District SLA CSV</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-mono text-[10px]">
                    <tr>
                      <th className="p-3">Facility</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Last Submission</th>
                      <th className="p-3">SLA Status</th>
                      <th className="p-3">Compliance Rate</th>
                      <th className="p-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reportsMatrix?.facilities.map((fac) => (
                      <tr key={fac.facilityId} className="hover:bg-slate-50/70">
                        <td className="p-3 font-bold text-slate-900">{fac.facilityName}</td>
                        <td className="p-3 font-mono text-slate-500">{fac.type}</td>
                        <td className="p-3 font-mono text-slate-600">
                          {fac.lastReportedAt ? new Date(fac.lastReportedAt).toLocaleString() : 'Never Reported'}
                        </td>
                        <td className="p-3">
                          {fac.isStale ? (
                            <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 font-mono text-[10px] font-bold">
                              BREACH (>24H)
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono text-[10px] font-bold">
                              COMPLIANT
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-mono text-[#0b2b82] font-black">
                          {fac.isStale ? '85.7%' : '100%'}
                        </td>
                        <td className="p-3">
                          <button
                            type="button"
                            onClick={() => handleSendReminder(fac.facilityId, fac.facilityName)}
                            className="px-3 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold text-[11px] transition-all"
                          >
                            Send Urgent Reminder
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            SUB-VIEW S4: RULES & THRESHOLDS CONFIGURATION
        ========================================================================= */}
        {activeTab === 's4_rules' && (
          <div className="space-y-6">

            {/* Seasonal Presets Quick Action Bar (Blue Gradient) */}
            <div className="bg-gradient-to-r from-blue-50 via-indigo-50/60 to-blue-50 border border-blue-200 rounded-2xl p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-black text-slate-900">Seasonal Demand & Epidemic Buffer Presets</h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    1-Click re-calibration of district minimums and target buffers for seasonal disease burdens.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('monsoon_fevers')}
                    className="px-3 py-1.5 rounded-xl bg-[#0b2b82] hover:bg-[#082269] text-white text-xs font-bold transition-all shadow-sm"
                  >
                    🌧️ Monsoon Fevers (2x Buffer)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('dengue_peak')}
                    className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-all shadow-sm"
                  >
                    🦟 Dengue Peak (2x IV Fluids)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('respiratory_winter')}
                    className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition-all shadow-sm"
                  >
                    ❄️ Winter Respiratory (1.5x Oxygen)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('standard')}
                    className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold transition-all"
                  >
                    Standard Baseline
                  </button>
                </div>
              </div>
            </div>

            {/* Rules Table */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-black text-slate-900">Active Threshold Rules & Reorder Invariants</h3>
                  <p className="text-xs text-slate-500">Rules evaluated automatically on every snapshot ingestion.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRuleModal(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-[#0b2b82] hover:bg-[#082269] text-white text-xs font-bold transition-all shadow-sm"
                >
                  + Add Custom Rule
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-mono text-[10px]">
                    <tr>
                      <th className="p-3">Resource / Item</th>
                      <th className="p-3">Scope</th>
                      <th className="p-3">Min Level</th>
                      <th className="p-3">Reorder Point</th>
                      <th className="p-3">Target Buffer</th>
                      <th className="p-3">Days Cover SLA</th>
                      <th className="p-3">Severity</th>
                      <th className="p-3">Preset</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {rules.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/70">
                        <td className="p-3 font-bold text-slate-900 font-sans">{r.resourceName}</td>
                        <td className="p-3 text-slate-500">
                          {r.facilityId ? \`Facility: \${r.facilityId}\` : 'District Default'}
                        </td>
                        <td className="p-3 text-red-600 font-bold">{r.minimumLevel}</td>
                        <td className="p-3 text-amber-600">{r.reorderLevel}</td>
                        <td className="p-3 text-[#0b2b82] font-black">{r.targetBuffer}</td>
                        <td className="p-3 text-slate-800 font-bold">{r.daysOfCoverMin} days</td>
                        <td className="p-3">
                          <span className={\`px-2 py-0.5 rounded text-[10px] font-bold uppercase \${r.severity === 'critical' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}\`}>
                            {r.severity}
                          </span>
                        </td>
                        <td className="p-3 text-slate-500 uppercase">{r.seasonalPreset || 'standard'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Rule Modal */}
            {showRuleModal && (
              <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
                  <h3 className="text-base font-black text-slate-900">Configure Resource Threshold Rule</h3>
                  <div className="space-y-3 text-xs">
                    <div>
                      <label className="text-slate-600 font-bold block mb-1">Resource Name:</label>
                      <input
                        type="text"
                        value={ruleFormData.resourceName}
                        onChange={(e) => setRuleFormData({ ...ruleFormData, resourceName: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-semibold focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-slate-600 font-bold block mb-1">Min Level:</label>
                        <input
                          type="number"
                          value={ruleFormData.minimumLevel}
                          onChange={(e) => setRuleFormData({ ...ruleFormData, minimumLevel: Number(e.target.value) })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-semibold focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-slate-600 font-bold block mb-1">Reorder Point:</label>
                        <input
                          type="number"
                          value={ruleFormData.reorderLevel}
                          onChange={(e) => setRuleFormData({ ...ruleFormData, reorderLevel: Number(e.target.value) })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-semibold focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-slate-600 font-bold block mb-1">Target Buffer:</label>
                        <input
                          type="number"
                          value={ruleFormData.targetBuffer}
                          onChange={(e) => setRuleFormData({ ...ruleFormData, targetBuffer: Number(e.target.value) })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-semibold focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-slate-600 font-bold block mb-1">Min Days of Cover:</label>
                      <input
                        type="number"
                        value={ruleFormData.daysOfCoverMin}
                        onChange={(e) => setRuleFormData({ ...ruleFormData, daysOfCoverMin: Number(e.target.value) })}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-900 font-semibold focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-3">
                    <button
                      type="button"
                      onClick={() => setShowRuleModal(false)}
                      className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        const newRule = {
                          ...ruleFormData,
                          id: \`rule_\${Date.now()}\`,
                          districtId: selectedDistrict,
                          facilityId: null,
                          isActive: true,
                          cooldownMinutes: 60,
                          seasonalPreset: 'standard',
                          updatedBy: \`dho_\${actorRole}\`,
                          updatedAt: new Date().toISOString()
                        };
                        const res = await fetch(getApiUrl('/api/command-center/rules'), {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(newRule)
                        });
                        if (res.ok) {
                          setShowRuleModal(false);
                          showToastMsg('✓ Configured threshold rule successfully!');
                          loadDistrictTelemetry(selectedDistrict);
                        }
                      }}
                      className="px-4 py-2 rounded-xl bg-[#0b2b82] text-white text-xs font-black shadow-sm"
                    >
                      Save Rule
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

        {/* =========================================================================
            SUB-VIEW S5: ALERTS & PREDICTIVE SHORTAGE FORECASTS
        ========================================================================= */}
        {activeTab === 's5_alerts' && (
          <div className="space-y-6">

            {/* Shortage Forecast Prediction Horizon Panel (White & Blue) */}
            <div className="bg-white border border-blue-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📈</span>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">
                      AI Shortage Forecast Engine (7–14 Days Forward Horizon)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Predicts depletion dates using Weighted Moving Average with 90% confidence bands.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold px-3 py-1 rounded-full bg-blue-50 text-[#0b2b82] border border-blue-200">
                  {forecasts.length} Resources Tracked
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {forecasts.map((fc, idx) => (
                  <div key={idx} className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-3 shadow-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-black text-slate-900">{fc.resourceName}</h4>
                        <span className="text-[11px] text-slate-500 font-mono">
                          Current Stock: {fc.currentQuantity} • Burn Rate: {fc.dailyUsageEst}/day
                        </span>
                      </div>
                      <span className={\`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase \${fc.isCritical ? 'bg-red-50 text-red-700 border border-red-200 animate-pulse' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}\`}>
                        {fc.isCritical ? 'CRITICAL STOCK-OUT' : 'ADEQUATE COVER'}
                      </span>
                    </div>

                    <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1.5 text-xs font-mono">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Projected Stock-out Date:</span>
                        <span className="font-extrabold text-red-600">
                          {fc.projectedStockoutDate || 'Sufficient (>14 days)'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Days Remaining:</span>
                        <span className="font-bold text-[#0b2b82]">{fc.daysUntilStockout || '>14'} days</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Model Confidence:</span>
                        <span className="text-slate-700">{(fc.confidence * 100).toFixed(0)}% (WMA)</span>
                      </div>
                    </div>

                    {fc.isCritical && (
                      <button
                        type="button"
                        onClick={() => {
                          setRecommenderFacId(fc.facilityId);
                          setActiveTab('s7_transfers');
                        }}
                        className="w-full py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition-all shadow-sm"
                      >
                        Initiate Emergency Transfer Protocol →
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Live Alerts Feed */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-black text-slate-900">Active District Alert Triage Stream</h3>
                  <p className="text-xs text-slate-500">Deduplicated & cooldown-regulated alert lifecycle.</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {['ALL', 'CRITICAL', 'WARNING', 'OPEN'].map(flt => (
                    <button
                      key={flt}
                      type="button"
                      onClick={() => setAlertFilter(flt)}
                      className={\`px-2.5 py-1 rounded-lg text-xs font-bold transition-all \${alertFilter === flt ? 'bg-[#0b2b82] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}\`}
                    >
                      {flt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                {filteredAlerts.map((alt) => {
                  const isCrit = alt.severity === 'critical';
                  const isExpanded = expandedAlertId === alt.id;

                  return (
                    <div
                      key={alt.id}
                      className={\`bg-slate-50/70 border rounded-2xl p-4 transition-all shadow-xs \${isCrit ? 'border-red-200 border-l-4 border-l-red-500' : 'border-slate-200'}\`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={\`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase \${isCrit ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}\`}>
                              {alt.severity}
                            </span>
                            <span className="text-[10px] font-mono text-slate-500 uppercase">
                              Type: {alt.type} • {alt.facilityName || 'District-Wide'}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {new Date(alt.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                          <h4 className="text-xs font-black text-slate-900">{alt.headline}</h4>
                          <p className="text-xs text-slate-600 leading-relaxed">{alt.summaryText}</p>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 shrink-0">
                          {alt.status === 'open' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleAlertAction(alt.id, 'acknowledged')}
                                className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-[#0b2b82] text-xs font-bold border border-slate-200 transition-all shadow-xs"
                              >
                                Acknowledge
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAlertAction(alt.id, 'snoozed')}
                                className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold border border-amber-200 transition-all"
                              >
                                Snooze
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAlertAction(alt.id, 'resolved')}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm"
                              >
                                Resolve
                              </button>
                            </>
                          )}
                          {alt.status !== 'open' && (
                            <span className="text-xs font-mono font-bold uppercase text-slate-600 bg-slate-100 px-3 py-1 rounded-xl">
                              {alt.status}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Expandable "Why Flagged" Details */}
                      <div className="mt-3 pt-3 border-t border-slate-200/80 flex items-center justify-between text-xs">
                        <button
                          type="button"
                          onClick={() => setExpandedAlertId(isExpanded ? null : alt.id)}
                          className="text-[#0b2b82] hover:underline font-bold"
                        >
                          {isExpanded ? 'Hide Clinical Reasoning ▴' : 'View Clinical & Statistical Rationale ▾'}
                        </button>
                        <span className="text-[10px] text-slate-400 font-mono">Deduplication Key: {alt.dedupKey}</span>
                      </div>

                      {isExpanded && (
                        <div className="mt-2.5 p-3.5 rounded-xl bg-white border border-slate-200 text-xs space-y-2 text-slate-700 animate-in fade-in shadow-xs">
                          <div>
                            <span className="font-bold text-slate-900 block">Why Flagged:</span>
                            <p className="text-slate-600 text-[11px] mt-0.5">{alt.whyFlagged}</p>
                          </div>
                          {alt.suggestedAction && (
                            <div>
                              <span className="font-bold text-[#0b2b82] block">Suggested Field Action:</span>
                              <p className="text-slate-700 text-[11px] mt-0.5">{alt.suggestedAction}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

        {/* =========================================================================
            SUB-VIEW S6: OUTBREAK WATCH (CDC EARS / CUSUM + GEMINI BRIEF)
        ========================================================================= */}
        {activeTab === 's6_outbreak' && (
          <div className="space-y-6">

            {/* Outbreak Overview Header & Cluster Selector (White Card) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🦠</span>
                  <div>
                    <h3 className="text-base font-black text-slate-900">
                      Epidemic Early Warning System (CDC EARS C1/C2/C3 + CUSUM + DBSCAN)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Automated statistical aberration detection across syndromic disease clusters.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-bold">Syndrome:</span>
                  <select
                    value={outbreakCluster}
                    onChange={(e) => setOutbreakCluster(e.target.value)}
                    className="bg-slate-50 border border-blue-200 text-[#0b2b82] text-xs font-bold rounded-xl px-3 py-2 cursor-pointer focus:outline-none"
                  >
                    <option value="acute_fever_rash">Acute Fever with Rash (Dengue/Chikungunya)</option>
                    <option value="acute_diarrhoeal">Acute Diarrhoeal Disease (Cholera/Gastro)</option>
                    <option value="sari">Severe Acute Respiratory Illness (SARI)</option>
                    <option value="malaria_like">Malaria-like Fever Spike</option>
                  </select>
                </div>
              </div>

              {/* Statistical Metrics Row */}
              {outbreakData && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-mono text-slate-500 uppercase">Today's Incidence</span>
                    <span className="text-xl font-black text-slate-900 block mt-1">{outbreakData.currentCount} cases</span>
                    <span className="text-[11px] text-[#0b2b82] font-mono font-bold">District Aggregate</span>
                  </div>
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-mono text-slate-500 uppercase">7-Day Baseline</span>
                    <span className="text-xl font-black text-slate-700 block mt-1">{outbreakData.baselineMean} ± {outbreakData.baselineStd}</span>
                    <span className="text-[11px] text-slate-500 font-mono">Normal Variance</span>
                  </div>
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-mono text-slate-500 uppercase">CDC EARS Z-Score</span>
                    <span className="text-xl font-black text-[#0b2b82] block mt-1">{outbreakData.zScore}</span>
                    <span className={\`text-[10px] font-mono font-bold uppercase \${outbreakData.c1Triggered ? 'text-red-600' : 'text-emerald-600'}\`}>
                      {outbreakData.c1Triggered ? '🚨 >3.0 Sigma Breach' : 'Normal'}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                    <span className="text-[10px] font-mono text-slate-500 uppercase">CUSUM Creep Value</span>
                    <span className="text-xl font-black text-amber-600 block mt-1">{outbreakData.cusumValue}</span>
                    <span className="text-[10px] font-mono text-amber-700 font-bold uppercase">
                      {outbreakData.cusumThresholdExceeded ? 'Creep Detected' : 'Below Threshold'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Gemini AI Chief Epidemiological Briefing Box (White & Blue Themed) */}
            {outbreakData && (
              <div className="bg-gradient-to-br from-blue-50/80 via-sky-50/50 to-white border-2 border-blue-200 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#0b2b82] to-[#0284c7] flex items-center justify-center text-xl text-white font-black shadow-md shadow-blue-900/10">
                    🤖
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <span>Gemini AI Chief Epidemiologist: Situational Brief</span>
                      <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-blue-100 text-[#0b2b82] border border-blue-300 uppercase">
                        AI-Grounded Analysis
                      </span>
                    </h3>
                    <p className="text-xs text-slate-600">
                      Automated risk assessment and response protocol generated from statistical aberration vectors.
                    </p>
                  </div>
                </div>

                <div className="bg-white/90 p-4 rounded-xl border border-blue-200 text-xs text-slate-800 leading-relaxed font-sans shadow-xs">
                  {outbreakData.situationalBrief}
                </div>

                {outbreakData.recommendedActions && outbreakData.recommendedActions.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-black text-[#0b2b82] uppercase tracking-wider font-mono">
                      Immediate District Action Protocols:
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {outbreakData.recommendedActions.map((act, i) => (
                        <div key={i} className="bg-white border border-blue-100 rounded-xl p-3 text-xs text-slate-700 flex items-start gap-2.5 shadow-xs">
                          <span className="w-5 h-5 rounded-full bg-blue-100 text-[#0b2b82] border border-blue-200 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          <span className="leading-snug">{act}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        )}

        {/* =========================================================================
            SUB-VIEW S7: INTER-HOSPITAL TRANSFERS & PROCUREMENT
        ========================================================================= */}
        {activeTab === 's7_transfers' && (
          <div className="space-y-6">

            {/* AI Surplus Transfer Recommender Interactive Card (White & Blue) */}
            <div className="bg-white border border-blue-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <span>🧠 Surplus Transfer Recommender Engine</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 text-[#0b2b82] border border-blue-200 uppercase font-bold">
                    Haversine Transit Solver
                  </span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Automatically pairs shortage hospitals with closest donor facilities with surplus above their minimum safety buffer.
                </p>
              </div>

              {/* Selector Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Shortage Hospital:</label>
                  <select
                    value={recommenderFacId}
                    onChange={(e) => setRecommenderFacId(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-lg p-2 font-bold focus:outline-none"
                  >
                    {facilities.map(f => (
                      <option key={f.id} value={f.id}>[{f.type}] {f.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Needed Resource:</label>
                  <select
                    value={recommenderResource}
                    onChange={(e) => setRecommenderResource(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-lg p-2 font-bold focus:outline-none"
                  >
                    <option value="oxygen_cylinders">Oxygen Cylinders (B-type)</option>
                    <option value="paracetamol_500mg">Paracetamol 500mg Tabs</option>
                    <option value="blood_o_pos">Blood O+ Units</option>
                    <option value="iv_fluids_ns">IV Fluids NS (500ml)</option>
                    <option value="artesunate_inj">Artesunate Injections</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Quantity Needed:</label>
                  <input
                    type="number"
                    value={recommenderQty}
                    onChange={(e) => setRecommenderQty(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 text-slate-800 text-xs rounded-lg p-2 font-bold focus:outline-none"
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={handleFindDonors}
                    disabled={recommenderLoading}
                    className="w-full py-2 rounded-lg bg-[#0b2b82] hover:bg-[#082269] text-white font-black text-xs transition-all shadow-sm"
                  >
                    {recommenderLoading ? 'Solving Routes...' : 'Find Optimal Donors 🚀'}
                  </button>
                </div>
              </div>

              {/* Recommendations Display */}
              {recommendations && (
                <div className="space-y-3 pt-2">
                  <div className="bg-blue-50 p-3.5 rounded-xl border border-blue-200 text-xs text-slate-800 leading-relaxed font-sans">
                    <span className="font-bold text-[#0b2b82] block mb-1">Gemini Logistics Brief:</span>
                    {recommendations.mitigationNarrative}
                  </div>

                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider font-mono">
                    Ranked Donor Hospitals:
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {recommendations.recommendations.map((donor, idx) => (
                      <div key={idx} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2.5 shadow-xs">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-[10px] font-mono font-bold text-[#0b2b82]">Rank #{idx + 1} Donor</span>
                            <h5 className="text-xs font-black text-slate-900">{donor.fromFacilityName}</h5>
                          </div>
                          <span className="text-[10px] font-mono bg-white text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                            {donor.distanceKm} km
                          </span>
                        </div>

                        <div className="text-[11px] font-mono text-slate-700 space-y-1">
                          <div className="flex justify-between">
                            <span>Surplus Capacity:</span>
                            <span className="font-bold text-[#0b2b82]">{donor.surplusAvailable} units</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Road Transit Time:</span>
                            <span className="font-bold text-slate-900">~{donor.estimatedTravelMinutes} mins</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Donor Retention:</span>
                            <span className="text-slate-500">{donor.remainingAfterTransfer} units</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleCreateTransferFromDonor(donor)}
                          className="w-full py-1.5 rounded-lg bg-[#0b2b82] hover:bg-[#082269] text-white font-bold text-xs transition-all shadow-sm"
                        >
                          Dispatch from this Donor →
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Active Requests Stream (White Table) */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-sm font-black text-slate-900">Active Inter-Hospital Transfer & Procurement Queue</h3>
                  <p className="text-xs text-slate-500">Tracked logistics from submission to arrival.</p>
                </div>
                <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-blue-50 text-[#0b2b82] border border-blue-200">
                  {requests.length} Requests Active
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-mono text-[10px]">
                    <tr>
                      <th className="p-3">Request ID</th>
                      <th className="p-3">Source Hospital</th>
                      <th className="p-3">Destination Hospital</th>
                      <th className="p-3">Resource & Qty</th>
                      <th className="p-3">Urgency</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {requests.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/70">
                        <td className="p-3 font-bold text-slate-900">{r.id}</td>
                        <td className="p-3 text-slate-700 font-sans">{r.fromFacilityName}</td>
                        <td className="p-3 text-[#0b2b82] font-sans font-bold">{r.toFacilityName}</td>
                        <td className="p-3 text-slate-900 font-bold">{r.quantityRequested} units of {r.resourceName}</td>
                        <td className="p-3">
                          <span className={\`px-2 py-0.5 rounded text-[10px] uppercase font-bold \${r.urgency === 'emergency' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}\`}>
                            {r.urgency}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={\`px-2 py-0.5 rounded text-[10px] uppercase font-bold \${r.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-700'}\`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="p-3">
                          {r.status === 'submitted' ? (
                            <button
                              type="button"
                              onClick={() => handleApproveRequest(r.id)}
                              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition-all shadow-xs"
                            >
                              Approve Dispatch
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400">Approved by {r.approvedBy || 'Admin'}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* =========================================================================
            SUB-VIEW S8: IMMUTABLE AUDIT TRAIL & SETTINGS
        ========================================================================= */}
        {activeTab === 's8_audit' && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-base font-black text-slate-900">Immutable District Activity & Compliance Audit Log</h3>
                <p className="text-xs text-slate-500">
                  Every configuration change, approval, and alert resolution is cryptographically recorded.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-500 uppercase font-mono text-[10px]">
                    <tr>
                      <th className="p-3">Timestamp</th>
                      <th className="p-3">User</th>
                      <th className="p-3">Action</th>
                      <th className="p-3">Entity</th>
                      <th className="p-3">Audit Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/70">
                        <td className="p-3 text-slate-500">{new Date(log.timestamp).toLocaleString()}</td>
                        <td className="p-3 text-slate-900 font-bold">{log.userId}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-blue-50 text-[#0b2b82] border border-blue-200 font-bold">
                            {log.action}
                          </span>
                        </td>
                        <td className="p-3 text-slate-700">{log.entity} ({log.entityId})</td>
                        <td className="p-3 text-slate-700 font-sans">{log.diffSummary}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
`;

// Replace ScreenCommandCenter block
const startMarker = '// ============================================================================\n// --- FEATURE 09: DISTRICT ADMIN COMMAND CENTER (MV-DAC) ---';
const endMarker = '// ==========================================\n// --- HOMEPAGE PRE-FOOTER BEATS BANNER ---';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
  content = content.substring(0, startIndex) + updatedWhiteBlueComponent.trim() + '\n\n' + content.substring(endIndex);
  fs.writeFileSync(appJsPath, content, 'utf8');
  console.log('Successfully updated ScreenCommandCenter to White & Blue theme in app.js');
} else {
  console.error('Could not find markers for replacement');
  process.exit(1);
}
