// MedVeda Vercel Serverless API Handler
// Provides reliable, instant mock data for live demos and presentations

export default function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const url = req.url || '';
  const cleanPath = url.split('?')[0].replace(/^\/api/, '');

  // 1. Geolocation / Reverse Geocode
  if (cleanPath.includes('/geocode/reverse')) {
    return res.status(200).json({
      success: true,
      data: {
        formattedLocation: 'Hazaribagh District Hospital Area, Jharkhand',
        city: 'Hazaribagh',
        district: 'Hazaribagh',
        state: 'Jharkhand',
        pincode: '825301',
        latitude: 23.9925,
        longitude: 85.3637
      }
    });
  }

  // 2. OPD / Facilities list
  if (cleanPath === '/v1/facilities' || cleanPath.includes('/facilities')) {
    return res.status(200).json({
      success: true,
      count: 4,
      data: [
        {
          id: 'DHJ01',
          code: 'DHJ01',
          name: 'Hazaribagh Sadar Hospital',
          type: 'District Hospital',
          district: 'Hazaribagh',
          state: 'Jharkhand',
          beds: 250,
          active: true,
          phone: '+91-6546-264244',
          smsCode: 'DHJ'
        },
        {
          id: 'CHCI02',
          code: 'CHCI02',
          name: 'Ichaak Community Health Centre',
          type: 'CHC',
          district: 'Hazaribagh',
          state: 'Jharkhand',
          beds: 50,
          active: true,
          phone: '+91-6546-271012',
          smsCode: 'CHCI'
        },
        {
          id: 'RIMS01',
          code: 'RIMS01',
          name: 'Rajendra Institute of Medical Sciences (RIMS)',
          type: 'Tertiary Medical College',
          district: 'Ranchi',
          state: 'Jharkhand',
          beds: 1500,
          active: true,
          phone: '+91-651-2541533',
          smsCode: 'RIMS'
        },
        {
          id: 'AIIMS01',
          code: 'AIIMS01',
          name: 'AIIMS Deoghar',
          type: 'Apex Healthcare & Research',
          district: 'Deoghar',
          state: 'Jharkhand',
          beds: 750,
          active: true,
          phone: '+91-6432-298011',
          smsCode: 'AIIMS'
        }
      ]
    });
  }

  // 3. OPD Sessions / Slots
  if (cleanPath.includes('/sessions')) {
    return res.status(200).json({
      success: true,
      count: 3,
      data: [
        {
          sessionId: 'SES-MORN-01',
          facilityCode: 'DHJ01',
          department: 'General Medicine',
          doctorName: 'Dr. Sameer Verma',
          sessionDate: new Date().toISOString().split('T')[0],
          timeSlot: '09:00 AM - 01:00 PM',
          availableTokens: 18,
          totalTokens: 50,
          room: 'OPD Room 104'
        },
        {
          sessionId: 'SES-EVE-02',
          facilityCode: 'DHJ01',
          department: 'Pediatrics',
          doctorName: 'Dr. Priya Sharma',
          sessionDate: new Date().toISOString().split('T')[0],
          timeSlot: '02:00 PM - 05:00 PM',
          availableTokens: 12,
          totalTokens: 35,
          room: 'OPD Room 108'
        },
        {
          sessionId: 'SES-CARD-03',
          facilityCode: 'DHJ01',
          department: 'Cardiology',
          doctorName: 'Dr. Ananya Roy',
          sessionDate: new Date().toISOString().split('T')[0],
          timeSlot: '10:00 AM - 02:00 PM',
          availableTokens: 8,
          totalTokens: 25,
          room: 'OPD Room 210'
        }
      ]
    });
  }

  // 4. OPD Bookings / Appointments
  if (cleanPath.includes('/bookings')) {
    const randomId = Math.floor(1000 + Math.random() * 9000);
    const tokenNo = 'A-' + Math.floor(10 + Math.random() * 40);
    return res.status(200).json({
      success: true,
      message: 'Booking confirmed successfully',
      data: {
        bookingId: `BK-2026-${randomId}`,
        trackingId: `MED-HZ-${randomId}`,
        tokenNumber: tokenNo,
        facility: 'Hazaribagh Sadar Hospital',
        department: 'General Medicine',
        doctor: 'Dr. Sameer Verma',
        queueStatus: 'CONFIRMED',
        estimatedTime: '10:30 AM',
        date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
      }
    });
  }

  // 5. Triage Assessment & Screening
  if (cleanPath.includes('/triage/')) {
    return res.status(200).json({
      success: true,
      data: {
        triageLevel: 'Yellow',
        urgency: 'Moderate Priority',
        recommendedSpecialty: 'Internal Medicine / Cardiology',
        recommendedFacility: 'Hazaribagh Sadar Hospital',
        distanceKm: 4.2,
        actionAdvice: 'Visit District Hospital OPD within 24 hours. Keep vitals monitored.',
        redFlagsDetected: false
      }
    });
  }

  // 6. Teleconsultation Queue / Booking
  if (cleanPath.includes('/teleconsult/')) {
    return res.status(200).json({
      success: true,
      data: {
        sessionId: 'TC-SES-9921',
        queuePosition: 2,
        estimatedWaitMinutes: 4,
        doctor: {
          name: 'Dr. Ananya Roy',
          specialty: 'Cardiologist',
          hospital: 'RIMS Ranchi (Tele-Specialist)',
          avatar: './doctor-ananya.jpg'
        },
        status: 'IN_QUEUE'
      }
    });
  }

  // 7. Referrals
  if (cleanPath.includes('/referrals')) {
    return res.status(200).json({
      success: true,
      data: [
        {
          referralId: 'REF-HZ-2026-001',
          patientName: 'Anita Devi',
          age: 58,
          fromFacility: 'Ichaak CHC',
          toFacility: 'Hazaribagh Sadar Hospital',
          specialty: 'Cardiology',
          priority: 'HIGH',
          status: 'ACCEPTED',
          reason: 'Severe hypertensive urgency with atypical chest discomfort',
          createdDate: new Date().toISOString()
        }
      ]
    });
  }

  // 8. Follow-up plans
  if (cleanPath.includes('/followups')) {
    return res.status(200).json({
      success: true,
      data: [
        {
          planId: 'FUP-2026-088',
          patientName: 'Anita Devi',
          condition: 'Type-2 Diabetes & Hypertension',
          nextCheckup: 'In 7 days',
          ashaAssigned: 'Sunita Devi (Ichaak Sector 2)',
          adherenceRate: '94%',
          status: 'ACTIVE'
        }
      ]
    });
  }

  // 9. District Admin Command Center
  if (cleanPath.includes('/command-center')) {
    return res.status(200).json({
      success: true,
      data: {
        district: 'Hazaribagh',
        totalFacilities: 24,
        activeDoctors: 118,
        todayOpdFootfall: 1420,
        bedOccupancyRate: '72%',
        activeReferrals: 18,
        medicineStockHealth: '96% Adequate',
        lastUpdated: new Date().toLocaleTimeString('en-IN')
      }
    });
  }

  // 10. Default / Fallback for any other API route
  return res.status(200).json({
    success: true,
    message: 'MedVeda Serverless API OK',
    endpoint: cleanPath,
    data: []
  });
}
