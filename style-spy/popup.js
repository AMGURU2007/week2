/**
 * Style Spy - Popup Controller
 * Manages active tab style extraction, palette rendering, typography inspection,
 * design kit persistence with chrome.storage.local, and CSS variable export.
 */

'use strict';

document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Element References ---
  const domainBadge = document.getElementById('domain-badge');
  const rescanBtn = document.getElementById('rescan-btn');
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');
  const savedCountBadge = document.getElementById('saved-count-badge');

  // Current Page Tab Elements
  const loadingState = document.getElementById('loading-state');
  const errorState = document.getElementById('error-state');
  const errorTitle = document.getElementById('error-title');
  const errorMsg = document.getElementById('error-msg');
  const errorRetryBtn = document.getElementById('error-retry-btn');
  const dataContainer = document.getElementById('data-container');
  const statElements = document.getElementById('stat-elements');
  const statColors = document.getElementById('stat-colors');
  const statFonts = document.getElementById('stat-fonts');
  const quickCopyAllBtn = document.getElementById('quick-copy-all-btn');
  const colorsGrid = document.getElementById('colors-grid');
  const typographyList = document.getElementById('typography-list');
  const kitNameInput = document.getElementById('kit-name-input');
  const saveKitBtn = document.getElementById('save-kit-btn');

  // Saved Kits Tab Elements
  const savedKitsEmpty = document.getElementById('saved-kits-empty');
  const savedKitsList = document.getElementById('saved-kits-list');

  // Global Toast
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toast-msg');
  let toastTimer = null;

  // State
  let currentExtraction = null;
  let currentTabId = null;

  // --- Initial Setup ---
  init();

  async function init() {
    setupTabSwitching();
    setupEventListeners();
    await updateSavedBadge();
    await scanActiveTab();
  }

  // --- Tab Navigation ---
  function setupTabSwitching() {
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTabId = btn.getAttribute('data-tab');

        tabBtns.forEach(b => {
          b.classList.toggle('active', b === btn);
          b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
        });

        tabPanes.forEach(pane => {
          pane.classList.toggle('active', pane.id === targetTabId);
        });

        if (targetTabId === 'tab-saved') {
          renderSavedKits();
        }
      });
    });
  }

  // --- Event Listeners ---
  function setupEventListeners() {
    rescanBtn.addEventListener('click', () => {
      rescanBtn.classList.add('spinning');
      scanActiveTab().finally(() => {
        setTimeout(() => rescanBtn.classList.remove('spinning'), 400);
      });
    });

    errorRetryBtn.addEventListener('click', () => {
      scanActiveTab();
    });

    saveKitBtn.addEventListener('click', handleSaveKit);

    kitNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        handleSaveKit();
      }
    });

    quickCopyAllBtn.addEventListener('click', () => {
      if (!currentExtraction || !currentExtraction.colors.length) return;
      const hexList = currentExtraction.colors.map(c => c.hex).join(', ');
      copyToClipboard(hexList, 'Copied all color hex codes!');
    });
  }

  // --- Active Tab Style Extraction ---
  async function scanActiveTab() {
    showLoading();

    try {
      // 1. Get active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) {
        showError('No Active Tab', 'Unable to find an active browser tab to inspect.');
        return;
      }

      currentTabId = tab.id;

      // 2. Validate URL
      const url = tab.url || '';
      if (!url || url.startsWith('chrome://') || url.startsWith('chrome-extension://') || url.startsWith('edge://') || url.startsWith('about:')) {
        showError('Restricted Page', 'Chrome prevents extensions from running scripts on internal browser pages. Please open a regular website or local HTML file.');
        domainBadge.textContent = 'restricted';
        return;
      }

      try {
        const parsedUrl = new URL(url);
        domainBadge.textContent = parsedUrl.hostname || 'local';
        domainBadge.title = url;
      } catch (e) {
        domainBadge.textContent = 'page';
      }

      // 3. Inject and execute extractor.js
      let results;
      try {
        results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['extractor.js']
        });
      } catch (err) {
        // If file execution fails, check permissions
        console.warn('Script execution error:', err);
        showError('Inspection Failed', 'Could not access the page DOM. Ensure the tab has finished loading and permissions are granted.');
        return;
      }

      if (!results || !results[0] || !results[0].result) {
        showError('Empty Response', 'The style extractor did not return valid DOM data.');
        return;
      }

      currentExtraction = results[0].result;
      renderExtractedData(currentExtraction);
    } catch (err) {
      console.error('Scan error:', err);
      showError('Unexpected Error', err.message || 'An error occurred during inspection.');
    }
  }

  // --- Render Extracted Data ---
  function renderExtractedData(data) {
    hideLoading();

    // Update Stats Bar
    statElements.textContent = `${data.stats.totalElementsScanned} elements`;
    statColors.textContent = `${data.colors.length} colors`;
    statFonts.textContent = `${data.typography.length} font styles`;

    // Suggest default kit name
    const siteName = (data.title || data.domain || 'Design').replace(/[^a-zA-Z0-9\s_-]/g, '').trim();
    kitNameInput.value = `${siteName} Kit`;

    // 1. Render Color Palette Grid
    colorsGrid.innerHTML = '';
    if (data.colors.length === 0) {
      colorsGrid.innerHTML = '<div class="state-subtitle" style="grid-column: 1/-1; padding: 12px;">No visible colors found.</div>';
    } else {
      data.colors.forEach((color, idx) => {
        const card = document.createElement('div');
        card.className = 'color-swatch-card';
        card.title = `Click to copy ${color.hex}\nUsage: ${color.count} times`;

        // Determine dominant role
        const roles = color.roles || { text: 0, background: 0, border: 0 };
        const primaryRole = Object.keys(roles).reduce((a, b) => roles[a] > roles[b] ? a : b, 'text');

        card.innerHTML = `
          <div class="swatch-preview" style="background-color: ${color.hex};">
            <span class="swatch-count-pill">${color.count}×</span>
          </div>
          <div class="swatch-meta">
            <div class="swatch-hex">${color.hex}</div>
            <div class="swatch-role-tags">
              <span class="swatch-tag">${primaryRole}</span>
              ${idx === 0 ? '<span class="swatch-tag" style="color: var(--accent-cyan);">#1</span>' : ''}
            </div>
          </div>
        `;

        card.addEventListener('click', () => {
          copyToClipboard(color.hex, `Copied ${color.hex}`);
          card.style.transform = 'scale(0.96)';
          setTimeout(() => card.style.transform = '', 150);
        });

        colorsGrid.appendChild(card);
      });
    }

    // 2. Render Typography Hierarchy
    typographyList.innerHTML = '';
    if (data.typography.length === 0) {
      typographyList.innerHTML = '<div class="state-subtitle" style="padding: 12px;">No text elements found.</div>';
    } else {
      data.typography.forEach(type => {
        const card = document.createElement('div');
        card.className = 'type-row-card';
        card.title = 'Click to copy CSS rule';

        const cssSnippet = `font-family: ${type.fullFontFamily};\nfont-size: ${type.fontSize};\nfont-weight: ${type.fontWeight};\nline-height: ${type.lineHeight};`;

        card.innerHTML = `
          <div class="type-row-header">
            <div class="type-font-info">
              <span class="type-font-name">${escapeHtml(type.fontFamily)}</span>
              <span class="type-category-pill ${type.category}">${type.category}</span>
            </div>
            <div class="type-specs">
              <span>${type.fontWeight}</span>
              <span class="bullet">•</span>
              <span>${type.fontSize}</span>
              <span class="type-count">(${type.count}×)</span>
            </div>
          </div>
          <div class="type-preview-box" style="font-family: ${type.fullFontFamily}; font-size: ${Math.min(type.fontSizePx, 22)}px; font-weight: ${type.fontWeight};">
            ${escapeHtml(type.sampleText || 'Aa Bb Cc 123')}
          </div>
          <div class="type-copy-hint">
            <svg viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" stroke-width="2" fill="none">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            <span>Copy CSS</span>
          </div>
        `;

        card.addEventListener('click', () => {
          copyToClipboard(cssSnippet, `Copied CSS: ${type.fontFamily} (${type.fontSize})`);
          card.style.borderColor = 'var(--border-focus)';
          setTimeout(() => card.style.borderColor = '', 300);
        });

        typographyList.appendChild(card);
      });
    }
  }

  // --- Save Design Kit ---
  async function handleSaveKit() {
    if (!currentExtraction) {
      showToast('No active page inspection data to save.', true);
      return;
    }

    const name = kitNameInput.value.trim() || `${currentExtraction.domain} Kit`;
    const newKit = {
      id: 'kit_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      name: name,
      domain: currentExtraction.domain,
      url: currentExtraction.url,
      createdAt: new Date().toISOString(),
      colors: currentExtraction.colors,
      typography: currentExtraction.typography,
      stats: currentExtraction.stats
    };

    try {
      const stored = await chrome.storage.local.get(['styleSpyKits']);
      const kits = stored.styleSpyKits || [];

      // Prepend so latest appears first
      kits.unshift(newKit);

      await chrome.storage.local.set({ styleSpyKits: kits });
      await updateSavedBadge();

      showToast(`Saved "${name}"!`);

      // Visual button feedback
      saveKitBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <span>Saved!</span>
      `;
      saveKitBtn.style.backgroundColor = 'var(--accent-green-hover)';

      setTimeout(() => {
        saveKitBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
            <polyline points="7 3 7 8 15 8"/>
          </svg>
          <span>Save Kit</span>
        `;
        saveKitBtn.style.backgroundColor = '';
      }, 1500);
    } catch (err) {
      console.error('Failed to save kit:', err);
      showToast('Failed to save kit to storage.', true);
    }
  }

  // --- Render Saved Kits Tab ---
  async function renderSavedKits() {
    try {
      const stored = await chrome.storage.local.get(['styleSpyKits']);
      const kits = stored.styleSpyKits || [];

      updateSavedBadge(kits.length);

      if (kits.length === 0) {
        savedKitsEmpty.classList.remove('hidden');
        savedKitsList.innerHTML = '';
        return;
      }

      savedKitsEmpty.classList.add('hidden');
      savedKitsList.innerHTML = '';

      kits.forEach((kit) => {
        const card = document.createElement('div');
        card.className = 'kit-card';

        const dateStr = formatDate(kit.createdAt);
        const topColors = (kit.colors || []).slice(0, 8);

        // Color dots HTML
        const colorDotsHtml = topColors.map(c =>
          `<span class="kit-color-dot" style="background-color: ${c.hex};" title="${c.hex} (${c.count}×)"></span>`
        ).join('');

        card.innerHTML = `
          <div class="kit-card-top">
            <div class="kit-title-group">
              <span class="kit-card-title">${escapeHtml(kit.name)}</span>
              <span class="kit-card-meta">${escapeHtml(kit.domain || 'web')} • ${dateStr}</span>
            </div>
            <div class="kit-card-stats">
              <span class="kit-pill">${kit.colors ? kit.colors.length : 0} colors</span>
              <span class="kit-pill">${kit.typography ? kit.typography.length : 0} fonts</span>
            </div>
          </div>

          <div class="kit-color-bar" title="Preview Palette">
            ${colorDotsHtml}
          </div>

          <div class="kit-card-actions">
            <button class="btn btn-secondary btn-sm export-css-btn" title="Export as CSS :root variables">
              <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none">
                <polyline points="16 18 22 12 16 6"/>
                <polyline points="8 6 2 12 8 18"/>
              </svg>
              <span>Export CSS</span>
            </button>
            <button class="btn btn-danger btn-sm delete-kit-btn" title="Delete kit">
              <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2" fill="none">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              <span>Delete</span>
            </button>
          </div>
        `;

        // Export CSS Action
        const exportBtn = card.querySelector('.export-css-btn');
        exportBtn.addEventListener('click', () => {
          const cssOutput = generateCssVariables(kit);
          copyToClipboard(cssOutput, `Exported :root CSS for "${kit.name}"!`);
        });

        // Delete Kit Action
        const deleteBtn = card.querySelector('.delete-kit-btn');
        deleteBtn.addEventListener('click', async () => {
          await deleteKit(kit.id, kit.name);
        });

        savedKitsList.appendChild(card);
      });
    } catch (err) {
      console.error('Failed to load saved kits:', err);
    }
  }

  // --- Delete Design Kit ---
  async function deleteKit(kitId, kitName) {
    try {
      const stored = await chrome.storage.local.get(['styleSpyKits']);
      let kits = stored.styleSpyKits || [];
      kits = kits.filter(k => k.id !== kitId);
      await chrome.storage.local.set({ styleSpyKits: kits });
      showToast(`Deleted "${kitName}"`);
      await renderSavedKits();
    } catch (err) {
      console.error('Delete kit error:', err);
      showToast('Could not delete kit.', true);
    }
  }

  // --- Generate Clean CSS Custom Properties ---
  function generateCssVariables(kit) {
    const lines = [];
    const safeName = kit.name.replace(/\*\//g, '');
    const safeDomain = (kit.domain || 'web').replace(/\*\//g, '');
    const dateFormatted = new Date().toISOString().split('T')[0];

    lines.push(`/* ========================================================`);
    lines.push(`   Style Spy Design Kit: ${safeName}`);
    lines.push(`   Source: ${safeDomain}`);
    lines.push(`   Exported: ${dateFormatted}`);
    lines.push(`   ======================================================== */`);
    lines.push(`:root {`);

    // 1. Color Palette Custom Properties
    if (kit.colors && kit.colors.length > 0) {
      lines.push(`  /* --- Color Palette (Ranked by Usage) --- */`);
      kit.colors.forEach((c, idx) => {
        lines.push(`  --color-${idx + 1}: ${c.hex}; /* ${c.count} occurrences */`);
      });

      // Semantic Color Assignments
      lines.push(``);
      lines.push(`  /* --- Semantic Color Aliases --- */`);
      const topColor = kit.colors[0] ? kit.colors[0].hex : '#000000';
      const secColor = kit.colors[1] ? kit.colors[1].hex : '#333333';
      
      // Find candidate background, text, border
      const bgCand = kit.colors.find(c => c.roles && c.roles.background > c.roles.text) || kit.colors[0];
      const textCand = kit.colors.find(c => c.roles && c.roles.text > 0 && c.hex !== bgCand.hex) || kit.colors[1] || kit.colors[0];
      const borderCand = kit.colors.find(c => c.roles && c.roles.border > 0) || kit.colors[2] || kit.colors[1] || kit.colors[0];

      lines.push(`  --color-primary: ${topColor};`);
      lines.push(`  --color-secondary: ${secColor};`);
      lines.push(`  --color-bg: ${bgCand.hex};`);
      lines.push(`  --color-text: ${textCand.hex};`);
      lines.push(`  --color-border: ${borderCand.hex};`);
    }

    // 2. Typography Hierarchy Custom Properties
    if (kit.typography && kit.typography.length > 0) {
      lines.push(``);
      lines.push(`  /* --- Typography Hierarchy --- */`);

      const headingType = kit.typography.find(t => t.category === 'heading') || kit.typography[0];
      const bodyType = kit.typography.find(t => t.category === 'body') || kit.typography[1] || kit.typography[0];
      const codeType = kit.typography.find(t => t.category === 'code');

      if (headingType) {
        lines.push(`  --font-heading: ${headingType.fullFontFamily};`);
        lines.push(`  --font-heading-size: ${headingType.fontSize};`);
        lines.push(`  --font-heading-weight: ${headingType.fontWeight};`);
      }

      if (bodyType) {
        lines.push(`  --font-body: ${bodyType.fullFontFamily};`);
        lines.push(`  --font-body-size: ${bodyType.fontSize};`);
        lines.push(`  --font-body-weight: ${bodyType.fontWeight};`);
      }

      if (codeType) {
        lines.push(`  --font-code: ${codeType.fullFontFamily};`);
        lines.push(`  --font-code-size: ${codeType.fontSize};`);
      }

      lines.push(``);
      lines.push(`  /* --- All Extracted Font Combinations --- */`);
      kit.typography.forEach((t, i) => {
        lines.push(`  --font-style-${i + 1}: ${t.fontWeight} ${t.fontSize} ${t.fullFontFamily};`);
      });
    }

    lines.push(`}`);
    return lines.join('\n');
  }

  // --- Badge Counter Update ---
  async function updateSavedBadge(count) {
    if (count === undefined) {
      const stored = await chrome.storage.local.get(['styleSpyKits']);
      count = stored.styleSpyKits ? stored.styleSpyKits.length : 0;
    }
    savedCountBadge.textContent = count;
  }

  // --- UI State Helpers ---
  function showLoading() {
    loadingState.classList.remove('hidden');
    errorState.classList.add('hidden');
    dataContainer.style.opacity = '0.3';
    dataContainer.style.pointerEvents = 'none';
  }

  function hideLoading() {
    loadingState.classList.add('hidden');
    errorState.classList.add('hidden');
    dataContainer.style.opacity = '1';
    dataContainer.style.pointerEvents = 'auto';
  }

  function showError(title, msg) {
    loadingState.classList.add('hidden');
    errorState.classList.remove('hidden');
    errorTitle.textContent = title;
    errorMsg.textContent = msg;
    dataContainer.style.opacity = '0.1';
    dataContainer.style.pointerEvents = 'none';
  }

  // --- Toast Notification ---
  function showToast(message, isError = false) {
    if (toastTimer) clearTimeout(toastTimer);

    toastMsg.textContent = message;
    const toastIcon = document.getElementById('toast-icon');
    if (isError) {
      toastIcon.textContent = '✕';
      toastIcon.style.color = 'var(--accent-red)';
    } else {
      toastIcon.textContent = '✓';
      toastIcon.style.color = '#34D399';
    }

    toast.classList.add('show');
    toastTimer = setTimeout(() => {
      toast.classList.remove('show');
    }, 2200);
  }

  // --- Clipboard Copy Helper ---
  async function copyToClipboard(text, successMessage) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for document copy
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      showToast(successMessage || 'Copied to clipboard!');
    } catch (err) {
      console.error('Clipboard copy failed:', err);
      showToast('Could not copy to clipboard', true);
    }
  }

  // --- Utilities ---
  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatDate(isoStr) {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return isoStr;
    }
  }
});
