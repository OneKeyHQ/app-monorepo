const { EventEmitter } = require('events');
const fs = require('fs');
const assert = require('node:assert/strict');
const path = require('path');
const vm = require('vm');

const ts = require('typescript');

const appSource = ts.createSourceFile(
  'app.ts',
  fs.readFileSync(path.join(__dirname, '../app/app.ts'), 'utf8'),
  ts.ScriptTarget.Latest,
  true,
);
const shortcutsSource = fs.readFileSync(
  path.join(__dirname, '../app/libs/shortcuts.ts'),
  'utf8',
);

function loadShortcuts() {
  const registered = new Map();
  const app = new EventEmitter();
  app.whenReady = () => Promise.resolve();
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
    app,
    browserWindow,
    getSafelyBrowserWindow: () => browserWindow,
    ipcMessageKeys: { APP_STATE: 'state', APP_SHORTCUT: 'shortcut' },
    logger,
    mainWindow: browserWindow,
    isAppReady: true,
    isMac: true,
    bleQuitStarted: false,
    bleQuitReady: false,
    // Keep BLE disposal pending to verify shortcuts are released before it ends.
    nobleBleInitialization: new Promise(() => {}),
    disposeNobleBleSupport: () => Promise.resolve(),
    trezorBleSupports: new Set(),
    setTimeout: jest.fn(),
  });
  const evaluate = (source) =>
    vm.runInContext(
      ts.transpileModule(source, {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.CommonJS,
          esModuleInterop: true,
        },
      }).outputText,
      context,
    );
  evaluate(shortcutsSource);
  Object.assign(context, context.exports);

  const windowEvents = new Set([
    'focus',
    'blur',
    'hide',
    'closed',
    'enter-full-screen',
  ]);
  let hasQuitHandler = false;
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const target = node.expression.getText(appSource);
      const event = node.arguments[0]?.text;
      if (target === 'browserWindow.on' && windowEvents.has(event)) {
        evaluate(node.getText(appSource));
      } else if (
        target === 'app.on' &&
        event === 'before-quit' &&
        !hasQuitHandler
      ) {
        hasQuitHandler = true;
        evaluate(node.getText(appSource));
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(appSource);
  return { app, browserWindow, registered, state, ...context.exports };
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
  });

  test('disabled shortcuts remain unregistered', async () => {
    const { browserWindow, registered, state } = loadShortcuts();
    state.disabled = true;
    browserWindow.emit('focus');
    await Promise.resolve();
    expect(registered.size).toBe(0);
  });
});
