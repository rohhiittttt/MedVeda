import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from 'sucrase';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const appJsPath = path.resolve(__dirname, '../frontend/public/app.js');
let code = fs.readFileSync(appJsPath, 'utf8');

// 1. Sync MediBot initial language state
const oldInit = `const [selectedLanguage, setSelectedLanguage] = useState('en'); // Strict single-language: 'en' or 'hi'`;
const newInit = `const [selectedLanguage, setSelectedLanguage] = useState(() => (typeof window !== 'undefined' && window.__medvedaCurrentLang) ? window.__medvedaCurrentLang : 'en');`;

if (code.includes(oldInit)) {
  code = code.replace(oldInit, newInit);
  console.log('Updated MediBot selectedLanguage initial state');
}

// 2. Add event listener in MediBot to sync when medvedaLanguageChanged fires
const oldCleanup = `  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (syncPulseTimeoutRef.current) clearTimeout(syncPulseTimeoutRef.current);
    };
  }, []);`;

const newCleanup = `  // Synchronize MediBot with site-wide language changes
  useEffect(() => {
    const handleSiteLangChanged = (e) => {
      const newL = e.detail?.lang;
      if (newL && newL !== selectedLanguage) {
        setSelectedLanguage(newL);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === 'msg-init' ? getMediBotInitMessage(newL, activeLocation) : m
          )
        );
      }
    };
    window.addEventListener('medvedaLanguageChanged', handleSiteLangChanged);
    return () => window.removeEventListener('medvedaLanguageChanged', handleSiteLangChanged);
  }, [selectedLanguage, activeLocation]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (syncPulseTimeoutRef.current) clearTimeout(syncPulseTimeoutRef.current);
    };
  }, []);`;

if (code.includes(oldCleanup)) {
  code = code.replace(oldCleanup, newCleanup);
  console.log('Added medvedaLanguageChanged listener to MediBot');
}

// 3. Make MediBot's handleLanguageChange trigger window.__setMedvedaSiteLanguage
const oldMediBotHandler = `  // Switch language strictly without mixing languages in the welcome card or UI
  const handleLanguageChange = (nextLang) => {
    if (nextLang === selectedLanguage) return;
    setSelectedLanguage(nextLang);
    setMessages((prev) =>
      prev.map((m) =>
        m.id === 'msg-init' ? getMediBotInitMessage(nextLang, activeLocation) : m
      )
    );
  };`;

const newMediBotHandler = `  // Switch language strictly without mixing languages in the welcome card or UI
  const handleLanguageChange = (nextLang) => {
    if (nextLang === selectedLanguage) return;
    setSelectedLanguage(nextLang);
    if (typeof window !== 'undefined' && window.__setMedvedaSiteLanguage) {
      window.__setMedvedaSiteLanguage(nextLang);
    }
    setMessages((prev) =>
      prev.map((m) =>
        m.id === 'msg-init' ? getMediBotInitMessage(nextLang, activeLocation) : m
      )
    );
  };`;

if (code.includes(oldMediBotHandler)) {
  code = code.replace(oldMediBotHandler, newMediBotHandler);
  console.log('Updated MediBot handleLanguageChange to sync global site language');
}

fs.writeFileSync(appJsPath, code, 'utf8');

// Compile app.js -> app.compiled.js
console.log('Compiling app.js -> app.compiled.js with sucrase...');
const compiled = transform(code, { transforms: ['jsx'] });
const outCompiledPath = path.resolve(__dirname, '../frontend/public/app.compiled.js');
fs.writeFileSync(outCompiledPath, compiled.code, 'utf8');
console.log('Successfully compiled app.compiled.js (' + compiled.code.length + ' bytes)');
