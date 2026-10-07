import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from 'sucrase';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputPath = path.join(__dirname, 'public', 'app.js');
const outputPath = path.join(__dirname, 'public', 'app.compiled.js');

const inputCode = fs.readFileSync(inputPath, 'utf8');
const result = transform(inputCode, { transforms: ['jsx'] });

const rootOutputPath = path.join(__dirname, '..', 'app.compiled.js');

fs.writeFileSync(outputPath, result.code, 'utf8');
fs.writeFileSync(rootOutputPath, result.code, 'utf8');
console.log('Successfully compiled app.js -> app.compiled.js (' + result.code.length + ' bytes)');

// Also sync images to root for Live Server support
const publicDir = path.join(__dirname, 'public');
const rootDir = path.join(__dirname, '..');
const files = fs.readdirSync(publicDir);
for (const file of files) {
  if (file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg') || file.endsWith('.svg') || file.endsWith('.ico')) {
    fs.copyFileSync(path.join(publicDir, file), path.join(rootDir, file));
  }
}

