import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform } from 'sucrase';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const appJsPath = path.resolve(__dirname, '../frontend/public/app.js');
let appCode = fs.readFileSync(appJsPath, 'utf8');

const hiDictPath = path.resolve(__dirname, '../frontend/translations_hi.json');
const regDictPath = path.resolve(__dirname, '../frontend/translations_regional.json');

const hiDict = JSON.parse(fs.readFileSync(hiDictPath, 'utf8'));
const regDict = JSON.parse(fs.readFileSync(regDictPath, 'utf8'));

console.log('Loaded Hindi terms:', Object.keys(hiDict).length);
console.log('Loaded Regional terms for languages:', Object.keys(regDict));

// Build replacement block for lines 1896 to 2222
const newTranslationEngine = `// ============================================================================
// MEDVEDA ADVANCED ENTERPRISE MULTILINGUAL ENGINE (HINDI & REGIONAL LANGUAGES)
// ============================================================================
const MEDVEDA_TRANSLATIONS = ${JSON.stringify(hiDict)};

const MEDVEDA_REGIONAL_TRANSLATIONS = ${JSON.stringify(regDict)};

// Pre-sort Hindi entries by descending length for high-precision phrase replacement
const SORTED_MEDVEDA_TRANSLATIONS = Object.entries(MEDVEDA_TRANSLATIONS)
  .filter(([k]) => k.length > 2)
  .sort((a, b) => b[0].length - a[0].length);

// In-memory runtime translation cache loaded from localStorage
let MEDVEDA_RUNTIME_CACHE = {};
if (typeof window !== 'undefined') {
  try {
    const saved = localStorage.getItem('medveda_i18n_cache');
    if (saved) MEDVEDA_RUNTIME_CACHE = JSON.parse(saved);
  } catch (e) {}
}

let pendingTranslationQueue = [];
let pendingTranslationTimeout = null;

function queueTextForTranslation(text, targetLang, targetNode, attrName, leading, trailing) {
  if (!text || !targetLang || targetLang === 'en' || !/[a-zA-Z]/.test(text)) return;
  pendingTranslationQueue.push({ text, targetLang, targetNode, attrName, leading, trailing });
  if (pendingTranslationTimeout) clearTimeout(pendingTranslationTimeout);
  pendingTranslationTimeout = setTimeout(flushTranslationBatch, 50);
}

async function flushTranslationBatch() {
  if (!pendingTranslationQueue.length) return;
  const currentBatch = pendingTranslationQueue;
  pendingTranslationQueue = [];

  const lang = (typeof window !== 'undefined' && window.__medvedaCurrentLang) ? window.__medvedaCurrentLang : 'en';
  if (lang === 'en') return;

  const uniqueTexts = Array.from(new Set(currentBatch.map(item => item.text)));
  const needed = uniqueTexts.filter(t => !MEDVEDA_RUNTIME_CACHE[\`\${lang}::\${t}\`]);

  if (needed.length > 0) {
    try {
      const resp = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: needed, targetLang: lang, sourceLang: 'en' })
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.translations) {
          for (const [enText, translated] of Object.entries(data.translations)) {
            MEDVEDA_RUNTIME_CACHE[\`\${lang}::\${enText}\`] = translated;
          }
          try {
            localStorage.setItem('medveda_i18n_cache', JSON.stringify(MEDVEDA_RUNTIME_CACHE));
          } catch (e) {}
        }
      }
    } catch (err) {
      // Graceful offline fallback
    }
  }

  // Apply translations to all queued nodes
  for (let i = 0; i < currentBatch.length; i++) {
    const item = currentBatch[i];
    const cached = MEDVEDA_RUNTIME_CACHE[\`\${item.targetLang}::\${item.text}\`];
    if (cached) {
      if (item.attrName === 'placeholder' && item.targetNode) {
        item.targetNode.placeholder = cached;
      } else if (item.attrName === 'title' && item.targetNode) {
        item.targetNode.title = cached;
      } else if (item.attrName === 'aria-label' && item.targetNode && item.targetNode.setAttribute) {
        item.targetNode.setAttribute('aria-label', cached);
      } else if (item.targetNode && item.targetNode.parentNode) {
        item.targetNode.nodeValue = item.leading + cached + item.trailing;
      }
    }
  }
}

function translateMedvedaText(text, targetLang = 'hi', targetNode = null, attrName = null) {
  if (!text || typeof text !== 'string') return text;
  if (!targetLang || targetLang === 'en') return text;

  const match = text.match(/^(\\s*)([\\s\\S]*?)(\\s*)$/);
  if (!match) return text;
  const leading = match[1];
  const core = match[2];
  const trailing = match[3];
  if (!core) return text;

  // 1. Direct dictionary match for Hindi
  if (targetLang === 'hi' && MEDVEDA_TRANSLATIONS[core]) {
    return leading + MEDVEDA_TRANSLATIONS[core] + trailing;
  }

  // 2. Direct dictionary match for regional languages
  if (MEDVEDA_REGIONAL_TRANSLATIONS[targetLang] && MEDVEDA_REGIONAL_TRANSLATIONS[targetLang][core]) {
    return leading + MEDVEDA_REGIONAL_TRANSLATIONS[targetLang][core] + trailing;
  }

  // 3. Runtime Cache (from on-the-fly translations)
  const cacheKey = \`\${targetLang}::\${core}\`;
  if (MEDVEDA_RUNTIME_CACHE[cacheKey]) {
    return leading + MEDVEDA_RUNTIME_CACHE[cacheKey] + trailing;
  }

  // 4. Queue for asynchronous batch translation if text contains letters
  if (/[a-zA-Z]/.test(core) && targetNode) {
    queueTextForTranslation(core, targetLang, targetNode, attrName, leading, trailing);
  }

  // 5. High-speed phrase replacement fallback for composite strings
  if (targetLang === 'hi') {
    let res = core;
    let replacedAny = false;
    for (let i = 0; i < SORTED_MEDVEDA_TRANSLATIONS.length; i++) {
      const enPhrase = SORTED_MEDVEDA_TRANSLATIONS[i][0];
      const hiPhrase = SORTED_MEDVEDA_TRANSLATIONS[i][1];
      if (enPhrase.length > 2 && res.includes(enPhrase)) {
        res = res.split(enPhrase).join(hiPhrase);
        replacedAny = true;
      }
    }
    if (replacedAny) {
      return leading + res + trailing;
    }
  }

  return leading + core + trailing;
}

// Global live DOM multilingual translator engine
if (typeof window !== 'undefined') {
  window.__medvedaCurrentLang = localStorage.getItem('medveda_site_lang') || 'en';

  window.__walkAndTranslateNodes = function (rootNode, targetLang) {
    if (!rootNode) return;
    const isEn = !targetLang || targetLang === 'en';

    // 1. Walk Text Nodes
    const walker = document.createTreeWalker(
      rootNode,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function (node) {
          if (!node || !node.nodeValue) return NodeFilter.FILTER_REJECT;
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName;
          if (
            ['SCRIPT', 'STYLE', 'INPUT', 'TEXTAREA', 'PRE', 'CODE', 'NOSCRIPT'].includes(tag) ||
            parent.closest('.notranslate') ||
            parent.closest('svg')
          ) {
            return NodeFilter.FILTER_REJECT;
          }
          if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      },
      false
    );

    let currentNode;
    while ((currentNode = walker.nextNode())) {
      if (currentNode._medvedaOrigText === undefined) {
        currentNode._medvedaOrigText = currentNode.nodeValue;
      }
      if (!isEn) {
        const translated = translateMedvedaText(currentNode._medvedaOrigText, targetLang, currentNode, 'text');
        if (translated && currentNode.nodeValue !== translated) {
          currentNode.nodeValue = translated;
        }
      } else {
        if (currentNode._medvedaOrigText && currentNode.nodeValue !== currentNode._medvedaOrigText) {
          currentNode.nodeValue = currentNode._medvedaOrigText;
        }
      }
    }

    // 2. Translate Input and Textarea Placeholders
    try {
      const inputs = rootNode.querySelectorAll ? rootNode.querySelectorAll('input[placeholder], textarea[placeholder]') : [];
      for (let i = 0; i < inputs.length; i++) {
        const input = inputs[i];
        if (input._medvedaOrigPlaceholder === undefined) {
          input._medvedaOrigPlaceholder = input.placeholder;
        }
        if (!isEn) {
          const translated = translateMedvedaText(input._medvedaOrigPlaceholder, targetLang, input, 'placeholder');
          if (translated && input.placeholder !== translated) {
            input.placeholder = translated;
          }
        } else if (input._medvedaOrigPlaceholder !== undefined) {
          input.placeholder = input._medvedaOrigPlaceholder;
        }
      }
    } catch (e) {}

    // 3. Translate Element Titles and Aria-Labels
    try {
      const titled = rootNode.querySelectorAll ? rootNode.querySelectorAll('[title], [aria-label]') : [];
      for (let i = 0; i < titled.length; i++) {
        const el = titled[i];
        if (el.title) {
          if (el._medvedaOrigTitle === undefined) {
            el._medvedaOrigTitle = el.title;
          }
          if (!isEn) {
            const translated = translateMedvedaText(el._medvedaOrigTitle, targetLang, el, 'title');
            if (translated && el.title !== translated) {
              el.title = translated;
            }
          } else if (el._medvedaOrigTitle !== undefined) {
            el.title = el._medvedaOrigTitle;
          }
        }
        const ariaLabel = el.getAttribute('aria-label');
        if (ariaLabel) {
          if (el._medvedaOrigAriaLabel === undefined) {
            el._medvedaOrigAriaLabel = ariaLabel;
          }
          if (!isEn) {
            const translated = translateMedvedaText(el._medvedaOrigAriaLabel, targetLang, el, 'aria-label');
            if (translated && ariaLabel !== translated) {
              el.setAttribute('aria-label', translated);
            }
          } else if (el._medvedaOrigAriaLabel !== undefined) {
            el.setAttribute('aria-label', el._medvedaOrigAriaLabel);
          }
        }
      }
    } catch (e) {}
  };

  window.__setMedvedaSiteLanguage = function (newLang) {
    const lang = newLang || 'en';
    window.__medvedaCurrentLang = lang;
    try {
      localStorage.setItem('medveda_site_lang', lang);
    } catch (e) {}
    if (document.documentElement) {
      document.documentElement.lang = lang;
    }
    if (document.body) {
      window.__walkAndTranslateNodes(document.body, lang);
    }
    window.dispatchEvent(new CustomEvent('medvedaLanguageChanged', { detail: { lang } }));
  };

  // Observe dynamically mounted elements and screens
  let domObserverTimeout = null;
  const medvedaObserver = new MutationObserver(function (mutations) {
    if (!window.__medvedaCurrentLang || window.__medvedaCurrentLang === 'en') return;
    if (domObserverTimeout) clearTimeout(domObserverTimeout);
    domObserverTimeout = setTimeout(function () {
      if (window.__medvedaCurrentLang && window.__medvedaCurrentLang !== 'en' && document.body) {
        window.__walkAndTranslateNodes(document.body, window.__medvedaCurrentLang);
      }
    }, 40);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      medvedaObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
      if (window.__medvedaCurrentLang && window.__medvedaCurrentLang !== 'en') {
        window.__setMedvedaSiteLanguage(window.__medvedaCurrentLang);
      }
    });
  } else if (document.body) {
    medvedaObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
    if (window.__medvedaCurrentLang && window.__medvedaCurrentLang !== 'en') {
      window.__setMedvedaSiteLanguage(window.__medvedaCurrentLang);
    }
  }
}`;

