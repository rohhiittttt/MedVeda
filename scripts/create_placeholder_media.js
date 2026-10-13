import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dir = path.join(__dirname, 'frontend', 'public', 'media');

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const svgs = {
  'item-01.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 560" width="100%" height="100%">
    <defs>
      <linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#f472b6"/>
        <stop offset="50%" stop-color="#ec4899"/>
        <stop offset="100%" stop-color="#be185d"/>
      </linearGradient>
      <radialGradient id="ball" cx="35%" cy="35%" r="65%">
        <stop offset="0%" stop-color="#fbcfe8"/>
        <stop offset="60%" stop-color="#f472b6"/>
        <stop offset="100%" stop-color="#db2777"/>
      </radialGradient>
    </defs>
    <rect width="400" height="560" fill="url(#g1)"/>
    <circle cx="160" cy="220" r="120" fill="url(#ball)" filter="drop-shadow(0 15px 25px rgba(0,0,0,0.25))"/>
    <path d="M80 180 Q160 260 240 180" stroke="#be185d" stroke-width="6" fill="none" opacity="0.6"/>
    <circle cx="270" cy="420" r="90" fill="url(#ball)" filter="drop-shadow(0 15px 25px rgba(0,0,0,0.25))"/>
    <path d="M210 390 Q270 450 330 390" stroke="#be185d" stroke-width="5" fill="none" opacity="0.6"/>
  </svg>`,

  'item-02.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 560" width="100%" height="100%">
    <defs>
      <linearGradient id="g2" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#e2e8f0"/>
        <stop offset="100%" stop-color="#cbd5e1"/>
      </linearGradient>
      <linearGradient id="visor" x1="0%" y1="50%" x2="100%" y2="50%">
        <stop offset="0%" stop-color="#fb7185"/>
        <stop offset="50%" stop-color="#f43f5e"/>
        <stop offset="100%" stop-color="#e11d48"/>
      </linearGradient>
    </defs>
    <rect width="400" height="560" fill="url(#g2)"/>
    <rect x="90" y="150" width="220" height="200" rx="60" fill="#0f172a"/>
    <rect x="110" y="210" width="180" height="75" rx="25" fill="url(#visor)" filter="drop-shadow(0 10px 15px rgba(225,29,72,0.4))"/>
  </svg>`,

  'item-03.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 560" width="100%" height="100%">
    <defs>
      <linearGradient id="g3" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#09090b"/>
        <stop offset="100%" stop-color="#18181b"/>
      </linearGradient>
      <radialGradient id="silver" cx="40%" cy="40%" r="60%">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="40%" stop-color="#e2e8f0"/>
        <stop offset="70%" stop-color="#94a3b8"/>
        <stop offset="100%" stop-color="#475569"/>
      </radialGradient>
    </defs>
    <rect width="400" height="560" fill="url(#g3)"/>
    <ellipse cx="200" cy="240" rx="75" ry="95" fill="url(#silver)" transform="rotate(-15 200 240)" filter="drop-shadow(0 20px 30px rgba(0,0,0,0.8))"/>
    <ellipse cx="130" cy="380" rx="50" ry="65" fill="url(#silver)" transform="rotate(25 130 380)" opacity="0.8"/>
    <ellipse cx="290" cy="150" rx="45" ry="60" fill="url(#silver)" transform="rotate(-35 290 150)" opacity="0.6"/>
  </svg>`,

  'item-04.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 560" width="100%" height="100%">
    <defs>
      <linearGradient id="g4" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#f1f5f9"/>
        <stop offset="100%" stop-color="#e2e8f0"/>
      </linearGradient>
    </defs>
    <rect width="400" height="560" fill="url(#g4)"/>
    <circle cx="200" cy="200" r="85" fill="#fbcfe8"/>
    <path d="M130 180 Q200 130 270 180 Q250 290 150 280 Z" fill="#1e293b"/>
    <rect x="150" y="190" width="40" height="20" rx="6" fill="#38bdf8"/>
    <rect x="210" y="190" width="40" height="20" rx="6" fill="#38bdf8"/>
    <rect x="190" y="197" width="20" height="4" fill="#0284c7"/>
    <path d="M110 370 L290 370 L270 560 L130 560 Z" fill="#1d4ed8"/>
  </svg>`,

  'item-05.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 560" width="100%" height="100%">
    <defs>
      <linearGradient id="g5" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#dc2626"/>
        <stop offset="100%" stop-color="#991b1b"/>
      </linearGradient>
    </defs>
    <rect width="400" height="560" fill="url(#g5)"/>
    <circle cx="200" cy="220" r="70" fill="#fed7aa"/>
    <path d="M135 190 Q200 130 265 190" fill="#f472b6"/>
    <rect x="130" y="180" width="140" height="16" rx="8" fill="#f472b6"/>
    <path d="M120 340 L280 340 L260 560 L140 560 Z" fill="#94a3b8"/>
  </svg>`,

  'item-06.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 560" width="100%" height="100%">
    <defs>
      <linearGradient id="g6" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#047857"/>
        <stop offset="50%" stop-color="#10b981"/>
        <stop offset="100%" stop-color="#064e3b"/>
      </linearGradient>
    </defs>
    <rect width="400" height="560" fill="#022c22"/>
    <path d="M100 350 C120 200, 280 180, 260 300 C240 400, 150 420, 160 320 C170 240, 230 260, 220 300" fill="none" stroke="url(#g6)" stroke-width="40" stroke-linecap="round" filter="drop-shadow(0 20px 25px rgba(0,0,0,0.5))"/>
    <circle cx="260" cy="180" r="24" fill="#38bdf8" filter="drop-shadow(0 10px 15px rgba(56,189,248,0.5))"/>
  </svg>`,

  'item-07.svg': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 560" width="100%" height="100%">
    <defs>
      <linearGradient id="g7" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#7f1d1d"/>
        <stop offset="100%" stop-color="#450a0a"/>
      </linearGradient>
      <linearGradient id="faceLight" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#ea580c"/>
        <stop offset="50%" stop-color="#c2410c"/>
        <stop offset="100%" stop-color="#7c2d12"/>
      </linearGradient>
    </defs>
    <rect width="400" height="560" fill="url(#g7)"/>
    <path d="M150 120 C180 100, 260 120, 260 200 C260 220, 290 260, 260 280 C270 300, 260 330, 240 350 C230 380, 210 400, 160 410 L150 560 L100 560 Z" fill="url(#faceLight)" filter="drop-shadow(0 20px 30px rgba(0,0,0,0.6))"/>
  </svg>`
};

for (const [name, content] of Object.entries(svgs)) {
  fs.writeFileSync(path.join(dir, name), content, 'utf8');
}

console.log('Successfully generated placeholder media in:', dir);
