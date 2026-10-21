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

  test('reads the app version from .env.version', () => {
    const envVersionFile = path.resolve(__dirname, '../../..', '.env.version');
    const expectedVersion = fs
      .readFileSync(envVersionFile, 'utf8')
      .match(/^VERSION=(.+)$/m)?.[1]
      ?.trim();

    expect(readAppVersion()).toBe(expectedVersion);
  });

  test('requests the same API default order as the initial trending list', () => {
    const url = new URL(createSeedUrl('https://utility.example.test'));

    expect(url.pathname).toBe('/utility/v2/market/token/list');
    expect(url.searchParams.get('type')).toBe('trending');
    expect(url.searchParams.get('timeFrame')).toBe('2');
    expect(url.searchParams.has('sortBy')).toBe(false);
    expect(url.searchParams.has('sortType')).toBe(false);
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
