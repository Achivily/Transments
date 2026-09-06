'use strict';

const api = window.transments;

const state = {
  mode: null,
  folderPath: null,
  outputDir: null,
  files: [],
  running: false,
  done: 0,
  failed: 0
};

const $ = (id) => document.getElementById(id);

const nodes = {
  pickImagesBtn: $('pickImagesBtn'),
  pickFolderBtn: $('pickFolderBtn'),
  pickOutputBtn: $('pickOutputBtn'),
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
  emptyState: $('emptyState')
};

function setStatus(text) {
  nodes.statusText.textContent = text;
}

function shortPath(value) {
  if (!value) return '未选择';
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

function paint() {
  nodes.sourceBadge.textContent = state.files.length ? `${state.files.length}` : '空';
  nodes.totalCount.textContent = state.files.length;
  nodes.doneCount.textContent = state.done;
  nodes.failCount.textContent = state.failed;
  nodes.outputDir.textContent = shortPath(state.outputDir);
  nodes.folderPath.textContent = state.folderPath ? shortPath(state.folderPath) : '等待选择来源';
  nodes.emptyState.style.display = state.files.length ? 'none' : 'grid';
  nodes.convertBtn.disabled = state.running || !state.files.length || !state.outputDir;
  nodes.cancelBtn.disabled = !state.running;
  nodes.clearBtn.disabled = state.running || !state.files.length;
  nodes.rescanBtn.disabled = state.running || state.mode !== 'folder' || !state.folderPath;
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

function statusText(status) {
  if (status === 'done') return '完成';
  if (status === 'error') return '失败';
  if (status === 'running') return '处理中';
  return '等待';
}

function setProgress(done, total) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  nodes.progressBar.style.width = `${pct}%`;
}

function resetRunState() {
  state.done = 0;
  state.failed = 0;
  setProgress(0, state.files.length);
  state.files = state.files.map((file) => ({ ...file, status: null, message: null }));
}

async function loadFolder(folderPath = state.folderPath) {
  if (!folderPath) return;
  state.mode = 'folder';
  state.folderPath = folderPath;
  setStatus('正在扫描...');
  paint();
  try {
    state.files = await api.scanFolder(folderPath, nodes.formatFilter.value, nodes.recursiveScan.checked);
    resetRunState();
    renderFiles();
    setStatus(state.files.length ? `已加入 ${state.files.length} 个文件` : '没有匹配文件');
  } catch (err) {
    setStatus(err.message || '扫描失败');
  }
}

nodes.pickImagesBtn.addEventListener('click', async () => {
  const files = await api.pickImages();
  if (!files.length) return;
  state.mode = 'files';
  state.folderPath = `${files.length} 个独立文件`;
  state.files = files.map((file) => ({
    path: file.path,
    name: file.name,
    size: file.size
  }));
  resetRunState();
  renderFiles();
  setStatus(`已加入 ${files.length} 个文件`);
});

nodes.pickFolderBtn.addEventListener('click', async () => {
  const folder = await api.pickFolder();
  if (folder) await loadFolder(folder);
});

nodes.pickOutputBtn.addEventListener('click', async () => {
  const folder = await api.pickFolder();
  if (!folder) return;
  state.outputDir = folder;
  setStatus(`输出到 ${shortPath(folder)}`);
  paint();
});

nodes.rescanBtn.addEventListener('click', () => loadFolder());

nodes.clearBtn.addEventListener('click', () => {
  state.files = [];
  state.mode = null;
  state.folderPath = null;
  resetRunState();
  renderFiles();
  setStatus('队列已清空');
});

nodes.formatFilter.addEventListener('change', () => {
  if (state.mode === 'folder') loadFolder();
});

nodes.recursiveScan.addEventListener('change', () => {
  if (state.mode === 'folder') loadFolder();
});

nodes.convertBtn.addEventListener('click', async () => {
  if (!state.files.length || !state.outputDir) return;
  state.running = true;
  resetRunState();
  renderFiles();
  setStatus('转换中...');
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
    state.done = result.succeeded;
    state.failed = result.failed;
    setProgress(state.done + state.failed, state.files.length);
    setStatus(result.cancelled ? '已取消' : `完成 ${result.succeeded} 个，失败 ${result.failed} 个`);
  } else {
    setStatus(result.error || '转换失败');
  }
  paint();
});

nodes.cancelBtn.addEventListener('click', async () => {
  await api.cancelConversion();
  setStatus('正在取消...');
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
  setStatus(info.message ? `${info.file}: ${info.message}` : `${info.file}: ${statusText(info.status)}`);
});

paint();
