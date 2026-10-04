import fs from 'node:fs';
import path from 'node:path';

const componentCode = `function ScreenMedicineDiagnostics({
  actorRole,
  setActorRole,
  onBackToHome,
  onNavigateToCareNavigator,
  onNavigateToTeleconsult,
  onNavigateToReferrals,
  onNavigateToFollowUps,
  onNavigateToRecords
}) {
  const [activeTab, setActiveTab] = useState(
    actorRole === 'shop_owner'
      ? 'shop_owner'
      : actorRole === 'lab_staff'
        ? 'lab_dashboard'
        : actorRole === 'doctor'
          ? 'doctor_orders'
          : 'medicine_search'
  );

  const [notificationToast, setNotificationToast] = useState(null);

  const showToast = (msg) => {
    setNotificationToast(msg);
    setTimeout(() => setNotificationToast(null), 4000);
  };

  // --- Sub-View Mode inside Tab 1 (Medicine Search) ---
  // 'stock_search' | 'nearby_shops' | 'master_catalog'
  const [medSubView, setMedSubView] = useState('stock_search');

  // --- Live GPS Geolocation State ---
  const [userLocation, setUserLocation] = useState({
    lat: 23.998,
    lng: 85.345,
    label: 'Katkamsandi Rural PHC, Hazaribagh',
    isLiveGPS: false
  });
  const [gpsLoading, setGpsLoading] = useState(false);

  // Preset location hubs across Jharkhand & India
  const locationPresets = [
    { label: '📍 Katkamsandi Rural Hub (Hazaribagh)', lat: 23.998, lng: 85.345 },
    { label: '📍 Hazaribagh Sadar District Hub', lat: 23.993, lng: 85.362 },
    { label: '📍 Ranchi RIMS Medical College Corridor', lat: 23.372, lng: 85.352 },
    { label: '📍 Deoghar AIIMS Super-specialty Zone', lat: 24.485, lng: 86.702 },
    { label: '📍 Delhi NCR National Health Hub', lat: 28.6139, lng: 77.2090 }
  ];

  // --- Medicine Search States ---
  const [medSearchQuery, setMedSearchQuery] = useState('Paracetamol');
  const [medRadius, setMedRadius] = useState(25);
  const [medResults, setMedResults] = useState([]);
  const [medMessage, setMedMessage] = useState('');
  const [medIsFallback, setMedIsFallback] = useState(false);
  const [medLoading, setMedLoading] = useState(false);

  // --- Top Nearby Pharmacies State ---
  const [nearbyPharmacies, setNearbyPharmacies] = useState([]);
  const [pharmaciesLoading, setPharmaciesLoading] = useState(false);

  // --- Master Medicines Catalog State ---
  const [masterMedicines, setMasterMedicines] = useState([]);
  const [masterCategories, setMasterCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [masterSearchQuery, setMasterSearchQuery] = useState('');
  const [masterLoading, setMasterLoading] = useState(false);

  // --- Medicine Order Modal State & Digital Pickup Slip ---
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedMedItem, setSelectedMedItem] = useState(null);
  const [orderPatientName, setOrderPatientName] = useState('Ramesh Mahto');
  const [orderPatientPhone, setOrderPatientPhone] = useState('+91-94311-28901');
  const [orderPatientId, setOrderPatientId] = useState('MV-MED-2026-1024');
  const [orderQuantity, setOrderQuantity] = useState(10);
  const [confirmedOrderSlip, setConfirmedOrderSlip] = useState(null);

  // --- Shop Owner State ---
  const [allShops, setAllShops] = useState([]);
  const [activeShopId, setActiveShopId] = useState('shop_01');
  const [shopInventory, setShopInventory] = useState([]);
  const [shopOrders, setShopOrders] = useState([]);
  const [showAddMedModal, setShowAddMedModal] = useState(false);
  const [showEditMedModal, setShowEditMedModal] = useState(false);
  const [editingMedItem, setEditingMedItem] = useState(null);
  const [medForm, setMedForm] = useState({
    medicineName: '',
    genericName: '',
    dosageForm: 'Tablet',
    strength: '500mg',
    quantity: 100,
    status: 'in_stock',
    price: 25.0
  });

  // --- Diagnostic Search States ---
  const [diagSearchQuery, setDiagSearchQuery] = useState('Lipid Profile');
  const [diagRadius, setDiagRadius] = useState(30);
  const [diagCategoryFilter, setDiagCategoryFilter] = useState('ALL');
  const [diagResults, setDiagResults] = useState([]);
  const [diagMessage, setDiagMessage] = useState('');
  const [diagIsFallback, setDiagIsFallback] = useState(false);
  const [diagLoading, setDiagLoading] = useState(false);

  // --- Diagnostic Booking Modal State ---
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedTestItem, setSelectedTestItem] = useState(null);
  const [bookingPatientName, setBookingPatientName] = useState('Sunita Soren');
  const [bookingPatientPhone, setBookingPatientPhone] = useState('+91-98352-19203');
  const [bookingPatientId, setBookingPatientId] = useState('MV-MED-2026-2048');

  // --- Diagnostic Center Staff State ---
  const [allCenters, setAllCenters] = useState([]);
  const [activeCenterId, setActiveCenterId] = useState('center_01');
  const [centerCatalog, setCenterCatalog] = useState([]);
  const [centerOrders, setCenterOrders] = useState([]);
  const [showAddTestModal, setShowAddTestModal] = useState(false);
  const [showEditTestModal, setShowEditTestModal] = useState(false);
  const [editingTestItem, setEditingTestItem] = useState(null);
  const [testForm, setTestForm] = useState({
    testName: '',
    category: 'blood',
    status: 'available',
    turnaroundTime: 'Same Day (3 hours)',
    price: 150.0,
    fastingRequired: false,
    sampleType: 'Venous Blood'
  });

  // --- Doctor-Ordered Lab Orders Tracker State ---
  const [trackedOrders, setTrackedOrders] = useState([]);
  const [selectedOrderForStatus, setSelectedOrderForStatus] = useState(null);
  const [showUploadResultModal, setShowUploadResultModal] = useState(false);
  const [resultForm, setResultForm] = useState({
    clinicalSummary: 'Troponin-I cardiac biomarker within normal physiological range (<0.04 ng/mL). Acute STEMI excluded.',
    patientFriendlySummary: 'Your heart enzyme test is normal and shows no acute heart attack damage.',
    certifiedBy: 'Dr. S. K. Roy (MD Pathology, Reg: 44210)',
    parameters: [
      { name: 'Troponin-I High Sensitivity', value: '0.012', unit: 'ng/mL', referenceRange: '0.000 - 0.040', isAbnormal: false }
    ]
  });

  // Live GPS Handlers
  const handleGetLiveGPS = () => {
    if (!navigator.geolocation) {
      showToast('⚠️ Geolocation is not supported by your browser.');
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const newLoc = {
          lat: latitude,
          lng: longitude,
          label: \`Live GPS (\${latitude.toFixed(4)}°, \${longitude.toFixed(4)}° \${accuracy ? '±' + Math.round(accuracy) + 'm' : ''})\`,
          isLiveGPS: true
        };
        setUserLocation(newLoc);
        setGpsLoading(false);
        showToast(\`📍 GPS Located: \${latitude.toFixed(4)}°, \${longitude.toFixed(4)}°\`);
        searchMedicines(medSearchQuery, medRadius, latitude, longitude);
        loadNearbyPharmacies(latitude, longitude, medRadius);
      },
      (err) => {
        setGpsLoading(false);
        console.warn('Geolocation error:', err);
        showToast('⚠️ Location access denied. Using Katkamsandi Hub default.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  };

  const handleSelectPresetLocation = (preset) => {
    const newLoc = {
      lat: preset.lat,
      lng: preset.lng,
      label: preset.label,
      isLiveGPS: false
    };
    setUserLocation(newLoc);
    showToast(\`📍 Switched to \${preset.label}\`);
    searchMedicines(medSearchQuery, medRadius, preset.lat, preset.lng);
    loadNearbyPharmacies(preset.lat, preset.lng, medRadius);
  };

  // Load All Shops
  const loadShops = async () => {
    try {
      const res = await fetch(getApiUrl('/api/shops'));
      const json = await res.json();
      if (json.data) setAllShops(json.data);
    } catch (e) {
      console.warn('Load shops error:', e);
    }
  };

  // Load All Centers
  const loadCenters = async () => {
    try {
      const res = await fetch(getApiUrl('/api/diagnostic-centers'));
      const json = await res.json();
      if (json.data) setAllCenters(json.data);
    } catch (e) {
      console.warn('Load centers error:', e);
    }
  };

  // Search Medicines with GPS Coordinates
  const searchMedicines = async (
    q = medSearchQuery,
    rad = medRadius,
    lat = userLocation.lat,
    lng = userLocation.lng
  ) => {
    try {
      setMedLoading(true);
      const res = await fetch(
        getApiUrl(\`/api/medicine/search?query=\${encodeURIComponent(q)}&radius=\${rad}&lat=\${lat}&lng=\${lng}\`)
      );
      const json = await res.json();
      if (json.data) {
        setMedResults(json.data.results || []);
        setMedMessage(json.data.message || '');
        setMedIsFallback(Boolean(json.data.isFallback));
      }
    } catch (e) {
      console.warn('Search medicines error:', e);
    } finally {
      setMedLoading(false);
    }
  };

  // Load Top Nearby Pharmacies
  const loadNearbyPharmacies = async (
    lat = userLocation.lat,
    lng = userLocation.lng,
    rad = medRadius
  ) => {
    try {
      setPharmaciesLoading(true);
      const res = await fetch(
        getApiUrl(\`/api/pharmacies/nearby?lat=\${lat}&lng=\${lng}&radius=\${rad}\`)
      );
      const json = await res.json();
      if (json.data) {
        setNearbyPharmacies(json.data || []);
      }
    } catch (e) {
      console.warn('Load nearby pharmacies error:', e);
    } finally {
      setPharmaciesLoading(false);
    }
  };

  // Load Master Medicines Catalog & Categories
  const loadMasterCatalog = async (q = masterSearchQuery, cat = selectedCategory) => {
    try {
      setMasterLoading(true);
      const catParam = cat && cat !== 'ALL' ? \`&category=\${encodeURIComponent(cat)}\` : '';
      const res = await fetch(getApiUrl(\`/api/medicines/master?query=\${encodeURIComponent(q)}\${catParam}\`));
      const json = await res.json();
      if (json.data) {
        setMasterMedicines(json.data || []);
      }
    } catch (e) {
      console.warn('Load master medicines error:', e);
    } finally {
      setMasterLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const res = await fetch(getApiUrl('/api/medicines/categories'));
      const json = await res.json();
      if (json.data) {
        setMasterCategories(json.data || []);
      }
    } catch (e) {
      console.warn('Load categories error:', e);
    }
  };

  // Search Diagnostic Tests
  const searchDiagnosticTests = async (q = diagSearchQuery, rad = diagRadius) => {
    try {
      setDiagLoading(true);
      const res = await fetch(
        getApiUrl(\`/api/diagnostic/search?test=\${encodeURIComponent(q)}&radius=\${rad}\`)
      );
      const json = await res.json();
      if (json.data) {
        setDiagResults(json.data.results || []);
        setDiagMessage(json.data.message || '');
        setDiagIsFallback(Boolean(json.data.isFallback));
      }
    } catch (e) {
      console.warn('Search diagnostics error:', e);
    } finally {
      setDiagLoading(false);
    }
  };

  // Load Shop Inventory & Orders
  const loadShopData = async (sId = activeShopId) => {
    try {
      const invRes = await fetch(getApiUrl(\`/api/shop/\${sId}/inventory\`));
      const invJson = await invRes.json();
      if (invJson.data && invJson.data.items) {
        setShopInventory(invJson.data.items);
      }

      const ordRes = await fetch(getApiUrl(\`/api/shop/\${sId}/orders?actor_id=owner_pharma_1\`));
      const ordJson = await ordRes.json();
      if (ordJson.data) {
        setShopOrders(ordJson.data);
      }
    } catch (e) {
      console.warn('Load shop data error:', e);
    }
  };

  // Load Diagnostic Center Catalog & Orders
  const loadCenterData = async (cId = activeCenterId) => {
    try {
      const catRes = await fetch(getApiUrl(\`/api/diagnostic-center/\${cId}/tests\`));
      const catJson = await catRes.json();
      if (catJson.data && catJson.data.tests) {
        setCenterCatalog(catJson.data.tests);
      }

      const ordRes = await fetch(
        getApiUrl(\`/api/diagnostic-center/\${cId}/orders?actor_id=owner_lab_1\`)
      );
      const ordJson = await ordRes.json();
      if (ordJson.data) {
        setCenterOrders(ordJson.data);
        setTrackedOrders(ordJson.data);
        if (ordJson.data.length > 0 && !selectedOrderForStatus) {
          setSelectedOrderForStatus(ordJson.data[0]);
        }
      }
    } catch (e) {
      console.warn('Load center data error:', e);
    }
  };

  useEffect(() => {
    loadShops();
    loadCenters();
    loadCategories();
    searchMedicines('Paracetamol', 25, userLocation.lat, userLocation.lng);
    loadNearbyPharmacies(userLocation.lat, userLocation.lng, 25);
    loadMasterCatalog('', 'ALL');
    searchDiagnosticTests('Lipid Profile', 30);
  }, []);

  useEffect(() => {
    const h = window.location.hash;
    if (h === '#shop-owner' || actorRole === 'shop_owner') setActiveTab('shop_owner');
    else if (h === '#lab-staff' || actorRole === 'lab_staff') setActiveTab('lab_dashboard');
    else if (h === '#diagnostic') setActiveTab('diagnostic_search');
    else if (h === '#doctor-orders' || h === '#diagnostic-orders' || actorRole === 'doctor') setActiveTab('doctor_orders');
    else if (h === '#medicine' || h === '#feature6') setActiveTab('medicine_search');
  }, [actorRole]);

  useEffect(() => {
    if (activeTab === 'shop_owner') {
      loadShopData(activeShopId);
    }
  }, [activeTab, activeShopId]);

  useEffect(() => {
    if (activeTab === 'lab_dashboard' || activeTab === 'doctor_orders') {
      loadCenterData(activeCenterId);
    }
  }, [activeTab, activeCenterId]);

  // Handle Medicine Order Placement
  const handlePlaceMedicineOrder = async (e) => {
    e.preventDefault();
    if (!selectedMedItem) return;

    try {
      const res = await fetch(getApiUrl('/api/medicine/order'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: orderPatientId,
          patientName: orderPatientName,
          patientPhone: orderPatientPhone,
          shopId: selectedMedItem.shop.shopId,
          inventoryId: selectedMedItem.medicine.inventoryId,
          quantityRequested: Number(orderQuantity)
        })
      });
      const json = await res.json();
      if (json.success) {
        setShowOrderModal(false);
        setConfirmedOrderSlip({
          ...json.data,
          shop: selectedMedItem.shop,
          medicine: selectedMedItem.medicine
        });
        showToast(\`🎉 Order reserved! Pickup Token: \${json.data.orderId}\`);
        loadShopData(selectedMedItem.shop.shopId);
      } else {
        showToast(\`⚠️ Order error: \${json.error}\`);
      }
    } catch (err) {
      showToast('⚠️ Failed to submit order reservation.');
    }
  };

  // Handle Diagnostic Direct Booking
  const handlePlaceDiagnosticBooking = async (e) => {
    e.preventDefault();
    if (!selectedTestItem) return;

    try {
      const res = await fetch(getApiUrl('/api/diagnostic/book'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: bookingPatientId,
          patientName: bookingPatientName,
          patientPhone: bookingPatientPhone,
          centerId: selectedTestItem.center.centerId,
          testOfferingId: selectedTestItem.test.testOfferingId
        })
      });
      const json = await res.json();
      if (json.success) {
        setShowBookingModal(false);
        showToast(\`🎉 Diagnostic test booked at \${selectedTestItem.center.name}! Order ID: \${json.data.orderId}\`);
        loadCenterData(selectedTestItem.center.centerId);
      } else {
        showToast(\`⚠️ Booking error: \${json.error}\`);
      }
    } catch (err) {
      showToast('⚠️ Failed to book diagnostic test.');
    }
  };

  // Handle Add Medicine (Shop Owner)
  const handleAddMedicine = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(getApiUrl(\`/api/shop/\${activeShopId}/inventory\`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actor: { id: 'owner_pharma_1', role: 'shop_owner', shopId: activeShopId },
          ...medForm
        })
      });
      const json = await res.json();
      if (json.success) {
        setShowAddMedModal(false);
        showToast(\`✓ Added '\${json.data.medicineName}' to inventory.\`);
        loadShopData(activeShopId);
        searchMedicines(medSearchQuery, medRadius, userLocation.lat, userLocation.lng);
      } else {
        showToast(\`⚠️ RBAC / Error: \${json.error}\`);
      }
    } catch (err) {
      showToast('⚠️ Failed to add medicine.');
    }
  };

  // Handle Update Medicine (Shop Owner)
  const handleUpdateMedicine = async (e) => {
    e.preventDefault();
    if (!editingMedItem) return;

    try {
      const res = await fetch(
        getApiUrl(\`/api/shop/\${activeShopId}/inventory/\${editingMedItem.inventoryId}\`),
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            actor: { id: 'owner_pharma_1', role: 'shop_owner', shopId: activeShopId },
            ...medForm
          })
        }
      );
      const json = await res.json();
      if (json.success) {
        setShowEditMedModal(false);
        showToast(\`✓ Updated stock for '\${json.data.medicineName}'.\`);
        loadShopData(activeShopId);
        searchMedicines(medSearchQuery, medRadius, userLocation.lat, userLocation.lng);
      } else {
        showToast(\`⚠️ RBAC / Error: \${json.error}\`);
      }
    } catch (err) {
      showToast('⚠️ Failed to update medicine.');
    }
  };

  // Handle Delete Medicine (Shop Owner)
  const handleDeleteMedicine = async (invId) => {
    if (!window.confirm('Remove this medicine from your shop inventory?')) return;
    try {
      const res = await fetch(getApiUrl(\`/api/shop/\${activeShopId}/inventory/\${invId}\`), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actor: { id: 'owner_pharma_1', role: 'shop_owner', shopId: activeShopId }
        })
      });
      const json = await res.json();
      if (json.success) {
        showToast('✓ Medicine removed from inventory.');
        loadShopData(activeShopId);
        searchMedicines(medSearchQuery, medRadius, userLocation.lat, userLocation.lng);
      }
    } catch (err) {
      showToast('⚠️ Failed to remove medicine.');
    }
  };

  // Handle Confirm Order (Shop Owner)
  const handleUpdateOrderStatus = async (orderId, status, notes) => {
    try {
      const res = await fetch(getApiUrl(\`/api/shop/\${activeShopId}/orders/\${orderId}\`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actor: { id: 'owner_pharma_1', role: 'shop_owner', shopId: activeShopId },
          status,
          ownerNotes: notes
        })
      });
      const json = await res.json();
      if (json.success) {
        showToast(
          status === 'confirmed'
            ? '✓ Order confirmed! Patient notified for pickup.'
            : 'Order marked as unavailable.'
        );
        loadShopData(activeShopId);
      }
    } catch (err) {
      showToast('⚠️ Failed to update order status.');
    }
  };

  // Handle Add Diagnostic Test (Lab Staff)
  const handleAddTest = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(getApiUrl(\`/api/diagnostic-center/\${activeCenterId}/tests\`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actor: { id: 'owner_lab_1', role: 'lab_staff', centerId: activeCenterId },
          ...testForm
        })
      });
      const json = await res.json();
      if (json.success) {
        setShowAddTestModal(false);
        showToast(\`✓ Added test '\${json.data.testName}' to catalog.\`);
        loadCenterData(activeCenterId);
        searchDiagnosticTests();
      } else {
        showToast(\`⚠️ RBAC / Error: \${json.error}\`);
      }
    } catch (err) {
      showToast('⚠️ Failed to add test.');
    }
  };

  // Handle Diagnostic Status Advance (Lab Staff)
  const handleAdvanceOrderStatus = async (orderId, newStatus, customResultData) => {
    try {
      const res = await fetch(getApiUrl(\`/api/diagnostic/order/\${orderId}/status\`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          centerId: activeCenterId,
          actor: { id: 'owner_lab_1', role: 'lab_staff', centerId: activeCenterId },
          status: newStatus,
          resultData: customResultData
        })
      });
      const json = await res.json();
      if (json.success) {
        showToast(\`✓ Order status advanced to '\${newStatus}'.\`);
        setSelectedOrderForStatus(json.data);
        loadCenterData(activeCenterId);
      }
    } catch (err) {
      showToast('⚠️ Failed to update diagnostic status.');
    }
  };

  const activeShopObj = allShops.find((s) => s.shopId === activeShopId) || allShops[0];
  const activeCenterObj = allCenters.find((c) => c.centerId === activeCenterId) || allCenters[0];

  return (
    <div className="space-y-6">
      {/* Toast Notification Alert */}
      {notificationToast && (
        <div className="fixed top-16 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-teal-500/40 flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <span className="text-xl">🔔</span>
          <span className="text-xs font-bold">{notificationToast}</span>
        </div>
      )}

      {/* Feature Header Banner */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
            <span className="text-[10px] font-black uppercase tracking-widest text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
              FEATURE MAP 06 &bull; MEDICINE AVAILABILITY &amp; DIAGNOSTIC COORDINATION
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Medicine Availability &amp; Diagnostic Grid
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1 max-w-2xl leading-relaxed">
            Live GPS nearby pharmacy stock search, 24x7 chemist locator, Jan Aushadhi generic substitution savings, zero-payment counter reservations, and diagnostic coordination.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToHome}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors flex items-center gap-1.5"
          >
            <span>🏠 Home</span>
          </button>
        </div>
      </div>

      {/* Primary Module Navigation Tabs */}
      <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-1 overflow-x-auto text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab('medicine_search')}
          className={\`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 shrink-0 \${activeTab === 'medicine_search'
            ? 'bg-teal-600 text-white shadow-md font-black'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }\`}
        >
          <span>💊</span>
          <span>Medicine Stock &amp; Nearby Shops</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('shop_owner')}
          className={\`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 shrink-0 \${activeTab === 'shop_owner'
            ? 'bg-slate-900 text-white shadow-md font-black'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }\`}
        >
          <span>🏪</span>
          <span>Medical Shop Dashboard (Owner CRUD)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('diagnostic_search')}
          className={\`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 shrink-0 \${activeTab === 'diagnostic_search'
            ? 'bg-purple-600 text-white shadow-md font-black'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }\`}
        >
          <span>🔬</span>
          <span>Diagnostic Test Search (Direct Booking)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('lab_dashboard')}
          className={\`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 shrink-0 \${activeTab === 'lab_dashboard'
            ? 'bg-indigo-600 text-white shadow-md font-black'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }\`}
        >
          <span>🧪</span>
          <span>Diagnostic Center Staff Dashboard</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('doctor_orders')}
          className={\`px-4 py-2.5 rounded-xl transition-all flex items-center gap-2 shrink-0 \${activeTab === 'doctor_orders'
            ? 'bg-emerald-600 text-white shadow-md font-black'
            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }\`}
        >
          <span>📋</span>
          <span>Doctor-Ordered Lab Tracker</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: MEDICINE SEARCH (PATIENT / FRONTLINE WORKER VIEW) */}
      {/* ========================================================= */}
      {activeTab === 'medicine_search' && (
        <div className="space-y-6">
          {/* Live GPS & Location Selector Hub */}
          <div className="bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-teal-700/40 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-teal-300">
                    LIVE GPS LOCATION ENGINE &bull; ALL-INDIA RADIUS
                  </span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                  <span>📍</span>
                  <span>{userLocation.label}</span>
                </h3>
                <p className="text-xs text-teal-200/80 font-medium">
                  Lat: <span className="font-mono">{userLocation.lat.toFixed(4)}</span> &bull; Lng: <span className="font-mono">{userLocation.lng.toFixed(4)}</span> &bull; {userLocation.isLiveGPS ? '🟢 Active Device GPS' : '⚪ Preset Location Hub'}
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleGetLiveGPS}
                  disabled={gpsLoading}
                  className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <span>{gpsLoading ? '⏳' : '🎯'}</span>
                  <span>{gpsLoading ? 'Detecting GPS...' : 'Use My Live GPS'}</span>
                </button>

                <div className="relative inline-block text-left">
                  <select
                    onChange={(e) => {
                      const sel = locationPresets.find((p) => p.label === e.target.value);
                      if (sel) handleSelectPresetLocation(sel);
                    }}
                    value={locationPresets.find((p) => p.lat === userLocation.lat && p.lng === userLocation.lng)?.label || ''}
                    className="bg-slate-800 text-white border border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold focus:ring-2 focus:ring-teal-400"
                  >
                    <option value="" disabled>Switch Location Hub...</option>
                    {locationPresets.map((p) => (
                      <option key={p.label} value={p.label}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Sub-View Switcher inside Medicine Discovery */}
            <div className="pt-3 border-t border-teal-700/50 flex items-center gap-2 flex-wrap text-xs">
              <span className="text-[10px] font-black uppercase text-teal-300 tracking-wider">BROWSE MODE:</span>
              <button
                type="button"
                onClick={() => setMedSubView('stock_search')}
                className={\`px-3.5 py-1.5 rounded-xl font-bold transition-all \${medSubView === 'stock_search'
                  ? 'bg-white text-teal-900 shadow-md font-black'
                  : 'bg-teal-950/60 text-teal-200 hover:bg-teal-900'
                  }\`}
              >
                🔍 Live Medicine Stock Search
              </button>
              <button
                type="button"
                onClick={() => {
                  setMedSubView('nearby_shops');
                  loadNearbyPharmacies(userLocation.lat, userLocation.lng, medRadius);
                }}
                className={\`px-3.5 py-1.5 rounded-xl font-bold transition-all \${medSubView === 'nearby_shops'
                  ? 'bg-white text-teal-900 shadow-md font-black'
                  : 'bg-teal-950/60 text-teal-200 hover:bg-teal-900'
                  }\`}
              >
                🏪 Top Nearby Medicine Shops ({nearbyPharmacies.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setMedSubView('master_catalog');
                  loadMasterCatalog('', selectedCategory);
                }}
                className={\`px-3.5 py-1.5 rounded-xl font-bold transition-all \${medSubView === 'master_catalog'
                  ? 'bg-white text-teal-900 shadow-md font-black'
                  : 'bg-teal-950/60 text-teal-200 hover:bg-teal-900'
                  }\`}
              >
                📖 Master Essential Catalog &amp; Jan Aushadhi Savings
              </button>
            </div>
          </div>

          {/* ===================================================== */}
          {/* SUB-VIEW 1: LIVE MEDICINE STOCK SEARCH (CHEMISTS)    */}
          {/* ===================================================== */}
          {medSubView === 'stock_search' && (
            <div className="space-y-6">
              {/* Search Controls */}
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-xl font-black text-slate-900">Nearby Stock Discovery &amp; Substitution</h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Real-time inventory lookup across registered chemists in your radius with generic cost comparisons.
                    </p>
                  </div>
                  <span className="text-[10px] font-black uppercase text-teal-800 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
                    Live Chemist Inventory &bull; Real Haversine Proximity
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
                  <div className="sm:col-span-3">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                      Medicine Brand / Generic Molecule
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={medSearchQuery}
                        onChange={(e) => setMedSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && searchMedicines(medSearchQuery, medRadius, userLocation.lat, userLocation.lng)}
                        placeholder="e.g. Paracetamol, Telmisartan, Metformin, Ecosprin, Salbutamol..."
                        className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-2xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-teal-500 bg-slate-50/50"
                      />
                      <span className="absolute left-3.5 top-3.5 text-slate-400 text-base">🔍</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                      Search Radius
                    </label>
                    <select
                      value={medRadius}
                      onChange={(e) => {
                        const r = Number(e.target.value);
                        setMedRadius(r);
                        searchMedicines(medSearchQuery, r, userLocation.lat, userLocation.lng);
                        loadNearbyPharmacies(userLocation.lat, userLocation.lng, r);
                      }}
                      className="w-full py-3 px-3 border border-slate-300 rounded-2xl text-xs font-bold text-slate-900 bg-white"
                    >
                      <option value="5">Within 5 km (Walking / Local)</option>
                      <option value="15">Within 15 km (Block Level)</option>
                      <option value="25">Within 25 km (District Hub)</option>
                      <option value="50">Within 50 km (Regional Corridor)</option>
                      <option value="150">Within 150 km (State Grid)</option>
                    </select>
                  </div>
                </div>

                {/* Quick Keyword Chips */}
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Quick Searches:</span>
                  {['Paracetamol', 'Telmisartan', 'Metformin', 'Ecosprin', 'Amoxicillin', 'Salbutamol Inhaler', 'Tenecteplase', 'Pantoprazole'].map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => {
                        setMedSearchQuery(q);
                        searchMedicines(q, medRadius, userLocation.lat, userLocation.lng);
                      }}
                      className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 hover:bg-teal-50 hover:text-teal-700 text-slate-700 transition-colors"
                    >
                      + {q}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search Feedback / Non-Empty Fallback Alert */}
              {medMessage && (
                <div
                  className={\`p-4 rounded-2xl border flex items-center justify-between text-xs gap-3 \${medIsFallback
                    ? 'bg-amber-50 border-amber-300 text-amber-900'
                    : 'bg-teal-50 border-teal-200 text-teal-900'
                    }\`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">{medIsFallback ? '⚠️' : '✓'}</span>
                    <span className="font-bold">{medMessage}</span>
                  </div>
                  {medIsFallback && (
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-amber-200 text-amber-800 rounded">
                      Out-of-Radius Fallback Activated
                    </span>
                  )}
                </div>
              )}

              {/* Medicine Results Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {medResults.map((item, idx) => {
                  const med = item.medicine;
                  const shop = item.shop;
                  const isInStock = med.status === 'in_stock' && med.quantity > 0;
                  const isLowStock = isInStock && med.quantity <= 10;
                  const isOutOfStock = !isInStock;

                  return (
                    <div
                      key={idx}
                      className={\`bg-white rounded-3xl p-6 border transition-all flex flex-col justify-between space-y-4 hover:shadow-md \${isInStock ? 'border-slate-200 hover:border-teal-400' : 'border-red-200 bg-red-50/20'
                        }\`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-lg font-black text-slate-900">{med.medicineName}</h4>
                              <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md">
                                {med.dosageForm || 'Tablet'} &bull; {med.strength || 'Standard'}
                              </span>
                            </div>
                            {med.genericName && (
                              <div className="text-xs text-slate-500 font-medium mt-0.5">
                                Generic Molecule: <strong className="text-slate-800">{med.genericName}</strong>
                              </div>
                            )}
                          </div>

                          <div className="text-right shrink-0">
                            {med.price !== undefined && (
                              <div className="text-base font-black text-slate-900">₹{med.price.toFixed(2)}</div>
                            )}
                            <span
                              className={\`text-[10px] font-black uppercase px-2 py-0.5 rounded-full inline-block mt-0.5 \${isLowStock
                                ? 'bg-amber-100 text-amber-800'
                                : isInStock
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-red-100 text-red-800'
                                }\`}
                            >
                              {isLowStock
                                ? \`⚠️ Low Stock (\${med.quantity} left)\`
                                : isInStock
                                  ? \`✓ In Stock (\${med.quantity})\`
                                  : '✗ Out of Stock'}
                            </span>
                          </div>
                        </div>

                        {/* Jan Aushadhi Generic Savings Banner */}
                        {item.genericSavingsPercent && item.genericSavingsPercent > 0 && (
                          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between text-xs text-emerald-900">
                            <div className="flex items-center gap-2">
                              <span>💡</span>
                              <span className="font-bold">
                                Jan Aushadhi generic available at ₹{item.genericSubstitutePrice}
                              </span>
                            </div>
                            <span className="text-[10px] font-black uppercase bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded">
                              Save {item.genericSavingsPercent}%!
                            </span>
                          </div>
                        )}

                        {/* Out of Stock Alert & Proximity Fallback Notice */}
                        {isOutOfStock && (
                          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 space-y-1">
                            <div className="font-bold flex items-center gap-1.5">
                              <span>⚠️</span>
                              <span>Not currently in stock at {shop.name}</span>
                            </div>
                            <div className="text-[11px] text-red-700">
                              Try searching with wider radius or reserve at alternate verified chemists shown in the directory.
                            </div>
                          </div>
                        )}

                        {/* Shop Information Card */}
                        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <strong className="text-slate-900">{shop.name}</strong>
                              {item.isOpen24_7 && (
                                <span className="text-[9px] font-black uppercase bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                                  24x7
                                </span>
                              )}
                            </div>
                            <span className="font-mono font-bold text-teal-700">
                              📍 {item.distanceKm} km
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500">{shop.location.address}</div>
                          <div className="text-[10px] text-slate-400 pt-1 flex items-center justify-between border-t border-slate-200/60">
                            <span>📞 {item.phone || shop.contactNumber}</span>
                            <span>⭐ {item.rating || 4.5} rating</span>
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          disabled={!isInStock}
                          onClick={() => {
                            setSelectedMedItem(item);
                            setOrderQuantity(Math.min(10, med.quantity || 1));
                            setShowOrderModal(true);
                          }}
                          className={\`flex-1 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1.5 \${isInStock
                            ? 'bg-teal-600 hover:bg-teal-700 text-white shadow-sm'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            }\`}
                        >
                          <span>📦</span>
                          <span>Reserve for Counter Pickup</span>
                        </button>

                        <a
                          href={\`tel:\${item.phone || shop.contactNumber}\`}
                          className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center gap-1"
                        >
                          <span>📞</span>
                          <span>Call</span>
                        </a>

                        <a
                          href={\`https://www.google.com/maps/search/?api=1&query=\${encodeURIComponent(shop.name + ' ' + shop.location.address)}\`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center gap-1"
                        >
                          <span>🗺️</span>
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ===================================================== */}
          {/* SUB-VIEW 2: TOP NEARBY MEDICINE SHOPS DIRECTORY      */}
          {/* ===================================================== */}
          {medSubView === 'nearby_shops' && (
            <div className="space-y-6">
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h3 className="text-xl font-black text-slate-900">Top Nearby Medicine Shops &amp; 24x7 Chemists</h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      Ranked by real Haversine distance from your current location ({userLocation.label}).
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold bg-teal-50 text-teal-800 px-3 py-1 rounded-full border border-teal-200">
                      {nearbyPharmacies.length} Licensed Pharmacies Found
                    </span>
                  </div>
                </div>

                {pharmaciesLoading ? (
                  <div className="p-12 text-center text-slate-400 text-xs">
                    ⏳ Calculating proximity across state grid...
                  </div>
                ) : nearbyPharmacies.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl">
                    No pharmacies found within {medRadius} km. Expand your radius filter above.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                    {nearbyPharmacies.map((pharm) => {
                      const isJanAushadhi = pharm.type.toLowerCase().includes('jan aushadhi');
                      const isOpen24 = Boolean(pharm.isOpen24_7);

                      return (
                        <div
                          key={pharm.id}
                          className="bg-white rounded-3xl p-5 border border-slate-200 hover:border-teal-400 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                        >
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span
                                  className={\`text-[9px] font-black uppercase px-2 py-0.5 rounded-full inline-block mb-1 \${isJanAushadhi
                                    ? 'bg-amber-100 text-amber-800'
                                    : isOpen24
                                      ? 'bg-purple-100 text-purple-800'
                                      : 'bg-teal-50 text-teal-700'
                                    }\`}
                                >
                                  {pharm.type}
                                </span>
                                <h4 className="text-base font-black text-slate-900">{pharm.name}</h4>
                              </div>
                              <span className="font-mono font-bold text-xs text-teal-700 bg-teal-50 px-2.5 py-1 rounded-xl border border-teal-200 shrink-0">
                                📍 {pharm.distanceKm} km
                              </span>
                            </div>

                            <p className="text-xs text-slate-600 line-clamp-2">
                              {pharm.address}, {pharm.city}, {pharm.district}
                            </p>

                            <div className="space-y-1.5 text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                              <div className="flex items-center justify-between">
                                <span className="font-medium">Operating Hours:</span>
                                <span className={\`font-bold \${isOpen24 ? 'text-purple-700' : 'text-slate-800'}\`}>
                                  {isOpen24 ? '🟢 24 Hours Open' : pharm.openingHours}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="font-medium">Rating:</span>
                                <span className="font-bold text-amber-600">⭐ {pharm.rating} ({pharm.reviewCount || 45} reviews)</span>
                              </div>
                              {pharm.homeDelivery && (
                                <div className="text-[10px] text-emerald-700 font-bold">
                                  🛵 Home Delivery Available within 5 km
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                            <a
                              href={\`tel:\${pharm.phone}\`}
                              className="flex-1 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm"
                            >
                              <span>📞</span>
                              <span>Call Chemist</span>
                            </a>

                            <a
                              href={\`https://www.google.com/maps/search/?api=1&query=\${encodeURIComponent(pharm.name + ' ' + pharm.address)}\`}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center gap-1"
                            >
                              <span>🗺️ Directions</span>
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===================================================== */}
          {/* SUB-VIEW 3: MASTER ESSENTIAL MEDICINES CATALOG       */}
          {/* ===================================================== */}
          {medSubView === 'master_catalog' && (
            <div className="space-y-6">
              <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h3 className="text-xl font-black text-slate-900">Master Essential Medicine Catalog</h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      WHO / NLEM Essential Medicines with Jan Aushadhi generic equivalent cost comparisons.
                    </p>
                  </div>
                  <span className="text-[10px] font-black uppercase text-teal-800 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
                    {masterMedicines.length} Ingested Master Formulas
                  </span>
                </div>

                {/* Category Pills Filter */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-2 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory('ALL');
                      loadMasterCatalog(masterSearchQuery, 'ALL');
                    }}
                    className={\`px-3 py-1.5 rounded-xl transition-all shrink-0 \${selectedCategory === 'ALL'
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }\`}
                  >
                    All Categories ({masterMedicines.length})
                  </button>
                  {masterCategories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        setSelectedCategory(cat);
                        loadMasterCatalog(masterSearchQuery, cat);
                      }}
                      className={\`px-3 py-1.5 rounded-xl transition-all shrink-0 \${selectedCategory === cat
                        ? 'bg-teal-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }\`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Catalog Search Bar */}
                <div className="relative">
                  <input
                    type="text"
                    value={masterSearchQuery}
                    onChange={(e) => {
                      setMasterSearchQuery(e.target.value);
                      loadMasterCatalog(e.target.value, selectedCategory);
                    }}
                    placeholder="Search by brand name, generic molecule, therapeutic class..."
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 bg-slate-50/50"
                  />
                  <span className="absolute left-3.5 top-3 text-slate-400 text-sm">🔍</span>
                </div>

                {/* Master Medicines Grid */}
                {masterLoading ? (
                  <div className="p-12 text-center text-slate-400 text-xs">
                    ⏳ Querying SQLite master catalog...
                  </div>
                ) : masterMedicines.length === 0 ? (
                  <div className="p-12 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl">
                    No matching medicines in the master database.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
                    {masterMedicines.map((m) => {
                      const savings = Math.round(((m.mrp - m.genericPrice) / m.mrp) * 100);

                      return (
                        <div
                          key={m.id}
                          className="bg-white rounded-3xl p-5 border border-slate-200 hover:border-teal-400 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                        >
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 inline-block mb-1">
                                  {m.category} &bull; {m.dosageForm}
                                </span>
                                <h4 className="text-base font-black text-slate-900">{m.name}</h4>
                                <div className="text-xs text-slate-500 font-medium">
                                  Generic: <strong className="text-slate-800">{m.genericName}</strong>
                                </div>
                              </div>
                              <span className="text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full shrink-0">
                                Save {savings}%
                              </span>
                            </div>

                            <p className="text-xs text-slate-600 line-clamp-2">
                              {m.therapeuticClass}
                            </p>

                            {/* Price Comparison Block */}
                            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-[10px] text-slate-400 block font-bold uppercase">Brand MRP</span>
                                <span className="font-black text-slate-500 line-through">₹{m.mrp.toFixed(2)}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] text-emerald-600 block font-bold uppercase">Jan Aushadhi</span>
                                <span className="font-black text-emerald-700 text-sm">₹{m.genericPrice.toFixed(2)}</span>
                              </div>
                            </div>

                            <div className="text-[10px] text-slate-400 flex items-center justify-between">
                              <span>Brand: {m.brandName}</span>
                              <span>{m.prescriptionRequired ? '🔒 Rx Required' : '🟢 OTC'}</span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setMedSearchQuery(m.genericName || m.name);
                              setMedSubView('stock_search');
                              searchMedicines(m.genericName || m.name, medRadius, userLocation.lat, userLocation.lng);
                            }}
                            className="w-full py-2.5 bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
                          >
                            <span>📍 Check Nearby Stock</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: MEDICAL SHOP DASHBOARD (OWNER CRUD & ORDERS) */}
      {/* ========================================================= */}
      {activeTab === 'shop_owner' && (
        <div className="space-y-6">
          {/* Shop Selector & RBAC Invariant Card */}
          <div className="bg-gradient-to-r from-[#061d5c] via-[#0b2b82] to-[#123eab] text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-blue-900/40 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-2xl">
                  🏪
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-teal-400 block">
                    SHOP OWNER WORKSPACE &bull; STRICT BACKEND RBAC
                  </span>
                  <h3 className="text-xl font-black text-white">{activeShopObj?.name}</h3>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={activeShopId}
                  onChange={(e) => setActiveShopId(e.target.value)}
                  className="bg-slate-800 text-white border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold"
                >
                  {allShops.map((s) => (
                    <option key={s.shopId} value={s.shopId}>
                      {s.name}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => {
                    setMedForm({
                      medicineName: '',
                      genericName: '',
                      dosageForm: 'Tablet',
                      strength: '500mg',
                      quantity: 100,
                      status: 'in_stock',
                      price: 25.0
                    });
                    setShowAddMedModal(true);
                  }}
                  className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-black rounded-xl text-xs shadow-md transition-all flex items-center gap-1.5"
                >
                  <span>➕ Add Medicine</span>
                </button>
              </div>
            </div>

            <div className="p-3 bg-white/5 rounded-2xl border border-white/10 text-xs text-slate-300 flex items-center justify-between flex-wrap gap-2">
              <div>
                <strong>RBAC Invariant:</strong> You are managing shop inventory for <strong>{activeShopObj?.name}</strong>. Backend rejects write access from non-owner accounts.
              </div>
              <span className="text-[10px] font-mono text-teal-300">Owner ID: owner_pharma_1</span>
            </div>
          </div>

          {/* Incoming Order Reservations Desk */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900">Incoming Customer Order Requests</h3>
                <p className="text-xs text-slate-500 font-medium">
                  Patient reservation requests for counter pickup. Confirmed orders do not alter stock until counter handover.
                </p>
              </div>
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700">
                {shopOrders.length} Total Orders
              </span>
            </div>

            {shopOrders.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl">
                No incoming order requests yet.
              </div>
            ) : (
              <div className="space-y-3">
                {shopOrders.map((ord) => (
                  <div
                    key={ord.orderId}
                    className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <strong className="text-slate-900">{ord.patientName}</strong>
                        <span className="font-mono text-slate-500">({ord.patientPhone})</span>
                        <span
                          className={\`text-[10px] font-black uppercase px-2 py-0.5 rounded \${ord.status === 'confirmed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : ord.status === 'requested'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-200 text-slate-700'
                            }\`}
                        >
                          {ord.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 mt-1">
                        Requested: <strong className="text-slate-900">{ord.quantityRequested} units</strong> of <strong>{ord.medicineName}</strong> &bull; Ordered at {new Date(ord.requestedAt).toLocaleTimeString()}
                      </div>
                      {ord.ownerNotes && (
                        <div className="text-[10px] text-teal-700 mt-0.5 italic">
                          Notes: {ord.ownerNotes}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {ord.status === 'requested' && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateOrderStatus(ord.orderId, 'confirmed', 'Stock reserved at counter for 24h pickup')
                            }
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-sm"
                          >
                            ✓ Confirm Hold
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateOrderStatus(ord.orderId, 'cancelled', 'Stock depleted at counter')
                            }
                            className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Shop Inventory Grid */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900">Current Shop Inventory</h3>
                <p className="text-xs text-slate-500 font-medium">
                  {shopInventory.length} items registered in store stock.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {shopInventory.map((item) => (
                <div
                  key={item.inventoryId}
                  className="p-4 rounded-2xl border border-slate-200 bg-white space-y-3 flex flex-col justify-between shadow-sm"
                >
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-black text-slate-900 text-sm">{item.medicineName}</h4>
                      <span
                        className={\`text-[9px] font-black uppercase px-2 py-0.5 rounded-full \${item.status === 'in_stock'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-red-100 text-red-800'
                          }\`}
                      >
                        {item.status === 'in_stock' ? \`\${item.quantity} units\` : 'Out of Stock'}
                      </span>
                    </div>
                    {item.genericName && (
                      <div className="text-[11px] text-slate-500">Generic: {item.genericName}</div>
                    )}
                    <div className="text-[11px] text-slate-700 font-bold">
                      Price: ₹{item.price?.toFixed(2) || '0.00'} &bull; {item.dosageForm} {item.strength}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingMedItem(item);
                        setMedForm({
                          medicineName: item.medicineName,
                          genericName: item.genericName || '',
                          dosageForm: item.dosageForm || 'Tablet',
                          strength: item.strength || '500mg',
                          quantity: item.quantity,
                          status: item.status,
                          price: item.price || 20
                        });
                        setShowEditMedModal(true);
                      }}
                      className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteMedicine(item.inventoryId)}
                      className="px-3 py-1 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg font-bold"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: DIAGNOSTIC SEARCH (DIRECT PATIENT BOOKING)        */}
      {/* ========================================================= */}
      {activeTab === 'diagnostic_search' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-xl font-black text-slate-900">Diagnostic Center &amp; Test Search</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Direct appointment booking for pathology, radiology &amp; blood biochemistry tests.
                </p>
              </div>
              <span className="text-[10px] font-black uppercase text-purple-800 bg-purple-50 px-2.5 py-1 rounded-full border border-purple-200">
                Direct Appointment Booking
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
              <div className="sm:col-span-3">
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Test Name / Pathology Panel
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={diagSearchQuery}
                    onChange={(e) => setDiagSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && searchDiagnosticTests(diagSearchQuery, diagRadius)}
                    placeholder="e.g. Lipid Profile, Complete Blood Count, Troponin-I, HbA1c..."
                    className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-2xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-purple-500 bg-slate-50/50"
                  />
                  <span className="absolute left-3.5 top-3.5 text-slate-400 text-base">🔬</span>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
                  Search Radius
                </label>
                <select
                  value={diagRadius}
                  onChange={(e) => {
                    const r = Number(e.target.value);
                    setDiagRadius(r);
                    searchDiagnosticTests(diagSearchQuery, r);
                  }}
                  className="w-full py-3 px-3 border border-slate-300 rounded-2xl text-xs font-bold text-slate-900 bg-white"
                >
                  <option value="10">Within 10 km</option>
                  <option value="30">Within 30 km</option>
                  <option value="60">Within 60 km</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap pt-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Common Tests:</span>
              {['Lipid Profile', 'Complete Blood Count (CBC)', 'Troponin-I', 'HbA1c Glycated Hemoglobin', 'Chest X-Ray'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setDiagSearchQuery(t);
                    searchDiagnosticTests(t, diagRadius);
                  }}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 hover:bg-purple-50 hover:text-purple-700 text-slate-700 transition-colors"
                >
                  + {t}
                </button>
              ))}
            </div>
          </div>

          {diagMessage && (
            <div
              className={\`p-4 rounded-2xl border flex items-center justify-between text-xs gap-3 \${diagIsFallback
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : 'bg-purple-50 border-purple-200 text-purple-900'
                }\`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-lg">{diagIsFallback ? '⚠️' : '✓'}</span>
                <span className="font-bold">{diagMessage}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {diagResults.map((item, idx) => (
              <div
                key={idx}
                className="bg-white rounded-3xl p-6 border border-slate-200 hover:border-purple-400 transition-all flex flex-col justify-between space-y-4 shadow-sm"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-lg font-black text-slate-900">{item.test.testName}</h4>
                      <div className="text-xs text-slate-500 font-medium mt-0.5">
                        Category: <strong className="text-slate-700 uppercase">{item.test.category}</strong> &bull; Turnaround: {item.test.turnaroundTime}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-base font-black text-slate-900">₹{item.test.price?.toFixed(2) || 0}</div>
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full inline-block mt-0.5 bg-emerald-100 text-emerald-800">
                        Available
                      </span>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <strong className="text-slate-900">{item.center.name}</strong>
                      <span className="font-mono font-bold text-purple-700">📍 {item.distanceKm} km</span>
                    </div>
                    <div className="text-[11px] text-slate-500">{item.center.location.address}</div>
                    <div className="text-[10px] text-slate-400 pt-1 flex items-center justify-between">
                      <span>Accreditation: {item.center.accreditation || 'NABL'}</span>
                      <span>📞 {item.center.contactNumber}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTestItem(item);
                      setShowBookingModal(true);
                    }}
                    className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs transition-all shadow-sm"
                  >
                    📅 Book Test Appointment
                  </button>
                  <a
                    href={\`tel:\${item.center.contactNumber}\`}
                    className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs"
                  >
                    📞 Call Lab
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: DIAGNOSTIC LAB STAFF DASHBOARD                    */}
      {/* ========================================================= */}
      {activeTab === 'lab_dashboard' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-indigo-700/40 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-2xl">
                  🧪
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300 block">
                    DIAGNOSTIC CENTER OPERATIONS
                  </span>
                  <h3 className="text-xl font-black text-white">{activeCenterObj?.name}</h3>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={activeCenterId}
                  onChange={(e) => setActiveCenterId(e.target.value)}
                  className="bg-slate-800 text-white border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold"
                >
                  {allCenters.map((c) => (
                    <option key={c.centerId} value={c.centerId}>
                      {c.name}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => setShowAddTestModal(true)}
                  className="px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white font-black rounded-xl text-xs shadow-md transition-all flex items-center gap-1.5"
                >
                  <span>➕ Add Test Offering</span>
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900">Inbound Sample &amp; Test Queue</h3>
                <p className="text-xs text-slate-500 font-medium">
                  Track sample accession, test processing, and clinical result publishing.
                </p>
              </div>
              <span className="text-xs font-bold px-3 py-1 rounded-full bg-slate-100 text-slate-700">
                {centerOrders.length} Tests in Pipeline
              </span>
            </div>

            <div className="space-y-3">
              {centerOrders.map((ord) => (
                <div
                  key={ord.orderId}
                  className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-between flex-wrap gap-3 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="text-slate-900">{ord.patientName}</strong>
                      <span className="font-mono text-slate-500">({ord.patientPhone})</span>
                      <span
                        className={\`text-[10px] font-black uppercase px-2 py-0.5 rounded \${ord.status === 'result_ready'
                          ? 'bg-purple-100 text-purple-800'
                          : ord.status === 'sample_collected'
                            ? 'bg-teal-100 text-teal-800'
                            : 'bg-amber-100 text-amber-800'
                          }\`}
                      >
                        {ord.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600 mt-1">
                      Test: <strong className="text-slate-900">{ord.testName}</strong> &bull; Order ID: <span className="font-mono font-bold text-slate-700">{ord.orderId}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {ord.status === 'sample_pending' && (
                      <button
                        type="button"
                        onClick={() => handleAdvanceOrderStatus(ord.orderId, 'sample_collected')}
                        className="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-xs shadow-sm"
                      >
                        🩸 Collect Sample
                      </button>
                    )}
                    {ord.status === 'sample_collected' && (
                      <button
                        type="button"
                        onClick={() => handleAdvanceOrderStatus(ord.orderId, 'processing')}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs shadow-sm"
                      >
                        ⚙️ Start Analysis
                      </button>
                    )}
                    {ord.status === 'processing' && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedOrderForStatus(ord);
                          setShowUploadResultModal(true);
                        }}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs shadow-sm"
                      >
                        📝 Upload Lab Results
                      </button>
                    )}
                    {ord.status === 'result_ready' && (
                      <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200">
                        ✓ Report Ready
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 5: DOCTOR-ORDERED LAB TRACKER (CLINICAL WORKFLOW)    */}
      {/* ========================================================= */}
      {activeTab === 'doctor_orders' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="text-xl font-black text-slate-900">Doctor-Ordered Diagnostic Tracker</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Follow patient test progress and review verified lab findings directly.
                </p>
              </div>
              <span className="text-[10px] font-black uppercase text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                Clinical Pathology Portal
              </span>
            </div>

            <div className="space-y-3">
              {trackedOrders.map((ord) => (
                <div
                  key={ord.orderId}
                  className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3"
                >
                  <div className="flex items-start justify-between flex-wrap gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-slate-900 text-sm">{ord.testName}</h4>
                        <span className="text-xs font-mono text-slate-500">[{ord.orderId}]</span>
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5">
                        Patient: <strong>{ord.patientName}</strong> &bull; {ord.patientPhone}
                      </div>
                    </div>
                    <span
                      className={\`text-[10px] font-black uppercase px-2.5 py-1 rounded-full \${ord.status === 'result_ready'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-amber-100 text-amber-800'
                        }\`}
                    >
                      {ord.status}
                    </span>
                  </div>

                  {ord.resultData && (
                    <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-200 space-y-2 text-xs">
                      <div className="font-bold text-purple-950">
                        Verified Finding: {ord.resultData.clinicalSummary}
                      </div>
                      <div className="text-purple-900 font-medium text-[11px]">
                        Patient Explanation: {ord.resultData.patientFriendlySummary}
                      </div>
                      <div className="text-[10px] text-purple-700 italic">
                        Certified by: {ord.resultData.certifiedBy}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: MEDICINE ORDER RESERVATION                      */}
      {/* ========================================================= */}
      {showOrderModal && selectedMedItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase text-teal-800 bg-teal-50 px-2 py-0.5 rounded">
                  Zero-Payment Counter Reservation
                </span>
                <h3 className="text-xl font-black text-slate-900 mt-1">Reserve Medicine Stock</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowOrderModal(false)}
                className="text-slate-400 hover:text-slate-600 font-black text-lg"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handlePlaceMedicineOrder} className="space-y-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-teal-50 border border-teal-200 space-y-1">
                <div className="font-extrabold text-teal-950 text-sm">
                  {selectedMedItem.medicine.medicineName}
                </div>
                <div className="text-[11px] text-teal-800">
                  Shop: <strong>{selectedMedItem.shop.name}</strong> &bull; {selectedMedItem.distanceKm} km away
                </div>
                {selectedMedItem.medicine.price && (
                  <div className="text-teal-900 font-bold pt-1">
                    Price: ₹{selectedMedItem.medicine.price} per unit
                  </div>
                )}
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Patient Full Name</label>
                <input
                  type="text"
                  value={orderPatientName}
                  onChange={(e) => setOrderPatientName(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-2.5 font-bold"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={orderPatientPhone}
                    onChange={(e) => setOrderPatientPhone(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl p-2.5 font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    max={selectedMedItem.medicine.quantity}
                    value={orderQuantity}
                    onChange={(e) => setOrderQuantity(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl p-2.5 font-bold"
                    required
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
                ℹ️ No upfront card payment required. Reserved stock is held for 24 hours at the pharmacy counter.
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setShowOrderModal(false)}
                  className="px-4 py-2.5 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs flex-1 shadow-md"
                >
                  Generate Pickup Token
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1B: DIGITAL COUNTER PICKUP SLIP POPUP              */}
      {/* ========================================================= */}
      {confirmedOrderSlip && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-teal-500/40 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="text-center space-y-2 border-b border-slate-100 pb-4">
              <span className="text-4xl">🎉</span>
              <h3 className="text-2xl font-black text-slate-900">Counter Reservation Confirmed!</h3>
              <p className="text-xs text-slate-500 font-medium">
                Present this digital token at the pharmacy counter to collect your medicine without waiting.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-teal-50 border border-teal-200 text-center space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-teal-800">
                DIGITAL PICKUP TOKEN
              </span>
              <div className="text-2xl font-mono font-black text-teal-900 tracking-wider">
                {confirmedOrderSlip.orderId}
              </div>
              <div className="text-xs text-teal-700 font-bold">
                Verification PIN: <span className="font-mono bg-white px-2 py-0.5 rounded border border-teal-300">PICK-{Math.floor(100000 + Math.random() * 900000)}</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Medicine:</span>
                <strong className="text-slate-900">{confirmedOrderSlip.medicineName}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Reserved Units:</span>
                <strong className="text-slate-900">{confirmedOrderSlip.quantityRequested} strips / units</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Pharmacy Counter:</span>
                <strong className="text-slate-900">{confirmedOrderSlip.shopName}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Patient:</span>
                <strong className="text-slate-900">{confirmedOrderSlip.patientName}</strong>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Hold Duration:</span>
                <span className="text-emerald-700 font-bold">Guaranteed 24-Hour Counter Hold</span>
              </div>
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs flex-1 flex items-center justify-center gap-1.5"
              >
                <span>🖨️</span>
                <span>Print Slip</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmedOrderSlip(null)}
                className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-xs flex-1 shadow-md"
              >
                ✓ Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: DIRECT DIAGNOSTIC BOOKING                       */}
      {/* ========================================================= */}
      {showBookingModal && selectedTestItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase text-purple-800 bg-purple-50 px-2 py-0.5 rounded">
                  Direct Lab Appointment
                </span>
                <h3 className="text-xl font-black text-slate-900 mt-1">Book Diagnostic Test</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowBookingModal(false)}
                className="text-slate-400 hover:text-slate-600 font-black text-lg"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handlePlaceDiagnosticBooking} className="space-y-3 text-xs">
              <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-200 space-y-1">
                <div className="font-extrabold text-purple-950 text-sm">{selectedTestItem.test.testName}</div>
                <div className="text-[11px] text-purple-800">
                  Lab: <strong>{selectedTestItem.center.name}</strong> &bull; {selectedTestItem.distanceKm} km
                </div>
                <div className="text-purple-900 font-bold pt-1">
                  Turnaround: {selectedTestItem.test.turnaroundTime} &bull; Price: ₹{selectedTestItem.test.price || 0}
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Patient Full Name</label>
                <input
                  type="text"
                  value={bookingPatientName}
                  onChange={(e) => setBookingPatientName(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-2.5 font-bold"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Contact Phone</label>
                <input
                  type="text"
                  value={bookingPatientPhone}
                  onChange={(e) => setBookingPatientPhone(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl p-2.5 font-bold"
                  required
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setShowBookingModal(false)}
                  className="px-4 py-2.5 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs flex-1 shadow-md"
                >
                  Book Test Slot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: ADD / EDIT MEDICINE (SHOP OWNER)                */}
      {/* ========================================================= */}
      {(showAddMedModal || showEditMedModal) && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase text-teal-800 bg-teal-50 px-2 py-0.5 rounded">
                  Shop Inventory CRUD
                </span>
                <h3 className="text-xl font-black text-slate-900 mt-1">
                  {showAddMedModal ? 'Add Medicine to Inventory' : 'Edit Medicine Details'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddMedModal(false);
                  setShowEditMedModal(false);
                }}
                className="text-slate-400 hover:text-slate-600 font-black text-lg"
              >
                &times;
              </button>
            </div>

            <form onSubmit={showAddMedModal ? handleAddMedicine : handleUpdateMedicine} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Medicine Brand Name</label>
                <input
                  type="text"
                  value={medForm.medicineName}
                  onChange={(e) => setMedForm({ ...medForm, medicineName: e.target.value })}
                  placeholder="e.g. Telmisartan 40mg"
                  className="w-full border border-slate-300 rounded-xl p-2.5 font-bold"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Generic Molecule Name</label>
                <input
                  type="text"
                  value={medForm.genericName}
                  onChange={(e) => setMedForm({ ...medForm, genericName: e.target.value })}
                  placeholder="e.g. Telmisartan (ARB)"
                  className="w-full border border-slate-300 rounded-xl p-2.5 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Dosage Form</label>
                  <select
                    value={medForm.dosageForm}
                    onChange={(e) => setMedForm({ ...medForm, dosageForm: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl p-2 font-bold bg-white"
                  >
                    <option value="Tablet">Tablet</option>
                    <option value="Capsule">Capsule</option>
                    <option value="Syrup">Syrup</option>
                    <option value="Injection">Injection</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Strength</label>
                  <input
                    type="text"
                    value={medForm.strength}
                    onChange={(e) => setMedForm({ ...medForm, strength: e.target.value })}
                    className="w-full border border-slate-300 rounded-xl p-2 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Stock Quantity</label>
                  <input
                    type="number"
                    value={medForm.quantity}
                    onChange={(e) => setMedForm({ ...medForm, quantity: Number(e.target.value) })}
                    className="w-full border border-slate-300 rounded-xl p-2 font-bold"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Unit Price (INR)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={medForm.price}
                    onChange={(e) => setMedForm({ ...medForm, price: Number(e.target.value) })}
                    className="w-full border border-slate-300 rounded-xl p-2 font-bold"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddMedModal(false);
                    setShowEditMedModal(false);
                  }}
                  className="px-4 py-2.5 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs flex-1 shadow-md"
                >
                  {showAddMedModal ? 'Save Medicine' : 'Update Inventory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: UPLOAD LAB RESULTS (LAB STAFF)                   */}
      {/* ========================================================= */}
      {showUploadResultModal && selectedOrderForStatus && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase text-purple-800 bg-purple-50 px-2 py-0.5 rounded">
                  Clinical Results Publishing
                </span>
                <h3 className="text-xl font-black text-slate-900 mt-1">Publish Test Results</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowUploadResultModal(false)}
                className="text-slate-400 hover:text-slate-600 font-black text-lg"
              >
                &times;
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleAdvanceOrderStatus(selectedOrderForStatus.orderId, 'result_ready', resultForm);
                setShowUploadResultModal(false);
              }}
              className="space-y-3 text-xs"
            >
              <div>
                <label className="font-bold text-slate-700 block mb-1">Clinical Diagnostic Summary (For Doctor)</label>
                <textarea
                  rows="2"
                  value={resultForm.clinicalSummary}
                  onChange={(e) => setResultForm({ ...resultForm, clinicalSummary: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl p-2.5 font-medium"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Patient-Friendly Explanation (Plain Language)</label>
                <textarea
                  rows="2"
                  value={resultForm.patientFriendlySummary}
                  onChange={(e) => setResultForm({ ...resultForm, patientFriendlySummary: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl p-2.5 font-medium"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Certifying Pathologist / Officer</label>
                <input
                  type="text"
                  value={resultForm.certifiedBy}
                  onChange={(e) => setResultForm({ ...resultForm, certifiedBy: e.target.value })}
                  className="w-full border border-slate-300 rounded-xl p-2 font-bold"
                  required
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setShowUploadResultModal(false)}
                  className="px-4 py-2.5 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs flex-1 shadow-md"
                >
                  Publish Report (Ready)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}`;

// Read frontend/public/app.js
const appJsPath = path.resolve('c:/Users/rohit das/NexusMind/frontend/public/app.js');
const appJsContent = fs.readFileSync(appJsPath, 'utf8');

const startMarker = 'function ScreenMedicineDiagnostics({';
const endMarker = 'function ScreenFacilityDashboard({';

const startIndex = appJsContent.indexOf(startMarker);
const endIndex = appJsContent.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.error('Failed to locate markers:', { startIndex, endIndex });
  process.exit(1);
}

// Find preceding newline before ScreenFacilityDashboard comment
const preFacilityComment = '// ==========================================\n// --- FEATURE 07: FACILITY DASHBOARD COMPONENT ---\n// ==========================================\n\nfunction ScreenFacilityDashboard({';
const preIndex = appJsContent.indexOf(preFacilityComment);

const targetEndIndex = preIndex !== -1 ? preIndex : endIndex;

const newAppJs = appJsContent.substring(0, startIndex) + componentCode + '\n\n' + appJsContent.substring(targetEndIndex);

fs.writeFileSync(appJsPath, newAppJs, 'utf8');
console.log('Successfully updated ScreenMedicineDiagnostics in frontend/public/app.js!');
