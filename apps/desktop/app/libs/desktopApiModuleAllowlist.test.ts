import {
  DESKTOP_API_ALLOWED_MODULES,
  isDesktopApiMethodAllowed,
  isDesktopApiModuleAllowed,
  isTrustedMainWindowUrl,
} from './desktopApiModuleAllowlist';

describe('selected desktop app shell URL', () => {
  it.each([
    ['http://localhost:3001/', 'http://localhost:3001/market'],
    [
      'http://localhost:3001/',
      'http://localhost:3001/market/stock/JNJ?stockPreviewSymbol=JNJ',
    ],
    ['http://127.0.0.1:3001/', 'http://127.0.0.1:3001/swap'],
    ['http://[::1]:3001/', 'http://[::1]:3001/market'],
    ['https://localhost:3001/', 'https://localhost:3001/market'],
  ])(
    'allows local dev-server routes only in development',
    (selected, frame) => {
      expect(isTrustedMainWindowUrl(selected, frame, undefined, true)).toBe(
        true,
      );
      expect(isTrustedMainWindowUrl(selected, frame, undefined, false)).toBe(
        false,
      );
    },
  );

  it.each([
    ['http://localhost:3001/', 'http://localhost:3002/market'],
    ['http://localhost:3001/', 'https://localhost:3001/market'],
    ['http://localhost:3001/', 'http://127.0.0.1:3001/market'],
    ['http://localhost:3001/', 'http://localhost.evil.example:3001/market'],
    ['http://localhost:3001/', 'https://evil.example/market'],
    ['https://app.onekey.so/', 'https://app.onekey.so/market'],
    ['file:///opt/onekey/index.html', 'file:///opt/other/index.html'],
    ['http://localhost:3001/', 'not a URL'],
  ])(
    'keeps dev-server trust scoped to the selected local origin',
    (selected, frame) => {
      expect(isTrustedMainWindowUrl(selected, frame, undefined, true)).toBe(
        false,
      );
    },
  );

  it.each([
    [
      'file:///opt/onekey/index.html',
      'file:///opt/onekey/index.html#/home',
      true,
    ],
    ['file:///index.html', 'file:///index.html#/home', true],
    ['file:///opt/onekey/index.html', 'file:///opt/other/index.html', false],
    [
      'file:///opt/onekey/ota/index.html',
      'file:///opt/onekey/index.html',
      false,
    ],
    [
      'https://localhost:3001/?build=one',
      'https://localhost:3001/?build=one#/home',
      true,
    ],
    [
      'https://localhost:3001/?build=one',
      'https://localhost:3001/?build=two',
      false,
    ],
    ['https://localhost:3001/', 'https://evil.example/', false],
    ['file:///index.html', '', false],
    ['file:///index.html', 'not a URL', false],
  ])(
    'matches only the selected URL apart from its route hash',
    (selected, frame, expected) => {
      expect(isTrustedMainWindowUrl(selected, frame)).toBe(expected);
    },
  );

  it('accepts a recorded same-document pathname without accepting a different document', () => {
    const selected = 'file:///opt/onekey/index.html';
    const route = 'file:///market/stock/JNJ';
    expect(isTrustedMainWindowUrl(selected, route)).toBe(false);
    expect(isTrustedMainWindowUrl(selected, route, route)).toBe(true);
    expect(
      isTrustedMainWindowUrl(selected, 'file:///opt/other/index.html', route),
    ).toBe(false);
  });
});

describe('desktop API module allowlist', () => {
  it('allows the firmware artifact module required by desktop upgrades', () => {
    expect(DESKTOP_API_ALLOWED_MODULES).toContain('firmwareArtifact');
    expect(isDesktopApiModuleAllowed('firmwareArtifact')).toBe(true);
  });

  it('rejects modules outside the explicit allowlist', () => {
    expect(isDesktopApiModuleAllowed('__proto__')).toBe(false);
  });

  it.each([
    'getCapabilities',
    'download',
    'cancelDownloads',
    'materialize',
    'open',
    'read',
    'close',
    'createLease',
    'retain',
    'releaseLease',
    'sweepOrphans',
  ])('allows firmwareArtifact.%s', (method) => {
    expect(isDesktopApiMethodAllowed('firmwareArtifact', method)).toBe(true);
  });

  it.each([
    'validateDownloadInput',
    'downloadLocked',
    'streamResponseToFile',
    'writeResponseBody',
    'promoteArtifact',
    'resolveArtifactPath',
    '__proto__',
    'constructor',
  ])('rejects firmwareArtifact.%s', (method) => {
    expect(isDesktopApiMethodAllowed('firmwareArtifact', method)).toBe(false);
  });

  it('uses generated public visibility for existing modules', () => {
    expect(isDesktopApiMethodAllowed('system', 'getSystemInfo')).toBe(true);
    expect(isDesktopApiMethodAllowed('system', '_privateMethod')).toBe(false);
  });

  it.each([
    'launchWindowsInstaller',
    'stageMacUpdate',
    'installAppImage',
    'writeRecord',
    'installPackageLocked',
    'getMainWindow',
    'constructor',
    'toString',
  ])('rejects appUpdate.%s', (method) => {
    expect(isDesktopApiMethodAllowed('appUpdate', method)).toBe(false);
  });

  it('allows the verified installation entry point and denies unknown module metadata', () => {
    expect(isDesktopApiMethodAllowed('appUpdate', 'installPackage')).toBe(true);
    expect(isDesktopApiMethodAllowed('unknownModule', 'installPackage')).toBe(
      false,
    );
    expect(isDesktopApiMethodAllowed('__proto__', 'toString')).toBe(false);
  });

  it.each([
    'revenueCatIsAvailable',
    'revenueCatConfigure',
    'revenueCatSupportsVerifiedIdentity',
    'revenueCatLogInWithVerifiedSession',
    'revenueCatLogOut',
    'revenueCatGetAppUserId',
    'revenueCatGetCustomerInfo',
    'revenueCatGetOfferings',
    'revenueCatPurchasePackage',
    'revenueCatRestorePurchases',
    'revenueCatCheckTrialOrIntroductoryPriceEligibility',
    'revenueCatSetAttributes',
  ])('allows inAppPurchase.%s', (method) => {
    expect(isDesktopApiMethodAllowed('inAppPurchase', method)).toBe(true);
  });

  it.each([
    'invoke',
    'revenueCatLogIn',
    'getNativeModule',
    'loadNativeModule',
    'validateRequest',
    '_privateMethod',
    '__proto__',
    'constructor',
    'toString',
    undefined,
    42,
  ])('rejects unlisted inAppPurchase method %s', (method) => {
    expect(isDesktopApiMethodAllowed('inAppPurchase', method)).toBe(false);
  });
});
