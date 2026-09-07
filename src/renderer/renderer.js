'use strict';

const api = window.transments;
const languageKey = 'transments.language';

const translations = {
  en: {
    brandSubtitle: 'Image Converter',
    sourceTitle: 'Source',
    emptyBadge: 'Empty',
    chooseImages: 'Choose Images',
    chooseFolder: 'Choose Folder',
    scanFilter: 'Scan Filter',
    allImages: 'All Images',
    includeSubfolders: 'Include Subfolders',
    outputTitle: 'Output',
    presetTitle: 'Presets',
    presetWebp: 'WebP Archive',
    presetWebpMeta: 'Lossless, recursive',
    presetJpeg: 'JPEG Share',
    presetJpegMeta: 'Compact, high quality',
    presetHeic: 'HEIC to PNG',
    presetHeicMeta: 'Filter HEIC/HEIF',
    presetAvif: 'AVIF Batch',
    presetAvifMeta: 'Lossless folder mode',
    formatLabel: 'Format',
    webpLossless: 'WebP Lossless',
    avifLossless: 'AVIF Lossless',
    jpeg100: 'JPEG 100',
    preferLossless: 'Prefer Lossless Encoding',
    overwriteExisting: 'Overwrite Existing Files',
    chooseOutputFolder: 'Choose Output Folder',
    batchConversion: 'Batch Conversion',
    waitingForSource: 'Waiting for source',
    switchLanguage: 'Switch Language',
    languageButton: '中文',
    rescan: 'Rescan',
    clearQueue: 'Clear Queue',
    queued: 'Queued',
    doneMetric: 'Done',
    failedMetric: 'Failed',
    emptyTitle: 'Choose images or a folder',
    formatList: 'PNG, JPEG, WebP, TIFF, AVIF, GIF, BMP, HEIC, or drag them here',
    dropTitle: 'Drop images or folders',
    dropHint: 'The current scan filter and subfolder option will be used.',
    resultTitle: 'Conversion Results',
    openOutputFolder: 'Open Output Folder',
    resultSummary: '{succeeded} done, {failed} failed',
    resultOutput: 'Output: {path}',
    noFailures: 'No failed files',
    failureSummary: '{count} failed: {files}',
    ready: 'Ready',
    cancel: 'Cancel',
    startConversion: 'Start Conversion',
    notSelected: 'Not selected',
    waiting: 'Waiting',
    done: 'Done',
    failed: 'Failed',
    processing: 'Processing',
    scanning: 'Scanning...',
    resolvingDrop: 'Reading dropped items...',
    droppedItems: '{count} dropped files',
    addedFiles: 'Added {count} files',
    noMatchingFiles: 'No matching files',
    scanFailed: 'Scan failed',
    selectedFiles: '{count} selected files',
    outputSet: 'Output set to {path}',
    queueCleared: 'Queue cleared',
    presetApplied: 'Applied preset: {name}',
    converting: 'Converting...',
    cancelled: 'Cancelled',
    completed: 'Completed {succeeded}, failed {failed}',
    conversionFailed: 'Conversion failed',
    openOutputFailed: 'Could not open output folder',
    cancelling: 'Cancelling...'
  },
  zh: {
    brandSubtitle: '图片格式转换器',
    sourceTitle: '来源',
    emptyBadge: '空',
    chooseImages: '选择图片',
    chooseFolder: '选择文件夹',
    scanFilter: '扫描筛选',
    allImages: '全部图片',
    includeSubfolders: '包含子文件夹',
    outputTitle: '输出',
    presetTitle: '转换预设',
    presetWebp: 'WebP 归档',
    presetWebpMeta: '无损，递归',
    presetJpeg: 'JPEG 分享',
    presetJpegMeta: '轻量，高质量',
    presetHeic: 'HEIC 转 PNG',
    presetHeicMeta: '筛选 HEIC/HEIF',
    presetAvif: 'AVIF 批量',
    presetAvifMeta: '无损文件夹模式',
    formatLabel: '格式',
    webpLossless: 'WebP 无损',
    avifLossless: 'AVIF 无损',
    jpeg100: 'JPEG 100',
    preferLossless: '优先无损编码',
    overwriteExisting: '覆盖同名文件',
    chooseOutputFolder: '选择输出文件夹',
    batchConversion: '批量转换',
    waitingForSource: '等待选择来源',
    switchLanguage: '切换语言',
    languageButton: 'English',
    rescan: '重新扫描',
    clearQueue: '清空队列',
    queued: '队列',
    doneMetric: '完成',
    failedMetric: '失败',
    emptyTitle: '选择图片或文件夹',
    formatList: 'PNG、JPEG、WebP、TIFF、AVIF、GIF、BMP、HEIC，也可以拖到这里',
    dropTitle: '拖入图片或文件夹',
    dropHint: '会使用当前扫描筛选和子文件夹选项。',
    resultTitle: '转换结果',
    openOutputFolder: '打开输出文件夹',
    resultSummary: '完成 {succeeded} 个，失败 {failed} 个',
    resultOutput: '输出：{path}',
    noFailures: '没有失败文件',
    failureSummary: '{count} 个失败：{files}',
    ready: '准备就绪',
    cancel: '取消',
    startConversion: '开始转换',
    notSelected: '未选择',
    waiting: '等待',
    done: '完成',
    failed: '失败',
    processing: '处理中',
    scanning: '正在扫描...',
    resolvingDrop: '正在读取拖入项目...',
    droppedItems: '{count} 个拖入文件',
    addedFiles: '已加入 {count} 个文件',
    noMatchingFiles: '没有匹配文件',
    scanFailed: '扫描失败',
    selectedFiles: '{count} 个独立文件',
    outputSet: '输出到 {path}',
    queueCleared: '队列已清空',
    presetApplied: '已应用预设：{name}',
    converting: '转换中...',
    cancelled: '已取消',
    completed: '完成 {succeeded} 个，失败 {failed} 个',
    conversionFailed: '转换失败',
    openOutputFailed: '无法打开输出文件夹',
    cancelling: '正在取消...'
  }
};

