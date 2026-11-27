/**
 * Style Spy - DOM Style Extractor
 * Extracts color palette and typography hierarchy from visible DOM elements.
 */

(function () {
  'use strict';

  // Helper: Convert RGB / RGBA string to uppercase HEX (#RRGGBB or #RRGGBBAA)
  function parseColorToHex(colorStr) {
    if (!colorStr || typeof colorStr !== 'string') return null;
    const s = colorStr.trim().toLowerCase();
    
    // Ignore transparent values
    if (s === 'transparent' || s === 'inherit' || s === 'initial' || s === 'currentcolor') {
      return null;
    }
    
    // Check rgb / rgba format: rgb(r, g, b) or rgba(r, g, b, a)
    const rgbaMatch = s.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/);
    if (rgbaMatch) {
      const r = Math.min(255, Math.max(0, Math.round(parseFloat(rgbaMatch[1]))));
      const g = Math.min(255, Math.max(0, Math.round(parseFloat(rgbaMatch[2]))));
      const b = Math.min(255, Math.max(0, Math.round(parseFloat(rgbaMatch[3]))));
      const a = rgbaMatch[4] !== undefined ? parseFloat(rgbaMatch[4]) : 1;

      // Ignore zero or near-zero alpha (invisible)
      if (a <= 0.02) return null;

      const rHex = r.toString(16).padStart(2, '0').toUpperCase();
      const gHex = g.toString(16).padStart(2, '0').toUpperCase();
      const bHex = b.toString(16).padStart(2, '0').toUpperCase();

      if (a >= 0.99) {
        return `#${rHex}${gHex}${bHex}`;
      } else {
        const aHex = Math.round(a * 255).toString(16).padStart(2, '0').toUpperCase();
        return `#${rHex}${gHex}${bHex}${aHex}`;
      }
    }

    // Direct hex string
    if (s.startsWith('#')) {
      const hex = s.slice(1);
      if (hex.length === 3) {
        return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`.toUpperCase();
      } else if (hex.length === 6 || hex.length === 8) {
        return `#${hex}`.toUpperCase();
      }
    }

    return null;
  }

  // Calculate relative luminance for contrast & categorization
  function getLuminance(hex) {
    if (!hex || !hex.startsWith('#')) return 0.5;
    const cleanHex = hex.replace('#', '').slice(0, 6);
    if (cleanHex.length < 6) return 0.5;
    const r = parseInt(cleanHex.substr(0, 2), 16) / 255;
    const g = parseInt(cleanHex.substr(2, 2), 16) / 255;
    const b = parseInt(cleanHex.substr(4, 2), 16) / 255;
    const a = [r, g, b].map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  }

  // Clean and format font family
  function cleanFontFamily(fontFamilyStr) {
    if (!fontFamilyStr) return { primary: 'sans-serif', full: 'sans-serif' };
    const raw = fontFamilyStr.trim();
    // Split on commas to find primary font
    const fonts = raw.split(',').map(f => f.trim().replace(/^['"]|['"]$/g, ''));
    const primary = fonts[0] || 'sans-serif';
    return {
      primary: primary,
      full: raw.replace(/"/g, "'")
    };
  }

  // Normalize font weight to numeric representation
  function normalizeFontWeight(weight) {
    if (!weight) return '400';
    const str = String(weight).toLowerCase().trim();
    if (str === 'normal') return '400';
    if (str === 'bold') return '700';
    if (str === 'bolder') return '800';
    if (str === 'lighter') return '300';
    return str;
  }

  // Main DOM extraction function
  function extractStyles() {
    const startTime = performance.now();
    const colorMap = new Map(); // hex -> { hex, count, roles: { text, background, border }, rgb }
    const typographyMap = new Map(); // key -> { primary, full, fontSize, fontSizePx, fontWeight, lineHeight, count, sample }

    // Tags to completely skip
    const ignoredTags = new Set([
      'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'IFRAME', 'OBJECT', 'EMBED',
      'HEAD', 'META', 'TITLE', 'LINK', 'BR', 'WBR', 'SOURCE', 'TRACK', 'AUDIO', 'VIDEO'
    ]);

    // Track total scanned
    let totalElementsScanned = 0;

    // Helper to register color
    function recordColor(rawColor, role) {
      const hex = parseColorToHex(rawColor);
      if (!hex) return;

      if (!colorMap.has(hex)) {
        colorMap.set(hex, {
          hex: hex,
          count: 0,
          rgb: rawColor,
          roles: { text: 0, background: 0, border: 0 },
          luminance: getLuminance(hex),
          isLight: getLuminance(hex) > 0.5
        });
      }

      const item = colorMap.get(hex);
      item.count++;
      if (role && item.roles[role] !== undefined) {
        item.roles[role]++;
      }
    }

    // Traverse all elements
    const walker = document.createTreeWalker(
      document.body || document.documentElement,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode(node) {
          if (!node || !node.tagName) return NodeFilter.FILTER_REJECT;
          const tag = node.tagName.toUpperCase();
          if (ignoredTags.has(tag)) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let current = walker.currentNode;
    while (current) {
      if (current.nodeType === Node.ELEMENT_NODE) {
        totalElementsScanned++;
        const el = current;

        // Check visibility and dimensions
        const rects = el.getClientRects();
        const hasDimension = el.offsetWidth > 0 || el.offsetHeight > 0 || rects.length > 0;
        
        let style = null;
        try {
          style = window.getComputedStyle(el);
        } catch (e) {
          // In case element detached
          style = null;
        }

        if (style && style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity || '1') > 0 && hasDimension) {
          // --- 1. EXTRACT COLORS ---
          // Text color
          recordColor(style.color, 'text');

          // Background color
          recordColor(style.backgroundColor, 'background');

          // Border colors (only if border has measurable width and visible style)
          const sides = ['Top', 'Right', 'Bottom', 'Left'];
          for (const side of sides) {
            const width = parseFloat(style[`border${side}Width`] || '0');
            const borderStyle = style[`border${side}Style`];
            if (width > 0 && borderStyle && borderStyle !== 'none' && borderStyle !== 'hidden') {
              recordColor(style[`border${side}Color`], 'border');
            }
          }

          // Outline color (if active)
          const outlineWidth = parseFloat(style.outlineWidth || '0');
          if (outlineWidth > 0 && style.outlineStyle !== 'none') {
            recordColor(style.outlineColor, 'border');
          }

          // --- 2. EXTRACT TYPOGRAPHY ---
          // Check if element has direct non-whitespace text nodes
          let directText = '';
          for (let i = 0; i < el.childNodes.length; i++) {
            const child = el.childNodes[i];
            if (child.nodeType === Node.TEXT_NODE) {
              const trimmed = child.textContent.trim();
              if (trimmed.length > 0) {
                directText += (directText ? ' ' : '') + trimmed;
              }
            }
          }

          // Include inputs / buttons if they have text
          if (!directText) {
            if (el.tagName === 'INPUT' && (el.type === 'button' || el.type === 'submit') && el.value) {
              directText = el.value.trim();
            } else if (el.tagName === 'BUTTON' && el.innerText) {
              directText = el.innerText.trim();
            }
          }

          if (directText) {
            const fontInfo = cleanFontFamily(style.fontFamily);
            const fontSize = style.fontSize || '16px';
            const fontSizePx = Math.round(parseFloat(fontSize) || 16);
            const fontWeight = normalizeFontWeight(style.fontWeight);
            const lineHeight = style.lineHeight || 'normal';
            const fontStyle = style.fontStyle || 'normal';

            // Key for deduplication
            const typeKey = `${fontInfo.primary.toLowerCase()}__${fontWeight}__${fontSizePx}px`;

            if (!typographyMap.has(typeKey)) {
              // Determine semantic category
              let category = 'body';
              const tag = el.tagName.toUpperCase();
              if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(tag) || fontSizePx >= 24 || parseInt(fontWeight, 10) >= 700) {
                category = 'heading';
              } else if (fontSizePx <= 12) {
                category = 'caption';
              } else if (tag === 'CODE' || tag === 'PRE' || fontInfo.primary.toLowerCase().includes('mono')) {
                category = 'code';
              }

              // Truncate sample text
              const sample = directText.length > 32 ? directText.slice(0, 32).trim() + '…' : directText;

              typographyMap.set(typeKey, {
                id: typeKey,
                fontFamily: fontInfo.primary,
                fullFontFamily: fontInfo.full,
                fontSize: `${fontSizePx}px`,
                fontSizePx: fontSizePx,
                fontWeight: fontWeight,
                fontStyle: fontStyle,
                lineHeight: lineHeight,
                category: category,
                sampleText: sample,
                count: 0
              });
            }

            typographyMap.get(typeKey).count++;
          }
        }
      }

      current = walker.nextNode();
    }

    // Convert colors map to sorted array (descending by usage frequency)
    const sortedColors = Array.from(colorMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 36); // Return top colors

    // Convert typography map to sorted array
    const sortedTypography = Array.from(typographyMap.values())
      .sort((a, b) => {
        // Prioritize by usage count, then font size
        if (b.count !== a.count) return b.count - a.count;
        return b.fontSizePx - a.fontSizePx;
      })
      .slice(0, 20); // Return top unique typography styles

    const payload = {
      domain: window.location.hostname || 'local-page',
      title: document.title || window.location.hostname || 'Untitled Page',
      url: window.location.href,
      colors: sortedColors,
      typography: sortedTypography,
      stats: {
        totalElementsScanned: totalElementsScanned,
        uniqueColors: colorMap.size,
        uniqueTypography: typographyMap.size,
        scanDurationMs: Math.round(performance.now() - startTime)
      }
    };

    return payload;
  }

  // Expose on window for direct calls
  window.__styleSpyExtract = extractStyles;

  // Listen for extension messages if injected into page
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request && request.action === 'EXTRACT_STYLES') {
        const data = extractStyles();
        sendResponse(data);
      }
      return true; // Keep message channel open for async response
    });
  }

  // Return payload directly for chrome.scripting.executeScript results
  return extractStyles();
})();
