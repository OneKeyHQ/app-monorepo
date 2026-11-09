const { EventEmitter } = require('events');
const fs = require('fs');
const assert = require('node:assert/strict');
const path = require('path');
const vm = require('vm');

const { transformSync } = require('@swc/core');

const shortcutsSource = fs.readFileSync(
  path.join(__dirname, '../app/libs/shortcuts.ts'),
  'utf8',
);

function loadShortcuts() {
  const registered = new Map();
  const app = new EventEmitter();
  app.whenReady = () => Promise.resolve();
  app.quit = jest.fn();
  const state = { focused: true, visible: true, disabled: false };
  const browserWindow = new EventEmitter();
  browserWindow.isFocused = () => state.focused;
  browserWindow.isVisible = () => state.visible;
  browserWindow.webContents = { send: jest.fn() };
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
  const dependencies = {
    electron: {
      app,
      globalShortcut: {
        register: (key, callback) => {
          registered.set(key, callback);
          return true;
        },
        unregisterAll: () => registered.clear(),
      },
    },
    'electron-log/main': logger,
    '@onekeyhq/shared/src/shortcuts/shortcuts.enum': {
      shortcutsMap: {
        CloseTab: { keys: ['CmdOrCtrl', 'W'], desc: 'Close Tab' },
        NewTab: { keys: ['CmdOrCtrl', 'T'], desc: 'New Tab' },
        Refresh: { keys: ['CmdOrCtrl', 'R'], desc: 'Refresh' },
      },
    },
    '@onekeyhq/shared/src/shortcuts/shortcutsKeys.enum': {
      shortcutsKeys: { CmdOrCtrl: 'CmdOrCtrl', Shift: 'Shift' },
    },
    './store': {
      getDisableKeyboardShortcuts: () => ({
        disableAllShortcuts: state.disabled,
      }),
    },
  };
  const context = vm.createContext({
    exports: {},
    require: (name) => {
      if (!(name in dependencies)) assert.fail(`Unexpected import: ${name}`);
      return dependencies[name];
    },
  });
  vm.runInContext(
    transformSync(shortcutsSource, {
      filename: 'shortcuts.ts',
      jsc: {
        parser: { syntax: 'typescript' },
        target: 'es2022',
      },
      module: { type: 'commonjs' },
    }).code,
    context,
  );
  const { registerShortcuts, unregisterShortcuts } = context.exports;

  const ipcMessageKeys = { APP_STATE: 'state', APP_SHORTCUT: 'shortcut' };
  let isAppReady = true;
  let bleQuitStarted = false;
  let bleQuitReady = false;
  const {
    installMainWindowShortcutHandlers,
  } = require('../app/libs/mainWindowShortcutHandlers');
  const {
    createMainWindowClosedHandler,
    setMainWindow,
  } = require('../app/libs/mainWindowAccess');
  const { createBeforeQuitHandler } = require('../app/libs/appQuitHandlers');

  installMainWindowShortcutHandlers({
    browserWindow,
    getSafelyBrowserWindow: () => browserWindow,
    getBleQuitStarted: () => bleQuitStarted,
    ipcMessageKeys,
    registerShortcuts,
    unregisterShortcuts,
  });

  setMainWindow(browserWindow);
  browserWindow.on(
    'closed',
    createMainWindowClosedHandler({
      browserWindow,
      unregisterShortcuts,
      getAppReady: () => isAppReady,
      setAppReady: (ready) => {
        isAppReady = ready;
      },
      logger,
    }),
  );

  app.on(
    'before-quit',
    createBeforeQuitHandler({
      app: { quit: jest.fn() },
      isMac: true,
      logger,
      getDesktopApiAppUpdate: () => ({
        hasPreparedQuitInstall: () => false,
        installOnQuit: jest.fn(),
      }),
      markAppQuitStarted: jest.fn(),
      unregisterShortcuts,
      getBleQuitStarted: () => bleQuitStarted,
      setBleQuitStarted: (started) => {
        bleQuitStarted = started;
      },
      getBleQuitReady: () => bleQuitReady,
      setBleQuitReady: (ready) => {
        bleQuitReady = ready;
      },
      // Keep BLE disposal pending to verify shortcuts are released before it ends.
      getNobleBleInitialization: () => new Promise(() => {}),
      getTrezorBleSupports: () => new Set(),
      disposeNobleBleSupport: () => Promise.resolve(),
      getSafelyMainWindow: () => browserWindow,
      destroyTrayManager: jest.fn(),
      resetBootFailCountOnGracefulQuit: jest.fn(),
      clearSystemIdleInterval: jest.fn(),
      disposeContextMenu: jest.fn(),
    }),
  );

  return { app, browserWindow, registered, state };
}

