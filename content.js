// Novel Audio Companion - Production Content Engine & Reader Pro
// Architected for high-fidelity speech synthesis, ReDoS resistance, and distraction-free reading.
(function () {
  'use strict';

  if (window.__NAC_CONTENT_INITIALIZED__) return;
  window.__NAC_CONTENT_INITIALIZED__ = true;

  // Protect speech utterances from Chromium garbage collection bug
  window.__nac_active_utterances__ = new Set();

  // --- Core Configuration & Settings ---
  let settings = {
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
    sleepTimerMinutes: 0,
    readerTheme: 'midnight',
    readerFont: 'serif',
    readerFontSize: 19,
    readerLineHeight: 1.8,
    readerMaxWidth: 760,
    dictionaryRules: [],
    filterRules: [],
    customSites: []
  };

  // --- Runtime Engine State ---
  let novelContainer = null;
  let novelTitle = '';
  let chapterTitle = '';
  let paragraphs = [];
  let currentIdx = 0;
  let isPlaying = false;
  let isPaused = false;
  let activeUtterance = null;
  let utteranceStartTime = 0;
  let keepAliveInterval = null;
  let activeWordModifiedEl = null;
  let activeWordOriginalContent = null;

  // Sleep Timer
  let sleepSecondsRemaining = 0;
  let sleepIntervalId = null;

  // Voices
  let voices = [];
  let selectedVoice = null;

  // UI References
  let playerContainer = null;
  let minimizedOrb = null;
  let playBtn = null;
  let progressLabel = null;
  let progressTime = null;
  let equalizerEl = null;
  let speedBadge = null;
  let voiceSelect = null;
  let speedSelect = null;
  let sleepBtn = null;
  let autoNextBtn = null;
  let readerAutoNextBtn = null;
  let morePopover = null;
  let readerOverlay = null;
  let readerArticle = null;
  let isReaderActive = false;

  function updateAutoNextButtons() {
    const isEnabled = settings.autoNext !== false;
    if (autoNextBtn) {
      autoNextBtn.innerHTML = `<span class="nac-dot"></span>Auto: ${isEnabled ? 'ON' : 'OFF'}`;
      autoNextBtn.classList.toggle('active', isEnabled);
      autoNextBtn.title = isEnabled ? 'Auto-Next chapter is enabled (click to disable)' : 'Auto-Next chapter is disabled (click to enable)';
    }
    if (readerAutoNextBtn) {
      readerAutoNextBtn.textContent = isEnabled ? '🔄 Auto: ON' : '🔄 Auto: OFF';
      readerAutoNextBtn.classList.toggle('active', isEnabled);
      readerAutoNextBtn.title = isEnabled ? 'Auto-Next chapter is enabled (click to disable)' : 'Auto-Next chapter is disabled (click to enable)';
    }
  }

  function updateSpeedBadge() {
    if (speedBadge) {
      const rate = parseFloat(settings.rate || 1.0);
      const text = rate % 1 === 0 ? `${rate.toFixed(1)}x` : `${rate}x`;
      speedBadge.textContent = text;
      speedBadge.title = `Reading speed: ${text} (click to cycle)`;
    }
  }

  // --- 1. Settings Loader & Real-Time Sync ---
  async function initSettings() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
        const stored = await chrome.storage.sync.get(null);
        settings = { ...settings, ...stored };

        chrome.storage.onChanged.addListener((changes, area) => {
          if (area === 'sync') {
            for (const [key, change] of Object.entries(changes)) {
              settings[key] = change.newValue;
            }
            if (changes.rate) {
              if (speedSelect) speedSelect.value = settings.rate.toString();
              updateSpeedBadge();
            }
            if (changes.voiceURI) {
              matchPreferredVoice();
            }
            if (changes.autoNext !== undefined) {
              settings.autoNext = Boolean(changes.autoNext.newValue);
              updateAutoNextButtons();
            }
            if (changes.readerTheme || changes.readerFont || changes.readerFontSize || changes.readerLineHeight || changes.readerMaxWidth) {
              applyReaderStyles();
            }
          }
        });
      }
    } catch (e) {
      console.debug('[NAC] Using local defaults:', e);
    }
  }

  // --- 2. Cybersecurity: ReDoS & Pattern Sanitization ---
  function sanitizePattern(pattern) {
    if (typeof pattern !== 'string') return '';
    let p = pattern.trim();
    // Strip illegal PCRE inline flags like (?i) that crash V8 JS RegExp
    if (p.startsWith('(?i)')) {
      p = p.slice(4).trim();
    }
    // Limit regex length to prevent catastrophic ReDoS
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

  // --- 3. Pronunciation & Filter Rules Engine ---
  function applyFilters(text) {
    if (!text || typeof text !== 'string') return false;
    const trimmed = text.trim();
    if (trimmed.length < 2) return false;

    // Hardcoded high-signal noise patterns
    const defaultSkips = [
      /stolen\s+from\s+royal\s*road/i,
      /read\s+only\s+at\s+[\w.-]+/i,
      /report\s+chapter/i,
      /^[\*\-_=~#\s]{3,}$/,
      /support\s+(?:me\s+)?on\s+patreon/i,
      /find\s+authorized\s+novels\s+in\s+webnovel/i
    ];

    for (const re of defaultSkips) {
      if (re.test(trimmed)) return false;
    }

    if (Array.isArray(settings.filterRules)) {
      for (const rule of settings.filterRules) {
        if (!rule || !rule.enabled || !rule.pattern) continue;
        const re = compileRegexSafe(rule.pattern, 'i');
        if (re && re.test(trimmed)) return false;
      }
    }

    return true;
  }

  function applyDictionary(text) {
    if (!text || typeof text !== 'string') return '';
    let result = text;
    const rules = Array.isArray(settings.dictionaryRules) ? settings.dictionaryRules : [];

    for (const rule of rules) {
      if (!rule || !rule.enabled || !rule.pattern) continue;
      try {
        if (rule.isRegex) {
          const re = compileRegexSafe(rule.pattern, 'gi');
          if (re) {
            const safeReplacement = typeof rule.replacement === 'string' ? rule.replacement : '';
            result = result.replace(re, safeReplacement);
          }
        } else {
          // Exact text replacement with safe word boundaries
          const safeEscaped = rule.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const re = new RegExp(`\\b${safeEscaped}\\b`, 'gi');
          const safeReplacement = typeof rule.replacement === 'string' ? rule.replacement.replace(/\$/g, '$$$$') : '';
          result = result.replace(re, safeReplacement);
        }
      } catch (err) {
        // Safe continuation on any pattern evaluation failure
      }
    }

    return result;
  }

  // --- 4. Content Extractor & Site Support ---
  function safeQuerySelector(parent, selector) {
    if (!parent || !selector || typeof selector !== 'string') return null;
    try {
      return parent.querySelector(selector.trim());
    } catch (e) {
      return null;
    }
  }

  function findNovelContainer() {
    const host = window.location.hostname.toLowerCase();

    // 1. Check custom user site definitions
    if (Array.isArray(settings.customSites) && settings.customSites.length > 0) {
      for (const site of settings.customSites) {
        if (site && site.domain && host.includes(site.domain.toLowerCase()) && site.contentSelector) {
          const el = safeQuerySelector(document, site.contentSelector);
          if (el && countReadableBlocks(el) >= 2) return el;
        }
      }
    }

    // 2. High-precision curated selectors for major web novel portals
    const verifiedSelectors = [
      'div.content.flow-md',         // IsoTLS
      'article.flow-lg',             // IsoTLS
      '.chapter-inner',              // RoyalRoad
      '.chapter-content',            // RoyalRoad, Wuxiaworld, LightNovelPub
      '#chp_raw',                    // ScribbleHub
      '.chp_contents',               // ScribbleHub
      '#chapter-container',          // LightNovelPub
      '#chr-content',                // NovelFull / NovelBin
      '.chr-c',                      // NovelFull
      '.cha-content',                // Webnovel
      '.chapter-entity',             // Webnovel
      '.text#arrticle',              // Ranobes
      '#arrticle',                   // Ranobes
      '.chapter-content3',           // ReadLightNovel
      '.text-left',                  // BoxNovel
      '.reading-content',            // BoxNovel
      '.single-post-content',        // Mtlnovel
      'div.entry-content',           // WordPress Novel themes
      '#chapter-content',            // Generic
      'article .content'             // Generic
    ];

    for (const sel of verifiedSelectors) {
      const el = safeQuerySelector(document, sel);
      if (el && countReadableBlocks(el) >= 3) {
        return el;
      }
    }

    // 3. Universal Readability-style Heuristic Fallback
    const candidateNodes = Array.from(document.querySelectorAll('article, main, section, [role="main"], div'));
    let bestCandidate = null;
    let highestScore = 0;

    for (const candidate of candidateNodes) {
      const score = scoreContentCandidate(candidate);
      if (score > highestScore) {
        highestScore = score;
        bestCandidate = candidate;
      }
    }

    return highestScore >= 60 ? bestCandidate : null;
  }

  function countReadableBlocks(container) {
    const pCount = container.querySelectorAll('p').length;
    if (pCount > 0) return pCount;
    // Fallback: count double-br or block breaks
    const text = container.textContent || '';
    const lines = text.split(/\n{2,}/).filter(l => l.trim().length > 20);
    return lines.length;
  }

  function scoreContentCandidate(el) {
    const pElements = el.querySelectorAll('p');
    let validParas = 0;
    let textLength = 0;

    pElements.forEach(p => {
      const txt = (p.textContent || '').trim();
      if (txt.length > 25) {
        validParas++;
        textLength += txt.length;
      }
    });

    if (validParas < 3) return 0;

    // Heavily penalize navigation wrappers and comment blocks
    const links = el.querySelectorAll('a').length;
    const isNavOrFooter = /nav|menu|comment|footer|sidebar/i.test(el.className + ' ' + el.id);
    if (isNavOrFooter) return 0;

    return (validParas * 18) + (textLength / 120) - (links * 10);
  }

  function extractMetadata() {
    const h1 = document.querySelector('h1')?.textContent.trim();
    const ogTitle = document.querySelector('meta[property="og:title"]')?.content?.trim();
    const docTitle = document.title || '';

    if (h1 && h1.length > 2 && h1.length < 120) {
      chapterTitle = h1;
    } else if (ogTitle && ogTitle.length > 2 && ogTitle.length < 120) {
      chapterTitle = ogTitle;
    } else {
      chapterTitle = docTitle.split(/[-|–]/)[0].trim() || 'Novel Chapter';
    }

    novelTitle = docTitle.split(/[-|–]/)[1]?.trim() || window.location.hostname.replace(/^www\./, '');
  }

  // --- 5. Ad & Overlay Sanitization (Safe CSS Concealment) ---
  function sanitizeNovelContent(container) {
    if (!container || settings.cleanAds === false) return;

    const adSelectors = [
      'span[id^="ezoic-pub-ad"]',
      'span[data-ez-ph-id]',
      'div.ezoic-adpicker-ad',
      '.humix-player',
      '[id^="div-gpt-ad"]',
      '.mediavine-ad',
      'div[id^="mediavine"]',
      'ins.adsbygoogle',
      'iframe[src*="doubleclick"]',
      'iframe[src*="googlesyndication"]',
      'iframe[src*="ezoic"]'
    ];

    if (settings.cleanComments) {
      adSelectors.push('#disqus_thread', 'aside#comments', '.comments-area', '#comments');
    }

    // Use safe CSS injection rather than violent DOM deletion to avoid breaking anti-adblock scripts
    const hideSelector = adSelectors.join(', ');
    const styleId = 'nac-ad-cleaner-style';
    let styleTag = document.getElementById(styleId);
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = styleId;
      document.head.appendChild(styleTag);
    }
    styleTag.textContent = `${hideSelector} { display: none !important; visibility: hidden !important; height: 0 !important; pointer-events: none !important; }`;
  }

  // --- 6. Paragraph Indexing & Click-to-Read ---
  function initParagraphs(container) {
    const rawParagraphs = Array.from(container.querySelectorAll('p'));

    if (rawParagraphs.length >= 3) {
      paragraphs = rawParagraphs.filter(p => {
        const text = (p.textContent || '').trim();
        return text.length > 2 && applyFilters(text);
      });
    } else {
      // Fallback: Convert double-break text into virtual paragraph wrappers
      const rawText = container.textContent || '';
      const splitLines = rawText.split(/\n{2,}/).map(l => l.trim()).filter(l => l.length > 15 && applyFilters(l));

      container.innerHTML = '';
      paragraphs = splitLines.map((line, idx) => {
        const p = document.createElement('p');
        p.textContent = line;
        container.appendChild(p);
        return p;
      });
    }

    paragraphs.forEach((p, idx) => {
      p.classList.add('nac-paragraph-target');
      p.dataset.nacIndex = idx;
      p.onclick = (e) => {
        // Prevent click when selecting text
        const selection = window.getSelection();
        if (selection && selection.toString().length > 0) return;
        playParagraph(idx);
      };
    });
  }

  function highlightParagraph(idx) {
    paragraphs.forEach((p, i) => {
      if (i === idx) {
        p.classList.add('nac-highlight-active');
        p.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        p.classList.remove('nac-highlight-active');
      }
    });

    if (readerArticle) {
      const readerParas = readerArticle.querySelectorAll('p');
      readerParas.forEach((p, i) => {
        if (i === idx) {
          p.classList.add('nac-highlight-active');
          p.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          p.classList.remove('nac-highlight-active');
        }
      });
    }
  }

  function clearActiveHighlight() {
    restoreActiveWordDom();
    paragraphs.forEach(p => p.classList.remove('nac-highlight-active'));
    if (readerArticle) {
      readerArticle.querySelectorAll('p').forEach(p => p.classList.remove('nac-highlight-active'));
    }
  }

  // --- 7. Non-Destructive Karaoke Word Tracking ---
  function restoreActiveWordDom() {
    if (activeWordModifiedEl && activeWordOriginalContent !== null) {
      activeWordModifiedEl.innerHTML = activeWordOriginalContent;
      activeWordModifiedEl = null;
      activeWordOriginalContent = null;
    }
  }

  function setupWordTracking(paragraphEl, spokenText, utterance) {
    if (!settings.wordHighlight || !paragraphEl) return;
    restoreActiveWordDom();

    // Only apply span wrapping if paragraph has pure text or simple inline nodes
    const words = spokenText.split(/\s+/).filter(Boolean);
    if (words.length <= 1) return;

    // Cache original HTML safely
    activeWordModifiedEl = paragraphEl;
    activeWordOriginalContent = paragraphEl.innerHTML;

    // Build non-destructive spans
    const fragment = document.createDocumentFragment();
    words.forEach((w, i) => {
      const span = document.createElement('span');
      span.className = 'nac-word';
      span.dataset.wordIdx = i;
      span.textContent = w + ' ';
      fragment.appendChild(span);
    });

    paragraphEl.innerHTML = '';
    paragraphEl.appendChild(fragment);

    let activeSpan = null;
    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        const wordSpans = paragraphEl.querySelectorAll('.nac-word');
        const matchIdx = findWordIndexAtChar(spokenText, event.charIndex, words);
        if (matchIdx !== -1 && wordSpans[matchIdx]) {
          if (activeSpan) activeSpan.classList.remove('nac-word-active');
          activeSpan = wordSpans[matchIdx];
          activeSpan.classList.add('nac-word-active');
        }
      }
    };
  }

  function findWordIndexAtChar(fullText, charIndex, wordsArray) {
    let charCount = 0;
    for (let i = 0; i < wordsArray.length; i++) {
      const len = wordsArray[i].length + 1;
      if (charIndex >= charCount && charIndex < charCount + len) {
        return i;
      }
      charCount += len;
    }
    return -1;
  }

  // --- 8. Voice Prioritization & Matching ---
  function loadVoices() {
    voices = window.speechSynthesis.getVoices() || [];
    if (!voices.length) return;

    // Prioritize natural neural cloud voices, then English, then local
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

    matchPreferredVoice();
    populateVoiceSelect();
  }

  function matchPreferredVoice() {
    if (settings.voiceURI) {
      selectedVoice = voices.find(v => v.voiceURI === settings.voiceURI) || null;
    }
    if (!selectedVoice) {
      selectedVoice = voices.find(v => /natural|neural/i.test(v.name) && (v.lang || '').startsWith('en')) ||
                      voices.find(v => (v.lang || '').startsWith('en')) ||
                      voices[0] || null;
    }
  }

  // --- 9. Speech Synthesis Engine (Smooth, Freeze-Free Narration) ---
  function playParagraph(index) {
    if (index < 0) index = 0;
    if (index >= paragraphs.length) {
      stopPlayback();
      if (settings.autoNext) {
        goToNextChapter();
      }
      return;
    }

    currentIdx = index;
    isPlaying = true;
    isPaused = false;

    updateUI();
    highlightParagraph(currentIdx);
    updateMediaSession();
    notifyBadge('▶');

    // Clean active speech cleanly
    window.speechSynthesis.cancel();
    clearInterval(keepAliveInterval);
    window.__nac_active_utterances__.clear();

    const rawText = (paragraphs[currentIdx].textContent || '').trim();
    if (!rawText) {
      playParagraph(currentIdx + 1);
      return;
    }

    // Apply custom phonetic & dictionary rules
    const textToSpeak = applyDictionary(rawText);

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    activeUtterance = utterance;
    utteranceStartTime = Date.now();
    window.__nac_active_utterances__.add(utterance);

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    // Clamp speed and pitch to safe bounds
    utterance.rate = Math.max(0.5, Math.min(3.0, parseFloat(settings.rate || 1.0)));
    utterance.pitch = Math.max(0.7, Math.min(1.3, parseFloat(settings.pitch || 1.0)));
    utterance.volume = Math.max(0, Math.min(1.0, parseFloat(settings.volume !== undefined ? settings.volume : 1.0)));

    setupWordTracking(paragraphs[currentIdx], textToSpeak, utterance);

    utterance.onend = () => {
      restoreActiveWordDom();
      window.__nac_active_utterances__.delete(utterance);
      clearInterval(keepAliveInterval);

      if (isPlaying && !isPaused) {
        const pauseDelay = Math.max(50, Math.min(1000, parseInt(settings.paragraphPauseMs || 280, 10)));
        setTimeout(() => {
          if (isPlaying && !isPaused) {
            playParagraph(currentIdx + 1);
          }
        }, pauseDelay);
      }
    };

    utterance.onerror = (e) => {
      restoreActiveWordDom();
      window.__nac_active_utterances__.delete(utterance);
      clearInterval(keepAliveInterval);
      if (isPlaying && !isPaused) {
        playParagraph(currentIdx + 1);
      }
    };

    window.speechSynthesis.speak(utterance);

    // Humanized keep-alive: ONLY pulse if a single paragraph utterance has been running past 12s
    // to prevent Chromium 15s timeout without causing blind 10-second audio stutters!
    keepAliveInterval = setInterval(() => {
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        const elapsed = Date.now() - utteranceStartTime;
        if (elapsed > 12000) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
          utteranceStartTime = Date.now(); // reset timer
        }
      }
    }, 3000);
  }

  function pausePlayback() {
    if (isPlaying && !isPaused) {
      window.speechSynthesis.pause();
      isPaused = true;
      updateUI();
      updateMediaSession();
      notifyBadge('⏸');
    }
  }

  function resumePlayback() {
    if (isPlaying && isPaused) {
      window.speechSynthesis.resume();
      isPaused = false;
      updateUI();
      updateMediaSession();
      notifyBadge('▶');
    } else {
      playParagraph(currentIdx);
    }
  }

  function stopPlayback() {
    isPlaying = false;
    isPaused = false;
    clearInterval(keepAliveInterval);
    window.speechSynthesis.cancel();
    window.__nac_active_utterances__.clear();
    clearActiveHighlight();
    updateUI();
    notifyBadge('');
  }

  function prevParagraph() {
    if (currentIdx > 0) {
      playParagraph(currentIdx - 1);
    }
  }

  function nextParagraph() {
    if (currentIdx < paragraphs.length - 1) {
      playParagraph(currentIdx + 1);
    } else if (settings.autoNext) {
      goToNextChapter();
    }
  }

  // --- 10. Hardware Media Keys & Bluetooth Controls ---
  function updateMediaSession() {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: chapterTitle || 'Novel Chapter',
        artist: novelTitle || 'Novel Audio Companion',
        album: 'Web Novel Audio'
      });

      navigator.mediaSession.playbackState = isPlaying ? (isPaused ? 'paused' : 'playing') : 'none';

      navigator.mediaSession.setActionHandler('play', () => resumePlayback());
      navigator.mediaSession.setActionHandler('pause', () => pausePlayback());
      navigator.mediaSession.setActionHandler('previoustrack', () => prevParagraph());
      navigator.mediaSession.setActionHandler('nexttrack', () => nextParagraph());
    } catch (e) {
      // Some browsers have partial MediaSession support
    }
  }

  function notifyBadge(text) {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ action: 'NAC_SET_BADGE', text, color: '#3b82f6' });
      }
    } catch (e) {}
  }

  // --- 11. Sleep Timer (With 30-Second Gentle Fade Out) ---
  function setSleepTimer(minutes) {
    clearInterval(sleepIntervalId);

    if (minutes <= 0) {
      sleepSecondsRemaining = 0;
      updateSleepButton();
      showToast('Sleep timer turned off');
      return;
    }

    sleepSecondsRemaining = minutes * 60;
    updateSleepButton();
    showToast(`Sleep timer set for ${minutes} min`);

    sleepIntervalId = setInterval(() => {
      sleepSecondsRemaining--;
      updateSleepButton();

      // Smoothly ramp down volume during the final 30 seconds
      if (sleepSecondsRemaining <= 30 && sleepSecondsRemaining > 0) {
        if (activeUtterance) {
          activeUtterance.volume = Math.max(0, sleepSecondsRemaining / 30);
        }
      }

      if (sleepSecondsRemaining <= 0) {
        clearInterval(sleepIntervalId);
        stopPlayback();
        showToast('💤 Sleep timer completed');
      }
    }, 1000);
  }

  function updateSleepButton() {
    if (!sleepBtn) return;
    if (sleepSecondsRemaining <= 0) {
      sleepBtn.textContent = '⏱️ Sleep';
      sleepBtn.classList.remove('active');
    } else {
      const m = Math.floor(sleepSecondsRemaining / 60);
      const s = sleepSecondsRemaining % 60;
      sleepBtn.textContent = `⏳ ${m}:${s < 10 ? '0' : ''}${s}`;
      sleepBtn.classList.add('active');
    }
  }

  // --- 12. Next Chapter Handover (Strict URL Validation) ---
  function isValidHttpUrl(string) {
    try {
      const url = new URL(string, window.location.origin);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
      return false;
    }
  }

  function findNextChapterLink() {
    const currentHref = window.location.href.split('#')[0];
    const allLinks = Array.from(document.querySelectorAll('a'));

    // 1. rel="next"
    const relNext = document.querySelector('a[rel="next"], link[rel="next"]');
    if (relNext && isValidHttpUrl(relNext.href) && relNext.href.split('#')[0] !== currentHref) {
      return relNext.href;
    }

    // 2. Class patterns
    const classNext = document.querySelector('.nav-next a, .next-chapter a, a.next-chapter, a.next, a.btn-next, .btn-next a');
    if (classNext && isValidHttpUrl(classNext.href) && classNext.href.split('#')[0] !== currentHref) {
      return classNext.href;
    }

    // 3. Arrow / Symbol links: '»', '›', 'Next →'
    const symbolLink = allLinks.find(a => {
      const t = (a.textContent || '').trim();
      return (t === '»' || t === '›' || t === 'Next »' || t === 'Next >' || t === 'Next →') &&
             isValidHttpUrl(a.href) && a.href.split('#')[0] !== currentHref;
    });
    if (symbolLink) return symbolLink.href;

    // 4. URL increment pattern: /chapter-12 -> /chapter-13
    const urlMatch = window.location.pathname.match(/\/chapter[_-]?(\d+)/i);
    if (urlMatch) {
      const nextNum = parseInt(urlMatch[1], 10) + 1;
      const numLink = allLinks.find(a => isValidHttpUrl(a.href) &&
        (a.href.includes(`/chapter/${nextNum}`) || a.href.includes(`/chapter-${nextNum}`))
      );
      if (numLink) return numLink.href;
    }

    // 5. Text content pattern
    const textLink = allLinks.find(a => {
      const t = (a.textContent || '').trim().toLowerCase();
      return (t === 'next' || t === 'next chapter' || t === 'continue reading') &&
             isValidHttpUrl(a.href) && a.href.split('#')[0] !== currentHref;
    });
    if (textLink) return textLink.href;

    return null;
  }

  function goToNextChapter() {
    const nextHref = findNextChapterLink();
    if (nextHref) {
      showToast('📖 Handing over to next chapter...');
      // Safe storage with 30s expiry timestamp
      sessionStorage.setItem('nac_autoplay', JSON.stringify({
        origin: window.location.origin,
        timestamp: Date.now()
      }));
      setTimeout(() => {
        window.location.href = nextHref;
      }, 600);
    } else {
      showToast('Reached the latest chapter');
    }
  }

  // --- 13. Distraction-Free Reader Mode ---
  function createReaderMode() {
    if (readerOverlay) return;

    readerOverlay = document.createElement('div');
    readerOverlay.id = 'nac-reader-overlay';

    // Reading progress track at very top
    const progressTrack = document.createElement('div');
    progressTrack.className = 'nac-reader-progress-track';
    const progressBar = document.createElement('div');
    progressBar.className = 'nac-reader-progress-bar';
    progressBar.id = 'nac-reader-scroll-progress';
    progressTrack.appendChild(progressBar);
    readerOverlay.appendChild(progressTrack);

    // Top control bar
    const topBar = document.createElement('div');
    topBar.className = 'nac-reader-topbar';

    const themeBtn = document.createElement('button');
    themeBtn.id = 'nac-rm-theme-btn';
    themeBtn.textContent = '🎨 Theme';
    themeBtn.title = 'Cycle Theme (Midnight, OLED, Sepia, Light)';

    const fontBtn = document.createElement('button');
    fontBtn.id = 'nac-rm-font-btn';
    fontBtn.textContent = 'Aa Font';
    fontBtn.title = 'Cycle Font';

    const smallerBtn = document.createElement('button');
    smallerBtn.id = 'nac-rm-smaller-btn';
    smallerBtn.textContent = 'A-';
    smallerBtn.title = 'Decrease font size';

    const largerBtn = document.createElement('button');
    largerBtn.id = 'nac-rm-larger-btn';
    largerBtn.textContent = 'A+';
    largerBtn.title = 'Increase font size';

    readerAutoNextBtn = document.createElement('button');
    readerAutoNextBtn.id = 'nac-rm-autonext-btn';
    readerAutoNextBtn.addEventListener('click', () => {
      settings.autoNext = !(settings.autoNext !== false);
      chrome.storage?.sync?.set({ autoNext: settings.autoNext });
      updateAutoNextButtons();
      showToast(settings.autoNext ? '🔄 Auto-Next chapter enabled' : '⏸️ Auto-Next chapter disabled');
    });

    const closeBtn = document.createElement('button');
    closeBtn.className = 'nac-btn-close-reader';
    closeBtn.id = 'nac-rm-close-btn';
    closeBtn.textContent = '✕ Exit';
    closeBtn.title = 'Exit Reader Mode';

    topBar.append(themeBtn, fontBtn, smallerBtn, largerBtn, readerAutoNextBtn, closeBtn);
    updateAutoNextButtons();

    // Article Content
    readerArticle = document.createElement('article');
    readerArticle.className = 'nac-reader-article';
    readerArticle.id = 'nac-reader-article-content';

    const h1 = document.createElement('h1');
    h1.textContent = chapterTitle || 'Chapter';
    readerArticle.appendChild(h1);

    paragraphs.forEach((p, idx) => {
      const clone = document.createElement('p');
      clone.textContent = p.textContent;
      clone.dataset.nacIndex = idx;
      clone.className = 'nac-paragraph-target';
      clone.onclick = () => playParagraph(idx);
      readerArticle.appendChild(clone);
    });

    readerOverlay.append(topBar, readerArticle);
    document.body.appendChild(readerOverlay);

    // Scroll-aware auto-hiding topbar (Content-First Noise Reduction)
    let lastScrollTop = 0;
    readerOverlay.addEventListener('scroll', () => {
      const maxScroll = readerOverlay.scrollHeight - readerOverlay.clientHeight;
      if (maxScroll > 0) {
        const pct = Math.min(100, Math.max(0, (readerOverlay.scrollTop / maxScroll) * 100));
        progressBar.style.width = `${pct}%`;
      }
      const currentScrollTop = readerOverlay.scrollTop;
      if (currentScrollTop > 70 && currentScrollTop > lastScrollTop) {
        topBar.classList.add('nac-topbar-hidden');
      } else {
        topBar.classList.remove('nac-topbar-hidden');
      }
      lastScrollTop = currentScrollTop;
    }, { passive: true });

    // Reveal topbar when cursor moves near top of reader view
    readerOverlay.addEventListener('mousemove', (e) => {
      if (e.clientY < 60) {
        topBar.classList.remove('nac-topbar-hidden');
      }
    });

    applyReaderStyles();

    // Event listeners
    closeBtn.addEventListener('click', toggleReaderMode);

    const themes = ['midnight', 'oled', 'sepia', 'light'];
    themeBtn.addEventListener('click', () => {
      const nextTheme = themes[(themes.indexOf(settings.readerTheme) + 1) % themes.length];
      settings.readerTheme = nextTheme;
      chrome.storage?.sync?.set({ readerTheme: nextTheme });
      applyReaderStyles();
    });

    const fonts = ['serif', 'sans', 'inter', 'dyslexic'];
    fontBtn.addEventListener('click', () => {
      const nextFont = fonts[(fonts.indexOf(settings.readerFont) + 1) % fonts.length];
      settings.readerFont = nextFont;
      chrome.storage?.sync?.set({ readerFont: nextFont });
      applyReaderStyles();
    });

    smallerBtn.addEventListener('click', () => {
      settings.readerFontSize = Math.max(14, (settings.readerFontSize || 19) - 1);
      chrome.storage?.sync?.set({ readerFontSize: settings.readerFontSize });
      applyReaderStyles();
    });

    largerBtn.addEventListener('click', () => {
      settings.readerFontSize = Math.min(28, (settings.readerFontSize || 19) + 1);
      chrome.storage?.sync?.set({ readerFontSize: settings.readerFontSize });
      applyReaderStyles();
    });
  }

  function applyReaderStyles() {
    if (!readerOverlay || !readerArticle) return;
    readerOverlay.className = `nac-theme-${settings.readerTheme || 'midnight'} nac-font-${settings.readerFont || 'serif'}`;
    readerArticle.style.fontSize = `${settings.readerFontSize || 19}px`;
    readerArticle.style.lineHeight = settings.readerLineHeight || 1.82;
    readerArticle.style.maxWidth = settings.readerMaxWidth ? `${settings.readerMaxWidth}px` : '68ch';
  }

  function toggleReaderMode() {
    isReaderActive = !isReaderActive;
    if (isReaderActive) {
      if (!readerOverlay) createReaderMode();
      readerOverlay.classList.add('active');
      document.body.style.overflow = 'hidden';
      highlightParagraph(currentIdx);
      showToast('📖 Reader Mode enabled (Alt+Shift+R)');
    } else {
      if (readerOverlay) readerOverlay.classList.remove('active');
      document.body.style.overflow = '';
      highlightParagraph(currentIdx);
    }
  }

  // --- 14. World-Class Dynamic Island Floating Player ---
  function createUI() {
    playerContainer = document.createElement('div');
    playerContainer.id = 'nac-player-container';

    playerContainer.innerHTML = `
      <div class="nac-island-card">
        <div class="nac-drag-handle" title="Drag player" aria-label="Drag player widget">⋮⋮</div>

        <button class="nac-btn" id="nac-prev-btn" title="Previous paragraph (Alt+Shift+Left)" aria-label="Previous paragraph">⏮</button>
        <button class="nac-btn nac-btn-play" id="nac-play-btn" title="Play / Pause (Alt+Shift+P)" aria-label="Play or pause narration">▶</button>
        <button class="nac-btn" id="nac-next-btn" title="Next paragraph (Alt+Shift+Right)" aria-label="Next paragraph">⏭</button>

        <div class="nac-progress-pill" id="nac-progress-pill" role="status" aria-label="Chapter reading progress">
          <span class="nac-equalizer" id="nac-equalizer" aria-hidden="true">
            <span class="nac-eq-bar"></span>
            <span class="nac-eq-bar"></span>
            <span class="nac-eq-bar"></span>
            <span class="nac-eq-bar"></span>
          </span>
          <span class="nac-progress-label" id="nac-progress-label">0 / ${paragraphs.length}</span>
          <span class="nac-progress-time" id="nac-progress-time">-- min</span>
        </div>

        <button class="nac-speed-badge" id="nac-speed-badge" title="Click to cycle speed" aria-label="Reading Speed">1.0x</button>
        <button class="nac-autonext-btn" id="nac-autonext-btn" title="Toggle Auto-Next Chapter" aria-label="Toggle Auto-Next Chapter"><span class="nac-dot"></span>Auto: ON</button>
        <button class="nac-sleep-pill" id="nac-sleep-btn" title="Sleep Timer" aria-label="Sleep Timer">⏱️ Sleep</button>
        <button class="nac-btn" id="nac-reader-btn" title="Clean Reader Mode (Alt+Shift+R)" aria-label="Toggle Clean Reader Mode">📖</button>
        <button class="nac-btn" id="nac-more-btn" title="Voice & Audio Settings" aria-label="Voice and Audio Settings">🎙️</button>
        <button class="nac-btn" id="nac-minimize-btn" title="Minimize floating bar" aria-label="Minimize Player Bar">—</button>

        <!-- Secondary Voice & Audio Popover -->
        <div class="nac-more-popover" id="nac-more-popover" style="display: none;">
          <div class="nac-popover-header">
            <span class="nac-popover-title">🎙️ Audio & Voice</span>
            <button class="nac-popover-close" id="nac-popover-close" aria-label="Close voice menu">✕</button>
          </div>
          <div class="nac-popover-row">
            <label for="nac-voice-select" class="nac-popover-label">Narrator Voice:</label>
            <select class="nac-select-custom" id="nac-voice-select" title="Voice Selection" aria-label="Voice Selection"></select>
          </div>
          <div class="nac-popover-row">
            <span class="nac-popover-label">Sleep Timer:</span>
            <div class="nac-timer-chips" id="nac-timer-chips">
              <button class="nac-timer-chip" data-min="15">15m</button>
              <button class="nac-timer-chip" data-min="30">30m</button>
              <button class="nac-timer-chip" data-min="45">45m</button>
              <button class="nac-timer-chip" data-min="60">60m</button>
              <button class="nac-timer-chip" data-min="0">Off</button>
            </div>
          </div>
          <div class="nac-popover-footer">
            <button class="nac-btn-link" id="nac-settings-btn" aria-label="Open Full Settings">⚙️ Full Settings & Dictionary</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(playerContainer);

    // Minimized Dock Orb
    minimizedOrb = document.createElement('div');
    minimizedOrb.className = 'nac-minimized-orb';
    minimizedOrb.title = 'Open Novel Audio Companion';
    minimizedOrb.setAttribute('role', 'button');
    minimizedOrb.setAttribute('tabindex', '0');
    minimizedOrb.setAttribute('aria-label', 'Open Novel Audio Companion player');
    minimizedOrb.innerHTML = `
      <div class="nac-orb-content">
        <span class="nac-orb-icon">🎧</span>
      </div>
    `;
    document.body.appendChild(minimizedOrb);

    // Elements
    playBtn = playerContainer.querySelector('#nac-play-btn');
    progressLabel = playerContainer.querySelector('#nac-progress-label');
    progressTime = playerContainer.querySelector('#nac-progress-time');
    equalizerEl = playerContainer.querySelector('#nac-equalizer');
    speedBadge = playerContainer.querySelector('#nac-speed-badge');
    voiceSelect = playerContainer.querySelector('#nac-voice-select');
    sleepBtn = playerContainer.querySelector('#nac-sleep-btn');
    autoNextBtn = playerContainer.querySelector('#nac-autonext-btn');
    morePopover = playerContainer.querySelector('#nac-more-popover');

    updateSpeedBadge();
    updateAutoNextButtons();

    // Auto-Next Handover Toggle
    autoNextBtn.addEventListener('click', () => {
      settings.autoNext = !(settings.autoNext !== false);
      chrome.storage?.sync?.set({ autoNext: settings.autoNext });
      updateAutoNextButtons();
      showToast(settings.autoNext ? '🔄 Auto-Next chapter enabled' : '⏸️ Auto-Next chapter disabled');
    });

    // Speed Cycle Handler (0.75x -> 1.0x -> 1.25x -> 1.5x -> 1.75x -> 2.0x)
    const speeds = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
    speedBadge.addEventListener('click', () => {
      const currentRate = parseFloat(settings.rate || 1.0);
      let idx = speeds.findIndex(s => Math.abs(s - currentRate) < 0.05);
      const nextRate = speeds[(idx + 1) % speeds.length];
      settings.rate = nextRate;
      chrome.storage?.sync?.set({ rate: nextRate });
      updateSpeedBadge();
      showToast(`Speed: ${nextRate}x`);
      if (isPlaying && !isPaused) playParagraph(currentIdx);
    });

    // Audio Popover Toggle
    const moreBtn = playerContainer.querySelector('#nac-more-btn');
    const closePopoverBtn = playerContainer.querySelector('#nac-popover-close');

    moreBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = morePopover.style.display === 'none';
      morePopover.style.display = isHidden ? 'flex' : 'none';
    });

    closePopoverBtn.addEventListener('click', () => {
      morePopover.style.display = 'none';
    });

    document.addEventListener('pointerdown', (e) => {
      if (morePopover && morePopover.style.display !== 'none' && !playerContainer.contains(e.target)) {
        morePopover.style.display = 'none';
      }
    });

    // Playback Controls
    playBtn.addEventListener('click', () => {
      if (!isPlaying) playParagraph(currentIdx);
      else if (isPaused) resumePlayback();
      else pausePlayback();
    });

    playerContainer.querySelector('#nac-prev-btn').addEventListener('click', prevParagraph);
    playerContainer.querySelector('#nac-next-btn').addEventListener('click', nextParagraph);

    // Voice Selection in Popover
    voiceSelect.addEventListener('change', (e) => {
      selectedVoice = voices.find(v => v.voiceURI === e.target.value) || null;
      if (selectedVoice) {
        settings.voiceURI = selectedVoice.voiceURI;
        chrome.storage?.sync?.set({ voiceURI: selectedVoice.voiceURI });
        showToast(`Voice: ${selectedVoice.name.replace(/Microsoft /g, '').slice(0, 24)}`);
      }
      if (isPlaying && !isPaused) playParagraph(currentIdx);
    });

    // Sleep Timer Button Cycling
    const sleepTimes = [0, 15, 30, 45, 60];
    let sleepIdx = 0;
    sleepBtn.addEventListener('click', () => {
      sleepIdx = (sleepIdx + 1) % sleepTimes.length;
      setSleepTimer(sleepTimes[sleepIdx]);
    });

    // Sleep Chips in Popover
    const timerChips = playerContainer.querySelectorAll('.nac-timer-chip');
    timerChips.forEach(chip => {
      chip.addEventListener('click', () => {
        timerChips.forEach(c => c.classList.remove('active'));
        const minutes = parseInt(chip.dataset.min, 10);
        if (minutes > 0) chip.classList.add('active');
        setSleepTimer(minutes);
      });
    });

    playerContainer.querySelector('#nac-reader-btn').addEventListener('click', toggleReaderMode);

    playerContainer.querySelector('#nac-settings-btn').addEventListener('click', () => {
      chrome.runtime?.sendMessage?.({ action: 'NAC_OPEN_OPTIONS' });
    });

    playerContainer.querySelector('#nac-minimize-btn').addEventListener('click', () => {
      playerContainer.style.display = 'none';
      minimizedOrb.style.display = 'flex';
    });

    minimizedOrb.addEventListener('click', () => {
      minimizedOrb.style.display = 'none';
      playerContainer.style.display = 'block';
    });

    makeDraggable(playerContainer);

    // Safe contextual hotkeys (Avoid intercepting normal typing or webpage navigation)
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
      if (isReaderActive && e.code === 'Space') {
        e.preventDefault();
        playBtn.click();
      } else if (e.altKey && e.code === 'ArrowRight') {
        e.preventDefault();
        nextParagraph();
      } else if (e.altKey && e.code === 'ArrowLeft') {
        e.preventDefault();
        prevParagraph();
      }
    });
  }

  function makeDraggable(el) {
    const handle = el.querySelector('.nac-drag-handle');
    if (!handle) return;
    let isDragging = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;

    handle.addEventListener('pointerdown', (e) => {
      isDragging = true;
      handle.setPointerCapture(e.pointerId);
      startX = e.clientX;
      startY = e.clientY;

      const rect = el.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;

      el.style.transform = 'none';
      el.style.left = `${initialLeft}px`;
      el.style.top = `${initialTop}px`;
      el.style.bottom = 'auto';
    });

    handle.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      const newLeft = Math.max(10, Math.min(window.innerWidth - el.offsetWidth - 10, initialLeft + dx));
      const newTop = Math.max(10, Math.min(window.innerHeight - el.offsetHeight - 10, initialTop + dy));

      el.style.left = `${newLeft}px`;
      el.style.top = `${newTop}px`;
    });

    handle.addEventListener('pointerup', (e) => {
      if (isDragging) {
        isDragging = false;
        try { handle.releasePointerCapture(e.pointerId); } catch (_) {}
      }
    });
  }

  function populateVoiceSelect() {
    if (!voiceSelect || !voices.length) return;
    voiceSelect.innerHTML = '';

    voices.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.voiceURI;
      const label = v.name.replace(/Microsoft /g, '').replace(/ Online \(Natural\)/g, ' (Natural)');
      opt.textContent = `${label} (${v.lang})`;
      if (selectedVoice && v.voiceURI === selectedVoice.voiceURI) {
        opt.selected = true;
      }
      voiceSelect.appendChild(opt);
    });
  }

  function updateUI() {
    if (!playBtn) return;

    if (isPlaying && !isPaused) {
      playBtn.textContent = '⏸';
      playBtn.classList.add('playing');
      if (equalizerEl) equalizerEl.classList.add('playing');
      if (minimizedOrb) minimizedOrb.classList.add('speaking');
    } else {
      playBtn.textContent = '▶';
      playBtn.classList.remove('playing');
      if (equalizerEl) equalizerEl.classList.remove('playing');
      if (minimizedOrb) minimizedOrb.classList.remove('speaking');
    }

    if (progressLabel) {
      const current = paragraphs.length > 0 ? currentIdx + 1 : 0;
      progressLabel.textContent = `${current} / ${paragraphs.length}`;
    }

    if (progressTime) {
      const remainingParas = Math.max(0, paragraphs.length - (currentIdx + 1));
      const estMinutes = Math.ceil((remainingParas * 35) / (200 * (settings.rate || 1.0)));
      progressTime.textContent = remainingParas > 0 ? `~${estMinutes}m left` : 'Completed';
    }

    updateSpeedBadge();
  }

  function showToast(msg) {
    const existing = document.querySelector('.nac-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'nac-toast';
    toast.textContent = msg; // Strict textContent protection against DOM XSS
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3200);
  }

  // --- 15. Extension Message Listener (Popup & Background Dispatcher) ---
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
      if (!req || typeof req !== 'object') return false;

      if (req.action === 'GET_STATE') {
        sendResponse({
          isNovel: !!novelContainer,
          isPlaying,
          isPaused,
          currentIdx,
          totalParagraphs: paragraphs.length,
          rate: settings.rate,
          autoNext: settings.autoNext,
          chapterTitle,
          novelTitle
        });
        return true;
      }

      if (req.action === 'CMD_TOGGLE_PLAY' || req.action === 'TOGGLE_PLAY') {
        if (!isPlaying) playParagraph(currentIdx);
        else if (isPaused) resumePlayback();
        else pausePlayback();
        sendResponse({ isPlaying, isPaused, currentIdx, totalParagraphs: paragraphs.length });
        return true;
      }

      if (req.action === 'CMD_PREV_PARAGRAPH' || req.action === 'PREV_PARAGRAPH') {
        prevParagraph();
        sendResponse({ currentIdx, totalParagraphs: paragraphs.length });
        return true;
      }

      if (req.action === 'CMD_NEXT_PARAGRAPH' || req.action === 'NEXT_PARAGRAPH') {
        nextParagraph();
        sendResponse({ currentIdx, totalParagraphs: paragraphs.length });
        return true;
      }

      if (req.action === 'CMD_TOGGLE_READER' || req.action === 'TOGGLE_READER_MODE') {
        toggleReaderMode();
        sendResponse({ isReaderActive });
        return true;
      }

      if (req.action === 'TOGGLE_PLAYER') {
        if (playerContainer) {
          const isHidden = playerContainer.style.display === 'none';
          playerContainer.style.display = isHidden ? 'block' : 'none';
          if (minimizedOrb) minimizedOrb.style.display = isHidden ? 'none' : 'flex';
        }
        sendResponse({ success: true });
        return true;
      }

      if (req.action === 'SET_SPEED') {
        const rate = parseFloat(req.speed);
        if (!isNaN(rate) && rate >= 0.5 && rate <= 3.0) {
          settings.rate = rate;
          if (speedSelect) speedSelect.value = rate.toString();
          if (isPlaying && !isPaused) playParagraph(currentIdx);
        }
        sendResponse({ success: true });
        return true;
      }

      if (req.action === 'SET_AUTONEXT') {
        settings.autoNext = Boolean(req.autoNext);
        updateAutoNextButtons();
        showToast(settings.autoNext ? '🔄 Auto-Next chapter enabled' : '⏸️ Auto-Next chapter disabled');
        sendResponse({ success: true, autoNext: settings.autoNext });
        return true;
      }

      if (req.action === 'CLEAN_DOM_NOW') {
        if (novelContainer) sanitizeNovelContent(novelContainer);
        showToast('🛡️ Ads and clutter sanitized');
        sendResponse({ success: true });
        return true;
      }

      if (req.action === 'READ_SELECTION' && typeof req.text === 'string') {
        const cleanText = req.text.trim().slice(0, 5000);
        if (cleanText) {
          window.speechSynthesis.cancel();
          const utt = new SpeechSynthesisUtterance(applyDictionary(cleanText));
          if (selectedVoice) utt.voice = selectedVoice;
          utt.rate = settings.rate || 1.0;
          window.speechSynthesis.speak(utt);
          showToast('🔊 Reading selection');
        }
        sendResponse({ success: true });
        return true;
      }

      return false;
    });
  }

  // --- 16. Engine Bootstrapping ---
  async function init() {
    await initSettings();

    novelContainer = findNovelContainer();
    if (!novelContainer) return; // Do not touch DOM on non-novel pages

    sanitizeNovelContent(novelContainer);
    extractMetadata();
    initParagraphs(novelContainer);
    createUI();
    loadVoices();

    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = loadVoices;
    }

    // Check verified next-chapter handover with 30s expiration guard
    try {
      const storedHandover = sessionStorage.getItem('nac_autoplay');
      if (storedHandover) {
        sessionStorage.removeItem('nac_autoplay');
        const data = JSON.parse(storedHandover);
        if (data.origin === window.location.origin && Date.now() - data.timestamp < 30000) {
          setTimeout(() => {
            playParagraph(0);
            showToast(`📖 Continuing: ${chapterTitle}`);
          }, 800);
        }
      }
    } catch (_) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
