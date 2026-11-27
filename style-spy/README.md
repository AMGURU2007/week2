# Style Spy — Chrome Extension (Manifest V3)

> **Inspect any webpage's design tokens in one click. Extract colors, typography, save named design kits, and export ready-to-use `:root` CSS variables.**

---

## 📁 Project Structure

```
style-spy/
├── manifest.json        # Chrome Extension Manifest V3 configuration
├── popup.html           # Developer-tool aesthetic popup interface
├── popup.css            # Dark/light mode styling with crisp borders & monospace values
├── popup.js             # UI controller, clipboard manager & chrome.storage.local persistence
├── extractor.js         # DOM style & typography crawler injected into active tabs
├── test-page.html       # Rich local fixture page with varied colors, borders & fonts
├── blank-target.html    # Interactive test harness to preview exported CSS variables
├── generate_icons.py    # Python icon generation script
└── icons/
    ├── icon16.png       # 16x16 toolbar icon
    ├── icon48.png       # 48x48 extensions management icon
    ├── icon128.png      # 128x128 Chrome Web Store icon
    └── icon.svg         # Scalable vector master asset
```

---

## 🚀 How to Install in Google Chrome

1. Open **Google Chrome**.
2. Navigate to `chrome://extensions` in the address bar.
3. In the top-right corner, enable the **"Developer mode"** toggle switch.
4. In the top-left corner, click **"Load unpacked"**.
5. Select the project directory:
   ```
   C:\Users\Lenovo\.gemini\antigravity\scratch\style-spy
   ```
6. The extension **Style Spy** will appear in your extensions list with its custom icon.
7. Click the **Extensions** (puzzle piece) icon in the Chrome toolbar and pin **Style Spy** for quick one-click access.

---

## 🧪 Testing & Verification Guide

### 1. Local Testing with `test-page.html`
1. Open [`test-page.html`](file:///C:/Users/Lenovo/.gemini/antigravity/scratch/style-spy/test-page.html) directly in Chrome (`file:///C:/Users/Lenovo/.gemini/antigravity/scratch/style-spy/test-page.html`).
2. Click the **Style Spy** icon in the toolbar.
3. Observe:
   - **Color Palette:** Displays `#2563EB` (Primary), `#0D9488` (Secondary), `#0F172A` (Dark), `#E11D48` (Accent), etc., ranked by usage frequency.
   - **Typography Hierarchy:** Accurately extracts `Trebuchet MS` (36px, 800), `Georgia` (24px, 700), `Verdana` (18px, 600), `Segoe UI` (16px, 400), and `Courier New` (14px, 500).
   - **DOM Filtering:** Verify that hidden elements with `display: none` (`#FF00FF`), `visibility: hidden` (`#FFD700`), and `opacity: 0` (`#7FFF00`) are **excluded**.
4. Click on any color swatch to copy its HEX code to the clipboard (e.g., `#2563EB`).
5. Click on any typography card to copy its CSS rule to the clipboard.
6. Enter a name (e.g., `Testbed Kit`) and click **"Save Kit"**.

### 2. Exporting & Applying CSS Variables to `blank-target.html`
1. Switch to the **"Saved Kits"** tab in the Style Spy popup.
2. Find your saved `Testbed Kit` and click **"Export CSS"**.
3. A confirmation toast will indicate `:root` CSS variables have been copied to your clipboard.
4. Open [`blank-target.html`](file:///C:/Users/Lenovo/.gemini/antigravity/scratch/style-spy/blank-target.html) in Chrome (`file:///C:/Users/Lenovo/.gemini/antigravity/scratch/style-spy/blank-target.html`).
5. Paste the exported CSS into the left sidebar editor and click **"Apply CSS Variables"** (or observe auto-apply on paste).
6. Verify that the right-side components immediately adapt to the extracted theme!

### 3. Testing Across 5 Live Websites
Navigate to 5 diverse public websites (e.g., Wikipedia, MDN Web Docs, BBC News, Tailwind CSS, npmjs.com) and test the following:
- Click the Style Spy extension icon.
- Confirm the domain badge displays the correct hostname.
- Verify color swatches and typography hierarchy reflect the page's brand identity.
- Save each as a named design kit.

### 4. Verifying Persistence Across Browser Restarts
1. Save 2 or 3 distinct kits from different pages.
2. Check the badge counter on the **"Saved Kits"** tab.
3. Completely close and quit Google Chrome.
4. Relaunch Chrome and click **Style Spy** -> **Saved Kits**.
5. All kits, their colors, dates, and typography should remain intact (persisted in `chrome.storage.local`).