const presets = {
  webpArchive: {
    labelKey: 'presetWebp',
    formatFilter: 'auto',
    outputFormat: 'webp',
    lossless: true,
    recursive: true
  },
  jpegShare: {
    labelKey: 'presetJpeg',
    formatFilter: 'auto',
    outputFormat: 'jpeg',
    lossless: false,
    recursive: false
  },
  heicToPng: {
    labelKey: 'presetHeic',
    formatFilter: '.heic',
    outputFormat: 'png',
    lossless: true,
    recursive: false
  },
  folderAvif: {
    labelKey: 'presetAvif',
    formatFilter: 'auto',
    outputFormat: 'avif',
    lossless: true,
    recursive: true
  }
};

const state = {
  mode: null,
  folderPath: null,
  outputDir: null,
  files: [],
  running: false,
  done: 0,
  failed: 0,
  language: initialLanguage(),
  status: { key: 'ready', params: {} },
  activePreset: null,
  lastResult: null,
  dragDepth: 0
};

const $ = (id) => document.getElementById(id);

const nodes = {
  pickImagesBtn: $('pickImagesBtn'),
  pickFolderBtn: $('pickFolderBtn'),
  pickOutputBtn: $('pickOutputBtn'),
  languageBtn: $('languageBtn'),
  languageLabel: $('languageLabel'),
  rescanBtn: $('rescanBtn'),
  clearBtn: $('clearBtn'),
  convertBtn: $('convertBtn'),
  cancelBtn: $('cancelBtn'),
  formatFilter: $('formatFilter'),
  recursiveScan: $('recursiveScan'),
  outputFormat: $('outputFormat'),
  lossless: $('lossless'),
  overwrite: $('overwrite'),
  outputDir: $('outputDir'),
  folderPath: $('folderPath'),
  sourceBadge: $('sourceBadge'),
  totalCount: $('totalCount'),
  doneCount: $('doneCount'),
  failCount: $('failCount'),
  progressBar: $('progressBar'),
  statusText: $('statusText'),
  fileList: $('fileList'),
  emptyState: $('emptyState'),
  queueArea: document.querySelector('.queue-area'),
  resultPanel: $('resultPanel'),
  resultSummary: $('resultSummary'),
  resultOutput: $('resultOutput'),
  resultFailures: $('resultFailures'),
  openOutputBtn: $('openOutputBtn'),
  presetButtons: Array.from(document.querySelectorAll('[data-preset]'))
};

