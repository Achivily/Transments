'use strict';

const tauri = window.__TAURI__;
const invoke = (cmd, args) => tauri.core.invoke(cmd, args);
const appWindow = tauri.window.getCurrentWindow();

const languageKey = 'transments.language';
const accentKey = 'transments.accent';
const modeKey = 'transments.mode';

const translations = window.I18N;

// Apple system colors: standard / vibrant / deep / soft (HIG light, dark, light-HC, dark-HC).
const SYSTEM_COLORS = [
  ['Blue', '蓝色', ['#007AFF', '#0A84FF', '#0040DD', '#409CFF']],
  ['Indigo', '靛蓝', ['#5856D6', '#5E5CE6', '#3634A3', '#7D7AFF']],
  ['Purple', '紫色', ['#AF52DE', '#BF5AF2', '#8944AB', '#DA8FFF']],
  ['Pink', '粉色', ['#FF2D55', '#FF375F', '#D30F45', '#FF6482']],
  ['Red', '红色', ['#FF3B30', '#FF453A', '#D70015', '#FF6961']],
  ['Orange', '橙色', ['#FF9500', '#FF9F0A', '#C93400', '#FFB340']],
  ['Yellow', '黄色', ['#FFCC00', '#FFD60A', '#B25000', '#FFD426']],
  ['Green', '绿色', ['#34C759', '#30D158', '#248A3D', '#30DB5B']],
  ['Mint', '薄荷', ['#00C7BE', '#63E6E2', '#0C817B', '#66D4CF']],
  ['Teal', '水鸭', ['#30B0C7', '#40C8E0', '#008299', '#5DE6FF']],
  ['Cyan', '青色', ['#32ADE6', '#64D2FF', '#0071A4', '#70D7FF']],
  ['Brown', '棕色', ['#A2845E', '#AC8E68', '#7F6545', '#B59469']],
  ['Graphite', '石墨', ['#8E8E93', '#AEAEB2', '#6C6C70', '#C7C7CC']]
];
const VARIANT_KEYS = ['variantStandard', 'variantVibrant', 'variantDeep', 'variantSoft'];

const IMAGE_FILTERS = [
  { value: 'auto', key: 'allImages' },
  { sep: true },
  { value: '.png', label: 'PNG' },
  { value: '.jpg', label: 'JPG / JPEG' },
  { value: '.webp', label: 'WebP' },
  { value: '.tif', label: 'TIFF' },
  { value: '.avif', label: 'AVIF' },
  { value: '.gif', label: 'GIF' },
  { value: '.bmp', label: 'BMP' },
  { value: '.heic', label: 'HEIC / HEIF' }
];

const IMAGE_FORMATS = [
  { value: 'png', label: 'PNG' },
  { value: 'webp', key: 'webpLossless' },
  { value: 'avif', key: 'avifLossless' },
  { value: 'gif', label: 'GIF' },
  { value: 'bmp', label: 'BMP' },
  { value: 'tiff', label: 'TIFF' },
  { value: 'jpeg', key: 'jpeg100' },
  { value: 'heic', label: 'HEIC' }
];

const VIDEO_FILTERS = [
  { value: 'auto', key: 'allVideos' },
  { sep: true },
  { value: '.mp4', label: 'MP4 / M4V' },
  { value: '.mkv', label: 'MKV' },
  { value: '.mov', label: 'MOV' },
  { value: '.webm', label: 'WebM' },
  { value: '.avi', label: 'AVI' },
  { value: '.flv', label: 'FLV' },
  { value: '.wmv', label: 'WMV' },
  { value: '.ts', label: 'TS / MTS / M2TS' },
  { value: '.mpg', label: 'MPG / MPEG' },
  { value: '.3gp', label: '3GP' },
  { value: '.ogv', label: 'OGV' },
  { value: '.gif', label: 'GIF' }
];

const VIDEO_FORMATS = [
  { value: 'mp4', label: 'MP4', hintKey: 'fmtMp4' },
  { value: 'mkv', label: 'MKV', hintKey: 'fmtMkv' },
  { value: 'mov', label: 'MOV', hintKey: 'fmtMov' },
  { value: 'webm', label: 'WebM', hintKey: 'fmtWebm' },
  { value: 'avi', label: 'AVI', hintKey: 'fmtAvi' },
  { value: 'flv', label: 'FLV', hintKey: 'fmtFlv' },
  { value: 'wmv', label: 'WMV', hintKey: 'fmtWmv' },
  { value: 'ts', label: 'TS', hintKey: 'fmtTs' },
  { value: 'mpg', label: 'MPEG', hintKey: 'fmtMpg' },
  { value: 'm4v', label: 'M4V', hintKey: 'fmtM4v' },
  { value: '3gp', label: '3GP', hintKey: 'fmt3gp' },
  { sep: true },
  { value: 'gif', label: 'GIF', hintKey: 'fmtGif' },
  { value: 'mp3', label: 'MP3', hintKey: 'fmtMp3' }
];