// Locate the start and end of the old translation block in appCode
const startMarker = '// ============================================================================';
const endMarker = 'function Header(';

const startIdx = appCode.indexOf('// MEDVEDA STRICT MULTILINGUAL SUPPORT (HINDI & ENGLISH) ENGINE');
if (startIdx === -1) {
  console.error('Could not find start of multilingual block in app.js');
  process.exit(1);
}
// Find the preceding '// ========' line
const blockStart = appCode.lastIndexOf(startMarker, startIdx);
const headerIdx = appCode.indexOf(endMarker, startIdx);

if (blockStart === -1 || headerIdx === -1) {
  console.error('Could not locate boundaries for translation block');
  process.exit(1);
}

// Slice and replace
appCode = appCode.slice(0, blockStart) + newTranslationEngine + '\n\n' + appCode.slice(headerIdx);
console.log('Replaced translation engine in app.js');

// Now update Header language dropdown
// Find SITE_LANGUAGES or update the dropdown in Header
const oldDropdownSnippet = `{/* Strictly Hindi and English Language Selector Dropdown */}`;
const dropdownStart = appCode.indexOf(oldDropdownSnippet);
if (dropdownStart !== -1) {
  // Find the end of this dropdown block
  const dropdownEnd = appCode.indexOf('{currentUser ? (', dropdownStart);
  if (dropdownEnd !== -1) {
    const newDropdown = `{/* Enterprise Multi-Language Selector Dropdown */}
          <div className="relative" ref={langDropdownRef}>
            <button
              type="button"
              onClick={() => setLangDropdownOpen(!langDropdownOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-50 rounded-md transition-colors border border-slate-300 cursor-pointer shadow-2xs select-none active:scale-95 touch-manipulation"
              title="Change Site Language / भाषा चुनें"
              aria-label="Language Selector"
              aria-expanded={langDropdownOpen}
            >
              <svg className="w-3.5 h-3.5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
              <span>{
                currentSiteLang === 'hi' ? 'हिन्दी (Hindi)' :
                currentSiteLang === 'bn' ? 'বাংলা (Bengali)' :
                currentSiteLang === 'mr' ? 'मराठी (Marathi)' :
                currentSiteLang === 'te' ? 'తెలుగు (Telugu)' :
                currentSiteLang === 'ta' ? 'தமிழ் (Tamil)' :
                currentSiteLang === 'gu' ? 'ગુજરાતી (Gujarati)' :
                'English'
              }</span>
              <svg className={\`w-3 h-3 text-slate-400 transition-transform \${langDropdownOpen ? 'rotate-180' : ''}\`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {langDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-44 bg-white rounded-lg border border-slate-200 shadow-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100 max-h-72 overflow-y-auto">
                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  Select Language / भाषा चुनें
                </div>
                {[
                  { code: 'en', label: 'English', native: 'English' },
                  { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
                  { code: 'bn', label: 'Bengali', native: 'বাংলা' },
                  { code: 'mr', label: 'Marathi', native: 'मराठी' },
                  { code: 'te', label: 'Telugu', native: 'తెలుగు' },
                  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
                  { code: 'gu', label: 'Gujarati', native: 'ગુજરાતી' }
                ].map((l) => (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => {
                      if (onLanguageChange) onLanguageChange(l.code);
                      else if (typeof window !== 'undefined' && window.__setMedvedaSiteLanguage) {
                        window.__setMedvedaSiteLanguage(l.code);
                      }
                      setLangDropdownOpen(false);
                    }}
                    className={\`w-full text-left px-3 py-2 text-xs flex items-center justify-between transition-colors cursor-pointer \${
                      currentSiteLang === l.code
                        ? 'bg-blue-50 text-[#0b2b82] font-bold'
                        : 'text-slate-700 hover:bg-slate-50 font-medium'
                    }\`}
                  >
                    <span>{l.native} <span className="text-[11px] text-slate-400 font-normal">({l.label})</span></span>
                    {currentSiteLang === l.code && (
                      <svg className="w-3.5 h-3.5 text-[#0b2b82]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          `;
    appCode = appCode.slice(0, dropdownStart) + newDropdown + appCode.slice(dropdownEnd);
    console.log('Updated Header dropdown in app.js');
  }
}

