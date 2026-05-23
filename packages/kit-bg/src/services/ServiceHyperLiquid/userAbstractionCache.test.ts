import type { IHex } from '@onekeyhq/shared/types/hyperliquid/sdk';

import {
  createFetchUserAbstractionRawWithCache,
  invalidateUserAbstractionRawCache,
} from './userAbstractionCache';

describe('userAbstraction raw cache', () => {
  it('dedupes in-flight requests by lowercase account address', async () => {
    const fetchRaw = jest.fn(
      async (accountAddress: IHex) => `mode:${accountAddress}`,
    );
    const fetchWithCache = createFetchUserAbstractionRawWithCache(fetchRaw);

    await expect(
      Promise.all([
        fetchWithCache({ accountAddress: '0xAbC' as IHex }),
        fetchWithCache({ accountAddress: '0xabc' as IHex }),
        fetchWithCache({ accountAddress: '0xABC' as IHex }),
      ]),
    ).resolves.toEqual(['mode:0xabc', 'mode:0xabc', 'mode:0xabc']);
    expect(fetchRaw).toHaveBeenCalledTimes(1);
    expect(fetchRaw).toHaveBeenCalledWith('0xabc');
  });

  it('does not cache empty raw responses', async () => {
    const fetchRaw = jest
      .fn<Promise<string | undefined>, [IHex]>()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce('unifiedAccount');
    const fetchWithCache = createFetchUserAbstractionRawWithCache(fetchRaw);

    await expect(
      fetchWithCache({ accountAddress: '0xabc' as IHex }),
    ).resolves.toBeUndefined();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await expect(
      fetchWithCache({ accountAddress: '0xabc' as IHex }),
    ).resolves.toBe('unifiedAccount');
    expect(fetchRaw).toHaveBeenCalledTimes(2);
  });

  it('invalidates by lowercase account address', async () => {
    const fetchRaw = jest
      .fn<Promise<string>, [IHex]>()
      .mockResolvedValueOnce('before')
      .mockResolvedValueOnce('after');
    const fetchWithCache = createFetchUserAbstractionRawWithCache(fetchRaw);

    await expect(
      fetchWithCache({ accountAddress: '0xabc' as IHex }),
    ).resolves.toBe('before');
    invalidateUserAbstractionRawCache(fetchWithCache, '0xABC' as IHex);
    await expect(
      fetchWithCache({ accountAddress: '0xabc' as IHex }),
    ).resolves.toBe('after');
    expect(fetchRaw).toHaveBeenCalledTimes(2);
  });
});
