import { execFileSync } from 'node:child_process';
import path from 'node:path';

import os from 'node:os';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const targetStep1 = path.join(os.tmpdir(), 'doctor_visits_step1.png');

console.log('Capturing Doctor Visits Step 1...');
try {
  execFileSync(chromePath, [
    '--headless=new',
    '--user-data-dir=' + path.join(os.tmpdir(), 'chrome-temp-doctor-test'),
    '--virtual-time-budget=3000',
    `--screenshot=${targetStep1}`,
    '--window-size=1440,900',
    'http://localhost:3000/#feature2'
  ]);
  console.log('Saved:', targetStep1);
} catch (err) {
  console.error('Capture error:', err.message);
}
