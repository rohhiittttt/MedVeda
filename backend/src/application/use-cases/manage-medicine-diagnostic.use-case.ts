/**
 * Application Use Case: Feature Map 06 — Medicine Availability & Diagnostic Coordination
 */

import type {
  ActorContext,
  DiagnosticOrder,
  DiagnosticOrderResultData,
  DiagnosticOrderStatus,
  DiagnosticTestOffering,
  MedicineInventoryItem,
  MedicineOrderRequest,
  MedicineOrderRequestStatus
} from '../../domain/models/medicine-diagnostic.model.ts';
import {
  ForbiddenError,
  rankDiagnosticCenters,
  rankMedicineShops,
  validateDiagnosticCenterAccess,
  validateShopInventoryAccess
} from '../../domain/rules/medicine-rbac.rules.ts';
import { InMemoryMedicineDiagnosticStore } from '../../infrastructure/cache/medicine-diagnostic.store.ts';
import { SqliteMedicineStore } from '../../infrastructure/db/sqlite-medicine.store.ts';

export interface CreateMedicineOrderDTO {
  patientId: string;
  patientName: string;
  patientPhone: string;
  shopId: string;
  inventoryId: string;
  quantityRequested: number;
}

export interface BookDiagnosticTestDTO {
  patientId: string;
  patientName: string;
  patientPhone: string;
  centerId: string;
  testOfferingId: string;
}

export interface CreateDoctorDiagnosticOrderDTO {
  patientId: string;
  patientName: string;
  patientPhone: string;
  centerId: string;
  testOfferingId: string;
  doctor: {
    id: string;
    name: string;
    role: string;
  };
}

export class ManageMedicineDiagnosticUseCase {
  private readonly store: InMemoryMedicineDiagnosticStore | SqliteMedicineStore | any;

  constructor(store: InMemoryMedicineDiagnosticStore | SqliteMedicineStore | any) {
    this.store = store;
  }

  // ==========================================
  // --- MEDICINE MASTER & GPS SEARCH OPERATIONS ---
  // ==========================================

  public async searchMedicinesMaster(query: string, category?: string) {
    if (this.store.searchMedicinesMaster) {
      return this.store.searchMedicinesMaster(query, category);
    }
    return [];
  }

  public async getMedicineCategories() {
    if (this.store.getMedicineCategories) {
      return this.store.getMedicineCategories();
    }
    return ['Cardiovascular', 'Endocrinology', 'Antibiotics', 'Analgesics', 'Gastroenterology', 'Respiratory', 'Emergency'];
  }

  public async searchMedicines(
    query: string,
    lat: number = 23.998,
    lng: number = 85.345,
    radiusKm: number = 25
  ) {
    if (this.store.searchNearbyPharmaciesWithStock) {
      return this.store.searchNearbyPharmaciesWithStock(query, lat, lng, radiusKm);
    }
    const allShops = this.store.getAllShops();
    const allInventory = this.store.getAllInventory();
    return rankMedicineShops(allShops, allInventory, lat, lng, query, radiusKm);
  }

  public async searchNearbyPharmacies(
    query: string,
    lat: number = 23.998,
    lng: number = 85.345,
    radiusKm: number = 25
  ) {
    if (this.store.searchNearbyPharmaciesWithStock) {
      return this.store.searchNearbyPharmaciesWithStock(query, lat, lng, radiusKm);
    }
    return this.searchMedicines(query, lat, lng, radiusKm);
  }

  public async getTopNearbyPharmacies(
    lat: number = 23.998,
    lng: number = 85.345,
    radiusKm: number = 50
  ) {
    if (this.store.getNearbyPharmacies) {
      return this.store.getNearbyPharmacies(lat, lng, radiusKm);
    }
    return this.store.getAllShops();
  }

  public async getShopInventory(shopId: string) {
    const shop = this.store.getShopById(shopId);
    if (!shop) {
      throw new Error(`Medical Shop '${shopId}' not found.`);
    }
    const items = this.store.getInventoryByShopId(shopId);
    return { shop, items };
  }

