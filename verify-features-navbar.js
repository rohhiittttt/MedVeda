import { execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outputDir = 'C:\\Users\\rohit das\\.gemini\\antigravity\\brain\\89c37105-27b4-4eaa-b958-9ae07ece7ef6';
const tempUserDataDir = path.join(process.cwd(), 'chrome-temp-test');

if (!fs.existsSync(tempUserDataDir)) {
  fs.mkdirSync(tempUserDataDir, { recursive: true });
}

const targets = [
  { name: 'screen_features_overview.png', url: 'http://localhost:3000/#overview', size: '1366,900' },
  { name: 'screen_features_feature1.png', url: 'http://localhost:3000/#feature1', size: '1366,900' },
  { name: 'screen_features_feature9.png', url: 'http://localhost:3000/#feature9', size: '1366,900' }
];

for (const target of targets) {
  const outPath = path.join(outputDir, target.name);
  console.log(`Capturing ${target.name} from ${target.url}...`);
  try {
    execFileSync(chromePath, [
      '--headless=new',
      `--user-data-dir=${tempUserDataDir}`,
      '--virtual-time-budget=4000',
      `--screenshot=${outPath}`,
      `--window-size=${target.size}`,
      target.url
    ]);
    console.log(`Saved: ${target.name} (${fs.statSync(outPath).size} bytes)`);
  } catch (err) {
    console.error(`Error capturing ${target.name}:`, err.message);
  }
}
