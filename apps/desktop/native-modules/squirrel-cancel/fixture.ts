// Signed, isolated integration fixture. The production class, cancellation
// wrapper, native helper, Electron and Squirrel are real; feed/download transport
// and app UI dependencies are replaced by the harness bundler.
import assert from 'assert';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { BrowserWindow, app } from 'electron';

import { createBeforeQuitHandler } from '@onekeyhq/desktop/app/libs/appQuitHandlers';
import DesktopApiAppUpdate from '@onekeyhq/kit-bg/src/desktopApis/DesktopApiAppUpdate';

const directory = process.env.ONEKEY_CANCEL_FIXTURE!;
const scenario = process.env.ONEKEY_CANCEL_SCENARIO!;
app.setPath('userData', path.join(directory, 'user-data'));
const report = (event: string, extra = {}) => {
  fs.appendFileSync(
    path.join(directory, 'events.jsonl'),
    `${JSON.stringify({ event, version: app.getVersion(), ...extra })}\n`,
  );
};

app
  .whenReady()
  .then(async () => {
    report('started', {
      packaged: app.isPackaged,
      resources: process.resourcesPath,
      executable: process.execPath,
    });
    if (scenario === 'version' || app.getVersion() === '1.0.1') {
      report('version');
      app.quit();
      return;
    }
    const api = new DesktopApiAppUpdate({ desktopApi: {} as never });
    const mainWindow = new BrowserWindow({ show: false });
    await mainWindow.loadURL('about:blank');
    globalThis.$desktopMainAppFunctions = {
      getSafelyMainWindow: () => mainWindow,
    } as never;
    app.on(
      'before-quit',
      createBeforeQuitHandler({
        app,
        isMac: true,
        logger: console,
        getDesktopApiAppUpdate: () => api,
        markAppQuitStarted: () => {},
        unregisterShortcuts: () => {},
        getBleQuitStarted: () => false,
        setBleQuitStarted: () => {},
        getBleQuitReady: () => true,
        setBleQuitReady: () => {},
        getNobleBleInitialization: async () => undefined,
        getTrezorBleSupports: () => new Set(),
        disposeNobleBleSupport: async () => undefined,
        getSafelyMainWindow: () =>
          mainWindow.isDestroyed() ? undefined : mainWindow,
        destroyTrayManager: () => {},
        resetBootFailCountOnGracefulQuit: () => {},
        clearSystemIdleInterval: () => {},
        disposeContextMenu: () => {},
      }),
    );
    const stage = async () => {
      const cache = path.join(app.getPath('userData'), 'app-shell-updater');
      fs.mkdirSync(cache, { recursive: true });
      const fileName = 'fixture-1.0.1.zip';
      const downloadedFile = path.join(cache, fileName);
      fs.copyFileSync(path.join(directory, 'B.zip'), downloadedFile);
      const record = {
        version: '1.0.1',
        releaseDate: '',
        url: 'https://fixture.invalid/fixture-1.0.1.zip',
        sha512: crypto
          .createHash('sha512')
          .update(fs.readFileSync(downloadedFile))
          .digest('base64'),
        platform: process.platform,
        arch: process.arch,
        fileName,
        downloadedFile,
      };
      fs.writeFileSync(
        path.join(cache, 'package.json'),
        JSON.stringify(record),
      );
      await api.prepareMacInstall({
        latestVersion: record.version,
        downloadUrl: record.url,
        buildNumber: 'fixture-B',
        skipGPGVerification: true,
      });
      report('staged');
    };
    await stage();
    if (scenario === 'queuedquit') {
      let unblock!: () => void;
      const preparation = new Promise<void>((resolve) => {
        unblock = resolve;
      });
      const internal = api as unknown as { macPreparation?: Promise<void> };
      internal.macPreparation = preparation;
      await api.clearUpdateCache({ manual: true, begin: true });
      app.quit();
      report('quit-held-before-revocation');
      const clearing = api.clearUpdateCache({ manual: true });
      unblock();
      await clearing;
      internal.macPreparation = undefined;
      await api.clearUpdateCache({ manual: true, complete: true });
      report('cancelled');
      return;
    }
    if (scenario === 'ownerbeforelost') {
      const gone = new Promise<void>((resolve) =>
        mainWindow.webContents.once('render-process-gone', () => resolve()),
      );
      mainWindow.webContents.forcefullyCrashRenderer();
      await gone;
      await api.clearUpdateCache({ manual: true });
      await new Promise<void>((resolve) => setImmediate(resolve));
      report('already-lost-renderer-with-receipt');
      app.quit();
      return;
    }
    if (
      ['cancel', 'restage', 'retry', 'quitduring', 'ownerlost'].includes(
        scenario,
      )
    ) {
      await api.clearUpdateCache({ manual: true });
      if (scenario === 'ownerlost') {
        const gone = new Promise<void>((resolve) =>
          mainWindow.webContents.once('render-process-gone', () => resolve()),
        );
        mainWindow.webContents.forcefullyCrashRenderer();
        await gone;
        await new Promise<void>((resolve) => setImmediate(resolve));
        report('renderer-lost-with-receipt');
        app.quit();
        return;
      }
      if (scenario === 'retry') {
        // Simulate interruption of upper-layer cleanup before its acknowledgement.
        await api.clearUpdateCache({ manual: true });
        report('cleanup-retried');
      }
      if (scenario === 'quitduring') {
        app.quit();
        report('quit-held-until-commit');
      }
      await api.clearUpdateCache({ manual: true, complete: true });
      report('cancelled');
      if (scenario === 'quitduring') return;
    }
    if (scenario === 'refusal') {
      const internal = api as unknown as {
        macCancellationSnapshot?: Record<string, unknown>;
      };
      const original = internal.macCancellationSnapshot;
      internal.macCancellationSnapshot = {
        ...original,
        hash: 'mismatched-request',
      };
      let refused = false;
      try {
        await api.clearUpdateCache({ manual: true });
      } catch {
        refused = true;
      }
      assert(refused, 'A mismatched preparation was accepted');
      internal.macCancellationSnapshot = original;
      report('refused-without-revoking');
    }
    if (scenario === 'restage') await stage();
    report('quitting');
    // A real normal quit: ShipIt must upgrade only in control/restage cases.
    app.quit();
  })
  .catch((error) => {
    report('error', { message: String(error), stack: error?.stack });
    app.exit(1);
  });
