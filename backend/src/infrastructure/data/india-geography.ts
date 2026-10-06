/**
 * @fileoverview India Geography Master Data
 *
 * Comprehensive reference data for all Indian states, Union Territories,
 * and their districts. Used across MedVeda for location-based health
 * services, district-level analytics, and geographic routing.
 *
 * Data includes:
 *  - All 28 States + 8 Union Territories
 *  - Representative districts per state/UT (Jharkhand: all 24 districts)
 *  - Approximate geographic centroids (lat/lng)
 *  - Population estimates (Census 2011 base)
 *  - Health tier classification
 *
 * @module india-geography
 */

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/** Represents an Indian State or Union Territory. */
export interface IndiaState {
  /** Unique snake_case identifier (e.g. 'andhra_pradesh'). */
  id: string;
  /** Official name. */
  name: string;
  /** State/UT capital city. */
  capital: string;
  /** Broad geographic region of India. */
  region: 'North' | 'South' | 'East' | 'West' | 'Central' | 'Northeast';
}

/**
 * Health service tier classification for a district.
 * - metro      : Major metropolitan areas with tertiary hospitals.
 * - urban      : District HQ towns with secondary care facilities.
 * - semi_urban : Towns with primary + some secondary care.
 * - rural      : Predominantly rural with PHC/CHC coverage.
 * - tribal     : Predominantly tribal belt; remote healthcare access.
 */
export type HealthTier = 'metro' | 'urban' | 'semi_urban' | 'rural' | 'tribal';

/** Represents an Indian district with geographic and health metadata. */
export interface IndiaDistrict {
  /** Unique identifier (e.g. 'dist_jhk_ranchi'). */
  id: string;
  /** Parent state/UT id matching {@link IndiaState.id}. */
  stateId: string;
  /** Official district name. */
  name: string;
  /** Approximate centroid latitude. */
  lat: number;
  /** Approximate centroid longitude. */
  lng: number;
  /** Approximate population (Census 2011 base). */
  population: number;
  /** Health infrastructure tier. */
  healthTier: HealthTier;
}

// ---------------------------------------------------------------------------
// States & Union Territories
// ---------------------------------------------------------------------------

/**
 * All 28 Indian States + 8 Union Territories.
 * Ordered alphabetically within States, then UTs.
 */
export const INDIA_STATES: IndiaState[] = [
  // ── States ────────────────────────────────────────────────────────────────
  { id: 'andhra_pradesh',    name: 'Andhra Pradesh',    capital: 'Amaravati',       region: 'South'     },
  { id: 'arunachal_pradesh', name: 'Arunachal Pradesh', capital: 'Itanagar',        region: 'Northeast' },
  { id: 'assam',             name: 'Assam',             capital: 'Dispur',          region: 'Northeast' },
  { id: 'bihar',             name: 'Bihar',             capital: 'Patna',           region: 'East'      },
  { id: 'chhattisgarh',      name: 'Chhattisgarh',      capital: 'Raipur',          region: 'Central'   },
  { id: 'goa',               name: 'Goa',               capital: 'Panaji',          region: 'West'      },
  { id: 'gujarat',           name: 'Gujarat',           capital: 'Gandhinagar',     region: 'West'      },
  { id: 'haryana',           name: 'Haryana',           capital: 'Chandigarh',      region: 'North'     },
  { id: 'himachal_pradesh',  name: 'Himachal Pradesh',  capital: 'Shimla',          region: 'North'     },
  { id: 'jharkhand',         name: 'Jharkhand',         capital: 'Ranchi',          region: 'East'      },
  { id: 'karnataka',         name: 'Karnataka',         capital: 'Bengaluru',       region: 'South'     },
  { id: 'kerala',            name: 'Kerala',            capital: 'Thiruvananthapuram', region: 'South'  },
  { id: 'madhya_pradesh',    name: 'Madhya Pradesh',    capital: 'Bhopal',          region: 'Central'   },
  { id: 'maharashtra',       name: 'Maharashtra',       capital: 'Mumbai',          region: 'West'      },
  { id: 'manipur',           name: 'Manipur',           capital: 'Imphal',          region: 'Northeast' },
  { id: 'meghalaya',         name: 'Meghalaya',         capital: 'Shillong',        region: 'Northeast' },
  { id: 'mizoram',           name: 'Mizoram',           capital: 'Aizawl',          region: 'Northeast' },
  { id: 'nagaland',          name: 'Nagaland',          capital: 'Kohima',          region: 'Northeast' },
  { id: 'odisha',            name: 'Odisha',            capital: 'Bhubaneswar',     region: 'East'      },
  { id: 'punjab',            name: 'Punjab',            capital: 'Chandigarh',      region: 'North'     },
  { id: 'rajasthan',         name: 'Rajasthan',         capital: 'Jaipur',          region: 'North'     },
  { id: 'sikkim',            name: 'Sikkim',            capital: 'Gangtok',         region: 'Northeast' },
  { id: 'tamil_nadu',        name: 'Tamil Nadu',        capital: 'Chennai',         region: 'South'     },
  { id: 'telangana',         name: 'Telangana',         capital: 'Hyderabad',       region: 'South'     },
  { id: 'tripura',           name: 'Tripura',           capital: 'Agartala',        region: 'Northeast' },
  { id: 'uttar_pradesh',     name: 'Uttar Pradesh',     capital: 'Lucknow',         region: 'North'     },
  { id: 'uttarakhand',       name: 'Uttarakhand',       capital: 'Dehradun',        region: 'North'     },
  { id: 'west_bengal',       name: 'West Bengal',       capital: 'Kolkata',         region: 'East'      },

  // ── Union Territories ─────────────────────────────────────────────────────
  { id: 'andaman_nicobar',   name: 'Andaman & Nicobar Islands', capital: 'Port Blair', region: 'East'  },
  { id: 'chandigarh',        name: 'Chandigarh',        capital: 'Chandigarh',      region: 'North'     },
  { id: 'dadra_nagar_haveli', name: 'Dadra & Nagar Haveli and Daman & Diu', capital: 'Daman', region: 'West' },
  { id: 'delhi',             name: 'Delhi',             capital: 'New Delhi',       region: 'North'     },
  { id: 'jammu_kashmir',     name: 'Jammu & Kashmir',   capital: 'Srinagar / Jammu', region: 'North'   },
  { id: 'ladakh',            name: 'Ladakh',            capital: 'Leh',             region: 'North'     },
  { id: 'lakshadweep',       name: 'Lakshadweep',       capital: 'Kavaratti',       region: 'South'     },
  { id: 'puducherry',        name: 'Puducherry',        capital: 'Puducherry',      region: 'South'     },
];

// ---------------------------------------------------------------------------
// Districts
// ---------------------------------------------------------------------------

/**
 * Master list of Indian districts.
 *
 * Coverage:
 *  - Jharkhand: ALL 24 districts
 *  - All other states/UTs: 3–10 representative, geographically distributed districts
 *
 * lat/lng are approximate district centroids.
 * Population figures are Census 2011 approximations.
 */
