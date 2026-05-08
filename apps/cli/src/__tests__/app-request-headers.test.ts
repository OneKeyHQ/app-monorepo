describe('CLI App request headers', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...originalEnv,
      ONEKEY_APP_VERSION: '6.3.0',
      ONEKEY_APP_BUILD_NUMBER: '2026043075',
      ONEKEY_APP_BUNDLE_VERSION: '10299191',
      ONEKEY_INSTANCE_ID: '45304ac0-2271-4b57-b7d8-ba111a627a6d',
      ONEKEY_REQUEST_PLATFORM_NAME: 'MacBook Pro (14-inch, M4 Max, 2024)',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('matches the OneKey Desktop App identity headers used by swap requests', async () => {
    const { buildCliAppRequestHeaders } =
      await import('../infra/app-request-headers');

    const headers = buildCliAppRequestHeaders();

    expect(headers).toMatchObject({
      'user-agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) OneKeyWallet/6.3.0 Chrome/142.0.7444.265 Electron/39.8.9 Safari/537.36',
      'x-onekey-hide-asset-details': 'false',
      'x-onekey-instance-id': '45304ac0-2271-4b57-b7d8-ba111a627a6d',
      'x-onekey-request-build-number': '2026043075',
      'x-onekey-request-currency': 'usd',
      'x-onekey-request-device-name': 'OneKey Desktop',
      'x-onekey-request-jsbundle-version': '10299191',
      'x-onekey-request-locale': 'zh-cn',
      'x-onekey-request-platform': 'desktop-macosStore',
      'x-onekey-request-platform-name': 'MacBook Pro (14-inch, M4 Max, 2024)',
      'x-onekey-request-theme': 'light',
      'x-onekey-request-version': '6.3.0',
      'x-onekey-wallet-type': 'hd',
      'x-requested-with': 'XMLHttpRequest',
    });
    expect(headers['x-amzn-trace-id']).toBe(headers['x-onekey-request-id']);
    expect(headers['x-onekey-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });
});
