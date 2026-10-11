/**
 * In-Memory Store for Feature Map 06: Medicine Availability & Diagnostic Coordination
 * Pre-seeded with authentic Jharkhand medical shops, pharmacy inventories, diagnostic labs, and test catalogs.
 */

import type {
  DiagnosticCenter,
  DiagnosticOrder,
  DiagnosticTestOffering,
  MedicalShop,
  MedicineInventoryItem,
  MedicineOrderRequest
} from '../../domain/models/medicine-diagnostic.model.ts';

export class InMemoryMedicineDiagnosticStore {
  private shops: Map<string, MedicalShop> = new Map();
  private inventory: Map<string, MedicineInventoryItem> = new Map();
  private medicineOrders: Map<string, MedicineOrderRequest> = new Map();
  private diagnosticCenters: Map<string, DiagnosticCenter> = new Map();
  private testOfferings: Map<string, DiagnosticTestOffering> = new Map();
  private diagnosticOrders: Map<string, DiagnosticOrder> = new Map();

  constructor() {
    this.seedDefaultData();
  }

  private seedDefaultData(): void {
    // 1. Seed Medical Shops
    const defaultShops: MedicalShop[] = [
      {
        shopId: 'shop_01',
        ownerId: 'owner_pharma_1',
        name: 'Jan Aushadhi Kendra (Govt Subsidized Chemist)',
        location: {
          lat: 23.998,
          lng: 85.345,
          address: 'Main Market Road, Katkamsandi, Hazaribagh'
        },
        contactNumber: '+91-94311-88201',
        openingHours: '08:00 AM - 09:00 PM (All Days)',
        rating: 4.8,
        isVerified: true
      },
      {
        shopId: 'shop_02',
        ownerId: 'owner_pharma_2',
        name: 'Sadar Medico & 24x7 Emergency Chemist',
        location: {
          lat: 23.992,
          lng: 85.362,
          address: 'Opposite Sadar Hospital Gate, Hazaribagh'
        },
        contactNumber: '+91-94311-44102',
        openingHours: '24 Hours (7 Days)',
        rating: 4.9,
        isVerified: true
      },
      {
        shopId: 'shop_03',
        ownerId: 'owner_pharma_3',
        name: 'Ranchi Central Medicos (Super Speciality & Rare Drugs)',
        location: {
          lat: 23.344,
          lng: 85.309,
          address: 'Main Road, Overbridge Chowk, Ranchi (62 km)'
        },
        contactNumber: '+91-651-234-9988',
        openingHours: '07:00 AM - 11:00 PM',
        rating: 4.7,
        isVerified: true
      }
    ];

    for (const shop of defaultShops) {
      this.shops.set(shop.shopId, shop);
    }

    // 2. Seed Medicine Inventory Items
    const defaultInventory: MedicineInventoryItem[] = [
      // Jan Aushadhi Kendra (Katkamsandi)
      {
        inventoryId: 'inv_01',
        shopId: 'shop_01',
        medicineName: 'Paracetamol 650mg',
        genericName: 'Paracetamol / Acetaminophen',
        dosageForm: 'Tablet',
        strength: '650mg',
        quantity: 140,
        status: 'in_stock',
        price: 18.0,
        lastUpdated: new Date(Date.now() - 3600000 * 4).toISOString() // 4 hrs ago
      },
      {
        inventoryId: 'inv_02',
        shopId: 'shop_01',
        medicineName: 'Telmisartan 40mg',
        genericName: 'Telmisartan (ARB Antihypertensive)',
        dosageForm: 'Tablet',
        strength: '40mg',
        quantity: 85,
        status: 'in_stock',
        price: 32.5,
        lastUpdated: new Date(Date.now() - 3600000 * 8).toISOString()
      },
      {
        inventoryId: 'inv_03',
        shopId: 'shop_01',
        medicineName: 'Metformin 500mg',
        genericName: 'Metformin Hydrochloride',
        dosageForm: 'Tablet',
        strength: '500mg',
        quantity: 110,
        status: 'in_stock',
        price: 22.0,
        lastUpdated: new Date(Date.now() - 3600000 * 12).toISOString()
      },
      {
        inventoryId: 'inv_04',
        shopId: 'shop_01',
        medicineName: 'Amoxicillin 500mg',
        genericName: 'Amoxicillin Trihydrate',
        dosageForm: 'Capsule',
        strength: '500mg',
        quantity: 0,
        status: 'out_of_stock',
        price: 45.0,
        lastUpdated: new Date(Date.now() - 3600000 * 24).toISOString()
      },

      // Sadar Medico (Hazaribagh Town)
      {
        inventoryId: 'inv_05',
        shopId: 'shop_02',
        medicineName: 'Ecosprin 75mg',
        genericName: 'Aspirin (Antiplatelet)',
        dosageForm: 'Tablet',
        strength: '75mg',
        quantity: 200,
        status: 'in_stock',
        price: 14.5,
        lastUpdated: new Date(Date.now() - 3600000 * 2).toISOString()
      },
      {
        inventoryId: 'inv_06',
        shopId: 'shop_02',
        medicineName: 'Brilinta 90mg',
        genericName: 'Ticagrelor (P2Y12 Inhibitor)',
        dosageForm: 'Tablet',
        strength: '90mg',
        quantity: 45,
        status: 'in_stock',
        price: 420.0,
        lastUpdated: new Date(Date.now() - 3600000 * 3).toISOString()
      },
      {
        inventoryId: 'inv_07',
        shopId: 'shop_02',
        medicineName: 'Rosuvas 20mg',
        genericName: 'Rosuvastatin Calcium',
        dosageForm: 'Tablet',
        strength: '20mg',
        quantity: 60,
        status: 'in_stock',
        price: 185.0,
        lastUpdated: new Date(Date.now() - 3600000 * 5).toISOString()
      },
      {
        inventoryId: 'inv_08',
        shopId: 'shop_02',
        medicineName: 'Paracetamol 650mg',
        genericName: 'Paracetamol / Acetaminophen',
        dosageForm: 'Tablet',
        strength: '650mg',
        quantity: 300,
        status: 'in_stock',
        price: 30.0,
        lastUpdated: new Date(Date.now() - 3600000 * 1).toISOString()
      },

      // Ranchi Central Medicos (Rare Emergency Medicines)
      {
        inventoryId: 'inv_09',
        shopId: 'shop_03',
        medicineName: 'Tenecteplase 50mg Injection',
        genericName: 'Tenecteplase (Thrombolytic Recombinant tPA)',
        dosageForm: 'Injection',
        strength: '50mg Vial',
        quantity: 8,
        status: 'in_stock',
        price: 28500.0,
        lastUpdated: new Date(Date.now() - 3600000 * 6).toISOString()
      }
    ];

    for (const inv of defaultInventory) {
      this.inventory.set(inv.inventoryId, inv);
    }

    // 3. Seed Sample Medicine Orders
    const defaultOrders: MedicineOrderRequest[] = [
      {
        orderId: 'ord_med_101',
        patientId: 'MV-MED-2026-1024',
        patientName: 'Ramesh Mahto',
        patientPhone: '+91-94311-28901',
        shopId: 'shop_01',
        shopName: 'Jan Aushadhi Kendra (Govt Subsidized Chemist)',
        inventoryId: 'inv_02',
        medicineName: 'Telmisartan 40mg',
        quantityRequested: 30,
        status: 'confirmed',
        requestedAt: new Date(Date.now() - 3600000 * 24).toISOString(),
        confirmedAt: new Date(Date.now() - 3600000 * 22).toISOString(),
        ownerNotes: 'Reserved 1 strip of 30 tabs. Ready for counter pickup.'
      },
      {
        orderId: 'ord_med_102',
        patientId: 'MV-MED-2026-2048',
        patientName: 'Sunita Soren',
        patientPhone: '+91-98352-19203',
        shopId: 'shop_01',
        shopName: 'Jan Aushadhi Kendra (Govt Subsidized Chemist)',
        inventoryId: 'inv_01',
        medicineName: 'Paracetamol 650mg',
        quantityRequested: 10,
        status: 'requested',
        requestedAt: new Date(Date.now() - 3600000 * 2).toISOString()
      }
    ];

    for (const ord of defaultOrders) {
      this.medicineOrders.set(ord.orderId, ord);
    }

    // 4. Seed Diagnostic Centers
    const defaultCenters: DiagnosticCenter[] = [
      {
        centerId: 'center_01',
        ownerId: 'owner_lab_1',
        name: 'District Sadar Hospital Pathology & Biochemistry Lab',
        location: {
          lat: 23.994,
          lng: 85.364,
          address: 'Civil Hospital Campus, Sadar Hospital Road, Hazaribagh'
        },
        contactNumber: '+91-94311-77301',
        accreditation: 'NABL Accredited & Government Subsidized',
        operationalStatus: 'operational',
        rating: 4.7
      },
      {
        centerId: 'center_02',
        ownerId: 'owner_lab_2',
        name: 'Apollo Diagnostics & Health Grid (Hazaribagh Hub)',
        location: {
          lat: 23.989,
          lng: 85.358,
          address: 'Indrapuri Chowk, Main Road, Hazaribagh'
        },
        contactNumber: '+91-94311-22990',
        accreditation: 'CAP & NABL Certified Gold Standard',
        operationalStatus: 'operational',
        rating: 4.9
      },
      {
        centerId: 'center_03',
        ownerId: 'owner_lab_3',
        name: 'Sheikh Bhikhari Medical College & Hospital Radiology Desk',
        location: {
          lat: 23.978,
          lng: 85.348,
          address: 'SBMC&H Medical College Campus, Meru Road, Hazaribagh'
        },
        contactNumber: '+91-6546-264-100',
        accreditation: 'Tertiary Medical College Diagnostics',
        operationalStatus: 'operational',
        rating: 4.8
      }
    ];

    for (const center of defaultCenters) {
      this.diagnosticCenters.set(center.centerId, center);
    }

    // 5. Seed Diagnostic Test Offerings
    const defaultTests: DiagnosticTestOffering[] = [
      // Sadar Hospital Lab
      {
        testOfferingId: 'test_01',
        centerId: 'center_01',
        testName: 'Complete Blood Count (CBC with ESR)',
        category: 'blood',
        status: 'available',
        turnaroundTime: 'Same Day (2 hours)',
        price: 120.0,
        fastingRequired: false,
        sampleType: 'Whole Blood (EDTA)',
        lastUpdated: new Date().toISOString()
      },
      {
        testOfferingId: 'test_02',
        centerId: 'center_01',
        testName: 'Fasting & Post-Prandial Blood Sugar (FBS/PPBS)',
        category: 'blood',
        status: 'available',
        turnaroundTime: 'Same Day (1 hour)',
        price: 60.0,
        fastingRequired: true,
        sampleType: 'Fluoride Plasma',
        lastUpdated: new Date().toISOString()
      },
      {
        testOfferingId: 'test_03',
        centerId: 'center_01',
        testName: 'Lipid Profile Panel (Cholesterol, Triglycerides, HDL, LDL)',
        category: 'blood',
        status: 'available',
        turnaroundTime: 'Same Day (4 hours)',
        price: 250.0,
        fastingRequired: true,
        sampleType: 'Serum',
        lastUpdated: new Date().toISOString()
      },
      {
        testOfferingId: 'test_04',
        centerId: 'center_01',
        testName: 'Kidney Function Test (KFT / Serum Creatinine & Urea)',
        category: 'blood',
        status: 'available',
        turnaroundTime: 'Same Day (3 hours)',
        price: 200.0,
        fastingRequired: false,
        sampleType: 'Serum',
        lastUpdated: new Date().toISOString()
      },

      // Apollo Diagnostics Hub
      {
        testOfferingId: 'test_05',
        centerId: 'center_02',
        testName: 'HbA1c (Glycated Hemoglobin HPLC)',
        category: 'blood',
        status: 'available',
        turnaroundTime: 'Same Day (3 hours)',
        price: 450.0,
        fastingRequired: false,
        sampleType: 'Whole Blood',
        lastUpdated: new Date().toISOString()
      },
      {
        testOfferingId: 'test_06',
        centerId: 'center_02',
        testName: 'Troponin-I High Sensitivity (Cardiac Emergency Marker)',
        category: 'cardiac',
        status: 'available',
        turnaroundTime: 'Stat (45 minutes)',
        price: 850.0,
        fastingRequired: false,
        sampleType: 'Serum',
        lastUpdated: new Date().toISOString()
      },
      {
        testOfferingId: 'test_07',
        centerId: 'center_02',
        testName: 'Thyroid Profile Total (T3, T4, TSH)',
        category: 'pathology',
        status: 'available',
        turnaroundTime: '24 hours',
        price: 400.0,
        fastingRequired: true,
        sampleType: 'Serum',
        lastUpdated: new Date().toISOString()
      },

      // SBMC&H Radiology
      {
        testOfferingId: 'test_08',
        centerId: 'center_03',
        testName: 'Digital X-Ray Chest PA View',
        category: 'radiology',
        status: 'available',
        turnaroundTime: 'Same Day (1 hour)',
        price: 180.0,
        fastingRequired: false,
        sampleType: 'Digital Radiograph',
        lastUpdated: new Date().toISOString()
      },
      {
        testOfferingId: 'test_09',
        centerId: 'center_03',
        testName: '2D Echocardiography & Color Doppler',
        category: 'cardiac',
        status: 'available',
        turnaroundTime: 'Same Day (2 hours)',
        price: 1200.0,
        fastingRequired: false,
        sampleType: 'Ultrasound Imaging',
        lastUpdated: new Date().toISOString()
      }
    ];

    for (const test of defaultTests) {
      this.testOfferings.set(test.testOfferingId, test);
    }

    // 6. Seed Sample Diagnostic Orders
    const defaultDiagOrders: DiagnosticOrder[] = [
      {
        orderId: 'diag_ord_201',
        patientId: 'MV-MED-2026-1024',
        patientName: 'Ramesh Mahto',
        patientPhone: '+91-94311-28901',
        centerId: 'center_01',
        centerName: 'District Sadar Hospital Pathology & Biochemistry Lab',
        testOfferingId: 'test_03',
        testName: 'Lipid Profile Panel (Cholesterol, Triglycerides, HDL, LDL)',
        source: 'doctor_ordered',
        status: 'result_ready',
        orderedBy: {
          id: 'doc_1',
          name: 'Dr. Priya Sharma (Cardiology Specialist)',
          role: 'doctor'
        },
        createdAt: new Date(Date.now() - 3600000 * 18).toISOString(),
        sampleCollectedAt: new Date(Date.now() - 3600000 * 14).toISOString(),
        resultReadyAt: new Date(Date.now() - 3600000 * 8).toISOString(),
        deliveredAt: new Date(Date.now() - 3600000 * 7).toISOString(),
        resultData: {
          clinicalSummary: 'Total Cholesterol and LDL moderately elevated. HDL within normal protective limits.',
          parameters: [
            { name: 'TOTAL CHOLESTEROL', value: '218', unit: 'mg/dL', referenceRange: '125 - 200', isAbnormal: true },
            { name: 'LDL CHOLESTEROL', value: '142', unit: 'mg/dL', referenceRange: '0 - 100', isAbnormal: true },
            { name: 'HDL CHOLESTEROL', value: '44', unit: 'mg/dL', referenceRange: '40 - 60', isAbnormal: false },
            { name: 'TRIGLYCERIDES', value: '160', unit: 'mg/dL', referenceRange: '50 - 150', isAbnormal: true }
          ],
          patientFriendlySummary: 'Your cholesterol and bad fats (LDL) are slightly high. Please continue your prescribed statin tablet at bedtime and reduce fried items.',
          certifiedBy: 'Dr. S. K. Roy (MD Pathology, NMC Reg: 44210)'
        }
      },
      {
        orderId: 'diag_ord_202',
        patientId: 'MV-MED-2026-2048',
        patientName: 'Sunita Soren',
        patientPhone: '+91-98352-19203',
        centerId: 'center_01',
        centerName: 'Dr. Lal PathLabs & Hazaribagh Diagnostics',
        testOfferingId: 'test_01',
        testName: 'Complete Blood Count (CBC with ESR)',
        source: 'direct_search',
        status: 'sample_pending',
        createdAt: new Date(Date.now() - 3600000 * 3).toISOString()
      }
    ];

    for (const dOrd of defaultDiagOrders) {
      this.diagnosticOrders.set(dOrd.orderId, dOrd);
    }
  }

