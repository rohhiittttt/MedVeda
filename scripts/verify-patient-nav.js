import { execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outputDir = path.resolve('./');
const targetOut = path.join(outputDir, 'doctor_visits_verified.png');

console.log('Capturing screenshot of Doctor Visits (#feature2)...');
try {
  execFileSync(chromePath, [
    '--headless=new',
    '--user-data-dir=' + path.resolve('./chrome-temp-doctor-cap'),
    '--screenshot=' + targetOut,
    '--window-size=1440,900',
    'http://localhost:3000/#feature2'
  ], { timeout: 10000 });
  console.log('Captured screenshot successfully to:', targetOut);
} catch (err) {
  console.error('Capture error:', err.message);
}
