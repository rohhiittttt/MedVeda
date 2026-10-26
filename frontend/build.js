import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from 'sucrase';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputPath = path.join(__dirname, 'public', 'app.js');
const outputPath = path.join(__dirname, 'public', 'app.compiled.js');
const rootOutputPath = path.join(__dirname, '..', 'app.compiled.js');

const inputCode = fs.readFileSync(inputPath, 'utf8');
const result = transform(inputCode, { transforms: ['jsx'] });

fs.writeFileSync(outputPath, result.code, 'utf8');
try {
  fs.writeFileSync(rootOutputPath, result.code, 'utf8');
} catch (e) {
  // Ignore write errors to root
}
console.log('Successfully compiled app.js -> app.compiled.js (' + result.code.length + ' bytes)');