const PAGES = {
  image: {
    icon: '#i-photo',
    headingKey: 'batchConversion',
    pickKey: 'chooseImages',
    emptyTitleKey: 'emptyTitle',
    emptyHintKey: 'formatList',
    dropKey: 'dropTitle',
    filters: IMAGE_FILTERS,
    formats: IMAGE_FORMATS,
    defaultFormat: 'png',
    presets: {
      webpArchive: { labelKey: 'presetWebp', metaKey: 'presetWebpMeta', formatFilter: 'auto', outputFormat: 'webp', lossless: true, recursive: true },
      jpegShare: { labelKey: 'presetJpeg', metaKey: 'presetJpegMeta', formatFilter: 'auto', outputFormat: 'jpeg', lossless: false, recursive: false },
      heicToPng: { labelKey: 'presetHeic', metaKey: 'presetHeicMeta', formatFilter: '.heic', outputFormat: 'png', lossless: true, recursive: false },
      folderAvif: { labelKey: 'presetAvif', metaKey: 'presetAvifMeta', formatFilter: 'auto', outputFormat: 'avif', lossless: true, recursive: true }
    }
  },
  video: {
    icon: '#i-film',
    headingKey: 'videoConversion',
    pickKey: 'chooseVideos',
    emptyTitleKey: 'emptyVideoTitle',
    emptyHintKey: 'videoFormatList',
    dropKey: 'dropVideoTitle',
    filters: VIDEO_FILTERS,
    formats: VIDEO_FORMATS,
    defaultFormat: 'mp4',
    presets: {
      mp4Universal: { labelKey: 'presetMp4', metaKey: 'presetMp4Meta', formatFilter: 'auto', outputFormat: 'mp4', quality: 'balanced', smartCopy: true },
      webmWeb: { labelKey: 'presetWebm', metaKey: 'presetWebmMeta', formatFilter: 'auto', outputFormat: 'webm', quality: 'balanced', smartCopy: true },
      mkvRemux: { labelKey: 'presetMkv', metaKey: 'presetMkvMeta', formatFilter: 'auto', outputFormat: 'mkv', quality: 'high', smartCopy: true },
      gifClip: { labelKey: 'presetGif', metaKey: 'presetGifMeta', formatFilter: 'auto', outputFormat: 'gif', quality: 'balanced', smartCopy: false }
    }
  }
};

const app = {
  language: 'en',
  mode: 'image',
  accent: { family: 0, variant: 0 },
  pages: {},
  ffmpeg: null,
  dragActive: false
};

function safeStorage(fn, fallback) {
  try { return fn(); } catch { return fallback; }
}

function t(key, params = {}) {
  const template = translations[app.language][key] ?? translations.en[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_m, name) => String(params[name] ?? ''));
}

function labelOf(option) {
  return option.key ? t(option.key) : option.label;
}