export const INDIA_DISTRICTS: IndiaDistrict[] = [

  // ══════════════════════════════════════════════════════════════════════════
  // ANDHRA PRADESH  (13 districts as of 2022 reorganization — key ones)
  // ══════════════════════════════════════════════════════════════════════════
  { id: 'dist_ap_visakhapatnam',  stateId: 'andhra_pradesh', name: 'Visakhapatnam',  lat: 17.6868, lng: 83.2185, population: 4290589, healthTier: 'metro'      },
  { id: 'dist_ap_vijayawada',     stateId: 'andhra_pradesh', name: 'Krishna',         lat: 16.5062, lng: 80.6480, population: 4529009, healthTier: 'metro'      },
  { id: 'dist_ap_guntur',         stateId: 'andhra_pradesh', name: 'Guntur',          lat: 16.3008, lng: 80.4428, population: 4889230, healthTier: 'urban'      },
  { id: 'dist_ap_kurnool',        stateId: 'andhra_pradesh', name: 'Kurnool',         lat: 15.8281, lng: 78.0373, population: 4046601, healthTier: 'urban'      },
  { id: 'dist_ap_anantapur',      stateId: 'andhra_pradesh', name: 'Anantapur',       lat: 14.6819, lng: 77.6006, population: 4083315, healthTier: 'rural'      },
  { id: 'dist_ap_kadapa',         stateId: 'andhra_pradesh', name: 'YSR Kadapa',      lat: 14.4674, lng: 78.8241, population: 2884524, healthTier: 'semi_urban' },
  { id: 'dist_ap_nellore',        stateId: 'andhra_pradesh', name: 'Sri Potti Sriramulu Nellore', lat: 14.4426, lng: 79.9865, population: 2966082, healthTier: 'urban' },
  { id: 'dist_ap_srikakulam',     stateId: 'andhra_pradesh', name: 'Srikakulam',      lat: 18.2949, lng: 83.8938, population: 2703114, healthTier: 'rural'      },
  { id: 'dist_ap_east_godavari',  stateId: 'andhra_pradesh', name: 'East Godavari',   lat: 17.3297, lng: 81.9797, population: 5154296, healthTier: 'semi_urban' },
  { id: 'dist_ap_west_godavari',  stateId: 'andhra_pradesh', name: 'West Godavari',   lat: 16.9174, lng: 81.3378, population: 3934782, healthTier: 'semi_urban' },

  // ══════════════════════════════════════════════════════════════════════════
  // ARUNACHAL PRADESH
  // ══════════════════════════════════════════════════════════════════════════
  { id: 'dist_ar_itanagar',       stateId: 'arunachal_pradesh', name: 'Papum Pare',   lat: 27.0844, lng: 93.6053, population: 176385,  healthTier: 'urban'  },
  { id: 'dist_ar_west_kameng',    stateId: 'arunachal_pradesh', name: 'West Kameng',  lat: 27.2500, lng: 92.5500, population: 87013,   healthTier: 'tribal' },
  { id: 'dist_ar_upper_siang',    stateId: 'arunachal_pradesh', name: 'Upper Siang',  lat: 28.2000, lng: 95.0000, population: 35320,   healthTier: 'tribal' },
  { id: 'dist_ar_lohit',          stateId: 'arunachal_pradesh', name: 'Lohit',        lat: 28.0500, lng: 96.2000, population: 145726,  healthTier: 'rural'  },
  { id: 'dist_ar_tawang',         stateId: 'arunachal_pradesh', name: 'Tawang',       lat: 27.5860, lng: 91.8590, population: 49977,   healthTier: 'tribal' },

  // ══════════════════════════════════════════════════════════════════════════
  // ASSAM
  // ══════════════════════════════════════════════════════════════════════════
  { id: 'dist_as_kamrup_metro',   stateId: 'assam', name: 'Kamrup Metropolitan', lat: 26.1445, lng: 91.7362, population: 1253938, healthTier: 'metro'      },
  { id: 'dist_as_dibrugarh',      stateId: 'assam', name: 'Dibrugarh',           lat: 27.4728, lng: 94.9120, population: 1327748, healthTier: 'urban'      },
  { id: 'dist_as_nagaon',         stateId: 'assam', name: 'Nagaon',              lat: 26.3466, lng: 92.6868, population: 2823768, healthTier: 'semi_urban' },
  { id: 'dist_as_sonitpur',       stateId: 'assam', name: 'Sonitpur',            lat: 26.6338, lng: 92.7972, population: 1924110, healthTier: 'rural'      },
  { id: 'dist_as_cachar',         stateId: 'assam', name: 'Cachar',              lat: 24.8333, lng: 92.7789, population: 1736617, healthTier: 'urban'      },
  { id: 'dist_as_karbi_anglong',  stateId: 'assam', name: 'Karbi Anglong',       lat: 26.1000, lng: 93.5000, population: 956313,  healthTier: 'tribal'     },
  { id: 'dist_as_dhubri',         stateId: 'assam', name: 'Dhubri',              lat: 26.0200, lng: 89.9877, population: 1948632, healthTier: 'rural'      },
  { id: 'dist_as_jorhat',         stateId: 'assam', name: 'Jorhat',              lat: 26.7465, lng: 94.2026, population: 1092256, healthTier: 'urban'      },

  // ══════════════════════════════════════════════════════════════════════════
  // BIHAR
  // ══════════════════════════════════════════════════════════════════════════
  { id: 'dist_br_patna',          stateId: 'bihar', name: 'Patna',     lat: 25.5941, lng: 85.1376, population: 5838465, healthTier: 'metro'      },
  { id: 'dist_br_gaya',           stateId: 'bihar', name: 'Gaya',      lat: 24.7955, lng: 85.0002, population: 4379383, healthTier: 'urban'      },
  { id: 'dist_br_muzaffarpur',    stateId: 'bihar', name: 'Muzaffarpur', lat: 26.1209, lng: 85.3647, population: 4778610, healthTier: 'urban'    },
  { id: 'dist_br_bhagalpur',      stateId: 'bihar', name: 'Bhagalpur', lat: 25.2425, lng: 86.9842, population: 3032226, healthTier: 'urban'      },
  { id: 'dist_br_darbhanga',      stateId: 'bihar', name: 'Darbhanga', lat: 26.1542, lng: 85.8918, population: 3937385, healthTier: 'semi_urban' },
  { id: 'dist_br_purnia',         stateId: 'bihar', name: 'Purnia',    lat: 25.7771, lng: 87.4753, population: 3264619, healthTier: 'rural'      },
  { id: 'dist_br_sitamarhi',      stateId: 'bihar', name: 'Sitamarhi', lat: 26.5928, lng: 85.4799, population: 3419622, healthTier: 'rural'      },
  { id: 'dist_br_nalanda',        stateId: 'bihar', name: 'Nalanda',   lat: 25.1500, lng: 85.4500, population: 2877653, healthTier: 'rural'      },

  // ══════════════════════════════════════════════════════════════════════════
  // CHHATTISGARH
  // ══════════════════════════════════════════════════════════════════════════
  { id: 'dist_cg_raipur',         stateId: 'chhattisgarh', name: 'Raipur',       lat: 21.2514, lng: 81.6296, population: 4062160, healthTier: 'metro'      },
  { id: 'dist_cg_durg',           stateId: 'chhattisgarh', name: 'Durg',         lat: 21.1904, lng: 81.2849, population: 3343872, healthTier: 'urban'      },
  { id: 'dist_cg_bilaspur',       stateId: 'chhattisgarh', name: 'Bilaspur',     lat: 22.0797, lng: 82.1391, population: 2663629, healthTier: 'urban'      },
  { id: 'dist_cg_bastar',         stateId: 'chhattisgarh', name: 'Bastar',       lat: 19.1167, lng: 81.9500, population: 1302673, healthTier: 'tribal'     },
  { id: 'dist_cg_sarguja',        stateId: 'chhattisgarh', name: 'Surguja',      lat: 23.1158, lng: 83.1972, population: 2359965, healthTier: 'tribal'     },
  { id: 'dist_cg_rajnandgaon',    stateId: 'chhattisgarh', name: 'Rajnandgaon',  lat: 21.0974, lng: 81.0297, population: 1537133, healthTier: 'rural'      },
  { id: 'dist_cg_korba',          stateId: 'chhattisgarh', name: 'Korba',        lat: 22.3595, lng: 82.7501, population: 1206563, healthTier: 'semi_urban' },

  // ══════════════════════════════════════════════════════════════════════════
  // GOA
  // ══════════════════════════════════════════════════════════════════════════
  { id: 'dist_ga_north_goa',      stateId: 'goa', name: 'North Goa',  lat: 15.4909, lng: 73.8278, population: 818008, healthTier: 'urban' },
  { id: 'dist_ga_south_goa',      stateId: 'goa', name: 'South Goa',  lat: 15.1777, lng: 74.0183, population: 640537, healthTier: 'semi_urban' },

  // ══════════════════════════════════════════════════════════════════════════
  // GUJARAT
  // ══════════════════════════════════════════════════════════════════════════
  { id: 'dist_gj_ahmedabad',      stateId: 'gujarat', name: 'Ahmedabad',   lat: 23.0225, lng: 72.5714, population: 7209840, healthTier: 'metro'      },
  { id: 'dist_gj_surat',          stateId: 'gujarat', name: 'Surat',       lat: 21.1702, lng: 72.8311, population: 6079231, healthTier: 'metro'      },
  { id: 'dist_gj_vadodara',       stateId: 'gujarat', name: 'Vadodara',    lat: 22.3072, lng: 73.1812, population: 4165626, healthTier: 'metro'      },
  { id: 'dist_gj_rajkot',         stateId: 'gujarat', name: 'Rajkot',      lat: 22.3039, lng: 70.8022, population: 3804558, healthTier: 'urban'      },
  { id: 'dist_gj_kutch',          stateId: 'gujarat', name: 'Kutch',       lat: 23.7337, lng: 69.8597, population: 2090313, healthTier: 'rural'      },
  { id: 'dist_gj_mehsana',        stateId: 'gujarat', name: 'Mehsana',     lat: 23.6000, lng: 72.3833, population: 2027727, healthTier: 'semi_urban' },
  { id: 'dist_gj_gandhinagar',    stateId: 'gujarat', name: 'Gandhinagar', lat: 23.2156, lng: 72.6369, population: 1387478, healthTier: 'urban'      },
  { id: 'dist_gj_amreli',         stateId: 'gujarat', name: 'Amreli',      lat: 21.6005, lng: 71.2214, population: 1513632, healthTier: 'rural'      },

  // ══════════════════════════════════════════════════════════════════════════
  // HARYANA
  // ══════════════════════════════════════════════════════════════════════════
  { id: 'dist_hr_faridabad',      stateId: 'haryana', name: 'Faridabad',   lat: 28.4089, lng: 77.3178, population: 1798954, healthTier: 'metro'      },
  { id: 'dist_hr_gurugram',       stateId: 'haryana', name: 'Gurugram',    lat: 28.4595, lng: 77.0266, population: 1514432, healthTier: 'metro'      },
  { id: 'dist_hr_hisar',          stateId: 'haryana', name: 'Hisar',       lat: 29.1492, lng: 75.7217, population: 1743931, healthTier: 'urban'      },
  { id: 'dist_hr_ambala',         stateId: 'haryana', name: 'Ambala',      lat: 30.3782, lng: 76.7767, population: 1128350, healthTier: 'urban'      },
  { id: 'dist_hr_rohtak',         stateId: 'haryana', name: 'Rohtak',      lat: 28.8955, lng: 76.6066, population: 1058683, healthTier: 'urban'      },
  { id: 'dist_hr_karnal',         stateId: 'haryana', name: 'Karnal',      lat: 29.6857, lng: 76.9905, population: 1505324, healthTier: 'semi_urban' },
  { id: 'dist_hr_panipat',        stateId: 'haryana', name: 'Panipat',     lat: 29.3909, lng: 76.9635, population: 1202811, healthTier: 'urban'      },
  { id: 'dist_hr_mewat',          stateId: 'haryana', name: 'Nuh (Mewat)', lat: 27.9925, lng: 77.1028, population: 1089406, healthTier: 'rural'      },

  // ══════════════════════════════════════════════════════════════════════════
  // HIMACHAL PRADESH
  // ══════════════════════════════════════════════════════════════════════════
  { id: 'dist_hp_shimla',         stateId: 'himachal_pradesh', name: 'Shimla',      lat: 31.1048, lng: 77.1734, population: 813884,  healthTier: 'urban'      },
  { id: 'dist_hp_kangra',         stateId: 'himachal_pradesh', name: 'Kangra',      lat: 32.0998, lng: 76.2691, population: 1510075, healthTier: 'semi_urban' },
  { id: 'dist_hp_mandi',          stateId: 'himachal_pradesh', name: 'Mandi',       lat: 31.7077, lng: 76.9318, population: 999518,  healthTier: 'rural'      },
  { id: 'dist_hp_kullu',          stateId: 'himachal_pradesh', name: 'Kullu',       lat: 31.9579, lng: 77.1095, population: 437903,  healthTier: 'rural'      },
  { id: 'dist_hp_lahaul_spiti',   stateId: 'himachal_pradesh', name: 'Lahaul and Spiti', lat: 32.5637, lng: 77.2580, population: 31564, healthTier: 'tribal' },
  { id: 'dist_hp_solan',          stateId: 'himachal_pradesh', name: 'Solan',       lat: 30.9045, lng: 77.0967, population: 580320,  healthTier: 'semi_urban' },

  // ══════════════════════════════════════════════════════════════════════════
  // JHARKHAND — ALL 24 DISTRICTS
  // ══════════════════════════════════════════════════════════════════════════
  { id: 'dist_jhk_bokaro',              stateId: 'jharkhand', name: 'Bokaro',              lat: 23.6693, lng: 85.9601, population: 2061918, healthTier: 'urban'      },
  { id: 'dist_jhk_chatra',              stateId: 'jharkhand', name: 'Chatra',              lat: 24.2091, lng: 84.8760, population: 1042304, healthTier: 'rural'      },
  { id: 'dist_jhk_deoghar',             stateId: 'jharkhand', name: 'Deoghar',             lat: 24.4854, lng: 86.6950, population: 1490726, healthTier: 'semi_urban' },
  { id: 'dist_jhk_dhanbad',             stateId: 'jharkhand', name: 'Dhanbad',             lat: 23.7957, lng: 86.4304, population: 2684487, healthTier: 'urban'      },
  { id: 'dist_jhk_dumka',               stateId: 'jharkhand', name: 'Dumka',               lat: 24.2683, lng: 87.2498, population: 1321442, healthTier: 'rural'      },
  { id: 'dist_jhk_east_singhbhum',      stateId: 'jharkhand', name: 'East Singhbhum',      lat: 22.8046, lng: 86.2029, population: 2293919, healthTier: 'urban'      },
  { id: 'dist_jhk_garhwa',              stateId: 'jharkhand', name: 'Garhwa',              lat: 24.1601, lng: 83.6481, population: 1322784, healthTier: 'rural'      },
  { id: 'dist_jhk_giridih',             stateId: 'jharkhand', name: 'Giridih',             lat: 24.1853, lng: 86.3025, population: 2445474, healthTier: 'rural'      },
  { id: 'dist_jhk_godda',               stateId: 'jharkhand', name: 'Godda',               lat: 24.8295, lng: 87.2126, population: 1313551, healthTier: 'rural'      },
  { id: 'dist_jhk_gumla',               stateId: 'jharkhand', name: 'Gumla',               lat: 23.0444, lng: 84.5364, population: 1025213, healthTier: 'tribal'     },
  { id: 'dist_jhk_hazaribagh',          stateId: 'jharkhand', name: 'Hazaribagh',          lat: 23.9975, lng: 85.3637, population: 1734005, healthTier: 'semi_urban' },
  { id: 'dist_jhk_jamtara',             stateId: 'jharkhand', name: 'Jamtara',             lat: 23.9624, lng: 86.8036, population: 790207,  healthTier: 'rural'      },
  { id: 'dist_jhk_khunti',              stateId: 'jharkhand', name: 'Khunti',              lat: 23.0711, lng: 85.2757, population: 530299,  healthTier: 'tribal'     },
  { id: 'dist_jhk_koderma',             stateId: 'jharkhand', name: 'Koderma',             lat: 24.4638, lng: 85.5969, population: 717169,  healthTier: 'rural'      },
  { id: 'dist_jhk_latehar',             stateId: 'jharkhand', name: 'Latehar',             lat: 23.7453, lng: 84.5042, population: 726978,  healthTier: 'tribal'     },
  { id: 'dist_jhk_lohardaga',           stateId: 'jharkhand', name: 'Lohardaga',           lat: 23.4381, lng: 84.6821, population: 461790,  healthTier: 'tribal'     },
  { id: 'dist_jhk_pakur',               stateId: 'jharkhand', name: 'Pakur',               lat: 24.6356, lng: 87.8429, population: 899858,  healthTier: 'rural'      },
  { id: 'dist_jhk_palamu',              stateId: 'jharkhand', name: 'Palamu',              lat: 24.0291, lng: 84.0705, population: 1936319, healthTier: 'rural'      },
  { id: 'dist_jhk_ramgarh',             stateId: 'jharkhand', name: 'Ramgarh',             lat: 23.6282, lng: 85.5116, population: 949159,  healthTier: 'semi_urban' },
  { id: 'dist_jhk_ranchi',              stateId: 'jharkhand', name: 'Ranchi',              lat: 23.3441, lng: 85.3096, population: 2914253, healthTier: 'metro'      },
  { id: 'dist_jhk_sahibganj',           stateId: 'jharkhand', name: 'Sahibganj',           lat: 25.2440, lng: 87.6350, population: 1150567, healthTier: 'rural'      },
  { id: 'dist_jhk_seraikela_kharsawan', stateId: 'jharkhand', name: 'Seraikela Kharsawan', lat: 22.5957, lng: 85.9374, population: 1067360, healthTier: 'rural'      },
  { id: 'dist_jhk_simdega',             stateId: 'jharkhand', name: 'Simdega',             lat: 22.6139, lng: 84.5021, population: 599578,  healthTier: 'tribal'     },
  { id: 'dist_jhk_west_singhbhum',      stateId: 'jharkhand', name: 'West Singhbhum',      lat: 22.3157, lng: 85.2839, population: 1502338, healthTier: 'tribal'     },

  // ══════════════════════════════════════════════════════════════════════════
  // KARNATAKA
  // ══════════════════════════════════════════════════════════════════════════
  { id: 'dist_ka_bengaluru_urban', stateId: 'karnataka', name: 'Bengaluru Urban',  lat: 12.9716, lng: 77.5946, population: 9621551, healthTier: 'metro'      },
  { id: 'dist_ka_mysuru',          stateId: 'karnataka', name: 'Mysuru',           lat: 12.2958, lng: 76.6394, population: 3001127, healthTier: 'metro'      },
  { id: 'dist_ka_dharwad',         stateId: 'karnataka', name: 'Dharwad',          lat: 15.4589, lng: 75.0078, population: 1847025, healthTier: 'urban'      },
  { id: 'dist_ka_mangaluru',       stateId: 'karnataka', name: 'Dakshina Kannada', lat: 12.8700, lng: 74.8800, population: 2083625, healthTier: 'urban'      },
  { id: 'dist_ka_belgaum',         stateId: 'karnataka', name: 'Belagavi',         lat: 15.8497, lng: 74.4977, population: 4779661, healthTier: 'urban'      },
  { id: 'dist_ka_tumkur',          stateId: 'karnataka', name: 'Tumakuru',         lat: 13.3379, lng: 77.1173, population: 2681449, healthTier: 'semi_urban' },
  { id: 'dist_ka_kolar',           stateId: 'karnataka', name: 'Kolar',            lat: 13.1360, lng: 78.1290, population: 1540231, healthTier: 'rural'      },
  { id: 'dist_ka_raichur',         stateId: 'karnataka', name: 'Raichur',          lat: 16.2120, lng: 77.3439, population: 1924773, healthTier: 'rural'      },
  { id: 'dist_ka_gulbarga',        stateId: 'karnataka', name: 'Kalaburagi',       lat: 17.3297, lng: 76.8343, population: 2566326, healthTier: 'urban'      },
  { id: 'dist_ka_shivamogga',      stateId: 'karnataka', name: 'Shivamogga',       lat: 13.9299, lng: 75.5681, population: 1755512, healthTier: 'semi_urban' },

  // ══════════════════════════════════════════════════════════════════════════
  // KERALA
  // ══════════════════════════════════════════════════════════════════════════
  { id: 'dist_kl_thiruvananthapuram', stateId: 'kerala', name: 'Thiruvananthapuram', lat: 8.5241,  lng: 76.9366, population: 3301427, healthTier: 'metro'      },
  { id: 'dist_kl_ernakulam',          stateId: 'kerala', name: 'Ernakulam',           lat: 9.9816,  lng: 76.2999, population: 3282388, healthTier: 'metro'      },
  { id: 'dist_kl_kozhikode',          stateId: 'kerala', name: 'Kozhikode',           lat: 11.2588, lng: 75.7804, population: 3086293, healthTier: 'urban'      },
  { id: 'dist_kl_thrissur',           stateId: 'kerala', name: 'Thrissur',            lat: 10.5276, lng: 76.2144, population: 3110327, healthTier: 'urban'      },
  { id: 'dist_kl_kollam',             stateId: 'kerala', name: 'Kollam',              lat: 8.8932,  lng: 76.6141, population: 2635375, healthTier: 'urban'      },
  { id: 'dist_kl_palakkad',           stateId: 'kerala', name: 'Palakkad',            lat: 10.7867, lng: 76.6548, population: 2809934, healthTier: 'semi_urban' },
  { id: 'dist_kl_wayanad',            stateId: 'kerala', name: 'Wayanad',             lat: 11.6854, lng: 76.1320, population: 816558,  healthTier: 'rural'      },
  { id: 'dist_kl_idukki',             stateId: 'kerala', name: 'Idukki',              lat: 9.9189,  lng: 77.1025, population: 1107453, healthTier: 'rural'      },

  // ══════════════════════════════════════════════════════════════════════════
  // MADHYA PRADESH
  // ══════════════════════════════════════════════════════════════════════════
  { id: 'dist_mp_bhopal',         stateId: 'madhya_pradesh', name: 'Bhopal',       lat: 23.2599, lng: 77.4126, population: 2371061, healthTier: 'metro'      },
  { id: 'dist_mp_indore',         stateId: 'madhya_pradesh', name: 'Indore',       lat: 22.7196, lng: 75.8577, population: 3272335, healthTier: 'metro'      },
  { id: 'dist_mp_gwalior',        stateId: 'madhya_pradesh', name: 'Gwalior',      lat: 26.2183, lng: 78.1828, population: 2032036, healthTier: 'metro'      },
  { id: 'dist_mp_jabalpur',       stateId: 'madhya_pradesh', name: 'Jabalpur',     lat: 23.1815, lng: 79.9864, population: 2463289, healthTier: 'urban'      },
  { id: 'dist_mp_ujjain',         stateId: 'madhya_pradesh', name: 'Ujjain',       lat: 23.1765, lng: 75.7885, population: 1986864, healthTier: 'urban'      },
  { id: 'dist_mp_rewa',           stateId: 'madhya_pradesh', name: 'Rewa',         lat: 24.5362, lng: 81.2962, population: 2365106, healthTier: 'semi_urban' },
  { id: 'dist_mp_sagar',          stateId: 'madhya_pradesh', name: 'Sagar',        lat: 23.8388, lng: 78.7378, population: 2378458, healthTier: 'semi_urban' },
  { id: 'dist_mp_balaghat',       stateId: 'madhya_pradesh', name: 'Balaghat',     lat: 21.8127, lng: 80.1869, population: 1701698, healthTier: 'rural'      },
  { id: 'dist_mp_mandla',         stateId: 'madhya_pradesh', name: 'Mandla',       lat: 22.5991, lng: 80.3879, population: 1053522, healthTier: 'tribal'     },

  // ══════════════════════════════════════════════════════════════════════════
  // MAHARASHTRA
  // ══════════════════════════════════════════════════════════════════════════
  { id: 'dist_mh_mumbai',         stateId: 'maharashtra', name: 'Mumbai',           lat: 18.9388, lng: 72.8354, population: 12442373, healthTier: 'metro'      },
  { id: 'dist_mh_pune',           stateId: 'maharashtra', name: 'Pune',             lat: 18.5204, lng: 73.8567, population: 9429408,  healthTier: 'metro'      },
  { id: 'dist_mh_nagpur',         stateId: 'maharashtra', name: 'Nagpur',           lat: 21.1458, lng: 79.0882, population: 4653570,  healthTier: 'metro'      },
  { id: 'dist_mh_nashik',         stateId: 'maharashtra', name: 'Nashik',           lat: 19.9975, lng: 73.7898, population: 6107187,  healthTier: 'urban'      },
  { id: 'dist_mh_aurangabad',     stateId: 'maharashtra', name: 'Chhatrapati Sambhajinagar', lat: 19.8762, lng: 75.3433, population: 3701282, healthTier: 'urban' },
  { id: 'dist_mh_solapur',        stateId: 'maharashtra', name: 'Solapur',          lat: 17.6805, lng: 75.9064, population: 4317756,  healthTier: 'urban'      },
  { id: 'dist_mh_kolhapur',       stateId: 'maharashtra', name: 'Kolhapur',         lat: 16.7050, lng: 74.2433, population: 3876001,  healthTier: 'urban'      },
  { id: 'dist_mh_amravati',       stateId: 'maharashtra', name: 'Amravati',         lat: 20.9320, lng: 77.7523, population: 2888445,  healthTier: 'semi_urban' },
  { id: 'dist_mh_nandurbar',      stateId: 'maharashtra', name: 'Nandurbar',        lat: 21.3667, lng: 74.2411, population: 1648295,  healthTier: 'tribal'     },
  { id: 'dist_mh_gadchiroli',     stateId: 'maharashtra', name: 'Gadchiroli',       lat: 20.1808, lng: 80.0044, population: 1072942,  healthTier: 'tribal'     },

  // ══════════════════════════════════════════════════════════════════════════
  // MANIPUR
  // ══════════════════════════════════════════════════════════════════════════
  { id: 'dist_mn_imphal_west',    stateId: 'manipur', name: 'Imphal West',   lat: 24.8170, lng: 93.9368, population: 517992,  healthTier: 'urban'  },
  { id: 'dist_mn_imphal_east',    stateId: 'manipur', name: 'Imphal East',   lat: 24.8500, lng: 94.0500, population: 456113,  healthTier: 'urban'  },
  { id: 'dist_mn_bishnupur',      stateId: 'manipur', name: 'Bishnupur',     lat: 24.6206, lng: 93.7753, population: 240363,  healthTier: 'rural'  },
  { id: 'dist_mn_thoubal',        stateId: 'manipur', name: 'Thoubal',       lat: 24.6400, lng: 94.0100, population: 420517,  healthTier: 'rural'  },
  { id: 'dist_mn_senapati',       stateId: 'manipur', name: 'Senapati',      lat: 25.2558, lng: 94.0194, population: 354974,  healthTier: 'tribal' },
  { id: 'dist_mn_churachandpur',  stateId: 'manipur', name: 'Churachandpur', lat: 24.3333, lng: 93.6833, population: 274143,  healthTier: 'tribal' },

  // ══════════════════════════════════════════════════════════════════════════
  // MEGHALAYA
  // ══════════════════════════════════════════════════════════════════════════
  { id: 'dist_ml_east_khasi',     stateId: 'meghalaya', name: 'East Khasi Hills',  lat: 25.5788, lng: 91.8933, population: 825922,  healthTier: 'urban'  },
  { id: 'dist_ml_ri_bhoi',        stateId: 'meghalaya', name: 'Ri Bhoi',           lat: 25.7833, lng: 92.1167, population: 258380,  healthTier: 'rural'  },
  { id: 'dist_ml_west_khasi',     stateId: 'meghalaya', name: 'West Khasi Hills',  lat: 25.5333, lng: 90.6667, population: 385601,  healthTier: 'tribal' },
  { id: 'dist_ml_east_garo',      stateId: 'meghalaya', name: 'East Garo Hills',   lat: 25.6167, lng: 90.8167, population: 317917,  healthTier: 'tribal' },
  { id: 'dist_ml_west_garo',      stateId: 'meghalaya', name: 'West Garo Hills',   lat: 25.5667, lng: 90.2167, population: 643291,  healthTier: 'rural'  },

  // ══════════════════════════════════════════════════════════════════════════
  // MIZORAM
  // ══════════════════════════════════════════════════════════════════════════
  { id: 'dist_mz_aizawl',         stateId: 'mizoram', name: 'Aizawl',     lat: 23.7271, lng: 92.7176, population: 400309, healthTier: 'urban'  },
  { id: 'dist_mz_lunglei',        stateId: 'mizoram', name: 'Lunglei',    lat: 22.8809, lng: 92.7326, population: 154024, healthTier: 'rural'  },
  { id: 'dist_mz_champhai',       stateId: 'mizoram', name: 'Champhai',   lat: 23.4614, lng: 93.3271, population: 125745, healthTier: 'rural'  },
  { id: 'dist_mz_kolasib',        stateId: 'mizoram', name: 'Kolasib',    lat: 24.2256, lng: 92.6809, population: 83955,  healthTier: 'rural'  },

  // ══════════════════════════════════════════════════════════════════════════
  // NAGALAND
  // ══════════════════════════════════════════════════════════════════════════
  { id: 'dist_nl_kohima',         stateId: 'nagaland', name: 'Kohima',    lat: 25.6751, lng: 94.1086, population: 267988, healthTier: 'urban'  },
  { id: 'dist_nl_dimapur',        stateId: 'nagaland', name: 'Dimapur',   lat: 25.9044, lng: 93.7244, population: 378811, healthTier: 'urban'  },
  { id: 'dist_nl_mokokchung',     stateId: 'nagaland', name: 'Mokokchung', lat: 26.3259, lng: 94.5176, population: 194622, healthTier: 'rural' },
  { id: 'dist_nl_wokha',          stateId: 'nagaland', name: 'Wokha',     lat: 26.1044, lng: 94.2612, population: 166343, healthTier: 'tribal' },
  { id: 'dist_nl_mon',            stateId: 'nagaland', name: 'Mon',       lat: 26.7200, lng: 94.9800, population: 250260, healthTier: 'tribal' },

  // ══════════════════════════════════════════════════════════════════════════
  // ODISHA
  // ══════════════════════════════════════════════════════════════════════════
  { id: 'dist_od_khordha',        stateId: 'odisha', name: 'Khordha',      lat: 20.1856, lng: 85.6340, population: 2251673, healthTier: 'metro'      },
  { id: 'dist_od_cuttack',        stateId: 'odisha', name: 'Cuttack',      lat: 20.4625, lng: 85.8828, population: 2618708, healthTier: 'urban'      },
  { id: 'dist_od_sundargarh',     stateId: 'odisha', name: 'Sundargarh',   lat: 22.1167, lng: 84.0167, population: 2080664, healthTier: 'semi_urban' },
  { id: 'dist_od_ganjam',         stateId: 'odisha', name: 'Ganjam',       lat: 19.3867, lng: 84.5858, population: 3520151, healthTier: 'rural'      },
  { id: 'dist_od_koraput',        stateId: 'odisha', name: 'Koraput',      lat: 18.8135, lng: 82.7108, population: 1376934, healthTier: 'tribal'     },
  { id: 'dist_od_mayurbhanj',     stateId: 'odisha', name: 'Mayurbhanj',   lat: 21.9275, lng: 86.7303, population: 2513895, healthTier: 'tribal'     },
  { id: 'dist_od_sambalpur',      stateId: 'odisha', name: 'Sambalpur',    lat: 21.4669, lng: 83.9812, population: 1044410, healthTier: 'semi_urban' },
  { id: 'dist_od_balasore',       stateId: 'odisha', name: 'Balasore',     lat: 21.4934, lng: 86.9356, population: 2320529, healthTier: 'semi_urban' },

  // ══════════════════════════════════════════════════════════════════════════
  // PUNJAB
  // ══════════════════════════════════════════════════════════════════════════
  { id: 'dist_pb_ludhiana',       stateId: 'punjab', name: 'Ludhiana',    lat: 30.9010, lng: 75.8573, population: 3498739, healthTier: 'metro'      },
  { id: 'dist_pb_amritsar',       stateId: 'punjab', name: 'Amritsar',    lat: 31.6340, lng: 74.8723, population: 2490656, healthTier: 'metro'      },
  { id: 'dist_pb_jalandhar',      stateId: 'punjab', name: 'Jalandhar',   lat: 31.3260, lng: 75.5762, population: 2193590, healthTier: 'metro'      },
  { id: 'dist_pb_patiala',        stateId: 'punjab', name: 'Patiala',     lat: 30.3398, lng: 76.3869, population: 1892282, healthTier: 'urban'      },
  { id: 'dist_pb_bathinda',       stateId: 'punjab', name: 'Bathinda',    lat: 30.2110, lng: 74.9455, population: 1388525, healthTier: 'urban'      },
  { id: 'dist_pb_gurdaspur',      stateId: 'punjab', name: 'Gurdaspur',   lat: 32.0385, lng: 75.4066, population: 2299026, healthTier: 'semi_urban' },
  { id: 'dist_pb_moga',           stateId: 'punjab', name: 'Moga',        lat: 30.8166, lng: 75.1726, population: 992289,  healthTier: 'rural'      },

  // ══════════════════════════════════════════════════════════════════════════
  // RAJASTHAN
  // ══════════════════════════════════════════════════════════════════════════
  { id: 'dist_rj_jaipur',         stateId: 'rajasthan', name: 'Jaipur',      lat: 26.9124, lng: 75.7873, population: 6626178, healthTier: 'metro'      },
  { id: 'dist_rj_jodhpur',        stateId: 'rajasthan', name: 'Jodhpur',     lat: 26.2389, lng: 73.0243, population: 3687165, healthTier: 'metro'      },
  { id: 'dist_rj_udaipur',        stateId: 'rajasthan', name: 'Udaipur',     lat: 24.5854, lng: 73.7125, population: 3067549, healthTier: 'urban'      },
  { id: 'dist_rj_kota',           stateId: 'rajasthan', name: 'Kota',        lat: 25.2138, lng: 75.8648, population: 1950491, healthTier: 'urban'      },
  { id: 'dist_rj_ajmer',          stateId: 'rajasthan', name: 'Ajmer',       lat: 26.4499, lng: 74.6399, population: 2584913, healthTier: 'urban'      },
  { id: 'dist_rj_bikaner',        stateId: 'rajasthan', name: 'Bikaner',     lat: 28.0229, lng: 73.3119, population: 2367745, healthTier: 'urban'      },
  { id: 'dist_rj_alwar',          stateId: 'rajasthan', name: 'Alwar',       lat: 27.5530, lng: 76.6346, population: 3674179, healthTier: 'semi_urban' },
  { id: 'dist_rj_barmer',         stateId: 'rajasthan', name: 'Barmer',      lat: 25.7521, lng: 71.3967, population: 2604453, healthTier: 'rural'      },
  { id: 'dist_rj_jaisalmer',      stateId: 'rajasthan', name: 'Jaisalmer',   lat: 26.9157, lng: 70.9083, population: 669919,  healthTier: 'rural'      },

  // ══════════════════════════════════════════════════════════════════════════
  // SIKKIM
  // ══════════════════════════════════════════════════════════════════════════
  { id: 'dist_sk_east_sikkim',    stateId: 'sikkim', name: 'East Sikkim',  lat: 27.3389, lng: 88.6065, population: 281293, healthTier: 'urban'  },
  { id: 'dist_sk_west_sikkim',    stateId: 'sikkim', name: 'West Sikkim',  lat: 27.3167, lng: 88.2333, population: 136435, healthTier: 'rural'  },
  { id: 'dist_sk_north_sikkim',   stateId: 'sikkim', name: 'North Sikkim', lat: 28.0000, lng: 88.4500, population: 43709,  healthTier: 'tribal' },
  { id: 'dist_sk_south_sikkim',   stateId: 'sikkim', name: 'South Sikkim', lat: 27.1500, lng: 88.4833, population: 146742, healthTier: 'rural'  },

  // ══════════════════════════════════════════════════════════════════════════
  // TAMIL NADU
  // ══════════════════════════════════════════════════════════════════════════
  { id: 'dist_tn_chennai',        stateId: 'tamil_nadu', name: 'Chennai',      lat: 13.0827, lng: 80.2707, population: 4646732, healthTier: 'metro'      },
  { id: 'dist_tn_coimbatore',     stateId: 'tamil_nadu', name: 'Coimbatore',   lat: 11.0168, lng: 76.9558, population: 3458045, healthTier: 'metro'      },
  { id: 'dist_tn_madurai',        stateId: 'tamil_nadu', name: 'Madurai',      lat: 9.9252,  lng: 78.1198, population: 3038252, healthTier: 'metro'      },
  { id: 'dist_tn_trichy',         stateId: 'tamil_nadu', name: 'Tiruchirappalli', lat: 10.7905, lng: 78.7047, population: 2722290, healthTier: 'urban' },
  { id: 'dist_tn_salem',          stateId: 'tamil_nadu', name: 'Salem',        lat: 11.6643, lng: 78.1460, population: 3482056, healthTier: 'urban'      },
  { id: 'dist_tn_tirunelveli',    stateId: 'tamil_nadu', name: 'Tirunelveli', lat: 8.7139,  lng: 77.7567, population: 3072880, healthTier: 'urban'       },
  { id: 'dist_tn_vellore',        stateId: 'tamil_nadu', name: 'Vellore',      lat: 12.9165, lng: 79.1325, population: 3936331, healthTier: 'semi_urban' },
  { id: 'dist_tn_dharmapuri',     stateId: 'tamil_nadu', name: 'Dharmapuri',   lat: 12.1289, lng: 78.1578, population: 1506843, healthTier: 'rural'      },
  { id: 'dist_tn_nilgiris',       stateId: 'tamil_nadu', name: 'The Nilgiris', lat: 11.4916, lng: 76.7337, population: 735394,  healthTier: 'rural'      },

  // ══════════════════════════════════════════════════════════════════════════
  // TELANGANA
  // ══════════════════════════════════════════════════════════════════════════
  { id: 'dist_ts_hyderabad',      stateId: 'telangana', name: 'Hyderabad',      lat: 17.3850, lng: 78.4867, population: 3943323, healthTier: 'metro'      },
  { id: 'dist_ts_rangareddy',     stateId: 'telangana', name: 'Ranga Reddy',    lat: 17.3616, lng: 78.2855, population: 5296396, healthTier: 'metro'      },
  { id: 'dist_ts_medchal',        stateId: 'telangana', name: 'Medchal-Malkajgiri', lat: 17.5444, lng: 78.5454, population: 1790833, healthTier: 'metro' },
  { id: 'dist_ts_warangal',       stateId: 'telangana', name: 'Hanamkonda',     lat: 18.0000, lng: 79.5941, population: 2793180, healthTier: 'urban'      },
  { id: 'dist_ts_karimnagar',     stateId: 'telangana', name: 'Karimnagar',     lat: 18.4386, lng: 79.1288, population: 2341746, healthTier: 'urban'      },
  { id: 'dist_ts_nizamabad',      stateId: 'telangana', name: 'Nizamabad',      lat: 18.6725, lng: 78.0941, population: 1539473, healthTier: 'semi_urban' },
  { id: 'dist_ts_khammam',        stateId: 'telangana', name: 'Khammam',        lat: 17.2473, lng: 80.1514, population: 1401637, healthTier: 'semi_urban' },
  { id: 'dist_ts_adilabad',       stateId: 'telangana', name: 'Adilabad',       lat: 19.6640, lng: 78.5320, population: 708972,  healthTier: 'tribal'     },
  { id: 'dist_ts_bhadradri',      stateId: 'telangana', name: 'Bhadradri Kothagudem', lat: 17.5560, lng: 80.6190, population: 1022906, healthTier: 'rural' },

  // ══════════════════════════════════════════════════════════════════════════
  // TRIPURA
  // ══════════════════════════════════════════════════════════════════════════
  { id: 'dist_tr_west_tripura',   stateId: 'tripura', name: 'West Tripura',   lat: 23.7339, lng: 91.2461, population: 1724619, healthTier: 'urban'  },
  { id: 'dist_tr_south_tripura',  stateId: 'tripura', name: 'South Tripura',  lat: 23.2643, lng: 91.7039, population: 871376,  healthTier: 'rural'  },
  { id: 'dist_tr_north_tripura',  stateId: 'tripura', name: 'North Tripura',  lat: 23.9810, lng: 91.9485, population: 695071,  healthTier: 'rural'  },
  { id: 'dist_tr_dhalai',         stateId: 'tripura', name: 'Dhalai',         lat: 23.7634, lng: 91.8192, population: 377988,  healthTier: 'tribal' },

  // ══════════════════════════════════════════════════════════════════════════
  // UTTAR PRADESH
  // ══════════════════════════════════════════════════════════════════════════
  { id: 'dist_up_lucknow',        stateId: 'uttar_pradesh', name: 'Lucknow',      lat: 26.8467, lng: 80.9462, population: 4589838, healthTier: 'metro'      },
  { id: 'dist_up_kanpur_nagar',   stateId: 'uttar_pradesh', name: 'Kanpur Nagar', lat: 26.4499, lng: 80.3319, population: 4572951, healthTier: 'metro'      },
  { id: 'dist_up_agra',           stateId: 'uttar_pradesh', name: 'Agra',         lat: 27.1767, lng: 78.0081, population: 4380793, healthTier: 'metro'      },
  { id: 'dist_up_varanasi',       stateId: 'uttar_pradesh', name: 'Varanasi',     lat: 25.3176, lng: 82.9739, population: 3682194, healthTier: 'metro'      },
  { id: 'dist_up_meerut',         stateId: 'uttar_pradesh', name: 'Meerut',       lat: 28.9845, lng: 77.7064, population: 3443689, healthTier: 'metro'      },
  { id: 'dist_up_prayagraj',      stateId: 'uttar_pradesh', name: 'Prayagraj',    lat: 25.4358, lng: 81.8463, population: 5959798, healthTier: 'metro'      },
  { id: 'dist_up_gorakhpur',      stateId: 'uttar_pradesh', name: 'Gorakhpur',    lat: 26.7606, lng: 83.3732, population: 4440895, healthTier: 'urban'      },
  { id: 'dist_up_bareilly',       stateId: 'uttar_pradesh', name: 'Bareilly',     lat: 28.3670, lng: 79.4304, population: 4448359, healthTier: 'urban'      },
  { id: 'dist_up_aligarh',        stateId: 'uttar_pradesh', name: 'Aligarh',      lat: 27.8974, lng: 78.0880, population: 3673889, healthTier: 'urban'      },
  { id: 'dist_up_ghaziabad',      stateId: 'uttar_pradesh', name: 'Ghaziabad',    lat: 28.6692, lng: 77.4538, population: 4681645, healthTier: 'metro'      },
  { id: 'dist_up_moradabad',      stateId: 'uttar_pradesh', name: 'Moradabad',    lat: 28.8386, lng: 78.7733, population: 4772006, healthTier: 'urban'      },
  { id: 'dist_up_mathura',        stateId: 'uttar_pradesh', name: 'Mathura',      lat: 27.4924, lng: 77.6737, population: 2547184, healthTier: 'semi_urban' },
  { id: 'dist_up_sitapur',        stateId: 'uttar_pradesh', name: 'Sitapur',      lat: 27.5637, lng: 80.6833, population: 4474446, healthTier: 'rural'      },
  { id: 'dist_up_ballia',         stateId: 'uttar_pradesh', name: 'Ballia',       lat: 25.7588, lng: 84.1483, population: 3239774, healthTier: 'rural'      },
  { id: 'dist_up_sonbhadra',      stateId: 'uttar_pradesh', name: 'Sonbhadra',    lat: 24.6872, lng: 83.0576, population: 1862559, healthTier: 'tribal'     },

  // ══════════════════════════════════════════════════════════════════════════
  // UTTARAKHAND
  // ══════════════════════════════════════════════════════════════════════════
  { id: 'dist_uk_dehradun',       stateId: 'uttarakhand', name: 'Dehradun',     lat: 30.3165, lng: 78.0322, population: 1696694, healthTier: 'metro'      },
  { id: 'dist_uk_haridwar',       stateId: 'uttarakhand', name: 'Haridwar',     lat: 29.9457, lng: 78.1642, population: 1890422, healthTier: 'urban'      },
  { id: 'dist_uk_nainital',       stateId: 'uttarakhand', name: 'Nainital',     lat: 29.3803, lng: 79.4636, population: 954605,  healthTier: 'semi_urban' },
  { id: 'dist_uk_udham_singh',    stateId: 'uttarakhand', name: 'Udham Singh Nagar', lat: 28.9990, lng: 79.5130, population: 1648902, healthTier: 'semi_urban' },
  { id: 'dist_uk_almora',         stateId: 'uttarakhand', name: 'Almora',       lat: 29.5971, lng: 79.6591, population: 622506,  healthTier: 'rural'      },
  { id: 'dist_uk_pithoragarh',    stateId: 'uttarakhand', name: 'Pithoragarh',  lat: 29.5830, lng: 80.2186, population: 485993,  healthTier: 'rural'      },
  { id: 'dist_uk_chamoli',        stateId: 'uttarakhand', name: 'Chamoli',      lat: 30.4038, lng: 79.3189, population: 391605,  healthTier: 'rural'      },

  // ══════════════════════════════════════════════════════════════════════════
  // WEST BENGAL
  // ══════════════════════════════════════════════════════════════════════════
  { id: 'dist_wb_kolkata',        stateId: 'west_bengal', name: 'Kolkata',          lat: 22.5726, lng: 88.3639, population: 4486679,  healthTier: 'metro'      },
  { id: 'dist_wb_north_24_pgs',   stateId: 'west_bengal', name: 'North 24 Parganas', lat: 22.8600, lng: 88.5900, population: 10009781, healthTier: 'urban'      },
  { id: 'dist_wb_south_24_pgs',   stateId: 'west_bengal', name: 'South 24 Parganas', lat: 22.0500, lng: 88.5900, population: 8161961,  healthTier: 'semi_urban' },
  { id: 'dist_wb_burdwan',        stateId: 'west_bengal', name: 'Paschim Bardhaman', lat: 23.2324, lng: 87.0753, population: 2882031,  healthTier: 'urban'      },
  { id: 'dist_wb_murshidabad',    stateId: 'west_bengal', name: 'Murshidabad',      lat: 24.1832, lng: 88.2468, population: 7103807,  healthTier: 'rural'      },
  { id: 'dist_wb_howrah',         stateId: 'west_bengal', name: 'Howrah',           lat: 22.5958, lng: 88.2636, population: 4841638,  healthTier: 'metro'      },
  { id: 'dist_wb_darjeeling',     stateId: 'west_bengal', name: 'Darjeeling',       lat: 27.0360, lng: 88.2627, population: 1846823,  healthTier: 'semi_urban' },
  { id: 'dist_wb_jalpaiguri',     stateId: 'west_bengal', name: 'Jalpaiguri',       lat: 26.5425, lng: 88.7185, population: 3869675,  healthTier: 'rural'      },
  { id: 'dist_wb_purulia',        stateId: 'west_bengal', name: 'Purulia',          lat: 23.3312, lng: 86.3661, population: 2930115,  healthTier: 'rural'      },
  { id: 'dist_wb_cooch_behar',    stateId: 'west_bengal', name: 'Cooch Behar',      lat: 26.3452, lng: 89.4450, population: 2822780,  healthTier: 'rural'      },

  // ══════════════════════════════════════════════════════════════════════════
  // ANDAMAN & NICOBAR ISLANDS (UT)
  // ══════════════════════════════════════════════════════════════════════════
  { id: 'dist_an_south_andaman',  stateId: 'andaman_nicobar', name: 'South Andaman',  lat: 11.7401,  lng: 92.6586, population: 238142, healthTier: 'urban'  },
  { id: 'dist_an_north_middle',   stateId: 'andaman_nicobar', name: 'North and Middle Andaman', lat: 12.8500, lng: 92.8000, population: 105613, healthTier: 'rural' },
  { id: 'dist_an_nicobar',        stateId: 'andaman_nicobar', name: 'Nicobar',        lat: 7.0000,   lng: 93.7333, population: 36842,  healthTier: 'tribal' },

  // ══════════════════════════════════════════════════════════════════════════
  // CHANDIGARH (UT)
  // ══════════════════════════════════════════════════════════════════════════
  { id: 'dist_ch_chandigarh',     stateId: 'chandigarh', name: 'Chandigarh', lat: 30.7333, lng: 76.7794, population: 1055450, healthTier: 'metro' },

  // ══════════════════════════════════════════════════════════════════════════
  // DADRA & NAGAR HAVELI AND DAMAN & DIU (UT)
  // ══════════════════════════════════════════════════════════════════════════
  { id: 'dist_dd_dadra',          stateId: 'dadra_nagar_haveli', name: 'Dadra and Nagar Haveli', lat: 20.1809, lng: 73.0169, population: 342853, healthTier: 'semi_urban' },
  { id: 'dist_dd_daman',          stateId: 'dadra_nagar_haveli', name: 'Daman',                  lat: 20.3974, lng: 72.8328, population: 191173, healthTier: 'semi_urban' },
  { id: 'dist_dd_diu',            stateId: 'dadra_nagar_haveli', name: 'Diu',                    lat: 20.7144, lng: 70.9874, population: 52074,  healthTier: 'rural'      },

  // ══════════════════════════════════════════════════════════════════════════
  // DELHI (UT)
  // ══════════════════════════════════════════════════════════════════════════
  { id: 'dist_dl_central',        stateId: 'delhi', name: 'Central Delhi',       lat: 28.6508, lng: 77.2271, population: 582320,  healthTier: 'metro' },
  { id: 'dist_dl_east',           stateId: 'delhi', name: 'East Delhi',          lat: 28.6272, lng: 77.2923, population: 1709346, healthTier: 'metro' },
  { id: 'dist_dl_new_delhi',      stateId: 'delhi', name: 'New Delhi',           lat: 28.6139, lng: 77.2090, population: 142004,  healthTier: 'metro' },
  { id: 'dist_dl_north',          stateId: 'delhi', name: 'North Delhi',         lat: 28.7041, lng: 77.1025, population: 887978,  healthTier: 'metro' },
  { id: 'dist_dl_north_east',     stateId: 'delhi', name: 'North East Delhi',    lat: 28.6886, lng: 77.3059, population: 2228584, healthTier: 'metro' },
  { id: 'dist_dl_north_west',     stateId: 'delhi', name: 'North West Delhi',    lat: 28.7491, lng: 77.0753, population: 3656035, healthTier: 'metro' },
  { id: 'dist_dl_south',          stateId: 'delhi', name: 'South Delhi',         lat: 28.5355, lng: 77.2100, population: 2731929, healthTier: 'metro' },
  { id: 'dist_dl_south_east',     stateId: 'delhi', name: 'South East Delhi',    lat: 28.5667, lng: 77.3025, population: 1732967, healthTier: 'metro' },
  { id: 'dist_dl_south_west',     stateId: 'delhi', name: 'South West Delhi',    lat: 28.5706, lng: 77.0512, population: 2292958, healthTier: 'metro' },
  { id: 'dist_dl_west',           stateId: 'delhi', name: 'West Delhi',          lat: 28.6500, lng: 77.0500, population: 2543243, healthTier: 'metro' },
  { id: 'dist_dl_shahdara',       stateId: 'delhi', name: 'Shahdara',            lat: 28.6809, lng: 77.2906, population: 1984418, healthTier: 'metro' },

  // ══════════════════════════════════════════════════════════════════════════
  // JAMMU & KASHMIR (UT)
  // ══════════════════════════════════════════════════════════════════════════
  { id: 'dist_jk_srinagar',       stateId: 'jammu_kashmir', name: 'Srinagar',   lat: 34.0837, lng: 74.7973, population: 1273312, healthTier: 'metro'      },
  { id: 'dist_jk_jammu',          stateId: 'jammu_kashmir', name: 'Jammu',      lat: 32.7266, lng: 74.8570, population: 1529958, healthTier: 'metro'      },
  { id: 'dist_jk_anantnag',       stateId: 'jammu_kashmir', name: 'Anantnag',   lat: 33.7311, lng: 75.1487, population: 1078692, healthTier: 'semi_urban' },
  { id: 'dist_jk_baramulla',      stateId: 'jammu_kashmir', name: 'Baramulla',  lat: 34.2073, lng: 74.3436, population: 1015503, healthTier: 'semi_urban' },
  { id: 'dist_jk_pulwama',        stateId: 'jammu_kashmir', name: 'Pulwama',    lat: 33.8740, lng: 74.8959, population: 570060,  healthTier: 'rural'      },
  { id: 'dist_jk_kupwara',        stateId: 'jammu_kashmir', name: 'Kupwara',    lat: 34.5206, lng: 74.2572, population: 875958,  healthTier: 'rural'      },
  { id: 'dist_jk_rajouri',        stateId: 'jammu_kashmir', name: 'Rajouri',    lat: 33.3778, lng: 74.3107, population: 642415,  healthTier: 'rural'      },
  { id: 'dist_jk_poonch',         stateId: 'jammu_kashmir', name: 'Poonch',     lat: 33.7726, lng: 74.0931, population: 476835,  healthTier: 'rural'      },

  // ══════════════════════════════════════════════════════════════════════════
  // LADAKH (UT)
  // ══════════════════════════════════════════════════════════════════════════
  { id: 'dist_la_leh',            stateId: 'ladakh', name: 'Leh',    lat: 34.1526, lng: 77.5771, population: 133487, healthTier: 'rural'  },
  { id: 'dist_la_kargil',         stateId: 'ladakh', name: 'Kargil', lat: 34.5539, lng: 76.1349, population: 140802, healthTier: 'rural'  },

  // ══════════════════════════════════════════════════════════════════════════
  // LAKSHADWEEP (UT)
  // ══════════════════════════════════════════════════════════════════════════
  { id: 'dist_ld_lakshadweep',    stateId: 'lakshadweep', name: 'Lakshadweep', lat: 10.5667, lng: 72.6417, population: 64473, healthTier: 'rural' },

  // ══════════════════════════════════════════════════════════════════════════
  // PUDUCHERRY (UT)
  // ══════════════════════════════════════════════════════════════════════════
  { id: 'dist_py_puducherry',     stateId: 'puducherry', name: 'Puducherry', lat: 11.9416, lng: 79.8083, population: 950289, healthTier: 'urban'      },
  { id: 'dist_py_karaikal',       stateId: 'puducherry', name: 'Karaikal',   lat: 10.9254, lng: 79.8380, population: 200222, healthTier: 'semi_urban' },
  { id: 'dist_py_mahe',           stateId: 'puducherry', name: 'Mahe',       lat: 11.7022, lng: 75.5358, population: 41816,  healthTier: 'semi_urban' },
  { id: 'dist_py_yanam',          stateId: 'puducherry', name: 'Yanam',      lat: 16.7330, lng: 82.2130, population: 55616,  healthTier: 'rural'      },
];

