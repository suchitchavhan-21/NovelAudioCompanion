// Novel Audio Companion - Production Content Engine
(function () {
  'use strict';

  if (window.__NAC_CONTENT_INITIALIZED__) return;
  window.__NAC_CONTENT_INITIALIZED__ = true;

  // Global reference set to protect utterances from Chromium garbage collection
  window.__nac_active_utterances__ = new Set();

  // --- Default Settings ---
  let settings = {
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

  // --- Speech Engine State ---
  let novelContainer = null;
  let novelTitle = '';
  let chapterTitle = '';
  let paragraphs = [];
  let currentIdx = 0;
  let isPlaying = false;
  let isPaused = false;
  let activeUtterance = null;
  let keepAliveTimer = null;
  let sleepTimerId = null;
  let sleepSecondsRemaining = 0;
  let sleepIntervalId = null;

  // Voices
  let voices = [];
  let selectedVoice = null;

  // --- 1. Load Settings from Storage & Watch for Updates ---
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
            if (changes.rate && speedSelect) {
              speedSelect.value = settings.rate.toString();
            }
            if (changes.voiceURI) {
              matchPreferredVoice();
            }
            if (changes.readerTheme || changes.readerFont || changes.readerFontSize || changes.readerLineHeight || changes.readerMaxWidth) {
              applyReaderStyles();
            }
          }
        });
      }
    } catch (e) {
      console.warn('[NAC] Fallback to defaults or local storage:', e);
    }
  }

  // --- 2. Site Detection & Novel Content Extractor ---
  function findNovelContainer() {
    const host = window.location.hostname.toLowerCase();

    // 1. Check custom site rules
    if (settings.customSites && settings.customSites.length > 0) {
      for (const site of settings.customSites) {
        if (site.domain && host.includes(site.domain.toLowerCase())) {
          const el = document.querySelector(site.contentSelector);
          if (el && el.querySelectorAll('p').length >= 2) return el;
        }
      }
    }

    // 2. High-precision selectors for verified sites
    const knownSelectors = [
      'div.content.flow-md',         // IsoTLS
      'article.flow-lg',             // IsoTLS
      '.chapter-inner',              // RoyalRoad
      '.chapter-content',            // RoyalRoad, Wuxiaworld, LightNovelPub
      '#chp_raw',                    // ScribbleHub
      '.chp_contents',               // ScribbleHub
      '#chapter-container',          // LightNovelWorld / LightNovelPub
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
      'div.entry-content',           // Generic WordPress
      'article .content',            // Generic
      '#chapter-content',            // Generic
      'article'                      // Generic fallback
    ];

    for (const sel of knownSelectors) {
      const el = document.querySelector(sel);
      if (el && el.querySelectorAll('p').length >= 3) {
        return el;
      }
    }

    // 3. Universal Heuristic Content Extractor (Readability algorithm)
    const candidates = Array.from(document.querySelectorAll('article, main, section, div'));
    let bestCandidate = null;
    let highestScore = 0;

    for (const candidate of candidates) {
      const pTags = candidate.querySelectorAll('p');
      if (pTags.length < 3) continue;

      let validParaCount = 0;
      let textLength = 0;
      pTags.forEach(p => {
        const txt = p.textContent.trim();
        if (txt.length > 25) {
          validParaCount++;
          textLength += txt.length;
        }
      });

      if (validParaCount < 3) continue;

      // Penalize elements with high link density (navigation/menus)
      const linkCount = candidate.querySelectorAll('a').length;
      const score = (validParaCount * 15) + (textLength / 100) - (linkCount * 8);

      if (score > highestScore) {
        highestScore = score;
        bestCandidate = candidate;
      }
    }

    return bestCandidate;
  }

  function extractTitles() {
    // Novel Title
    const ogTitle = document.querySelector('meta[property="og:title"]')?.content;
    const h1 = document.querySelector('h1')?.textContent.trim();
    const docTitle = document.title;

    if (h1 && h1.length < 90) {
      chapterTitle = h1;
    } else if (ogTitle && ogTitle.length < 90) {
      chapterTitle = ogTitle;
    } else {
      chapterTitle = docTitle.split(/[-|–]/)[0].trim();
    }

    novelTitle = docTitle.split(/[-|–]/)[1]?.trim() || window.location.hostname;
  }

  // --- 3. Dynamic Ad & Bloat Sanitizer ---
  function sanitizeNovelContent(container) {
    if (!container) return;

    const adSelectors = [
      'span[id^="ezoic-pub-ad-placeholder"]',
      'span[data-ez-ph-id]',
      'span.ezoic-adpicker-ad',
      'span.ezoic-autoinsert-ad',
      'div.ezoic-adpicker-ad',
      'iframe[src*="ezoic"]',
      'iframe[src*="google"]',
      'iframe[src*="doubleclick"]',
      'ins.adsbygoogle',
      '.humix-player',
      '[id^="div-gpt-ad"]',
      '.mediavine-ad',
      'div[id^="mediavine"]',
      '#disqus_thread',
      'aside#comments',
      '.comments-area',
      '#comments'
    ];

    adSelectors.forEach(sel => {
      container.querySelectorAll(sel).forEach(el => el.remove());
      document.querySelectorAll(sel).forEach(el => {
        if (!container.contains(el)) el.remove();
      });
    });

    // Watch for dynamically inserted ad elements
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach(node => {
          if (node.nodeType === 1) {
            if (
              node.matches?.('span[id^="ezoic"], span[data-ez-ph-id], iframe, .humix-player, ins.adsbygoogle') ||
              node.querySelector?.('span[id^="ezoic"], iframe, ins.adsbygoogle')
            ) {
              node.remove();
            }
          }
        });
      }
    });

    observer.observe(container, { childList: true, subtree: true });
  }

  // --- 4. Pronunciation & Content Filter Rules Engine ---
  function applyFilters(text) {
    if (!text || text.length < 2) return false;

    // Default skip patterns
    const defaultSkips = [
      /stolen\s+from\s+royal\s*road/i,
      /read\s+only\s+at\s+[\w.-]+/i,
      /report\s+chapter/i,
      /^[\*\-_=~#\s]{3,}$/,
      /support\s+(?:me\s+)?on\s+patreon/i
    ];

    for (const re of defaultSkips) {
      if (re.test(text)) return false;
    }

    if (settings.filterRules && settings.filterRules.length > 0) {
      for (const rule of settings.filterRules) {
        if (!rule.enabled || !rule.pattern) continue;
        try {
          const re = new RegExp(rule.pattern, 'i');
          if (re.test(text)) return false;
        } catch (e) {}
      }
    }

    return true;
  }

  function applyDictionary(text) {
    let result = text;
    const rules = settings.dictionaryRules || [];

    for (const rule of rules) {
      if (!rule.enabled || !rule.pattern) continue;
      try {
        if (rule.isRegex) {
          const re = new RegExp(rule.pattern, 'g');
          result = result.replace(re, rule.replacement || '');
        } else {
          const escaped = rule.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const re = new RegExp(`\\b${escaped}\\b`, 'gi');
          result = result.replace(re, rule.replacement || '');
        }
      } catch (e) {}
    }

    return result;
  }

  // --- 5. Paragraph Indexing & Click-to-Read ---
  function initParagraphs(container) {
    const rawP = Array.from(container.querySelectorAll('p'));
    paragraphs = rawP.filter(p => {
      const text = p.textContent.trim();
      return text.length > 2 && applyFilters(text);
    });

    paragraphs.forEach((p, idx) => {
      p.classList.add('nac-paragraph-target');
      p.dataset.nacIndex = idx;
      p.onclick = (e) => {
        // Prevent click if text is being selected
        const sel = window.getSelection();
        if (sel && sel.toString().length > 0) return;
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

    // Also mirror highlight in Reader Mode if active
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

  function clearHighlight() {
    paragraphs.forEach(p => p.classList.remove('nac-highlight-active'));
    if (readerArticle) {
      readerArticle.querySelectorAll('p').forEach(p => p.classList.remove('nac-highlight-active'));
    }
  }

  // --- 6. Karaoke Word Highlighting ---
  let activeWordSpan = null;
  function setupWordTracking(paragraphEl, textToSpeak, utterance) {
    if (!settings.wordHighlight || !paragraphEl) return;

    // Tokenize paragraph into word spans non-destructively
    const words = textToSpeak.split(/\s+/);
    if (words.length <= 1) return;

    // Check if paragraph contains complex children (links/images)
    if (paragraphEl.children.length === 0) {
      const originalHTML = paragraphEl.innerHTML;
      const spans = words.map((w, i) => `<span class="nac-word" data-word-idx="${i}">${escapeHtml(w)} </span>`).join('');
      paragraphEl.innerHTML = spans;

      utterance.onboundary = (event) => {
        if (event.name === 'word') {
          const wordSpans = paragraphEl.querySelectorAll('.nac-word');
          const matchedIdx = findWordIndexAtChar(textToSpeak, event.charIndex, words);
          if (matchedIdx !== -1 && wordSpans[matchedIdx]) {
            if (activeWordSpan) activeWordSpan.classList.remove('nac-word-active');
            activeWordSpan = wordSpans[matchedIdx];
            activeWordSpan.classList.add('nac-word-active');
          }
        }
      };

      const originalEnd = utterance.onend;
      utterance.onend = (e) => {
        paragraphEl.innerHTML = originalHTML;
        if (originalEnd) originalEnd(e);
      };
    }
  }

  function findWordIndexAtChar(fullText, charIndex, wordsArray) {
    let charCount = 0;
    for (let i = 0; i < wordsArray.length; i++) {
      if (charIndex >= charCount && charIndex < charCount + wordsArray[i].length + 1) {
        return i;
      }
      charCount += wordsArray[i].length + 1;
    }
    return -1;
  }

  // --- 7. Voice Loading & Selection ---
  function loadVoices() {
    voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return;

    // Prioritize Edge Natural / Google Neural, then English
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

    matchPreferredVoice();
    populateVoiceSelect();
  }

  function matchPreferredVoice() {
    if (settings.voiceURI) {
      selectedVoice = voices.find(v => v.voiceURI === settings.voiceURI) || null;
    }
    if (!selectedVoice) {
      selectedVoice = voices.find(v => (v.name.includes('Natural') || v.name.includes('Neural')) && v.lang.startsWith('en')) ||
                      voices.find(v => v.lang.startsWith('en')) ||
                      voices[0];
    }
  }

  // --- 8. Speech Synthesis Engine with Chromium Production Fixes ---
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
    clearInterval(keepAliveTimer);
    window.__nac_active_utterances__.clear();

    const rawText = paragraphs[currentIdx].textContent.trim();
    if (!rawText) {
      playParagraph(currentIdx + 1);
      return;
    }

    // Apply phonetic and dictionary replacements
    const spokenText = applyDictionary(rawText);

    const utterance = new SpeechSynthesisUtterance(spokenText);
    activeUtterance = utterance;
    window.__nac_active_utterances__.add(utterance);

    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
    utterance.rate = parseFloat(settings.rate || 1.0);
    utterance.pitch = parseFloat(settings.pitch || 1.0);
    utterance.volume = parseFloat(settings.volume !== undefined ? settings.volume : 1.0);

    // Setup word highlight tracking
    setupWordTracking(paragraphs[currentIdx], spokenText, utterance);

    utterance.onend = () => {
      window.__nac_active_utterances__.delete(utterance);
      clearInterval(keepAliveTimer);
      if (isPlaying && !isPaused) {
        // Natural paragraph breathing pause
        const pauseDelay = parseInt(settings.paragraphPauseMs || 300, 10);
        setTimeout(() => {
          if (isPlaying && !isPaused) {
            playParagraph(currentIdx + 1);
          }
        }, pauseDelay);
      }
    };

    utterance.onerror = (e) => {
      window.__nac_active_utterances__.delete(utterance);
      clearInterval(keepAliveTimer);
      console.warn('[NAC] Speech utterance error:', e);
      if (isPlaying && !isPaused) {
        playParagraph(currentIdx + 1);
      }
    };

    window.speechSynthesis.speak(utterance);

    // Chromium 15s freeze fix: pulse pause/resume heartbeat
    keepAliveTimer = setInterval(() => {
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 10000);
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
    clearInterval(keepAliveTimer);
    window.speechSynthesis.cancel();
    window.__nac_active_utterances__.clear();
    clearHighlight();
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

  // --- 9. Hardware Media Session API ---
  function updateMediaSession() {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: chapterTitle || 'Web Novel Chapter',
        artist: novelTitle || 'Novel Audio Companion',
        album: 'Novel Audio Companion'
      });

      navigator.mediaSession.playbackState = isPlaying ? (isPaused ? 'paused' : 'playing') : 'none';

      navigator.mediaSession.setActionHandler('play', () => resumePlayback());
      navigator.mediaSession.setActionHandler('pause', () => pausePlayback());
      navigator.mediaSession.setActionHandler('previoustrack', () => prevParagraph());
      navigator.mediaSession.setActionHandler('nexttrack', () => nextParagraph());
      navigator.mediaSession.setActionHandler('seekforward', () => {
        playParagraph(Math.min(paragraphs.length - 1, currentIdx + 3));
      });
      navigator.mediaSession.setActionHandler('seekbackward', () => {
        playParagraph(Math.max(0, currentIdx - 3));
      });
    }
  }

  function notifyBadge(text) {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage({ action: 'NAC_SET_BADGE', text, color: '#6366f1' });
      }
    } catch (e) {}
  }

  // --- 10. Sleep Timer ---
  function setSleepTimer(minutes) {
    clearInterval(sleepIntervalId);
    clearTimeout(sleepTimerId);

    if (minutes <= 0) {
      sleepSecondsRemaining = 0;
      updateSleepBadge(0);
      showToast('Sleep timer disabled');
      return;
    }

    sleepSecondsRemaining = minutes * 60;
    updateSleepBadge(sleepSecondsRemaining);
    showToast(`Sleep timer set for ${minutes} minutes`);

    sleepIntervalId = setInterval(() => {
      sleepSecondsRemaining--;
      updateSleepBadge(sleepSecondsRemaining);

      // In the final 30 seconds, smoothly fade volume to zero
      if (sleepSecondsRemaining <= 30 && sleepSecondsRemaining > 0) {
        if (activeUtterance) {
          activeUtterance.volume = Math.max(0, sleepSecondsRemaining / 30);
        }
      }

      if (sleepSecondsRemaining <= 0) {
        clearInterval(sleepIntervalId);
        stopPlayback();
        showToast('💤 Sleep timer reached. Audio stopped.');
      }
    }, 1000);
  }

  function updateSleepBadge(seconds) {
    const sleepBtn = playerContainer?.querySelector('#nac-sleep-btn');
    if (!sleepBtn) return;

    if (seconds <= 0) {
      sleepBtn.innerHTML = '⏱️ Sleep';
      sleepBtn.classList.remove('active');
    } else {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      sleepBtn.innerHTML = `⏳ ${m}:${s < 10 ? '0' : ''}${s}`;
      sleepBtn.classList.add('active');
    }
  }

  // --- 11. Next Chapter Discovery ---
  function findNextChapterLink() {
    const allLinks = Array.from(document.querySelectorAll('a'));

    // 1. rel="next"
    const relNext = document.querySelector('a[rel="next"], link[rel="next"]');
    if (relNext && relNext.href) return relNext.href;

    // 2. Verified arrow '»' or '›'
    const arrowLink = allLinks.find(a => {
      const t = a.textContent.trim();
      return (t === '»' || t === '›' || t === 'Next »' || t === 'Next >') && a.href && a.href !== window.location.href;
    });
    if (arrowLink) return arrowLink.href;

    // 3. Class patterns
    const classNext = document.querySelector('.nav-next a, .next-chapter a, a.next-chapter, a.next, a.btn-next, .btn-next a');
    if (classNext && classNext.href) return classNext.href;

    // 4. URL number increment: /chapter/12 -> /chapter/13
    const match = window.location.pathname.match(/\/chapter[_-]?(\d+)/i);
    if (match) {
      const currentNum = parseInt(match[1], 10);
      const nextNum = currentNum + 1;
      const numLink = allLinks.find(a => a.href && a.href.includes(`/chapter/${nextNum}`) || a.href.includes(`/chapter-${nextNum}`));
      if (numLink) return numLink.href;
    }

    // 5. Text match
    const textNext = allLinks.find(a => {
      const t = a.textContent.trim().toLowerCase();
      return (t === 'next' || t === 'next chapter' || t === 'next →') && a.href && a.href !== window.location.href;
    });
    if (textNext) return textNext.href;

    return null;
  }

  function goToNextChapter() {
    const nextHref = findNextChapterLink();
    if (nextHref) {
      showToast('📖 Loading next chapter & continuing audio...');
      sessionStorage.setItem('nac_autoplay', 'true');
      setTimeout(() => {
        window.location.href = nextHref;
      }, 700);
    } else {
      showToast('Reached the latest chapter!');
    }
  }

  // --- 12. Distraction-Free Reader Mode ---
  let readerOverlay = null;
  let readerArticle = null;
  let isReaderActive = false;

  function createReaderMode() {
    if (readerOverlay) return;

    readerOverlay = document.createElement('div');
    readerOverlay.id = 'nac-reader-overlay';

    readerOverlay.innerHTML = `
      <div class="nac-reader-topbar">
        <button id="nac-rm-theme-btn" title="Cycle Theme (Midnight, OLED, Sepia, Light)">🎨 Theme</button>
        <button id="nac-rm-font-btn" title="Cycle Font Family">Aa Font</button>
        <button id="nac-rm-smaller-btn" title="Decrease font size">A-</button>
        <button id="nac-rm-larger-btn" title="Increase font size">A+</button>
        <button class="nac-btn-close-reader" id="nac-rm-close-btn" title="Exit Reader Mode">✕ Exit</button>
      </div>
      <article class="nac-reader-article" id="nac-reader-article-content">
        <h1>${escapeHtml(chapterTitle || 'Chapter')}</h1>
      </article>
    `;

    document.body.appendChild(readerOverlay);
    readerArticle = readerOverlay.querySelector('#nac-reader-article-content');

    // Populate with cleaned paragraphs
    paragraphs.forEach((p, idx) => {
      const cloneP = document.createElement('p');
      cloneP.textContent = p.textContent;
      cloneP.dataset.nacIndex = idx;
      cloneP.classList.add('nac-paragraph-target');
      cloneP.onclick = () => playParagraph(idx);
      readerArticle.appendChild(cloneP);
    });

    applyReaderStyles();

    // Topbar events
    readerOverlay.querySelector('#nac-rm-close-btn').addEventListener('click', toggleReaderMode);

    const themes = ['midnight', 'oled', 'sepia', 'light'];
    readerOverlay.querySelector('#nac-rm-theme-btn').addEventListener('click', () => {
      const nextTheme = themes[(themes.indexOf(settings.readerTheme) + 1) % themes.length];
      settings.readerTheme = nextTheme;
      chrome.storage.sync?.set({ readerTheme: nextTheme });
      applyReaderStyles();
    });

    const fonts = ['serif', 'sans', 'inter', 'dyslexic'];
    readerOverlay.querySelector('#nac-rm-font-btn').addEventListener('click', () => {
      const nextFont = fonts[(fonts.indexOf(settings.readerFont) + 1) % fonts.length];
      settings.readerFont = nextFont;
      chrome.storage.sync?.set({ readerFont: nextFont });
      applyReaderStyles();
    });

    readerOverlay.querySelector('#nac-rm-smaller-btn').addEventListener('click', () => {
      settings.readerFontSize = Math.max(14, (settings.readerFontSize || 19) - 1);
      chrome.storage.sync?.set({ readerFontSize: settings.readerFontSize });
      applyReaderStyles();
    });

    readerOverlay.querySelector('#nac-rm-larger-btn').addEventListener('click', () => {
      settings.readerFontSize = Math.min(28, (settings.readerFontSize || 19) + 1);
      chrome.storage.sync?.set({ readerFontSize: settings.readerFontSize });
      applyReaderStyles();
    });
  }

  function applyReaderStyles() {
    if (!readerOverlay || !readerArticle) return;

    // Remove existing classes
    readerOverlay.className = '';
    readerArticle.className = 'nac-reader-article';

    // Theme
    readerOverlay.classList.add(`nac-theme-${settings.readerTheme || 'midnight'}`);

    // Font
    readerOverlay.classList.add(`nac-font-${settings.readerFont || 'serif'}`);

    // Size, line height, max-width
    readerArticle.style.fontSize = `${settings.readerFontSize || 19}px`;
    readerArticle.style.lineHeight = settings.readerLineHeight || 1.8;
    readerArticle.style.maxWidth = `${settings.readerMaxWidth || 760}px`;
  }

  function toggleReaderMode() {
    isReaderActive = !isReaderActive;
    if (isReaderActive) {
      if (!readerOverlay) createReaderMode();
      readerOverlay.classList.add('active');
      document.body.style.overflow = 'hidden';
      highlightParagraph(currentIdx);
      showToast('📖 Reader Mode enabled (Alt+Shift+R to toggle)');
    } else {
      if (readerOverlay) readerOverlay.classList.remove('active');
      document.body.style.overflow = '';
      highlightParagraph(currentIdx);
      showToast('Exited Reader Mode');
    }
  }

  // --- 13. Floating Island UI & Minimized Orb ---
  let playerContainer = null;
  let minimizedOrb = null;
  let playBtn = null;
  let progressLabel = null;
  let progressTime = null;
  let voiceSelect = null;
  let speedSelect = null;
  let eqVisualizer = null;

  function createUI() {
    playerContainer = document.createElement('div');
    playerContainer.id = 'nac-player-container';

    playerContainer.innerHTML = `
      <div class="nac-island-card">
        <div class="nac-drag-handle" title="Drag to reposition player">⋮⋮</div>

        <button class="nac-btn" id="nac-prev-btn" title="Previous paragraph (Alt+Shift+Left)">⏮</button>
        <button class="nac-btn nac-btn-play" id="nac-play-btn" title="Play / Pause (Space or Alt+Shift+P)">▶</button>
        <button class="nac-btn" id="nac-next-btn" title="Next paragraph (Alt+Shift+Right)">⏭</button>

        <div class="nac-progress-pill" id="nac-progress-pill" title="Click to view chapter progress">
          <span class="nac-progress-label" id="nac-progress-label">0 / ${paragraphs.length}</span>
          <span class="nac-progress-time" id="nac-progress-time">-- min left</span>
        </div>

        <select class="nac-select" id="nac-voice-select" title="Voice Selection"></select>

        <select class="nac-select" id="nac-speed-select" title="Reading Speed" style="max-width: 78px;">
          <option value="0.75">0.75x</option>
          <option value="0.9">0.9x</option>
          <option value="1.0">1.0x</option>
          <option value="1.2">1.2x</option>
          <option value="1.4">1.4x</option>
          <option value="1.6">1.6x</option>
          <option value="1.8">1.8x</option>
          <option value="2.0">2.0x</option>
        </select>

        <button class="nac-pill-btn" id="nac-sleep-btn" title="Sleep Timer (15m, 30m, 45m)">
          ⏱️ Sleep
        </button>

        <button class="nac-pill-btn" id="nac-reader-btn" title="Toggle Clean Reader View (Alt+Shift+R)">
          📖 Reader
        </button>

        <button class="nac-btn" id="nac-settings-btn" title="Open Settings & Pronunciation Dictionary" style="font-size: 14px;">
          ⚙️
        </button>

        <button class="nac-btn" id="nac-minimize-btn" title="Minimize floating player" style="width: 28px; height: 28px; font-size: 13px;">—</button>
      </div>
    `;

    document.body.appendChild(playerContainer);

    // Minimized Orb with animated equalizer soundbars
    minimizedOrb = document.createElement('div');
    minimizedOrb.className = 'nac-minimized-orb';
    minimizedOrb.title = 'Open Novel Audio Companion';
    minimizedOrb.innerHTML = `
      <div class="nac-orb-content">
        <div class="nac-equalizer" id="nac-equalizer">
          <span class="nac-eq-bar"></span>
          <span class="nac-eq-bar"></span>
          <span class="nac-eq-bar"></span>
          <span class="nac-eq-bar"></span>
        </div>
        <span class="nac-orb-icon">🎧</span>
      </div>
    `;
    document.body.appendChild(minimizedOrb);

    // Query UI elements
    playBtn = playerContainer.querySelector('#nac-play-btn');
    progressLabel = playerContainer.querySelector('#nac-progress-label');
    progressTime = playerContainer.querySelector('#nac-progress-time');
    voiceSelect = playerContainer.querySelector('#nac-voice-select');
    speedSelect = playerContainer.querySelector('#nac-speed-select');
    eqVisualizer = minimizedOrb.querySelector('#nac-equalizer');

    speedSelect.value = (settings.rate || 1.0).toString();

    // Event Handlers
    playBtn.addEventListener('click', () => {
      if (!isPlaying) {
        playParagraph(currentIdx);
      } else if (isPaused) {
        resumePlayback();
      } else {
        pausePlayback();
      }
    });

    playerContainer.querySelector('#nac-prev-btn').addEventListener('click', prevParagraph);
    playerContainer.querySelector('#nac-next-btn').addEventListener('click', nextParagraph);

    voiceSelect.addEventListener('change', (e) => {
      selectedVoice = voices.find(v => v.voiceURI === e.target.value) || null;
      if (selectedVoice) {
        settings.voiceURI = selectedVoice.voiceURI;
        chrome.storage.sync?.set({ voiceURI: selectedVoice.voiceURI });
      }
      if (isPlaying && !isPaused) {
        playParagraph(currentIdx);
      }
    });

    speedSelect.addEventListener('change', (e) => {
      const rate = parseFloat(e.target.value);
      settings.rate = rate;
      chrome.storage.sync?.set({ rate });
      if (isPlaying && !isPaused) {
        playParagraph(currentIdx);
      }
    });

    // Sleep Timer cycler
    const sleepDurations = [0, 15, 30, 45, 60];
    let currentSleepIdx = 0;
    playerContainer.querySelector('#nac-sleep-btn').addEventListener('click', () => {
      currentSleepIdx = (currentSleepIdx + 1) % sleepDurations.length;
      setSleepTimer(sleepDurations[currentSleepIdx]);
    });

    // Reader Mode toggle
    playerContainer.querySelector('#nac-reader-btn').addEventListener('click', toggleReaderMode);

    // Open options
    playerContainer.querySelector('#nac-settings-btn').addEventListener('click', () => {
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
          chrome.runtime.sendMessage({ action: 'NAC_OPEN_OPTIONS' });
        }
      } catch (e) {}
    });

    // Minimize & Restore
    playerContainer.querySelector('#nac-minimize-btn').addEventListener('click', () => {
      playerContainer.style.display = 'none';
      minimizedOrb.style.display = 'flex';
    });

    minimizedOrb.addEventListener('click', () => {
      minimizedOrb.style.display = 'none';
      playerContainer.style.display = 'block';
    });

    // Make floating container draggable
    makeDraggable(playerContainer);

    // Keyboard shortcuts: Space (Play/Pause), Alt+Left, Alt+Right
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
      if (e.code === 'Space') {
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
        try {
          handle.releasePointerCapture(e.pointerId);
        } catch (err) {}
      }
    });
  }

  function populateVoiceSelect() {
    if (!voiceSelect || !voices.length) return;
    voiceSelect.innerHTML = '';

    voices.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.voiceURI;
      let label = v.name.replace(/Microsoft /g, '').replace(/ Online \(Natural\)/g, ' (Natural)');
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
      if (eqVisualizer) eqVisualizer.classList.add('active');
    } else {
      playBtn.textContent = '▶';
      playBtn.classList.remove('playing');
      if (eqVisualizer) eqVisualizer.classList.remove('active');
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
  }

  function showToast(msg) {
    const existing = document.querySelector('.nac-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'nac-toast';
    toast.innerHTML = `<span>${escapeHtml(msg)}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3200);
  }

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

  // --- 14. Extension Message Listener (Popup & Background Dispatcher) ---
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
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
        settings.rate = parseFloat(req.speed);
        if (speedSelect) speedSelect.value = settings.rate.toString();
        if (isPlaying && !isPaused) playParagraph(currentIdx);
        sendResponse({ success: true });
        return true;
      }

      if (req.action === 'SET_AUTONEXT') {
        settings.autoNext = !!req.autoNext;
        showToast(settings.autoNext ? 'Auto-Next chapter enabled' : 'Auto-Next disabled');
        sendResponse({ success: true });
        return true;
      }

      if (req.action === 'CLEAN_DOM_NOW') {
        if (novelContainer) sanitizeNovelContent(novelContainer);
        showToast('🛡️ Ads and overlay traps sanitized!');
        sendResponse({ success: true });
        return true;
      }

      if (req.action === 'READ_SELECTION' && req.text) {
        window.speechSynthesis.cancel();
        const utt = new SpeechSynthesisUtterance(applyDictionary(req.text));
        if (selectedVoice) utt.voice = selectedVoice;
        utt.rate = settings.rate || 1.0;
        window.speechSynthesis.speak(utt);
        showToast('🔊 Reading selection');
        sendResponse({ success: true });
        return true;
      }

      return false;
    });
  }

  // --- 15. Main Initialization ---
  async function init() {
    await initSettings();

    novelContainer = findNovelContainer();
    if (!novelContainer) return;

    // 1. Sanitize ads immediately
    sanitizeNovelContent(novelContainer);

    // 2. Extract Titles
    extractTitles();

    // 3. Index Paragraphs & attach Click-to-Read
    initParagraphs(novelContainer);

    // 4. Build Floating Island UI
    createUI();

    // 5. Load Voices
    loadVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = loadVoices;
    }

    // 6. Check if autoplaying from previous chapter
    if (sessionStorage.getItem('nac_autoplay') === 'true') {
      sessionStorage.removeItem('nac_autoplay');
      setTimeout(() => {
        playParagraph(0);
        showToast(`📖 Continuing ${chapterTitle || 'next chapter'}...`);
      }, 1000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
