import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

console.log('Capturing screens...');

// 1. Capture Entry screen
try {
  execFileSync(chrome, [
    '--headless=new',
    '--user-data-dir=' + path.join(os.tmpdir(), 'chrome-temp-test-doc1'),
    '--virtual-time-budget=3000',
    '--screenshot=' + path.join(os.tmpdir(), 'verify_doc_entry.png'),
    '--window-size=1440,900',
    'http://localhost:3000/#feature2'
  ]);
  console.log('Entry captured');
} catch (e) {
  console.error('Entry err:', e.message);
}
