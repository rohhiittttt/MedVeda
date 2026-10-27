import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const commonTerms = [
  'Home', 'Features', 'About Us', 'Log In', 'Sign Up', 'Log Out', 'Admin Login', 'Admin Console',
  'Doctor View', 'Patient View', 'Switch to Doctor View', 'Switch to Patient View',
  'Care Navigator', 'Smart Care Navigator', 'Teleconsult & Queue', 'Teleconsultation',
  'Smart Referrals', 'High-Risk Follow-Ups', 'Health Records (ABDM)', 'Health Records',
  'Medicine & Diagnostic Lab', 'Medicine Search & Shop', 'Diagnostic Lab & Orders',
  'Hospital Services', 'Facility Dashboard', 'Govt Health Schemes', 'District Command Center',
  'MediBot', 'Search', 'Filter', 'Submit', 'Cancel', 'Close', 'Confirm', 'Save',
  'Next', 'Previous', 'Back', 'Continue', 'Loading...', 'Please wait...',
  'Success', 'Error', 'Warning', 'Status', 'Active', 'Inactive', 'Verified',
  'Pending', 'Completed', 'Critical', 'Normal', 'High', 'Low', 'Distance',
  'Contact', 'Address', 'Hours', 'Date', 'Time', 'Age', 'Gender', 'Male', 'Female',
  'Other', 'Phone Number', 'Location', 'Blood Group', 'Emergency', 'Prescription',
  'Symptoms', 'Diagnosis', 'Medicines', 'Settings', 'Profile', 'Notifications',
  'Help', 'Feedback', 'Privacy Policy', 'Terms of Service', 'Contact Support',
  'Book Appointment', 'Start Health Check', 'View Health Records', 'Download Prescription',
  'Find Nearest Hospital', 'Symptom Checker', 'Call 108 Emergency Ambulance',
  'Call 104 Health Helpline', 'Emergency Care Available 24x7',
  'Making quality healthcare accessible', 'Making Quality Healthcare Accessible',
  'Autonomous Cognitive Health Network', 'Bridging the Gap in Rural Healthcare',
  'Healthcare Impact', 'Patients Served', 'Doctors Connected', 'Facilities Connected',
  'Average Rating', 'What Our Users Say', 'Testimonials'
];

async function translateBatchLang(batch, targetLang) {
  const sep = '\n<<<>>>\n';
  const joined = batch.join(sep);
  try {
    const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=' + targetLang + '&dt=t&q=' + encodeURIComponent(joined);
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    const data = await res.json();
    const fullText = (data && data[0]) ? data[0].map(s => s[0]).join('') : '';
    const parts = fullText.split(/<<<\s*>>>/);
    if (parts.length === batch.length) {
      const map = {};
      batch.forEach((t, i) => {
        map[t] = parts[i].trim();
      });
      return map;
    }
  } catch (e) {}

  const map = {};
  await Promise.all(batch.map(async (t) => {
    try {
      const u = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=' + targetLang + '&dt=t&q=' + encodeURIComponent(t);
      const r = await fetch(u, { signal: AbortSignal.timeout(3000) });
      const d = await r.json();
      map[t] = (d && d[0]) ? d[0].map(s => s[0]).join('').trim() : t;
    } catch (err) {
      map[t] = t;
    }
  }));
  return map;
}

async function main() {
  const regionalLangs = ['bn', 'mr', 'te', 'ta', 'gu'];
  const allRegional = {};

  for (const lang of regionalLangs) {
    console.log('Translating core UI for:', lang);
    const res = await translateBatchLang(commonTerms, lang);
    allRegional[lang] = res;
    console.log(`  Done ${lang}: ${Object.keys(res).length} terms`);
  }

  const outPath = path.resolve(__dirname, '../frontend/translations_regional.json');
  fs.writeFileSync(outPath, JSON.stringify(allRegional, null, 2), 'utf8');
  console.log('Saved to', outPath);
}

main();