function initialLanguage() {
  const forced = new URLSearchParams(window.location.search).get('lang');
  if (forced === 'zh' || forced === 'zh-CN') return 'zh';
  if (forced === 'en') return 'en';
  return localStorage.getItem(languageKey) === 'zh' ? 'zh' : 'en';
}

function t(key, params = {}) {
  const template = translations[state.language][key] || translations.en[key] || key;
  return template.replace(/\{(\w+)\}/g, (_match, name) => String(params[name] ?? ''));
}

function setStatus(key, params = {}) {
  state.status = { key, params };
  nodes.statusText.textContent = t(key, params);
}

function setStatusText(text) {
  state.status = { text };
  nodes.statusText.textContent = text;
}

function repaintStatus() {
  if (state.status.text) {
    nodes.statusText.textContent = state.status.text;
    return;
  }
  nodes.statusText.textContent = t(state.status.key, state.status.params);
}

function shortPath(value) {
  if (!value) return t('notSelected');
  return value.length > 58 ? `...${value.slice(-55)}` : value;
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

function applyLanguage() {
  document.documentElement.lang = state.language === 'zh' ? 'zh-CN' : 'en';
  document.querySelectorAll('[data-i18n]').forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-title]').forEach((node) => {
    node.title = t(node.dataset.i18nTitle);
  });
  nodes.languageLabel.textContent = t('languageButton');
  paint();
  renderFiles();
  repaintStatus();
}

function paint() {
  nodes.sourceBadge.textContent = state.files.length ? `${state.files.length}` : t('emptyBadge');
  nodes.totalCount.textContent = state.files.length;
  nodes.doneCount.textContent = state.done;
  nodes.failCount.textContent = state.failed;
  nodes.outputDir.textContent = shortPath(state.outputDir);
  nodes.folderPath.textContent = sourceLabel();
  nodes.emptyState.style.display = state.files.length ? 'none' : 'grid';
  nodes.convertBtn.disabled = state.running || !state.files.length || !state.outputDir;
  nodes.cancelBtn.disabled = !state.running;
  nodes.clearBtn.disabled = state.running || !state.files.length;
  nodes.rescanBtn.disabled = state.running || state.mode !== 'folder' || !state.folderPath;
  updatePresetButtons();
  renderResults();
}

function sourceLabel() {
  if (state.mode === 'files') return t('selectedFiles', { count: state.files.length });
  if (state.mode === 'drop') return t('droppedItems', { count: state.files.length });
  if (state.folderPath) return shortPath(state.folderPath);
  return t('waitingForSource');
}

function updatePresetButtons() {
  nodes.presetButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.preset === state.activePreset);
  });
}

function renderFiles() {
  nodes.fileList.textContent = '';
  const fragment = document.createDocumentFragment();
  state.files.forEach((file, index) => {
    const row = document.createElement('div');
    row.className = `file-row ${file.status || ''}`;
    row.dataset.path = file.path;
    row.style.animationDelay = `${Math.min(index * 18, 180)}ms`;

    const text = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'file-name';
    name.textContent = file.name;
    const meta = document.createElement('div');
    meta.className = 'file-meta';
    meta.textContent = [fileSize(file.size), file.relativePath || file.path].filter(Boolean).join(' · ');
    text.append(name, meta);

    const status = document.createElement('div');
    status.className = 'row-status';
    status.textContent = statusText(file.status);

    row.append(text, status);
    fragment.append(row);
  });
  nodes.fileList.append(fragment);
  paint();
}

