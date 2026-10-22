const fs = require('fs');
const path = require('path');

const { fetchJson, readAppVersion } = require('./fetch-market-home-token-seed');

describe('fetch-market-home-token-seed', () => {
  const originalFetch = globalThis.fetch;
  const originalAutomationToken = process.env.ONEKEY_AUTOMATION_TOKEN;

  beforeEach(() => {
    delete process.env.ONEKEY_AUTOMATION_TOKEN;
    globalThis.fetch = jest.fn().mockResolvedValue({
      body: undefined,
      headers: {
        get: () => null,
      },
      ok: true,
      text: async () => '{"data":{"list":[]}}',
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalAutomationToken === undefined) {
      delete process.env.ONEKEY_AUTOMATION_TOKEN;
    } else {
      process.env.ONEKEY_AUTOMATION_TOKEN = originalAutomationToken;
    }
  });

  test('reads the app version from .env.version', () => {
    const envVersionFile = path.resolve(__dirname, '../../..', '.env.version');
    const expectedVersion = fs
      .readFileSync(envVersionFile, 'utf8')
      .match(/^VERSION=(.+)$/m)?.[1]
      ?.trim();

    expect(readAppVersion()).toBe(expectedVersion);
  });

  test('sends the app version header when fetching the seed', async () => {
    await expect(fetchJson('https://utility.example.test')).resolves.toEqual({
      data: { list: [] },
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://utility.example.test',
      expect.objectContaining({
        headers: {
          Accept: 'application/json',
          'X-Onekey-Request-Version': readAppVersion(),
        },
      }),
    );
  });

  test('sends the automation token only with redirect rejection', async () => {
    process.env.ONEKEY_AUTOMATION_TOKEN = ' build-only-test-token ';
    const url =
      'https://utility.onekeycn.com/utility/v2/market/token/list?limit=20';

    await expect(fetchJson(url)).resolves.toEqual({ data: { list: [] } });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        headers: {
          Accept: 'application/json',
          'X-Onekey-Request-Version': readAppVersion(),
          'X-Onekey-Automation-Token': 'build-only-test-token',
        },
        redirect: 'error',
      }),
    );
  });

  test.each([
    'http://utility.onekeycn.com/utility/v2/market/token/list',
    'https://utility.onekeycn.com:8443/utility/v2/market/token/list',
    'https://utility.onekeytest.com/utility/v2/market/token/list',
    'https://strapi.onekeycn.com/graphql',
    'https://evil-utility.onekeycn.com/',
    'https://utility.onekeycn.com.evil.test/',
    'https://utility.onekeycn.com@evil.test/',
    'http://127.0.0.1:3000/seed',
  ])('keeps the automation token off %s', async (url) => {
    process.env.ONEKEY_AUTOMATION_TOKEN = 'build-only-test-token';

    await fetchJson(url);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        headers: {
          Accept: 'application/json',
          'X-Onekey-Request-Version': readAppVersion(),
        },
      }),
    );
    expect(globalThis.fetch.mock.calls[0][1]).not.toHaveProperty('redirect');
  });

  test.each([undefined, '  '])(
    'preserves unauthenticated requests when the token is %s',
    async (token) => {
      if (token !== undefined) {
        process.env.ONEKEY_AUTOMATION_TOKEN = token;
      }
      const url = 'https://utility.onekeycn.com/utility/v2/market/token/list';

      await fetchJson(url);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        url,
        expect.objectContaining({
          headers: {
            Accept: 'application/json',
            'X-Onekey-Request-Version': readAppVersion(),
          },
        }),
      );
      expect(globalThis.fetch.mock.calls[0][1]).not.toHaveProperty('redirect');
    },
  );
});
