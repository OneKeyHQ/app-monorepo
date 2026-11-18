/* cspell:ignore insertmacro HKCU */
/* eslint-disable import/first */
import fs from 'fs';
import path from 'path';

import { app } from 'electron';

jest.mock('electron', () => ({
  app: {
    isDefaultProtocolClient: jest.fn(),
    setAsDefaultProtocolClient: jest.fn(),
  },
}));

import {
  DESKTOP_DEEP_LINK_PROTOCOLS,
  ETHEREUM_DEEP_LINK_NAME,
  MAX_DESKTOP_DEEP_LINK_URL_LENGTH,
  findAllowedDeepLinkArg,
  getDesktopProtocolClientArgs,
  hasUnsafeUrlChars,
  isAllowedDeepLinkUrl,
  resolveDesktopRuntimeFlags,
} from './deepLink';
import {
  createDeepLinkHandler,
  createSecondInstanceHandler,
} from './deepLinkHandler';
import { registerDesktopProtocolClients } from './registerDesktopProtocolClients';

describe('desktop deep link arguments', () => {
  test('builds protocol client registration args with "--" separator before "%1"', () => {
    expect(getDesktopProtocolClientArgs(false, ['OneKey.exe'])).toEqual(['--']);
    expect(
      getDesktopProtocolClientArgs(true, ['electron.exe', 'app/dist/app.js']),
    ).toEqual([path.resolve('app/dist/app.js'), '--']);
  });

  test('finds the URL after "--" separator or Electron command-line switches', () => {
    expect(
      findAllowedDeepLinkArg([
        'OneKey.exe',
        '--allow-file-access-from-files',
        '--',
        'onekey-wallet://search/list?q=onekey',
      ]),
    ).toBe('onekey-wallet://search/list?q=onekey');

    expect(
      findAllowedDeepLinkArg([
        'OneKey.exe',
        '--allow-file-access-from-files',
        'onekey-wallet://search/list?q=onekey',
      ]),
    ).toBe('onekey-wallet://search/list?q=onekey');
  });

  test('rejects quote-split multi-argument payloads after "--"', () => {
    expect(
      findAllowedDeepLinkArg([
        'OneKey.exe',
        '--',
        'onekey-wallet://search/list?q=onekey',
        '--gpu-launcher=calc.exe',
      ]),
    ).toBeUndefined();

    expect(
      findAllowedDeepLinkArg([
        'OneKey.exe',
        '--',
        'onekey-wallet://noop',
        'https://app.onekey.so/clip/web?web_url=https://evil.example',
      ]),
    ).toBeUndefined();
  });

  test('rejects trailing arguments or multiple deep links when "--" is absent (e.g. Linux .desktop %U)', () => {
    expect(
      findAllowedDeepLinkArg([
        'OneKey.exe',
        'onekey-wallet://search/list?q=onekey',
        '--gpu-launcher=calc.exe',
      ]),
    ).toBeUndefined();

    expect(
      findAllowedDeepLinkArg([
        'OneKey.exe',
        'onekey-wallet://search/list?q=onekey',
        'onekey-wallet://second',
      ]),
    ).toBeUndefined();
  });

  test('validates unsafe URL characters via shared hasUnsafeUrlChars helper', () => {
    expect(hasUnsafeUrlChars('https://onekey.so/path?a=1')).toBe(false);
    expect(hasUnsafeUrlChars('onekey-wallet://wc?uri=wc%3A123')).toBe(false);
    expect(hasUnsafeUrlChars('onekey-wallet://normal" --switch')).toBe(true);
    expect(hasUnsafeUrlChars('onekey-wallet://normal with space')).toBe(true);
    expect(hasUnsafeUrlChars('onekey-wallet://normal\u0000null')).toBe(true);
    expect(hasUnsafeUrlChars('onekey-wallet://normal\u007fdel')).toBe(true);
  });

  test.each([
    'onekey-wallet://search/list?q=onekey',
    'wc://pairing',
    'ethereum:0x0000000000000000000000000000000000000000',
  ])('allows a registered deep link scheme: %s', (url) => {
    expect(isAllowedDeepLinkUrl(url)).toBe(true);
  });

  test.each([
    'https://example.com',
    'onekey-wallet://normal" --gpu-launcher=calc -- "',
    'onekey-wallet://normal?q="quote"',
    'onekey-wallet://normal with space',
    '',
  ])('rejects unregistered or malformed deep link URLs: %s', (url) => {
    expect(isAllowedDeepLinkUrl(url)).toBe(false);
  });

  test('rejects deep link URLs containing ASCII control characters or exceeding max length', () => {
    expect(isAllowedDeepLinkUrl('onekey-wallet://normal\u0000null')).toBe(
      false,
    );
    expect(isAllowedDeepLinkUrl('onekey-wallet://normal\r\nheader')).toBe(
      false,
    );
    const maxLenPrefix = 'onekey-wallet://search/list?q=';
    const validMaxUrl =
      maxLenPrefix +
      'a'.repeat(MAX_DESKTOP_DEEP_LINK_URL_LENGTH - maxLenPrefix.length);
    const oversizedUrl = `${validMaxUrl}a`;
    expect(isAllowedDeepLinkUrl(validMaxUrl)).toBe(true);
    expect(isAllowedDeepLinkUrl(oversizedUrl)).toBe(false);
    expect(findAllowedDeepLinkArg(['OneKey.exe', '--', oversizedUrl])).toBe(
      undefined,
    );
  });

  test('does not treat Electron switches or unregistered URLs as deep links', () => {
    expect(
      findAllowedDeepLinkArg([
        'OneKey.exe',
        '--allow-file-access-from-files',
        'https://example.com',
      ]),
    ).toBeUndefined();
    expect(isAllowedDeepLinkUrl('https://example.com')).toBe(false);
  });

  test('registers onekey-wallet, wc, and ethereum protocols with "--" before "%1" in app.ts', () => {
    expect(DESKTOP_DEEP_LINK_PROTOCOLS).toEqual([
      'onekey-wallet',
      'wc',
      ETHEREUM_DEEP_LINK_NAME,
    ]);

    const electronApp = app as unknown as {
      isDefaultProtocolClient: jest.Mock;
      setAsDefaultProtocolClient: jest.Mock;
    };
    const isDefaultProtocolClient = electronApp.isDefaultProtocolClient;
    const setAsDefaultProtocolClient = electronApp.setAsDefaultProtocolClient;
    isDefaultProtocolClient.mockReturnValue(false);
    setAsDefaultProtocolClient.mockReturnValue(true);
    registerDesktopProtocolClients({
      defaultApp: false,
      execPath: 'C:\\Program Files\\OneKey\\OneKey.exe',
      argv: ['C:\\Program Files\\OneKey\\OneKey.exe'],
    });

    expect(isDefaultProtocolClient.mock.calls).toEqual([
      ['onekey-wallet', 'C:\\Program Files\\OneKey\\OneKey.exe', ['--']],
      ['wc', 'C:\\Program Files\\OneKey\\OneKey.exe', ['--']],
      ['ethereum', 'C:\\Program Files\\OneKey\\OneKey.exe', ['--']],
    ]);
    expect(setAsDefaultProtocolClient.mock.calls).toEqual([
      ['onekey-wallet', 'C:\\Program Files\\OneKey\\OneKey.exe', ['--']],
      ['wc', 'C:\\Program Files\\OneKey\\OneKey.exe', ['--']],
      ['ethereum', 'C:\\Program Files\\OneKey\\OneKey.exe', ['--']],
    ]);
  });

  test('gates isDev, isPerfCiMode, isDevServer, isLocalUnpacked, and isDesktopE2EMode on !app.isPackaged even when env vars are set', () => {
    expect(
      resolveDesktopRuntimeFlags({
        isPackaged: true,
        env: {
          ELECTRON_IS_DEV: '1',
          PERF_CI_MODE: '1',
          DESKTOP_E2E_MODE: 'true',
        },
      }),
    ).toEqual({
      isDev: false,
      isPerfCiMode: false,
      isDevServer: false,
      isLocalUnpacked: false,
      isDesktopE2EMode: false,
    });

    expect(
      resolveDesktopRuntimeFlags({
        isPackaged: false,
        electronIsDev: true,
        env: { DESKTOP_E2E_MODE: 'true' },
      }),
    ).toEqual({
      isDev: true,
      isPerfCiMode: false,
      isDevServer: true,
      isLocalUnpacked: true,
      isDesktopE2EMode: true,
    });

    expect(
      resolveDesktopRuntimeFlags({
        isPackaged: false,
        electronIsDev: true,
        env: { PERF_CI_MODE: '1' },
      }),
    ).toEqual({
      isDev: true,
      isPerfCiMode: true,
      isDevServer: false,
      isLocalUnpacked: true,
      isDesktopE2EMode: false,
    });
  });

  test('does not log raw argv or deep-link URLs in second-instance or handleDeepLinkUrl', () => {
    const loggerInfo = jest.fn();
    const loggerWarn = jest.fn();
    const handleDeepLinkSpy = jest.fn();
    const showMainWindowSpy = jest.fn();

    const secondInstanceHandler = createSecondInstanceHandler({
      logger: { info: loggerInfo, warn: loggerWarn },
      getPlatform: () => 'win32',
      getSafelyMainWindow: () => ({
        isMinimized: () => false,
        restore: jest.fn(),
      }),
      showMainWindow: showMainWindowSpy,
      handleDeepLinkUrl: handleDeepLinkSpy,
    });
    const handleDeepLinkUrl = createDeepLinkHandler({
      logger: { info: loggerInfo, warn: loggerWarn },
      getSafelyMainWindow: () => ({
        webContents: { send: jest.fn() },
      }),
      showMainWindow: showMainWindowSpy,
      getIsAppReady: () => false,
      setAppReady: jest.fn(),
      hasMainWindow: () => false,
      emitter: { once: jest.fn() },
    });

    // eslint-disable-next-line @cspell/spellchecker
    const sensitiveUrl =
      'wc:eb16df1f-1d3b-4018-9d18-28ef610cc1a4@2?relay-protocol=irn&symKey=secretSymKey123';
    const argv = ['OneKey.exe', '--', sensitiveUrl];
    secondInstanceHandler(null, argv);

    expect(loggerInfo).toHaveBeenCalledWith(
      'Second instance launched, focusing existing window',
      {
        platform: 'win32',
        hasDeepLink: true,
      },
    );
    expect(JSON.stringify(loggerInfo.mock.calls)).not.toContain(
      'secretSymKey123',
    );
    expect(handleDeepLinkSpy).toHaveBeenCalledWith(
      null,
      sensitiveUrl,
      argv,
      false,
    );

    handleDeepLinkUrl(null, `${sensitiveUrl}" --gpu-launcher=calc`);
    expect(loggerWarn).toHaveBeenCalledWith(
      '[DeepLink] Rejected URL with unknown or unsafe scheme',
    );
    expect(JSON.stringify(loggerWarn.mock.calls)).not.toContain(
      'secretSymKey123',
    );
  });

  test('registers and cleans up protocol handlers with "--" "%1" in Windows NSIS installer scripts', () => {
    const installerScripts = [
      path.resolve(__dirname, '../../build/installer.nsh'),
      path.resolve(__dirname, '../../resources/windows/installer.nsh'),
    ];
    for (const scriptPath of installerScripts) {
      const content = fs.readFileSync(scriptPath, 'utf8');
      expect(content).toContain(
        // eslint-disable-next-line no-template-curly-in-string
        'WriteRegStr SHELL_CONTEXT "Software\\Classes\\${SCHEME}\\shell\\open\\command" "" \'"$appExe" "--" "%1"\'',
      );
      expect(content).toContain(
        // eslint-disable-next-line no-template-curly-in-string
        '!insertmacro OneKeyUnregisterProtocolIfOwned HKCU "${SCHEME}"',
      );
      for (const scheme of DESKTOP_DEEP_LINK_PROTOCOLS) {
        expect(content).toContain(
          `!insertmacro OneKeyRegisterProtocolScheme "${scheme}"`,
        );
        expect(content).toContain(
          `!insertmacro OneKeyUnregisterProtocolIfOwned SHELL_CONTEXT "${scheme}"`,
        );
        expect(content).toContain(
          `!insertmacro OneKeyUnregisterProtocolIfOwned HKCU "${scheme}"`,
        );
      }
    }
  });
});