// ---------------------------------------------------------------------------
// Derived lookup maps (built once at module load; O(1) access)
// ---------------------------------------------------------------------------

/** @internal Fast lookup map: stateId → IndiaState */
const STATE_BY_ID = new Map<string, IndiaState>(
  INDIA_STATES.map((s) => [s.id, s])
);

/** @internal Fast lookup map: districtId → IndiaDistrict */
const DISTRICT_BY_ID = new Map<string, IndiaDistrict>(
  INDIA_DISTRICTS.map((d) => [d.id, d])
);

/** @internal Fast lookup map: stateId → IndiaDistrict[] */
const DISTRICTS_BY_STATE = new Map<string, IndiaDistrict[]>();
for (const district of INDIA_DISTRICTS) {
  const list = DISTRICTS_BY_STATE.get(district.stateId) ?? [];
  list.push(district);
  DISTRICTS_BY_STATE.set(district.stateId, list);
}

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

/**
 * Returns all districts belonging to a given state/UT.
 *
 * @param stateId - The {@link IndiaState.id} of the state/UT.
 * @returns Array of matching districts, or empty array if none found.
 *
 * @example
 * const jhkDistricts = getDistrictsByState('jharkhand');
 */
export function getDistrictsByState(stateId: string): IndiaDistrict[] {
  return DISTRICTS_BY_STATE.get(stateId) ?? [];
}

