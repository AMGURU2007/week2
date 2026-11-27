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

  let state = {
    settings: { ...DEFAULT_SETTINGS },
    gate: { unlockUntil: 0, reason: '' },
    studyList: [],
    notes: {},
    dailyStats: { date: getLocalDateString(), activeSeconds: 0 }
  };

  let activeTabId = null;
  let activeVideo = {
    isWatch: false,
    videoId: null,
    title: '',
    url: '',
    currentTime: 0
  };

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

  function makeId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function render() {
    // Daily time tracker
    const todayStr = getLocalDateString();
    const secs = state.dailyStats.date === todayStr ? Number(state.dailyStats.activeSeconds || 0) : 0;
    const mins = Math.floor(secs / 60);
    document.getElementById('popup-today-time').textContent = `Today: ${mins} min`;

    // Intention gate status
    const gateStatusEl = document.getElementById('popup-gate-status');
    const lockBtn = document.getElementById('popup-lock-btn');
    const unlocked = Date.now() < (state.gate?.unlockUntil || 0);
    if (unlocked) {
      const minsLeft = Math.max(1, Math.ceil((state.gate.unlockUntil - Date.now()) / 60000));
      gateStatusEl.textContent = `Unlocked (${minsLeft}m left): "${state.gate.reason || 'Focused session'}"`;
      lockBtn.hidden = false;
    } else {
      gateStatusEl.textContent = 'Locked — open YouTube to enter your intention.';
      lockBtn.hidden = true;
    }

    // Blocker toggles
    document.getElementById('toggle-shorts').checked = Boolean(state.settings.hideShorts);
    document.getElementById('toggle-recs').checked = Boolean(state.settings.hideRecommendations);
    document.getElementById('toggle-comments').checked = Boolean(state.settings.hideComments);

    // Save current video button
    const saveBtn = document.getElementById('popup-save-video');
    saveBtn.disabled = !activeVideo.isWatch || !activeVideo.videoId;

    // Study list
    const studyListEl = document.getElementById('popup-study-list');
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
          chrome.storage.local.set({ [STORAGE_KEYS.STUDY_LIST]: state.studyList }, render);
        });

        const link = document.createElement('a');
        link.className = `yfb-study-link${item.completed ? ' is-done' : ''}`;
        link.href = item.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
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
          chrome.storage.local.set({ [STORAGE_KEYS.STUDY_LIST]: state.studyList }, render);
        });

        li.appendChild(main);
        li.appendChild(delBtn);
        studyListEl.appendChild(li);
      });
    }

    // Timestamp notes
    const liveTsEl = document.getElementById('popup-live-ts');
    const noteForm = document.getElementById('popup-note-form');
    const notesListEl = document.getElementById('popup-notes-list');
    notesListEl.innerHTML = '';

    if (activeVideo.isWatch && activeVideo.videoId) {
      liveTsEl.hidden = false;
      liveTsEl.textContent = formatTimestamp(activeVideo.currentTime);
      noteForm.hidden = false;

      const videoNotes = Array.isArray(state.notes[activeVideo.videoId])
        ? state.notes[activeVideo.videoId]
        : [];

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
            if (activeTabId !== null) {
              chrome.tabs.sendMessage(activeTabId, {
                type: 'YFB_SEEK',
                seconds: note.seconds
              });
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
            state.notes = { ...state.notes, [activeVideo.videoId]: nextNotes };
            chrome.storage.local.set({ [STORAGE_KEYS.NOTES]: state.notes }, render);
          });

          li.appendChild(main);
          li.appendChild(delBtn);
          notesListEl.appendChild(li);
        });
      }
    } else {
      liveTsEl.hidden = true;
      noteForm.hidden = true;
      const empty = document.createElement('li');
      empty.className = 'yfb-empty';
      empty.textContent = 'Open a YouTube video tab to add or jump to timestamp notes.';
      notesListEl.appendChild(empty);
    }
  }

  function queryActiveYouTubeTab() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs[0];
      if (!tab || !tab.id) {
        render();
        return;
      }
      activeTabId = tab.id;
      chrome.tabs.sendMessage(tab.id, { type: 'YFB_GET_VIDEO_INFO' }, (resp) => {
        if (chrome.runtime.lastError || !resp) {
          activeVideo = { isWatch: false, videoId: null, title: '', url: '', currentTime: 0 };
        } else {
          activeVideo = resp;
        }
        render();
      });
    });
  }

  function bindEvents() {
    document.getElementById('toggle-shorts').addEventListener('change', (e) => {
      state.settings.hideShorts = e.target.checked;
      chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: state.settings });
    });

    document.getElementById('toggle-recs').addEventListener('change', (e) => {
      state.settings.hideRecommendations = e.target.checked;
      chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: state.settings });
    });

    document.getElementById('toggle-comments').addEventListener('change', (e) => {
      state.settings.hideComments = e.target.checked;
      chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: state.settings });
    });

    document.getElementById('popup-lock-btn').addEventListener('click', () => {
      state.gate = { unlockUntil: 0, reason: '' };
      chrome.storage.local.set({ [STORAGE_KEYS.GATE]: state.gate }, render);
    });

    document.getElementById('popup-save-video').addEventListener('click', () => {
      if (!activeVideo.isWatch || !activeVideo.videoId) return;
      const exists = state.studyList.some((item) => item.videoId === activeVideo.videoId);
      if (exists) {
        state.studyList = state.studyList.map((item) =>
          item.videoId === activeVideo.videoId
            ? { ...item, title: activeVideo.title, url: activeVideo.url }
            : item
        );
      } else {
        state.studyList = [
          {
            id: makeId(),
            videoId: activeVideo.videoId,
            title: activeVideo.title,
            url: activeVideo.url,
            completed: false,
            addedAt: Date.now()
          },
          ...state.studyList
        ];
      }
      chrome.storage.local.set({ [STORAGE_KEYS.STUDY_LIST]: state.studyList }, render);
    });

    document.getElementById('popup-note-form').addEventListener('submit', (e) => {
      e.preventDefault();
      if (!activeVideo.isWatch || !activeVideo.videoId) return;

      const input = document.getElementById('popup-note-input');
      const text = input.value.trim();
      if (!text) {
        input.focus();
        return;
      }

      // Refresh currentTime right before saving if possible
      const saveWithSeconds = (seconds) => {
        const existing = Array.isArray(state.notes[activeVideo.videoId])
          ? state.notes[activeVideo.videoId]
          : [];
        const updated = [
          ...existing,
          {
            id: makeId(),
            seconds: Math.max(0, Math.floor(seconds || 0)),
            text,
            createdAt: Date.now()
          }
        ].sort((a, b) => a.seconds - b.seconds);

        state.notes = { ...state.notes, [activeVideo.videoId]: updated };
        input.value = '';
        chrome.storage.local.set({ [STORAGE_KEYS.NOTES]: state.notes }, render);
      };

      if (activeTabId !== null) {
        chrome.tabs.sendMessage(activeTabId, { type: 'YFB_GET_VIDEO_INFO' }, (resp) => {
          if (!chrome.runtime.lastError && resp && typeof resp.currentTime === 'number') {
            activeVideo = resp;
            saveWithSeconds(resp.currentTime);
          } else {
            saveWithSeconds(activeVideo.currentTime);
          }
        });
      } else {
        saveWithSeconds(activeVideo.currentTime);
      }
    });
  }

  function init() {
    bindEvents();

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
        state.dailyStats = storedStats && storedStats.date === todayStr
          ? storedStats
          : { date: todayStr, activeSeconds: 0 };

        queryActiveYouTubeTab();
      }
    );

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes[STORAGE_KEYS.SETTINGS]) {
        state.settings = { ...DEFAULT_SETTINGS, ...(changes[STORAGE_KEYS.SETTINGS].newValue || {}) };
      }
      if (changes[STORAGE_KEYS.GATE]) {
        state.gate = changes[STORAGE_KEYS.GATE].newValue || { unlockUntil: 0, reason: '' };
      }
      if (changes[STORAGE_KEYS.STUDY_LIST]) {
        state.studyList = Array.isArray(changes[STORAGE_KEYS.STUDY_LIST].newValue)
          ? changes[STORAGE_KEYS.STUDY_LIST].newValue
          : [];
      }
      if (changes[STORAGE_KEYS.NOTES]) {
        state.notes = changes[STORAGE_KEYS.NOTES].newValue || {};
      }
      if (changes[STORAGE_KEYS.DAILY_STATS]) {
        state.dailyStats = changes[STORAGE_KEYS.DAILY_STATS].newValue || state.dailyStats;
      }
      render();
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