  public async addInventoryItem(
    shopId: string,
    actor: ActorContext,
    dto: Partial<MedicineInventoryItem>
  ): Promise<MedicineInventoryItem> {
    const shop = this.store.getShopById(shopId);
    if (!shop) {
      throw new Error(`Medical Shop '${shopId}' not found.`);
    }

    validateShopInventoryAccess(actor, shop);

    if (!dto.medicineName || !dto.medicineName.trim()) {
      throw new Error('Medicine name is required.');
    }

    const inventoryId = `inv_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const newItem: MedicineInventoryItem = {
      inventoryId,
      shopId,
      medicineName: dto.medicineName.trim(),
      genericName: dto.genericName?.trim() || undefined,
      dosageForm: dto.dosageForm || 'Tablet',
      strength: dto.strength || 'Standard',
      quantity: Number(dto.quantity ?? 100),
      status: Number(dto.quantity ?? 100) > 0 ? (dto.status || 'in_stock') : 'out_of_stock',
      price: dto.price !== undefined ? Number(dto.price) : undefined,
      lastUpdated: new Date().toISOString()
    };

    return this.store.saveInventoryItem(newItem);
  }

  public async updateInventoryItem(
    shopId: string,
    inventoryId: string,
    actor: ActorContext,
    updates: Partial<MedicineInventoryItem>
  ): Promise<MedicineInventoryItem> {
    const shop = this.store.getShopById(shopId);
    if (!shop) {
      throw new Error(`Medical Shop '${shopId}' not found.`);
    }

    validateShopInventoryAccess(actor, shop);

    const existing = this.store.getInventoryItemById(inventoryId);
    if (!existing || existing.shopId !== shopId) {
      throw new Error(`Medicine Inventory item '${inventoryId}' not found in shop '${shopId}'.`);
    }

    const updatedQty = updates.quantity !== undefined ? Number(updates.quantity) : existing.quantity;
    const updatedStatus = updatedQty === 0 ? 'out_of_stock' : (updates.status || existing.status);

    const updatedItem: MedicineInventoryItem = {
      ...existing,
      ...updates,
      quantity: updatedQty,
      status: updatedStatus,
      lastUpdated: new Date().toISOString()
    };

    return this.store.saveInventoryItem(updatedItem);
  }

  public async deleteInventoryItem(
    shopId: string,
    inventoryId: string,
    actor: ActorContext
  ): Promise<{ success: boolean; message: string }> {
    const shop = this.store.getShopById(shopId);
    if (!shop) {
      throw new Error(`Medical Shop '${shopId}' not found.`);
    }

    validateShopInventoryAccess(actor, shop);

    const existing = this.store.getInventoryItemById(inventoryId);
    if (!existing || existing.shopId !== shopId) {
      throw new Error(`Medicine Inventory item '${inventoryId}' not found in shop '${shopId}'.`);
    }

    this.store.deleteInventoryItem(inventoryId);
    return { success: true, message: `Medicine '${existing.medicineName}' removed from inventory.` };
  }

  // ==========================================
  // --- MEDICINE ORDERS & RESERVATIONS ---
  // ==========================================

  public async createMedicineOrder(dto: CreateMedicineOrderDTO): Promise<MedicineOrderRequest> {
    const shop = this.store.getShopById(dto.shopId);
    if (!shop) {
      throw new Error(`Medical Shop '${dto.shopId}' not found.`);
    }

    const item = this.store.getInventoryItemById(dto.inventoryId);
    if (!item || item.shopId !== dto.shopId) {
      throw new Error(`Medicine '${dto.inventoryId}' is not available at shop '${dto.shopId}'.`);
    }

    const orderId = `ord_med_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const newOrder: MedicineOrderRequest = {
      orderId,
      patientId: dto.patientId,
      patientName: dto.patientName,
      patientPhone: dto.patientPhone,
      shopId: dto.shopId,
      shopName: shop.name,
      inventoryId: dto.inventoryId,
      medicineName: item.medicineName,
      quantityRequested: dto.quantityRequested || 1,
      status: 'requested',
      requestedAt: new Date().toISOString()
    };

    return this.store.saveMedicineOrder(newOrder);
  }

  public async getShopOrders(shopId: string, actor: ActorContext): Promise<MedicineOrderRequest[]> {
    const shop = this.store.getShopById(shopId);
    if (!shop) {
      throw new Error(`Medical Shop '${shopId}' not found.`);
    }
    validateShopInventoryAccess(actor, shop);
    return this.store.getMedicineOrdersByShopId(shopId);
  }

