/**
 * Feature Map 09 — District Admin Command Center
 * Intelligence Engine: 4-engine analytical pipeline
 * 1. Threshold & Buffer Engine (Reactive)
 * 2. Shortage Forecast Engine (Predictive 7-14d)
 * 3. Epidemic Early Warning Engine (EARS/CUSUM/DBSCAN)
 * 4. Transfer Recommender
 */

import type {
  StockSnapshot,
  BedSnapshot,
  SyndromicCount,
  CommandFacility,
  ThresholdRule,
  CommandAlert,
  StockoutForecast,
  EarlyWarningResult,
  TransferRecommendation,
  AlertSeverity,
  SymptomCluster
} from '../models/command-center.model.ts';

// ─── Engine 1: Threshold & Buffer Engine ─────────────────────────────────────

/**
 * Evaluates a stock snapshot against configured threshold rules.
 * Returns an alert if any threshold is breached, null otherwise.
 */
export function evaluateStockThreshold(
  snapshot: StockSnapshot,
  rules: ThresholdRule[],
  existingAlerts: CommandAlert[]
): CommandAlert | null {
  // Find most specific applicable rule (facility-level > district-level)
  const rule =
    rules.find(r => r.facilityId === snapshot.facilityId && r.resourceId === snapshot.resourceId && r.isActive) ||
    rules.find(r => r.facilityId === null && r.resourceId === snapshot.resourceId && r.isActive);

  if (!rule) return null;

  const qty = snapshot.currentQuantity;
  const daysOfCover = snapshot.daysOfCoverRemaining;
  const dedupKey = `threshold:${snapshot.districtId}:${snapshot.facilityId}:${snapshot.resourceId}`;

  // Cooldown check
  const existing = existingAlerts.find(a => a.dedupKey === dedupKey && a.status === 'open');
  if (existing) {
    const ageMs = Date.now() - new Date(existing.createdAt).getTime();
    if (ageMs < rule.cooldownMinutes * 60 * 1000) return null;
  }

  let severity: AlertSeverity | null = null;
  let headline = '';
  let why = '';

  if (qty <= rule.minimumLevel) {
    severity = 'critical';
    headline = `CRITICAL: ${snapshot.resourceName} at ${snapshot.facilityId} is below minimum threshold`;
    why = `Current quantity ${qty} ${snapshot.unit} is at or below minimum level of ${rule.minimumLevel} ${snapshot.unit}.`;
  } else if (qty <= rule.reorderLevel) {
    severity = 'warning';
    headline = `LOW STOCK: ${snapshot.resourceName} needs replenishment at ${snapshot.facilityId}`;
    why = `Current quantity ${qty} ${snapshot.unit} is at or below reorder level of ${rule.reorderLevel} ${snapshot.unit}.`;
  } else if (daysOfCover < rule.daysOfCoverMin) {
    severity = rule.daysOfCoverMin - daysOfCover > 3 ? 'critical' : 'warning';
    headline = `SHORT HORIZON: ${snapshot.resourceName} at ${snapshot.facilityId} has only ${daysOfCover.toFixed(1)} days cover`;
    why = `At current consumption rate of ${snapshot.dailyUsageEst} ${snapshot.unit}/day, stock will last ${daysOfCover.toFixed(1)} days — below the minimum ${rule.daysOfCoverMin}-day buffer.`;
  }

  if (!severity) return null;

  return {
    id: `ALT-THR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 7)}`,
    districtId: snapshot.districtId,
    facilityId: snapshot.facilityId,
    facilityName: null,
    type: 'threshold',
    severity,
    resourceId: snapshot.resourceId,
    headline,
    summaryText: `${snapshot.resourceName}: ${qty} ${snapshot.unit} remaining (${daysOfCover.toFixed(1)} days cover)`,
    whyFlagged: why,
    suggestedAction: severity === 'critical'
      ? `Immediately initiate emergency procurement or inter-hospital transfer for ${snapshot.resourceName}.`
      : `Raise a procurement request within 24 hours for ${snapshot.resourceName} to reach target buffer of ${rule.targetBuffer} ${snapshot.unit}.`,
    status: 'open',
    createdAt: new Date().toISOString(),
    dedupKey
  };
}

/**
 * Evaluates bed occupancy for a ward and returns an alert if > 85% occupied.
 */
