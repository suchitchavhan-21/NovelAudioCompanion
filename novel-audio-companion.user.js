// ==UserScript==
// @name         Novel Audio Companion & Clean Reader Pro
// @namespace    https://github.com/suchitchavhan-21/NovelAudioCompanion
// @version      2.0.0
// @description  Text-to-speech companion and distraction-free reader for web novels. Natural voices, ad killer, auto-next chapter & phonetic dictionary.
// @author       Suchit Chavhan
// @match        https://*.isotls.com/*
// @match        https://isotls.com/*
// @match        https://www.royalroad.com/fiction/*
// @match        https://www.wuxiaworld.com/novel/*
// @match        https://www.scribblehub.com/read/*
// @match        https://*/*novel*/*
// @match        https://*/*chapter*/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  if (window.__NAC_USERSCRIPT_INITIALIZED__) return;
  window.__NAC_USERSCRIPT_INITIALIZED__ = true;

  // Protect speech utterances from Chromium garbage collection bug
  window.__nac_active_utterances__ = new Set();

  // --- Inject Refined Humanized Styling ---
  const style = document.createElement('style');
  style.textContent = `
    .nac-highlight-active {
      background: rgba(37, 99, 235, 0.12) !important;
      border-left: 4px solid #3b82f6 !important;
      border-radius: 4px !important;
      padding-left: 12px !important;
      padding-top: 4px !important;
      padding-bottom: 4px !important;
      transition: background-color 0.2s ease !important;
    }
    .nac-word-active {
      background: rgba(245, 158, 11, 0.32) !important;
      color: inherit !important;
      border-radius: 2px !important;
      padding: 0 2px !important;
    }
    .nac-paragraph-target {
      cursor: pointer !important;
      position: relative !important;
      transition: background-color 0.15s ease !important;
    }
    .nac-paragraph-target:hover {
      background: rgba(255, 255, 255, 0.03) !important;
    }
    #nac-player-container {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 2147483640;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      user-select: none;
      touch-action: none;
    }
    .nac-island-card {
      display: flex;
      align-items: center;
      gap: 8px;
      background: rgba(13, 17, 23, 0.94);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 40px;
      padding: 6px 14px;
      box-shadow: 0 16px 36px rgba(0, 0, 0, 0.55);
      color: #f1f5f9;
    }
    .nac-drag-handle {
      cursor: grab;
      padding: 0 4px;
      color: #64748b;
      font-size: 13px;
    }
    .nac-drag-handle:active { cursor: grabbing; }
    .nac-btn {
      background: transparent;
      border: none;
      color: #cbd5e1;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      width: 34px;
      height: 34px;
      font-size: 14px;
      transition: background 0.15s, color 0.15s, transform 0.15s;
    }
    .nac-btn:hover {
      background: rgba(255, 255, 255, 0.12);
      color: #ffffff;
      transform: scale(1.04);
    }
    .nac-btn:active { transform: scale(0.96); }
    .nac-btn-play {
      background: #2563eb;
      color: white;
      width: 38px;
      height: 38px;
      font-size: 16px;
      box-shadow: 0 2px 8px rgba(37, 99, 235, 0.4);
    }
    .nac-btn-play:hover { background: #1d4ed8; }
    .nac-btn-play.playing { background: #059669; }
    .nac-progress-pill {
      display: flex;
      flex-direction: column;
      gap: 1px;
      padding: 3px 9px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      min-width: 80px;
      text-align: center;
    }
    .nac-progress-label { font-size: 11px; font-weight: 600; color: #e2e8f0; }
    .nac-progress-time { font-size: 10px; color: #94a3b8; }
    .nac-select {
      background: #1e293b;
      color: #f1f5f9;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 14px;
      padding: 4px 8px;
      font-size: 12px;
      outline: none;
      cursor: pointer;
      max-width: 140px;
    }
    .nac-pill-btn {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #cbd5e1;
      padding: 4px 10px;
      border-radius: 14px;
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
    }
    .nac-pill-btn:hover { background: rgba(255, 255, 255, 0.14); color: #fff; }
    .nac-toast {
      position: fixed;
      bottom: 84px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(15, 23, 42, 0.92);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #f8fafc;
      font-size: 13px;
      font-weight: 500;
      padding: 8px 16px;
      border-radius: 20px;
      z-index: 2147483647;
      pointer-events: none;
    }
  `;
  document.head.appendChild(style);

  // --- Runtime Settings ---
  let rate = 1.0;
  let autoNext = true;
  let wordHighlight = true;
  let novelContainer = null;
  let paragraphs = [];
  let currentIdx = 0;
  let isPlaying = false;
  let isPaused = false;
  let activeUtterance = null;
  let utteranceStartTime = 0;
  let keepAliveInterval = null;
  let activeWordModifiedEl = null;
  let activeWordOriginalContent = null;
  let voices = [];
  let selectedVoice = null;

  // Dictionary rules (Clean JS regex strings)
  const dictionaryRules = [
    { pattern: 'Qi', replacement: 'Chee', isRegex: false },
    { pattern: 'Dao', replacement: 'Dow', isRegex: false },
    { pattern: 'Dantian', replacement: 'Dahn-tee-en', isRegex: false },
    { pattern: 'Xianxia', replacement: 'Shee-ahn-shee-ah', isRegex: false },
    { pattern: 'Wuxia', replacement: 'Woo-shee-ah', isRegex: false },
    { pattern: '\\[(Status|Level|Stats|HP|MP|Skill|Quest)[^\\]]*\\]', replacement: 'Status window:', isRegex: true }
  ];

  function applyDictionary(text) {
    if (!text) return '';
    let res = text;
    for (const rule of dictionaryRules) {
      try {
        if (rule.isRegex) {
          const re = new RegExp(rule.pattern, 'gi');
          res = res.replace(re, rule.replacement);
        } else {
          const escaped = rule.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const re = new RegExp(`\\b${escaped}\\b`, 'gi');
          res = res.replace(re, rule.replacement);
        }
      } catch (_) {}
    }
    return res;
  }

  function findNovelContainer() {
    const selectors = [
      'div.content.flow-md', 'article.flow-lg', '.chapter-inner',
      '.chapter-content', '#chp_raw', '.chp_contents', '#chapter-container',
      '#chr-content', '.chr-c', '.cha-content', '.chapter-entity',
      '#arrticle', '.chapter-content3', '.reading-content', 'div.entry-content'
    ];

    for (const s of selectors) {
      try {
        const el = document.querySelector(s);
        if (el && el.querySelectorAll('p').length >= 3) return el;
      } catch (_) {}
    }

    const candidates = Array.from(document.querySelectorAll('article, main, section, div'));
    let best = null, maxScore = 0;
    for (const c of candidates) {
      const pTags = c.querySelectorAll('p');
      if (pTags.length < 3) continue;
      const valid = Array.from(pTags).filter(p => (p.textContent || '').trim().length > 25).length;
      if (valid > maxScore) {
        maxScore = valid;
        best = c;
      }
    }
    return maxScore >= 3 ? best : null;
  }

  function restoreActiveWordDom() {
    if (activeWordModifiedEl && activeWordOriginalContent !== null) {
      activeWordModifiedEl.innerHTML = activeWordOriginalContent;
      activeWordModifiedEl = null;
      activeWordOriginalContent = null;
    }
  }

  function playParagraph(idx) {
    if (idx < 0) idx = 0;
    if (idx >= paragraphs.length) {
      stopPlayback();
      if (autoNext) goToNextChapter();
      return;
    }

    currentIdx = idx;
    isPlaying = true;
    isPaused = false;
    updateUI();

    paragraphs.forEach((p, i) => {
      if (i === idx) {
        p.classList.add('nac-highlight-active');
        p.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        p.classList.remove('nac-highlight-active');
      }
    });

    window.speechSynthesis.cancel();
    clearInterval(keepAliveInterval);
    window.__nac_active_utterances__.clear();
    restoreActiveWordDom();

    const rawText = (paragraphs[currentIdx].textContent || '').trim();
    if (!rawText) {
      playParagraph(currentIdx + 1);
      return;
    }

    const textToSpeak = applyDictionary(rawText);
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    activeUtterance = utterance;
    utteranceStartTime = Date.now();
    window.__nac_active_utterances__.add(utterance);

    if (selectedVoice) utterance.voice = selectedVoice;
    utterance.rate = rate;

    // Word tracking setup
    if (wordHighlight && paragraphs[currentIdx]) {
      const words = textToSpeak.split(/\s+/).filter(Boolean);
      if (words.length > 1) {
        activeWordModifiedEl = paragraphs[currentIdx];
        activeWordOriginalContent = paragraphs[currentIdx].innerHTML;

        const frag = document.createDocumentFragment();
        words.forEach((w, i) => {
          const span = document.createElement('span');
          span.className = 'nac-word';
          span.dataset.wordIdx = i;
          span.textContent = w + ' ';
          frag.appendChild(span);
        });
        paragraphs[currentIdx].innerHTML = '';
        paragraphs[currentIdx].appendChild(frag);

        let activeSpan = null;
        utterance.onboundary = (e) => {
          if (e.name === 'word') {
            const wordSpans = paragraphs[currentIdx].querySelectorAll('.nac-word');
            let charAcc = 0;
            for (let i = 0; i < words.length; i++) {
              const len = words[i].length + 1;
              if (e.charIndex >= charAcc && e.charIndex < charAcc + len) {
                if (activeSpan) activeSpan.classList.remove('nac-word-active');
                if (wordSpans[i]) {
                  activeSpan = wordSpans[i];
                  activeSpan.classList.add('nac-word-active');
                }
                break;
              }
              charAcc += len;
            }
          }
        };
      }
    }

    utterance.onend = () => {
      restoreActiveWordDom();
      window.__nac_active_utterances__.delete(utterance);
      clearInterval(keepAliveInterval);
      if (isPlaying && !isPaused) {
        setTimeout(() => {
          if (isPlaying && !isPaused) playParagraph(currentIdx + 1);
        }, 280);
      }
    };

    utterance.onerror = () => {
      restoreActiveWordDom();
      window.__nac_active_utterances__.delete(utterance);
      clearInterval(keepAliveInterval);
      if (isPlaying && !isPaused) playParagraph(currentIdx + 1);
    };

    window.speechSynthesis.speak(utterance);

    // Keep-alive: only pulse if single utterance exceeds 12s
    keepAliveInterval = setInterval(() => {
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        if (Date.now() - utteranceStartTime > 12000) {
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
          utteranceStartTime = Date.now();
        }
      }
    }, 3000);
  }

  function pausePlayback() {
    if (isPlaying && !isPaused) {
      window.speechSynthesis.pause();
      isPaused = true;
      updateUI();
    }
  }

  function resumePlayback() {
    if (isPlaying && isPaused) {
      window.speechSynthesis.resume();
      isPaused = false;
      updateUI();
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
    restoreActiveWordDom();
    paragraphs.forEach(p => p.classList.remove('nac-highlight-active'));
    updateUI();
  }

  function goToNextChapter() {
    const cur = window.location.href.split('#')[0];
    const relNext = document.querySelector('a[rel="next"], link[rel="next"]');
    let target = (relNext && relNext.href && relNext.href.split('#')[0] !== cur) ? relNext.href : null;

    if (!target) {
      const nextBtn = document.querySelector('.next-chapter a, a.next-chapter, a.next, a.btn-next');
      if (nextBtn && nextBtn.href && nextBtn.href.split('#')[0] !== cur) target = nextBtn.href;
    }

    if (target && /^https?:\/\//i.test(target)) {
      showToast('📖 Next chapter loading...');
      sessionStorage.setItem('nac_autoplay', JSON.stringify({ origin: window.location.origin, timestamp: Date.now() }));
      setTimeout(() => { window.location.href = target; }, 600);
    }
  }

  function showToast(msg) {
    const existing = document.querySelector('.nac-toast');
    if (existing) existing.remove();
    const t = document.createElement('div');
    t.className = 'nac-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }

  // --- UI Creation ---
  let playerContainer = null;
  let playBtn = null;
  let progressLabel = null;
  let progressTime = null;

  function createUI() {
    playerContainer = document.createElement('div');
    playerContainer.id = 'nac-player-container';
    playerContainer.innerHTML = `
      <div class="nac-island-card">
        <div class="nac-drag-handle" title="Drag player">⋮⋮</div>
        <button class="nac-btn" id="nac-prev-btn" title="Previous paragraph">⏮</button>
        <button class="nac-btn nac-btn-play" id="nac-play-btn" title="Play / Pause">▶</button>
        <button class="nac-btn" id="nac-next-btn" title="Next paragraph">⏭</button>
        <div class="nac-progress-pill">
          <span class="nac-progress-label" id="nac-progress-label">0 / ${paragraphs.length}</span>
          <span class="nac-progress-time" id="nac-progress-time">-- min</span>
        </div>
        <select class="nac-select" id="nac-voice-select"></select>
        <select class="nac-select" id="nac-speed-select">
          <option value="0.75">0.75x</option>
          <option value="1.0" selected>1.0x</option>
          <option value="1.2">1.2x</option>
          <option value="1.5">1.5x</option>
          <option value="2.0">2.0x</option>
        </select>
      </div>
    `;
    document.body.appendChild(playerContainer);

    playBtn = playerContainer.querySelector('#nac-play-btn');
    progressLabel = playerContainer.querySelector('#nac-progress-label');
    progressTime = playerContainer.querySelector('#nac-progress-time');
    const voiceSelect = playerContainer.querySelector('#nac-voice-select');
    const speedSelect = playerContainer.querySelector('#nac-speed-select');

    playBtn.onclick = () => {
      if (!isPlaying) playParagraph(currentIdx);
      else if (isPaused) resumePlayback();
      else pausePlayback();
    };

    playerContainer.querySelector('#nac-prev-btn').onclick = () => {
      if (currentIdx > 0) playParagraph(currentIdx - 1);
    };

    playerContainer.querySelector('#nac-next-btn').onclick = () => {
      if (currentIdx < paragraphs.length - 1) playParagraph(currentIdx + 1);
      else if (autoNext) goToNextChapter();
    };

    speedSelect.onchange = (e) => {
      rate = parseFloat(e.target.value);
      if (isPlaying && !isPaused) playParagraph(currentIdx);
    };

    // Populate voices
    function initVoices() {
      voices = window.speechSynthesis.getVoices() || [];
      voiceSelect.innerHTML = '';
      voices.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.voiceURI;
        opt.textContent = `${v.name.replace(/Microsoft | Online \(Natural\)/g, '')} (${v.lang})`;
        voiceSelect.appendChild(opt);
      });
      selectedVoice = voices.find(v => /natural|neural/i.test(v.name) && v.lang.startsWith('en')) || voices[0] || null;
      if (selectedVoice) voiceSelect.value = selectedVoice.voiceURI;
    }

    initVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) speechSynthesis.onvoiceschanged = initVoices;

    voiceSelect.onchange = (e) => {
      selectedVoice = voices.find(v => v.voiceURI === e.target.value) || null;
      if (isPlaying && !isPaused) playParagraph(currentIdx);
    };

    // Draggable
    const handle = playerContainer.querySelector('.nac-drag-handle');
    let dragging = false, sx = 0, sy = 0, il = 0, it = 0;
    handle.onpointerdown = (e) => {
      dragging = true;
      handle.setPointerCapture(e.pointerId);
      sx = e.clientX; sy = e.clientY;
      const rect = playerContainer.getBoundingClientRect();
      il = rect.left; it = rect.top;
      playerContainer.style.transform = 'none';
      playerContainer.style.left = `${il}px`;
      playerContainer.style.top = `${it}px`;
      playerContainer.style.bottom = 'auto';
    };
    handle.onpointermove = (e) => {
      if (!dragging) return;
      playerContainer.style.left = `${Math.max(10, Math.min(window.innerWidth - 300, il + e.clientX - sx))}px`;
      playerContainer.style.top = `${Math.max(10, Math.min(window.innerHeight - 80, it + e.clientY - sy))}px`;
    };
    handle.onpointerup = (e) => {
      dragging = false;
      try { handle.releasePointerCapture(e.pointerId); } catch (_) {}
    };
  }

  function updateUI() {
    if (!playBtn) return;
    playBtn.textContent = (isPlaying && !isPaused) ? '⏸' : '▶';
    playBtn.classList.toggle('playing', isPlaying && !isPaused);
    if (progressLabel) progressLabel.textContent = `${currentIdx + 1} / ${paragraphs.length}`;
    if (progressTime) {
      const left = Math.max(0, paragraphs.length - (currentIdx + 1));
      const estMin = Math.ceil((left * 35) / (200 * rate));
      progressTime.textContent = left > 0 ? `~${estMin}m left` : 'Finished';
    }
  }

  // --- Initialize ---
  function init() {
    novelContainer = findNovelContainer();
    if (!novelContainer) return;

    paragraphs = Array.from(novelContainer.querySelectorAll('p')).filter(p => (p.textContent || '').trim().length > 5);
    if (!paragraphs.length) return;

    paragraphs.forEach((p, idx) => {
      p.classList.add('nac-paragraph-target');
      p.onclick = (e) => {
        if (window.getSelection()?.toString().length > 0) return;
        playParagraph(idx);
      };
    });

    createUI();

    try {
      const rawHandover = sessionStorage.getItem('nac_autoplay');
      if (rawHandover) {
        sessionStorage.removeItem('nac_autoplay');
        const h = JSON.parse(rawHandover);
        if (h.origin === window.location.origin && Date.now() - h.timestamp < 30000) {
          setTimeout(() => { playParagraph(0); }, 800);
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
