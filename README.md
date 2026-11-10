# 🎧 Novel Audio Companion & Clean Reader Pro (v2.0.0)

> **A human-engineered, security-hardened Manifest V3 Chrome & Edge extension built specifically for web novel and light novel readers.** Seamlessly transforms web novels into audiobook-grade audio narration with natural voices, non-destructive word tracking, ad eradication, custom pronunciation dictionaries, and a distraction-free Kindle-style reader view.

---

## 🌟 Why This Extension Was Built (Community Pain Points & Engineering Solutions)

Web novel readers (across communities like `r/noveltranslations`, `r/ProgressionFantasy`, `r/MicrosoftEdge`, RoyalRoad, and Wuxiaworld) frequently face recurring pain points when using built-in browser speech or general TTS tools:

| Common Reader Frustration | Senior Engineering Solution |
| :--- | :--- |
| **Edge Read Aloud randomly stops or freezes** | **Smart Keep-Alive Heartbeat**: Prevents Chromium's 15-second speech silence bug and garbage collection drops without periodic blind audio stutters. |
| **Butchered fantasy names & cultivation terms** | **Phonetic Pronunciation Dictionary**: Regex support, ReDoS-protected compilation, and 1-click presets for *Xianxia* (`Qi` → *Chee*, `Dao` → *Dow*), *LitRPG* (`[Status]` tags), and Author/Translator note filtering. |
| **Ad traps, Ezoic banners & sticky video players** | **Safe CSS Concealment**: Neutralizes Ezoic, Humix, Mediavine, and Google AdSense without tripping anti-adblock traps. |
| **Story interrupts at chapter ends** | **Secure Auto-Next Chapter Handover**: Validates next-chapter URLs (HTTP/HTTPS only) and automatically resumes speech across pages. |
| **Headphones / Media keys don't work** | **Native Media Session API**: Play, pause, or skip paragraphs using Bluetooth earbuds, headset buttons, or lock-screen controls. |
| **Cluttered, eye-straining website layouts** | **Distraction-Free Reader Mode**: Kindle-like canvas with 4 eye-friendly themes (Midnight, OLED Pitch Black, Cozy Sepia, Clean Daylight) and custom typography (Merriweather, Atkinson Hyperlegible, OpenDyslexic). |

---

## 🛡️ Cybersecurity & Architecture Audit

Every component has been hardened against common extension security vulnerabilities:

1. **ReDoS (Regular Expression Denial of Service) Protection**:
   - Strips illegal PCRE inline flags (e.g. `(?i)`) that crash JavaScript's V8 engine.
   - Enforces pattern length boundaries (max 250 characters).
   - Wraps all regex compilations and dictionary replacements in safe execution blocks.
2. **DOM XSS Defense**:
   - Replaced all insecure `innerHTML` insertions with strict `textContent`, document fragments, and parameterized DOM nodes.
   - User inputs in popup, reader mode, and options dashboard are strictly sanitized.
3. **Non-Destructive Karaoke Word Tracking**:
   - Caches the host page's original paragraph DOM structure.
   - Safely reverts modifications whenever switching paragraphs, pausing, stopping, or upon speech error, ensuring zero corruption of host site links, footnotes, or JavaScript event handlers.
4. **Validated Navigation & Handover**:
   - Validates next-chapter links against origin and HTTP/HTTPS schemes (blocking `javascript:`, `data:`, or malformed URLs).
   - Enforces a 30-second cryptographic expiration timestamp in `sessionStorage` for autoplay handovers.
5. **Selector Injection Safeguards**:
   - All custom site selector queries are wrapped in safe selector guards to prevent `DOMException: Invalid selector` crashes.

---

## 🚀 Key Features

### 1. 🎙️ High-Fidelity Speech & Natural Voices
- Prioritizes **Microsoft Natural / Neural cloud voices** (Aria, Guy, Sonia, Ryan) and Google Neural voices.
- Real-time **Word Highlighting (Karaoke Tracking)** that highlights each word as it is spoken.
- Fine-grained controls: Reading Speed (**0.5x to 3.0x**), Voice Pitch (**0.7x to 1.3x**), and Volume.
- **Natural Breathing Cadence**: Configurable sentence and paragraph pauses (120ms / 280ms) for audiobook-grade pacing.

### 2. 📖 Pronunciation & Phonetic Dictionary
- Fixes misspelled names, Chinese Pinyin, Korean honorifics, and game stat screens.
- Supports both **exact word replacement** (`Qi` → `Chee`) and **regular expressions** (e.g. `\[(Status|Level|HP)[^\]]*\]` → `Status:`).
- **One-Click Presets**:
  - ☯️ *Xianxia / Cultivation*: Qi, Dao, Dantian, Xianxia, Wuxia, Jianghu.
  - ⚔️ *LitRPG / System*: Status windows, Skill prompts, Level notifications.
  - 📜 *Author & Translator Notes*: Strips intrusive `[Author's note: ...]` and translator notes from narration.
