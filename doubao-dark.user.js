// ==UserScript==
// @name         豆包深色模式增强
// @namespace    https://dev.napreth.com/
// @version      1.1.0
// @description  提供浅色、跟随系统、深色三态切换，并补全 Markdown、代码块、表格、图表和功能浮层的深色适配。
// @icon         https://raw.githubusercontent.com/Napreth/doubao-dark/main/doubao.png
// @author       Napreth, Codex
// @match        https://www.doubao.com/*
// @run-at       document-start
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @license      MIT
// ==/UserScript==

(() => {
  'use strict';

  const PREFERENCE_KEY = 'dbx-web-theme';
  const CODE_THEME_KEY = 'flow-web-code-block-theme-store';
  const MODE_KEY = 'doubao-userscript-theme-mode';
  const SWITCHER_VISIBLE_KEY = 'doubao-userscript-theme-switcher-visible';
  const STYLE_ID = 'doubao-system-theme-enhancements';
  const SWITCHER_ID = 'doubao-system-theme-switcher';
  const DARK_QUERY = '(prefers-color-scheme: dark)';
  const MODES = ['light', 'system', 'dark'];
  const media = matchMedia(DARK_QUERY);
  const nativeSetAttribute = Element.prototype.setAttribute;
  const menuIds = [];
  let applying = false;
  let scheduled = false;
  let currentMode = readMode();
  let switcherVisible = readSwitcherVisibility();

  function readMode() {
    try {
      const value = localStorage.getItem(MODE_KEY);
      return MODES.includes(value) ? value : 'system';
    } catch {
      return 'system';
    }
  }

  function readSwitcherVisibility() {
    try {
      return localStorage.getItem(SWITCHER_VISIBLE_KEY) !== 'false';
    } catch {
      return true;
    }
  }

  const resolvedTheme = () => currentMode === 'system'
    ? (media.matches ? 'dark' : 'light')
    : currentMode;

  function setNativePreference() {
    try {
      if (localStorage.getItem(PREFERENCE_KEY) !== currentMode) {
        localStorage.setItem(PREFERENCE_KEY, currentMode);
      }
    } catch {}

    try {
      document.cookie = `${PREFERENCE_KEY}=${currentMode}; Max-Age=34560000; Path=/; Domain=.doubao.com; SameSite=Lax; Secure`;
    } catch {}
  }

  function syncCodeTheme(theme) {
    try {
      let store = {};
      try {
        store = JSON.parse(localStorage.getItem(CODE_THEME_KEY) || '{}');
      } catch {}
      if (!store || typeof store !== 'object') store = {};
      if (!store.state || typeof store.state !== 'object') store.state = {};
      if (store.state.codeBlockMode === theme) return;
      store.state.codeBlockMode = theme;
      if (typeof store.version !== 'number') store.version = 0;
      localStorage.setItem(CODE_THEME_KEY, JSON.stringify(store));
    } catch {}
  }

  function setThemeAttribute(element, attribute, theme) {
    if (element?.getAttribute(attribute) !== theme) {
      nativeSetAttribute.call(element, attribute, theme);
    }
  }

  function syncThemeContainers(root, theme) {
    if (!(root instanceof Element || root instanceof Document || root instanceof DocumentFragment)) return;
    const elements = [];
    if (root instanceof Element) elements.push(root);
    elements.push(...root.querySelectorAll?.([
      '.flow-markdown-body',
      '[theme-mode]',
      '[data-theme-mode]',
      '[class*="code-canvas-theme"]',
      '[class*="term-canvas"]',
      '[data-markdown-line-underlines]'
    ].join(',')) || []);

    for (const element of elements) {
      if (element.matches('.flow-markdown-body,[theme-mode]')) setThemeAttribute(element, 'theme-mode', theme);
      if (element.matches('[data-theme-mode],[data-markdown-line-underlines]')) setThemeAttribute(element, 'data-theme-mode', theme);
      if (element.matches('[class*="code-canvas-theme"],[class*="term-canvas"]')) setThemeAttribute(element, 'data-theme', theme);
      if (element.shadowRoot) syncThemeContainers(element.shadowRoot, theme);
    }
  }

  function updateThemeColor(theme) {
    const color = theme === 'dark' ? '#181818' : '#ffffff';
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta && document.head) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.append(meta);
    }
    if (meta?.content !== color) meta.content = color;
  }

  function applyTheme(root = document) {
    if (applying) return;
    applying = true;
    try {
      const theme = resolvedTheme();
      const html = document.documentElement;
      if (html) {
        setThemeAttribute(html, 'data-theme', theme);
        html.style.colorScheme = theme;
      }
      syncCodeTheme(theme);
      syncThemeContainers(root, theme);
      updateThemeColor(theme);
      ensureSwitcher();
    } finally {
      applying = false;
    }
  }

  function schedule(root = document) {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      applyTheme(root);
    });
  }

  function storeMode(mode) {
    try {
      localStorage.setItem(MODE_KEY, mode);
    } catch {}
  }

  function storeSwitcherVisibility(visible) {
    try {
      localStorage.setItem(SWITCHER_VISIBLE_KEY, String(visible));
    } catch {}
  }

  function setMode(mode) {
    if (!MODES.includes(mode)) return;
    currentMode = mode;
    storeMode(mode);
    setNativePreference();
    applyTheme(document);
    renderSwitcher();
    registerMenus();
  }

  function setSwitcherVisible(visible) {
    switcherVisible = Boolean(visible);
    storeSwitcherVisibility(switcherVisible);
    ensureSwitcher();
    registerMenus();
  }

  function ensureSwitcher() {
    let host = document.getElementById(SWITCHER_ID);
    if (!switcherVisible) {
      host?.remove();
      return;
    }
    if (!document.documentElement) return;

    if (!host) {
      host = document.createElement('div');
      host.id = SWITCHER_ID;
      const shadow = host.attachShadow({ mode: 'open' });
      shadow.innerHTML = `
        <style>
          :host {
            all: initial;
            position: fixed;
            z-index: 2147483646;
            top: 14px;
            right: 72px;
            display: block;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          }
          .pill {
            display: flex;
            align-items: center;
            gap: 2px;
            padding: 3px;
            border: 1px solid var(--border);
            border-radius: 999px;
            background: var(--surface);
            color: var(--text);
            box-shadow: 0 5px 18px rgba(0, 0, 0, var(--shadow-alpha));
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
          }
          button {
            appearance: none;
            border: 0;
            border-radius: 999px;
            min-width: 44px;
            height: 28px;
            padding: 0 10px;
            background: transparent;
            color: var(--muted);
            font: 500 12px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            cursor: pointer;
            transition: background-color 120ms ease, color 120ms ease, box-shadow 120ms ease;
          }
          button:hover { color: var(--text); background: var(--hover); }
          button:focus-visible { outline: 2px solid #378dff; outline-offset: 1px; }
          button.active {
            color: #fff;
            background: #2878eb;
            box-shadow: 0 2px 8px rgba(40, 120, 235, 0.32);
          }
          :host([data-resolved="dark"]) {
            --surface: rgba(38, 38, 38, 0.92);
            --border: rgba(255, 255, 255, 0.13);
            --text: rgba(255, 255, 255, 0.92);
            --muted: rgba(255, 255, 255, 0.58);
            --hover: rgba(255, 255, 255, 0.10);
            --shadow-alpha: 0.38;
          }
          :host([data-resolved="light"]) {
            --surface: rgba(255, 255, 255, 0.94);
            --border: rgba(0, 0, 0, 0.11);
            --text: rgba(0, 0, 0, 0.88);
            --muted: rgba(0, 0, 0, 0.54);
            --hover: rgba(0, 0, 0, 0.07);
            --shadow-alpha: 0.16;
          }
          @media (max-width: 700px) {
            :host { top: 10px; right: 52px; }
            button { min-width: 36px; height: 26px; padding: 0 7px; font-size: 11px; }
          }
        </style>
        <div class="pill" role="group" aria-label="豆包主题模式">
          <button type="button" data-mode="light" title="始终使用浅色模式">浅色</button>
          <button type="button" data-mode="system" title="跟随系统主题">系统</button>
          <button type="button" data-mode="dark" title="始终使用深色模式">深色</button>
        </div>
      `;
      shadow.addEventListener('click', event => {
        const button = event.target.closest?.('button[data-mode]');
        if (!button) return;
        event.preventDefault();
        event.stopPropagation();
        setMode(button.dataset.mode);
      });
      document.documentElement.append(host);
    }
    renderSwitcher();
  }

  function renderSwitcher() {
    const host = document.getElementById(SWITCHER_ID);
    if (!host?.shadowRoot) return;
    host.dataset.resolved = resolvedTheme();
    for (const button of host.shadowRoot.querySelectorAll('button[data-mode]')) {
      const active = button.dataset.mode === currentMode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    }
  }

  function registerMenus() {
    if (typeof GM_registerMenuCommand !== 'function') return;
    if (typeof GM_unregisterMenuCommand === 'function') {
      while (menuIds.length) {
        try { GM_unregisterMenuCommand(menuIds.pop()); } catch {}
      }
    }
    const labels = { light: '浅色', system: '跟随系统', dark: '深色' };
    for (const mode of MODES) {
      const mark = currentMode === mode ? '✓ ' : '';
      menuIds.push(GM_registerMenuCommand(`主题模式：${mark}${labels[mode]}`, () => setMode(mode)));
    }
    menuIds.push(GM_registerMenuCommand(
      `页面切换按钮：${switcherVisible ? '✓ 显示（点击隐藏）' : '隐藏（点击显示）'}`,
      () => setSwitcherVisible(!switcherVisible)
    ));
  }

  // 豆包内部会写 data-theme。只约束根元素这一处，使其始终解析为所选模式。
  Element.prototype.setAttribute = function (name, value) {
    if (this === document.documentElement && name === 'data-theme' && (value === 'dark' || value === 'light')) {
      value = resolvedTheme();
    }
    return nativeSetAttribute.call(this, name, value);
  };

  const CSS = `
    :root {
      color-scheme: light;
    }

    html[data-theme="dark"] {
      color-scheme: dark;
      --md-box-color-fg: rgba(255, 255, 255, 0.88) !important;
      --md-box-color-syntax-text: rgba(255, 255, 255, 0.85) !important;
      --md-box-samantha-normal-text-color: rgba(255, 255, 255, 0.88) !important;
      --md-box-samantha-deep-text-color: rgba(255, 255, 255, 0.96) !important;
      --md-box-samantha-li-maker-color: rgba(255, 255, 255, 0.58) !important;
      --md-box-samantha-split-line-color: rgba(255, 255, 255, 0.14) !important;
      --md-box-samantha-blockquote-left-border-color: rgba(255, 255, 255, 0.30) !important;
      --md-box-samantha-blockquote-text-color: rgba(255, 255, 255, 0.68) !important;
      --md-box-samantha-image-title-color: rgba(255, 255, 255, 0.58) !important;
      --chat-md-codeblock-bg-color: #15171b !important;
      --chat-md-codeblock-header-bg-color: #202329 !important;
      --code-header-icon-color: rgba(255, 255, 255, 0.56) !important;
      --code-header-text-color: rgba(255, 255, 255, 0.88) !important;
      --code-text_v3: rgba(255, 255, 255, 0.88) !important;
      --code-doc_v3: rgba(255, 255, 255, 0.52) !important;
      --code-variable_v3: rgba(255, 255, 255, 0.88) !important;
    }

    html[data-theme="dark"] body,
    html[data-theme="dark"] input,
    html[data-theme="dark"] textarea,
    html[data-theme="dark"] select,
    html[data-theme="dark"] button {
      color-scheme: dark;
    }

    html[data-theme="dark"] input,
    html[data-theme="dark"] textarea,
    html[data-theme="dark"] [contenteditable="true"] {
      caret-color: rgba(255, 255, 255, 0.92);
    }

    html[data-theme="dark"] input::placeholder,
    html[data-theme="dark"] textarea::placeholder,
    html[data-theme="dark"] [contenteditable="true"]:empty::before {
      color: rgba(255, 255, 255, 0.38) !important;
    }

    html[data-theme="dark"] [class*="code-block-element"],
    html[data-theme="dark"] [class*="code-block"],
    html[data-theme="dark"] [class*="container-"][class*="language-"] {
      --chat-md-codeblock-bg-color: #15171b !important;
      --chat-md-codeblock-header-bg-color: #202329 !important;
      --code-header-icon-color: rgba(255, 255, 255, 0.56) !important;
      --code-header-text-color: rgba(255, 255, 255, 0.88) !important;
      --code-text_v3: rgba(255, 255, 255, 0.88) !important;
      --code-doc_v3: rgba(255, 255, 255, 0.52) !important;
      --code-variable_v3: rgba(255, 255, 255, 0.88) !important;
      scrollbar-color: #555 transparent;
    }

    html[data-theme="dark"] pre {
      color: rgba(255, 255, 255, 0.88);
      scrollbar-color: #555 transparent;
    }

    html[data-theme="dark"] :not(pre) > code {
      color: rgba(255, 255, 255, 0.88);
      background: rgba(255, 255, 255, 0.12);
      border-color: rgba(255, 255, 255, 0.10);
    }

    html[data-theme="dark"] .md-box-root,
    html[data-theme="dark"] [class*="markdown"] {
      color: rgba(255, 255, 255, 0.88);
    }

    html[data-theme="dark"] .md-box-root a,
    html[data-theme="dark"] [class*="markdown"] a {
      color: #77b0ff;
    }

    html[data-theme="dark"] table {
      color: rgba(255, 255, 255, 0.88);
      border-color: rgba(255, 255, 255, 0.14) !important;
    }

    html[data-theme="dark"] table thead,
    html[data-theme="dark"] table th {
      background: rgba(255, 255, 255, 0.055) !important;
      color: rgba(255, 255, 255, 0.94) !important;
    }

    html[data-theme="dark"] table td,
    html[data-theme="dark"] table th,
    html[data-theme="dark"] hr {
      border-color: rgba(255, 255, 255, 0.14) !important;
    }

    html[data-theme="dark"] blockquote {
      color: rgba(255, 255, 255, 0.68) !important;
      border-color: rgba(255, 255, 255, 0.30) !important;
    }

    html[data-theme="dark"] [role="dialog"],
    html[data-theme="dark"] [role="menu"],
    html[data-theme="dark"] [role="listbox"],
    html[data-theme="dark"] [role="tooltip"],
    html[data-theme="dark"] [data-radix-popper-content-wrapper] {
      color-scheme: dark;
      --md-box-color-fg: rgba(255, 255, 255, 0.88) !important;
    }

    html[data-theme="dark"] [role="dialog"],
    html[data-theme="dark"] [role="menu"],
    html[data-theme="dark"] [role="listbox"] {
      border-color: rgba(255, 255, 255, 0.12) !important;
      box-shadow: 0 18px 52px rgba(0, 0, 0, 0.48);
    }

    html[data-theme="dark"] ::selection {
      color: #fff;
      background: rgba(55, 141, 255, 0.48);
    }

    html[data-theme="dark"] * {
      scrollbar-color: #555 transparent;
    }

    html[data-theme="dark"] *::-webkit-scrollbar-thumb {
      background-color: #555;
      border: 2px solid transparent;
      border-radius: 999px;
      background-clip: padding-box;
    }

    html[data-theme="dark"] *::-webkit-scrollbar-track {
      background: transparent;
    }

    /* Mermaid / SVG 图表。仅处理图表语义类，避免影响普通图标和图片。 */
    html[data-theme="dark"] :is(.messageText, .actor, .cluster-label, .edgeLabel, .label,
      .stateGroup .stateLabel, .classLabel, .relationshipLabel, .commit, .legend,
      .legend text, .grid .tick text, .titleText, .pieTitleText) {
      fill: rgba(255, 255, 255, 0.82) !important;
      color: rgba(255, 255, 255, 0.82) !important;
    }

    html[data-theme="dark"] :is(.messageLine0, .messageLine1, .flowchart-link, .branch,
      .relationshipLine, .transition, .relation) {
      stroke: rgba(255, 255, 255, 0.48) !important;
    }

    html[data-theme="dark"] :is(.node rect, .node circle, .node polygon, .classGroup rect,
      .entityBox, .note, .stateGroup) {
      stroke: rgba(255, 255, 255, 0.36) !important;
    }

    html[data-theme="dark"] #arrowhead path,
    html[data-theme="dark"] .marker path,
    html[data-theme="dark"] .extension {
      fill: rgba(255, 255, 255, 0.72) !important;
      stroke: rgba(255, 255, 255, 0.72) !important;
    }

    @media (prefers-color-scheme: light) {
      :root { color-scheme: light; }
    }
  `;

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    (document.head || document.documentElement).append(style);
  }

  function start() {
    setNativePreference();
    injectStyles();
    applyTheme(document);
    registerMenus();

    const observer = new MutationObserver(records => {
      let root = document;
      for (const record of records) {
        if (record.type === 'childList' && record.addedNodes.length) {
          const candidate = [...record.addedNodes].find(node => node.nodeType === Node.ELEMENT_NODE);
          if (candidate) root = candidate;
        }
      }
      schedule(root);
    });

    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-theme', 'theme-mode', 'data-theme-mode']
    });

    const onSystemChange = () => {
      if (currentMode === 'system') applyTheme(document);
      else renderSwitcher();
    };
    try {
      media.addEventListener('change', onSystemChange);
    } catch {
      media.addListener(onSystemChange);
    }

    addEventListener('pageshow', () => applyTheme(document), { passive: true });
  }

  setNativePreference();
  if (document.documentElement) start();
  else addEventListener('DOMContentLoaded', start, { once: true });

  Object.defineProperty(window, '__DOUBAO_SYSTEM_THEME__', {
    configurable: true,
    value: Object.freeze({
      version: '1.1.0',
      get preference() { return currentMode; },
      get resolvedTheme() { return resolvedTheme(); },
      get switcherVisible() { return switcherVisible; },
      setMode,
      setSwitcherVisible,
      refresh: () => applyTheme(document)
    })
  });
})();
