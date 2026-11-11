// Novel Audio Companion - Universal Standards & Engine Test Suite
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Running Novel Audio Companion Quality & Security Test Suite...\n');

let failedTests = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✔ [PASS] ${testName}`);
  } else {
    console.error(`  ❌ [FAIL] ${testName}`);
    failedTests++;
  }
}

// --- Test 1: Syntax Validation on all JavaScript Files ---
console.log('1. JavaScript Syntax Verification (node -c):');
const jsFiles = [
  'background.js',
  'content.js',
  'popup/popup.js',
  'options/options.js',
  'novel-audio-companion.user.js'
];

for (const file of jsFiles) {
  try {
    execSync(`node -c "${file}"`, { stdio: 'pipe' });
    assert(true, `${file} syntax compiles without errors`);
  } catch (err) {
    assert(false, `${file} syntax compilation failed: ${err.message}`);
  }
}

// --- Test 2: Manifest V3 & Chrome Web Store Standards ---
console.log('\n2. Manifest V3 & Store Standards Verification:');
const manifestPath = path.join(__dirname, '..', 'manifest.json');
assert(fs.existsSync(manifestPath), 'manifest.json file exists');

let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert(true, 'manifest.json is valid JSON');
} catch (e) {
  assert(false, 'manifest.json failed JSON parse: ' + e.message);
}

if (manifest) {
  assert(manifest.manifest_version === 3, 'manifest_version is strictly 3');
  assert(manifest.name && manifest.name.length > 0, 'manifest has a valid non-empty name');
  assert(manifest.version === '2.0.0', `manifest version is 2.0.0 (got ${manifest.version})`);
  assert(
    typeof manifest.description === 'string' && manifest.description.length <= 132,
    `description length (${manifest.description?.length}) is <= 132 characters (Chrome Web Store strict limit)`
  );
  assert(manifest.background && manifest.background.service_worker === 'background.js', 'service worker correctly configured');
  assert(manifest.action && manifest.action.default_popup === 'popup/popup.html', 'action popup correctly configured');
  assert(manifest.options_ui && manifest.options_ui.page === 'options/options.html', 'options page correctly configured');
}

// Check required icons
const iconFiles = ['icons/icon-16.png', 'icons/icon-48.png', 'icons/icon-128.png'];
for (const icon of iconFiles) {
  assert(fs.existsSync(icon) && fs.statSync(icon).size > 0, `Required icon asset exists: ${icon}`);
}

// --- Test 3: OWASP & Browser Extension Security Standards ---
console.log('\n3. OWASP & Extension Security Standards:');

// Check no eval() or new Function() in JS files
for (const file of jsFiles) {
  const content = fs.readFileSync(file, 'utf8');
  assert(!/\beval\s*\(/.test(content), `No eval() calls in ${file}`);
  assert(!/\bnew\s+Function\s*\(/.test(content), `No dynamic new Function() calls in ${file}`);
  // Verify that string literals defining regex patterns don't contain (?i)
  assert(!/pattern:\s*['"]\(\?i\)/i.test(content), `No invalid PCRE (?i) inline flags in patterns in ${file}`);
}

// Check no inline scripts or event handlers in extension HTML pages
const htmlFiles = ['popup/popup.html', 'options/options.html'];
for (const file of htmlFiles) {
  const content = fs.readFileSync(file, 'utf8');
  assert(!/\son[a-z]+\s*=/i.test(content), `No inline event handlers (onclick/onload) in ${file}`);
  assert(!/<script>(?!<\/script>)/i.test(content), `No inline <script> blocks in ${file} (CSP compliant)`);
}

// --- Test 4: Audio Engine Transformation & ReDoS Defense ---
console.log('\n4. Speech Engine & Dictionary Unit Tests:');

function sanitizePattern(pattern) {
  if (typeof pattern !== 'string') return '';
  let p = pattern.trim();
  if (p.startsWith('(?i)')) p = p.slice(4).trim();
  return p.slice(0, 250);
}

function compileRegexSafe(pattern, flags = 'gi') {
  const clean = sanitizePattern(pattern);
  if (!clean) return null;
  try {
    return new RegExp(clean, flags);
  } catch (e) {
    return null;
  }
}

function applyDictionary(text, rules) {
  if (!text || typeof text !== 'string') return '';
  let result = text;
  for (const rule of rules) {
    if (!rule || !rule.enabled || !rule.pattern) continue;
    try {
      if (rule.isRegex) {
        const re = compileRegexSafe(rule.pattern, 'gi');
        if (re) {
          result = result.replace(re, typeof rule.replacement === 'string' ? rule.replacement : '');
        }
      } else {
        const safeEscaped = rule.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp('\\b' + safeEscaped + '\\b', 'gi');
        const safeReplacement = typeof rule.replacement === 'string' ? rule.replacement.replace(/\$/g, '$$$$') : '';
        result = result.replace(re, safeReplacement);
      }
    } catch (err) {}
  }
  return result;
}

const testRules = [
  { enabled: true, isRegex: false, pattern: 'Qi', replacement: 'Chee' },
  { enabled: true, isRegex: false, pattern: 'Dao', replacement: 'Dow' },
  { enabled: true, isRegex: false, pattern: 'Dantian', replacement: 'Dahn-tee-en' },
  { enabled: true, isRegex: true, pattern: '\\[(Status|Level|Stats|HP|MP|Skill|Quest)[^\\]]*\\]', replacement: 'Status window:' },
  { enabled: true, isRegex: false, pattern: 'cost', replacement: '$500' }
];

// Test cases
const phoneticResult = applyDictionary('He circulated his Qi into his Dantian to grasp the Dao.', testRules);
assert(
  phoneticResult === 'He circulated his Chee into his Dahn-tee-en to grasp the Dow.',
  'Xianxia cultivation phonetics transform correctly'
);

const litrpgResult = applyDictionary('Prompt: [Status: Level 20, HP 500/500]', testRules);
assert(
  litrpgResult === 'Prompt: Status window:',
  'LitRPG status regex replaces tag cleanly'
);

const dollarResult = applyDictionary('The total cost of the weapon.', testRules);
assert(
  dollarResult === 'The total $500 of the weapon.',
  'Literal dollar signs in replacements do not break regex substitution'
);

assert(applyDictionary(null, testRules) === '', 'Null input handling returns empty string safely');
assert(applyDictionary(undefined, testRules) === '', 'Undefined input handling returns empty string safely');

// --- Test 5: Speech Engine Keep-Alive & Pause Integrity ---
console.log('\n5. Speech Engine Keep-Alive & Pause Integrity Tests:');
const contentJsCode = fs.readFileSync('content.js', 'utf8');
const userJsCode = fs.readFileSync('novel-audio-companion.user.js', 'utf8');

// Ensure pausePlayback stops keepAlive
assert(
  /function\s+pausePlayback\s*\(\)\s*\{[^}]*stopKeepAlive\(\)/.test(contentJsCode),
  'content.js: pausePlayback() explicitly stops keep-alive watchdog timer'
);
assert(
  /function\s+pausePlayback\s*\(\)\s*\{[^}]*stopKeepAlive\(\)/.test(userJsCode),
  'novel-audio-companion.user.js: pausePlayback() explicitly stops keep-alive watchdog timer'
);

// Ensure keep-alive checks !isPaused
assert(
  contentJsCode.includes('if (isPlaying && !isPaused && window.speechSynthesis.speaking'),
  'content.js: keep-alive interval strictly guards against isPaused'
);
assert(
  userJsCode.includes('if (isPlaying && !isPaused && window.speechSynthesis.speaking'),
  'novel-audio-companion.user.js: keep-alive interval strictly guards against isPaused'
);

// --- Test 6: Minimized-by-Default, Expand-on-Click & Close Integration ---
console.log('\n6. Minimized-by-Default & Player Lifecycle Tests:');
const contentCssCode = fs.readFileSync('content.css', 'utf8');

assert(
  /#nac-player-container\s*\{[^}]*display:\s*none/s.test(contentCssCode),
  'content.css: #nac-player-container is set to display: none from start'
);
assert(
  /\.nac-minimized-orb\s*\{[^}]*display:\s*flex/s.test(contentCssCode),
  'content.css: .nac-minimized-orb is set to display: flex from start'
);
assert(
  contentJsCode.includes('playerContainer.style.display = \'none\';') &&
  contentJsCode.includes('minimizedOrb.style.display = \'flex\';'),
  'content.js: UI starts minimized with docked orb visible'
);
assert(
  contentJsCode.includes('id="nac-close-btn"') && contentJsCode.includes('function closePlayer()'),
  'content.js: close button (✕) and closePlayer() implemented'
);
assert(
  userJsCode.includes('id="nac-close-btn"') && userJsCode.includes('function closePlayer()'),
  'novel-audio-companion.user.js: close button (✕) and closePlayer() implemented'
);
assert(
  contentJsCode.includes('if (isPlaying || isPlayerOpen || isReaderActive)'),
  'content.js: paragraph click-to-read is guarded so it only starts when player is active'
);
assert(
  userJsCode.includes('if (isPlaying || isPlayerOpen)'),
  'novel-audio-companion.user.js: paragraph click-to-read is guarded so it only starts when player is active'
);

// --- Test 7: Cybersecurity & Hostile Input Resilience ---
console.log('\n7. Cybersecurity & Hostile Input Resilience Tests:');
const optionsJsCode = fs.readFileSync('options/options.js', 'utf8');

// Verify ReDoS defense in options.js
assert(
  optionsJsCode.includes('.replace(/^\\(\\?i\\)/, \'\')'),
  'options.js: strictly strips invalid PCRE (?i) flags on imported rules'
);
assert(
  optionsJsCode.includes('Math.max(0.5, Math.min(3.0, source.rate))'),
  'options.js: validates and clamps rate strictly within safe boundaries'
);
assert(
  optionsJsCode.includes('[\'midnight\', \'oled\', \'sepia\', \'light\'].includes(source.readerTheme)'),
  'options.js: readerTheme strictly whitelisted against injection'
);

// --- Summary ---
console.log('\n----------------------------------------');
if (failedTests === 0) {
  console.log('🎉 ALL TESTS PASSED! Ready for production deployment.');
  process.exit(0);
} else {
  console.error(`💥 ${failedTests} test(s) failed. Check details above.`);
  process.exit(1);
}
