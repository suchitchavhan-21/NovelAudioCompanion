// Novel Audio Companion - Background Service Worker (Manifest V3)

const DEFAULT_SETTINGS = {
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
  voiceURI: '',
  autoNext: true,
  wordHighlight: true,
  sentencePauseMs: 120,
  paragraphPauseMs: 320,
  cleanAds: true,
  sleepTimerMinutes: 0,
  
  // Reader Mode
  readerTheme: 'midnight', // midnight, oled, sepia, light
  readerFont: 'serif',     // serif, sans, inter, dyslexic
  readerFontSize: 19,
  readerLineHeight: 1.8,
  readerMaxWidth: 760,

  // Pronunciation & phonetic replacements
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

  // Content sanitization & line skip rules
  filterRules: [
    { id: 'f1', enabled: true, pattern: '(?i)stolen\\s+from\\s+royal\\s*road', isRegex: true },
    { id: 'f2', enabled: true, pattern: '(?i)read\\s+only\\s+at\\s+[\\w.-]+', isRegex: true },
    { id: 'f3', enabled: true, pattern: '(?i)report\\s+chapter', isRegex: true },
    { id: 'f4', enabled: true, pattern: '^[\\*\\-_=~#\\s]{3,}$', isRegex: true },
    { id: 'f5', enabled: true, pattern: '(?i)support\\s+me\\s+on\\s+patreon', isRegex: true }
  ],

  // Custom user novel sites
  customSites: []
};

// --- Initialization on Install / Update ---
chrome.runtime.onInstalled.addListener(async (details) => {
  try {
    const existing = await chrome.storage.sync.get(null);
    const updates = {};
    for (const [key, val] of Object.entries(DEFAULT_SETTINGS)) {
      if (existing[key] === undefined) {
        updates[key] = val;
      }
    }
    if (Object.keys(updates).length > 0) {
      await chrome.storage.sync.set(updates);
    }

    // Set up Context Menus
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: 'nac_read_selection',
        title: '🔊 Read Selection with Novel Companion',
        contexts: ['selection']
      });

      chrome.contextMenus.create({
        id: 'nac_toggle_player',
        title: '🎧 Toggle Audio Player Bar',
        contexts: ['page']
      });

      chrome.contextMenus.create({
        id: 'nac_toggle_reader',
        title: '📖 Toggle Clean Reader Mode (Alt+Shift+R)',
        contexts: ['page']
      });

      chrome.contextMenus.create({
        id: 'nac_clean_ads',
        title: '🛡️ Clean All Ads & Traps on this Chapter',
        contexts: ['page']
      });
    });
  } catch (err) {
    console.error('[NAC Background] onInstalled error:', err);
  }
});

// --- Context Menus Click Handler ---
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id || tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://')) return;

  try {
    if (info.menuItemId === 'nac_read_selection') {
      await chrome.tabs.sendMessage(tab.id, {
        action: 'READ_SELECTION',
        text: info.selectionText
      });
    } else if (info.menuItemId === 'nac_toggle_player') {
      await chrome.tabs.sendMessage(tab.id, { action: 'TOGGLE_PLAYER' });
    } else if (info.menuItemId === 'nac_toggle_reader') {
      await chrome.tabs.sendMessage(tab.id, { action: 'TOGGLE_READER_MODE' });
    } else if (info.menuItemId === 'nac_clean_ads') {
      await chrome.tabs.sendMessage(tab.id, { action: 'CLEAN_DOM_NOW' });
    }
  } catch (err) {
    console.warn('[NAC Background] Failed to send contextMenu message:', err.message);
  }
});

// --- Keyboard Commands (Shortcuts) ---
chrome.commands.onCommand.addListener(async (command) => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || tab.url?.startsWith('chrome://')) return;

    if (command === 'nac_toggle_play') {
      await chrome.tabs.sendMessage(tab.id, { action: 'CMD_TOGGLE_PLAY' });
    } else if (command === 'nac_next_paragraph') {
      await chrome.tabs.sendMessage(tab.id, { action: 'CMD_NEXT_PARAGRAPH' });
    } else if (command === 'nac_prev_paragraph') {
      await chrome.tabs.sendMessage(tab.id, { action: 'CMD_PREV_PARAGRAPH' });
    } else if (command === 'nac_reader_mode') {
      await chrome.tabs.sendMessage(tab.id, { action: 'CMD_TOGGLE_READER' });
    }
  } catch (err) {
    console.warn('[NAC Background] Error executing command:', command, err.message);
  }
});

// --- Message Listener for Badge & Extension Coordination ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'NAC_SET_BADGE') {
    const text = request.text || '';
    const color = request.color || '#6366f1';
    chrome.action.setBadgeText({ text, tabId: sender?.tab?.id });
    chrome.action.setBadgeBackgroundColor({ color, tabId: sender?.tab?.id });
    sendResponse({ success: true });
    return false;
  }

  if (request.action === 'NAC_OPEN_OPTIONS') {
    chrome.runtime.openOptionsPage();
    sendResponse({ success: true });
    return false;
  }

  return false;
});
