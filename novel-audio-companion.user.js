// ==UserScript==
// @name         Novel Audio Companion & Clean Reader Pro
// @namespace    https://github.com/
// @version      2.0.0
// @description  Fixes Read Aloud stopping on web novels. Natural AI TTS, word tracking, ad killer, click-to-read, reader view, auto-next chapter & dictionary.
// @author       NovelAudio Team
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

  // --- Inject CSS ---
  const style = document.createElement('style');
  style.textContent = `
    .nac-highlight-active {
      background: rgba(99, 102, 241, 0.16) !important;
      border-left: 5px solid #6366f1 !important;
      border-radius: 6px !important;
      padding-left: 14px !important;
      padding-top: 6px !important;
      padding-bottom: 6px !important;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
      box-shadow: 0 0 20px rgba(99, 102, 241, 0.15) !important;
    }
    .nac-word-active {
      background: rgba(245, 158, 11, 0.35) !important;
      border-radius: 3px !important;
      padding: 1px 3px !important;
    }
    .nac-paragraph-target {
      cursor: pointer !important;
      position: relative !important;
    }
    .nac-paragraph-target:hover::after {
      content: "🔊 Click to read from here";
      position: absolute;
      right: 8px;
      top: -22px;
      background: #312e81;
      color: #e0e7ff;
      font-size: 11px;
      padding: 3px 8px;
      border-radius: 6px;
      pointer-events: none;
      opacity: 0.95;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
      z-index: 999999;
    }
    #nac-player-container {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 2147483640;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      user-select: none;
    }
    .nac-island-card {
      display: flex;
      align-items: center;
      gap: 10px;
      background: rgba(15, 23, 42, 0.92);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 44px;
      padding: 8px 16px;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.55);
      color: #f8fafc;
    }
    .nac-btn {
      background: transparent;
      border: none;
      color: #e2e8f0;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      width: 36px;
      height: 36px;
      font-size: 15px;
      transition: all 0.2s;
    }
    .nac-btn:hover {
      background: rgba(255, 255, 255, 0.14);
      transform: scale(1.06);
    }
    .nac-btn-play {
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      color: white;
      width: 44px;
      height: 44px;
      font-size: 19px;
      box-shadow: 0 4px 14px rgba(99, 102, 241, 0.45);
    }
    .nac-progress-pill {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 4px 10px;
      background: rgba(255, 255, 255, 0.06);
      border-radius: 14px;
      min-width: 90px;
      text-align: center;
    }
    .nac-progress-label { font-size: 11px; font-weight: 600; color: #e2e8f0; }
    .nac-progress-time { font-size: 10px; color: #94a3b8; }
    .nac-select {
      background: #1e293b;
      color: #f1f5f9;
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 16px;
      padding: 5px 10px;
      font-size: 12px;
      cursor: pointer;
      max-width: 155px;
    }
    .nac-pill-btn {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: #cbd5e1;
      padding: 5px 11px;
      border-radius: 16px;
      font-size: 12px;
      cursor: pointer;
    }
    .nac-minimized-orb {
      display: none;
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 52px;
      height: 52px;
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      color: white;
      border-radius: 50%;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 2147483640;
      box-shadow: 0 8px 24px rgba(99, 102, 241, 0.5);
      font-size: 22px;
    }
    .nac-toast {
      position: fixed;
      top: 24px;
      right: 24px;
      background: rgba(15, 23, 42, 0.95);
      backdrop-filter: blur(16px);
      color: #f8fafc;
      border: 1px solid rgba(99, 102, 241, 0.4);
      padding: 12px 20px;
      border-radius: 12px;
      font-size: 13px;
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.5);
      z-index: 2147483647;
    }
  `;
  document.head.appendChild(style);

  // Settings
  let playbackRate = parseFloat(localStorage.getItem('nac_rate') || '1.0');
  let autoNextEnabled = localStorage.getItem('nac_autonext') !== 'false';
  let preferredVoiceURI = localStorage.getItem('nac_voice_uri') || '';

  // Container & Content
  function findNovelContainer() {
    const selectors = [
      'div.content.flow-md',
      'article.flow-lg',
      '.chapter-inner',
      '.chapter-content',
      '#chp_raw',
      '#chapter-container',
      '#chr-content',
      '.cha-content',
      'div.entry-content',
      'article'
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.querySelectorAll('p').length >= 3) return el;
    }
    return null;
  }

  function sanitize(container) {
    if (!container) return;
    const adSelectors = [
      'span[id^="ezoic"]', 'span[data-ez-ph-id]', 'iframe[src*="ezoic"]',
      'iframe[src*="google"]', '.humix-player', 'ins.adsbygoogle', 'aside#comments'
    ];
    adSelectors.forEach(sel => {
      container.querySelectorAll(sel).forEach(el => el.remove());
      document.querySelectorAll(sel).forEach(el => { if (!container.contains(el)) el.remove(); });
    });
  }

  let paragraphs = [];
  let currentIdx = 0;
  let isPlaying = false;
  let isPaused = false;
  let keepAliveTimer = null;
  let voices = [];
  let selectedVoice = null;

  function initParagraphs(container) {
    const raw = Array.from(container.querySelectorAll('p'));
    paragraphs = raw.filter(p => {
      const t = p.textContent.trim();
      return t.length > 2 && !/report\s+chapter|stolen\s+from|read\s+only\s+at/i.test(t);
    });

    paragraphs.forEach((p, idx) => {
      p.classList.add('nac-paragraph-target');
      p.onclick = () => playParagraph(idx);
    });
  }

  function highlight(idx) {
    paragraphs.forEach((p, i) => {
      if (i === idx) {
        p.classList.add('nac-highlight-active');
        p.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        p.classList.remove('nac-highlight-active');
      }
    });
  }

  function loadVoices() {
    voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return;
    voices.sort((a, b) => {
      const aNat = a.name.includes('Natural') || a.name.includes('Online');
      const bNat = b.name.includes('Natural') || b.name.includes('Online');
      if (aNat && !bNat) return -1;
      if (!aNat && bNat) return 1;
      return a.lang.startsWith('en') ? -1 : 1;
    });

    if (preferredVoiceURI) {
      selectedVoice = voices.find(v => v.voiceURI === preferredVoiceURI);
    }
    if (!selectedVoice) {
      selectedVoice = voices.find(v => v.name.includes('Natural') && v.lang.startsWith('en')) || voices[0];
    }
    populateVoiceSelect();
  }

  function playParagraph(idx) {
    if (idx < 0) idx = 0;
    if (idx >= paragraphs.length) {
      stopPlayback();
      if (autoNextEnabled) goToNext();
      return;
    }

    currentIdx = idx;
    isPlaying = true;
    isPaused = false;
    updateUI();
    highlight(currentIdx);

    window.speechSynthesis.cancel();
    clearInterval(keepAliveTimer);

    const text = paragraphs[currentIdx].textContent.trim();
    if (!text) { playParagraph(idx + 1); return; }

    const utt = new SpeechSynthesisUtterance(text);
    if (selectedVoice) utt.voice = selectedVoice;
    utt.rate = playbackRate;

    utt.onend = () => {
      clearInterval(keepAliveTimer);
      if (isPlaying && !isPaused) {
        setTimeout(() => playParagraph(currentIdx + 1), 300);
      }
    };
    utt.onerror = () => {
      clearInterval(keepAliveTimer);
      if (isPlaying && !isPaused) playParagraph(currentIdx + 1);
    };

    window.speechSynthesis.speak(utt);

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
    clearInterval(keepAliveTimer);
    window.speechSynthesis.cancel();
    paragraphs.forEach(p => p.classList.remove('nac-highlight-active'));
    updateUI();
  }

  function findNextLink() {
    const all = Array.from(document.querySelectorAll('a'));
    const arrow = all.find(a => (a.textContent.trim() === '»' || a.textContent.trim() === 'Next >') && a.href);
    if (arrow) return arrow.href;
    const rel = document.querySelector('a[rel="next"]');
    if (rel && rel.href) return rel.href;
    const textNext = all.find(a => /next\s+chapter|next/i.test(a.textContent.trim()) && a.href && a.href !== window.location.href);
    if (textNext) return textNext.href;
    return null;
  }

  function goToNext() {
    const next = findNextLink();
    if (next) {
      showToast('📖 Loading next chapter...');
      sessionStorage.setItem('nac_autoplay', 'true');
      setTimeout(() => { window.location.href = next; }, 800);
    } else {
      showToast('Reached latest chapter!');
    }
  }

  let playerContainer, minimizedOrb, playBtn, progLabel, progTime, voiceSelect, speedSelect;

  function createUI() {
    playerContainer = document.createElement('div');
    playerContainer.id = 'nac-player-container';
    playerContainer.innerHTML = `
      <div class="nac-island-card">
        <button class="nac-btn" id="nac-prev-btn">⏮</button>
        <button class="nac-btn nac-btn-play" id="nac-play-btn">▶</button>
        <button class="nac-btn" id="nac-next-btn">⏭</button>
        <div class="nac-progress-pill">
          <span class="nac-progress-label" id="nac-prog-label">0 / ${paragraphs.length}</span>
          <span class="nac-progress-time" id="nac-prog-time">-- min left</span>
        </div>
        <select class="nac-select" id="nac-voice-sel"></select>
        <select class="nac-select" id="nac-speed-sel" style="max-width: 78px;">
          <option value="0.75">0.75x</option>
          <option value="1.0">1.0x</option>
          <option value="1.2">1.2x</option>
          <option value="1.5">1.5x</option>
          <option value="2.0">2.0x</option>
        </select>
        <button class="nac-pill-btn" id="nac-clean-btn">🛡️ Clean</button>
        <button class="nac-btn" id="nac-min-btn" style="width:28px;height:28px;font-size:12px;">—</button>
      </div>
    `;
    document.body.appendChild(playerContainer);

    minimizedOrb = document.createElement('div');
    minimizedOrb.className = 'nac-minimized-orb';
    minimizedOrb.innerHTML = '🎧';
    document.body.appendChild(minimizedOrb);

    playBtn = playerContainer.querySelector('#nac-play-btn');
    progLabel = playerContainer.querySelector('#nac-prog-label');
    progTime = playerContainer.querySelector('#nac-prog-time');
    voiceSelect = playerContainer.querySelector('#nac-voice-sel');
    speedSelect = playerContainer.querySelector('#nac-speed-sel');

    speedSelect.value = playbackRate.toString();

    playBtn.onclick = () => {
      if (!isPlaying) playParagraph(currentIdx);
      else if (isPaused) resumePlayback();
      else pausePlayback();
    };

    playerContainer.querySelector('#nac-prev-btn').onclick = () => { if (currentIdx > 0) playParagraph(currentIdx - 1); };
    playerContainer.querySelector('#nac-next-btn').onclick = () => { if (currentIdx < paragraphs.length - 1) playParagraph(currentIdx + 1); };

    voiceSelect.onchange = (e) => {
      selectedVoice = voices.find(v => v.voiceURI === e.target.value);
      if (selectedVoice) localStorage.setItem('nac_voice_uri', selectedVoice.voiceURI);
      if (isPlaying && !isPaused) playParagraph(currentIdx);
    };

    speedSelect.onchange = (e) => {
      playbackRate = parseFloat(e.target.value);
      localStorage.setItem('nac_rate', playbackRate.toString());
      if (isPlaying && !isPaused) playParagraph(currentIdx);
    };

    playerContainer.querySelector('#nac-clean-btn').onclick = () => {
      sanitize(findNovelContainer());
      showToast('🛡️ Ads and bloat sanitized!');
    };

    playerContainer.querySelector('#nac-min-btn').onclick = () => {
      playerContainer.style.display = 'none';
      minimizedOrb.style.display = 'flex';
    };

    minimizedOrb.onclick = () => {
      minimizedOrb.style.display = 'none';
      playerContainer.style.display = 'block';
    };

    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
      if (e.code === 'Space') { e.preventDefault(); playBtn.click(); }
      else if (e.altKey && e.code === 'ArrowRight') { e.preventDefault(); if (currentIdx < paragraphs.length - 1) playParagraph(currentIdx + 1); }
      else if (e.altKey && e.code === 'ArrowLeft') { e.preventDefault(); if (currentIdx > 0) playParagraph(currentIdx - 1); }
    });
  }

  function populateVoiceSelect() {
    if (!voiceSelect || !voices.length) return;
    voiceSelect.innerHTML = '';
    voices.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.voiceURI;
      opt.textContent = `${v.name.replace(/Microsoft | Online \(Natural\)/g, '')} (${v.lang})`;
      if (selectedVoice && v.voiceURI === selectedVoice.voiceURI) opt.selected = true;
      voiceSelect.appendChild(opt);
    });
  }

  function updateUI() {
    if (!playBtn) return;
    playBtn.textContent = isPlaying && !isPaused ? '⏸' : '▶';
    if (progLabel) progLabel.textContent = `${paragraphs.length > 0 ? currentIdx + 1 : 0} / ${paragraphs.length}`;
    if (progTime) {
      const rem = Math.max(0, paragraphs.length - (currentIdx + 1));
      progTime.textContent = rem > 0 ? `~${Math.ceil((rem * 35) / (200 * playbackRate))}m left` : 'Done';
    }
  }

  function showToast(msg) {
    const existing = document.querySelector('.nac-toast');
    if (existing) existing.remove();
    const t = document.createElement('div');
    t.className = 'nac-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3200);
  }

  function init() {
    const c = findNovelContainer();
    if (!c) return;
    sanitize(c);
    initParagraphs(c);
    createUI();
    loadVoices();
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = loadVoices;
    }
    if (sessionStorage.getItem('nac_autoplay') === 'true') {
      sessionStorage.removeItem('nac_autoplay');
      setTimeout(() => playParagraph(0), 1000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