  public async updateMedicineOrderStatus(
    shopId: string,
    orderId: string,
    actor: ActorContext,
    newStatus: MedicineOrderRequestStatus,
    ownerNotes?: string
  ): Promise<MedicineOrderRequest> {
    const shop = this.store.getShopById(shopId);
    if (!shop) {
      throw new Error(`Medical Shop '${shopId}' not found.`);
    }

    validateShopInventoryAccess(actor, shop);

    const order = this.store.getMedicineOrderById(orderId);
    if (!order || order.shopId !== shopId) {
      throw new Error(`Order '${orderId}' not found for shop '${shopId}'.`);
    }

    order.status = newStatus;
    if (newStatus === 'confirmed') {
      order.confirmedAt = new Date().toISOString();
    }
    if (ownerNotes) {
      order.ownerNotes = ownerNotes;
    }

    return this.store.saveMedicineOrder(order);
  }

  // ==========================================
  // --- DIAGNOSTIC CATALOG OPERATIONS (LAB RBAC) ---
  // ==========================================

  public async searchDiagnosticTests(
    query: string,
    lat: number = 23.994,
    lng: number = 85.364,
    radiusKm: number = 30
  ) {
    const allCenters = this.store.getAllDiagnosticCenters();
    const allTests = this.store.getAllTestOfferings();
    return rankDiagnosticCenters(allCenters, allTests, lat, lng, query, radiusKm);
  }

  public async getCenterTestCatalog(centerId: string) {
    const center = this.store.getDiagnosticCenterById(centerId);
    if (!center) {
      throw new Error(`Diagnostic Center '${centerId}' not found.`);
    }
    const tests = this.store.getTestOfferingsByCenterId(centerId);
    return { center, tests };
  }

  public async addTestOffering(
    centerId: string,
    actor: ActorContext,
    dto: Partial<DiagnosticTestOffering>
  ): Promise<DiagnosticTestOffering> {
    const center = this.store.getDiagnosticCenterById(centerId);
    if (!center) {
      throw new Error(`Diagnostic Center '${centerId}' not found.`);
    }

    validateDiagnosticCenterAccess(actor, center);

    if (!dto.testName || !dto.testName.trim()) {
      throw new Error('Diagnostic test name is required.');
    }

    const testOfferingId = `test_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const newTest: DiagnosticTestOffering = {
      testOfferingId,
      centerId,
      testName: dto.testName.trim(),
      category: dto.category || 'blood',
      status: dto.status || 'available',
      turnaroundTime: dto.turnaroundTime || 'Same Day (4 hours)',
      price: dto.price !== undefined ? Number(dto.price) : undefined,
      fastingRequired: Boolean(dto.fastingRequired),
      sampleType: dto.sampleType || 'Venous Blood',
      lastUpdated: new Date().toISOString()
    };

    return this.store.saveTestOffering(newTest);
  }

  public async updateTestOffering(
    centerId: string,
    testOfferingId: string,
    actor: ActorContext,
    updates: Partial<DiagnosticTestOffering>
  ): Promise<DiagnosticTestOffering> {
    const center = this.store.getDiagnosticCenterById(centerId);
    if (!center) {
      throw new Error(`Diagnostic Center '${centerId}' not found.`);
    }

    validateDiagnosticCenterAccess(actor, center);

    const existing = this.store.getTestOfferingById(testOfferingId);
    if (!existing || existing.centerId !== centerId) {
      throw new Error(`Diagnostic test '${testOfferingId}' not found in center '${centerId}'.`);
    }

    const updatedTest: DiagnosticTestOffering = {
      ...existing,
      ...updates,
      lastUpdated: new Date().toISOString()
    };

    return this.store.saveTestOffering(updatedTest);
  }

  public async deleteTestOffering(
    centerId: string,
    testOfferingId: string,
    actor: ActorContext
  ): Promise<{ success: boolean; message: string }> {
    const center = this.store.getDiagnosticCenterById(centerId);
    if (!center) {
      throw new Error(`Diagnostic Center '${centerId}' not found.`);
    }

    validateDiagnosticCenterAccess(actor, center);

    const existing = this.store.getTestOfferingById(testOfferingId);
    if (!existing || existing.centerId !== centerId) {
      throw new Error(`Diagnostic test '${testOfferingId}' not found in center '${centerId}'.`);
    }

    this.store.deleteTestOffering(testOfferingId);
    return { success: true, message: `Test '${existing.testName}' removed from catalog.` };
  }

  // ==========================================
  // --- DIAGNOSTIC BOOKINGS & STATUS PROGRESSION ---
  // ==========================================

  public async bookDiagnosticTest(dto: BookDiagnosticTestDTO): Promise<DiagnosticOrder> {
    const center = this.store.getDiagnosticCenterById(dto.centerId);
    if (!center) {
      throw new Error(`Diagnostic Center '${dto.centerId}' not found.`);
    }

    const test = this.store.getTestOfferingById(dto.testOfferingId);
    if (!test || test.centerId !== dto.centerId) {
      throw new Error(`Test '${dto.testOfferingId}' is not offered by center '${dto.centerId}'.`);
    }

    const orderId = `diag_ord_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const newOrder: DiagnosticOrder = {
      orderId,
      patientId: dto.patientId,
      patientName: dto.patientName,
      patientPhone: dto.patientPhone,
      centerId: dto.centerId,
      centerName: center.name,
      testOfferingId: dto.testOfferingId,
      testName: test.testName,
      source: 'direct_search',
      status: 'sample_pending',
      createdAt: new Date().toISOString()
    };

    return this.store.saveDiagnosticOrder(newOrder);
  }

