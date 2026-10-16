import { CardItem } from './types';

/**
 * MedVeda Built Feature Cards
 * Matches our live features on the home page as requested:
 * "use our already built cards only"
 */
export const MEDVEDA_FEATURE_CARDS: CardItem[] = [
  {
    id: 'feature1',
    code: 'Module 01',
    title: 'Smart Care Navigator',
    badge: 'Autonomous Triage',
    description: 'Answer a few questions and get routed to the right level of care: self-care, teleconsult, or in-person in seconds.',
    actionLabel: 'Launch Triage',
    image: './card-symptoms.png',
    theme: {
      iconBg: 'bg-rose-50 text-rose-500 border-rose-200',
      hoverText: 'group-hover:text-rose-600',
      accentColor: '#f43f5e',
      gradient: 'from-rose-500/20 via-pink-500/10 to-transparent'
    }
  },
  {
    id: 'feature2',
    code: 'Module 02',
    title: 'Teleconsultation',
    badge: 'Prioritized Telehealth',
    description: 'Secure video visits with licensed clinicians, with notes and prescriptions synced straight to your record.',
    actionLabel: 'Start Teleconsult',
    image: './card-teleconsultation.jpg',
    theme: {
      iconBg: 'bg-sky-50 text-[#1565C0] border-sky-200',
      hoverText: 'group-hover:text-[#1565C0]',
      accentColor: '#0284c7',
      gradient: 'from-sky-500/20 via-blue-500/10 to-transparent'
    }
  },
  {
    id: 'feature3',
    code: 'Module 03',
    title: 'Referral Routing',
    badge: 'Closed-Loop Care',
    description: 'Automatically match patients to the right specialist and facility, with status tracked end to end.',
    actionLabel: 'Open Referrals',
    image: './rims-hospital.jpg',
    theme: {
      iconBg: 'bg-emerald-50 text-emerald-600 border-emerald-200',
      hoverText: 'group-hover:text-emerald-600',
      accentColor: '#10b981',
      gradient: 'from-emerald-500/20 via-teal-500/10 to-transparent'
    }
  },
  {
    id: 'feature4',
    code: 'Module 04',
    title: 'Health Monitoring',
    badge: 'Dynamic Risk Engine',
    description: 'Track vitals and trends from connected devices, with smart alerts when something needs attention.',
    actionLabel: 'Open Follow-Ups',
    image: './cta-beats-banner.png',
    theme: {
      iconBg: 'bg-amber-50 text-amber-600 border-amber-200',
      hoverText: 'group-hover:text-amber-600',
      accentColor: '#f59e0b',
      gradient: 'from-amber-500/20 via-orange-500/10 to-transparent'
    }
  },
  {
    id: 'feature5',
    code: 'Module 05',
    title: 'Unified Health Records',
    badge: 'ABDM Interoperable',
    description: 'Every visit, lab, and prescription in one encrypted timeline you can share with any provider.',
    actionLabel: 'Open Records',
    image: './card-records.png',
    theme: {
      iconBg: 'bg-purple-50 text-purple-600 border-purple-200',
      hoverText: 'group-hover:text-purple-600',
      accentColor: '#8b5cf6',
      gradient: 'from-purple-500/20 via-indigo-500/10 to-transparent'
    }
  },
  {
    id: 'feature6',
    code: 'Module 06',
    title: 'Medicine Search',
    badge: 'Geo Logistics',
    description: 'Look up medicines, dosages, and interactions, then order refills without leaving the app.',
    actionLabel: 'Open Medicine & Lab',
    image: './card-medicines.jpg',
    theme: {
      iconBg: 'bg-cyan-50 text-cyan-600 border-cyan-200',
      hoverText: 'group-hover:text-cyan-600',
      accentColor: '#06b6d4',
      gradient: 'from-cyan-500/20 via-blue-500/10 to-transparent'
    }
  },
  {
    id: 'feature7',
    code: 'Module 07',
    title: 'Facility Operations Dashboard',
    badge: 'Operations Control',
    description: 'Multi-source operations overview: Care Continuity Index, live prioritized queue, bed/ICU resource status meters, and alerts.',
    actionLabel: 'Open Dashboard',
    image: './facility-dashboard-art.png',
    theme: {
      iconBg: 'bg-indigo-50 text-indigo-600 border-indigo-200',
      hoverText: 'group-hover:text-indigo-600',
      accentColor: '#6366f1',
      gradient: 'from-indigo-500/20 via-blue-500/10 to-transparent'
    }
  },
  {
    id: 'feature8',
    code: 'Module 08',
    title: 'AI Govt Health Scheme Finder',
    badge: 'Affordable Care',
    description: 'RAG scheme discovery with deterministic eligibility rules engine, single-document gap filling, and verified benefit matching.',
    actionLabel: 'Find Schemes',
    image: './hero-schemes-art.png',
    theme: {
      iconBg: 'bg-teal-50 text-teal-600 border-teal-200',
      hoverText: 'group-hover:text-teal-600',
      accentColor: '#14b8a6',
      gradient: 'from-teal-500/20 via-emerald-500/10 to-transparent'
    }
  },
  {
    id: 'feature9',
    code: 'Module 09',
    title: 'District Admin Command Center',
    badge: 'Surveillance & Logistics',
    description: 'Pan-India multi-hospital live surveillance, shortage forecasting, epidemic early warning, and inter-hospital transfer coordination.',
    actionLabel: 'Command Center',
    image: './healthcare-impact-banner.jpg',
    theme: {
      iconBg: 'bg-blue-50 text-[#1565C0] border-blue-200',
      hoverText: 'group-hover:text-[#1565C0]',
      accentColor: '#2563eb',
      gradient: 'from-blue-600/20 via-indigo-500/10 to-transparent'
    }
  },
  {
    id: 'feature10',
    code: 'Module 10',
    title: 'MediBot',
    badge: 'Bilingual & Actions',
    description: 'Autonomous voice & action agent: book doctor appointments, find emergency beds, set medicine dosage reminders, and navigate MedVeda.',
    actionLabel: 'Launch AI Agent',
    image: './card-medibot.png',
    theme: {
      iconBg: 'bg-violet-50 text-violet-600 border-violet-200',
      hoverText: 'group-hover:text-violet-600',
      accentColor: '#7c3aed',
      gradient: 'from-violet-500/20 via-purple-500/10 to-transparent'
    }
  }
];

