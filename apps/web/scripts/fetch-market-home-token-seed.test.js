const fs = require('fs');
const path = require('path');

const {
  createSeedUrl,
  fetchJson,
  readAppVersion,
} = require('./fetch-market-home-token-seed');

describe('fetch-market-home-token-seed', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('fetches the default Trending order without explicit sorting', () => {
    const url = new URL(createSeedUrl('https://utility.example.test'));
    expect(url.pathname).toBe('/utility/v2/market/token/list');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      networkId: '',
      page: '1',
      limit: '20',
      minLiquidity: '5000',
      type: 'trending',
      timeFrame: '2',
      currency: 'usd',
    });
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
    globalThis.fetch = jest.fn().mockResolvedValue({
      body: undefined,
      headers: {
        get: () => null,
      },
      ok: true,
      text: async () => '{"data":{"list":[]}}',
    });

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
});
