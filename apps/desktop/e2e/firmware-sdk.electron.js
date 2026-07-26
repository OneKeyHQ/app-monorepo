#!/usr/bin/env node

const path = require('node:path');

const { app, BrowserWindow, session } = require('electron');

let mainWindow;

app.whenReady().then(async () => {
  session.defaultSession.webRequest.onBeforeRequest(
    { urls: ['http://*/*', 'https://*/*'] },
    (_details, callback) => {
      callback({ cancel: true });
    },
  );

  mainWindow = new BrowserWindow({
    show: process.env.CI !== 'true',
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
      sandbox: false,
      webSecurity: true,
    },
  });

  await mainWindow.loadFile(
    path.join(__dirname, 'fixtures', 'firmware-sdk-host.html'),
  );
});

app.on('window-all-closed', () => {
  app.quit();
});
