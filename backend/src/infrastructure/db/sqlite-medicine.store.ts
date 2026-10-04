import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import type {
  MedicalShop,
  MedicineInventoryItem,
  MedicineOrderRequest,
  DiagnosticCenter,
  DiagnosticTestOffering,
  DiagnosticOrder,
  ActorContext,
  MedicineSearchResultItem
} from '../../domain/models/medicine-diagnostic.model.ts';
import { calculateHaversineDistance } from '../../domain/rules/medicine-rbac.rules.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface MedicineMaster {
  id: string;
  name: string;
  genericName: string;
  brandName: string;
  category: string;
  dosageForm: string;
  strength: string;
  manufacturer: string;
  mrp: number;
  genericPrice: number;
  isJanAushadhi: boolean;
  isEssential: boolean;
  prescriptionRequired: boolean;
  therapeuticClass: string;
  sideEffects?: string;
  storageCondition?: string;
  createdAt: string;
}

export class SqliteMedicineStore {
  private db: DatabaseSync;

  constructor(dbPath?: string) {
    const resolvedPath =
      dbPath || path.resolve(__dirname, '../../../data/medicines.db');

    const dataDir = path.dirname(resolvedPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.db = new DatabaseSync(resolvedPath);
    this.initTables();
  }

  private initTables(): void {
    // 1. Medicines Master Catalog
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS medicines_master (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        generic_name TEXT NOT NULL,
        brand_name TEXT NOT NULL,
        category TEXT NOT NULL,
        dosage_form TEXT NOT NULL,
        strength TEXT NOT NULL,
        manufacturer TEXT NOT NULL,
        mrp REAL NOT NULL,
        generic_price REAL NOT NULL,
        is_jan_aushadhi INTEGER NOT NULL DEFAULT 0,
        is_essential INTEGER NOT NULL DEFAULT 1,
        prescription_required INTEGER NOT NULL DEFAULT 1,
        therapeutic_class TEXT NOT NULL,
        side_effects TEXT,
        storage_condition TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_med_name ON medicines_master(name);
      CREATE INDEX IF NOT EXISTS idx_med_generic ON medicines_master(generic_name);
      CREATE INDEX IF NOT EXISTS idx_med_brand ON medicines_master(brand_name);
      CREATE INDEX IF NOT EXISTS idx_med_category ON medicines_master(category);

      -- 2. Medical Shops / Pharmacies
      CREATE TABLE IF NOT EXISTS pharmacies (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        address TEXT NOT NULL,
        city TEXT NOT NULL,
        district TEXT NOT NULL,
        state TEXT NOT NULL,
        pincode TEXT,
        phone TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        opening_hours TEXT NOT NULL,
        rating REAL NOT NULL DEFAULT 4.5,
        review_count INTEGER NOT NULL DEFAULT 85,
        is_open_24_7 INTEGER NOT NULL DEFAULT 0,
        home_delivery INTEGER NOT NULL DEFAULT 0,
        is_verified INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_pharm_city ON pharmacies(city);
      CREATE INDEX IF NOT EXISTS idx_pharm_district ON pharmacies(district);
      CREATE INDEX IF NOT EXISTS idx_pharm_lat_lng ON pharmacies(latitude, longitude);

      -- 3. Pharmacy Inventory Items
      CREATE TABLE IF NOT EXISTS pharmacy_inventory (
        id TEXT PRIMARY KEY,
        pharmacy_id TEXT NOT NULL,
        medicine_id TEXT NOT NULL,
        medicine_name TEXT NOT NULL,
        generic_name TEXT,
        dosage_form TEXT,
        strength TEXT,
        quantity INTEGER NOT NULL,
        batch_number TEXT NOT NULL,
        expiry_date TEXT NOT NULL,
        unit_price REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'in_stock',
        last_updated TEXT NOT NULL,
        FOREIGN KEY (pharmacy_id) REFERENCES pharmacies(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_inv_pharm ON pharmacy_inventory(pharmacy_id);
      CREATE INDEX IF NOT EXISTS idx_inv_med ON pharmacy_inventory(medicine_id);
      CREATE INDEX IF NOT EXISTS idx_inv_status ON pharmacy_inventory(status);

      -- 4. Medicine Order Reservations
      CREATE TABLE IF NOT EXISTS medicine_orders (
        id TEXT PRIMARY KEY,
        order_id TEXT UNIQUE NOT NULL,
        patient_id TEXT NOT NULL,
        patient_name TEXT NOT NULL,
        patient_phone TEXT NOT NULL,
        pharmacy_id TEXT NOT NULL,
        pharmacy_name TEXT NOT NULL,
        inventory_id TEXT NOT NULL,
        medicine_name TEXT NOT NULL,
        quantity_requested INTEGER NOT NULL,
        unit_price REAL NOT NULL,
        total_price REAL NOT NULL,
        pickup_code TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'requested',
        owner_notes TEXT,
        requested_at TEXT NOT NULL,
        confirmed_at TEXT,
        picked_up_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_ord_patient ON medicine_orders(patient_id);
      CREATE INDEX IF NOT EXISTS idx_ord_pharm ON medicine_orders(pharmacy_id);
      CREATE INDEX IF NOT EXISTS idx_ord_code ON medicine_orders(pickup_code);

      -- 5. Diagnostic Centers
      CREATE TABLE IF NOT EXISTS diagnostic_centers (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        name TEXT NOT NULL,
        address TEXT NOT NULL,
        city TEXT NOT NULL,
        district TEXT NOT NULL,
        state TEXT NOT NULL,
        phone TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        accreditation TEXT NOT NULL DEFAULT 'NABL',
        operational_status TEXT NOT NULL DEFAULT 'operational',
        rating REAL NOT NULL DEFAULT 4.6,
        created_at TEXT NOT NULL
      );

      -- 6. Diagnostic Test Offerings
      CREATE TABLE IF NOT EXISTS diagnostic_tests (
        id TEXT PRIMARY KEY,
        center_id TEXT NOT NULL,
        test_name TEXT NOT NULL,
        category TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'available',
        turnaround_time TEXT NOT NULL,
        price REAL NOT NULL,
        fasting_required INTEGER NOT NULL DEFAULT 0,
        sample_type TEXT,
        last_updated TEXT NOT NULL,
        FOREIGN KEY (center_id) REFERENCES diagnostic_centers(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_test_center ON diagnostic_tests(center_id);
      CREATE INDEX IF NOT EXISTS idx_test_category ON diagnostic_tests(category);

      -- 7. Diagnostic Orders
      CREATE TABLE IF NOT EXISTS diagnostic_orders (
        id TEXT PRIMARY KEY,
        order_id TEXT UNIQUE NOT NULL,
        patient_id TEXT NOT NULL,
        patient_name TEXT NOT NULL,
        patient_phone TEXT NOT NULL,
        center_id TEXT NOT NULL,
        center_name TEXT NOT NULL,
        test_offering_id TEXT NOT NULL,
        test_name TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'direct_search',
        status TEXT NOT NULL DEFAULT 'sample_pending',
        ordered_by_json TEXT,
        result_data_json TEXT,
        center_notes TEXT,
        created_at TEXT NOT NULL,
        sample_collected_at TEXT,
        result_ready_at TEXT,
        delivered_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_diag_patient ON diagnostic_orders(patient_id);
      CREATE INDEX IF NOT EXISTS idx_diag_center ON diagnostic_orders(center_id);
    `);

    // Check if initial seeding is needed
    const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM medicines_master');
    const result = countStmt.get() as { count: number };
    if (!result || result.count === 0) {
      this.seedInitialData();
    }
  }

  // --- MEDICINE MASTER OPERATIONS ---
  public async searchMedicinesMaster(query: string, category?: string): Promise<MedicineMaster[]> {
    const q = `%${(query || '').trim()}%`;
    let sql = `
      SELECT * FROM medicines_master
      WHERE (name LIKE ? OR generic_name LIKE ? OR brand_name LIKE ? OR therapeutic_class LIKE ?)
    `;
    const params: any[] = [q, q, q, q];

    if (category && category !== 'ALL') {
      sql += ' AND category = ?';
      params.push(category);
    }

    sql += ' ORDER BY is_jan_aushadhi DESC, mrp ASC LIMIT 50';
    const stmt = this.db.prepare(sql);
    const rows = stmt.all(...params) as any[];

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      genericName: r.generic_name,
      brandName: r.brand_name,
      category: r.category,
      dosageForm: r.dosage_form,
      strength: r.strength,
      manufacturer: r.manufacturer,
      mrp: Number(r.mrp),
      genericPrice: Number(r.generic_price),
      isJanAushadhi: Boolean(r.is_jan_aushadhi),
      isEssential: Boolean(r.is_essential),
      prescriptionRequired: Boolean(r.prescription_required),
      therapeuticClass: r.therapeutic_class,
      sideEffects: r.side_effects || undefined,
      storageCondition: r.storage_condition || undefined,
      createdAt: r.created_at
    }));
  }

  public async getMedicineCategories(): Promise<string[]> {
    const stmt = this.db.prepare('SELECT DISTINCT category FROM medicines_master ORDER BY category ASC');
    const rows = stmt.all() as { category: string }[];
    return rows.map((r) => r.category);
  }

  // --- PHARMACY & INVENTORY OPERATIONS ---
  public getAllShops(): MedicalShop[] {
    const stmt = this.db.prepare('SELECT * FROM pharmacies ORDER BY rating DESC');
    const rows = stmt.all() as any[];
    return rows.map((r) => ({
      shopId: r.id,
      ownerId: r.owner_id,
      name: r.name,
      location: {
        lat: Number(r.latitude),
        lng: Number(r.longitude),
        address: `${r.address}, ${r.city}, ${r.district}, ${r.state}${r.pincode ? ` - ${r.pincode}` : ''}`
      },
      contactNumber: r.phone,
      openingHours: r.opening_hours,
      rating: Number(r.rating),
      isVerified: Boolean(r.is_verified)
    }));
  }

  public getNearbyPharmacies(
    lat: number = 23.998,
    lng: number = 85.345,
    radiusKm: number = 50
  ) {
    const stmt = this.db.prepare('SELECT * FROM pharmacies');
    const rows = stmt.all() as any[];
    const mapped = rows.map((r) => {
      const distance = calculateHaversineDistance(lat, lng, Number(r.latitude), Number(r.longitude));
      return {
        id: r.id,
        shopId: r.id,
        name: r.name,
        type: r.type,
        address: r.address,
        city: r.city,
        district: r.district,
        state: r.state,
        pincode: r.pincode,
        phone: r.phone,
        latitude: Number(r.latitude),
        longitude: Number(r.longitude),
        openingHours: r.opening_hours,
        rating: Number(r.rating),
        reviewCount: Number(r.review_count || 45),
        isOpen24_7: Boolean(r.is_open_24_7),
        homeDelivery: Boolean(r.home_delivery),
        isVerified: Boolean(r.is_verified),
        distanceKm: Math.round(distance * 10) / 10,
        isWithinRadius: distance <= radiusKm
      };
    });
    mapped.sort((a, b) => a.distanceKm - b.distanceKm);
    return mapped;
  }

  public getShopById(shopId: string): MedicalShop | null {
    const stmt = this.db.prepare('SELECT * FROM pharmacies WHERE id = ?');
    const r = stmt.get(shopId) as any;
    if (!r) return null;
    return {
      shopId: r.id,
      ownerId: r.owner_id,
      name: r.name,
      location: {
        lat: Number(r.latitude),
        lng: Number(r.longitude),
        address: `${r.address}, ${r.city}, ${r.district}, ${r.state}${r.pincode ? ` - ${r.pincode}` : ''}`
      },
      contactNumber: r.phone,
      openingHours: r.opening_hours,
      rating: Number(r.rating),
      isVerified: Boolean(r.is_verified)
    };
  }

  public getAllInventory(): MedicineInventoryItem[] {
    const stmt = this.db.prepare('SELECT * FROM pharmacy_inventory');
    const rows = stmt.all() as any[];
    return rows.map((r) => ({
      inventoryId: r.id,
      shopId: r.pharmacy_id,
      medicineName: r.medicine_name,
      genericName: r.generic_name || undefined,
      dosageForm: r.dosage_form || undefined,
      strength: r.strength || undefined,
      quantity: Number(r.quantity),
      status: r.status,
      price: Number(r.unit_price),
      lastUpdated: r.last_updated
    }));
  }

  public getInventoryByShopId(shopId: string): MedicineInventoryItem[] {
    const stmt = this.db.prepare('SELECT * FROM pharmacy_inventory WHERE pharmacy_id = ? ORDER BY medicine_name ASC');
    const rows = stmt.all(shopId) as any[];
    return rows.map((r) => ({
      inventoryId: r.id,
      shopId: r.pharmacy_id,
      medicineName: r.medicine_name,
      genericName: r.generic_name || undefined,
      dosageForm: r.dosage_form || undefined,
      strength: r.strength || undefined,
      quantity: Number(r.quantity),
      status: r.status,
      price: Number(r.unit_price),
      lastUpdated: r.last_updated
    }));
  }

  public getInventoryItemById(inventoryId: string): MedicineInventoryItem | null {
    const stmt = this.db.prepare('SELECT * FROM pharmacy_inventory WHERE id = ?');
    const r = stmt.get(inventoryId) as any;
    if (!r) return null;
    return {
      inventoryId: r.id,
      shopId: r.pharmacy_id,
      medicineName: r.medicine_name,
      genericName: r.generic_name || undefined,
      dosageForm: r.dosage_form || undefined,
      strength: r.strength || undefined,
      quantity: Number(r.quantity),
      status: r.status,
      price: Number(r.unit_price),
      lastUpdated: r.last_updated
    };
  }

  public addInventoryItem(shopId: string, item: Partial<MedicineInventoryItem>): MedicineInventoryItem {
    const id = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    const batch = `BAT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const expiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const stmt = this.db.prepare(`
      INSERT INTO pharmacy_inventory (
        id, pharmacy_id, medicine_id, medicine_name, generic_name,
        dosage_form, strength, quantity, batch_number, expiry_date,
        unit_price, status, last_updated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      shopId,
      item.inventoryId || id,
      item.medicineName || 'Medicine',
      item.genericName || null,
      item.dosageForm || 'Tablet',
      item.strength || '',
      item.quantity || 0,
      batch,
      expiry,
      item.price || 0,
      item.status || (item.quantity && item.quantity > 0 ? 'in_stock' : 'out_of_stock'),
      now
    );

    return {
      inventoryId: id,
      shopId,
      medicineName: item.medicineName || '',
      genericName: item.genericName,
      dosageForm: item.dosageForm,
      strength: item.strength,
      quantity: item.quantity || 0,
      status: item.status || 'in_stock',
      price: item.price,
      lastUpdated: now
    };
  }

  public saveInventoryItem(item: MedicineInventoryItem): MedicineInventoryItem {
    return this.updateInventoryItem(item.shopId, item.inventoryId, item);
  }

  public updateInventoryItem(shopId: string, medId: string, updates: Partial<MedicineInventoryItem>): MedicineInventoryItem {
    const now = new Date().toISOString();
    const existing = this.getInventoryItemById(medId);
    if (!existing) {
      throw new Error(`Inventory item '${medId}' not found.`);
    }

    const newQty = updates.quantity !== undefined ? updates.quantity : existing.quantity;
    const newStatus = updates.status || (newQty > 0 ? 'in_stock' : 'out_of_stock');
    const newPrice = updates.price !== undefined ? updates.price : (existing.price || 0);

    const stmt = this.db.prepare(`
      UPDATE pharmacy_inventory
      SET quantity = ?, status = ?, unit_price = ?, last_updated = ?
      WHERE id = ? AND pharmacy_id = ?
    `);

    stmt.run(newQty, newStatus, newPrice, now, medId, shopId);

    return {
      ...existing,
      quantity: newQty,
      status: newStatus as any,
      price: newPrice,
      lastUpdated: now
    };
  }

  public deleteInventoryItem(shopId: string, medId: string): boolean {
    const stmt = this.db.prepare('DELETE FROM pharmacy_inventory WHERE id = ? AND pharmacy_id = ?');
    stmt.run(medId, shopId);
    return true;
  }

  // --- GPS NEARBY PHARMACY SEARCH WITH REAL STOCKS & SAVINGS ---
  public searchNearbyPharmaciesWithStock(
    query: string,
    targetLat: number,
    targetLng: number,
    searchRadiusKm: number = 25
  ): {
    results: Array<MedicineSearchResultItem & {
      pharmacyType: string;
      phone: string;
      rating: number;
      isOpen24_7: boolean;
      genericSavingsPercent?: number;
      genericSubstitutePrice?: number;
      brandMrp?: number;
    }>;
    isFallback: boolean;
    message: string;
  } {
    const normQuery = (query || '').toLowerCase().trim();
    const allShops = this.getAllShops();
    const allInventory = this.getAllInventory();

    const matchingItems: Array<{
      item: MedicineInventoryItem;
      shop: MedicalShop;
      distance: number;
      isSub: boolean;
      pharmacyRow: any;
      masterMed?: any;
    }> = [];

    // Map shop extra fields
    const pharmStmt = this.db.prepare('SELECT id, type, phone, rating, is_open_24_7 FROM pharmacies');
    const pharmRows = pharmStmt.all() as any[];
    const pharmMap = new Map(pharmRows.map((p) => [p.id, p]));

    // Check against medicines_master to get price comparisons
    const masterStmt = this.db.prepare('SELECT * FROM medicines_master');
    const masterRows = masterStmt.all() as any[];
    const masterMap = new Map(masterRows.map((m) => [m.name.toLowerCase(), m]));

    for (const item of allInventory) {
      const shop = allShops.find((s) => s.shopId === item.shopId);
      if (!shop) continue;

      const nameMatch = item.medicineName.toLowerCase().includes(normQuery);
      const genericMatch = item.genericName?.toLowerCase().includes(normQuery) || false;

      if (!normQuery || nameMatch || genericMatch) {
        const distance = calculateHaversineDistance(
          targetLat,
          targetLng,
          shop.location.lat,
          shop.location.lng
        );

        const pExtra = pharmMap.get(shop.shopId) || {};
        const mMed = masterMap.get(item.medicineName.toLowerCase());

        matchingItems.push({
          item,
          shop,
          distance,
          isSub: !nameMatch && genericMatch,
          pharmacyRow: pExtra,
          masterMed: mMed
        });
      }
    }

    // Sort: 1) In stock first, 2) proximity, 3) rating
    matchingItems.sort((a, b) => {
      if (a.item.status === 'in_stock' && b.item.status !== 'in_stock') return -1;
      if (a.item.status !== 'in_stock' && b.item.status === 'in_stock') return 1;
      if (a.distance !== b.distance) return a.distance - b.distance;
      return (b.pharmacyRow.rating || 0) - (a.pharmacyRow.rating || 0);
    });

    const withinRadius = matchingItems.filter((m) => m.distance <= searchRadiusKm && m.item.status === 'in_stock');

    const mapResult = (m: any, isNearby: boolean) => {
      let genericSavingsPercent: number | undefined = undefined;
      let genericSubstitutePrice: number | undefined = undefined;
      let brandMrp: number | undefined = undefined;

      if (m.masterMed) {
        brandMrp = m.masterMed.mrp;
        genericSubstitutePrice = m.masterMed.generic_price;
        if (brandMrp && genericSubstitutePrice && brandMrp > genericSubstitutePrice) {
          genericSavingsPercent = Math.round(((brandMrp - genericSubstitutePrice) / brandMrp) * 100);
        }
      }

      return {
        medicine: m.item,
        shop: m.shop,
        distanceKm: m.distance,
        isNearby,
        isSubstitute: m.isSub,
        pharmacyType: m.pharmacyRow.type || 'Retail Pharmacy',
        phone: m.pharmacyRow.phone || m.shop.contactNumber,
        rating: m.pharmacyRow.rating || 4.5,
        isOpen24_7: Boolean(m.pharmacyRow.is_open_24_7),
        genericSavingsPercent,
        genericSubstitutePrice,
        brandMrp
      };
    };

    if (withinRadius.length > 0) {
      return {
        results: withinRadius.map((m) => mapResult(m, true)),
        isFallback: false,
        message: `Found ${withinRadius.length} pharmacies nearby with '${query || 'medicines'}' in stock within ${searchRadiusKm} km.`
      };
    }

    // Fallback: If no stock within radius, return nearest available beyond radius
    const inStockBeyond = matchingItems.filter((m) => m.item.status === 'in_stock');
    if (inStockBeyond.length > 0) {
      const topOptions = inStockBeyond.slice(0, 6);
      return {
        results: topOptions.map((m) => mapResult(m, false)),
        isFallback: true,
        message: `No nearby pharmacies have '${query}' in stock within ${searchRadiusKm} km. Nearest verified stock is at ${topOptions[0].shop.name} (${topOptions[0].distance} km away).`
      };
    }

    // Completely out of stock everywhere
    const fallbackList = matchingItems.slice(0, 6);
    return {
      results: fallbackList.map((m) => mapResult(m, m.distance <= searchRadiusKm)),
      isFallback: true,
      message: fallbackList.length > 0
        ? `'${query}' is temporarily out of stock in nearby chemists. Nearest licensed distributors listed above.`
        : `No registered medical shops found carrying '${query}'.`
    };
  }

  // --- MEDICINE ORDERS & RESERVATIONS ---
  public createMedicineOrder(data: {
    patientId: string;
    patientName: string;
    patientPhone: string;
    shopId: string;
    inventoryId: string;
    quantityRequested: number;
  }): MedicineOrderRequest {
    const shop = this.getShopById(data.shopId);
    if (!shop) throw new Error(`Shop '${data.shopId}' not found.`);

    const inv = this.getInventoryItemById(data.inventoryId);
    if (!inv) throw new Error(`Inventory item '${data.inventoryId}' not found.`);

    const id = `order_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const orderId = `RX-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const pickupCode = `PICK-${Math.floor(100000 + Math.random() * 900000)}`;
    const unitPrice = inv.price || 20;
    const totalPrice = unitPrice * (data.quantityRequested || 1);
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO medicine_orders (
        id, order_id, patient_id, patient_name, patient_phone,
        pharmacy_id, pharmacy_name, inventory_id, medicine_name,
        quantity_requested, unit_price, total_price, pickup_code,
        status, requested_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      orderId,
      data.patientId,
      data.patientName,
      data.patientPhone,
      data.shopId,
      shop.name,
      data.inventoryId,
      inv.medicineName,
      data.quantityRequested,
      unitPrice,
      totalPrice,
      pickupCode,
      'requested',
      now
    );

    return {
      orderId,
      patientId: data.patientId,
      patientName: data.patientName,
      patientPhone: data.patientPhone,
      shopId: data.shopId,
      shopName: shop.name,
      inventoryId: data.inventoryId,
      medicineName: inv.medicineName,
      quantityRequested: data.quantityRequested,
      status: 'requested',
      requestedAt: now
    };
  }

  public getMedicineOrderById(orderId: string): MedicineOrderRequest | null {
    const stmt = this.db.prepare('SELECT * FROM medicine_orders WHERE order_id = ?');
    const r = stmt.get(orderId) as any;
    if (!r) return null;
    return {
      orderId: r.order_id,
      patientId: r.patient_id,
      patientName: r.patient_name,
      patientPhone: r.patient_phone,
      shopId: r.pharmacy_id,
      shopName: r.pharmacy_name,
      inventoryId: r.inventory_id,
      medicineName: r.medicine_name,
      quantityRequested: Number(r.quantity_requested),
      status: r.status,
      requestedAt: r.requested_at,
      confirmedAt: r.confirmed_at || undefined,
      ownerNotes: r.owner_notes || undefined
    };
  }

  public saveMedicineOrder(order: MedicineOrderRequest): MedicineOrderRequest {
    const existing = this.getMedicineOrderById(order.orderId);
    if (existing) {
      return this.updateMedicineOrderStatus(
        order.shopId,
        order.orderId,
        order.status,
        order.ownerNotes
      );
    }
    return this.createMedicineOrder({
      patientId: order.patientId,
      patientName: order.patientName,
      patientPhone: order.patientPhone,
      shopId: order.shopId,
      inventoryId: order.inventoryId,
      quantityRequested: order.quantityRequested
    });
  }

  public getMedicineOrdersByShopId(shopId: string): MedicineOrderRequest[] {
    return this.getOrdersByShopId(shopId);
  }

  public getOrdersByShopId(shopId: string): MedicineOrderRequest[] {
    const stmt = this.db.prepare('SELECT * FROM medicine_orders WHERE pharmacy_id = ? ORDER BY requested_at DESC');
    const rows = stmt.all(shopId) as any[];
    return rows.map((r) => ({
      orderId: r.order_id,
      patientId: r.patient_id,
      patientName: r.patient_name,
      patientPhone: r.patient_phone,
      shopId: r.pharmacy_id,
      shopName: r.pharmacy_name,
      inventoryId: r.inventory_id,
      medicineName: r.medicine_name,
      quantityRequested: Number(r.quantity_requested),
      status: r.status,
      requestedAt: r.requested_at,
      confirmedAt: r.confirmed_at || undefined,
      ownerNotes: r.owner_notes || undefined
    }));
  }

  public updateMedicineOrderStatus(
    shopId: string,
    orderId: string,
    status: any,
    ownerNotes?: string
  ): MedicineOrderRequest {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE medicine_orders
      SET status = ?, owner_notes = ?, confirmed_at = ?
      WHERE order_id = ? AND pharmacy_id = ?
    `);
    stmt.run(status, ownerNotes || null, now, orderId, shopId);

    const getStmt = this.db.prepare('SELECT * FROM medicine_orders WHERE order_id = ?');
    const r = getStmt.get(orderId) as any;
    if (!r) throw new Error(`Order '${orderId}' not found.`);

    return {
      orderId: r.order_id,
      patientId: r.patient_id,
      patientName: r.patient_name,
      patientPhone: r.patient_phone,
      shopId: r.pharmacy_id,
      shopName: r.pharmacy_name,
      inventoryId: r.inventory_id,
      medicineName: r.medicine_name,
      quantityRequested: Number(r.quantity_requested),
      status: r.status,
      requestedAt: r.requested_at,
      confirmedAt: r.confirmed_at || undefined,
      ownerNotes: r.owner_notes || undefined
    };
  }

  // --- DIAGNOSTIC CENTERS & TESTS ---
  public getAllDiagnosticCenters(): DiagnosticCenter[] {
    const stmt = this.db.prepare('SELECT * FROM diagnostic_centers');
    const rows = stmt.all() as any[];
    return rows.map((r) => ({
      centerId: r.id,
      ownerId: r.owner_id,
      name: r.name,
      location: {
        lat: Number(r.latitude),
        lng: Number(r.longitude),
        address: `${r.address}, ${r.city}, ${r.district}`
      },
      contactNumber: r.phone,
      accreditation: r.accreditation,
      operationalStatus: r.operational_status,
      rating: Number(r.rating)
    }));
  }

  public getDiagnosticCenterById(centerId: string): DiagnosticCenter | null {
    const stmt = this.db.prepare('SELECT * FROM diagnostic_centers WHERE id = ?');
    const r = stmt.get(centerId) as any;
    if (!r) return null;
    return {
      centerId: r.id,
      ownerId: r.owner_id,
      name: r.name,
      location: {
        lat: Number(r.latitude),
        lng: Number(r.longitude),
        address: `${r.address}, ${r.city}, ${r.district}`
      },
      contactNumber: r.phone,
      accreditation: r.accreditation,
      operationalStatus: r.operational_status,
      rating: Number(r.rating)
    };
  }

  public getAllTestOfferings(): DiagnosticTestOffering[] {
    const stmt = this.db.prepare('SELECT * FROM diagnostic_tests');
    const rows = stmt.all() as any[];
    return rows.map((r) => ({
      testOfferingId: r.id,
      centerId: r.center_id,
      testName: r.test_name,
      category: r.category,
      status: r.status,
      turnaroundTime: r.turnaround_time,
      price: Number(r.price),
      fastingRequired: Boolean(r.fasting_required),
      sampleType: r.sample_type || undefined,
      lastUpdated: r.last_updated
    }));
  }

  public getTestOfferingsByCenterId(centerId: string): DiagnosticTestOffering[] {
    const stmt = this.db.prepare('SELECT * FROM diagnostic_tests WHERE center_id = ?');
    const rows = stmt.all(centerId) as any[];
    return rows.map((r) => ({
      testOfferingId: r.id,
      centerId: r.center_id,
      testName: r.test_name,
      category: r.category,
      status: r.status,
      turnaroundTime: r.turnaround_time,
      price: Number(r.price),
      fastingRequired: Boolean(r.fasting_required),
      sampleType: r.sample_type || undefined,
      lastUpdated: r.last_updated
    }));
  }

  public addTestOffering(centerId: string, test: Partial<DiagnosticTestOffering>): DiagnosticTestOffering {
    const id = `test_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO diagnostic_tests (
        id, center_id, test_name, category, status,
        turnaround_time, price, fasting_required, sample_type, last_updated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      centerId,
      test.testName || 'Diagnostic Test',
      test.category || 'general',
      test.status || 'available',
      test.turnaroundTime || '24 hours',
      test.price || 200,
      test.fastingRequired ? 1 : 0,
      test.sampleType || 'Blood',
      now
    );

    return {
      testOfferingId: id,
      centerId,
      testName: test.testName || '',
      category: (test.category as any) || 'general',
      status: (test.status as any) || 'available',
      turnaroundTime: test.turnaroundTime || '24 hours',
      price: test.price,
      fastingRequired: Boolean(test.fastingRequired),
      sampleType: test.sampleType,
      lastUpdated: now
    };
  }

  public updateTestOffering(centerId: string, testId: string, updates: Partial<DiagnosticTestOffering>): DiagnosticTestOffering {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      UPDATE diagnostic_tests
      SET status = COALESCE(?, status), price = COALESCE(?, price), turnaround_time = COALESCE(?, turnaround_time), last_updated = ?
      WHERE id = ? AND center_id = ?
    `);
    stmt.run(updates.status || null, updates.price || null, updates.turnaroundTime || null, now, testId, centerId);

    const getStmt = this.db.prepare('SELECT * FROM diagnostic_tests WHERE id = ?');
    const r = getStmt.get(testId) as any;
    if (!r) throw new Error(`Test '${testId}' not found.`);

    return {
      testOfferingId: r.id,
      centerId: r.center_id,
      testName: r.test_name,
      category: r.category,
      status: r.status,
      turnaroundTime: r.turnaround_time,
      price: Number(r.price),
      fastingRequired: Boolean(r.fasting_required),
      sampleType: r.sample_type,
      lastUpdated: r.last_updated
    };
  }

  public deleteTestOffering(centerId: string, testId: string): boolean {
    const stmt = this.db.prepare('DELETE FROM diagnostic_tests WHERE id = ? AND center_id = ?');
    stmt.run(testId, centerId);
    return true;
  }

  public getDiagnosticOrdersByCenterId(centerId: string): DiagnosticOrder[] {
    const stmt = this.db.prepare('SELECT * FROM diagnostic_orders WHERE center_id = ? ORDER BY created_at DESC');
    const rows = stmt.all(centerId) as any[];
    return rows.map((r) => ({
      orderId: r.order_id,
      patientId: r.patient_id,
      patientName: r.patient_name,
      patientPhone: r.patient_phone,
      centerId: r.center_id,
      centerName: r.center_name,
      testOfferingId: r.test_offering_id,
      testName: r.test_name,
      source: r.source,
      status: r.status,
      orderedBy: r.ordered_by_json ? JSON.parse(r.ordered_by_json) : undefined,
      resultData: r.result_data_json ? JSON.parse(r.result_data_json) : undefined,
      centerNotes: r.center_notes || undefined,
      createdAt: r.created_at,
      sampleCollectedAt: r.sample_collected_at || undefined,
      resultReadyAt: r.result_ready_at || undefined,
      deliveredAt: r.delivered_at || undefined
    }));
  }

  public createDiagnosticOrder(data: {
    patientId: string;
    patientName: string;
    patientPhone: string;
    centerId: string;
    testOfferingId: string;
    source?: any;
    orderedBy?: any;
  }): DiagnosticOrder {
    const center = this.getDiagnosticCenterById(data.centerId);
    if (!center) throw new Error(`Diagnostic Center '${data.centerId}' not found.`);

    const tests = this.getTestOfferingsByCenterId(data.centerId);
    const test = tests.find((t) => t.testOfferingId === data.testOfferingId);
    if (!test) throw new Error(`Test offering '${data.testOfferingId}' not found.`);

    const id = `d_ord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const orderId = `LAB-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO diagnostic_orders (
        id, order_id, patient_id, patient_name, patient_phone,
        center_id, center_name, test_offering_id, test_name,
        source, status, ordered_by_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      orderId,
      data.patientId,
      data.patientName,
      data.patientPhone,
      data.centerId,
      center.name,
      data.testOfferingId,
      test.testName,
      data.source || 'direct_search',
      'sample_pending',
      data.orderedBy ? JSON.stringify(data.orderedBy) : null,
      now
    );

    return {
      orderId,
      patientId: data.patientId,
      patientName: data.patientName,
      patientPhone: data.patientPhone,
      centerId: data.centerId,
      centerName: center.name,
      testOfferingId: data.testOfferingId,
      testName: test.testName,
      source: data.source || 'direct_search',
      status: 'sample_pending',
      orderedBy: data.orderedBy,
      createdAt: now
    };
  }

  public advanceDiagnosticOrderStatus(
    centerId: string,
    orderId: string,
    newStatus: any,
    resultData?: any
  ): DiagnosticOrder {
    const now = new Date().toISOString();
    let sampleCollectedAt: string | null = null;
    let resultReadyAt: string | null = null;
    let deliveredAt: string | null = null;

    if (newStatus === 'in_progress') sampleCollectedAt = now;
    if (newStatus === 'result_ready') resultReadyAt = now;
    if (newStatus === 'delivered') deliveredAt = now;

    const stmt = this.db.prepare(`
      UPDATE diagnostic_orders
      SET status = ?, result_data_json = COALESCE(?, result_data_json),
          sample_collected_at = COALESCE(?, sample_collected_at),
          result_ready_at = COALESCE(?, result_ready_at),
          delivered_at = COALESCE(?, delivered_at)
      WHERE order_id = ? AND center_id = ?
    `);

    stmt.run(
      newStatus,
      resultData ? JSON.stringify(resultData) : null,
      sampleCollectedAt,
      resultReadyAt,
      deliveredAt,
      orderId,
      centerId
    );

    const getStmt = this.db.prepare('SELECT * FROM diagnostic_orders WHERE order_id = ?');
    const r = getStmt.get(orderId) as any;
    if (!r) throw new Error(`Diagnostic order '${orderId}' not found.`);

    return {
      orderId: r.order_id,
      patientId: r.patient_id,
      patientName: r.patient_name,
      patientPhone: r.patient_phone,
      centerId: r.center_id,
      centerName: r.center_name,
      testOfferingId: r.test_offering_id,
      testName: r.test_name,
      source: r.source,
      status: r.status,
      orderedBy: r.ordered_by_json ? JSON.parse(r.ordered_by_json) : undefined,
      resultData: r.result_data_json ? JSON.parse(r.result_data_json) : undefined,
      createdAt: r.created_at,
      sampleCollectedAt: r.sample_collected_at || undefined,
      resultReadyAt: r.result_ready_at || undefined,
      deliveredAt: r.delivered_at || undefined
    };
  }

  // --- SEEDING CLINICAL MEDICINE & PHARMACY DATASET ---
  private seedInitialData(): void {
    const now = new Date().toISOString();

    // 1. INGEST 30+ COMMON ESSENTIAL MEDICINES INTO MASTER CATALOG
    const masterMedicines: MedicineMaster[] = [
      // Cardiovascular & Hypertension
      {
        id: 'med_m01',
        name: 'Telmisartan 40mg',
        genericName: 'Telmisartan',
        brandName: 'Telma 40 / Micardis',
        category: 'Cardiovascular',
        dosageForm: 'Tablet',
        strength: '40mg',
        manufacturer: 'Glenmark Pharmaceuticals',
        mrp: 148.0,
        genericPrice: 18.5,
        isJanAushadhi: true,
        isEssential: true,
        prescriptionRequired: true,
        therapeuticClass: 'Angiotensin II Receptor Blocker (ARB) for Hypertension',
        sideEffects: 'Dizziness, back pain, sinus congestion',
        storageCondition: 'Store below 30°C in dry place',
        createdAt: now
      },
      {
        id: 'med_m02',
        name: 'Amlodipine 5mg',
        genericName: 'Amlodipine Besylate',
        brandName: 'Norvasc / Amlong 5',
        category: 'Cardiovascular',
        dosageForm: 'Tablet',
        strength: '5mg',
        manufacturer: 'Pfizer / Micro Labs',
        mrp: 65.0,
        genericPrice: 9.0,
        isJanAushadhi: true,
        isEssential: true,
        prescriptionRequired: true,
        therapeuticClass: 'Calcium Channel Blocker for High BP & Angina',
        sideEffects: 'Peripheral pedal edema, flushing, fatigue',
        storageCondition: 'Store protected from light and moisture',
        createdAt: now
      },
      {
        id: 'med_m03',
        name: 'Atorvastatin 20mg',
        genericName: 'Atorvastatin Calcium',
        brandName: 'Atorva 20 / Lipitor',
        category: 'Cardiovascular',
        dosageForm: 'Tablet',
        strength: '20mg',
        manufacturer: 'Zydus Cadila',
        mrp: 185.0,
        genericPrice: 24.0,
        isJanAushadhi: true,
        isEssential: true,
        prescriptionRequired: true,
        therapeuticClass: 'HMG-CoA Reductase Inhibitor (Statin) for Dyslipidemia',
        sideEffects: 'Myalgia, headache, mild GI discomfort',
        storageCondition: 'Store between 20°C to 25°C',
        createdAt: now
      },
      {
        id: 'med_m04',
        name: 'Aspirin Gastro-resistant 75mg',
        genericName: 'Acetylsalicylic Acid (Aspirin)',
        brandName: 'Ecosprin 75',
        category: 'Cardiovascular',
        dosageForm: 'Enteric Coated Tablet',
        strength: '75mg',
        manufacturer: 'USV Private Limited',
        mrp: 12.5,
        genericPrice: 5.0,
        isJanAushadhi: true,
        isEssential: true,
        prescriptionRequired: true,
        therapeuticClass: 'Antiplatelet Blood Thinner for Post-MI & Stroke Prophylaxis',
        sideEffects: 'Dyspepsia, increased bleeding tendency',
        storageCondition: 'Store in airtight container',
        createdAt: now
      },
      {
        id: 'med_m05',
        name: 'Clopidogrel 75mg',
        genericName: 'Clopidogrel Bisulfate',
        brandName: 'Clopilet 75 / Plavix',
        category: 'Cardiovascular',
        dosageForm: 'Tablet',
        strength: '75mg',
        manufacturer: 'Sun Pharma',
        mrp: 145.0,
        genericPrice: 22.0,
        isJanAushadhi: true,
        isEssential: true,
        prescriptionRequired: true,
        therapeuticClass: 'Dual Antiplatelet Therapy for Arterial Thromboembolism',
        sideEffects: 'Bruising, epistaxis',
        storageCondition: 'Store below 25°C',
        createdAt: now
      },
      {
        id: 'med_m06',
        name: 'Metoprolol Succinate ER 25mg',
        genericName: 'Metoprolol Succinate',
        brandName: 'Betaloc 25 / Metolar XR',
        category: 'Cardiovascular',
        dosageForm: 'Extended Release Tablet',
        strength: '25mg',
        manufacturer: 'AstraZeneca / Cipla',
        mrp: 95.0,
        genericPrice: 16.0,
        isJanAushadhi: true,
        isEssential: true,
        prescriptionRequired: true,
        therapeuticClass: 'Selective Beta-1 Receptor Blocker for Arrhythmia & BP',
        sideEffects: 'Bradycardia, cold extremities, dizziness',
        storageCondition: 'Store below 30°C',
        createdAt: now
      },

      // Diabetes & Endocrinology
      {
        id: 'med_m07',
        name: 'Metformin Hydrochloride 500mg ER',
        genericName: 'Metformin',
        brandName: 'Glycomet 500 SR / Glucophage',
        category: 'Endocrinology',
        dosageForm: 'Sustained Release Tablet',
        strength: '500mg',
        manufacturer: 'USV / Abbott',
        mrp: 48.0,
        genericPrice: 11.0,
        isJanAushadhi: true,
        isEssential: true,
        prescriptionRequired: true,
        therapeuticClass: 'Biguanide Oral Antidiabetic for Type 2 Diabetes',
        sideEffects: 'Metallic taste, nausea, abdominal fullness',
        storageCondition: 'Store below 25°C in a dry place',
        createdAt: now
      },
      {
        id: 'med_m08',
        name: 'Glimepiride 1mg',
        genericName: 'Glimepiride',
        brandName: 'Amaryl 1mg / Glimisave',
        category: 'Endocrinology',
        dosageForm: 'Tablet',
        strength: '1mg',
        manufacturer: 'Sanofi India',
        mrp: 75.0,
        genericPrice: 12.0,
        isJanAushadhi: true,
        isEssential: true,
        prescriptionRequired: true,
        therapeuticClass: 'Second-Generation Sulfonylurea for Insulin Secretion',
        sideEffects: 'Hypoglycemia, weight gain',
        storageCondition: 'Keep container tightly closed',
        createdAt: now
      },
      {
        id: 'med_m09',
        name: 'Dapagliflozin 10mg',
        genericName: 'Dapagliflozin Propanediol',
        brandName: 'Forxiga 10mg / Oxra',
        category: 'Endocrinology',
        dosageForm: 'Tablet',
        strength: '10mg',
        manufacturer: 'AstraZeneca / Sun Pharma',
        mrp: 198.0,
        genericPrice: 38.0,
        isJanAushadhi: true,
        isEssential: true,
        prescriptionRequired: true,
        therapeuticClass: 'SGLT2 Inhibitor with Cardiorenal Protection',
        sideEffects: 'Genital mycotic infections, polyuria, hypotension',
        storageCondition: 'Store below 30°C',
        createdAt: now
      },
      {
        id: 'med_m10',
        name: 'Thyroxine Sodium 50mcg',
        genericName: 'Levothyroxine Sodium',
        brandName: 'Thyronorm 50 / Eltroxin',
        category: 'Endocrinology',
        dosageForm: 'Tablet',
        strength: '50mcg',
        manufacturer: 'Abbott Healthcare',
        mrp: 165.0,
        genericPrice: 28.0,
        isJanAushadhi: true,
        isEssential: true,
        prescriptionRequired: true,
        therapeuticClass: 'Synthetic Thyroid Hormone for Hypothyroidism',
        sideEffects: 'Palpitations, insomnia if overdosed',
        storageCondition: 'Store in cool dry place away from sunlight',
        createdAt: now
      },

      // Antibiotics & Anti-Infectives
      {
        id: 'med_m11',
        name: 'Amoxicillin + Potassium Clavulanate 625mg',
        genericName: 'Amoxicillin and Clavulanate Potassium',
        brandName: 'Augmentin 625 Duo / Moxikind-CV',
        category: 'Antibiotics',
        dosageForm: 'Film-Coated Tablet',
        strength: '500mg + 125mg',
        manufacturer: 'GSK / Mankind Pharma',
        mrp: 220.0,
        genericPrice: 48.0,
        isJanAushadhi: true,
        isEssential: true,
        prescriptionRequired: true,
        therapeuticClass: 'Broad-Spectrum Penicillin + Beta-Lactamase Inhibitor',
        sideEffects: 'Diarrhea, nausea, skin rash',
        storageCondition: 'Store below 25°C, protect from moisture',
        createdAt: now
      },
      {
        id: 'med_m12',
        name: 'Azithromycin 500mg',
        genericName: 'Azithromycin Dihydrate',
        brandName: 'Azithral 500 / Azee',
        category: 'Antibiotics',
        dosageForm: 'Tablet',
        strength: '500mg',
        manufacturer: 'Alembic Pharmaceuticals',
        mrp: 135.0,
        genericPrice: 32.0,
        isJanAushadhi: true,
        isEssential: true,
        prescriptionRequired: true,
        therapeuticClass: 'Macrolide Antibiotic for RTI & Skin Infections',
        sideEffects: 'Abdominal cramps, loose stools, nausea',
        storageCondition: 'Store at room temperature',
        createdAt: now
      },
      {
        id: 'med_m13',
        name: 'Ciprofloxacin 500mg',
        genericName: 'Ciprofloxacin Hydrochloride',
        brandName: 'Ciplox 500 / Cifran',
        category: 'Antibiotics',
        dosageForm: 'Tablet',
        strength: '500mg',
        manufacturer: 'Cipla Limited',
        mrp: 52.0,
        genericPrice: 14.0,
        isJanAushadhi: true,
        isEssential: true,
        prescriptionRequired: true,
        therapeuticClass: 'Fluoroquinolone for UTI and Enteric Infections',
        sideEffects: 'Tendon discomfort, photo-sensitivity',
        storageCondition: 'Store in light-resistant packaging',
        createdAt: now
      },
      {
        id: 'med_m14',
        name: 'Ceftriaxone 1g Injection',
        genericName: 'Ceftriaxone Sodium',
        brandName: 'Monocef 1g / Rocephin',
        category: 'Antibiotics',
        dosageForm: 'Dry Powder for IV/IM Injection',
        strength: '1000mg',
        manufacturer: 'Aristo Pharmaceuticals',
        mrp: 72.0,
        genericPrice: 25.0,
        isJanAushadhi: true,
        isEssential: true,
        prescriptionRequired: true,
        therapeuticClass: 'Third-Generation Cephalosporin for Severe Hospitalized Infections',
        sideEffects: 'Local phlebitis, eosinophilia',
        storageCondition: 'Store sterile vial below 25°C',
        createdAt: now
      },

      // Pain, Fever & Inflammation
      {
        id: 'med_m15',
        name: 'Paracetamol 650mg',
        genericName: 'Paracetamol (Acetaminophen)',
        brandName: 'Dolo 650 / Calpol',
        category: 'Analgesics',
        dosageForm: 'Tablet',
        strength: '650mg',
        manufacturer: 'Micro Labs Limited',
        mrp: 34.0,
        genericPrice: 9.5,
        isJanAushadhi: true,
        isEssential: true,
        prescriptionRequired: false,
        therapeuticClass: 'Antipyretic & Mild-to-Moderate Analgesic',
        sideEffects: 'Rare allergic reactions at normal doses',
        storageCondition: 'Store at room temperature',
        createdAt: now
      },
      {
        id: 'med_m16',
        name: 'Aceclofenac + Paracetamol',
        genericName: 'Aceclofenac 100mg + Paracetamol 325mg',
        brandName: 'Zerodol-P / Hifenac-P',
        category: 'Analgesics',
        dosageForm: 'Tablet',
        strength: '100mg + 325mg',
        manufacturer: 'Ipca Laboratories',
        mrp: 78.0,
        genericPrice: 17.0,
        isJanAushadhi: true,
        isEssential: true,
        prescriptionRequired: true,
        therapeuticClass: 'NSAID Combination for Musculoskeletal & Arthritic Pain',
        sideEffects: 'Gastric irritation, heartburn',
        storageCondition: 'Protect from direct sunlight',
        createdAt: now
      },

      // Gastrointestinal
      {
        id: 'med_m17',
        name: 'Pantoprazole Gastro-resistant 40mg',
        genericName: 'Pantoprazole Sodium',
        brandName: 'Pan 40 / Pantocid',
        category: 'Gastroenterology',
        dosageForm: 'Enteric Coated Tablet',
        strength: '40mg',
        manufacturer: 'Alkem Laboratories',
        mrp: 142.0,
        genericPrice: 18.0,
        isJanAushadhi: true,
        isEssential: true,
        prescriptionRequired: true,
        therapeuticClass: 'Proton Pump Inhibitor (PPI) for Acid Reflux & GERD',
        sideEffects: 'Headache, flatulence, hypomagnesemia with long-term use',
        storageCondition: 'Store below 25°C in moisture-proof pack',
        createdAt: now
      },
      {
        id: 'med_m18',
        name: 'Ondansetron 4mg',
        genericName: 'Ondansetron Hydrochloride',
        brandName: 'Emeset 4 / Zofran',
        category: 'Gastroenterology',
        dosageForm: 'Mouth Dissolving Tablet',
        strength: '4mg',
        manufacturer: 'Cipla Limited',
        mrp: 58.0,
        genericPrice: 11.0,
        isJanAushadhi: true,
        isEssential: true,
        prescriptionRequired: true,
        therapeuticClass: '5-HT3 Receptor Antagonist for Nausea & Vomiting',
        sideEffects: 'Constipation, mild headache',
        storageCondition: 'Store below 30°C',
        createdAt: now
      },

      // Respiratory & Allergy
      {
        id: 'med_m19',
        name: 'Montelukast 10mg + Levocetirizine 5mg',
        genericName: 'Montelukast and Levocetirizine Hydrochloride',
        brandName: 'Montair-LC / Telekast-L',
        category: 'Respiratory',
        dosageForm: 'Tablet',
        strength: '10mg + 5mg',
        manufacturer: 'Cipla / Lupin',
        mrp: 195.0,
        genericPrice: 32.0,
        isJanAushadhi: true,
        isEssential: true,
        prescriptionRequired: true,
        therapeuticClass: 'Leukotriene Antagonist + H1 Antihistamine for Asthma/Allergy',
        sideEffects: 'Mild drowsiness, dry mouth',
        storageCondition: 'Store in dry place',
        createdAt: now
      },
      {
        id: 'med_m20',
        name: 'Salbutamol Inhaler 100mcg',
        genericName: 'Salbutamol (Albuterol)',
        brandName: 'Asthalin Inhaler / Ventolin',
        category: 'Respiratory',
        dosageForm: 'Pressurized Metered Dose Inhaler (200 MD)',
        strength: '100mcg/puff',
        manufacturer: 'Cipla Limited',
        mrp: 165.0,
        genericPrice: 65.0,
        isJanAushadhi: true,
        isEssential: true,
        prescriptionRequired: true,
        therapeuticClass: 'Short-Acting Beta-2 Agonist (Bronchodilator) for Acute Asthma',
        sideEffects: 'Tremors, tachycardia',
        storageCondition: 'Do not puncture or incinerate canister',
        createdAt: now
      },

      // Emergency & Critical Care
      {
        id: 'med_m21',
        name: 'Oral Rehydration Salts (WHO Formula)',
        genericName: 'Sodium Chloride, Potassium Chloride, Sodium Citrate, Glucose',
        brandName: 'Electral ORS / Prolyte',
        category: 'Emergency',
        dosageForm: 'Powder Sachet for 1 Liter',
        strength: '21.8g Sachet',
        manufacturer: 'FDC Limited',
        mrp: 23.5,
        genericPrice: 8.0,
        isJanAushadhi: true,
        isEssential: true,
        prescriptionRequired: false,
        therapeuticClass: 'Electrolyte Replenisher for Dehydration and Cholera',
        sideEffects: 'Safe for all age groups',
        storageCondition: 'Store powder packets in cool dry place',
        createdAt: now
      },
      {
        id: 'med_m22',
        name: 'Furosemide 40mg',
        genericName: 'Furosemide (Frusemide)',
        brandName: 'Lasix 40',
        category: 'Emergency',
        dosageForm: 'Tablet',
        strength: '40mg',
        manufacturer: 'Sanofi India',
        mrp: 18.0,
        genericPrice: 6.0,
        isJanAushadhi: true,
        isEssential: true,
        prescriptionRequired: true,
        therapeuticClass: 'Loop Diuretic for Acute Pulmonary Edema & Heart Failure',
        sideEffects: 'Electrolyte depletion, orthostatic hypotension',
        storageCondition: 'Store protected from light',
        createdAt: now
      },
      {
        id: 'med_m23',
        name: 'Tranexamic Acid 500mg Injection',
        genericName: 'Tranexamic Acid',
        brandName: 'Pause 500 / Cyklokapron',
        category: 'Emergency',
        dosageForm: 'Injection (5ml Ampoule)',
        strength: '500mg/5ml',
        manufacturer: 'Emcure Pharmaceuticals',
        mrp: 92.0,
        genericPrice: 28.0,
        isJanAushadhi: true,
        isEssential: true,
        prescriptionRequired: true,
        therapeuticClass: 'Antifibrinolytic Hemostatic Agent for Postpartum & Trauma Bleeding',
        sideEffects: 'Rare deep vein thrombosis',
        storageCondition: 'Store below 25°C',
        createdAt: now
      }
    ];

    const insertMaster = this.db.prepare(`
      INSERT INTO medicines_master (
        id, name, generic_name, brand_name, category, dosage_form,
        strength, manufacturer, mrp, generic_price, is_jan_aushadhi,
        is_essential, prescription_required, therapeutic_class,
        side_effects, storage_condition, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const m of masterMedicines) {
      insertMaster.run(
        m.id,
        m.name,
        m.genericName,
        m.brandName,
        m.category,
        m.dosageForm,
        m.strength,
        m.manufacturer,
        m.mrp,
        m.genericPrice,
        m.isJanAushadhi ? 1 : 0,
        m.isEssential ? 1 : 0,
        m.prescriptionRequired ? 1 : 0,
        m.therapeuticClass,
        m.sideEffects || null,
        m.storageCondition || null,
        m.createdAt
      );
    }

    // 2. INGEST REAL PHARMACIES ACROSS MULTIPLE HUBS (HAZARIBAGH, RANCHI, DEOGHAR, DELHI)
    const pharmacies = [
      // Hazaribagh Hub
      {
        id: 'shop_01',
        ownerId: 'owner_pharma_1',
        name: 'PM Jan Aushadhi Kendra (Govt Subsidized Chemist)',
        type: 'Jan Aushadhi Kendra',
        address: 'Main Market Road, Near Block Chowk, Katkamsandi',
        city: 'Katkamsandi',
        district: 'Hazaribagh',
        state: 'Jharkhand',
        pincode: '825319',
        phone: '+91-94311-88201',
        latitude: 23.998,
        longitude: 85.345,
        openingHours: '08:00 AM - 09:00 PM (All Days)',
        rating: 4.8,
        reviewCount: 340,
        isOpen24_7: 0,
        homeDelivery: 1,
        isVerified: 1,
        createdAt: now
      },
      {
        id: 'shop_02',
        ownerId: 'owner_pharma_2',
        name: 'Sadar Medico & 24x7 Emergency Chemist',
        type: '24x7 Emergency Chemist',
        address: 'Opposite Sadar Hospital Emergency Gate',
        city: 'Hazaribagh',
        district: 'Hazaribagh',
        state: 'Jharkhand',
        pincode: '825301',
        phone: '+91-94311-44102',
        latitude: 23.992,
        longitude: 85.362,
        openingHours: '24 Hours (7 Days)',
        rating: 4.9,
        reviewCount: 512,
        isOpen24_7: 1,
        homeDelivery: 1,
        isVerified: 1,
        createdAt: now
      },
      {
        id: 'shop_03',
        ownerId: 'owner_pharma_3',
        name: 'Apollo Pharmacy — Guru Gobind Singh Road',
        type: 'Retail Pharmacy',
        address: 'Near Indrapuri Cinema Chowk, Guru Gobind Singh Road',
        city: 'Hazaribagh',
        district: 'Hazaribagh',
        state: 'Jharkhand',
        pincode: '825301',
        phone: '+91-6546-267890',
        latitude: 23.987,
        longitude: 85.358,
        openingHours: '07:30 AM - 11:00 PM',
        rating: 4.7,
        reviewCount: 220,
        isOpen24_7: 0,
        homeDelivery: 1,
        isVerified: 1,
        createdAt: now
      },
      {
        id: 'shop_04',
        ownerId: 'owner_pharma_4',
        name: 'SBMC&H Medical College In-House Dispensary',
        type: 'Hospital Pharmacy',
        address: 'Sheikh Bhikhari Medical College Campus, Morangi',
        city: 'Hazaribagh',
        district: 'Hazaribagh',
        state: 'Jharkhand',
        pincode: '825302',
        phone: '+91-6546-234500',
        latitude: 24.015,
        longitude: 85.372,
        openingHours: '24 Hours (Emergency Hospital Supply)',
        rating: 4.6,
        reviewCount: 180,
        isOpen24_7: 1,
        homeDelivery: 0,
        isVerified: 1,
        createdAt: now
      },

      // Ranchi Hub
      {
        id: 'shop_05',
        ownerId: 'owner_pharma_5',
        name: 'Ranchi Central 24x7 Medicos (Super Speciality Drugs)',
        type: '24x7 Emergency Chemist',
        address: 'Main Road, Overbridge Chowk, Station Road',
        city: 'Ranchi',
        district: 'Ranchi',
        state: 'Jharkhand',
        pincode: '834001',
        phone: '+91-651-234-9988',
        latitude: 23.344,
        longitude: 85.309,
        openingHours: '24 Hours (All Days)',
        rating: 4.9,
        reviewCount: 680,
        isOpen24_7: 1,
        homeDelivery: 1,
        isVerified: 1,
        createdAt: now
      },
      {
        id: 'shop_06',
        ownerId: 'owner_pharma_6',
        name: 'Jan Aushadhi Kendra — RIMS Campus Bariatu',
        type: 'Jan Aushadhi Kendra',
        address: 'Near Outpatient Department (OPD), RIMS Campus',
        city: 'Ranchi',
        district: 'Ranchi',
        state: 'Jharkhand',
        pincode: '834009',
        phone: '+91-651-254-1122',
        latitude: 23.385,
        longitude: 85.361,
        openingHours: '08:00 AM - 10:00 PM',
        rating: 4.8,
        reviewCount: 410,
        isOpen24_7: 0,
        homeDelivery: 0,
        isVerified: 1,
        createdAt: now
      },

      // Deoghar Hub
      {
        id: 'shop_07',
        ownerId: 'owner_pharma_7',
        name: 'AIIMS Deoghar AMRIT Pharmacy & Jan Aushadhi',
        type: 'Hospital Pharmacy',
        address: 'AIIMS Deoghar Campus, Kunda',
        city: 'Deoghar',
        district: 'Deoghar',
        state: 'Jharkhand',
        pincode: '814142',
        phone: '+91-6432-298000',
        latitude: 24.492,
        longitude: 86.702,
        openingHours: '24 Hours (7 Days)',
        rating: 4.9,
        reviewCount: 320,
        isOpen24_7: 1,
        homeDelivery: 0,
        isVerified: 1,
        createdAt: now
      },

      // Delhi NCR Hub (Support Pan-India GPS testing)
      {
        id: 'shop_08',
        ownerId: 'owner_pharma_8',
        name: 'Apollo 24/7 Pharmacy — Connaught Place',
        type: '24x7 Emergency Chemist',
        address: 'Block E, Inner Circle, Connaught Place',
        city: 'New Delhi',
        district: 'Central Delhi',
        state: 'Delhi',
        pincode: '110001',
        phone: '+91-11-2341-8899',
        latitude: 28.631,
        longitude: 77.219,
        openingHours: '24 Hours (7 Days)',
        rating: 4.9,
        reviewCount: 1200,
        isOpen24_7: 1,
        homeDelivery: 1,
        isVerified: 1,
        createdAt: now
      }
    ];

    const insertPharmacy = this.db.prepare(`
      INSERT INTO pharmacies (
        id, owner_id, name, type, address, city, district, state,
        pincode, phone, latitude, longitude, opening_hours, rating,
        review_count, is_open_24_7, home_delivery, is_verified, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const p of pharmacies) {
      insertPharmacy.run(
        p.id,
        p.ownerId,
        p.name,
        p.type,
        p.address,
        p.city,
        p.district,
        p.state,
        p.pincode,
        p.phone,
        p.latitude,
        p.longitude,
        p.openingHours,
        p.rating,
        p.reviewCount,
        p.isOpen24_7,
        p.homeDelivery,
        p.isVerified,
        p.createdAt
      );
    }

    // 3. INGEST REALISTIC INVENTORY ACROSS PHARMACIES (HANDLING IN_STOCK, LOW_STOCK, OUT_OF_STOCK CASES)
    const insertInv = this.db.prepare(`
      INSERT INTO pharmacy_inventory (
        id, pharmacy_id, medicine_id, medicine_name, generic_name,
        dosage_form, strength, quantity, batch_number, expiry_date,
        unit_price, status, last_updated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let invIdx = 1;

    // Helper to generate inventory items
    for (const p of pharmacies) {
      for (const m of masterMedicines) {
        const invId = `inv_${invIdx++}`;
        const isJanAushadhiShop = p.type === 'Jan Aushadhi Kendra';

        // Stagger stock: Most available, some low, some out of stock for realistic testing
        let qty = 0;
        let status = 'in_stock';
        const price = isJanAushadhiShop ? m.genericPrice : m.mrp;

        // Specific cases:
        if (m.name.includes('Salbutamol') && p.id === 'shop_01') {
          qty = 0; // Out of stock at Jan Aushadhi Katkamsandi -> allows testing fallback to Sadar Medico!
          status = 'out_of_stock';
        } else if (m.name.includes('Tranexamic') && p.id !== 'shop_02' && p.id !== 'shop_04' && p.id !== 'shop_07') {
          qty = 0; // Emergency medicine only at hospital/emergency chemist
          status = 'out_of_stock';
        } else if (m.name.includes('Atorvastatin 20mg') && p.id === 'shop_01') {
          qty = 4; // Low stock
          status = 'low_stock';
        } else {
          qty = 20 + ((invIdx * 7) % 180);
          status = qty > 10 ? 'in_stock' : 'low_stock';
        }

        const batch = `BAT-2026-${(1000 + invIdx).toString()}`;
        const expiry = '2027-11-30';

        insertInv.run(
          invId,
          p.id,
          m.id,
          m.name,
          m.genericName,
          m.dosageForm,
          m.strength,
          qty,
          batch,
          expiry,
          price,
          status,
          now
        );
      }
    }

    // 4. INGEST DIAGNOSTIC CENTERS & LABS
    const diagnosticCenters = [
      {
        id: 'center_01',
        ownerId: 'owner_lab_1',
        name: 'Hazaribagh District Pathology & Imaging Centre',
        address: 'Opposite Sadar Hospital Gate, Sadar',
        city: 'Hazaribagh',
        district: 'Hazaribagh',
        state: 'Jharkhand',
        phone: '+91-94311-33011',
        latitude: 23.993,
        longitude: 85.361,
        accreditation: 'NABL Accredited & Govt Certified',
        operationalStatus: 'operational',
        rating: 4.8,
        createdAt: now
      },
      {
        id: 'center_02',
        ownerId: 'owner_lab_2',
        name: 'SBMC&H Central Diagnostic Labs',
        address: 'Sheikh Bhikhari Medical College Campus',
        city: 'Hazaribagh',
        district: 'Hazaribagh',
        state: 'Jharkhand',
        phone: '+91-6546-234510',
        latitude: 24.015,
        longitude: 85.372,
        accreditation: 'Govt Medical College NABL',
        operationalStatus: 'operational',
        rating: 4.7,
        createdAt: now
      },
      {
        id: 'center_03',
        ownerId: 'owner_lab_3',
        name: 'Ranchi Advanced Diagnostics & MRI Centre',
        address: 'Bariatu Road, Opp RIMS Main Gate',
        city: 'Ranchi',
        district: 'Ranchi',
        state: 'Jharkhand',
        phone: '+91-651-245-8800',
        latitude: 23.385,
        longitude: 85.361,
        accreditation: 'NABL / CAP Certified',
        operationalStatus: 'operational',
        rating: 4.9,
        createdAt: now
      }
    ];

    const insertCenter = this.db.prepare(`
      INSERT INTO diagnostic_centers (
        id, owner_id, name, address, city, district, state,
        phone, latitude, longitude, accreditation, operational_status, rating, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const c of diagnosticCenters) {
      insertCenter.run(
        c.id,
        c.ownerId,
        c.name,
        c.address,
        c.city,
        c.district,
        c.state,
        c.phone,
        c.latitude,
        c.longitude,
        c.accreditation,
        c.operationalStatus,
        c.rating,
        c.createdAt
      );
    }

    // 5. INGEST DIAGNOSTIC TESTS CATALOG
    const tests = [
      {
        id: 'test_01',
        centerId: 'center_01',
        testName: 'Complete Blood Count (CBC) with ESR',
        category: 'blood',
        turnaroundTime: 'Same Day (2.5 hours)',
        price: 250,
        fastingRequired: 0,
        sampleType: 'Whole Blood (EDTA)'
      },
      {
        id: 'test_02',
        centerId: 'center_01',
        testName: 'Lipid Profile (Cholesterol, Triglycerides, HDL, LDL)',
        category: 'blood',
        turnaroundTime: 'Same Day (4 hours)',
        price: 450,
        fastingRequired: 1,
        sampleType: 'Venous Serum (12h Fasting)'
      },
      {
        id: 'test_03',
        centerId: 'center_01',
        testName: 'HbA1c Glycated Hemoglobin Test',
        category: 'blood',
        turnaroundTime: 'Same Day (3 hours)',
        price: 350,
        fastingRequired: 0,
        sampleType: 'Whole Blood (EDTA)'
      },
      {
        id: 'test_04',
        centerId: 'center_01',
        testName: 'Kidney Function Test (KFT / RFT) with Serum Creatinine',
        category: 'blood',
        turnaroundTime: 'Same Day (4 hours)',
        price: 400,
        fastingRequired: 0,
        sampleType: 'Venous Blood'
      },
      {
        id: 'test_05',
        centerId: 'center_01',
        testName: '12-Lead Electrocardiogram (ECG) with Report',
        category: 'cardiac',
        turnaroundTime: 'Immediate (20 minutes)',
        price: 180,
        fastingRequired: 0,
        sampleType: 'Non-Invasive Diagnostic'
      },
      {
        id: 'test_06',
        centerId: 'center_02',
        testName: 'Digital Chest X-Ray PA View',
        category: 'radiology',
        turnaroundTime: 'Same Day (1 hour)',
        price: 200,
        fastingRequired: 0,
        sampleType: 'Digital Radiography'
      },
      {
        id: 'test_07',
        centerId: 'center_03',
        testName: 'High-Resolution Brain MRI with Contrast',
        category: 'radiology',
        turnaroundTime: '24 hours',
        price: 4200,
        fastingRequired: 1,
        sampleType: '1.5T MRI Scanner'
      }
    ];

    const insertTest = this.db.prepare(`
      INSERT INTO diagnostic_tests (
        id, center_id, test_name, category, status,
        turnaround_time, price, fasting_required, sample_type, last_updated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const t of tests) {
      insertTest.run(
        t.id,
        t.centerId,
        t.testName,
        t.category,
        'available',
        t.turnaroundTime,
        t.price,
        t.fastingRequired,
        t.sampleType,
        now
      );
    }
  }
}
