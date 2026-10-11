import type { TriageInput, TriageAssessment, UrgencyLevel } from '../models/triage.model.ts';

function parseBloodPressure(bp?: string): { systolic: number; diastolic: number } | null {
  if (!bp) return null;
  const match = bp.match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
  if (!match) return null;
  return {
    systolic: Number(match[1]),
    diastolic: Number(match[2])
  };
}

export function evaluateTriage(input: TriageInput): TriageAssessment {
  const flagsDetected: string[] = [];
  const combinedText = [
    input.primarySymptoms || '',
    input.additionalNotes || '',
    ...(input.medicalHistory ?? [])
  ]
    .join(' ')
    .toLowerCase();

  // 1. Evaluate Explicit Red Flags
  const redFlags = input.redFlags || {
    facialDroopOrSpeech: false,
    chestPain: false,
    breathingDistress: false,
    unconsciousOrConfusion: false,
    severeBleeding: false
  };
  if (redFlags.facialDroopOrSpeech) {
    flagsDetected.push('Acute Neurological / FAST Signs (Facial droop / slurred speech / limb weakness)');
  }
  if (redFlags.chestPain) {
    flagsDetected.push('Acute Chest Pain / Potential Coronary Syndrome');
  }
  if (redFlags.breathingDistress) {
    flagsDetected.push('Severe Respiratory Distress / Airway Compromise');
  }
  if (redFlags.unconsciousOrConfusion) {
    flagsDetected.push('Altered Mental Status / Loss of Consciousness');
  }
  if (redFlags.severeBleeding) {
    flagsDetected.push('Severe Hemorrhage / Acute Trauma');
  }

  // 2. Evaluate Physiological Vitals Red Flags
  const vitals = input.vitals;
  let vitalsCritical = false;
  let vitalsUrgent = false;

  if (vitals) {
    if (typeof vitals.oxygenSaturation === 'number' && vitals.oxygenSaturation > 0) {
      if (vitals.oxygenSaturation < 90) {
        flagsDetected.push(`Critical Hypoxemia (SpO2 ${vitals.oxygenSaturation}% < 90%)`);
        vitalsCritical = true;
      } else if (vitals.oxygenSaturation <= 93) {
        vitalsUrgent = true;
      }
    }

    const bp = parseBloodPressure(vitals.bloodPressure);
    if (bp) {
      if (bp.systolic >= 180 || bp.diastolic >= 120) {
        flagsDetected.push(`Hypertensive Crisis (BP ${bp.systolic}/${bp.diastolic} mmHg)`);
        vitalsCritical = true;
      } else if (bp.systolic > 0 && bp.systolic < 90) {
        flagsDetected.push(`Hypotensive Shock Risk (Systolic BP ${bp.systolic} mmHg)`);
        vitalsCritical = true;
      } else if (bp.systolic >= 150 || bp.diastolic >= 95) {
        vitalsUrgent = true;
      }
    }

    if (typeof vitals.heartRate === 'number' && vitals.heartRate > 0) {
      if (vitals.heartRate >= 130 || vitals.heartRate <= 45) {
        flagsDetected.push(`Critical Hemodynamic Heart Rate (${vitals.heartRate} bpm)`);
        vitalsCritical = true;
      } else if (vitals.heartRate >= 110) {
        vitalsUrgent = true;
      }
    }

    if (typeof vitals.temperatureC === 'number' && vitals.temperatureC > 0) {
      if (vitals.temperatureC >= 39.8 || (vitals.temperatureC >= 38.5 && input.age > 0 && input.age <= 2)) {
        flagsDetected.push(`Critical Hyperpyrexia / High-Risk Fever (${vitals.temperatureC}°C)`);
        vitalsCritical = true;
      } else if (vitals.temperatureC >= 38.5) {
        vitalsUrgent = true;
      }
    }
  }

  // 3. Rule-Based Symptom & Specialty Detection (14+ Specialties)
  const isStrokeOrNeuro =
    flagsDetected.some((f) => f.includes('Neurological')) ||
    combinedText.includes('facial droop') ||
    combinedText.includes('slurred speech') ||
    combinedText.includes('paralysis') ||
    combinedText.includes('weakness in left') ||
    combinedText.includes('weakness in right') ||
    combinedText.includes('stroke') ||
    combinedText.includes('seizure') ||
    combinedText.includes('convulsion') ||
    combinedText.includes('numbness');

  const isCardiac =
    flagsDetected.some((f) => f.includes('Chest Pain') || f.includes('Hypertensive Crisis') || f.includes('Heart Rate')) ||
    combinedText.includes('chest pain') ||
    combinedText.includes('pressure radiating') ||
    combinedText.includes('heart attack') ||
    combinedText.includes('palpitation') ||
    combinedText.includes('angina') ||
    combinedText.includes('cardiac');

  const isRespiratory =
    flagsDetected.some((f) => f.includes('Respiratory') || f.includes('Hypoxemia')) ||
    combinedText.includes('cannot breathe') ||
    combinedText.includes('shortness of breath') ||
    combinedText.includes('gasping') ||
    combinedText.includes('wheezing') ||
    combinedText.includes('asthma') ||
    combinedText.includes('pneumonia') ||
    combinedText.includes('copd');

  const isObstetric =
    combinedText.includes('pregnan') ||
    combinedText.includes('labor pain') ||
    combinedText.includes('maternal') ||
    combinedText.includes('eclampsia') ||
    combinedText.includes('vaginal bleeding') ||
    combinedText.includes('fetal') ||
    combinedText.includes('gynecol');

  const isOrthopedicTrauma =
    combinedText.includes('fracture') ||
    combinedText.includes('broken bone') ||
    combinedText.includes('dislocat') ||
    combinedText.includes('road accident') ||
    combinedText.includes('joint pain') ||
    combinedText.includes('knee pain') ||
    combinedText.includes('back pain') ||
    combinedText.includes('sprain');

  const isGastro =
    combinedText.includes('vomiting blood') ||
    combinedText.includes('hematemesis') ||
    combinedText.includes('appendic') ||
    combinedText.includes('abdominal pain') ||
    combinedText.includes('stomach pain') ||
    combinedText.includes('jaundice') ||
    combinedText.includes('diarrhea') ||
    combinedText.includes('dehydration');

  const isRenal =
    combinedText.includes('kidney') ||
    combinedText.includes('renal') ||
    combinedText.includes('dialysis') ||
    combinedText.includes('blood in urine') ||
    combinedText.includes('urinary');

  const isOphthalmic =
    combinedText.includes('vision loss') ||
    combinedText.includes('eye injury') ||
    combinedText.includes('blurred vision') ||
    combinedText.includes('glaucoma') ||
    combinedText.includes('cataract');

  const isEnt =
    combinedText.includes('ear pain') ||
    combinedText.includes('nosebleed') ||
    combinedText.includes('epistaxis') ||
    combinedText.includes('tonsil') ||
    combinedText.includes('throat') ||
    combinedText.includes('sinus');

  const isDermatologyBurn =
    combinedText.includes('burn') ||
    combinedText.includes('cellulitis') ||
    combinedText.includes('skin rash') ||
    combinedText.includes('blister');

  const isPsychiatric =
    combinedText.includes('suicid') ||
    combinedText.includes('self-harm') ||
    combinedText.includes('psychosis') ||
    combinedText.includes('panic attack');

  const isPediatric = input.age > 0 && input.age <= 12 && !isOrthopedicTrauma && !isObstetric;

  const isAcuteEmergencyKeyword =
    combinedText.includes('snakebite') ||
    combinedText.includes('poison') ||
    combinedText.includes('unconscious') ||
    combinedText.includes('vomiting blood') ||
    combinedText.includes('eclampsia') ||
    combinedText.includes('seizure');

  let urgency: UrgencyLevel = 'NON_URGENT';
  let requiredSpecialty = 'General Medicine';
  let conditionCategory = 'Non-Emergency Health Concern';
  let clinicalRoutingAdvice =
    'Symptoms appear stable for routine evaluation. Schedule a consultation at a nearby Community Health Centre or Primary Health Clinic.';
  let emergencyRequired = false;

  // Determine specialized department
  if (isStrokeOrNeuro) {
    requiredSpecialty = 'Neurology';
  } else if (isCardiac) {
    requiredSpecialty = 'Cardiology';
  } else if (isRespiratory) {
    requiredSpecialty = 'Pulmonology / Critical Care';
  } else if (isObstetric) {
    requiredSpecialty = 'Obstetrics & Gynecology';
  } else if (isOrthopedicTrauma) {
    requiredSpecialty = 'Orthopedics & Trauma';
  } else if (isGastro) {
    requiredSpecialty = 'Gastroenterology';
  } else if (isRenal) {
    requiredSpecialty = 'Nephrology';
  } else if (isOphthalmic) {
    requiredSpecialty = 'Ophthalmology';
  } else if (isEnt) {
    requiredSpecialty = 'ENT (Otolaryngology)';
  } else if (isDermatologyBurn) {
    requiredSpecialty = 'Dermatology & Burn Care';
  } else if (isPsychiatric) {
    requiredSpecialty = 'Psychiatry';
  } else if (isPediatric) {
    requiredSpecialty = 'Pediatrics';
  }

  const isCriticalTrigger =
    flagsDetected.length > 0 ||
    vitalsCritical ||
    input.severity === 'severe' ||
    isStrokeOrNeuro ||
    isCardiac ||
    isRespiratory ||
    isAcuteEmergencyKeyword;

  if (isCriticalTrigger) {
    urgency = 'CRITICAL';
    emergencyRequired = true;

    if (isStrokeOrNeuro) {
      requiredSpecialty = 'Neurology';
      conditionCategory = 'Suspected Acute Neurological Emergency';
      clinicalRoutingAdvice =
        'Symptoms indicate a possible acute neurological emergency requiring immediate medical evaluation. Do not give oral food or fluids; keep patient in a safe seated/reclined position and transport immediately to a facility with 24x7 emergency neurology and CT imaging.';
    } else if (isCardiac) {
      requiredSpecialty = 'Cardiology';
      conditionCategory = 'Suspected Acute Cardiovascular Emergency';
      clinicalRoutingAdvice =
        'Symptoms indicate a possible acute cardiovascular emergency requiring immediate medical evaluation. Minimize physical exertion and transport immediately to a facility equipped with 24x7 cardiac emergency & ICU services.';
    } else if (isRespiratory) {
      requiredSpecialty = 'Pulmonology / Critical Care';
      conditionCategory = 'Acute Respiratory Compromise';
      clinicalRoutingAdvice =
        'Symptoms indicate acute respiratory compromise requiring immediate supplemental oxygen and emergency airway stabilization.';
    } else if (isObstetric) {
      requiredSpecialty = 'Obstetrics & Gynecology';
      conditionCategory = 'High-Risk Maternal / Obstetric Emergency';
      clinicalRoutingAdvice =
        'Presentation indicates an acute maternal/obstetric emergency. Transport immediately in left lateral position to a Comprehensive Emergency Obstetric & Newborn Care (CEmONC) hospital.';
    } else if (isOrthopedicTrauma) {
      requiredSpecialty = 'Orthopedics & Trauma';
      conditionCategory = 'Acute Trauma / Orthopedic Emergency';
      clinicalRoutingAdvice =
        'Immobilize the affected limb or spine, control any external bleeding with direct pressure, and transport to a 24x7 Trauma & Orthopedic emergency center.';
    } else if (isPediatric) {
      requiredSpecialty = 'Pediatrics';
      conditionCategory = 'Acute Pediatric Emergency';
      clinicalRoutingAdvice =
        'Pediatric high-acuity presentation requiring immediate evaluation at a hospital equipped with 24x7 Pediatric Emergency and PICU/NICU support.';
    } else {
      if (requiredSpecialty === 'General Medicine') {
        requiredSpecialty = 'Emergency Medicine';
      }
      conditionCategory = `Acute ${requiredSpecialty} Emergency`;
      clinicalRoutingAdvice =
        `Severe acute presentation requiring immediate 24x7 Emergency Department evaluation, resuscitation, and ${requiredSpecialty} specialist stabilization.`;
    }
  } else if (input.severity === 'moderate' || vitalsUrgent) {
    urgency = 'URGENT';
    emergencyRequired = false;
    conditionCategory = `Moderate ${requiredSpecialty} Condition`;
    clinicalRoutingAdvice =
      `Symptoms require same-day ${requiredSpecialty} outpatient medical evaluation to prevent acute escalation. Visit an Outpatient Department (OPD) or District Hospital Clinic today.`;
  } else {
    urgency = 'NON_URGENT';
    emergencyRequired = false;
    conditionCategory = `Routine ${requiredSpecialty} Consultation`;
    clinicalRoutingAdvice =
      `Symptoms appear stable for scheduled ${requiredSpecialty} evaluation. Book an Outpatient Department (OPD) slot or teleconsultation at a nearby health facility.`;
  }

  // Targeted queries for Agent 2 Search MCP — dynamically tailored to requiredSpecialty and emergencyRequired
  const specialtyQueryTerm = requiredSpecialty.toLowerCase();
  const searchQueries: string[] = emergencyRequired
    ? [
        `"${specialtyQueryTerm}" 24x7 emergency hospital within 50 km of ${input.location}`,
        `best multi specialty hospital emergency ICU "${specialtyQueryTerm}" near ${input.location}`,
        `government medical college hospital emergency trauma centre ${input.location}`,
        `hospital 24x7 emergency "${specialtyQueryTerm}" department ${input.location}`
      ]
    : [
        `"${specialtyQueryTerm}" outpatient OPD hospital clinic near ${input.location}`,
        `district hospital community health centre "${specialtyQueryTerm}" ${input.location}`,
        `multi specialty hospital "${specialtyQueryTerm}" consultation ${input.location}`,
        `verified hospital "${specialtyQueryTerm}" department ${input.location}`
      ];

  return {
    urgency,
    acuityBadge: urgency === 'CRITICAL' ? '🔴 CRITICAL' : urgency === 'URGENT' ? '🟡 URGENT' : '🟢 NON-URGENT',
    requiredSpecialty,
    conditionCategory,
    clinicalRoutingAdvice,
    emergencyRequired,
    redFlagsDetected: flagsDetected,
    searchQueries
  };
}
