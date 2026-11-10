// Novel Audio Companion - Popup Logic

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

  // Open Options page
  btnSettings.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Helper to query active tab
  async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  // Load and apply initial state from active tab
  const tab = await getActiveTab();
  if (!tab || !tab.id || tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://')) {
    setNotSupportedState('Novel Audio Companion active on web novel sites.');
    return;
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'GET_STATE' });
    if (response && response.isNovel) {
      applyState(response);
    } else {
      setNotSupportedState('No chapter content detected on this tab.');
    }
  } catch (err) {
    setNotSupportedState('Click Reader View to activate on this page.');
  }

  function applyState(state) {
    pulseIndicator.classList.add('active');
    statusLabel.textContent = state.isPlaying ? (state.isPaused ? 'Paused' : 'Playing') : 'Ready to read';
    
    chapterTitle.textContent = state.chapterTitle || 'Chapter Detected';
    novelMeta.textContent = state.novelTitle || tab.title || new URL(tab.url).hostname;

    const total = state.totalParagraphs || 0;
    const current = state.currentIdx !== undefined ? state.currentIdx + 1 : 0;
    const pct = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;

    progressFill.style.width = `${pct}%`;
    progressText.textContent = `${current} / ${total} paragraphs (${pct}%)`;

    // Estimated time calculation (~200 words per min avg)
    const remainingParas = Math.max(0, total - current);
    const estMinutes = Math.ceil((remainingParas * 35) / (200 * (state.rate || 1.0)));
    timeRemaining.textContent = remainingParas > 0 ? `~${estMinutes} min left` : 'Completed';

    // Play/Pause button
    if (state.isPlaying && !state.isPaused) {
      btnPlay.textContent = '⏸';
      btnPlay.title = 'Pause (Alt+Shift+P)';
    } else {
      btnPlay.textContent = '▶';
      btnPlay.title = 'Play (Alt+Shift+P)';
    }

    // Speed chips
    const currentRate = parseFloat(state.rate || 1.0);
    speedChips.forEach(chip => {
      const chipSpeed = parseFloat(chip.dataset.speed);
      chip.classList.toggle('active', Math.abs(chipSpeed - currentRate) < 0.05);
    });

    // Auto-Next toggle
    toggleAutoNext.checked = !!state.autoNext;
  }

  function setNotSupportedState(msg) {
    pulseIndicator.classList.remove('active');
    statusLabel.textContent = 'Standby';
    chapterTitle.textContent = 'Novel Audio Companion';
    novelMeta.textContent = msg;
    progressFill.style.width = '0%';
    progressText.textContent = '0 paragraphs';
    timeRemaining.textContent = '--';
  }

  // --- Controls Handlers ---
  btnPlay.addEventListener('click', async () => {
    try {
      const resp = await chrome.tabs.sendMessage(tab.id, { action: 'CMD_TOGGLE_PLAY' });
      if (resp) applyState(resp);
    } catch (e) {
      console.warn('Could not toggle play:', e);
    }
  });

  btnPrev.addEventListener('click', async () => {
    try {
      const resp = await chrome.tabs.sendMessage(tab.id, { action: 'CMD_PREV_PARAGRAPH' });
      if (resp) applyState(resp);
    } catch (e) {}
  });

  btnNext.addEventListener('click', async () => {
    try {
      const resp = await chrome.tabs.sendMessage(tab.id, { action: 'CMD_NEXT_PARAGRAPH' });
      if (resp) applyState(resp);
    } catch (e) {}
  });

  speedChips.forEach(chip => {
    chip.addEventListener('click', async () => {
      const speed = parseFloat(chip.dataset.speed);
      speedChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');

      await chrome.storage.sync.set({ rate: speed });
      try {
        await chrome.tabs.sendMessage(tab.id, { action: 'SET_SPEED', speed });
      } catch (e) {}
    });
  });

  toggleAutoNext.addEventListener('change', async (e) => {
    const autoNext = e.target.checked;
    await chrome.storage.sync.set({ autoNext });
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'SET_AUTONEXT', autoNext });
    } catch (e) {}
  });

  btnToggleReader.addEventListener('click', async () => {
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'TOGGLE_READER_MODE' });
      window.close();
    } catch (e) {}
  });

  btnCleanDom.addEventListener('click', async () => {
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'CLEAN_DOM_NOW' });
      btnCleanDom.textContent = '✓ Cleaned!';
      setTimeout(() => { btnCleanDom.textContent = 'Clean'; }, 1500);
    } catch (e) {}
  });
});