function fileSize(bytes) {
  if (!Number.isFinite(bytes)) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function shortPath(value) {
  if (!value) return t('notSelected');
  return value.length > 58 ? `...${value.slice(-55)}` : value;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function svgIcon(href) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', href);
  svg.append(use);
  return svg;
}

function restartAnimation(node, className) {
  node.classList.remove(className);
  void node.offsetWidth;
  node.classList.add(className);
}

/* ---------- segmented control ---------- */

class Segmented {
  constructor(root, onChange) {
    this.root = root;
    this.thumb = root.querySelector('.seg-thumb');
    this.buttons = Array.from(root.querySelectorAll('.seg'));
    this.onChange = onChange;
    this.value = null;
    this.buttons.forEach((button) => {
      button.addEventListener('click', () => {
        if (button.disabled || button.dataset.value === this.value) return;
        this.set(button.dataset.value);
        this.onChange?.(this.value);
      });
    });
    new ResizeObserver(() => this.place(false)).observe(root);
  }

  set(value, animate = true) {
    this.value = String(value);
    this.buttons.forEach((b) => {
      b.classList.toggle('on', b.dataset.value === this.value);
      b.setAttribute('aria-selected', b.dataset.value === this.value);
    });
    this.place(animate);
  }

  place(animate = true) {
    const button = this.buttons.find((b) => b.dataset.value === this.value);
    if (!button || !button.offsetWidth) return;
    if (!animate) this.root.classList.add('no-anim');
    this.thumb.style.width = `${button.offsetWidth}px`;
    this.thumb.style.transform = `translateX(${button.offsetLeft}px)`;
    if (!animate) {
      void this.thumb.offsetWidth;
      this.root.classList.remove('no-anim');
    }
  }
}

/* ---------- popup button + menu ---------- */

let openMenu = null;

function closeMenu() {
  if (!openMenu) return;
  const { menu, popup } = openMenu;
  openMenu = null;
  popup.button.classList.remove('open');
  menu.classList.add('closing');
  setTimeout(() => menu.remove(), 160);
}

class Popup {
  constructor(root, options, onChange) {
    this.root = root;
    this.options = options;
    this.onChange = onChange;
    this.value = options.find((o) => !o.sep).value;
    this.button = el('button', 'popup-button');
    this.button.type = 'button';
    this.label = el('span', 'popup-label');
    const chev = el('span', 'chev');
    chev.append(svgIcon('#i-chevrons'));
    this.button.append(this.label, chev);
    root.append(this.button);
    this.button.addEventListener('click', (event) => {
      event.stopPropagation();
      if (openMenu?.popup === this) closeMenu();
      else this.open();
    });
    this.render();
  }

  set(value) {
    this.value = value;
    this.render();
  }

  set disabled(on) {
    this.button.disabled = on;
  }

  render() {
    const option = this.options.find((o) => o.value === this.value);
    this.label.textContent = option ? labelOf(option) : '';
  }

  open() {
    closeMenu();
    const menu = el('div', 'menu');
    const items = [];
    this.options.forEach((option) => {
      if (option.sep) {
        menu.append(el('div', 'menu-sep'));
        return;
      }
      const item = el('button', 'menu-item');
      item.type = 'button';
      item.classList.toggle('selected', option.value === this.value);
      const check = svgIcon('#i-check');
      check.classList.add('check');
      const text = el('span', 'mi-text');
      text.append(el('span', '', labelOf(option)));
      if (option.hintKey) text.append(el('small', '', t(option.hintKey)));
      item.append(check, text);
      item.addEventListener('mouseenter', () => highlight(items.indexOf(item)));
      item.addEventListener('click', (event) => {
        event.stopPropagation();
        this.pick(option.value);
      });
      items.push(item);
      menu.append(item);
    });
    const highlight = (index) => {
      items.forEach((item, i) => item.classList.toggle('hl', i === index));
      openMenu.hl = index;
      items[index]?.scrollIntoView({ block: 'nearest' });
    };
    document.getElementById('menuLayer').append(menu);
    const rect = this.button.getBoundingClientRect();
    const width = Math.max(rect.width, menu.offsetWidth);
    let top = rect.bottom + 4;
    if (top + menu.offsetHeight > window.innerHeight - 8) top = Math.max(8, rect.top - menu.offsetHeight - 4);
    menu.style.top = `${top}px`;
    menu.style.left = `${Math.min(rect.left, window.innerWidth - width - 8)}px`;
    menu.style.minWidth = `${width}px`;
    this.button.classList.add('open');
    openMenu = { menu, popup: this, items, hl: -1, highlight };
    const selected = items.findIndex((item) => item.classList.contains('selected'));
    items[selected]?.scrollIntoView({ block: 'nearest' });
  }

  pick(value) {
    closeMenu();
    if (value === this.value) return;
    this.set(value);
    this.onChange?.(value);
  }
}

document.addEventListener('click', () => closeMenu());
document.addEventListener('keydown', (event) => {
  if (!openMenu) return;
  const { items, hl, highlight, popup } = openMenu;
  if (event.key === 'Escape') closeMenu();
  else if (event.key === 'ArrowDown') highlight(Math.min(items.length - 1, hl + 1));
  else if (event.key === 'ArrowUp') highlight(Math.max(0, hl - 1));
  else if (event.key === 'Enter' && hl >= 0) {
    const values = popup.options.filter((o) => !o.sep);
    popup.pick(values[hl].value);
  } else return;
  event.preventDefault();
});
window.addEventListener('resize', closeMenu);

/* ---------- workspace (one per media kind) ---------- */

class Workspace {
  constructor(kind) {
    this.kind = kind;
    this.config = PAGES[kind];
    this.root = document.getElementById('pageTemplate').content.firstElementChild.cloneNode(true);
    this.root.dataset.kind = kind;
    document.getElementById('pages').append(this.root);
    this.n = {};
    this.root.querySelectorAll('[data-role]').forEach((node) => { this.n[node.dataset.role] = node; });

    this.state = {
      mode: null,
      folderPath: null,
      outputDir: null,
      files: [],
      running: false,
      done: 0,
      failed: 0,
      status: { key: 'ready', params: {} },
      activePreset: null,
      lastResult: null
    };
    this.rows = new Map();

    const isVideo = kind === 'video';
    this.n.qualityRow.hidden = !isVideo;
    this.n.smartCopyRow.hidden = !isVideo;
    this.n.losslessRow.hidden = isVideo;
    this.n.emptyIcon.querySelector('use').setAttribute('href', this.config.icon);

    this.filter = new Popup(this.n.formatFilter, this.config.filters, () => {
      this.clearPreset();
      if (this.state.mode === 'folder') this.loadFolder();
    });
    this.format = new Popup(this.n.outputFormat, this.config.formats, () => {
      this.clearPreset();
      this.paint();
    });
    this.format.set(this.config.defaultFormat);
    this.quality = new Segmented(this.n.quality, () => this.clearPreset());
    this.quality.set('balanced', false);

    this.buildPresets();
    this.bind();
  }

  buildPresets() {
    this.presetButtons = Object.entries(this.config.presets).map(([key, preset], index) => {
      const button = el('button', 'preset');
      button.type = 'button';
      button.dataset.preset = key;
      button.style.animationDelay = `${index * 45}ms`;
      button.append(el('span'), el('small'));
      button.addEventListener('click', () => this.applyPreset(key));
      this.n.presets.append(button);
      return button;
    });
  }

  bind() {
    const n = this.n;
    n.pickFiles.addEventListener('click', async () => {
      const files = await invoke('pick_files', { kind: this.kind });
      if (files.length) this.setFiles(files, 'files');
    });
    n.pickFolder.addEventListener('click', async () => {
      const folder = await invoke('pick_folder');
      if (folder) await this.loadFolder(folder);
    });
    n.pickOutput.addEventListener('click', async () => {
      const folder = await invoke('pick_folder');
      if (!folder) return;
      this.state.outputDir = folder;
      this.setStatus('outputSet', { path: shortPath(folder) });
      this.paint();
    });
    n.rescan.addEventListener('click', () => this.loadFolder());
    n.clear.addEventListener('click', () => {
      Object.assign(this.state, { files: [], mode: null, folderPath: null });
      this.resetRun();
      this.renderFiles();
      this.setStatus('queueCleared');
    });
    n.recursive.addEventListener('change', () => {
      this.clearPreset();
      if (this.state.mode === 'folder') this.loadFolder();
    });
    [n.lossless, n.overwrite, n.smartCopy].forEach((node) => node.addEventListener('change', () => this.clearPreset()));
    n.openOutput.addEventListener('click', async () => {
      const result = await invoke('open_path', { path: this.state.outputDir });
      if (!result.ok) this.setStatusText(result.error || t('openOutputFailed'));
    });
    n.convert.addEventListener('click', () => this.convert());
    n.cancel.addEventListener('click', async () => {
      await invoke('cancel_conversion', { kind: this.kind });
      this.setStatus('cancelling');
    });
    n.ffmpegRecheck.addEventListener('click', () => refreshFfmpeg(true));
  }

  /* --- language & paint --- */

  applyLanguage() {
    const c = this.config;
    this.n.heading.textContent = t(c.headingKey);
    this.n.pickFilesLabel.textContent = t(c.pickKey);
    this.n.emptyTitle.textContent = t(c.emptyTitleKey);
    this.n.emptyHint.textContent = t(c.emptyHintKey);
    this.n.dropTitle.textContent = t(c.dropKey);
    this.presetButtons.forEach((button) => {
      const preset = c.presets[button.dataset.preset];
      button.querySelector('span').textContent = t(preset.labelKey);
      button.querySelector('small').textContent = t(preset.metaKey);
    });
    this.filter.render();
    this.format.render();
    this.quality.place(false);
    this.rows.forEach((row, path) => this.updateRow(this.state.files.find((f) => f.path === path), row));
    this.paint();
    this.repaintStatus();
  }

  paint() {
    const s = this.state;
    const n = this.n;
    const count = s.files.length;
    n.sourceBadge.textContent = count ? `${count}` : t('emptyBadge');
    n.sourceBadge.classList.toggle('filled', count > 0);
    this.setMetric(n.totalCount, count);
    this.setMetric(n.doneCount, s.done);
    this.setMetric(n.failCount, s.failed);
    n.outputDir.textContent = s.outputDir || t('notSelected');
    n.outputDir.classList.toggle('empty', !s.outputDir);
    n.outputDir.title = s.outputDir || '';
    n.sourcePath.textContent = this.sourceLabel();
    n.emptyState.hidden = count > 0;
    const blocked = this.kind === 'video' && app.ffmpeg && !app.ffmpeg.found;
    n.convert.disabled = s.running || !count || !s.outputDir || blocked;
    n.cancel.disabled = !s.running;
    n.clear.disabled = s.running || !count;
    n.rescan.disabled = s.running || s.mode !== 'folder' || !s.folderPath;
    [n.pickFiles, n.pickFolder, n.pickOutput].forEach((b) => { b.disabled = s.running; });
    n.lossless.disabled = this.format.value === 'bmp' || this.format.value === 'gif' || this.format.value === 'tiff' || this.format.value === 'png';
    this.presetButtons.forEach((b) => b.classList.toggle('active', b.dataset.preset === s.activePreset));
    this.renderResults();
  }

  setMetric(node, value) {
    const text = String(value);
    node.classList.toggle('zero', value === 0 && node !== this.n.totalCount);
    if (node.textContent === text) return;
    node.textContent = text;
    restartAnimation(node, 'bump');
  }

  sourceLabel() {
    const s = this.state;
    if (s.mode === 'files') return t('selectedFiles', { count: s.files.length });
    if (s.mode === 'drop') return t('droppedItems', { count: s.files.length });
    if (s.folderPath) return shortPath(s.folderPath);
    return t('waitingForSource');
  }

  setStatus(key, params = {}) {
    this.state.status = { key, params };
    this.n.statusText.textContent = t(key, params);
  }

  setStatusText(text) {
    this.state.status = { text };
    this.n.statusText.textContent = text;
  }

  repaintStatus() {
    const { status } = this.state;
    this.n.statusText.textContent = status.text ?? t(status.key, status.params);
  }

  setProgress(fraction) {
    this.n.progressBar.style.transform = `scaleX(${Math.max(0, Math.min(1, fraction))})`;
  }

  /* --- queue --- */

  renderFiles() {
    const list = this.n.fileList;
    list.textContent = '';
    this.rows.clear();
    const fragment = document.createDocumentFragment();
    this.state.files.forEach((file, index) => {
      const row = el('div', 'file-row');
      if (index < 12) {
        row.classList.add('appear');
        row.style.animationDelay = `${Math.min(index, 8) * 28}ms`;
      }
      const ext = (file.name.split('.').pop() || '').slice(0, 4).toUpperCase();
      const text = el('div', 'file-text');
      text.append(
        el('div', 'file-name', file.name),
        el('div', 'file-meta', [fileSize(file.size), file.relativePath || file.path].filter(Boolean).join(' · '))
      );
      const status = el('div', 'row-status');
      status.append(el('span', 'status-pill'));
      if (this.kind === 'video') {
        const bar = el('div', 'row-progress');
        bar.append(el('div'));
        bar.hidden = true;
        status.append(bar);
      }
      row.append(el('div', 'file-ext', ext), text, status);
      this.rows.set(file.path, row);
      this.updateRow(file, row);
      fragment.append(row);
    });
    list.append(fragment);
    list.scrollTop = 0;
    this.paint();
  }

  statusLabel(file) {
    if (file.status === 'done') return t('done');
    if (file.status === 'error') return t('failed');
    if (file.status === 'running') {
      return file.percent != null ? `${Math.floor(file.percent * 100)}%` : t('processing');
    }
    return t('waiting');
  }

  updateRow(file, row = this.rows.get(file?.path)) {
    if (!file || !row) return;
    const previous = row.dataset.status || '';
    const status = file.status || '';
    row.className = row.className.replace(/\b(running|done|error)\b/g, '').trim();
    if (status) row.classList.add(status);
    row.dataset.status = status;
    const pill = row.querySelector('.status-pill');
    pill.textContent = this.statusLabel(file);
    pill.title = file.message || '';
    if (previous !== status && status) restartAnimation(pill, 'swap');
    const bar = row.querySelector('.row-progress');
    if (bar) {
      bar.hidden = status !== 'running';
      bar.firstElementChild.style.transform = `scaleX(${file.percent || 0})`;
    }
  }

  renderResults() {
    const result = this.state.lastResult;
    const n = this.n;
    if (!result || !result.ok) {
      n.resultPanel.hidden = true;
      return;
    }
    const wasHidden = n.resultPanel.hidden;
    n.resultPanel.hidden = false;
    if (wasHidden) {
      restartAnimation(n.resultPanel, 'result');
      restartAnimation(n.resultIcon, 'result-icon');
    }
    const failed = (result.results || []).filter((item) => !item.ok);
    n.resultIcon.classList.toggle('warn', failed.length > 0 || result.cancelled);
    n.resultIcon.querySelector('use').setAttribute('href', failed.length || result.cancelled ? '#i-warn' : '#i-check');
    n.resultSummary.textContent = t('resultSummary', { succeeded: result.succeeded, failed: result.failed });
    n.resultOutput.textContent = t('resultOutput', { path: shortPath(this.state.outputDir) });
    n.resultFailures.classList.toggle('has', failed.length > 0);
    n.resultFailures.textContent = failed.length
      ? t('failureSummary', { count: failed.length, files: failed.slice(0, 3).map((item) => item.file).join(', ') })
      : t('noFailures');
  }

  resetRun({ keepResult = false } = {}) {
    this.state.done = 0;
    this.state.failed = 0;
    if (!keepResult) this.state.lastResult = null;
    this.setProgress(0);
    this.state.files = this.state.files.map((file) => ({ ...file, status: null, message: null, percent: null }));
  }

  setFiles(files, mode, folderPath = null) {
    Object.assign(this.state, {
      mode,
      folderPath,
      files: files.map(({ path, name, relativePath, size }) => ({ path, name, relativePath, size }))
    });
    this.resetRun();
    this.renderFiles();
    this.setStatus(this.state.files.length ? 'addedFiles' : 'noMatchingFiles', { count: this.state.files.length });
  }

  async loadFolder(folderPath = this.state.folderPath) {
    if (!folderPath) return;
    this.state.mode = 'folder';
    this.state.folderPath = folderPath;
    this.setStatus('scanning');
    this.paint();
    try {
      const files = await invoke('scan_folder', {
        kind: this.kind,
        folder: folderPath,
        filter: this.filter.value,
        recursive: this.n.recursive.checked
      });
      this.setFiles(files, 'folder', folderPath);
    } catch (err) {
      this.setStatusText(String(err) || t('scanFailed'));
    }
  }

  async dropPaths(paths) {
    if (this.state.running || !paths.length) return;
    this.setStatus('resolvingDrop');
    this.paint();
    try {
      const files = await invoke('resolve_paths', {
        kind: this.kind,
        paths,
        filter: this.filter.value,
        recursive: this.n.recursive.checked
      });
      this.setFiles(files, 'drop');
    } catch (err) {
      this.setStatusText(String(err) || t('scanFailed'));
    }
  }

  setDragState(active) {
    this.n.queue.classList.toggle('drag-over', active && !this.state.running);
  }

  /* --- presets --- */

  async applyPreset(key) {
    const preset = this.config.presets[key];
    if (!preset || this.state.running) return;
    this.state.activePreset = key;
    this.filter.set(preset.formatFilter);
    this.format.set(preset.outputFormat);
    if ('lossless' in preset) this.n.lossless.checked = preset.lossless;
    if ('recursive' in preset) this.n.recursive.checked = preset.recursive;
    if ('quality' in preset) this.quality.set(preset.quality);
    if ('smartCopy' in preset) this.n.smartCopy.checked = preset.smartCopy;
    this.setStatus('presetApplied', { name: t(preset.labelKey) });
    this.paint();
    if (this.state.mode === 'folder' && this.state.folderPath) await this.loadFolder();
  }

  clearPreset() {
    this.state.activePreset = null;
    this.paint();
  }

  /* --- conversion --- */

  async convert() {
    const s = this.state;
    if (!s.files.length || !s.outputDir || s.running) return;
    s.running = true;
    this.resetRun();
    this.renderFiles();
    this.setStatus('converting');
    this.paint();
    const files = s.files.map(({ path, name, relativePath, size }) => ({ path, name, relativePath, size }));
    const base = { files, outputFormat: this.format.value, outputDir: s.outputDir, overwrite: this.n.overwrite.checked };
    let result;
    try {
      result = this.kind === 'video'
        ? await invoke('start_video', { job: { ...base, quality: this.quality.value, smartCopy: this.n.smartCopy.checked } })
        : await invoke('start_image', { job: { ...base, lossless: this.n.lossless.checked } });
    } catch (err) {
      result = { ok: false, error: String(err) };
    }
    s.running = false;
    if (result.ok) {
      s.lastResult = result;
      s.done = result.succeeded;
      s.failed = result.failed;
      this.setProgress((s.done + s.failed) / (s.files.length || 1));
      s.files.forEach((file) => {
        if (file.status === 'running') {
          file.status = null;
          file.percent = null;
          this.updateRow(file);
        }
      });
      this.setStatus(result.cancelled ? 'cancelled' : 'completed', { succeeded: result.succeeded, failed: result.failed });
    } else {
      this.setStatusText(result.error || t('conversionFailed'));
    }
    this.paint();
  }

  onProgress(info) {
    const s = this.state;
    const file = s.files.find((item) => item.path === info.path) || s.files.find((item) => item.name === info.file);
    if (!file) return;
    if (info.status === 'running') {
      file.status = 'running';
      file.percent = info.percent ?? null;
      this.updateRow(file);
      const finished = s.done + s.failed;
      this.setProgress((finished + (info.percent || 0)) / (s.files.length || 1));
      this.setStatusText(`${info.file}: ${this.statusLabel(file)}`);
      return;
    }
    file.status = info.status;
    file.message = info.message;
    file.percent = null;
    s.done += info.status === 'done' ? 1 : 0;
    s.failed += info.status === 'error' ? 1 : 0;
    this.setProgress((s.done + s.failed) / (s.files.length || 1));
    this.updateRow(file);
    this.paint();
    this.setStatusText(info.message ? `${info.file}: ${info.message}` : `${info.file}: ${this.statusLabel(file)}`);
  }

  /* --- demo data for preview captures --- */

  loadDemo() {
    const sample = this.kind === 'video'
      ? ['Keynote Highlights.mov', 'Drone over Lake.mp4', 'Interview Raw.mkv', 'Product Teaser.webm', 'Screen Recording 2026-10-20.mp4', 'Old Camcorder Tape.avi']
      : ['IMG_4120.HEIC', 'IMG_4121.HEIC', 'Mountains at dusk.png', 'Portrait Studio.jpg', 'Banner hero.webp', 'Scan 0042.tiff', 'Logo outline.bmp'];
    const base = this.kind === 'video' ? 'D:\\Videos\\Projects' : 'D:\\Pictures\\Trip 2026';
    this.applyPreset(this.kind === 'video' ? 'mp4Universal' : 'webpArchive');
    this.setFiles(sample.map((name, i) => ({
      name,
      path: `${base}\\${name}`,
      relativePath: i > 3 ? `Archive\\${name}` : name,
      size: (this.kind === 'video' ? 48_000_000 : 2_400_000) * (1 + (i * 37) % 9)
    })), 'folder', base);
    this.state.outputDir = this.kind === 'video' ? 'D:\\Videos\\Converted' : 'D:\\Pictures\\Converted';
    this.state.files.forEach((file, i) => {
      if (i < 2) file.status = 'done';
      else if (i === 2) Object.assign(file, { status: 'running', percent: 0.42 });
      this.updateRow(file);
    });
    this.state.done = 2;
    this.setProgress((2 + 0.42) / this.state.files.length);
    this.setStatusText(`${this.state.files[2].name}: ${this.statusLabel(this.state.files[2])}`);
    this.paint();
  }
}

/* ---------- app-level: mode, language, accent, window ---------- */

function initialLanguage(forced) {
  if (forced === 'zh' || forced === 'zh-CN') return 'zh';
  if (forced === 'en') return 'en';
  const query = new URLSearchParams(window.location.search).get('lang');
  if (query) return query.startsWith('zh') ? 'zh' : 'en';
  const saved = safeStorage(() => localStorage.getItem(languageKey), null);
  if (saved) return saved === 'zh' ? 'zh' : 'en';
  return (navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

function applyLanguage() {
  document.documentElement.lang = app.language === 'zh' ? 'zh-CN' : 'en';
  document.querySelectorAll('[data-i18n]').forEach((node) => {
    if (!node.closest('template')) node.textContent = t(node.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-title]').forEach((node) => { node.title = t(node.dataset.i18nTitle); });
  document.getElementById('languageLabel').textContent = t('languageButton');
  Object.values(app.pages).forEach((page) => page.applyLanguage());
  modeSwitch.place(false);
  variantSwitch.place(false);
  renderAccentName();
  renderFfmpeg();
}

function switchMode(mode, animate = true) {
  const next = app.pages[mode];
  const prev = app.pages[app.mode];
  app.mode = mode;
  safeStorage(() => localStorage.setItem(modeKey, mode));
  modeSwitch.set(mode, animate);
  closeMenu();
  if (prev === next) {
    next.root.classList.add('active');
    return;
  }
  if (prev) {
    prev.root.classList.remove('active', 'entering');
    if (animate) {
      prev.root.classList.add('leaving');
      setTimeout(() => prev.root.classList.remove('leaving'), 200);
    }
  }
  next.root.classList.remove('leaving');
  next.root.classList.add('active');
  if (animate) {
    restartAnimation(next.root, 'entering');
    setTimeout(() => next.root.classList.remove('entering'), 520);
  }
}

function relativeLuminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function applyAccent() {
  const { family, variant } = app.accent;
  const hex = SYSTEM_COLORS[family][2][variant];
  const root = document.documentElement.style;
  root.setProperty('--accent', hex);
  // White text needs at least 2:1 contrast on the accent (yellow / mint fail this).
  const contrastWithWhite = 1.05 / (relativeLuminance(hex) + 0.05);
  root.setProperty('--on-accent', contrastWithWhite < 2 ? '#1D1D1F' : '#FFFFFF');
  document.querySelectorAll('.swatch').forEach((s, i) => s.classList.toggle('on', i === family));
  safeStorage(() => localStorage.setItem(accentKey, JSON.stringify(app.accent)));
  renderAccentName();
}

function renderAccentName() {
  const { family, variant } = app.accent;
  const [en, zh, hexes] = SYSTEM_COLORS[family];
  document.getElementById('accentName').textContent = `${app.language === 'zh' ? zh : en} · ${t(VARIANT_KEYS[variant])} ${hexes[variant]}`;
}

function buildSwatches() {
  const host = document.getElementById('swatches');
  SYSTEM_COLORS.forEach(([en, zh, hexes], index) => {
    const swatch = el('button', 'swatch');
    swatch.type = 'button';
    swatch.title = `${en} / ${zh}`;
    swatch.style.setProperty('--c', hexes[0]);
    swatch.addEventListener('click', () => {
      app.accent.family = index;
      applyAccent();
    });
    host.append(swatch);
  });
}

const popover = document.getElementById('appearancePopover');
const appearanceBtn = document.getElementById('appearanceBtn');

function togglePopover(force) {
  const open = force ?? popover.hidden;
  if (open) {
    popover.classList.remove('closing');
    popover.hidden = false;
    appearanceBtn.classList.add('open');
    variantSwitch.place(false);
  } else if (!popover.hidden) {
    appearanceBtn.classList.remove('open');
    popover.classList.add('closing');
    setTimeout(() => { if (popover.classList.contains('closing')) popover.hidden = true; }, 160);
  }
}

appearanceBtn.addEventListener('click', (event) => {
  event.stopPropagation();
  togglePopover();
});
popover.addEventListener('click', (event) => event.stopPropagation());
document.addEventListener('click', () => togglePopover(false));
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') togglePopover(false); });

async function refreshFfmpeg(refresh = false) {
  app.ffmpeg = await invoke('ffmpeg_status', { refresh });
  renderFfmpeg();
  app.pages.video?.paint();
}

function renderFfmpeg() {
  const page = app.pages.video;
  if (!page || !app.ffmpeg) return;
  page.n.ffmpegCard.hidden = app.ffmpeg.found;
  page.n.ffmpegVersion.textContent = app.ffmpeg.found ? t('ffmpegFound', { version: app.ffmpeg.version }) : '';
  page.n.ffmpegVersion.title = app.ffmpeg.path || '';
}

const modeSwitch = new Segmented(document.getElementById('modeSwitch'), (mode) => switchMode(mode));
const variantSwitch = new Segmented(document.getElementById('variantSwitch'), (value) => {
  app.accent.variant = Number(value);
  applyAccent();
});

document.getElementById('languageBtn').addEventListener('click', () => {
  app.language = app.language === 'en' ? 'zh' : 'en';
  safeStorage(() => localStorage.setItem(languageKey, app.language));
  applyLanguage();
});

document.getElementById('winClose').addEventListener('click', () => appWindow.close());
document.getElementById('winMin').addEventListener('click', () => appWindow.minimize());
document.getElementById('winMax').addEventListener('click', () => appWindow.toggleMaximize());
window.addEventListener('blur', () => document.body.classList.add('blurred'));
window.addEventListener('focus', () => document.body.classList.remove('blurred'));
document.addEventListener('contextmenu', (event) => {
  if (!event.target.closest('input, textarea, [contenteditable]')) event.preventDefault();
});

tauri.event.listen('convert:progress', ({ payload }) => app.pages[payload.kind]?.onProgress(payload));

tauri.webview.getCurrentWebview().onDragDropEvent(({ payload }) => {
  const page = app.pages[app.mode];
  if (payload.type === 'enter' || payload.type === 'over') {
    page.setDragState(true);
  } else if (payload.type === 'leave') {
    page.setDragState(false);
  } else if (payload.type === 'drop') {
    page.setDragState(false);
    page.dropPaths(payload.paths || []);
  }
});

async function boot() {
  const options = await invoke('launch_options').catch(() => ({}));
  app.language = initialLanguage(options.lang);
  const savedAccent = safeStorage(() => JSON.parse(localStorage.getItem(accentKey)), null);
  if (savedAccent && SYSTEM_COLORS[savedAccent.family] && savedAccent.variant >= 0 && savedAccent.variant < 4) {
    app.accent = savedAccent;
  }
  app.pages.image = new Workspace('image');
  app.pages.video = new Workspace('video');
  buildSwatches();
  applyAccent();
  applyLanguage();
  const savedMode = options.mode || (options.demo ? null : safeStorage(() => localStorage.getItem(modeKey), null));
  switchMode(savedMode === 'video' ? 'video' : 'image', false);
  variantSwitch.set(app.accent.variant, false);
  refreshFfmpeg();
  if (options.demo) Object.values(app.pages).forEach((page) => page.loadDemo());

  await document.fonts.ready;
  await appWindow.show();
  requestAnimationFrame(() => {
    document.getElementById('window').classList.add('ready');
    modeSwitch.place(false);
    Object.values(app.pages).forEach((page) => page.quality.place(false));
  });
  if (options.selftest) setTimeout(() => runSelftest(options.selftest), 1200);
  else if (options.probe) setTimeout(runProbe, 1200);
}

/* `--selftest <dir> --probe <report>`: clicks through the real UI and converts <dir>\images and <dir>\videos. */
async function runSelftest(dir) {
  const lines = [];
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));
  const until = async (cond, ms = 120000) => {
    const end = Date.now() + ms;
    while (!cond() && Date.now() < end) await pause(100);
    return cond();
  };
  const pickMenu = async (popup, value) => {
    popup.button.click();
    await pause(450);
    const index = popup.options.filter((o) => !o.sep).findIndex((o) => o.value === value);
    document.querySelectorAll('.menu .menu-item')[index].click();
    await pause(200);
  };
  try {
    const langBtn = document.getElementById('languageBtn');
    const before = document.documentElement.lang;
    langBtn.click();
    lines.push(`language ${before} -> ${document.documentElement.lang}, heading "${app.pages.image.n.heading.textContent}"`);
    langBtn.click();

    appearanceBtn.click();
    await pause(300);
    document.querySelectorAll('.swatch')[6].click();
    const yellow = getComputedStyle(document.documentElement);
    lines.push(`accent yellow ${yellow.getPropertyValue('--accent')} on-accent ${yellow.getPropertyValue('--on-accent')}`);
    document.querySelector('#variantSwitch .seg[data-value="2"]').click();
    lines.push(`accent deep ${getComputedStyle(document.documentElement).getPropertyValue('--accent')} label "${document.getElementById('accentName').textContent}"`);
    document.querySelectorAll('.swatch')[0].click();
    document.querySelector('#variantSwitch .seg[data-value="0"]').click();
    document.body.click();
    await pause(300);
    lines.push(`popover hidden after outside click: ${popover.hidden}`);

    for (const [kind, format, extra] of [['image', 'webp', null], ['video', 'webm', 'small']]) {
      const page = app.pages[kind];
      document.querySelector(`#modeSwitch .seg[data-value="${kind}"]`).click();
      await pause(600);
      await pickMenu(page.format, format);
      if (extra) page.n.quality.querySelector(`.seg[data-value="${extra}"]`).click();
      page.n.overwrite.click();
      await page.dropPaths([`${dir}\\${kind === 'image' ? 'images' : 'videos'}`]);
      page.state.outputDir = `${dir}\\out-${kind}`;
      page.paint();
      let running = 0;
      const original = page.onProgress.bind(page);
      page.onProgress = (info) => { if (info.status === 'running') running += 1; original(info); };
      lines.push(`${kind}: queued ${page.state.files.length}, format ${page.format.value}, convert enabled ${!page.n.convert.disabled}`);
      page.n.convert.click();
      await until(() => page.state.lastResult || (!page.state.running && page.n.statusText.textContent !== t('converting')));
      const r = page.state.lastResult || {};
      lines.push(`${kind}: ok ${r.ok} succeeded ${r.succeeded} failed ${r.failed}; running events ${running}; result "${page.n.resultSummary.textContent}"; status "${page.n.statusText.textContent}"`);
      (r.results || []).filter((x) => !x.ok).forEach((x) => lines.push(`  failed ${x.file}: ${x.error}`));
      lines.push(`  rows: ${[...page.rows.values()].map((row) => row.querySelector('.status-pill').textContent).join(', ')}`);
    }
  } catch (err) {
    lines.push(`ERROR ${err && err.stack || err}`);
  }
  await invoke('probe_report', { text: lines.join('\n') + '\n' });
}

/* Frame-gap probe for page and popup transitions (target: avg >= 100 fps, worst frame <= 35 ms). */
function measure(name, go) {
  return new Promise((resolve) => {
    const gaps = [];
    let last = 0;
    const stop = performance.now() + 650;
    const tick = (now) => {
      if (last) gaps.push(now - last);
      last = now;
      if (now < stop) return requestAnimationFrame(tick);
      const total = gaps.reduce((a, b) => a + b, 0);
      resolve(`${name.padEnd(22)} frames ${String(gaps.length).padStart(3)}  avg ${(1000 * gaps.length / total).toFixed(0).padStart(4)} fps  worst ${Math.max(...gaps).toFixed(1).padStart(5)} ms`);
    };
    requestAnimationFrame(tick);
    go();
  });
}

async function runProbe() {
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));
  const lines = [];
  for (let round = 1; round <= 2; round += 1) {
    lines.push(await measure(`r${round} image -> video`, () => switchMode('video')));
    await pause(300);
    lines.push(await measure(`r${round} video -> image`, () => switchMode('image')));
    await pause(300);
    lines.push(await measure(`r${round} open menu`, () => app.pages.image.format.open()));
    closeMenu();
    await pause(300);
    lines.push(await measure(`r${round} appearance`, () => togglePopover(true)));
    togglePopover(false);
    await pause(300);
  }
  await invoke('probe_report', { text: lines.join('\n') + '\n' });
}

boot();
