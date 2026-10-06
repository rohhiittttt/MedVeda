const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, '..', 'frontend', 'public', 'app.js');
let content = fs.readFileSync(appJsPath, 'utf8');

// 1. Update featureItems in Header to include Module 09
const feature9Item = `    {
      id: 'feature9',
      code: 'Module 09',
      icon: '🛰️',
      label: 'District Command Center',
      description: 'Pan-India surveillance, shortage forecasts & outbreak warnings',
      onSelect: () => setView('feature9')
    },
  ];`;

if (!content.includes("'feature9'")) {
  content = content.replace(
    /\{\s*id:\s*'feature8'[\s\S]*?onSelect:\s*\(\)\s*=>\s*setView\('feature8'\)\s*\}\s*\];/,
    (match) => {
      return match.replace('];', '') + feature9Item;
    }
  );
  console.log('Added feature9 to Header featureItems');
}

// 2. Update 8 Systems to 9 Systems in Header dropdown
content = content.replace('8 Systems', '9 Systems');
content = content.replace('7 Systems', '9 Systems');

// 3. Update ScreenHomepage feature list
const homeFeature9 = `    {
      id: 'feature9',
      code: 'Module 09',
      icon: '🛰️',
      title: 'District Admin Command Center',
      description: 'Pan-India multi-hospital live surveillance, shortage forecasting, epidemic early warning (CDC EARS/CUSUM), and inter-hospital transfer coordination.',
      actionLabel: 'Command Center',
      action: () => setView('feature9'),
      badge: 'Surveillance & Logistics'
    }
  ];`;

if (!content.includes("title: 'District Admin Command Center'")) {
  content = content.replace(
    /\{\s*id:\s*'feature8'[\s\S]*?action:\s*onLaunchFeature8,[\s\S]*?badge:\s*'Affordable Care'\s*\}\s*\];/,
    (match) => {
      return match.replace('];', '') + homeFeature9;
    }
  );
  console.log('Added feature9 to ScreenHomepage');
}

// 4. Update parseHash in App to recognize feature9 and command-center
if (!content.includes("hash === '#feature9'")) {
  content = content.replace(
    "hash === '#feature8' ||",
    "hash === '#feature9' ||\n      hash === '#command-center' ||\n      hash === '#district-admin' ||\n      hash === '#command' ||\n      hash === '#feature8' ||"
  );
  console.log('Added feature9 to parseHash');
}

// 5. Update view routing in App
const appViewRouting = `        {/* VIEW 9: FEATURE 08 — AI GOVERNMENT HEALTH SCHEME FINDER */}
        {view === 'feature8' && (
          <ScreenSchemeFinder
            actorRole={actorRole}
            setActorRole={setActorRole}
            onBackToHome={() => setView('home')}
            onNavigateToCareNavigator={() => {
              setView('feature1');
              setScreen(1);
            }}
            onNavigateToTeleconsult={() => {
              setView('feature2');
              setTeleconsultScreen('entry');
            }}
            onNavigateToReferrals={() => setView('feature3')}
            onNavigateToRecords={() => setView('feature5')}
            triageContext={triageResult}
            patientContext={patient}
          />
        )}

        {/* VIEW 10: FEATURE 09 — DISTRICT ADMIN COMMAND CENTER (MV-DAC) */}
        {view === 'feature9' && (
          <ScreenCommandCenter
            actorRole={actorRole}
            setActorRole={setActorRole}
            onBackToHome={() => setView('home')}
            onNavigateToFacilityDashboard={() => setView('feature7')}
            onNavigateToSchemeFinder={() => setView('feature8')}
          />
        )}`;

if (!content.includes("<ScreenCommandCenter")) {
  content = content.replace(
    /\{\/\* VIEW 9: FEATURE 08 — AI GOVERNMENT HEALTH SCHEME FINDER \*\/\}[\s\S]*?patientContext=\{patient\}\s*\/>\s*\)\}/,
    appViewRouting
  );
  console.log('Added ScreenCommandCenter to App view router');
}

fs.writeFileSync(appJsPath, content, 'utf8');
console.log('Updated app.js navigation structure successfully');
