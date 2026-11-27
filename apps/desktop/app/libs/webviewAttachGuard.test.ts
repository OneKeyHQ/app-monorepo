import {
  createWillAttachWebviewHandler,
  isAllowedWebviewAttachSrc,
  normalizePreloadPath,
} from './webviewAttachGuard';

describe('webviewAttachGuard', () => {
  test('isAllowedWebviewAttachSrc allows http/https/about:blank/empty and blocks file/javascript', () => {
    expect(isAllowedWebviewAttachSrc('https://app.uniswap.org')).toBe(true);
    expect(isAllowedWebviewAttachSrc('http://localhost:3000')).toBe(true);
    expect(isAllowedWebviewAttachSrc('about:blank')).toBe(true);
    expect(isAllowedWebviewAttachSrc('')).toBe(true);
    expect(isAllowedWebviewAttachSrc('file:///etc/passwd')).toBe(false);
    expect(
      isAllowedWebviewAttachSrc(['javascript', 'alert(1)'].join(':')),
    ).toBe(false);
  });

  test('normalizePreloadPath decodes file URLs on Windows and POSIX', () => {
    if (process.platform === 'win32') {
      expect(
        normalizePreloadPath(
          'file:///C:/Program%20Files/OneKey/resources/static/preload.js?t=123',
          'win32',
        ),
      ).toBe('C:\\Program Files\\OneKey\\resources\\static\\preload.js');
    } else {
      expect(
        normalizePreloadPath(
          'file:///Applications/OneKey%20Wallet.app/Contents/Resources/static/preload.js?t=123',
          'darwin',
        ),
      ).toBe(
        '/Applications/OneKey Wallet.app/Contents/Resources/static/preload.js',
      );
    }
  });

  test('enforces hardened webPreferences, strips untrusted preload, and blocks file:// src', () => {
    const trustedPreload =
      process.platform === 'win32'
        ? 'C:\\Program Files\\OneKey\\resources\\static\\preload.js'
        : '/Applications/OneKey.app/Contents/Resources/static/preload.js';
    const logger = { warn: jest.fn() };
    const handler = createWillAttachWebviewHandler({
      getTrustedPreloadPath: () => trustedPreload,
      logger,
    });

    // 1. Disallowed src is prevented
    const preventDefault = jest.fn();
    handler(
      { preventDefault },
      { nodeIntegration: true },
      { src: 'file:///C:/Windows/win.ini' },
    );
    expect(preventDefault).toHaveBeenCalledTimes(1);

    // 2. Untrusted OTA preload path is stripped (fail closed) and dangerous prefs are locked down
    const untrustedPrefs: Record<string, unknown> = {
      nodeIntegration: true,
      nodeIntegrationInWorker: true,
      nodeIntegrationInSubFrames: true,
      contextIsolation: false,
      sandbox: false,
      webSecurity: false,
      allowRunningInsecureContent: true,
      experimentalFeatures: true,
      plugins: true,
      webviewTag: true,
      enableBlinkFeatures: 'ExecCommandInJavaScript',
      preload:
        process.platform === 'win32'
          ? 'file:///C:/Users/user/AppData/Roaming/OneKey/onekey-bundle/6.8.0-1/build/static/preload.js'
          : 'file:///Users/user/Library/Application%20Support/OneKey/onekey-bundle/6.8.0-1/build/static/preload.js',
    };
    const allowPrevent = jest.fn();
    handler({ preventDefault: allowPrevent }, untrustedPrefs, {
      src: 'https://dapp.example.com',
    });
    expect(allowPrevent).not.toHaveBeenCalled();
    expect(untrustedPrefs.nodeIntegration).toBe(false);
    expect(untrustedPrefs.nodeIntegrationInWorker).toBe(false);
    expect(untrustedPrefs.nodeIntegrationInSubFrames).toBe(false);
    expect(untrustedPrefs.contextIsolation).toBe(true);
    expect(untrustedPrefs.sandbox).toBe(true);
    expect(untrustedPrefs.webSecurity).toBe(true);
    expect(untrustedPrefs.allowRunningInsecureContent).toBe(false);
    expect(untrustedPrefs.experimentalFeatures).toBe(false);
    expect(untrustedPrefs.plugins).toBe(false);
    expect(untrustedPrefs.webviewTag).toBe(false);
    expect(untrustedPrefs.enableBlinkFeatures).toBeUndefined();
    expect(untrustedPrefs.preload).toBeUndefined();

    // 3. Trusted preload URL is preserved and normalized
    const trustedUrl =
      process.platform === 'win32'
        ? 'file:///c:/Program%20Files/OneKey/resources/static/preload.js?t=99'
        : 'file:///Applications/OneKey.app/Contents/Resources/static/preload.js?t=99';
    const trustedPrefs: Record<string, unknown> = { preload: trustedUrl };
    handler({ preventDefault: jest.fn() }, trustedPrefs, {
      src: 'https://dapp.example.com',
    });
    expect(trustedPrefs.preload).toBe(trustedPreload);
  });
});
