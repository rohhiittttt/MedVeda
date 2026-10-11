import type { RankedFacility, RecommendationRequest, RecommendationResponse } from '../models/recommendation.model.ts';

export function rankFacilities(request: RecommendationRequest): RecommendationResponse {
  const { urgency, requiredSpecialty, emergencyRequired, location, facilities } = request;

  // Identify the closest OPD-only facility (if any) to explain why a farther 24x7 Emergency facility ranks above it
  const closestOpdOnly = [...facilities]
    .filter((f) => f.specialtyMode === 'OPD_ONLY')
    .sort((a, b) => a.distanceKm - b.distanceKm)[0];

  const scored: RankedFacility[] = facilities.map((fac) => {
    // 1. Clinical Suitability Scoring (0 - 100)
    let clinicalScore = 50;

    // Specialty matching
    if (fac.hasRequiredSpecialty) {
      clinicalScore += 20;
    }

    // OPD vs. Emergency Verification Invariant
    if (emergencyRequired) {
      if (fac.specialtyMode === 'EMERGENCY_AND_OPD' && fac.emergencySpecialtyVerified) {
        clinicalScore += 30; // Maximum clinical suitability bonus
      } else if (fac.specialtyMode === 'OPD_ONLY') {
        // Severe clinical penalty for critical emergency cases!
        clinicalScore -= 40;
      }
    } else {
      if (fac.hasRequiredSpecialty) {
        clinicalScore += 20;
      }
    }

    // Source trust bonus
    if (fac.verificationStatus === 'verified') {
      clinicalScore += 10;
    } else if (fac.verificationStatus === 'unverified') {
      clinicalScore -= 10;
    }

    // 2. Proximity Scoring (0 - 50, prioritizing <= 50 km radius)
    let distanceScore = 0;
    if (fac.distanceKm <= 15) {
      // Zone 1: Immediate Vicinity (<= 15 km)
      distanceScore = 50 - fac.distanceKm * 0.6;
    } else if (fac.distanceKm <= 50) {
      // Zone 2: Priority Near Region (15 - 50 km)
      distanceScore = 40 - (fac.distanceKm - 15) * 0.4;
    } else if (fac.distanceKm <= 100) {
      // Zone 3: Regional Tertiary (50 - 100 km)
      distanceScore = Math.max(5, 20 - (fac.distanceKm - 50) * 0.3);
    } else {
      // Zone 4: Far Regional (> 100 km)
      distanceScore = Math.max(0, 5 - (fac.distanceKm - 100) * 0.1);
    }

    // Golden Hour Proximity Bonus for verified emergency centers within 50 km
    if (fac.distanceKm <= 50 && fac.specialtyMode === 'EMERGENCY_AND_OPD' && fac.emergencySpecialtyVerified) {
      clinicalScore += 15; // Golden Hour bonus
    }

    // Total Score (Weighted balance ensuring verified <= 50km emergency centers rank #1)
    const totalScore = clinicalScore * 0.6 + distanceScore * 0.4;

    // 3. Dynamic Specialty- & Acuity-Aware Plain-Language Clinical Justification
    let clinicalExplanation = '';
    const closerOpdComparison =
      emergencyRequired &&
      closestOpdOnly &&
      closestOpdOnly.id !== fac.id &&
      closestOpdOnly.distanceKm < fac.distanceKm
        ? ` Prioritized over closer OPD-only ${closestOpdOnly.name} (${closestOpdOnly.distanceKm} km) under the Clinical Suitability > Proximity invariant.`
        : '';

    if (emergencyRequired) {
      if (fac.distanceKm <= 50 && fac.specialtyMode === 'EMERGENCY_AND_OPD' && fac.emergencySpecialtyVerified) {
        clinicalExplanation = `Top priority destination within 50 km (${fac.distanceKm} km). Provides verified 24x7 Emergency ${requiredSpecialty} with active acute intervention, ICU support, and rapid Golden Hour transit.${closerOpdComparison}`;
      } else if (fac.distanceKm > 50 && fac.specialtyMode === 'EMERGENCY_AND_OPD' && fac.emergencySpecialtyVerified) {
        clinicalExplanation = `Tertiary referral center (${fac.distanceKm} km). Provides verified 24x7 Emergency ${requiredSpecialty} with comprehensive super-specialty ${requiredSpecialty} ICU; recommended when closer district facilities lack 24x7 specialist coverage.${closerOpdComparison}`;
      } else if (fac.specialtyMode === 'OPD_ONLY') {
        clinicalExplanation = `Nearest medical stabilization point (${fac.distanceKm} km) for airway support, vitals monitoring, and initial IV resuscitation. Specialized ${requiredSpecialty} is OPD-only on clinic days; transfer to a 24x7 emergency-equipped facility is required for acute admission.`;
      } else {
        clinicalExplanation = `Healthcare facility within ${fac.distanceKm} km; 24x7 emergency ${requiredSpecialty} capability is unverified online. Telephone confirmation is advised prior to patient transfer.`;
      }
    } else {
      // Non-Emergency / Outpatient routing rationale
      if (fac.distanceKm <= 25 && fac.hasRequiredSpecialty) {
        clinicalExplanation = `Recommended nearby ${requiredSpecialty} consultation center (${fac.distanceKm} km). Suitable for ${urgency === 'URGENT' ? 'same-day urgent OPD evaluation' : 'scheduled outpatient consultation'} with ${fac.verificationStatus.replace('_', ' ')} facility credentials.`;
      } else if (fac.specialtyMode === 'EMERGENCY_AND_OPD') {
        clinicalExplanation = `Comprehensive multi-specialty hospital (${fac.distanceKm} km) offering both scheduled ${requiredSpecialty} OPD clinics and 24x7 diagnostic/inpatient backup.`;
      } else {
        clinicalExplanation = `Outpatient ${requiredSpecialty} facility (${fac.distanceKm} km) near ${location}. Confirm OPD registration hours prior to arrival.`;
      }
    }

    return {
      ...fac,
      rank: 0,
      clinicalSuitabilityScore: Math.round(clinicalScore),
      distanceScore: Math.round(distanceScore),
      totalScore: Math.round(totalScore * 10) / 10,
      clinicalExplanation
    };
  });

  // Sort descending by totalScore (Clinical Suitability > Proximity)
  scored.sort((a, b) => b.totalScore - a.totalScore);

  // Assign 1-indexed ranks
  const ranked = scored.map((fac, idx) => ({
    ...fac,
    rank: idx + 1
  }));

  return {
    location,
    requiredSpecialty,
    urgency,
    topFacilities: ranked.slice(0, 5),
    totalEvaluated: facilities.length
  };
}
