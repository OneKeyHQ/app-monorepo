import fs from 'fs';
import path from 'path';
import { fileURLToPath, format as formatUrl } from 'url';

import { BrowserWindow, app, ipcMain, session } from 'electron';
import isDev from 'electron-is-dev';
import logger from 'electron-log/main';

import { ipcMessageKeys } from './config';
import * as store from './libs/store';
import { getAppStaticResourcesPath } from './resoucePath';

const isMac = process.platform === 'darwin';
const isWin = process.platform === 'win32';
const isLinux = process.platform === 'linux';

/**
 * Create a standalone recovery window with its own IPC handlers.
 * This is completely independent from the normal createMainWindow flow —
 * no getMetadata, no interceptFileProtocol, no bundle verification.
 */
export function createRecoveryWindow(): BrowserWindow {
  const { screen } = require('electron');
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const display = screen.getPrimaryDisplay();
  const dimensions = display.workAreaSize;
  const appStaticResourcesPath = getAppStaticResourcesPath();

  // Register sync IPC handlers that preload.js calls at module load time.
  // Without these, ipcRenderer.sendSync() blocks forever and the page
  // never renders.
  ipcMain.removeAllListeners(ipcMessageKeys.IS_DEV);
  ipcMain.on(ipcMessageKeys.IS_DEV, (event) => {
    event.returnValue = isDev;
  });
  ipcMain.removeAllListeners(ipcMessageKeys.LOG_DIRECTORY);
  ipcMain.on(ipcMessageKeys.LOG_DIRECTORY, (event) => {
    event.returnValue = path.dirname(logger.transports.file.getFile().path);
  });
  ipcMain.removeAllListeners(ipcMessageKeys.APP_IS_FOCUSED);
  ipcMain.on(ipcMessageKeys.APP_IS_FOCUSED, (event) => {
    event.returnValue = false;
  });

  const browserWindow = new BrowserWindow({
    show: true,
    title: 'OneKey',
    titleBarStyle: 'hidden',
    titleBarOverlay:
      isWin || isLinux
        ? {
            height: 52,
            color: '#00000000',
            symbolColor: '#ffffff',
          }
        : false,
    trafficLightPosition: { x: 20, y: 20 },
    autoHideMenuBar: true,
    frame: true,
    resizable: true,
    width: Math.min(800, dimensions.width),
    height: Math.min(600, dimensions.height),
    backgroundColor: '#0F0F0F',
    webPreferences: {
      spellcheck: false,
      webviewTag: false,
      webSecurity: true,
      contextIsolation: false,
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false,
      nodeIntegration: false,
    },
    icon: path.join(appStaticResourcesPath, 'images/icons/512x512.png'),
  });

  // Chromium's default file:// handler cannot read files inside app.asar
  // because the OS treats the .asar as a regular file, not a directory.
  // Register interceptFileProtocol so Electron resolves paths through its
  // asar-aware fs layer. The main window's interceptor (app.ts:1050) is
  // registered inside did-finish-load — which never runs when the recovery
  // path is taken — so there is no conflict.
  const PROTOCOL = 'file';
  session.defaultSession.protocol.interceptFileProtocol(
    PROTOCOL,
    (request, callback) => {
      try {
        callback(fileURLToPath(request.url));
      } catch {
        callback(request.url);
      }
    },
  );

  const src = formatUrl({
    pathname: path.join(__dirname, 'recovery.html'),
    protocol: PROTOCOL,
    slashes: true,
  });
  void browserWindow.loadURL(src);

  if (isDev) {
    browserWindow.webContents.openDevTools();
  }

  // === IPC Handlers ===

  ipcMain.removeHandler(ipcMessageKeys.RECOVERY_EXPORT_LOGS);
  ipcMain.handle(ipcMessageKeys.RECOVERY_EXPORT_LOGS, async () => {
    try {
      const { dialog } = await import('electron');
      const logDir = path.dirname(logger.transports.file.getFile().path);
      const logFiles = fs.readdirSync(logDir).filter((f) => f.endsWith('.log'));
      if (logFiles.length === 0) {
        return { error: 'No log files found' };
      }
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const result = await dialog.showSaveDialog({
        defaultPath: `onekey-logs-${timestamp}.zip`,
        filters: [{ name: 'ZIP', extensions: ['zip'] }],
      });
      if (result.canceled || !result.filePath) {
        return {};
      }
      const AdmZip = (await import('adm-zip')).default;
      const zip = new AdmZip();
      for (const file of logFiles) {
        zip.addLocalFile(path.join(logDir, file));
      }
      zip.writeZip(result.filePath);
      return {};
    } catch (e: any) {
      logger.error('Recovery export logs failed:', e);
      return { error: e?.message || String(e) };
    }
  });

  ipcMain.removeHandler(ipcMessageKeys.RECOVERY_TRY_AGAIN);
  ipcMain.handle(ipcMessageKeys.RECOVERY_TRY_AGAIN, async () => {
    store.resetConsecutiveBootFailCount();
    if (process.mas) {
      return { needsManualRestart: true };
    }
    app.relaunch();
    app.exit(0);
  });

  ipcMain.removeHandler(ipcMessageKeys.RECOVERY_AUTO_REPAIR);
  ipcMain.handle(ipcMessageKeys.RECOVERY_AUTO_REPAIR, async () => {
    const errors: string[] = [];
    try {
      store.clearUpdateBundleData();
    } catch (e: any) {
      errors.push(`clearUpdateBundleData: ${e?.message}`);
    }
    try {
      store.clearFallbackUpdateBundleData();
    } catch (e: any) {
      errors.push(`clearFallbackUpdateBundleData: ${e?.message}`);
    }
    try {
      store.clearASCFile();
    } catch (e: any) {
      errors.push(`clearASCFile: ${e?.message}`);
    }
    try {
      store.clearUpdateBuildNumber();
    } catch (e: any) {
      errors.push(`clearUpdateBuildNumber: ${e?.message}`);
    }
    try {
      const bundleDir = path.join(app.getPath('userData'), 'onekey-bundle');
      if (fs.existsSync(bundleDir)) {
        fs.rmSync(bundleDir, { recursive: true, force: true });
      }
    } catch (e: any) {
      errors.push(`deleteBundleDir: ${e?.message}`);
    }
    try {
      const bundleDownloadDir = path.join(
        app.getPath('userData'),
        'onekey-bundle-download',
      );
      if (fs.existsSync(bundleDownloadDir)) {
        fs.rmSync(bundleDownloadDir, { recursive: true, force: true });
      }
    } catch (e: any) {
      errors.push(`deleteBundleDownloadDir: ${e?.message}`);
    }
    try {
      store.clearMmkvRecoveryKeys();
    } catch (e: any) {
      errors.push(`clearMmkvKeys: ${e?.message}`);
    }
    store.resetConsecutiveBootFailCount();
    if (errors.length > 0) {
      logger.error('Recovery auto repair partial errors:', errors);
    }
    return errors.length > 0 ? { error: errors.join('; ') } : {};
  });

  // Mac: hide instead of close
  // @ts-expect-error
  browserWindow.on('close', (event: Event) => {
    if (isMac) {
      event.preventDefault();
      browserWindow.blur();
      browserWindow.hide();
    }
  });

  return browserWindow;
}