- **Live Pronunciation Playground**: Type any sample sentence and listen to how your rules transform it before saving.

### 3. 🏝️ Ergonomic Floating Player Bar
- Compact, human-designed floating pill with zero visual clutter.
- **Draggable**: Drag handle allows placing the bar anywhere on the screen (position is saved).
- **Dockable Orb**: Minimizes into a discreet floating orb when you want full screen real estate.
- Scrubber progress indicator showing active paragraph and estimated reading time remaining (`⏱️ ~6 min left`).

### 4. 👁️ Distraction-Free Reader Canvas (Immersive Mode)
- One-click toggle (`Alt+Shift+R` or button) transforms any ad-cluttered webpage into an elegant reading surface:
  - **Themes**: 🌙 *Midnight Slate*, 🖤 *Pure OLED Black*, 📜 *Cozy Sepia*, ☀️ *Clean Daylight*.
  - **Fonts**: Classic Book Serif (Merriweather), High-Legibility Sans (Atkinson Hyperlegible), Modern Clean (Inter), and OpenDyslexic.
  - Retains interactive paragraph click-to-read and active word highlights inside Reader View.

### 5. ⏳ Sleep Timer with Gradual Audio Fade
- Options: 15 min, 30 min, 45 min, 60 min.
- Live countdown displayed directly on the floating bar.
- In the final 30 seconds of the timer, audio volume gently ramps down to zero so listeners are never abruptly awakened.

### 6. 🌐 Universal Novel Detector & Verified Site Support
- Native optimized extractors for:
  - *Royal Road*, *Wuxiaworld*, *ScribbleHub*, *LightNovelPub*, *NovelFull*, *IsoTLS*, *Webnovel*, *Ranobes*, *NovelBin*, *ReadLightNovel*, *BoxNovel*, *Mtlnovel*, *FreeWebNovel*, *ReaperScans*, *AsuraScans*.
- **Universal Heuristic Fallback**: Evaluates paragraph text density, link ratios, and double-line breaks to auto-detect novel content on any website.
- **Custom Site Builder**: Allows users to register custom content and next-chapter selectors for obscure novel sites.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action | Scope |
| :--- | :--- | :--- |
| `Alt` + `Shift` + `P` | **Play / Pause Narration** | Global Browser / Tab |
| `Alt` + `Shift` + `→` (or `Alt` + `→`) | **Skip to Next Paragraph** | Global Browser / Tab |
| `Alt` + `Shift` + `←` (or `Alt` + `←`) | **Previous Paragraph** | Global Browser / Tab |
| `Alt` + `Shift` + `R` | **Toggle Reader Mode** | Active Tab |
| `Space` | **Play / Pause (Reader View Only)** | Reader Mode |
| `Click` on any paragraph | **Click to Read from Here** | Active Tab |

*(Shortcuts can be customized at `chrome://extensions/shortcuts`)*

---

## 📁 Project Architecture (Manifest V3)

```
NovelAudioCompanion/
├── manifest.json              # Valid Manifest V3 (action popup, options, background worker, commands)
├── background.js              # Service Worker (handles shortcuts, context menus, storage migration)
├── content.js                 # Production Audio Engine (TTS, smart keep-alive, ReDoS defense, reader mode)
├── content.css                # Floating island styling, themes, reader typography
├── popup/
│   ├── popup.html             # Toolbar action popup
│   ├── popup.css              # Refined obsidian popup styling
│   └── popup.js               # Tab state coordination & quick controls
├── options/
│   ├── options.html           # Settings & dictionary dashboard
│   ├── options.css            # Responsive dashboard layout
│   └── options.js             # Dictionary manager, safe DOM renderer, backup/restore
├── icons/
│   ├── icon-16.png            # 16x16 icon
│   ├── icon-48.png            # 48x48 icon
│   └── icon-128.png           # 128x128 icon
├── novel-audio-companion.user.js # Standalone Userscript version for Tampermonkey/Violentmonkey
└── README.md
```

---

## 🛠️ Installation Instructions

### Chrome / Microsoft Edge / Brave / Opera:
1. Open your browser and navigate to `chrome://extensions` (or `edge://extensions`).
2. Toggle on **Developer mode** in the top-right corner.
3. Click the **Load unpacked** button.
4. Select the `NovelAudioCompanion` folder:
   `C:\Users\hp\Documents\NovelAudioCompanion`
5. Pin the **Novel Audio Companion** icon to your toolbar for quick access!

### Tampermonkey / Violentmonkey (Userscript):
- Open `novel-audio-companion.user.js` in Tampermonkey or Violentmonkey and click **Install**.

---

## 💾 Backup & Sync
All preferences, pronunciation dictionary rules, and custom site selectors are automatically synchronized across devices using `chrome.storage.sync`. You can also export or import your settings as a `.json` file from the **Backup & Shortcuts** tab in the Options page.