// Update handleLanguageChange in App root
const appLangHandlerOld = `  const handleLanguageChange = (newLang) => {
    const lang = (newLang === 'hi' ? 'hi' : 'en');
    setSiteLanguage(lang);
    try {
      localStorage.setItem('medveda_site_lang', lang);
    } catch (e) {}
    if (typeof window !== 'undefined' && window.__setMedvedaSiteLanguage) {
      window.__setMedvedaSiteLanguage(lang);
    }
  };`;

const appLangHandlerNew = `  const handleLanguageChange = (newLang) => {
    const lang = newLang || 'en';
    setSiteLanguage(lang);
    try {
      localStorage.setItem('medveda_site_lang', lang);
    } catch (e) {}
    if (typeof window !== 'undefined' && window.__setMedvedaSiteLanguage) {
      window.__setMedvedaSiteLanguage(lang);
    }
  };`;

if (appCode.includes(appLangHandlerOld)) {
  appCode = appCode.replace(appLangHandlerOld, appLangHandlerNew);
  console.log('Updated handleLanguageChange in App root');
} else {
  console.warn('Could not find exact handleLanguageChange match; checking regex');
  appCode = appCode.replace(/const handleLanguageChange\s*=\s*\(newLang\)\s*=>\s*\{[\s\S]*?const lang\s*=\s*\(newLang === 'hi' \? 'hi' : 'en'\);/, 'const handleLanguageChange = (newLang) => {\n    const lang = newLang || \'en\';');
}

fs.writeFileSync(appJsPath, appCode, 'utf8');
console.log('Successfully wrote updated app.js (' + appCode.length + ' bytes)');

// Run compile to app.compiled.js
console.log('Compiling app.js -> app.compiled.js with sucrase...');
const compiled = transform(appCode, { transforms: ['jsx'] });
const outCompiledPath = path.resolve(__dirname, '../frontend/public/app.compiled.js');
fs.writeFileSync(outCompiledPath, compiled.code, 'utf8');
console.log('Successfully compiled app.compiled.js (' + compiled.code.length + ' bytes)');
