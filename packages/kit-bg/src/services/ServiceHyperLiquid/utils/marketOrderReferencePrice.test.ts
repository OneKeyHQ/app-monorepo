import { resolveMarketOrderReferencePrice } from './marketOrderReferencePrice';

const nowMs = 10_000;

describe('resolveMarketOrderReferencePrice', () => {
  it('uses a fresh cached price without loading another snapshot', async () => {
    let loadCount = 0;
    const result = await resolveMarketOrderReferencePrice({
      coin: 'xyz:NVDA',
      cachedAllMids: { mids: { 'xyz:NVDA': '213.63' } },
      cachedAt: nowMs - 100,
      nowMs,
      loadAllMids: async () => {
        loadCount += 1;
        return { 'xyz:NVDA': '214.00' };
      },
    });

    expect(result).toBe('213.63');
    expect(loadCount).toBe(0);
  });

  it('loads a fresh snapshot when the cached price is stale', async () => {
    let loadCount = 0;
    const result = await resolveMarketOrderReferencePrice({
      coin: 'xyz:NVDA',
      cachedAllMids: { mids: { 'xyz:NVDA': '200.00' } },
      cachedAt: nowMs - 5001,
      nowMs,
      loadAllMids: async () => {
        loadCount += 1;
        return { 'xyz:NVDA': '213.63' };
      },
    });

    expect(result).toBe('213.63');
    expect(loadCount).toBe(1);
  });

  it('loads a fresh snapshot when no background price is cached', async () => {
    const result = await resolveMarketOrderReferencePrice({
      coin: 'xyz:NVDA',
      cachedAllMids: undefined,
      cachedAt: 0,
      nowMs,
      loadAllMids: async () => ({ 'xyz:NVDA': '213.63' }),
    });

    expect(result).toBe('213.63');
  });

  it('queries the coin dex when a fresh cache lacks a sub-dex price', async () => {
    const requestedDexes: string[] = [];
    const result = await resolveMarketOrderReferencePrice({
      coin: 'xyz:NVDA',
      cachedAllMids: { mids: { BTC: '65000' } },
      cachedAt: nowMs - 100,
      nowMs,
      loadAllMids: async (dex) => {
        requestedDexes.push(dex);
        return { 'xyz:NVDA': '213.63' };
      },
    });

    expect(result).toBe('213.63');
    expect(requestedDexes).toEqual(['xyz']);
  });

  it('queries the main dex with an empty dex name', async () => {
    const requestedDexes: string[] = [];
    await resolveMarketOrderReferencePrice({
      coin: 'BTC',
      cachedAllMids: undefined,
      cachedAt: 0,
      nowMs,
      loadAllMids: async (dex) => {
        requestedDexes.push(dex);
        return { BTC: '65000' };
      },
    });

    expect(requestedDexes).toEqual(['']);
  });

  it('rejects a missing or invalid coin price from a fresh snapshot', async () => {
    await expect(
      resolveMarketOrderReferencePrice({
        coin: 'xyz:NVDA',
        cachedAllMids: undefined,
        cachedAt: 0,
        nowMs,
        loadAllMids: async () => ({ 'xyz:NVDA': '0' }),
      }),
    ).resolves.toBeUndefined();
  });
});