describe('desktop shortcut lifecycle', () => {
  test('focused visible windows keep shortcuts working', async () => {
    const { browserWindow, registered } = loadShortcuts();
    browserWindow.emit('focus');
    await Promise.resolve();
    expect(registered.size).toBe(3);
    registered.get('CmdOrCtrl+W')();
    expect(browserWindow.webContents.send).toHaveBeenCalledWith(
      'shortcut',
      'CloseTab',
    );
  });

  test('an immediate blur cannot be undone by deferred registration', async () => {
    const { browserWindow, registered, state } = loadShortcuts();
    browserWindow.emit('focus');
    state.focused = false;
    browserWindow.emit('blur');
    await Promise.resolve();
    expect(registered.size).toBe(0);
  });

  test.each(['hide', 'closed'])(
    '%s releases shortcuts without relying on a blur event',
    async (event) => {
      const { browserWindow, registered } = loadShortcuts();
      browserWindow.emit('focus');
      await Promise.resolve();
      browserWindow.emit(event);
      expect(registered.size).toBe(0);
    },
  );

  test.each(['focus', 'enter-full-screen'])(
    '%s keeps shortcuts working on a focused visible window',
    async (event) => {
      const { browserWindow, registered } = loadShortcuts();
      browserWindow.emit(event);
      await Promise.resolve();
      expect(registered.size).toBe(3);
    },
  );

  test.each(['focus', 'enter-full-screen'])(
    '%s cannot register shortcuts after the window lost focus',
    async (event) => {
      const { browserWindow, registered, state } = loadShortcuts();
      state.focused = false;
      browserWindow.emit(event);
      await Promise.resolve();
      expect(registered.size).toBe(0);
    },
  );

  test('hidden windows cannot register shortcuts', async () => {
    const { browserWindow, registered, state } = loadShortcuts();
    state.visible = false;
    browserWindow.emit('focus');
    await Promise.resolve();
    expect(registered.size).toBe(0);
  });

  test('blur releases shortcuts even when the renderer notification fails', async () => {
    const { browserWindow, registered } = loadShortcuts();
    browserWindow.emit('focus');
    await Promise.resolve();
    browserWindow.webContents.send.mockImplementation(() => {
      assert.fail('Renderer unavailable');
    });
    expect(() => browserWindow.emit('blur')).toThrow('Renderer unavailable');
    expect(registered.size).toBe(0);
  });

  test('quit releases shortcuts while BLE cleanup is pending and prevents re-registration', async () => {
    // The quit handler arms a 5s BLE disposal timeout; keep it off the event loop.
    const setTimeoutSpy = jest
      .spyOn(globalThis, 'setTimeout')
      .mockImplementation(() => 0);
    try {
      const { app, browserWindow, registered } = loadShortcuts();
      browserWindow.emit('focus');
      await Promise.resolve();
      const event = { preventDefault: jest.fn() };
      app.emit('before-quit', event);
      expect(event.preventDefault).toHaveBeenCalled();
      expect(registered.size).toBe(0);
      browserWindow.emit('focus');
      browserWindow.emit('enter-full-screen');
      await Promise.resolve();
      expect(registered.size).toBe(0);
    } finally {
      setTimeoutSpy.mockRestore();
    }
  });

  test('disabled shortcuts remain unregistered', async () => {
    const { browserWindow, registered, state } = loadShortcuts();
    state.disabled = true;
    browserWindow.emit('focus');
    await Promise.resolve();
    expect(registered.size).toBe(0);
  });
});
