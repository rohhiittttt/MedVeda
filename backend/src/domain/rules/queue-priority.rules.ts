import type { QueueEntry, UrgencyTier } from '../models/teleconsult.model.ts';

export interface PriorityCalculationInput {
  readonly urgencyTier: UrgencyTier;
  readonly highRiskFlags?: readonly string[];
  readonly patientAge: number;
  readonly isBookedAppointment: boolean;
  readonly minutesWaiting?: number;
  readonly hasNoShowHistory?: boolean;
}

export function calculateUrgencyWeight(tier: UrgencyTier): number {
  switch (tier) {
    case 'RED':
    case 'CRITICAL':
      return 100;
    case 'ORANGE':
    case 'URGENT':
      return 75;
    case 'YELLOW':
      return 50;
    case 'GREEN':
      return 25;
    case 'ROUTINE':
    default:
      return 10;
  }
}

export function calculateHighRiskWeight(flags: readonly string[] = [], age: number): number {
  let riskScore = 0;
  const lowerFlags = flags.map((f) => f.toLowerCase());

  if (lowerFlags.some((f) => f.includes('pregnan') || f.includes('maternal'))) {
    riskScore += 25;
  }
  if (age <= 2 || lowerFlags.some((f) => f.includes('infant') || f.includes('neonatal'))) {
    riskScore += 25;
  } else if (age >= 65 || lowerFlags.some((f) => f.includes('elderly') || f.includes('geriatric'))) {
    riskScore += 20;
  }

  const chronicCount = lowerFlags.filter((f) =>
    f.includes('hypertens') ||
    f.includes('diabet') ||
    f.includes('heart') ||
    f.includes('cardiac') ||
    f.includes('stroke') ||
    f.includes('kidney') ||
    f.includes('asthma')
  ).length;

  riskScore += Math.min(30, chronicCount * 15);

  return riskScore;
}

export function computePriorityScore(input: PriorityCalculationInput): number {
  const urgencyWeight = calculateUrgencyWeight(input.urgencyTier);
  const riskWeight = calculateHighRiskWeight(input.highRiskFlags, input.patientAge);
  
  // Anti-starvation wait-time accumulation (+2 pts/min, max 40)
  const minutesWaiting = Math.max(0, input.minutesWaiting ?? 0);
  const waitTimePenalty = Math.min(40, Math.floor(minutesWaiting * 2));

  // Punctuality protection bonus for booked appointment arrivals (prevents indefinite walk-in starvation)
  const bookedProtection = input.isBookedAppointment ? 25 : 0;

  // No-show penalty deduction
  const noShowDeduction = input.hasNoShowHistory ? 15 : 0;

  return urgencyWeight + riskWeight + waitTimePenalty + bookedProtection - noShowDeduction;
}

export function sortQueueByPriority(entries: readonly QueueEntry[]): QueueEntry[] {
  const now = Date.now();

  const entriesWithUpdatedScores = entries.map((entry) => {
    const joinedTime = new Date(entry.joinedAt).getTime();
    const minutesWaiting = Math.max(0, (now - joinedTime) / (1000 * 60));

    const updatedScore = computePriorityScore({
      urgencyTier: entry.urgencyTier,
      highRiskFlags: entry.highRiskFlags,
      patientAge: entry.patientAge,
      isBookedAppointment: Boolean(entry.appointmentId),
      minutesWaiting
    });

    return {
      ...entry,
      priorityScore: updatedScore
    };
  });

  return entriesWithUpdatedScores.sort((a, b) => {
    if (b.priorityScore !== a.priorityScore) {
      return b.priorityScore - a.priorityScore;
    }
    return new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
  });
}
