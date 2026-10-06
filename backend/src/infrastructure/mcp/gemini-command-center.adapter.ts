/**
 * Feature Map 09 — District Admin Command Center
 * Gemini AI Integration Adapter
 * Generates plain-language clinical outbreak situational briefings and
 * supply-chain shortage mitigation plans with full offline deterministic fallback.
 */

import type { EarlyWarningResult, StockoutForecast, TransferRecommendation } from '../../domain/models/command-center.model.ts';

export class GeminiCommandCenterAdapter {
  private readonly apiKey: string;
  private readonly modelName: string;

  constructor(apiKey?: string, modelName?: string) {
    this.apiKey = apiKey || process.env.GEMINI_API_KEY || '';
    this.modelName = modelName || process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash';
  }

  /**
   * Generates an executive situational brief for an infectious disease outbreak signal.
   */
  async generateOutbreakBrief(
    analysis: Omit<EarlyWarningResult, 'situationalBrief' | 'recommendedActions'>,
    districtName: string,
    stateName: string,
    facilityNames: string[]
  ): Promise<{ situationalBrief: string; recommendedActions: string[] }> {
    const clusterLabel = analysis.symptomCluster.replace(/_/g, ' ').toUpperCase();
    const facilityListStr = facilityNames.length > 0 ? facilityNames.join(', ') : 'multiple reporting PHCs';

    // Offline / API key missing fallback
    if (!this.apiKey) {
      return this.deterministicOutbreakBrief(analysis, clusterLabel, districtName, facilityNames);
    }

    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`;
      const prompt = `You are the Chief Epidemiological Officer AI assisting the District Health Officer in ${districtName}, ${stateName}, India.
An automated early aberration alert has been triggered:
- Symptom Cluster: ${clusterLabel}
- Today's Reported Cases: ${analysis.currentCount}
- 7-Day Baseline Mean: ${analysis.baselineMean} (Std: ${analysis.baselineStd})
- CDC EARS Z-Score: ${analysis.zScore} (${analysis.c1Triggered ? 'C1 Anomaly' : ''} ${analysis.c2Triggered ? 'C2 Anomaly (Lagged)' : ''})
- CUSUM Transmission Creep: ${analysis.cusumThresholdExceeded ? 'Exceeded Alert Threshold' : 'Stable'}
- Geographic Cluster Facilities: ${facilityListStr}
- Severity: ${analysis.overallSeverity.toUpperCase()}

Provide a concise, mission-critical response in valid JSON with this exact schema:
{
  "situationalBrief": "3 to 4 concise sentences summarizing the transmission velocity, statistical aberration, and geographic containment risk.",
  "recommendedActions": [
    "Action 1 (Immediate field response e.g. vector control, water testing, ASHA house-to-house)",
    "Action 2 (Supply chain & clinical prep e.g. IV fluids, paracetamol, rapid diagnostic kits)",
    "Action 3 (Administrative escalation e.g. IDSP state surveillance notification, isolation ward standby)"
  ]
}`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
        })
      });

      if (!res.ok) {
        console.warn('Gemini outbreak brief failed with status:', res.status);
        return this.deterministicOutbreakBrief(analysis, clusterLabel, districtName, facilityNames);
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      const parsed = JSON.parse(text || '{}');

      return {
        situationalBrief: parsed.situationalBrief || `Statistical anomaly detected for ${clusterLabel} in ${districtName}.`,
        recommendedActions: Array.isArray(parsed.recommendedActions) && parsed.recommendedActions.length > 0
          ? parsed.recommendedActions
          : ['Mobilize rapid response team', 'Audit medical supplies in affected PHCs', 'Alert District CMO']
      };
    } catch (err) {
      console.warn('Error invoking Gemini for outbreak brief:', err);
      return this.deterministicOutbreakBrief(analysis, clusterLabel, districtName, facilityNames);
    }
  }

  /**
   * Generates an actionable shortage mitigation narrative for an impending stock-out.
   */
  async generateShortageMitigationNarrative(
    forecast: StockoutForecast,
    facilityName: string,
    donors: TransferRecommendation[]
  ): Promise<string> {
    if (!this.apiKey || donors.length === 0) {
      return this.deterministicShortageNarrative(forecast, facilityName, donors);
    }

    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`;
      const bestDonor = donors[0];
      const prompt = `You are a healthcare supply chain intelligence advisor for MedVeda in India.
A forecasted shortage is flagged:
- Resource: ${forecast.resourceName}
- Facility: ${facilityName}
- Current Stock: ${forecast.currentQuantity} units
- Daily Consumption: ${forecast.dailyUsageEst} units/day
- Projected Stockout Date: ${forecast.projectedStockoutDate || 'Within 7 days'} (${forecast.daysUntilStockout} days remaining)
- Best Inter-Hospital Transfer Donor: ${bestDonor.fromFacilityName} (Surplus: ${bestDonor.surplusAvailable} units, Distance: ${bestDonor.distanceKm} km, Transit: ${bestDonor.estimatedTravelMinutes} mins)

Write a 2-sentence executive action briefing recommending an emergency transfer or procurement order.`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2 }
        })
      });

      if (!res.ok) {
        return this.deterministicShortageNarrative(forecast, facilityName, donors);
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      return text?.trim() || this.deterministicShortageNarrative(forecast, facilityName, donors);
    } catch (err) {
      return this.deterministicShortageNarrative(forecast, facilityName, donors);
    }
  }

  private deterministicOutbreakBrief(
    analysis: Omit<EarlyWarningResult, 'situationalBrief' | 'recommendedActions'>,
    clusterLabel: string,
    districtName: string,
    facilityNames: string[]
  ): { situationalBrief: string; recommendedActions: string[] } {
    const mult = (analysis.currentCount / Math.max(1, analysis.baselineMean)).toFixed(1);
    const facStr = facilityNames.length > 0 ? facilityNames.slice(0, 3).join(', ') : 'cluster facilities';
    const brief = `Surveillance anomaly detected for ${clusterLabel} in ${districtName}. Daily incidence reached ${analysis.currentCount} cases (${mult}x over 7-day baseline mean of ${analysis.baselineMean}, Z-score: ${analysis.zScore}). Spatial clustering confirmed across ${facStr}, indicating localized transmission that warrants active containment.`;

    const actions = [
      `Deploy Block Epidemiologist and vector/sanitation team to ${facStr} within 12 hours.`,
      `Verify local buffer stocks of essential supportive therapeutics and rapid diagnostic kits.`,
      `Notify Integrated Disease Surveillance Programme (IDSP) District Surveillance Unit and initiate daily syndromic tracking.`
    ];

    return { situationalBrief: brief, recommendedActions: actions };
  }

  private deterministicShortageNarrative(
    forecast: StockoutForecast,
    facilityName: string,
    donors: TransferRecommendation[]
  ): string {
    if (donors.length > 0) {
      const top = donors[0];
      return `${facilityName} will exhaust ${forecast.resourceName} in ~${forecast.daysUntilStockout} days at current usage (${forecast.dailyUsageEst}/day). Immediate inter-hospital transfer of ${Math.min(top.surplusAvailable, 20)} units from ${top.fromFacilityName} (${top.distanceKm} km, ~${top.estimatedTravelMinutes} mins) is strongly recommended to restore buffer.`;
    }
    return `${facilityName} is projected to face complete stock-out of ${forecast.resourceName} in ~${forecast.daysUntilStockout} days. Urgent emergency procurement dispatch must be initiated immediately.`;
  }
}
