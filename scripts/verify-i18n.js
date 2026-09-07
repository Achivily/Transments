'use strict';

const { app, BrowserWindow } = require('electron');
const path = require('path');

const projectRoot = path.join(__dirname, '..');

async function verifyI18n() {
  const window = new BrowserWindow({
    width: 1000,
    height: 700,
    show: false,
    webPreferences: {
      preload: path.join(projectRoot, 'src', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  await window.loadFile(path.join(projectRoot, 'src', 'renderer', 'index.html'), {
    query: { lang: 'en' }
  });

  const first = await snapshot(window);
  assertEqual(first.lang, 'en', 'initial document language');
  assertEqual(first.heading, 'Batch Conversion', 'initial English heading');
  assertEqual(first.source, 'Source', 'initial English source label');
  assertEqual(first.preset, 'Presets', 'initial English preset label');
  assertEqual(first.result, 'Conversion Results', 'initial English result label');
  assertEqual(first.drop, 'Drop images or folders', 'initial English drop label');
  assertEqual(first.languageButton, '中文', 'initial language button target');

  await window.webContents.executeJavaScript('document.getElementById("languageBtn").click()');
  const second = await snapshot(window);
  assertEqual(second.lang, 'zh-CN', 'switched document language');
  assertEqual(second.heading, '批量转换', 'switched Chinese heading');
  assertEqual(second.source, '来源', 'switched Chinese source label');
  assertEqual(second.preset, '转换预设', 'switched Chinese preset label');
  assertEqual(second.result, '转换结果', 'switched Chinese result label');
  assertEqual(second.drop, '拖入图片或文件夹', 'switched Chinese drop label');
  assertEqual(second.languageButton, 'English', 'switched language button target');

  await window.webContents.executeJavaScript('document.getElementById("languageBtn").click()');
  const third = await snapshot(window);
  assertEqual(third.lang, 'en', 'switched back document language');
  assertEqual(third.heading, 'Batch Conversion', 'switched back English heading');

  window.destroy();
  app.quit();
}

function snapshot(window) {
  return window.webContents.executeJavaScript(`({
    lang: document.documentElement.lang,
    heading: document.querySelector('[data-i18n="batchConversion"]').textContent,
    source: document.querySelector('[data-i18n="sourceTitle"]').textContent,
    preset: document.querySelector('[data-i18n="presetTitle"]').textContent,
    result: document.querySelector('[data-i18n="resultTitle"]').textContent,
    drop: document.querySelector('[data-i18n="dropTitle"]').textContent,
    languageButton: document.getElementById('languageLabel').textContent
  })`);
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected "${expected}", received "${actual}"`);
  }
}

app.whenReady().then(verifyI18n).catch((err) => {
  console.error(err);
  app.exit(1);
});
