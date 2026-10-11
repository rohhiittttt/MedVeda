import { execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outputDir = path.resolve('./');
const targetOut = path.join(outputDir, 'patient_portal_verified.png');

console.log('Capturing screenshot of Patient Portal (#overview)...');
try {
  execFileSync(chromePath, [
    '--headless=new',
    '--user-data-dir=' + path.resolve('./chrome-temp-patient'),
    '--virtual-time-budget=4000',
    `--screenshot=${targetOut}`,
    '--window-size=1440,2800',
    'http://localhost:3000/#overview'
  ]);
  console.log('Captured screenshot successfully to:', targetOut);
} catch (err) {
  console.error('Capture error:', err.message);
}