  // --- Medical Shop & Inventory Operations ---
  public getAllShops(): MedicalShop[] {
    return Array.from(this.shops.values());
  }

  public getShopById(shopId: string): MedicalShop | undefined {
    return this.shops.get(shopId);
  }

  public getAllInventory(): MedicineInventoryItem[] {
    return Array.from(this.inventory.values());
  }

  public getInventoryByShopId(shopId: string): MedicineInventoryItem[] {
    return Array.from(this.inventory.values()).filter((i) => i.shopId === shopId);
  }

  public getInventoryItemById(inventoryId: string): MedicineInventoryItem | undefined {
    return this.inventory.get(inventoryId);
  }

  public saveInventoryItem(item: MedicineInventoryItem): MedicineInventoryItem {
    this.inventory.set(item.inventoryId, item);
    return item;
  }

  public deleteInventoryItem(inventoryId: string): boolean {
    return this.inventory.delete(inventoryId);
  }

  // --- Medicine Order Operations ---
  public getAllMedicineOrders(): MedicineOrderRequest[] {
    return Array.from(this.medicineOrders.values());
  }

  public getMedicineOrdersByShopId(shopId: string): MedicineOrderRequest[] {
    return Array.from(this.medicineOrders.values()).filter((o) => o.shopId === shopId);
  }

