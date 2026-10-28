import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { shouldHideWebViewHeaderRight } from '../webViewHeaderPolicy';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false, isDesktop: false },
}));

describe.each([
  { platform: 'Android', isNative: true, isDesktop: false, autoHide: true },
  { platform: 'iOS', isNative: true, isDesktop: false, autoHide: true },
  { platform: 'Electron', isNative: false, isDesktop: true, autoHide: true },
  { platform: 'Web', isNative: false, isDesktop: false, autoHide: false },
  { platform: 'Extension', isNative: false, isDesktop: false, autoHide: false },
])('$platform WebView menu', ({ isNative, isDesktop, autoHide }) => {
  beforeEach(() => {
    Object.assign(platformEnv, { isNative, isDesktop });
  });

  test.each([
    'file:///android_asset/web-embed/index.html',
    'file:///app/bundle/index.html#/prime/purchase',
    'web-embed/index.html',
    'data:text/html,<html><body>Internal page</body></html>',
    'about:blank',
    '',
  ])('applies the platform rule to a non-HTTP(S) source: %s', (url) => {
    expect(shouldHideWebViewHeaderRight({ url })).toBe(autoHide);
  });

  test.each([
    'https://onekey.so',
    'http://onekey.so',
    'https:example.com',
    'HTTP://LOCALHOST:3008/index.html',
    '  https://example.com/page?next=file:///app/index.html  ',
  ])('keeps a normal HTTP(S) page menu: %s', (url) => {
    expect(shouldHideWebViewHeaderRight({ url })).toBe(false);
  });

  test.each([
    '',
    'http://localhost:3008/index.html',
    'https://dev.example.com',
  ])(
    'recognizes an explicit embedded route, including dev-server mode: %s',
    (url) => {
      expect(shouldHideWebViewHeaderRight({ url, isWebEmbed: true })).toBe(
        autoHide,
      );
    },
  );

  test('preserves the existing explicit hide option on every platform', () => {
    expect(
      shouldHideWebViewHeaderRight({
        url: 'https://onekey.so',
        hideHeaderRight: true,
      }),
    ).toBe(true);
  });
});
