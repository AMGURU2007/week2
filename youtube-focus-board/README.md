# YouTube Focus Board

A 100% local, zero-dependency Manifest V3 Chrome Extension that turns YouTube into a distraction-free study environment. All settings, study lists, timestamped notes, intention timers, and daily stats are stored locally in `chrome.storage.local` with no external libraries or network requests.

## Features

1. **Distraction Blocker**
   - Independent toggles (in the extension popup) to hide:
     - **Shorts** (Shorts shelves, navigation tab, and automatic `/shorts/` → `/watch` redirects)
     - **Home & Sidebar Recommendations** (Home feed grid, watch-page related sidebar, and end-screen cards)
     - **Comments**
   - Persists across YouTube's Single Page Application (SPA) navigation using `yt-navigate-finish` and a `MutationObserver`.

2. **Intention Gate ("Why are you here?")**
   - Displays a full-screen prompt when YouTube is locked.
   - Entering your intention unlocks YouTube for **60 minutes** and records the expiry timestamp and reason in `chrome.storage.local`.
   - You can also re-lock early from the extension popup via **Lock Now**.

3. **Study Board & Timestamped Notes**
   - Compact, toggleable **Focus Board** panel on `youtube.com/watch` (and mirrored in the extension popup).
   - **Study List**: Save the current video, check off completed videos, open saved videos, or delete items.
   - **Timestamp Notes**: Capture `video.currentTime` with one click and attach a note. Clicking any saved timestamp immediately seeks the video to that exact second.

4. **Daily Time Tracker**
   - Tracks active minutes spent on `youtube.com` today (when the tab is visible and unlocked).
   - Automatically resets at local midnight and displays `Today: X min` in both the in-page panel and the extension popup.

## Installation (Chrome / Edge / Brave)

1. Open `chrome://extensions` in your browser.
2. Enable **Developer mode** using the toggle in the top-right corner.
3. Click **Load unpacked**.
4. Select the `youtube-focus-board` folder containing `manifest.json`.
5. Pin **YouTube Focus Board** to your toolbar (optional) and open `https://www.youtube.com` to get started.

## Files

- `manifest.json` — Manifest V3 configuration (`storage` and `activeTab` permissions only).
- `content.js` — Distraction blocker, SPA navigation handling, Intention Gate overlay, in-page Study Board & Timestamp Notes panel, and Daily Time Tracker.
- `popup.html` & `popup.js` — Extension popup with blocker toggles, gate status, Study List, Timestamp Notes, and daily time display.
- `styles.css` — Isolated `px`-based styling for injected YouTube UI and the popup, plus attribute-driven CSS blocking rules.
