# Reel Monster — Web Edition (Level 1: Manual)

A small, offline-first browser adaptation of Project 6 from the Week 2 project brief.

## Run it
1. Extract the project folder.
2. Double-click `index.html` or right-click → Open with Chrome / Edge.
3. Tap **TAP ME +1** once after each reel you watch.
4. Use **Export history CSV** to download your recorded counts.

No installation, account, backend, API key, or Python environment is needed. Counts are saved in this browser's `localStorage` on this device. The app interface and counting work offline after the files are present locally.

## Features
- Manual Level 1 reel counter.
- Monster changes appearance and messages as the count increases.
- Today's count, estimated time (30 seconds per reel), and last-seven-days chart.
- Local history persistence and CSV export.
- Responsive layout for desktop and mobile browsers.

## Important scope note
The supplied brief describes an **Android-only** app whose monster floats over Instagram and YouTube. A normal browser page cannot draw an overlay on top of other apps. This web edition demonstrates the manual counting, monster reactions, local statistics, and offline behaviour, but it does **not** meet the Android installation / cross-app floating-overlay requirement. Describe it honestly as a browser-based adaptation if you submit it; confirm with your instructor whether this alternative is accepted.

## Data and privacy
All counts stay in this browser's local storage. Clearing browser site data may erase them. No data is sent to a server. The CSS includes a Google Fonts import for typography; if the computer is offline, the browser uses fallback fonts. The app itself does not need that font connection to function.
