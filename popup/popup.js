// Novel Audio Companion - Popup Logic (Universal Standards & Store Compliant)
'use strict';

document.addEventListener('DOMContentLoaded', async () => {
  // UI Elements
  const statusLabel = document.getElementById('nac-status-label');
  const pulseIndicator = document.getElementById('nac-pulse-indicator');
  const chapterTitle = document.getElementById('nac-chapter-title');
  const novelMeta = document.getElementById('nac-novel-meta');
  const progressFill = document.getElementById('nac-progress-fill');
  const progressText = document.getElementById('nac-progress-text');
  const timeRemaining = document.getElementById('nac-time-remaining');

  const btnPrev = document.getElementById('nac-btn-prev');
  const btnPlay = document.getElementById('nac-btn-play');
  const btnNext = document.getElementById('nac-btn-next');
  const speedChips = document.querySelectorAll('.nac-chip');
  const toggleAutoNext = document.getElementById('nac-toggle-autonext');
  const btnToggleReader = document.getElementById('nac-toggle-reader-btn');
  const btnCleanDom = document.getElementById('nac-clean-dom-btn');
  const btnSettings = document.getElementById('nac-open-settings');

  // 1. Immediately load and apply user settings from storage regardless of tab state
  let currentSettings = { autoNext: true, rate: 1.0 };
  try {
    const stored = await chrome.storage.sync.get(['autoNext', 'rate']);
    if (stored.autoNext !== undefined) currentSettings.autoNext = stored.autoNext;
    if (stored.rate !== undefined) currentSettings.rate = stored.rate;
  } catch (e) {
    console.debug('[NAC Popup] Storage read fallback:', e);
  }

  // Reflect stored Auto-Next toggle immediately
  toggleAutoNext.checked = currentSettings.autoNext !== false;

  // Reflect stored speed immediately
  const currentRate = parseFloat(currentSettings.rate || 1.0);
  speedChips.forEach(chip => {
    const chipSpeed = parseFloat(chip.dataset.speed);
    chip.classList.toggle('active', Math.abs(chipSpeed - currentRate) < 0.05);
  });

  // 2. Query active tab safely
  let activeTab = null;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    activeTab = tab;
  } catch (e) {}

  // 3. Connect to content script if available on active tab
  if (activeTab && activeTab.id && activeTab.url && !activeTab.url.startsWith('chrome://') && !activeTab.url.startsWith('edge://') && !activeTab.url.startsWith('chrome-extension://')) {
    try {
      const response = await chrome.tabs.sendMessage(activeTab.id, { action: 'GET_STATE' });
      if (response && response.isNovel) {
        applyState(response);
      } else {
        setStandbyState('Novel content will be auto-detected on chapter pages.');
      }
    } catch (_) {
      setStandbyState('Novel Companion is ready. Open a novel chapter to begin.');
    }
  } else {
    setStandbyState('Novel Companion is active on web novel sites.');
  }

  function applyState(state) {
    pulseIndicator.classList.add('active');
    statusLabel.textContent = state.isPlaying ? (state.isPaused ? 'Paused' : 'Playing') : 'Ready to read';

    chapterTitle.textContent = state.chapterTitle || 'Chapter Detected';
    novelMeta.textContent = state.novelTitle || activeTab?.title || (activeTab?.url ? new URL(activeTab.url).hostname : 'Web Novel');

    const total = state.totalParagraphs || 0;
    const current = state.currentIdx !== undefined ? state.currentIdx + 1 : 0;
    const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;

    progressFill.style.width = `${pct}%`;
    progressText.textContent = `${current} / ${total} paragraphs (${pct}%)`;

    const remainingParas = Math.max(0, total - current);
    const estMinutes = Math.ceil((remainingParas * 35) / (200 * (state.rate || 1.0)));
    timeRemaining.textContent = remainingParas > 0 ? `~${estMinutes} min left` : 'Completed';

    if (state.isPlaying && !state.isPaused) {
      btnPlay.textContent = '⏸';
      btnPlay.title = 'Pause (Alt+Shift+P)';
    } else {
      btnPlay.textContent = '▶';
      btnPlay.title = 'Play (Alt+Shift+P)';
    }

    if (state.autoNext !== undefined) {
      toggleAutoNext.checked = Boolean(state.autoNext);
    }
  }

  function setStandbyState(msg) {
    pulseIndicator.classList.remove('active');
    statusLabel.textContent = 'Standby';
    chapterTitle.textContent = 'Novel Audio Companion';
    novelMeta.textContent = msg;
    progressFill.style.width = '0%';
    progressText.textContent = '0 paragraphs';
    timeRemaining.textContent = '--';
  }

  // --- Controls Handlers (Always Attached Unconditionally) ---
  btnSettings.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  toggleAutoNext.addEventListener('change', async (e) => {
    const autoNext = e.target.checked;
    await chrome.storage.sync.set({ autoNext });
    if (activeTab?.id) {
      try {
        await chrome.tabs.sendMessage(activeTab.id, { action: 'SET_AUTONEXT', autoNext });
      } catch (_) {}
    }
  });

  speedChips.forEach(chip => {
    chip.addEventListener('click', async () => {
      const speed = parseFloat(chip.dataset.speed);
      speedChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');

      await chrome.storage.sync.set({ rate: speed });
      if (activeTab?.id) {
        try {
          await chrome.tabs.sendMessage(activeTab.id, { action: 'SET_SPEED', speed });
        } catch (_) {}
      }
    });
  });

  btnPlay.addEventListener('click', async () => {
    if (!activeTab?.id) return;
    try {
      const resp = await chrome.tabs.sendMessage(activeTab.id, { action: 'CMD_TOGGLE_PLAY' });
      if (resp) applyState(resp);
    } catch (_) {}
  });

  btnPrev.addEventListener('click', async () => {
    if (!activeTab?.id) return;
    try {
      const resp = await chrome.tabs.sendMessage(activeTab.id, { action: 'CMD_PREV_PARAGRAPH' });
      if (resp) applyState(resp);
    } catch (_) {}
  });

  btnNext.addEventListener('click', async () => {
    if (!activeTab?.id) return;
    try {
      const resp = await chrome.tabs.sendMessage(activeTab.id, { action: 'CMD_NEXT_PARAGRAPH' });
      if (resp) applyState(resp);
    } catch (_) {}
  });

  btnToggleReader.addEventListener('click', async () => {
    if (!activeTab?.id) return;
    try {
      await chrome.tabs.sendMessage(activeTab.id, { action: 'TOGGLE_READER_MODE' });
      window.close();
    } catch (_) {}
  });

  btnCleanDom.addEventListener('click', async () => {
    if (!activeTab?.id) return;
    try {
      await chrome.tabs.sendMessage(activeTab.id, { action: 'CLEAN_DOM_NOW' });
      btnCleanDom.textContent = '✓ Cleaned!';
      setTimeout(() => { btnCleanDom.textContent = 'Clean'; }, 1500);
    } catch (_) {}
  });
});