export function evaluateBedThreshold(
  snapshot: BedSnapshot,
  facility: CommandFacility | null,
  existingAlerts: CommandAlert[]
): CommandAlert | null {
  const isIcu = snapshot.wardType === 'icu';
  const criticalThreshold = isIcu ? 80 : 90; // ICU: 80%, General: 90%
  const warnThreshold = isIcu ? 65 : 80;
  const dedupKey = `bed:${snapshot.districtId}:${snapshot.facilityId}:${snapshot.wardType}`;

  const existing = existingAlerts.find(a => a.dedupKey === dedupKey && a.status === 'open');
  if (existing) {
    const ageMs = Date.now() - new Date(existing.createdAt).getTime();
    if (ageMs < 60 * 60 * 1000) return null; // 1-hour cooldown for bed alerts
  }

  if (snapshot.occupancyRatePct < warnThreshold) return null;

  const severity: AlertSeverity = snapshot.occupancyRatePct >= criticalThreshold ? 'critical' : 'warning';
  const wardLabel = snapshot.wardType.replace('_', ' ').toUpperCase();

  return {
    id: `ALT-BED-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 7)}`,
    districtId: snapshot.districtId,
    facilityId: snapshot.facilityId,
    facilityName: facility?.name || null,
    type: 'threshold',
    severity,
    headline: `${severity === 'critical' ? 'CRITICAL' : 'HIGH'} Bed Occupancy: ${wardLabel} ward at ${facility?.name || snapshot.facilityId}`,
    summaryText: `${snapshot.wardType} ward: ${snapshot.occupied}/${snapshot.totalCapacity} occupied (${snapshot.occupancyRatePct.toFixed(0)}%)`,
    whyFlagged: `${wardLabel} bed occupancy is ${snapshot.occupancyRatePct.toFixed(0)}%, exceeding the ${severity === 'critical' ? criticalThreshold : warnThreshold}% threshold with only ${snapshot.free} free beds.`,
    suggestedAction: snapshot.free === 0
      ? 'IMMEDIATE DIVERSION: Stop accepting new admissions and activate patient transfer protocol.'
      : `Consider patient load-balancing. ${snapshot.free} beds remain. Monitor closely and prepare transfer capacity.`,
    status: 'open',
    createdAt: new Date().toISOString(),
    dedupKey
  };
}

// ─── Engine 2: Shortage Forecast Engine ──────────────────────────────────────

/** Weighted Moving Average decay coefficients */
const WMA_WEIGHTS_7D = [0.28, 0.22, 0.17, 0.13, 0.09, 0.07, 0.04]; // newest first, sums to 1.0

/**
 * Projects stock-out date using Weighted Moving Average (fallback when history < 21 days).
 */
function forecastByWMA(history: number[], currentQty: number): {
  dailyUseEst: number;
  forecastPoints: StockoutForecast['forecastPoints'];
  stockoutDay: number | null;
} {
  const n = Math.min(7, history.length);
  if (n === 0) {
    return { dailyUseEst: 0, forecastPoints: [], stockoutDay: null };
  }

  const recent = history.slice(-n);
  const weights = WMA_WEIGHTS_7D.slice(0, n).reverse(); // oldest first
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  const dailyUseEst = recent.reduce((sum, val, i) => sum + val * (weights[i] / totalWeight), 0);

  if (dailyUseEst <= 0) return { dailyUseEst: 0, forecastPoints: [], stockoutDay: null };

  const forecastPoints: StockoutForecast['forecastPoints'] = [];
  const variance = recent.reduce((s, v) => s + Math.pow(v - dailyUseEst, 2), 0) / n;
  const std = Math.sqrt(variance);
  let stockoutDay: number | null = null;

  for (let h = 1; h <= 14; h++) {
    const date = new Date(Date.now() + h * 86400000).toISOString().split('T')[0];
    const predicted = Math.max(0, currentQty - dailyUseEst * h);
    const margin = 1.645 * std * Math.sqrt(h);
    const lower90 = Math.max(0, predicted - margin);

    forecastPoints.push({
      date,
      predicted: +predicted.toFixed(2),
      lower90: +lower90.toFixed(2),
      upper90: +(predicted + margin).toFixed(2)
    });

    if (stockoutDay === null && lower90 <= 0) {
      stockoutDay = h;
    }
  }

  return { dailyUseEst, forecastPoints, stockoutDay };
}

/**
 * Runs the full shortage forecast engine for a given stock history.
 */
