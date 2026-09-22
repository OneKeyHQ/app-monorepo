/**
 * `prewarmHomeTokenListOwner` (OK-63873): the selector-side prewarm that puts
 * an owner's local-cache frames into the main-heap replay cache before the
 * account switch. Pins the paths that must not cost a background round trip
 * (All Networks, whose merge the UI owns; a re-request for an owner the replay
 * cache already holds, i.e. the tap after the open-selector prewarm) and the
 * bookkeeping of a successful prewarm (frames + header worth remembered).
 */
import { getOwnerWorth } from '@onekeyhq/kit/src/views/Home/components/TokenListBlock/ownerWorthCache';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import {
  clearOwnerReplayCache,
  getOwnerReplayFrames,
} from '../cells/ownerFrameReplayCache';
import { prewarmHomeTokenListOwner } from '../cells/prewarmOwnerFrames';

import type { IPrewarmHomeTokenListOwnerParams } from '../cells/prewarmOwnerFrames';

const mockPrewarmFrames: jest.Mock<Promise<unknown>, unknown[]> = jest.fn();
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceTokenViewModel: {
      prewarmHomeTokenListFrames: (...args: unknown[]) =>
        mockPrewarmFrames(...args),
    },
  },
}));

// Keep the per-owner worth namespace off real storage.
const mockWorthRecords = new Map<string, Record<string, unknown>>();
jest.mock('@onekeyhq/shared/src/storage/uiSnapshotCaches', () => {
  const actual = jest.requireActual(
    '@onekeyhq/shared/src/storage/uiSnapshotCaches',
  ) as Record<string, unknown>;
  return {
    ...actual,
    tokenListOwnerWorthCache: {
      get: (key: string) => {
        const data = mockWorthRecords.get(key);
        return data ? { data, updatedAt: 0 } : undefined;
      },
      set: (key: string, data: Record<string, unknown>) => {
        mockWorthRecords.set(key, data);
      },
      setMany: () => undefined,
      touch: () => undefined,
      remove: (key: string) => mockWorthRecords.delete(key),
      keys: () => Array.from(mockWorthRecords.keys()),
      sweep: () => undefined,
      clear: () => mockWorthRecords.clear(),
    },
  };
});

const STORE_NAME = EJotaiContextStoreNames.homeTokenList;
const NETWORK_ID = 'evm--56';
const ACCOUNT_ID = 'hd-1--m/44/60/0/0/0';
const OWNER_KEY = `${ACCOUNT_ID}__${NETWORK_ID}`;
const PARAMS: IPrewarmHomeTokenListOwnerParams = {
  networkId: NETWORK_ID,
  deriveType: 'default',
  indexedAccountId: 'hd-1--0',
};

function makeBgResult(
  overrides: Partial<{
    worth: { accountId: string; value: string; currency: string };
  }> = {},
) {
  return {
    ownerKey: OWNER_KEY,
    currency: 'usd',
    frames: {
      ownerKey: OWNER_KEY,
      structureVersion: 0,
      valuationVersion: 0,
      structure: {
        orderedIds: ['a'],
        smallBalanceIds: [],
        nonZeroIds: ['a'],
        fundedIds: ['a'],
        metaPatch: {},
        aggMembership: {},
        smallBalanceFiatValue: '0',
        ownedAggregateTokenListMap: {},
        storeData: { storeName: STORE_NAME },
        ownerKey: OWNER_KEY,
        generation: 0,
      },
      valuation: undefined,
      riskyVersion: -1,
      riskyTokens: [],
      riskyMap: {},
    },
    ...overrides,
  };
}

beforeEach(() => {
  clearOwnerReplayCache();
  mockWorthRecords.clear();
  mockPrewarmFrames.mockReset();
});

describe('prewarmHomeTokenListOwner', () => {
  it('never asks the background for All Networks (the UI owns that merge)', async () => {
    await expect(
      prewarmHomeTokenListOwner({ ...PARAMS, networkId: 'onekeyall--0' }),
    ).resolves.toBe(false);
    expect(mockPrewarmFrames).not.toHaveBeenCalled();
  });

  it('remembers the returned frames and header worth for the owner', async () => {
    mockPrewarmFrames.mockResolvedValue(
      makeBgResult({
        worth: { accountId: ACCOUNT_ID, value: '12.5', currency: 'usd' },
      }),
    );
    await expect(prewarmHomeTokenListOwner(PARAMS)).resolves.toBe(true);
    expect(mockPrewarmFrames).toHaveBeenCalledTimes(1);
    const frames = getOwnerReplayFrames({
      storeName: STORE_NAME,
      ownerKey: OWNER_KEY,
    });
    expect(frames?.currencyId).toBe('usd');
    expect(frames?.structure?.structure.orderedIds).toEqual(['a']);
    expect(getOwnerWorth(OWNER_KEY)).toEqual({
      worth: { [`${ACCOUNT_ID}_${NETWORK_ID}`]: '12.5' },
      createAtNetworkWorth: '12.5',
      currency: 'usd',
    });
  });

  it('a re-request for an owner the replay cache holds resolves without a round trip (the tap after the open-selector prewarm)', async () => {
    mockPrewarmFrames.mockResolvedValue(makeBgResult());
    await prewarmHomeTokenListOwner(PARAMS);
    await expect(prewarmHomeTokenListOwner(PARAMS)).resolves.toBe(true);
    expect(mockPrewarmFrames).toHaveBeenCalledTimes(1);
  });

  it('goes back to the background once the replay cache dropped the owner (wallet / account removal)', async () => {
    mockPrewarmFrames.mockResolvedValue(makeBgResult());
    await prewarmHomeTokenListOwner(PARAMS);
    clearOwnerReplayCache();
    await expect(prewarmHomeTokenListOwner(PARAMS)).resolves.toBe(true);
    expect(mockPrewarmFrames).toHaveBeenCalledTimes(2);
  });

  it('shares one in-flight request per params', async () => {
    mockPrewarmFrames.mockResolvedValue(makeBgResult());
    const [first, second] = await Promise.all([
      prewarmHomeTokenListOwner(PARAMS),
      prewarmHomeTokenListOwner(PARAMS),
    ]);
    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(mockPrewarmFrames).toHaveBeenCalledTimes(1);
  });

  it('reports false and remembers nothing when the background has no frames, and never throws', async () => {
    mockPrewarmFrames.mockResolvedValue(undefined);
    await expect(prewarmHomeTokenListOwner(PARAMS)).resolves.toBe(false);
    expect(
      getOwnerReplayFrames({ storeName: STORE_NAME, ownerKey: OWNER_KEY }),
    ).toBeUndefined();

    mockPrewarmFrames.mockRejectedValue(new Error('bridge down'));
    await expect(prewarmHomeTokenListOwner(PARAMS)).resolves.toBe(false);
  });
});
