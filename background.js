// Novel Audio Companion - Background Service Worker (Manifest V3)
'use strict';

const DEFAULT_SETTINGS = {
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

  // Reader Mode
  readerTheme: 'midnight', // midnight, oled, sepia, light
  readerFont: 'serif',     // serif, sans, inter, dyslexic
  readerFontSize: 19,
  readerLineHeight: 1.8,
  readerMaxWidth: 760,

  // Phonetic & text substitution rules (Strict JS regex, no invalid PCRE (?i) flags)
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

  // Content sanitization & noise line filters (Clean JS regex strings)
  filterRules: [
    { id: 'f1', enabled: true, pattern: 'stolen\\s+from\\s+royal\\s*road', isRegex: true },
    { id: 'f2', enabled: true, pattern: 'read\\s+only\\s+at\\s+[\\w.-]+', isRegex: true },
    { id: 'f3', enabled: true, pattern: 'report\\s+chapter', isRegex: true },
    { id: 'f4', enabled: true, pattern: '^[\\*\\-_=~#\\s]{3,}$', isRegex: true },
    { id: 'f5', enabled: true, pattern: 'support\\s+(?:me\\s+)?on\\s+patreon', isRegex: true }
  ],

  // User-defined site rules
  customSites: []
};

// --- Extension Installation & Update Hook ---
chrome.runtime.onInstalled.addListener(async (details) => {
  try {
    const existing = await chrome.storage.sync.get(null);
    const updates = {};

    for (const [key, val] of Object.entries(DEFAULT_SETTINGS)) {
      if (existing[key] === undefined) {
        updates[key] = val;
      }
    }

    // Sanitize any previously stored broken regex patterns with (?i)
    if (Array.isArray(existing.dictionaryRules)) {
      let cleaned = false;
      const sanitizedRules = existing.dictionaryRules.map(rule => {
        if (typeof rule.pattern === 'string' && rule.pattern.startsWith('(?i)')) {
          cleaned = true;
          return { ...rule, pattern: rule.pattern.replace(/^\(\?i\)/, '') };
        }
        return rule;
      });
      if (cleaned) updates.dictionaryRules = sanitizedRules;
    }

    if (Array.isArray(existing.filterRules)) {
      let cleaned = false;
      const sanitizedFilters = existing.filterRules.map(f => {
        if (typeof f.pattern === 'string' && f.pattern.startsWith('(?i)')) {
          cleaned = true;
          return { ...f, pattern: f.pattern.replace(/^\(\?i\)/, '') };
        }
        return f;
      });
      if (cleaned) updates.filterRules = sanitizedFilters;
    }

    if (Object.keys(updates).length > 0) {
      await chrome.storage.sync.set(updates);
    }

    // Set up Context Menus cleanly
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: 'nac_read_selection',
        title: '🔊 Read Selection with Novel Companion',
        contexts: ['selection']
      });

      chrome.contextMenus.create({
        id: 'nac_toggle_player',
        title: '🎧 Toggle Floating Audio Bar',
        contexts: ['page']
      });

      chrome.contextMenus.create({
        id: 'nac_toggle_reader',
        title: '📖 Distraction-Free Reader Mode (Alt+Shift+R)',
        contexts: ['page']
      });

      chrome.contextMenus.create({
        id: 'nac_clean_ads',
        title: '🛡️ Clean Clutter & Overlays Now',
        contexts: ['page']
      });
    });
  } catch (err) {
    console.error('[NAC Service Worker] onInstalled initialization error:', err);
  }
});

// --- Context Menus Handler ---
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab?.id || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('edge://')) {
    return;
  }

  try {
    if (info.menuItemId === 'nac_read_selection') {
      const selectedText = (info.selectionText || '').trim();
      if (selectedText) {
        await chrome.tabs.sendMessage(tab.id, {
          action: 'READ_SELECTION',
          text: selectedText.slice(0, 5000) // Cap selection payload for security & memory
        });
      }
    } else if (info.menuItemId === 'nac_toggle_player') {
      await chrome.tabs.sendMessage(tab.id, { action: 'TOGGLE_PLAYER' });
    } else if (info.menuItemId === 'nac_toggle_reader') {
      await chrome.tabs.sendMessage(tab.id, { action: 'TOGGLE_READER_MODE' });
    } else if (info.menuItemId === 'nac_clean_ads') {
      await chrome.tabs.sendMessage(tab.id, { action: 'CLEAN_DOM_NOW' });
    }
  } catch (err) {
    // Tab might not have content script loaded or is not a compatible page
    console.debug('[NAC Service Worker] Context menu delivery bypassed:', err.message);
  }
});

// --- Keyboard Shortcuts (Commands) ---
chrome.commands.onCommand.addListener(async (command) => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://')) return;

    const actionMap = {
      'nac_toggle_play': 'CMD_TOGGLE_PLAY',
      'nac_next_paragraph': 'CMD_NEXT_PARAGRAPH',
      'nac_prev_paragraph': 'CMD_PREV_PARAGRAPH',
      'nac_reader_mode': 'CMD_TOGGLE_READER'
    };

    const action = actionMap[command];
    if (action) {
      await chrome.tabs.sendMessage(tab.id, { action });
    }
  } catch (err) {
    console.debug('[NAC Service Worker] Command relay bypassed:', command, err.message);
  }
});

// --- Extension Message Router (Badge, Options & State) ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Guard against untrusted or malformed message structures
  if (!request || typeof request !== 'object') {
    return false;
  }

  if (request.action === 'NAC_SET_BADGE') {
    const text = typeof request.text === 'string' ? request.text.slice(0, 4) : '';
    const color = typeof request.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(request.color) ? request.color : '#3b82f6';
    const tabId = sender?.tab?.id;

    if (tabId) {
      chrome.action.setBadgeText({ text, tabId });
      chrome.action.setBadgeBackgroundColor({ color, tabId });
    }
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