export function runStockoutForecast(
  facilityId: string,
  resourceId: string,
  resourceName: string,
  currentQuantity: number,
  dailyUsageHistory: number[], // daily consumption over past N days, ordered oldest→newest
  unit: string
): StockoutForecast {
  const { dailyUseEst, forecastPoints, stockoutDay } = forecastByWMA(dailyUsageHistory, currentQuantity);

  const stockoutDate = stockoutDay !== null
    ? new Date(Date.now() + stockoutDay * 86400000).toISOString().split('T')[0]
    : null;

  const isCritical = stockoutDay !== null && stockoutDay <= 7;

  return {
    facilityId,
    resourceId,
    resourceName,
    currentQuantity,
    dailyUsageEst: +dailyUseEst.toFixed(2),
    projectedStockoutDate: stockoutDate,
    daysUntilStockout: stockoutDay,
    forecastPoints,
    confidence: Math.min(0.95, 0.5 + dailyUsageHistory.length / 100),
    method: 'wma',
    isCritical
  };
}

// ─── Engine 3: Epidemic Early Warning (EARS / CUSUM) ─────────────────────────

/**
 * Calculates EARS C1 z-score using 7-day trailing baseline.
 */
export function earsC1(history7d: number[], todayCount: number): { z: number; triggered: boolean } {
  if (history7d.length === 0) return { z: 0, triggered: false };
  const mean = history7d.reduce((s, v) => s + v, 0) / history7d.length;
  const std = Math.sqrt(history7d.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / history7d.length) || 1;
  const z = (todayCount - mean) / std;
  return { z: +z.toFixed(3), triggered: z > 3.0 };
}

/**
 * Calculates EARS C2: uses 7-day baseline with 2-day buffer gap.
 */
export function earsC2(historyBase: number[], todayCount: number): { z: number; triggered: boolean } {
  if (historyBase.length < 7) return earsC1(historyBase, todayCount);
  const baseline = historyBase.slice(-9, -2); // days t-9 to t-3
  return earsC1(baseline, todayCount);
}

/**
 * CUSUM: Cumulative sum for detecting slow-rising transmission.
 * Accumulates positive deviations above k (reference value).
 */
export function cusumCheck(history: number[], todayCount: number, k: number = 1.5): {
  S: number;
  exceeded: boolean;
  threshold: number;
} {
  const h = 5; // CUSUM alert threshold (standard epidemiological value)
  let S = 0;
  const fullHistory = [...history, todayCount];
  const mean = history.reduce((s, v) => s + v, 0) / (history.length || 1);

  for (const val of fullHistory) {
    S = Math.max(0, S + (val - mean - k));
  }

  return { S: +S.toFixed(3), exceeded: S >= h, threshold: h };
}

/**
 * Haversine distance between two lat/lng points in kilometers.
 */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * DBSCAN-style spatial clustering: groups facilities with simultaneous anomalies within epsilon km.
 */
export function spatialCluster(
  anomalousFacilities: Array<{ id: string; lat: number; lng: number }>,
  epsilon: number = 15, // km
  minPts: number = 2
): string[][] {
  if (anomalousFacilities.length < minPts) return [];

  const clusters: string[][] = [];
  const visited = new Set<string>();

  for (const facility of anomalousFacilities) {
    if (visited.has(facility.id)) continue;
    visited.add(facility.id);

    const neighbors = anomalousFacilities.filter(
      other => other.id !== facility.id && haversineKm(facility.lat, facility.lng, other.lat, other.lng) <= epsilon
    );

    if (neighbors.length + 1 >= minPts) {
      const cluster = [facility.id, ...neighbors.map(n => n.id)];
      clusters.push([...new Set(cluster)]);
      neighbors.forEach(n => visited.add(n.id));
    }
  }

  return clusters;
}

/**
 * Runs the full Epidemic Early Warning Engine for one symptom cluster in a district.
 * Returns analysis results. Gemini situational brief is generated by the use-case layer.
 */
