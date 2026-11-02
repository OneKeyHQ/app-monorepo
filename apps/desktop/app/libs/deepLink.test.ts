import path from 'path';

import {
  findAllowedDeepLinkArg,
  getDesktopProtocolClientArgs,
  isAllowedDeepLinkUrl,
} from './deepLink';

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
});