  public async createDoctorDiagnosticOrder(
    dto: CreateDoctorDiagnosticOrderDTO
  ): Promise<DiagnosticOrder> {
    const center = this.store.getDiagnosticCenterById(dto.centerId);
    if (!center) {
      throw new Error(`Diagnostic Center '${dto.centerId}' not found.`);
    }

    const test = this.store.getTestOfferingById(dto.testOfferingId);
    if (!test || test.centerId !== dto.centerId) {
      throw new Error(`Test '${dto.testOfferingId}' is not offered by center '${dto.centerId}'.`);
    }

    const orderId = `diag_ord_doc_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const newOrder: DiagnosticOrder = {
      orderId,
      patientId: dto.patientId,
      patientName: dto.patientName,
      patientPhone: dto.patientPhone,
      centerId: dto.centerId,
      centerName: center.name,
      testOfferingId: dto.testOfferingId,
      testName: test.testName,
      source: 'doctor_ordered',
      status: 'sample_pending',
      orderedBy: dto.doctor,
      createdAt: new Date().toISOString()
    };

    return this.store.saveDiagnosticOrder(newOrder);
  }

  public async getDiagnosticOrdersByCenter(centerId: string, actor: ActorContext): Promise<DiagnosticOrder[]> {
    const center = this.store.getDiagnosticCenterById(centerId);
    if (!center) {
      throw new Error(`Diagnostic Center '${centerId}' not found.`);
    }
    validateDiagnosticCenterAccess(actor, center);
    return this.store.getDiagnosticOrdersByCenterId(centerId);
  }

  public async getDiagnosticOrderById(orderId: string): Promise<DiagnosticOrder> {
    const order = this.store.getDiagnosticOrderById(orderId);
    if (!order) {
      throw new Error(`Diagnostic Order '${orderId}' not found.`);
    }
    return order;
  }

  public async updateDiagnosticOrderStatus(
    centerId: string,
    orderId: string,
    actor: ActorContext,
    newStatus: DiagnosticOrderStatus,
    resultData?: DiagnosticOrderResultData,
    centerNotes?: string
  ): Promise<DiagnosticOrder> {
    const center = this.store.getDiagnosticCenterById(centerId);
    if (!center) {
      throw new Error(`Diagnostic Center '${centerId}' not found.`);
    }

    validateDiagnosticCenterAccess(actor, center);

    const order = this.store.getDiagnosticOrderById(orderId);
    if (!order || order.centerId !== centerId) {
      throw new Error(`Diagnostic Order '${orderId}' not found for center '${centerId}'.`);
    }

    order.status = newStatus;
    const now = new Date().toISOString();

    if (newStatus === 'in_progress') {
      order.sampleCollectedAt = order.sampleCollectedAt || now;
    } else if (newStatus === 'result_ready') {
      order.resultReadyAt = now;
      if (resultData) {
        order.resultData = resultData;
      }
    } else if (newStatus === 'delivered') {
      order.deliveredAt = now;
    }

    if (centerNotes) {
      order.centerNotes = centerNotes;
    }

    return this.store.saveDiagnosticOrder(order);
  }
}
