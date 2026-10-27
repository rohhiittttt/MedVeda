import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const stringsPath = path.resolve(__dirname, '../frontend/extracted_strings.json');
const outPath = path.resolve(__dirname, '../frontend/translations_hi.json');

const strings = JSON.parse(fs.readFileSync(stringsPath, 'utf8'));

// Load existing dictionary if already generated
let dict = {};
if (fs.existsSync(outPath)) {
  try {
    dict = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  } catch (e) {}
}

// Extract existing translations from app.js
const appJsPath = path.resolve(__dirname, '../frontend/public/app.js');
const appJs = fs.readFileSync(appJsPath, 'utf8');
const match = appJs.match(/const MEDVEDA_TRANSLATIONS\s*=\s*\{([\s\S]*?)\};/);
if (match) {
  try {
    const fn = new Function('return {' + match[1] + '}');
    const existing = fn();
    Object.assign(dict, existing);
    console.log('Loaded existing MEDVEDA_TRANSLATIONS count:', Object.keys(existing).length);
  } catch (e) {
    console.warn('Could not parse existing MEDVEDA_TRANSLATIONS:', e.message);
  }
}

const missing = strings.filter(s => {
  const trimmed = s.trim();
  if (!trimmed || dict[trimmed]) return false;
  // Skip pure numbers/symbols
  if (!/[a-zA-Z]/.test(trimmed)) return false;
  return true;
});

console.log('Total extracted:', strings.length, '| Already translated:', Object.keys(dict).length, '| Missing to translate:', missing.length);

async function translateBatch(batch) {
  const sep = '\n<<<>>>\n';
  const joined = batch.join(sep);
  try {
    const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=hi&dt=t&q=' + encodeURIComponent(joined);
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const data = await res.json();
    const fullText = (data && data[0]) ? data[0].map(s => s[0]).join('') : '';
    const parts = fullText.split(/<<<\s*>>>/);
    if (parts.length === batch.length) {
      batch.forEach((t, i) => {
        dict[t] = parts[i].trim();
      });
      return true;
    }
  } catch (e) {
    // console.warn('Batch error:', e.message);
  }

  // Fallback individual
  await Promise.all(batch.map(async (t) => {
    try {
      const u = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=hi&dt=t&q=' + encodeURIComponent(t);
      const r = await fetch(u, { signal: AbortSignal.timeout(4000) });
      const d = await r.json();
      const v = (d && d[0]) ? d[0].map(s => s[0]).join('').trim() : t;
      dict[t] = v;
    } catch (err) {
      dict[t] = t;
    }
  }));
  return true;
}

async function run() {
  const BATCH_SIZE = 25;
  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const chunk = missing.slice(i, i + BATCH_SIZE);
    await translateBatch(chunk);
    process.stdout.write(`\rProgress: ${Math.min(i + BATCH_SIZE, missing.length)} / ${missing.length} (${Object.keys(dict).length} translated)`);
    // Save checkpoint every 200 items
    if (i % 200 === 0) {
      fs.writeFileSync(outPath, JSON.stringify(dict, null, 2), 'utf8');
    }
    // Small delay to be polite
    await new Promise(r => setTimeout(r, 80));
  }
  fs.writeFileSync(outPath, JSON.stringify(dict, null, 2), 'utf8');
  console.log('\nFinished! Total Hindi dictionary entries:', Object.keys(dict).length);
}

run();
