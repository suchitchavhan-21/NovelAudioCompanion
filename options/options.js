// Novel Audio Companion - Options & Dictionary Controller

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
    }, 3500);
  }

  // --- Load Stored Settings ---
  let settings = await chrome.storage.sync.get(null);

  // Fallback defaults
  const defaults = {
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    voiceURI: '',
    autoNext: true,
    wordHighlight: true,
    sentencePauseMs: 120,
    paragraphPauseMs: 320,
    cleanAds: true,
    cleanComments: true,
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
      { id: '8', enabled: true, isRegex: true, pattern: '(?i)^Chapter\\s+([IVXLCDM]+):?', replacement: 'Chapter $1.', category: 'formatting' },
      { id: '9', enabled: true, isRegex: true, pattern: '(?i)(?:tl\\/n|tl:|pr:|editor:).*$', replacement: '', category: 'filters' }
    ],
    filterRules: [
      { id: 'f1', enabled: true, pattern: '(?i)stolen\\s+from\\s+royal\\s*road', isRegex: true },
      { id: 'f2', enabled: true, pattern: '(?i)read\\s+only\\s+at\\s+[\\w.-]+', isRegex: true },
      { id: 'f3', enabled: true, pattern: '(?i)report\\s+chapter', isRegex: true },
      { id: 'f4', enabled: true, pattern: '^[\\*\\-_=~#\\s]{3,}$', isRegex: true },
      { id: 'f5', enabled: true, pattern: '(?i)support\\s+me\\s+on\\s+patreon', isRegex: true }
    ],
    customSites: []
  };

  settings = { ...defaults, ...settings };

  // --- Voice Selection & Speech Engine ---
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
    voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return;

    // Sort voices: Natural/Online first, then English, then others
    voices.sort((a, b) => {
      const aNat = a.name.includes('Natural') || a.name.includes('Online') || a.name.includes('Neural');
      const bNat = b.name.includes('Natural') || b.name.includes('Online') || b.name.includes('Neural');
      if (aNat && !bNat) return -1;
      if (!aNat && bNat) return 1;

      const aEn = a.lang.startsWith('en');
      const bEn = b.lang.startsWith('en');
      if (aEn && !bEn) return -1;
      if (!aEn && bEn) return 1;

      return a.name.localeCompare(b.name);
    });

    voiceSelect.innerHTML = '';
    voices.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.voiceURI;
      let tag = '';
      if (v.name.includes('Natural') || v.name.includes('Neural')) tag = '✨ [Natural] ';
      else if (v.name.includes('Online') || v.name.includes('Google')) tag = '🌐 [Cloud] ';
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

  // Voice dropdown change
  voiceSelect.addEventListener('change', async (e) => {
    settings.voiceURI = e.target.value;
    await chrome.storage.sync.set({ voiceURI: settings.voiceURI });
    showToast('Default voice updated!');
  });

  // Sliders values
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

  optHighlight.checked = !!settings.wordHighlight;
  optHighlight.addEventListener('change', async (e) => {
    settings.wordHighlight = e.target.checked;
    await chrome.storage.sync.set({ wordHighlight: settings.wordHighlight });
    showToast(settings.wordHighlight ? 'Word tracking enabled' : 'Word tracking disabled');
  });

  optAutoNext.checked = !!settings.autoNext;
  optAutoNext.addEventListener('change', async (e) => {
    settings.autoNext = e.target.checked;
    await chrome.storage.sync.set({ autoNext: settings.autoNext });
    showToast(settings.autoNext ? 'Auto-Next chapter enabled' : 'Auto-Next disabled');
  });

  // Preview Voice Sample
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

  // --- Pronunciation Dictionary Rules ---
  const rulesTbody = document.getElementById('nac-rules-tbody');
  const ruleCountSpan = document.getElementById('nac-rule-count');
  const inputPattern = document.getElementById('nac-rule-pattern');
  const inputReplacement = document.getElementById('nac-rule-replacement');
  const inputIsRegex = document.getElementById('nac-rule-isregex');
  const btnAddRule = document.getElementById('nac-btn-add-rule');
  const btnClearRules = document.getElementById('nac-btn-clear-rules');

  const btnLoadXianxia = document.getElementById('nac-load-xianxia');
  const btnLoadLitrpg = document.getElementById('nac-load-litrpg');
  const btnLoadNumerals = document.getElementById('nac-load-numerals');

  const testInput = document.getElementById('nac-test-phrase');
  const testPreview = document.getElementById('nac-test-result-preview');
  const btnTestPhrase = document.getElementById('nac-btn-test-phrase');

  function renderDictionaryRules() {
    rulesTbody.innerHTML = '';
    const rules = settings.dictionaryRules || [];
    ruleCountSpan.textContent = rules.length.toString();

    rules.forEach((rule, idx) => {
      const tr = document.createElement('tr');

      tr.innerHTML = `
        <td>
          <input type="checkbox" ${rule.enabled ? 'checked' : ''} data-idx="${idx}" class="nac-rule-toggle">
        </td>
        <td><code>${escapeHtml(rule.pattern)}</code></td>
        <td><strong>${escapeHtml(rule.replacement)}</strong></td>
        <td>
          <span class="nac-type-badge ${rule.isRegex ? 'nac-type-regex' : ''}">
            ${rule.isRegex ? 'Regex' : 'Text'}
          </span>
        </td>
        <td>
          <button class="nac-btn-del" data-idx="${idx}" title="Delete rule">🗑️</button>
        </td>
      `;

      rulesTbody.appendChild(tr);
    });

    // Wire toggle checkbox
    rulesTbody.querySelectorAll('.nac-rule-toggle').forEach(chk => {
      chk.addEventListener('change', async (e) => {
        const i = parseInt(e.target.dataset.idx, 10);
        settings.dictionaryRules[i].enabled = e.target.checked;
        await chrome.storage.sync.set({ dictionaryRules: settings.dictionaryRules });
      });
    });

    // Wire delete button
    rulesTbody.querySelectorAll('.nac-btn-del').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const i = parseInt(e.target.dataset.idx, 10);
        settings.dictionaryRules.splice(i, 1);
        await chrome.storage.sync.set({ dictionaryRules: settings.dictionaryRules });
        renderDictionaryRules();
        showToast('Rule removed');
      });
    });
  }

  renderDictionaryRules();

  btnAddRule.addEventListener('click', async () => {
    const pattern = inputPattern.value.trim();
    const replacement = inputReplacement.value.trim();
    const isRegex = inputIsRegex.checked;

    if (!pattern) {
      showToast('Please enter a target pattern', true);
      return;
    }

    if (isRegex) {
      try {
        new RegExp(pattern);
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

  // Preset loaders
  btnLoadXianxia.addEventListener('click', async () => {
    const xianxiaRules = [
      { id: Date.now() + '1', enabled: true, isRegex: false, pattern: 'Qi', replacement: 'Chee' },
      { id: Date.now() + '2', enabled: true, isRegex: false, pattern: 'Dao', replacement: 'Dow' },
      { id: Date.now() + '3', enabled: true, isRegex: false, pattern: 'Dantian', replacement: 'Dahn-tee-en' },
      { id: Date.now() + '4', enabled: true, isRegex: false, pattern: 'Xianxia', replacement: 'Shee-ahn-shee-ah' },
      { id: Date.now() + '5', enabled: true, isRegex: false, pattern: 'Wuxia', replacement: 'Woo-shee-ah' },
      { id: Date.now() + '6', enabled: true, isRegex: false, pattern: 'Jianghu', replacement: 'Jee-ahng-hoo' }
    ];
    mergeRules(xianxiaRules, 'Xianxia rules added!');
  });

  btnLoadLitrpg.addEventListener('click', async () => {
    const litrpgRules = [
      { id: Date.now() + 'l1', enabled: true, isRegex: true, pattern: '\\[(Status|Level|Stats|HP|MP|Skill|Quest)[^\\]]*\\]', replacement: 'Status window:' },
      { id: Date.now() + 'l2', enabled: true, isRegex: true, pattern: '\\[Skill:\\s*([^\\]]+)\\]', replacement: 'Skill, $1.' }
    ];
    mergeRules(litrpgRules, 'LitRPG rules added!');
  });

  btnLoadNumerals.addEventListener('click', async () => {
    const numeralRules = [
      { id: Date.now() + 'n1', enabled: true, isRegex: true, pattern: '(?i)^Chapter\\s+([IVXLCDM]+):?', replacement: 'Chapter $1.' }
    ];
    mergeRules(numeralRules, 'Roman numerals rule added!');
  });

  async function mergeRules(newRules, successMsg) {
    newRules.forEach(nr => {
      const exists = settings.dictionaryRules.some(r => r.pattern.toLowerCase() === nr.pattern.toLowerCase());
      if (!exists) settings.dictionaryRules.push(nr);
    });
    await chrome.storage.sync.set({ dictionaryRules: settings.dictionaryRules });
    renderDictionaryRules();
    showToast(successMsg);
  }

  // Live Pronunciation Playground
  function applyRulesToText(text) {
    let result = text;
    const rules = settings.dictionaryRules || [];
    for (const rule of rules) {
      if (!rule.enabled || !rule.pattern) continue;
      try {
        if (rule.isRegex) {
          const re = new RegExp(rule.pattern, 'g');
          result = result.replace(re, rule.replacement || '');
        } else {
          // Safe word-boundary replace or substring replace
          const escaped = rule.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const re = new RegExp(`\\b${escaped}\\b`, 'gi');
          result = result.replace(re, rule.replacement || '');
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

  optCleanComments.checked = settings.cleanComments !== false;
  optCleanComments.addEventListener('change', async (e) => {
    settings.cleanComments = e.target.checked;
    await chrome.storage.sync.set({ cleanComments: settings.cleanComments });
    showToast('Comments cleaner preference saved');
  });

  function renderFilterRules() {
    filtersTbody.innerHTML = '';
    const filters = settings.filterRules || [];

    filters.forEach((f, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <input type="checkbox" ${f.enabled ? 'checked' : ''} data-idx="${idx}" class="nac-filter-toggle">
        </td>
        <td><code>${escapeHtml(f.pattern)}</code></td>
        <td>
          <button class="nac-btn-del" data-idx="${idx}">🗑️</button>
        </td>
      `;
      filtersTbody.appendChild(tr);
    });

    filtersTbody.querySelectorAll('.nac-filter-toggle').forEach(chk => {
      chk.addEventListener('change', async (e) => {
        const i = parseInt(e.target.dataset.idx, 10);
        settings.filterRules[i].enabled = e.target.checked;
        await chrome.storage.sync.set({ filterRules: settings.filterRules });
      });
    });

    filtersTbody.querySelectorAll('.nac-btn-del').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const i = parseInt(e.target.dataset.idx, 10);
        settings.filterRules.splice(i, 1);
        await chrome.storage.sync.set({ filterRules: settings.filterRules });
        renderFilterRules();
        showToast('Skip pattern removed');
      });
    });
  }

  renderFilterRules();

  btnAddFilter.addEventListener('click', async () => {
    const pat = inputFilterPattern.value.trim();
    if (!pat) return;

    try {
      new RegExp(pat);
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

    // Font
    if (settings.readerFont === 'serif') {
      readerPreview.style.fontFamily = 'Merriweather, Georgia, Cambria, serif';
    } else if (settings.readerFont === 'sans') {
      readerPreview.style.fontFamily = 'Atkinson Hyperlegible, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    } else if (settings.readerFont === 'inter') {
      readerPreview.style.fontFamily = 'Inter, -apple-system, sans-serif';
    } else if (settings.readerFont === 'dyslexic') {
      readerPreview.style.fontFamily = 'OpenDyslexic, Comic Sans MS, sans-serif';
    }

    // Theme
    themeOptions.forEach(opt => {
      opt.classList.toggle('active', opt.dataset.theme === settings.readerTheme);
    });

    if (settings.readerTheme === 'midnight') {
      readerPreview.style.background = '#0f172a';
      readerPreview.style.color = '#f1f5f9';
      readerPreview.style.borderColor = 'rgba(255,255,255,0.1)';
    } else if (settings.readerTheme === 'oled') {
      readerPreview.style.background = '#000000';
      readerPreview.style.color = '#e2e8f0';
      readerPreview.style.borderColor = '#222';
    } else if (settings.readerTheme === 'sepia') {
      readerPreview.style.background = '#fbf0d9';
      readerPreview.style.color = '#2d2319';
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

  // --- Custom Sites Manager ---
  const customSitesTbody = document.getElementById('nac-custom-sites-tbody');
  const siteDomainInput = document.getElementById('nac-site-domain');
  const siteContentInput = document.getElementById('nac-site-content');
  const siteNextInput = document.getElementById('nac-site-next');
  const btnAddSite = document.getElementById('nac-btn-add-site');

  function renderCustomSites() {
    customSitesTbody.innerHTML = '';
    const sites = settings.customSites || [];

    if (sites.length === 0) {
      customSitesTbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:#64748b;">No custom sites added. The universal extractor handles 99% of novel sites automatically!</td></tr>';
      return;
    }

    sites.forEach((s, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${escapeHtml(s.domain)}</strong></td>
        <td><code>${escapeHtml(s.contentSelector)}</code></td>
        <td><code>${escapeHtml(s.nextSelector || '--')}</code></td>
        <td><button class="nac-btn-del" data-idx="${idx}">🗑️</button></td>
      `;
      customSitesTbody.appendChild(tr);
    });

    customSitesTbody.querySelectorAll('.nac-btn-del').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const i = parseInt(e.target.dataset.idx, 10);
        settings.customSites.splice(i, 1);
        await chrome.storage.sync.set({ customSites: settings.customSites });
        renderCustomSites();
        showToast('Custom site removed');
      });
    });
  }

  renderCustomSites();

  btnAddSite.addEventListener('click', async () => {
    const domain = siteDomainInput.value.trim().toLowerCase();
    const contentSelector = siteContentInput.value.trim();
    const nextSelector = siteNextInput.value.trim();

    if (!domain || !contentSelector) {
      showToast('Domain and content selector are required', true);
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

  // --- Export & Import ---
  const btnExport = document.getElementById('nac-btn-export');
  const fileImport = document.getElementById('nac-file-import');

  btnExport.addEventListener('click', () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(settings, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute('download', `novel-audio-companion-settings-${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
    showToast('Settings exported successfully!');
  });

  fileImport.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (typeof imported === 'object' && imported !== null) {
          settings = { ...settings, ...imported };
          await chrome.storage.sync.set(settings);
          showToast('Settings imported successfully! Reloading...');
          setTimeout(() => location.reload(), 1000);
        } else {
          showToast('Invalid settings file format', true);
        }
      } catch (err) {
        showToast('Error reading file: ' + err.message, true);
      }
    };
    reader.readAsText(file);
  });

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[m]);
  }
});
