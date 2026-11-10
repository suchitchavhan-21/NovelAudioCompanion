# 🎧 Novel Audio Companion & Clean Reader Pro (v2.0.0)

> **A production-grade, Manifest V3 Chrome & Edge extension designed specifically for web novel and light novel readers.** Seamlessly transforms web novels into audiobook-grade audio narration with natural voices, real-time word tracking, aggressive ad eradication, custom pronunciation dictionaries, and a distraction-free Kindle-style reader view.

---

## 🌟 Why This Extension Was Built (Public Community Research & Solutions)

Web novel readers (across communities like `r/noveltranslations`, `r/ProgressionFantasy`, `r/MicrosoftEdge`, RoyalRoad, and Wuxiaworld) frequently face recurring pain points when using built-in browser speech or general TTS tools:

| Common Reader Frustration | How Novel Audio Companion Solves It |
| :--- | :--- |
| **Edge Read Aloud randomly stops or freezes** | Custom keep-alive heartbeat and persistent utterance memory prevent Chromium's 15-second speech silence bug and garbage collection freezes. |
| **Butchered fantasy names & cultivation terms** | Built-in **Phonetic Pronunciation Dictionary** with regex support and 1-click presets for *Xianxia* (`Qi` → *Chee*, `Dao` → *Dow*), *LitRPG* (`[Status]` tags), and Roman Numerals. |
| **Ad traps, Ezoic banners & sticky video players** | Multi-vendor ad destroyer cleans Ezoic, Humix, Mediavine, Google AdSense, and anti-adblock traps instantly via a live `MutationObserver`. |
| **Story interrupts at chapter ends** | **Smart Auto-Next Chapter Handover**: detects next-chapter links and automatically resumes speech without human interaction. |
| **Headphones / Media keys don't work** | Native **Media Session API** integration lets you play, pause, or skip paragraphs using Bluetooth earbuds, headset buttons, or lock-screen controls. |
| **Cluttered, eye-straining website layouts** | **Distraction-Free Reader Mode**: Kindle-like canvas with 4 eye-friendly themes (Midnight, OLED Pitch Black, Cozy Sepia, Clean Light) and custom typography (Merriweather, Atkinson Hyperlegible, OpenDyslexic). |

---

## 🚀 Key Features

### 1. 🎙️ High-Fidelity Speech & Natural Voices
- Prioritizes **Microsoft Natural / Neural cloud voices** (Aria, Guy, Sonia, Ryan) and Google Neural voices.
- Real-time **Word Highlighting (Karaoke Tracking)** that highlights each word as it is spoken.
- Fine-grained controls: Reading Speed (**0.5x to 3.0x**), Voice Pitch (**0.7x to 1.3x**), and Volume.
- **Natural Breathing Cadence**: Configurable sentence and paragraph pauses (e.g., 120ms / 320ms) so narration sounds like a human audiobook narrator instead of a monotone machine.

### 2. 📖 Pronunciation & Phonetic Dictionary
- Fixes misspelled names, Chinese Pinyin, Korean honorifics, and game stat screens.
- Supports both **exact word replacement** (`Qi` → `Chee`) and **regular expressions** (e.g. `\[(Status|Level|HP)[^\]]*\]` → `Status:`).
- **One-Click Presets**:
  - ☯️ *Xianxia / Cultivation*: Qi, Dao, Dantian, Xianxia, Wuxia, Jianghu.
  - ⚔️ *LitRPG / System*: Status windows, Skill prompts, Level notifications.
  - 🔢 *Roman Numerals*: Converts `Chapter IV` → `Chapter 4`.
- **Live Pronunciation Playground**: Type any sample sentence and listen to how your rules transform it before saving.

### 3. 🏝️ Dynamic Island Floating Player Bar
- Inspired by modern iOS Dynamic Island and macOS frosted glass widgets (`backdrop-filter: blur(24px)`).
- **Draggable**: Drag handle allows placing the bar anywhere on the screen (position is saved).
- **Mini Animated Orb**: Collapses into a 52px floating orb featuring a **live CSS equalizer soundwave** that dances while speech is active.
- Integrated scrubber progress indicator showing active paragraph and estimated reading time remaining (`⏱️ ~7 min left`).

### 4. 👁️ Distraction-Free Reader Canvas (Immersive Mode)
- One-click toggle (`Alt+Shift+R` or button) transforms any ad-cluttered webpage into an elegant reading surface:
  - **Themes**: 🌙 *Midnight Slate*, 🖤 *Pure OLED Black* (battery saver), 📜 *Cozy Sepia*, ☀️ *Clean Light*.
  - **Fonts**: Classic Book Serif (Merriweather/Georgia), High-Legibility Sans (Atkinson Hyperlegible), Modern Clean (Inter), and OpenDyslexic.
  - Custom font size, line spacing, and container width sliders.
  - Retains interactive paragraph click-to-read and active word highlights inside Reader View.

### 5. ⏳ Sleep Timer with Gradual Audio Fade
- Options: 15 min, 30 min, 45 min, 60 min, or End of Chapter.
- Live countdown displayed directly on the floating bar.
- In the final 30 seconds of the timer, audio volume gently ramps down to zero so listeners are never abruptly awakened.

### 6. 🌐 Universal Novel Detector & Verified Site Support
- Native optimized extractors for:
  - *Royal Road*, *Wuxiaworld*, *ScribbleHub*, *LightNovelPub*, *NovelFull*, *IsoTLS*, *Webnovel*, *Ranobes*, *NovelBin*, *ReadLightNovel*, *BoxNovel*, *Mtlnovel*, *FreeWebNovel*, *ReaperScans*, *AsuraScans*.
- **Universal Heuristic Fallback**: Evaluates paragraph text density and link ratios to auto-detect novel content on any arbitrary website.
- **Custom Site Builder**: Allows users to register custom content and next-chapter selectors for obscure novel sites.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action | Scope |
| :--- | :--- | :--- |
| `Alt` + `Shift` + `P` (or `Space`) | **Play / Pause Narration** | Global Browser / Tab |
| `Alt` + `Shift` + `→` (or `Alt` + `→`) | **Skip to Next Paragraph** | Global Browser / Tab |
| `Alt` + `Shift` + `←` (or `Alt` + `←`) | **Previous Paragraph** | Global Browser / Tab |
| `Alt` + `Shift` + `R` | **Toggle Reader Mode** | Active Tab |
| `Click` on any paragraph | **Click to Read from Here** | Active Tab |

*(Shortcuts can be customized at `chrome://extensions/shortcuts`)*

---

## 📁 Project Architecture (Manifest V3)

```
NovelAudioCompanion/
├── manifest.json              # Manifest V3 (action popup, options, background worker, commands)
├── background.js              # Service Worker (handles shortcuts, context menus, icon badge)
├── content.js                 # Core Audio Engine (TTS, keep-alive, word tracking, reader view)
├── content.css                # Floating island styling, equalizer animations, reader themes
├── popup/
│   ├── popup.html             # Toolbar action popup
│   ├── popup.css              # Glassmorphic dark popup styling
│   └── popup.js               # Tab state coordination & quick controls
├── options/
│   ├── options.html           # Comprehensive settings & dictionary dashboard
│   ├── options.css            # Responsive dashboard layout
│   └── options.js             # Dictionary manager, presets, voice tester, backup/restore
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
