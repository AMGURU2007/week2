(() => {
  'use strict';

  const STORAGE_KEYS = {
    SETTINGS: 'yfb_settings',
    GATE: 'yfb_gate',
    STUDY_LIST: 'yfb_studyList',
    NOTES: 'yfb_notes',
    DAILY_STATS: 'yfb_dailyStats'
  };

  const DEFAULT_SETTINGS = {
    hideShorts: true,
    hideRecommendations: true,
    hideComments: true,
    panelOpen: true
  };

  const UNLOCK_DURATION_MS = 60 * 60 * 1000; // 60 minutes

  let state = {
    settings: { ...DEFAULT_SETTINGS },
    gate: { unlockUntil: 0, reason: '' },
    studyList: [],
    notes: {},
    dailyStats: { date: getLocalDateString(), activeSeconds: 0 }
  };

  let pendingSeconds = 0;
  let flushInProgress = false;
  let domReady = false;
  let storageLoaded = false;
  let sweepTimer = null;

  // ---------------------------------------------------------------------------
  // Utilities
  // ---------------------------------------------------------------------------

  function getLocalDateString(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function formatTimestamp(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds || 0));
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    const mm = String(mins).padStart(2, '0');
    const ss = String(secs).padStart(2, '0');
    return hrs > 0 ? `${hrs}:${mm}:${ss}` : `${mm}:${ss}`;
  }

  function isWatchPage() {
    return location.pathname === '/watch' && new URLSearchParams(location.search).has('v');
  }

  function getCurrentVideoId() {
    if (!isWatchPage()) return null;
    return new URLSearchParams(location.search).get('v');
  }

  function getCurrentVideoTitle() {
    const heading = document.querySelector('h1.ytd-watch-metadata yt-formatted-string, #title h1 yt-formatted-string');
    const text = heading ? heading.textContent.trim() : '';
    if (text) return text;
    return document.title.replace(/\s*-\s*YouTube$/, '').trim() || 'Untitled Video';
  }

  function getVideoElement() {
    return document.querySelector('video.html5-main-video') || document.querySelector('video');
  }

  function isGateUnlocked() {
    return Date.now() < (state.gate?.unlockUntil || 0);
  }

  function makeId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  // ---------------------------------------------------------------------------
  // Distraction Blocker
  // ---------------------------------------------------------------------------

  function applyBlockerAttributes() {
    const root = document.documentElement;
    if (!root) return;
    root.setAttribute('data-yfb-shorts', state.settings.hideShorts ? '1' : '0');
    root.setAttribute('data-yfb-recs', state.settings.hideRecommendations ? '1' : '0');
    root.setAttribute('data-yfb-comments', state.settings.hideComments ? '1' : '0');
  }

  function checkShortsRedirect() {
    if (!storageLoaded || !state.settings.hideShorts) return false;
    if (location.pathname.startsWith('/shorts/')) {
      const parts = location.pathname.split('/').filter(Boolean);
      const videoId = parts[1];
      const target = videoId
        ? `${location.origin}/watch?v=${encodeURIComponent(videoId)}`
        : `${location.origin}/`;
      location.replace(target);
      return true;
    }
    return false;
  }

  function sweepShortsDom() {
    sweepTimer = null;
    if (!storageLoaded || !state.settings.hideShorts || !document.body) return;

    // Hide guide/mini-guide Shorts links whose parent container needs hiding
    const shortLinks = document.querySelectorAll(
      'ytd-guide-entry-renderer a[title="Shorts"], ytd-mini-guide-entry-renderer a[title="Shorts"]'
    );
    shortLinks.forEach((link) => {
      const entry = link.closest('ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer');
      if (entry) entry.setAttribute('data-yfb-hidden-short', '1');
    });

    // Hide any shelf or section containing Shorts links
    const shelves = document.querySelectorAll(
      'ytd-rich-section-renderer, ytd-rich-shelf-renderer, ytd-reel-shelf-renderer'
    );
    shelves.forEach((shelf) => {
      if (
        shelf.hasAttribute('is-shorts') ||
        shelf.querySelector('ytd-reel-shelf-renderer, [is-shorts], a[href^="/shorts/"]')
      ) {
        shelf.setAttribute('data-yfb-hidden-short', '1');
      }
    });
  }

  function scheduleSweep() {
    if (sweepTimer !== null) return;
    sweepTimer = setTimeout(() => {
      requestAnimationFrame(sweepShortsDom);
    }, 150);
  }

  // ---------------------------------------------------------------------------
  // Intention Gate
  // ---------------------------------------------------------------------------

  function syncIntentionGate() {
    if (!storageLoaded || !domReady || !document.body) return;

    const root = document.documentElement;
    const unlocked = isGateUnlocked();

    if (unlocked) {
      root.removeAttribute('data-yfb-locked');
      const existing = document.getElementById('yfb-gate-overlay');
      if (existing) existing.remove();
      return;
    }

    root.setAttribute('data-yfb-locked', '1');

    // Pause any playing video while locked
    document.querySelectorAll('video').forEach((video) => {
      if (!video.paused) {
        try {
          video.pause();
        } catch (_) {
          // Ignore autoplay/pause errors
        }
      }
    });

    if (document.getElementById('yfb-gate-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'yfb-gate-overlay';
    overlay.innerHTML = `
      <div class="yfb-gate-card" role="dialog" aria-modal="true" aria-labelledby="yfb-gate-heading">
        <span class="yfb-gate-badge">YouTube Focus Board</span>
        <h1 id="yfb-gate-heading" class="yfb-gate-title">Why are you here?</h1>
        <p class="yfb-gate-subtitle">
          State your intention to unlock YouTube for 60 minutes.
        </p>
        <form class="yfb-gate-form" id="yfb-gate-form">
          <input
            type="text"
            id="yfb-gate-input"
            class="yfb-gate-input"
            placeholder="e.g., Watch lecture on linear algebra..."
            autocomplete="off"
            maxlength="160"
            required
          />
          <button type="submit" class="yfb-gate-btn">Unlock for 60 min</button>
          <p class="yfb-gate-error" id="yfb-gate-error"></p>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);

    const form = overlay.querySelector('#yfb-gate-form');
    const input = overlay.querySelector('#yfb-gate-input');
    const errorEl = overlay.querySelector('#yfb-gate-error');

    setTimeout(() => input && input.focus(), 50);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const reason = input.value.trim();
      if (!reason) {
        errorEl.textContent = 'Please enter a brief reason before continuing.';
        input.focus();
        return;
      }

      const gate = {
        unlockUntil: Date.now() + UNLOCK_DURATION_MS,
        reason
      };
      state.gate = gate;
      syncIntentionGate();
      chrome.storage.local.set({ [STORAGE_KEYS.GATE]: gate }, () => {
        syncIntentionGate();
        renderPanel();
      });
    });
  }

  // ---------------------------------------------------------------------------
  // Study Board & Timestamp Notes Panel (youtube.com/watch)
  // ---------------------------------------------------------------------------

  function ensurePanelElements() {
    if (!domReady || !document.body) return;

    let toggleBtn = document.getElementById('yfb-toggle-btn');
    if (!toggleBtn) {
      toggleBtn = document.createElement('button');
      toggleBtn.id = 'yfb-toggle-btn';
      toggleBtn.type = 'button';
      toggleBtn.innerHTML = `<span class="yfb-dot"></span><span>Focus Board</span>`;
      toggleBtn.addEventListener('click', () => {
        state.settings.panelOpen = !state.settings.panelOpen;
        chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: state.settings });
        updatePanelVisibility();
      });
      document.body.appendChild(toggleBtn);
    }

    let panel = document.getElementById('yfb-panel');
    if (!panel) {
      panel = document.createElement('aside');
      panel.id = 'yfb-panel';
      panel.innerHTML = `
        <div class="yfb-panel-header">
          <h2 class="yfb-panel-title">Focus Board</h2>
          <div class="yfb-header-right">
            <span class="yfb-time-pill" id="yfb-panel-time">Today: 0 min</span>
            <button type="button" class="yfb-icon-btn" id="yfb-panel-close" title="Collapse panel">&times;</button>
          </div>
        </div>
        <div class="yfb-panel-body">
          <div class="yfb-reason-bar" id="yfb-panel-reason" hidden></div>

          <section class="yfb-section">
            <div class="yfb-section-header">
              <h3 class="yfb-section-title">Study List</h3>
              <button type="button" class="yfb-btn-sm" id="yfb-save-video-btn">+ Save Video</button>
            </div>
            <ul class="yfb-list" id="yfb-study-list"></ul>
          </section>

          <section class="yfb-section">
            <div class="yfb-section-header">
              <h3 class="yfb-section-title">Timestamp Notes</h3>
              <span class="yfb-time-pill" id="yfb-live-ts">00:00</span>
            </div>
            <form class="yfb-note-form" id="yfb-note-form">
              <input
                type="text"
                class="yfb-input"
                id="yfb-note-input"
                placeholder="Write note at current time..."
                maxlength="240"
              />
              <button type="submit" class="yfb-btn-sm" id="yfb-add-note-btn">Add</button>
            </form>
            <ul class="yfb-list" id="yfb-notes-list"></ul>
          </section>
        </div>
      `;

      panel.querySelector('#yfb-panel-close').addEventListener('click', () => {
        state.settings.panelOpen = false;
        chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: state.settings });
        updatePanelVisibility();
      });

      panel.querySelector('#yfb-save-video-btn').addEventListener('click', handleSaveCurrentVideo);
      panel.querySelector('#yfb-note-form').addEventListener('submit', handleAddNote);

      document.body.appendChild(panel);
    }

    updatePanelVisibility();
  }

  function updatePanelVisibility() {
    const toggleBtn = document.getElementById('yfb-toggle-btn');
    const panel = document.getElementById('yfb-panel');
    if (!toggleBtn || !panel) return;

    const onWatch = isWatchPage();
    toggleBtn.hidden = !onWatch;
    panel.hidden = !onWatch || !state.settings.panelOpen;
  }

  function handleSaveCurrentVideo() {
    const videoId = getCurrentVideoId();
    if (!videoId) return;

    const title = getCurrentVideoTitle();
    const url = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;

    const exists = state.studyList.some((item) => item.videoId === videoId);
    if (exists) {
      state.studyList = state.studyList.map((item) =>
        item.videoId === videoId ? { ...item, title, url } : item
      );
    } else {
      state.studyList = [
        {
          id: makeId(),
          videoId,
          title,
          url,
          completed: false,
          addedAt: Date.now()
        },
        ...state.studyList
      ];
    }

    chrome.storage.local.set({ [STORAGE_KEYS.STUDY_LIST]: state.studyList }, renderPanel);
  }

  function handleAddNote(e) {
    e.preventDefault();
    const videoId = getCurrentVideoId();
    if (!videoId) return;

    const input = document.getElementById('yfb-note-input');
    if (!input) return;
    const text = input.value.trim();
    if (!text) {
      input.focus();
      return;
    }

    const video = getVideoElement();
    const rawTime = video && Number.isFinite(video.currentTime) ? video.currentTime : 0;
    const seconds = Math.max(0, Math.floor(rawTime));

    const existing = Array.isArray(state.notes[videoId]) ? state.notes[videoId] : [];
    const updated = [
      ...existing,
      {
        id: makeId(),
        seconds,
        text,
        createdAt: Date.now()
      }
    ].sort((a, b) => a.seconds - b.seconds);

    state.notes = { ...state.notes, [videoId]: updated };
    input.value = '';
    chrome.storage.local.set({ [STORAGE_KEYS.NOTES]: state.notes }, renderPanel);
  }

  function renderPanel() {
    const panel = document.getElementById('yfb-panel');
    if (!panel) return;

    updatePanelVisibility();
    updateTimeDisplays();

    // Intention reason bar
    const reasonEl = document.getElementById('yfb-panel-reason');
    if (reasonEl) {
      if (isGateUnlocked() && state.gate.reason) {
        const minsLeft = Math.max(1, Math.ceil((state.gate.unlockUntil - Date.now()) / 60000));
        reasonEl.hidden = false;
        reasonEl.innerHTML = '';
        const strong = document.createElement('strong');
        strong.textContent = 'Intention: ';
        reasonEl.appendChild(strong);
        reasonEl.appendChild(document.createTextNode(`${state.gate.reason} (${minsLeft}m left)`));
      } else {
        reasonEl.hidden = true;
      }
    }

    // Study List
    const studyListEl = document.getElementById('yfb-study-list');
    if (studyListEl) {
      studyListEl.innerHTML = '';
      if (!state.studyList.length) {
        const empty = document.createElement('li');
        empty.className = 'yfb-empty';
        empty.textContent = 'No videos saved yet.';
        studyListEl.appendChild(empty);
      } else {
        state.studyList.forEach((item) => {
          const li = document.createElement('li');
          li.className = 'yfb-item';

          const main = document.createElement('div');
          main.className = 'yfb-item-main';

          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.className = 'yfb-checkbox';
          checkbox.checked = Boolean(item.completed);
          checkbox.addEventListener('change', () => {
            state.studyList = state.studyList.map((entry) =>
              entry.id === item.id ? { ...entry, completed: checkbox.checked } : entry
            );
            chrome.storage.local.set({ [STORAGE_KEYS.STUDY_LIST]: state.studyList }, renderPanel);
          });

          const link = document.createElement('a');
          link.className = `yfb-study-link${item.completed ? ' is-done' : ''}`;
          link.href = item.url;
          link.textContent = item.title;

          main.appendChild(checkbox);
          main.appendChild(link);

          const delBtn = document.createElement('button');
          delBtn.type = 'button';
          delBtn.className = 'yfb-del-btn';
          delBtn.title = 'Remove video';
          delBtn.innerHTML = '&times;';
          delBtn.addEventListener('click', () => {
            state.studyList = state.studyList.filter((entry) => entry.id !== item.id);
            chrome.storage.local.set({ [STORAGE_KEYS.STUDY_LIST]: state.studyList }, renderPanel);
          });

          li.appendChild(main);
          li.appendChild(delBtn);
          studyListEl.appendChild(li);
        });
      }
    }

    // Timestamp Notes for current video
    const notesListEl = document.getElementById('yfb-notes-list');
    if (notesListEl) {
      notesListEl.innerHTML = '';
      const videoId = getCurrentVideoId();
      const videoNotes = videoId && Array.isArray(state.notes[videoId]) ? state.notes[videoId] : [];

      if (!videoNotes.length) {
        const empty = document.createElement('li');
        empty.className = 'yfb-empty';
        empty.textContent = 'No timestamp notes for this video.';
        notesListEl.appendChild(empty);
      } else {
        videoNotes.forEach((note) => {
          const li = document.createElement('li');
          li.className = 'yfb-item';

          const main = document.createElement('div');
          main.className = 'yfb-item-main';

          const tsBtn = document.createElement('button');
          tsBtn.type = 'button';
          tsBtn.className = 'yfb-ts-btn';
          tsBtn.textContent = formatTimestamp(note.seconds);
          tsBtn.title = 'Jump to timestamp';
          tsBtn.addEventListener('click', () => {
            const video = getVideoElement();
            if (video) {
              video.currentTime = note.seconds;
            }
          });

          const textSpan = document.createElement('span');
          textSpan.className = 'yfb-note-text';
          textSpan.textContent = note.text;

          main.appendChild(tsBtn);
          main.appendChild(textSpan);

          const delBtn = document.createElement('button');
          delBtn.type = 'button';
          delBtn.className = 'yfb-del-btn';
          delBtn.title = 'Delete note';
          delBtn.innerHTML = '&times;';
          delBtn.addEventListener('click', () => {
            const nextNotes = videoNotes.filter((n) => n.id !== note.id);
            state.notes = { ...state.notes, [videoId]: nextNotes };
            chrome.storage.local.set({ [STORAGE_KEYS.NOTES]: state.notes }, renderPanel);
          });

          li.appendChild(main);
          li.appendChild(delBtn);
          notesListEl.appendChild(li);
        });
      }
    }
  }

  function updateTimeDisplays() {
    const todayStr = getLocalDateString();
    const baseSeconds = state.dailyStats.date === todayStr ? state.dailyStats.activeSeconds : 0;
    const totalMinutes = Math.floor((baseSeconds + pendingSeconds) / 60);

    const panelTime = document.getElementById('yfb-panel-time');
    if (panelTime) {
      panelTime.textContent = `Today: ${totalMinutes} min`;
    }

    const liveTs = document.getElementById('yfb-live-ts');
    if (liveTs) {
      const video = getVideoElement();
      liveTs.textContent = formatTimestamp(video ? video.currentTime : 0);
    }
  }

  // ---------------------------------------------------------------------------
  // Daily Time Tracker
  // ---------------------------------------------------------------------------

  function flushActiveSeconds() {
    if (flushInProgress || pendingSeconds <= 0) return;
    flushInProgress = true;
    const delta = pendingSeconds;
    pendingSeconds = 0;

    chrome.storage.local.get([STORAGE_KEYS.DAILY_STATS], (res) => {
      const todayStr = getLocalDateString();
      const stored = res[STORAGE_KEYS.DAILY_STATS];
      const base = stored && stored.date === todayStr ? Number(stored.activeSeconds || 0) : 0;
      const updated = { date: todayStr, activeSeconds: base + delta };
      state.dailyStats = updated;
      chrome.storage.local.set({ [STORAGE_KEYS.DAILY_STATS]: updated }, () => {
        flushInProgress = false;
        updateTimeDisplays();
      });
    });
  }

  function startTicker() {
    setInterval(() => {
      if (!storageLoaded) return;

      const todayStr = getLocalDateString();
      if (state.dailyStats.date !== todayStr) {
        state.dailyStats = { date: todayStr, activeSeconds: 0 };
        pendingSeconds = 0;
        chrome.storage.local.set({ [STORAGE_KEYS.DAILY_STATS]: state.dailyStats });
      }

      // Enforce 60-min gate expiry in real time
      syncIntentionGate();

      if (
        document.visibilityState === 'visible' &&
        location.hostname.endsWith('youtube.com') &&
        isGateUnlocked()
      ) {
        pendingSeconds += 1;
        if (pendingSeconds >= 5) {
          flushActiveSeconds();
        }
      }

      updateTimeDisplays();
    }, 1000);

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        flushActiveSeconds();
      }
    });

    window.addEventListener('pagehide', flushActiveSeconds);
  }

  // ---------------------------------------------------------------------------
  // Initialization & SPA Navigation
  // ---------------------------------------------------------------------------

  function loadInitialState() {
    chrome.storage.local.get(
      [
        STORAGE_KEYS.SETTINGS,
        STORAGE_KEYS.GATE,
        STORAGE_KEYS.STUDY_LIST,
        STORAGE_KEYS.NOTES,
        STORAGE_KEYS.DAILY_STATS
      ],
      (res) => {
        state.settings = { ...DEFAULT_SETTINGS, ...(res[STORAGE_KEYS.SETTINGS] || {}) };
        state.gate = res[STORAGE_KEYS.GATE] || { unlockUntil: 0, reason: '' };
        state.studyList = Array.isArray(res[STORAGE_KEYS.STUDY_LIST]) ? res[STORAGE_KEYS.STUDY_LIST] : [];
        state.notes = res[STORAGE_KEYS.NOTES] && typeof res[STORAGE_KEYS.NOTES] === 'object'
          ? res[STORAGE_KEYS.NOTES]
          : {};

        const todayStr = getLocalDateString();
        const storedStats = res[STORAGE_KEYS.DAILY_STATS];
        if (storedStats && storedStats.date === todayStr) {
          state.dailyStats = storedStats;
        } else {
          state.dailyStats = { date: todayStr, activeSeconds: 0 };
          chrome.storage.local.set({ [STORAGE_KEYS.DAILY_STATS]: state.dailyStats });
        }

        storageLoaded = true;
        applyBlockerAttributes();
        if (checkShortsRedirect()) return;

        if (domReady) {
          syncIntentionGate();
          ensurePanelElements();
          renderPanel();
          scheduleSweep();
        }
      }
    );
  }

  function onDomReady() {
    domReady = true;

    const observer = new MutationObserver(() => {
      if (!storageLoaded) return;
      if (!isGateUnlocked()) {
        syncIntentionGate();
      }
      scheduleSweep();
    });

    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }

    if (!storageLoaded) return;

    applyBlockerAttributes();
    if (checkShortsRedirect()) return;
    syncIntentionGate();
    ensurePanelElements();
    renderPanel();
    scheduleSweep();
  }

  // Listen for YouTube SPA navigation events
  window.addEventListener('yt-navigate-start', () => {
    checkShortsRedirect();
  });

  window.addEventListener('yt-navigate-finish', () => {
    applyBlockerAttributes();
    if (checkShortsRedirect()) return;
    syncIntentionGate();
    ensurePanelElements();
    renderPanel();
    scheduleSweep();
  });

  // Sync changes from popup or other tabs
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;

    if (changes[STORAGE_KEYS.SETTINGS]) {
      state.settings = { ...DEFAULT_SETTINGS, ...(changes[STORAGE_KEYS.SETTINGS].newValue || {}) };
      applyBlockerAttributes();
      checkShortsRedirect();
      updatePanelVisibility();
      scheduleSweep();
    }

    if (changes[STORAGE_KEYS.GATE]) {
      state.gate = changes[STORAGE_KEYS.GATE].newValue || { unlockUntil: 0, reason: '' };
      syncIntentionGate();
      renderPanel();
    }

    if (changes[STORAGE_KEYS.STUDY_LIST]) {
      state.studyList = Array.isArray(changes[STORAGE_KEYS.STUDY_LIST].newValue)
        ? changes[STORAGE_KEYS.STUDY_LIST].newValue
        : [];
      renderPanel();
    }

    if (changes[STORAGE_KEYS.NOTES]) {
      state.notes = changes[STORAGE_KEYS.NOTES].newValue || {};
      renderPanel();
    }

    if (changes[STORAGE_KEYS.DAILY_STATS]) {
      const val = changes[STORAGE_KEYS.DAILY_STATS].newValue;
      if (val) {
        state.dailyStats = val;
        updateTimeDisplays();
      }
    }
  });

  // Message bridge for popup
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'YFB_GET_VIDEO_INFO') {
      const video = getVideoElement();
      sendResponse({
        isWatch: isWatchPage(),
        videoId: getCurrentVideoId(),
        title: getCurrentVideoTitle(),
        url: isWatchPage() ? `https://www.youtube.com/watch?v=${encodeURIComponent(getCurrentVideoId())}` : location.href,
        currentTime: video ? Math.floor(video.currentTime || 0) : 0
      });
      return true;
    }

    if (msg.type === 'YFB_SEEK') {
      const video = getVideoElement();
      if (video && typeof msg.seconds === 'number') {
        video.currentTime = msg.seconds;
        sendResponse({ ok: true });
      } else {
        sendResponse({ ok: false });
      }
      return true;
    }
  });

  loadInitialState();
  startTicker();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onDomReady, { once: true });
  } else {
    onDomReady();
  }
})();
