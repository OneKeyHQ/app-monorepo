import fs from 'fs';
import path from 'path';
import vm from 'vm';

import ts from 'typescript';

import {
  DESKTOP_DEEP_LINK_PROTOCOLS,
  ETHEREUM_DEEP_LINK_NAME,
  findAllowedDeepLinkArg,
  getDesktopProtocolClientArgs,
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

  test('rejects deep link URLs containing ASCII control characters', () => {
    expect(isAllowedDeepLinkUrl('onekey-wallet://normal\u0000null')).toBe(
      false,
    );
    expect(isAllowedDeepLinkUrl('onekey-wallet://normal\r\nheader')).toBe(
      false,
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

  test('gates isDev, isPerfCiMode, isDevServer, and isLocalUnpacked on !app.isPackaged even when ELECTRON_IS_DEV=1', () => {
    const runtimeFlagsDeclarationCode = getAppTopLevelStatementSource((text) =>
      text.includes('resolveDesktopRuntimeFlags'),
    );

    const packagedResult = vm.runInNewContext(
      `(() => { ${runtimeFlagsDeclarationCode}\nreturn { isDev, isPerfCiMode, isDevServer, isLocalUnpacked }; })()`,
      {
        resolveDesktopRuntimeFlags,
        app: { isPackaged: true },
        electronIsDev: true,
        process: {
          env: {
            ELECTRON_IS_DEV: '1',
            PERF_CI_MODE: '1',
          },
        },
      },
    ) as ReturnType<typeof resolveDesktopRuntimeFlags>;

    expect(packagedResult).toEqual({
      isDev: false,
      isPerfCiMode: false,
      isDevServer: false,
      isLocalUnpacked: false,
    });

    expect(
      resolveDesktopRuntimeFlags({
        isPackaged: true,
        env: {
          ELECTRON_IS_DEV: '1',
          PERF_CI_MODE: '1',
        },
      }),
    ).toEqual({
      isDev: false,
      isPerfCiMode: false,
      isDevServer: false,
      isLocalUnpacked: false,
    });

    expect(
      resolveDesktopRuntimeFlags({
        isPackaged: false,
        electronIsDev: true,
        env: {},
      }),
    ).toEqual({
      isDev: true,
      isPerfCiMode: false,
      isDevServer: true,
      isLocalUnpacked: true,
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
    });
  });
});