export function runEarlyWarningAnalysis(
  districtId: string,
  cluster: SymptomCluster,
  dailyCounts: SyndromicCount[], // sorted oldest→newest
  facilitiesWithAnomalies: Array<{ id: string; name: string; lat: number; lng: number; count: number }>
): Omit<EarlyWarningResult, 'situationalBrief' | 'recommendedActions'> {
  const today = dailyCounts[dailyCounts.length - 1];
  const todayCount = today?.caseCount || 0;
  const history7d = dailyCounts.slice(-8, -1).map(d => d.caseCount);
  const historyFull = dailyCounts.slice(0, -1).map(d => d.caseCount);

  const c1 = earsC1(history7d, todayCount);
  const c2 = earsC2(historyFull, todayCount);
  const cusum = cusumCheck(historyFull, todayCount);

  const mean = history7d.reduce((s, v) => s + v, 0) / (history7d.length || 1);
  const std = Math.sqrt(history7d.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (history7d.length || 1));

  const spatialClusters = spatialCluster(facilitiesWithAnomalies);
  const clusterFacilityIds = spatialClusters.flat();

  let overallSeverity: AlertSeverity = 'info';
  if (c2.triggered || cusum.exceeded) overallSeverity = 'warning';
  if (c1.triggered && (cusum.exceeded || spatialClusters.length > 0)) overallSeverity = 'critical';

  return {
    districtId,
    symptomCluster: cluster,
    analysisDate: new Date().toISOString().split('T')[0],
    baselineMean: +mean.toFixed(2),
    baselineStd: +std.toFixed(2),
    currentCount: todayCount,
    zScore: c1.z,
    c1Triggered: c1.triggered,
    c2Triggered: c2.triggered,
    c3Triggered: cusum.exceeded,
    cusumValue: cusum.S,
    cusumThresholdExceeded: cusum.exceeded,
    spatialClusterFacilities: clusterFacilityIds,
    overallSeverity
  };
}

// ─── Engine 4: Transfer Recommender ──────────────────────────────────────────

/**
 * Finds optimal donor facilities for a shortage situation.
 */
export function recommendTransferDonors(
  shortageFacility: CommandFacility,
  resourceId: string,
  quantityNeeded: number,
  allFacilities: CommandFacility[],
  stockSnapshots: StockSnapshot[],
  thresholdRules: ThresholdRule[],
  maxRadiusKm: number = 45
): TransferRecommendation[] {
  const latestStocks = new Map<string, StockSnapshot>();
  for (const snap of stockSnapshots) {
    if (snap.resourceId === resourceId) {
      const existing = latestStocks.get(snap.facilityId);
      if (!existing || snap.timestamp > existing.timestamp) {
        latestStocks.set(snap.facilityId, snap);
      }
    }
  }

  const recommendations: TransferRecommendation[] = [];

  for (const candidate of allFacilities) {
    if (candidate.id === shortageFacility.id) continue;

    const distKm = haversineKm(shortageFacility.lat, shortageFacility.lng, candidate.lat, candidate.lng);
    if (distKm > maxRadiusKm) continue;

    const stock = latestStocks.get(candidate.id);
    if (!stock) continue;

    // Find donor's reorder level to ensure they remain above minimum after donating
    const rule =
      thresholdRules.find(r => r.facilityId === candidate.id && r.resourceId === resourceId && r.isActive) ||
      thresholdRules.find(r => r.facilityId === null && r.resourceId === resourceId && r.isActive);

    const safeMinimum = rule ? rule.reorderLevel : stock.dailyUsageEst * 7;
    const surplusAvailable = Math.max(0, stock.currentQuantity - safeMinimum);

    if (surplusAvailable < quantityNeeded * 0.3) continue; // Skip if can't supply at least 30%

    // Composite scoring: maximize surplus and proximity, penalize travel
    const travelTimeMin = (distKm / 40) * 60; // assuming ~40 km/h road speed
    const score = surplusAvailable * 2.0 - distKm * 0.8 - travelTimeMin * 0.3;

    recommendations.push({
      fromFacilityId: candidate.id,
      fromFacilityName: candidate.name,
      surplusAvailable: +surplusAvailable.toFixed(1),
      distanceKm: +distKm.toFixed(1),
      estimatedTravelMinutes: Math.round(travelTimeMin),
      score: +score.toFixed(2),
      remainingAfterTransfer: +(stock.currentQuantity - Math.min(surplusAvailable, quantityNeeded)).toFixed(1),
      isViable: surplusAvailable >= quantityNeeded
    });
  }

  return recommendations
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

/**
 * Calculates facility stress level from real-time bed/stock data.
 */
export function computeStressLevel(
  icuOccupancyPct: number,
  generalOccupancyPct: number,
  criticalStockItems: number
): 'normal' | 'moderate' | 'critical' {
  if (icuOccupancyPct >= 85 || generalOccupancyPct >= 90 || criticalStockItems >= 2) return 'critical';
  if (icuOccupancyPct >= 65 || generalOccupancyPct >= 75 || criticalStockItems >= 1) return 'moderate';
  return 'normal';
}