  public getMedicineOrdersByPatientId(patientId: string): MedicineOrderRequest[] {
    return Array.from(this.medicineOrders.values()).filter((o) => o.patientId === patientId);
  }

  public getMedicineOrderById(orderId: string): MedicineOrderRequest | undefined {
    return this.medicineOrders.get(orderId);
  }

  public saveMedicineOrder(order: MedicineOrderRequest): MedicineOrderRequest {
    this.medicineOrders.set(order.orderId, order);
    return order;
  }

  // --- Diagnostic Center & Test Catalog Operations ---
  public getAllDiagnosticCenters(): DiagnosticCenter[] {
    return Array.from(this.diagnosticCenters.values());
  }

  public getDiagnosticCenterById(centerId: string): DiagnosticCenter | undefined {
    return this.diagnosticCenters.get(centerId);
  }

  public getAllTestOfferings(): DiagnosticTestOffering[] {
    return Array.from(this.testOfferings.values());
  }

  public getTestOfferingsByCenterId(centerId: string): DiagnosticTestOffering[] {
    return Array.from(this.testOfferings.values()).filter((t) => t.centerId === centerId);
  }

  public getTestOfferingById(testOfferingId: string): DiagnosticTestOffering | undefined {
    return this.testOfferings.get(testOfferingId);
  }

  public saveTestOffering(test: DiagnosticTestOffering): DiagnosticTestOffering {
    this.testOfferings.set(test.testOfferingId, test);
    return test;
  }

  public deleteTestOffering(testOfferingId: string): boolean {
    return this.testOfferings.delete(testOfferingId);
  }

  // --- Diagnostic Order Operations ---
  public getAllDiagnosticOrders(): DiagnosticOrder[] {
    return Array.from(this.diagnosticOrders.values());
  }

  public getDiagnosticOrdersByCenterId(centerId: string): DiagnosticOrder[] {
    return Array.from(this.diagnosticOrders.values()).filter((d) => d.centerId === centerId);
  }

  public getDiagnosticOrdersByPatientId(patientId: string): DiagnosticOrder[] {
    return Array.from(this.diagnosticOrders.values()).filter((d) => d.patientId === patientId);
  }

  public getDiagnosticOrderById(orderId: string): DiagnosticOrder | undefined {
    return this.diagnosticOrders.get(orderId);
  }

  public saveDiagnosticOrder(order: DiagnosticOrder): DiagnosticOrder {
    this.diagnosticOrders.set(order.orderId, order);
    return order;
  }
}
