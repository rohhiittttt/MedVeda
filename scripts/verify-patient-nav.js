import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const targetOut = path.join(os.tmpdir(), 'doctor_visits_verified.png');

console.log('Capturing screenshot of Doctor Visits (#feature2)...');
try {
  execFileSync(chromePath, [
    '--headless=new',
    '--user-data-dir=' + path.join(os.tmpdir(), 'chrome-temp-doctor-cap'),
    '--screenshot=' + targetOut,
    '--window-size=1440,900',
    'http://localhost:3000/#feature2'
  ], { timeout: 10000 });
  console.log('Captured screenshot successfully to:', targetOut);
} catch (err) {
  console.error('Capture error:', err.message);
}
