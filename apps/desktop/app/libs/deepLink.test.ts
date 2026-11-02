/* cspell:ignore insertmacro HKCU */
import fs from 'fs';
import path from 'path';
import vm from 'vm';

import ts from 'typescript';

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

const appSource = ts.createSourceFile(
  'app.ts',
  fs.readFileSync(path.resolve(__dirname, '../app.ts'), 'utf8'),
  ts.ScriptTarget.Latest,
  true,
);

function getAppTopLevelStatementSource(predicate: (text: string) => boolean) {
  const statement = appSource.statements.find(
    (node) =>
      !ts.isImportDeclaration(node) && predicate(node.getText(appSource)),
  );
  expect(statement).toBeDefined();
  return ts
    .transpileModule(statement?.getText(appSource) ?? '', {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    })
    .outputText.trim();
}

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

    const protocolRegistrationCode = getAppTopLevelStatementSource(
      (text) =>
        text.includes('getDesktopProtocolClientArgs') &&
        text.includes('setAsDefaultProtocolClient'),
    );

    const isDefaultProtocolClient = jest.fn(() => false);
    const setAsDefaultProtocolClient = jest.fn(() => true);
    vm.runInNewContext(protocolRegistrationCode, {
      DESKTOP_DEEP_LINK_PROTOCOLS,
      getDesktopProtocolClientArgs,
      process: {
        defaultApp: false,
        execPath: 'C:\\Program Files\\OneKey\\OneKey.exe',
        argv: ['C:\\Program Files\\OneKey\\OneKey.exe'],
      },
      app: {
        isDefaultProtocolClient,
        setAsDefaultProtocolClient,
      },
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
    const runtimeFlagsDeclarationCode = getAppTopLevelStatementSource((text) =>
      text.includes('resolveDesktopRuntimeFlags'),
    );

    const packagedResult = vm.runInNewContext(
      `(() => { ${runtimeFlagsDeclarationCode}\nreturn { isDev, isPerfCiMode, isDevServer, isLocalUnpacked, isDesktopE2EMode }; })()`,
      {
        resolveDesktopRuntimeFlags,
        app: { isPackaged: true },
        electronIsDev: true,
        process: {
          env: {
            ELECTRON_IS_DEV: '1',
            PERF_CI_MODE: '1',
            DESKTOP_E2E_MODE: 'true',
          },
        },
      },
    ) as ReturnType<typeof resolveDesktopRuntimeFlags>;

    expect(packagedResult).toEqual({
      isDev: false,
      isPerfCiMode: false,
      isDevServer: false,
      isLocalUnpacked: false,
      isDesktopE2EMode: false,
    });

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
    const handleDeepLinkCode = getAppTopLevelStatementSource((text) =>
      text.startsWith('function handleDeepLinkUrl('),
    );
    const secondInstanceBlockCode = getAppTopLevelStatementSource((text) =>
      text.includes("app.on('second-instance'"),
    );

    const loggerInfo = jest.fn();
    const loggerWarn = jest.fn();
    const handleDeepLinkSpy = jest.fn();
    const showMainWindowSpy = jest.fn();
    let secondInstanceHandler: ((e: unknown, argv: string[]) => void) | null =
      null;

    const context = {
      singleInstance: true,
      process: {
        mas: false,
        platform: 'win32',
      },
      logger: {
        info: loggerInfo,
        warn: loggerWarn,
      },
      app: {
        quit: jest.fn(),
        on: jest.fn(
          (event: string, cb: (e: unknown, argv: string[]) => void) => {
            if (event === 'second-instance') {
              secondInstanceHandler = cb;
            }
          },
        ),
      },
      findAllowedDeepLinkArg,
      isAllowedDeepLinkUrl,
      getSafelyMainWindow: () => ({
        isMinimized: () => false,
        restore: jest.fn(),
      }),
      handleDeepLinkUrl: handleDeepLinkSpy,
      showMainWindow: showMainWindowSpy,
      emitter: { once: jest.fn() },
      isAppReady: false,
      mainWindow: null,
    };

    vm.runInNewContext(secondInstanceBlockCode, context);
    expect(secondInstanceHandler).not.toBeNull();

    // eslint-disable-next-line @cspell/spellchecker
    const sensitiveUrl =
      'wc:eb16df1f-1d3b-4018-9d18-28ef610cc1a4@2?relay-protocol=irn&symKey=secretSymKey123';
    const argv = ['OneKey.exe', '--', sensitiveUrl];
    secondInstanceHandler!(null, argv);

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

    vm.runInNewContext(
      `${handleDeepLinkCode}\nhandleDeepLinkUrl(null, ${JSON.stringify(
        `${sensitiveUrl}" --gpu-launcher=calc`,
      )});`,
      context,
    );
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
        'DeleteRegKey SHELL_CONTEXT "Software\\Classes\\onekey-wallet"',
      );
      expect(content).toContain(
        'DeleteRegKey HKCU "Software\\Classes\\onekey-wallet"',
      );
      for (const scheme of DESKTOP_DEEP_LINK_PROTOCOLS) {
        expect(content).toContain(
          `!insertmacro OneKeyRegisterProtocolScheme "${scheme}"`,
        );
      }
      for (const sharedScheme of ['wc', 'ethereum']) {
        expect(content).toContain(
          `!insertmacro OneKeyUnregisterSharedProtocolIfOwned SHELL_CONTEXT "${sharedScheme}"`,
        );
        expect(content).toContain(
          `!insertmacro OneKeyUnregisterSharedProtocolIfOwned HKCU "${sharedScheme}"`,
        );
      }
    }
  });
});