function renderResults() {
  if (!state.lastResult || !state.lastResult.ok) {
    nodes.resultPanel.hidden = true;
    return;
  }
  const failed = (state.lastResult.results || []).filter((item) => !item.ok);
  nodes.resultPanel.hidden = false;
  nodes.resultSummary.textContent = t('resultSummary', {
    succeeded: state.lastResult.succeeded,
    failed: state.lastResult.failed
  });
  nodes.resultOutput.textContent = t('resultOutput', { path: shortPath(state.outputDir) });
  if (!failed.length) {
    nodes.resultFailures.textContent = t('noFailures');
    return;
  }
  nodes.resultFailures.textContent = t('failureSummary', {
    count: failed.length,
    files: failed.slice(0, 3).map((item) => item.file).join(', ')
  });
}

function statusText(status) {
  if (status === 'done') return t('done');
  if (status === 'error') return t('failed');
  if (status === 'running') return t('processing');
  return t('waiting');
}

function setProgress(done, total) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  nodes.progressBar.style.width = `${pct}%`;
}

function resetRunState({ keepResult = false } = {}) {
  state.done = 0;
  state.failed = 0;
  if (!keepResult) state.lastResult = null;
  setProgress(0, state.files.length);
  state.files = state.files.map((file) => ({ ...file, status: null, message: null }));
}

function setFiles(files, mode, folderPath = null) {
  state.mode = mode;
  state.folderPath = folderPath;
  state.files = files.map((file) => ({
    path: file.path,
    name: file.name,
    relativePath: file.relativePath,
    size: file.size
  }));
  resetRunState();
  renderFiles();
  setStatus(state.files.length ? 'addedFiles' : 'noMatchingFiles', { count: state.files.length });
}

async function loadFolder(folderPath = state.folderPath) {
  if (!folderPath) return;
  state.mode = 'folder';
  state.folderPath = folderPath;
  setStatus('scanning');
  paint();
  try {
    const files = await api.scanFolder(folderPath, nodes.formatFilter.value, nodes.recursiveScan.checked);
    setFiles(files, 'folder', folderPath);
  } catch (err) {
    setStatusText(err.message || t('scanFailed'));
  }
}

async function applyPreset(key) {
  const preset = presets[key];
  if (!preset || state.running) return;
  state.activePreset = key;
  nodes.formatFilter.value = preset.formatFilter;
  nodes.outputFormat.value = preset.outputFormat;
  nodes.lossless.checked = preset.lossless;
  nodes.recursiveScan.checked = preset.recursive;
  setStatus('presetApplied', { name: t(preset.labelKey) });
  paint();
  if (state.mode === 'folder' && state.folderPath) {
    await loadFolder();
  }
}

function clearActivePreset() {
  state.activePreset = null;
  updatePresetButtons();
}

function setDragState(active) {
  nodes.queueArea.classList.toggle('drag-over', active && !state.running);
}

function isFileDrag(event) {
  return Array.from(event.dataTransfer?.types || []).includes('Files');
}

function allowFileDrop(event) {
  if (!isFileDrag(event)) return false;
  event.preventDefault();
  event.stopPropagation();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = state.running ? 'none' : 'copy';
  }
  return true;
}

nodes.languageBtn.addEventListener('click', () => {
  state.language = state.language === 'en' ? 'zh' : 'en';
  localStorage.setItem(languageKey, state.language);
  applyLanguage();
});

nodes.pickImagesBtn.addEventListener('click', async () => {
  const files = await api.pickImages();
  if (!files.length) return;
  setFiles(files, 'files');
});

nodes.pickFolderBtn.addEventListener('click', async () => {
  const folder = await api.pickFolder();
  if (folder) await loadFolder(folder);
});

