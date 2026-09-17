import { findAllowedDeepLinkArg, isAllowedDeepLinkUrl } from './deepLink';

describe('desktop deep link arguments', () => {
  test('finds the URL after Electron command-line switches', () => {
    expect(
      findAllowedDeepLinkArg([
        'OneKey.exe',
        '--allow-file-access-from-files',
        'onekey-wallet://search/list?q=onekey',
      ]),
    ).toBe('onekey-wallet://search/list?q=onekey');
  });

  test.each([
    'onekey-wallet://search/list?q=onekey',
    'wc://pairing',
    'ethereum:0x0000000000000000000000000000000000000000',
  ])('allows a registered deep link scheme: %s', (url) => {
    expect(isAllowedDeepLinkUrl(url)).toBe(true);
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
