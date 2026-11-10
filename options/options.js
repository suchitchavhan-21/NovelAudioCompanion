// Novel Audio Companion - Options & Dictionary Controller
'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  // Navigation Tabs
  const navItems = document.querySelectorAll('.nac-nav-item');
  const tabPanels = document.querySelectorAll('.nac-tab-panel');
  const toastBanner = document.getElementById('nac-options-toast');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tabId = item.dataset.tab;
      navItems.forEach(n => n.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));

      item.classList.add('active');
      const targetPanel = document.getElementById(tabId);
      if (targetPanel) targetPanel.classList.add('active');
    });
  });

  function showToast(msg, isError = false) {
    toastBanner.textContent = msg;
    toastBanner.style.display = 'block';
    toastBanner.style.background = isError ? '#7f1d1d' : '#064e3b';
    toastBanner.style.borderColor = isError ? '#ef4444' : '#059669';
    toastBanner.style.color = isError ? '#fca5a5' : '#a7f3d0';

    setTimeout(() => {
      toastBanner.style.display = 'none';
    }, 3200);
  }

  // --- Fallback Defaults ---
  const defaults = {
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    voiceURI: '',
    autoNext: true,
    wordHighlight: true,
    sentencePauseMs: 120,
    paragraphPauseMs: 280,
    cleanAds: true,
    cleanComments: false,
    readerTheme: 'midnight',
    readerFont: 'serif',
    readerFontSize: 19,
    readerLineHeight: 1.8,
    readerMaxWidth: 760,
    dictionaryRules: [
      { id: '1', enabled: true, isRegex: false, pattern: 'Qi', replacement: 'Chee', category: 'xianxia' },
      { id: '2', enabled: true, isRegex: false, pattern: 'Dao', replacement: 'Dow', category: 'xianxia' },
      { id: '3', enabled: true, isRegex: false, pattern: 'Dantian', replacement: 'Dahn-tee-en', category: 'xianxia' },
      { id: '4', enabled: true, isRegex: false, pattern: 'Xianxia', replacement: 'Shee-ahn-shee-ah', category: 'xianxia' },
      { id: '5', enabled: true, isRegex: false, pattern: 'Wuxia', replacement: 'Woo-shee-ah', category: 'xianxia' },
      { id: '6', enabled: true, isRegex: false, pattern: 'Jianghu', replacement: 'Jee-ahng-hoo', category: 'xianxia' },
      { id: '7', enabled: true, isRegex: true, pattern: '\\[(Status|Level|Stats|HP|MP|Skill|Quest)[^\\]]*\\]', replacement: 'Status window:', category: 'litrpg' },
      { id: '8', enabled: true, isRegex: true, pattern: '(?:\\[|【)(?:Author\'s note|TL note|Editor\'s note)[^\\]】]*(?:\\]|】)', replacement: '', category: 'filters' },
      { id: '9', enabled: true, isRegex: true, pattern: '(?:tl\\/n|tl:|pr:|editor:).*$', replacement: '', category: 'filters' }
    ],
    filterRules: [
      { id: 'f1', enabled: true, pattern: 'stolen\\s+from\\s+royal\\s*road', isRegex: true },
      { id: 'f2', enabled: true, pattern: 'read\\s+only\\s+at\\s+[\\w.-]+', isRegex: true },
      { id: 'f3', enabled: true, pattern: 'report\\s+chapter', isRegex: true },
      { id: 'f4', enabled: true, pattern: '^[\\*\\-_=~#\\s]{3,}$', isRegex: true },
      { id: 'f5', enabled: true, pattern: 'support\\s+(?:me\\s+)?on\\s+patreon', isRegex: true }
    ],
    customSites: []
  };

  // --- Load Stored Settings Safely ---
  let stored = {};
  try {
    stored = await chrome.storage.sync.get(null);
  } catch (e) {
    console.debug('Storage sync error:', e);
  }

  let settings = { ...defaults, ...stored };

  // --- Voice Selection & Speech Engine Controls ---
  const voiceSelect = document.getElementById('nac-voice-dropdown');
  const btnPreviewVoice = document.getElementById('nac-btn-preview-voice');
  const rateSlider = document.getElementById('nac-rate-slider');
  const rateVal = document.getElementById('nac-rate-val');
  const pitchSlider = document.getElementById('nac-pitch-slider');
  const pitchVal = document.getElementById('nac-pitch-val');
  const volumeSlider = document.getElementById('nac-volume-slider');
  const volumeVal = document.getElementById('nac-volume-val');

  const sentencePauseSlider = document.getElementById('nac-sentence-pause');
  const sentenceVal = document.getElementById('nac-sentence-val');
  const paraPauseSlider = document.getElementById('nac-para-pause');
  const paraVal = document.getElementById('nac-para-val');

  const optHighlight = document.getElementById('nac-opt-highlight');
  const optAutoNext = document.getElementById('nac-opt-autonext');

  let voices = [];

  function loadVoices() {
    voices = window.speechSynthesis.getVoices() || [];
    if (!voices.length) return;

    voices.sort((a, b) => {
      const aNat = /natural|neural|online/i.test(a.name);
      const bNat = /natural|neural|online/i.test(b.name);
      if (aNat && !bNat) return -1;
      if (!aNat && bNat) return 1;

      const aEn = (a.lang || '').startsWith('en');
      const bEn = (b.lang || '').startsWith('en');
      if (aEn && !bEn) return -1;
      if (!aEn && bEn) return 1;

      return a.name.localeCompare(b.name);
    });

    voiceSelect.innerHTML = '';
    voices.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.voiceURI;
      let tag = '';
      if (/natural|neural/i.test(v.name)) tag = '✨ [Natural] ';
      else if (/online|google/i.test(v.name)) tag = '🌐 [Cloud] ';
      else tag = '💻 [Local] ';

      const cleanName = v.name.replace(/Microsoft /g, '').replace(/ Online \(Natural\)/g, '');
      opt.textContent = `${tag}${cleanName} (${v.lang})`;
      if (settings.voiceURI === v.voiceURI) {
        opt.selected = true;
      }
      voiceSelect.appendChild(opt);
    });
  }

  loadVoices();
  if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = loadVoices;
  }

  voiceSelect.addEventListener('change', async (e) => {
    settings.voiceURI = e.target.value;
    await chrome.storage.sync.set({ voiceURI: settings.voiceURI });
    showToast('Default voice updated');
  });

  rateSlider.value = settings.rate;
  rateVal.textContent = `${parseFloat(settings.rate).toFixed(2)}x`;
  rateSlider.addEventListener('input', async (e) => {
    const val = parseFloat(e.target.value);
    rateVal.textContent = `${val.toFixed(2)}x`;
    settings.rate = val;
    await chrome.storage.sync.set({ rate: val });
  });

  pitchSlider.value = settings.pitch;
  pitchVal.textContent = parseFloat(settings.pitch).toFixed(2);
  pitchSlider.addEventListener('input', async (e) => {
    const val = parseFloat(e.target.value);
    pitchVal.textContent = val.toFixed(2);
    settings.pitch = val;
    await chrome.storage.sync.set({ pitch: val });
  });

  volumeSlider.value = settings.volume;
  volumeVal.textContent = `${Math.round(settings.volume * 100)}%`;
  volumeSlider.addEventListener('input', async (e) => {
    const val = parseFloat(e.target.value);
    volumeVal.textContent = `${Math.round(val * 100)}%`;
    settings.volume = val;
    await chrome.storage.sync.set({ volume: val });
  });

  sentencePauseSlider.value = settings.sentencePauseMs;
  sentenceVal.textContent = `${settings.sentencePauseMs}ms`;
  sentencePauseSlider.addEventListener('input', async (e) => {
    const val = parseInt(e.target.value, 10);
    sentenceVal.textContent = `${val}ms`;
    settings.sentencePauseMs = val;
    await chrome.storage.sync.set({ sentencePauseMs: val });
  });

  paraPauseSlider.value = settings.paragraphPauseMs;
  paraVal.textContent = `${settings.paragraphPauseMs}ms`;
  paraPauseSlider.addEventListener('input', async (e) => {
    const val = parseInt(e.target.value, 10);
    paraVal.textContent = `${val}ms`;
    settings.paragraphPauseMs = val;
    await chrome.storage.sync.set({ paragraphPauseMs: val });
  });

  optHighlight.checked = Boolean(settings.wordHighlight);
  optHighlight.addEventListener('change', async (e) => {
    settings.wordHighlight = e.target.checked;
    await chrome.storage.sync.set({ wordHighlight: settings.wordHighlight });
    showToast(settings.wordHighlight ? 'Word tracking enabled' : 'Word tracking disabled');
  });

  optAutoNext.checked = Boolean(settings.autoNext);
  optAutoNext.addEventListener('change', async (e) => {
    settings.autoNext = e.target.checked;
    await chrome.storage.sync.set({ autoNext: settings.autoNext });
    showToast(settings.autoNext ? 'Auto-Next enabled' : 'Auto-Next disabled');
  });

  btnPreviewVoice.addEventListener('click', () => {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance('Welcome to Novel Audio Companion. Chapter one begins now.');
    const v = voices.find(voice => voice.voiceURI === voiceSelect.value);
    if (v) utterance.voice = v;
    utterance.rate = parseFloat(rateSlider.value);
    utterance.pitch = parseFloat(pitchSlider.value);
    utterance.volume = parseFloat(volumeSlider.value);
    window.speechSynthesis.speak(utterance);
  });

  // --- Pronunciation Dictionary Rules (XSS Safe DOM Rendering) ---
  const rulesTbody = document.getElementById('nac-rules-tbody');
  const ruleCountSpan = document.getElementById('nac-rule-count');
  const inputPattern = document.getElementById('nac-rule-pattern');
  const inputReplacement = document.getElementById('nac-rule-replacement');
  const inputIsRegex = document.getElementById('nac-rule-isregex');
  const btnAddRule = document.getElementById('nac-btn-add-rule');
  const btnClearRules = document.getElementById('nac-btn-clear-rules');

  const btnLoadXianxia = document.getElementById('nac-load-xianxia');
  const btnLoadLitrpg = document.getElementById('nac-load-litrpg');
  const btnLoadNotes = document.getElementById('nac-load-notes');

  const testInput = document.getElementById('nac-test-phrase');
  const testPreview = document.getElementById('nac-test-result-preview');
  const btnTestPhrase = document.getElementById('nac-btn-test-phrase');

  function renderDictionaryRules() {
    rulesTbody.innerHTML = '';
    const rules = Array.isArray(settings.dictionaryRules) ? settings.dictionaryRules : [];
    ruleCountSpan.textContent = rules.length.toString();

    rules.forEach((rule, idx) => {
      const tr = document.createElement('tr');

      // Checkbox cell
      const tdCheck = document.createElement('td');
      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.checked = Boolean(rule.enabled);
      chk.className = 'nac-rule-toggle';
      chk.addEventListener('change', async (e) => {
        settings.dictionaryRules[idx].enabled = e.target.checked;
        await chrome.storage.sync.set({ dictionaryRules: settings.dictionaryRules });
      });
      tdCheck.appendChild(chk);

      // Pattern cell
      const tdPattern = document.createElement('td');
      const code = document.createElement('code');
      code.textContent = rule.pattern || '';
      tdPattern.appendChild(code);

      // Replacement cell
      const tdRepl = document.createElement('td');
      const strong = document.createElement('strong');
      strong.textContent = rule.replacement || '';
      tdRepl.appendChild(strong);

      // Type badge
      const tdType = document.createElement('td');
      const badge = document.createElement('span');
      badge.className = `nac-type-badge ${rule.isRegex ? 'nac-type-regex' : ''}`;
      badge.textContent = rule.isRegex ? 'Regex' : 'Text';
      tdType.appendChild(badge);

      // Delete action
      const tdAction = document.createElement('td');
      const delBtn = document.createElement('button');
      delBtn.className = 'nac-btn-del';
      delBtn.textContent = '🗑️';
      delBtn.title = 'Delete rule';
      delBtn.addEventListener('click', async () => {
        settings.dictionaryRules.splice(idx, 1);
        await chrome.storage.sync.set({ dictionaryRules: settings.dictionaryRules });
        renderDictionaryRules();
        showToast('Rule removed');
      });
      tdAction.appendChild(delBtn);

      tr.append(tdCheck, tdPattern, tdRepl, tdType, tdAction);
      rulesTbody.appendChild(tr);
    });
  }

  renderDictionaryRules();

  btnAddRule.addEventListener('click', async () => {
    let pattern = inputPattern.value.trim().slice(0, 250);
    const replacement = inputReplacement.value.trim().slice(0, 250);
    const isRegex = inputIsRegex.checked;

    if (!pattern) {
      showToast('Please enter a target pattern', true);
      return;
    }

    if (isRegex) {
      if (pattern.startsWith('(?i)')) {
        pattern = pattern.slice(4).trim();
      }
      try {
        new RegExp(pattern, 'gi');
      } catch (err) {
        showToast('Invalid Regular Expression: ' + err.message, true);
        return;
      }
    }

    const newRule = {
      id: Date.now().toString(),
      enabled: true,
      pattern,
      replacement,
      isRegex
    };

    settings.dictionaryRules.push(newRule);
    await chrome.storage.sync.set({ dictionaryRules: settings.dictionaryRules });
    renderDictionaryRules();

    inputPattern.value = '';
    inputReplacement.value = '';
    inputIsRegex.checked = false;
    showToast('Rule added successfully!');
  });

  btnClearRules.addEventListener('click', async () => {
    if (confirm('Reset all pronunciation rules to default presets?')) {
      settings.dictionaryRules = JSON.parse(JSON.stringify(defaults.dictionaryRules));
      await chrome.storage.sync.set({ dictionaryRules: settings.dictionaryRules });
      renderDictionaryRules();
      showToast('Rules reset to defaults');
    }
  });

  btnLoadXianxia.addEventListener('click', async () => {
    const xianxiaRules = [
      { id: Date.now() + '1', enabled: true, isRegex: false, pattern: 'Qi', replacement: 'Chee' },
      { id: Date.now() + '2', enabled: true, isRegex: false, pattern: 'Dao', replacement: 'Dow' },
      { id: Date.now() + '3', enabled: true, isRegex: false, pattern: 'Dantian', replacement: 'Dahn-tee-en' },
      { id: Date.now() + '4', enabled: true, isRegex: false, pattern: 'Xianxia', replacement: 'Shee-ahn-shee-ah' },
      { id: Date.now() + '5', enabled: true, isRegex: false, pattern: 'Wuxia', replacement: 'Woo-shee-ah' },
      { id: Date.now() + '6', enabled: true, isRegex: false, pattern: 'Jianghu', replacement: 'Jee-ahng-hoo' }
    ];
    mergeRules(xianxiaRules, 'Xianxia cultivation rules added!');
  });

  btnLoadLitrpg.addEventListener('click', async () => {
    const litrpgRules = [
      { id: Date.now() + 'l1', enabled: true, isRegex: true, pattern: '\\[(Status|Level|Stats|HP|MP|Skill|Quest)[^\\]]*\\]', replacement: 'Status window:' },
      { id: Date.now() + 'l2', enabled: true, isRegex: true, pattern: '\\[Skill:\\s*([^\\]]+)\\]', replacement: 'Skill, $1.' }
    ];
    mergeRules(litrpgRules, 'LitRPG rules added!');
  });

  if (btnLoadNotes) {
    btnLoadNotes.addEventListener('click', async () => {
      const noteRules = [
        { id: Date.now() + 'n1', enabled: true, isRegex: true, pattern: '(?:\\[|【)(?:Author\'s note|TL note|Editor\'s note)[^\\]】]*(?:\\]|】)', replacement: '' },
        { id: Date.now() + 'n2', enabled: true, isRegex: true, pattern: '(?:tl\\/n|tl:|pr:|editor:).*$', replacement: '' }
      ];
      mergeRules(noteRules, 'Author and translation note filters added!');
    });
  }

  async function mergeRules(newRules, successMsg) {
    newRules.forEach(nr => {
      const exists = settings.dictionaryRules.some(r => r.pattern.toLowerCase() === nr.pattern.toLowerCase());
      if (!exists) settings.dictionaryRules.push(nr);
    });
    await chrome.storage.sync.set({ dictionaryRules: settings.dictionaryRules });
    renderDictionaryRules();
    showToast(successMsg);
  }

  // Pronunciation Playground
  function applyRulesToText(text) {
    let result = text;
    const rules = settings.dictionaryRules || [];
    for (const rule of rules) {
      if (!rule.enabled || !rule.pattern) continue;
      try {
        let pattern = rule.pattern;
        if (pattern.startsWith('(?i)')) pattern = pattern.slice(4).trim();
        if (rule.isRegex) {
          const re = new RegExp(pattern, 'gi');
          result = result.replace(re, rule.replacement || '');
        } else {
          const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const re = new RegExp(`\\b${escaped}\\b`, 'gi');
          result = result.replace(re, (rule.replacement || '').replace(/\$/g, '$$$$'));
        }
      } catch (e) {}
    }
    return result;
  }

  btnTestPhrase.addEventListener('click', () => {
    const raw = testInput.value;
    const transformed = applyRulesToText(raw);
    testPreview.textContent = `Transformed: "${transformed}"`;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(transformed);
    const v = voices.find(voice => voice.voiceURI === voiceSelect.value);
    if (v) utterance.voice = v;
    utterance.rate = parseFloat(rateSlider.value);
    utterance.pitch = parseFloat(pitchSlider.value);
    window.speechSynthesis.speak(utterance);
  });

  // --- Ad Killer & Content Filters ---
  const optCleanAds = document.getElementById('nac-opt-clean-ads');
  const optCleanComments = document.getElementById('nac-opt-clean-comments');
  const filtersTbody = document.getElementById('nac-filters-tbody');
  const inputFilterPattern = document.getElementById('nac-filter-pattern');
  const btnAddFilter = document.getElementById('nac-btn-add-filter');

  optCleanAds.checked = settings.cleanAds !== false;
  optCleanAds.addEventListener('change', async (e) => {
    settings.cleanAds = e.target.checked;
    await chrome.storage.sync.set({ cleanAds: settings.cleanAds });
    showToast('Ad cleaner preference saved');
  });

  optCleanComments.checked = Boolean(settings.cleanComments);
  optCleanComments.addEventListener('change', async (e) => {
    settings.cleanComments = e.target.checked;
    await chrome.storage.sync.set({ cleanComments: settings.cleanComments });
    showToast('Comments cleaner preference saved');
  });

  function renderFilterRules() {
    filtersTbody.innerHTML = '';
    const filters = Array.isArray(settings.filterRules) ? settings.filterRules : [];

    filters.forEach((f, idx) => {
      const tr = document.createElement('tr');

      const tdCheck = document.createElement('td');
      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.checked = Boolean(f.enabled);
      chk.className = 'nac-filter-toggle';
      chk.addEventListener('change', async (e) => {
        settings.filterRules[idx].enabled = e.target.checked;
        await chrome.storage.sync.set({ filterRules: settings.filterRules });
      });
      tdCheck.appendChild(chk);

      const tdPattern = document.createElement('td');
      const code = document.createElement('code');
      code.textContent = f.pattern || '';
      tdPattern.appendChild(code);

      const tdAction = document.createElement('td');
      const delBtn = document.createElement('button');
      delBtn.className = 'nac-btn-del';
      delBtn.textContent = '🗑️';
      delBtn.title = 'Delete filter';
      delBtn.addEventListener('click', async () => {
        settings.filterRules.splice(idx, 1);
        await chrome.storage.sync.set({ filterRules: settings.filterRules });
        renderFilterRules();
        showToast('Skip pattern removed');
      });
      tdAction.appendChild(delBtn);

      tr.append(tdCheck, tdPattern, tdAction);
      filtersTbody.appendChild(tr);
    });
  }

  renderFilterRules();

  btnAddFilter.addEventListener('click', async () => {
    let pat = inputFilterPattern.value.trim().slice(0, 250);
    if (!pat) return;

    if (pat.startsWith('(?i)')) pat = pat.slice(4).trim();
    try {
      new RegExp(pat, 'i');
    } catch (e) {
      showToast('Invalid Regex: ' + e.message, true);
      return;
    }

    settings.filterRules.push({
      id: Date.now().toString(),
      enabled: true,
      pattern: pat,
      isRegex: true
    });
    await chrome.storage.sync.set({ filterRules: settings.filterRules });
    renderFilterRules();
    inputFilterPattern.value = '';
    showToast('Skip pattern added!');
  });

  // --- Reader Mode Customizer ---
  const themeOptions = document.querySelectorAll('.nac-theme-option');
  const readerFontSelect = document.getElementById('nac-reader-font');
  const readerSizeSlider = document.getElementById('nac-reader-size');
  const readerSizeVal = document.getElementById('nac-size-val');
  const readerLineHeightSlider = document.getElementById('nac-reader-lineheight');
  const readerLineHeightVal = document.getElementById('nac-lineheight-val');
  const readerWidthSlider = document.getElementById('nac-reader-width');
  const readerWidthVal = document.getElementById('nac-width-val');
  const readerPreview = document.getElementById('nac-reader-preview');

  function updateReaderPreview() {
    readerPreview.style.fontSize = `${settings.readerFontSize}px`;
    readerPreview.style.lineHeight = settings.readerLineHeight;
    readerPreview.style.maxWidth = `${settings.readerMaxWidth}px`;

    if (settings.readerFont === 'serif') {
      readerPreview.style.fontFamily = 'Merriweather, Georgia, Cambria, serif';
    } else if (settings.readerFont === 'sans') {
      readerPreview.style.fontFamily = 'Atkinson Hyperlegible, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    } else if (settings.readerFont === 'inter') {
      readerPreview.style.fontFamily = 'Inter, -apple-system, sans-serif';
    } else if (settings.readerFont === 'dyslexic') {
      readerPreview.style.fontFamily = 'OpenDyslexic, Comic Sans MS, sans-serif';
    }

    themeOptions.forEach(opt => {
      opt.classList.toggle('active', opt.dataset.theme === settings.readerTheme);
    });

    if (settings.readerTheme === 'midnight') {
      readerPreview.style.background = '#090d16';
      readerPreview.style.color = '#e2e8f0';
      readerPreview.style.borderColor = 'rgba(255,255,255,0.1)';
    } else if (settings.readerTheme === 'oled') {
      readerPreview.style.background = '#000000';
      readerPreview.style.color = '#d1d5db';
      readerPreview.style.borderColor = '#222';
    } else if (settings.readerTheme === 'sepia') {
      readerPreview.style.background = '#fbf0d9';
      readerPreview.style.color = '#2c2317';
      readerPreview.style.borderColor = '#d6c7ab';
    } else if (settings.readerTheme === 'light') {
      readerPreview.style.background = '#ffffff';
      readerPreview.style.color = '#1e293b';
      readerPreview.style.borderColor = '#e2e8f0';
    }
  }

  themeOptions.forEach(opt => {
    opt.addEventListener('click', async () => {
      settings.readerTheme = opt.dataset.theme;
      await chrome.storage.sync.set({ readerTheme: settings.readerTheme });
      updateReaderPreview();
      showToast(`Theme changed to ${opt.querySelector('span').textContent}`);
    });
  });

  readerFontSelect.value = settings.readerFont;
  readerFontSelect.addEventListener('change', async (e) => {
    settings.readerFont = e.target.value;
    await chrome.storage.sync.set({ readerFont: settings.readerFont });
    updateReaderPreview();
  });

  readerSizeSlider.value = settings.readerFontSize;
  readerSizeVal.textContent = `${settings.readerFontSize}px`;
  readerSizeSlider.addEventListener('input', async (e) => {
    const val = parseInt(e.target.value, 10);
    readerSizeVal.textContent = `${val}px`;
    settings.readerFontSize = val;
    await chrome.storage.sync.set({ readerFontSize: val });
    updateReaderPreview();
  });

  readerLineHeightSlider.value = settings.readerLineHeight;
  readerLineHeightVal.textContent = parseFloat(settings.readerLineHeight).toFixed(1);
  readerLineHeightSlider.addEventListener('input', async (e) => {
    const val = parseFloat(e.target.value);
    readerLineHeightVal.textContent = val.toFixed(1);
    settings.readerLineHeight = val;
    await chrome.storage.sync.set({ readerLineHeight: val });
    updateReaderPreview();
  });

  readerWidthSlider.value = settings.readerMaxWidth;
  readerWidthVal.textContent = `${settings.readerMaxWidth}px`;
  readerWidthSlider.addEventListener('input', async (e) => {
    const val = parseInt(e.target.value, 10);
    readerWidthVal.textContent = `${val}px`;
    settings.readerMaxWidth = val;
    await chrome.storage.sync.set({ readerMaxWidth: val });
    updateReaderPreview();
  });

  updateReaderPreview();

  // --- Custom Sites Manager (Safe DOM Rendering) ---
  const customSitesTbody = document.getElementById('nac-custom-sites-tbody');
  const siteDomainInput = document.getElementById('nac-site-domain');
  const siteContentInput = document.getElementById('nac-site-content');
  const siteNextInput = document.getElementById('nac-site-next');
  const btnAddSite = document.getElementById('nac-btn-add-site');

  function renderCustomSites() {
    customSitesTbody.innerHTML = '';
    const sites = Array.isArray(settings.customSites) ? settings.customSites : [];

    if (sites.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 4;
      td.style.textAlign = 'center';
      td.style.color = '#64748b';
      td.textContent = 'No custom sites added. The universal extractor handles novel sites automatically.';
      tr.appendChild(td);
      customSitesTbody.appendChild(tr);
      return;
    }

    sites.forEach((s, idx) => {
      const tr = document.createElement('tr');

      const tdDomain = document.createElement('td');
      const strong = document.createElement('strong');
      strong.textContent = s.domain || '';
      tdDomain.appendChild(strong);

      const tdContent = document.createElement('td');
      const codeC = document.createElement('code');
      codeC.textContent = s.contentSelector || '';
      tdContent.appendChild(codeC);

      const tdNext = document.createElement('td');
      const codeN = document.createElement('code');
      codeN.textContent = s.nextSelector || '--';
      tdNext.appendChild(codeN);

      const tdAction = document.createElement('td');
      const delBtn = document.createElement('button');
      delBtn.className = 'nac-btn-del';
      delBtn.textContent = '🗑️';
      delBtn.addEventListener('click', async () => {
        settings.customSites.splice(idx, 1);
        await chrome.storage.sync.set({ customSites: settings.customSites });
        renderCustomSites();
        showToast('Custom site removed');
      });
      tdAction.appendChild(delBtn);

      tr.append(tdDomain, tdContent, tdNext, tdAction);
      customSitesTbody.appendChild(tr);
    });
  }

  renderCustomSites();

  btnAddSite.addEventListener('click', async () => {
    const domain = siteDomainInput.value.trim().toLowerCase().slice(0, 100);
    const contentSelector = siteContentInput.value.trim().slice(0, 200);
    const nextSelector = siteNextInput.value.trim().slice(0, 200);

    if (!domain || !contentSelector) {
      showToast('Domain and content selector are required', true);
      return;
    }

    // Verify selector validity safely
    try {
      document.querySelector(contentSelector);
    } catch (e) {
      showToast('Invalid CSS selector: ' + e.message, true);
      return;
    }

    settings.customSites.push({ domain, contentSelector, nextSelector });
    await chrome.storage.sync.set({ customSites: settings.customSites });
    renderCustomSites();

    siteDomainInput.value = '';
    siteContentInput.value = '';
    siteNextInput.value = '';
    showToast('Custom site rule saved!');
  });

  // --- Export & Import (Validated JSON Security) ---
  const btnExport = document.getElementById('nac-btn-export');
  const fileImport = document.getElementById('nac-file-import');

  btnExport.addEventListener('click', () => {
    const exportData = {
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      settings: {
        rate: settings.rate,
        pitch: settings.pitch,
        volume: settings.volume,
        voiceURI: settings.voiceURI,
        autoNext: settings.autoNext,
        wordHighlight: settings.wordHighlight,
        sentencePauseMs: settings.sentencePauseMs,
        paragraphPauseMs: settings.paragraphPauseMs,
        cleanAds: settings.cleanAds,
        cleanComments: settings.cleanComments,
        readerTheme: settings.readerTheme,
        readerFont: settings.readerFont,
        readerFontSize: settings.readerFontSize,
        readerLineHeight: settings.readerLineHeight,
        readerMaxWidth: settings.readerMaxWidth,
        dictionaryRules: settings.dictionaryRules,
        filterRules: settings.filterRules,
        customSites: settings.customSites
      }
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `novel-audio-settings-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
    showToast('Settings exported successfully');
  });

  fileImport.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 1024 * 512) { // Max 512 KB configuration payload
      showToast('File too large (exceeds 512 KB)', true);
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const rawJson = JSON.parse(event.target.result);
        const source = rawJson.settings ? rawJson.settings : rawJson;

        if (typeof source !== 'object' || source === null) {
          showToast('Invalid configuration file format', true);
          return;
        }

        // Whitelist valid schema fields only
        const allowedKeys = Object.keys(defaults);
        const sanitized = {};
        for (const key of allowedKeys) {
          if (source[key] !== undefined) {
            sanitized[key] = source[key];
          }
        }

        settings = { ...settings, ...sanitized };
        await chrome.storage.sync.set(settings);
        showToast('Settings imported successfully! Reloading...');
        setTimeout(() => location.reload(), 800);
      } catch (err) {
        showToast('Error parsing JSON file: ' + err.message, true);
      }
    };
    reader.readAsText(file);
  });
});