nodes.pickOutputBtn.addEventListener('click', async () => {
  const folder = await api.pickFolder();
  if (!folder) return;
  state.outputDir = folder;
  setStatus('outputSet', { path: shortPath(folder) });
  paint();
});

nodes.rescanBtn.addEventListener('click', () => loadFolder());

nodes.clearBtn.addEventListener('click', () => {
  state.files = [];
  state.mode = null;
  state.folderPath = null;
  resetRunState();
  renderFiles();
  setStatus('queueCleared');
});

nodes.formatFilter.addEventListener('change', () => {
  clearActivePreset();
  if (state.mode === 'folder') loadFolder();
});

nodes.recursiveScan.addEventListener('change', () => {
  clearActivePreset();
  if (state.mode === 'folder') loadFolder();
});

[nodes.outputFormat, nodes.lossless, nodes.overwrite].forEach((node) => {
  node.addEventListener('change', clearActivePreset);
});

nodes.presetButtons.forEach((button) => {
  button.addEventListener('click', () => applyPreset(button.dataset.preset));
});

nodes.openOutputBtn.addEventListener('click', async () => {
  const result = await api.openPath(state.outputDir);
  if (!result.ok) setStatusText(result.error || t('openOutputFailed'));
});

window.addEventListener('dragenter', (event) => {
  if (!allowFileDrop(event)) return;
  state.dragDepth += 1;
  setDragState(true);
}, true);

window.addEventListener('dragover', (event) => {
  if (!allowFileDrop(event)) return;
  setDragState(true);
}, true);

window.addEventListener('dragleave', (event) => {
  if (!allowFileDrop(event)) return;
  state.dragDepth = Math.max(0, state.dragDepth - 1);
  if (state.dragDepth === 0) setDragState(false);
}, true);

window.addEventListener('drop', async (event) => {
  if (!allowFileDrop(event)) return;
  state.dragDepth = 0;
  setDragState(false);
  if (state.running) return;
  const droppedFiles = event.dataTransfer.files;
  if (!droppedFiles.length) return;
  setStatus('resolvingDrop');
  paint();
  try {
    const files = await api.resolveDroppedFiles(droppedFiles, nodes.formatFilter.value, nodes.recursiveScan.checked);
    setFiles(files, 'drop');
  } catch (err) {
    setStatusText(err.message || t('scanFailed'));
  }
}, true);

nodes.convertBtn.addEventListener('click', async () => {
  if (!state.files.length || !state.outputDir) return;
  state.running = true;
  resetRunState();
  renderFiles();
  setStatus('converting');
  paint();
  const result = await api.startConversion({
    files: state.files,
    outputFormat: nodes.outputFormat.value,
    outputDir: state.outputDir,
    lossless: nodes.lossless.checked,
    overwrite: nodes.overwrite.checked
  });
  state.running = false;
  if (result.ok) {
    state.lastResult = result;
    state.done = result.succeeded;
    state.failed = result.failed;
    setProgress(state.done + state.failed, state.files.length);
    setStatus(result.cancelled ? 'cancelled' : 'completed', {
      succeeded: result.succeeded,
      failed: result.failed
    });
  } else {
    setStatusText(result.error || t('conversionFailed'));
  }
  paint();
});

nodes.cancelBtn.addEventListener('click', async () => {
  await api.cancelConversion();
  setStatus('cancelling');
});

api.onConversionProgress((info) => {
  const file = state.files.find((item) => item.path === info.path || item.name === info.file);
  if (file) {
    file.status = info.status;
    file.message = info.message;
  }
  state.done += info.status === 'done' ? 1 : 0;
  state.failed += info.status === 'error' ? 1 : 0;
  setProgress(state.done + state.failed, state.files.length);
  renderFiles();
  if (info.message) {
    setStatusText(`${info.file}: ${info.message}`);
  } else {
    setStatusText(`${info.file}: ${statusText(info.status)}`);
  }
});

applyLanguage();
