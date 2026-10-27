import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const appJsPath = path.resolve(__dirname, '../frontend/public/app.js');
const content = fs.readFileSync(appJsPath, 'utf8');

// Find all text between tags >text<
const matches = content.match(/>([^<>{}\n\r]{2,120})</g) || [];
const texts = new Set();
for (const m of matches) {
  const str = m.slice(1, -1).trim();
  if (
    str.length > 1 &&
    !str.startsWith('http') &&
    !str.startsWith('data:') &&
    !str.includes('className') &&
    !str.includes('function') &&
    !str.includes('return') &&
    !str.includes('var ') &&
    !str.includes('const ') &&
    !str.includes('let ') &&
    !str.includes('=>') &&
    !str.includes('stroke') &&
    !str.includes('fill=') &&
    !str.includes('viewBox') &&
    !str.includes('xmlns') &&
    /[a-zA-Z]/.test(str)
  ) {
    texts.add(str);
  }
}

// Also find placeholder strings
const phRegex = /placeholder=["']([^"']+)["']/g;
let pm;
while ((pm = phRegex.exec(content)) !== null) {
  const str = pm[1].trim();
  if (str && /[a-zA-Z]/.test(str)) texts.add(str);
}

// Also find title strings
const titleRegex = /title=["']([^"']+)["']/g;
let tm;
while ((tm = titleRegex.exec(content)) !== null) {
  const str = tm[1].trim();
  if (str && str.length < 100 && /[a-zA-Z]/.test(str)) texts.add(str);
}

// Also find label/heading text
const labelRegex = /label=["']([^"']+)["']/g;
let lm;
while ((lm = labelRegex.exec(content)) !== null) {
  const str = lm[1].trim();
  if (str && str.length < 100 && /[a-zA-Z]/.test(str)) texts.add(str);
}

console.log('Clean extracted translatable strings count:', texts.size);
const arr = Array.from(texts);
const outPath = path.resolve(__dirname, '../frontend/extracted_strings.json');
fs.writeFileSync(outPath, JSON.stringify(arr, null, 2), 'utf8');
console.log('Saved to', outPath);