/**
 * Looks up a state/UT by its unique identifier.
 *
 * @param id - The {@link IndiaState.id} to look up.
 * @returns The matching {@link IndiaState}, or `undefined` if not found.
 *
 * @example
 * const state = getStateById('west_bengal');
 * // → { id: 'west_bengal', name: 'West Bengal', ... }
 */
export function getStateById(id: string): IndiaState | undefined {
  return STATE_BY_ID.get(id);
}

/**
 * Looks up a district by its unique identifier.
 *
 * @param id - The {@link IndiaDistrict.id} to look up.
 * @returns The matching {@link IndiaDistrict}, or `undefined` if not found.
 *
 * @example
 * const dist = getDistrictById('dist_jhk_hazaribagh');
 * // → { id: 'dist_jhk_hazaribagh', name: 'Hazaribagh', lat: 23.9975, ... }
 */
export function getDistrictById(id: string): IndiaDistrict | undefined {
  return DISTRICT_BY_ID.get(id);
}

/**
 * Searches districts by name using a case-insensitive substring match.
 * Supports fuzzy-ish matching by normalising the query (trim + lowercase).
 *
 * @param query - Partial or full district name to search for.
 * @returns Array of {@link IndiaDistrict} whose names contain the query string.
 *
 * @example
 * searchDistricts('ranchi');   // → [{ name: 'Ranchi', ... }]
 * searchDistricts('SINGHBHUM'); // → East Singhbhum, West Singhbhum
 * searchDistricts('');         // → all districts (empty query matches all)
 */
export function searchDistricts(query: string): IndiaDistrict[] {
  const normalised = query.trim().toLowerCase();
  if (normalised.length === 0) {
    return [...INDIA_DISTRICTS];
  }
  return INDIA_DISTRICTS.filter((d) =>
    d.name.toLowerCase().includes(normalised)
  );
}