/**
 * Reference Media Items (from the design specification prompt)
 * Easily swappable array of placeholder media.
 */
export const REFERENCE_MEDIA_ITEMS: CardItem[] = [
  {
    id: 'ref-1',
    code: 'Item 01',
    title: 'Tennis Velocity',
    badge: 'Studio 3D',
    description: 'Close-up of pink fuzzy tennis balls on a pink-magenta gradient background.',
    actionLabel: 'Explore Details',
    image: './media/item-01.svg',
    theme: {
      accentColor: '#ec4899',
      gradient: 'from-pink-500/30 to-purple-600/20'
    }
  },
  {
    id: 'ref-2',
    code: 'Item 02',
    title: 'Alpine High-Speed',
    badge: 'Motion Blur',
    description: 'Skier or snowboarder in a black helmet with a red-pink motion-blurred visor, pale icy background.',
    actionLabel: 'Explore Details',
    image: './media/item-02.svg',
    theme: {
      accentColor: '#f43f5e',
      gradient: 'from-rose-500/30 to-sky-600/20'
    }
  },
  {
    id: 'ref-3',
    code: 'Item 03',
    title: 'Digital Specie',
    badge: 'Embossed Coins',
    description: 'Black background with floating, rotating silver embossed coins with chrome reflections.',
    actionLabel: 'Explore Details',
    image: './media/item-03.svg',
    theme: {
      accentColor: '#94a3b8',
      gradient: 'from-slate-700/40 to-slate-900/40'
    }
  },
  {
    id: 'ref-4',
    code: 'Item 04',
    title: 'Azure Shades',
    badge: 'Editorial Portrait',
    description: 'Young woman with wavy dark hair, blue-tinted sunglasses, gold hoop earrings, denim jacket.',
    actionLabel: 'Explore Details',
    image: './media/item-04.svg',
    theme: {
      accentColor: '#0284c7',
      gradient: 'from-sky-500/30 to-blue-700/20'
    }
  },
  {
    id: 'ref-5',
    code: 'Item 05',
    title: 'West Coast Hoodie',
    badge: 'Urban Fashion',
    description: 'Young man in a pink "Los Angeles" cap and grey hoodie on a saturated red background.',
    actionLabel: 'Explore Details',
    image: './media/item-05.svg',
    theme: {
      accentColor: '#dc2626',
      gradient: 'from-red-500/30 to-rose-700/20'
    }
  },
  {
    id: 'ref-6',
    code: 'Item 06',
    title: 'Emerald Helix',
    badge: '3D Render',
    description: 'Glossy green 3D spiral/swirl render with a small floating blue sphere.',
    actionLabel: 'Explore Details',
    image: './media/item-06.svg',
    theme: {
      accentColor: '#10b981',
      gradient: 'from-emerald-500/30 to-teal-700/20'
    }
  },
  {
    id: 'ref-7',
    code: 'Item 07',
    title: 'Crimson Profile',
    badge: 'Dramatic Studio',
    description: 'Dramatic close-up face profile lit in orange-red light with deep contrast.',
    actionLabel: 'Explore Details',
    image: './media/item-07.svg',
    theme: {
      accentColor: '#ea580c',
      gradient: 'from-orange-500/30 to-red-700/20'
    }
  }
];
