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
import {
  buildAccountSelectorRowPrewarmParams,
  prewarmHomeTokenListOwner,
} from '../cells/prewarmOwnerFrames';

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

  // PR #13695 review: the replay rejects frames remembered in another
  // currency, so a short-circuit on "frames exist" after a currency change
  // claimed readiness for frames the switch could not paint (skeleton flash).
  it('re-requests an owner whose remembered frames are in another currency', async () => {
    mockPrewarmFrames.mockResolvedValue(makeBgResult());
    await prewarmHomeTokenListOwner({ ...PARAMS, currencyId: 'usd' });
    await expect(
      prewarmHomeTokenListOwner({ ...PARAMS, currencyId: 'usd' }),
    ).resolves.toBe(true);
    expect(mockPrewarmFrames).toHaveBeenCalledTimes(1);

    mockPrewarmFrames.mockResolvedValue({ ...makeBgResult(), currency: 'cny' });
    await expect(
      prewarmHomeTokenListOwner({ ...PARAMS, currencyId: 'cny' }),
    ).resolves.toBe(true);
    expect(mockPrewarmFrames).toHaveBeenCalledTimes(2);
    expect(
      getOwnerReplayFrames({ storeName: STORE_NAME, ownerKey: OWNER_KEY })
        ?.currencyId,
    ).toBe('cny');
  });

  // PR #13695 review: a currency switch while a prewarm is in flight joined
  // the old currency's request and reported success for frames the replay
  // rejects in the new currency.
  it('does not share an in-flight request across currencies', async () => {
    let resolveUsd: (value: unknown) => void = () => undefined;
    mockPrewarmFrames.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveUsd = resolve;
        }),
    );
    mockPrewarmFrames.mockResolvedValueOnce({
      ...makeBgResult(),
      currency: 'cny',
    });
    const usd = prewarmHomeTokenListOwner({ ...PARAMS, currencyId: 'usd' });
    const cny = prewarmHomeTokenListOwner({ ...PARAMS, currencyId: 'cny' });
    expect(mockPrewarmFrames).toHaveBeenCalledTimes(2);
    await expect(cny).resolves.toBe(true);
    resolveUsd(makeBgResult());
    await usd;
  });

  // PR #13695 review: across a currency switch the older request can land
  // last; it replaced the newer currency's frames, so the next replay missed
  // its currency gate.
  it('an older request landing last does not overwrite a newer request for the same owner', async () => {
    let resolveUsd: (value: unknown) => void = () => undefined;
    mockPrewarmFrames.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveUsd = resolve;
        }),
    );
    mockPrewarmFrames.mockResolvedValueOnce({
      ...makeBgResult(),
      currency: 'cny',
    });
    const usd = prewarmHomeTokenListOwner({ ...PARAMS, currencyId: 'usd' });
    await expect(
      prewarmHomeTokenListOwner({ ...PARAMS, currencyId: 'cny' }),
    ).resolves.toBe(true);
    resolveUsd(makeBgResult());
    await expect(usd).resolves.toBe(false);
    expect(
      getOwnerReplayFrames({ storeName: STORE_NAME, ownerKey: OWNER_KEY })
        ?.currencyId,
    ).toBe('cny');
  });

  // PR #13695 review: a caller joining an in-flight request inherited its
  // dispatch-time seq, so after switching the currency away and back the
  // request the current currency waits on was rejected by its own guard.
  it('a caller that switched away and back and joined the in-flight request still writes its frames', async () => {
    let resolveUsd: (value: unknown) => void = () => undefined;
    mockPrewarmFrames.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveUsd = resolve;
        }),
    );
    mockPrewarmFrames.mockResolvedValueOnce({
      ...makeBgResult(),
      currency: 'cny',
    });
    const usd = prewarmHomeTokenListOwner({ ...PARAMS, currencyId: 'usd' });
    await expect(
      prewarmHomeTokenListOwner({ ...PARAMS, currencyId: 'cny' }),
    ).resolves.toBe(true);
    const usdAgain = prewarmHomeTokenListOwner({
      ...PARAMS,
      currencyId: 'usd',
    });
    expect(mockPrewarmFrames).toHaveBeenCalledTimes(2);
    resolveUsd(makeBgResult());
    await expect(usdAgain).resolves.toBe(true);
    await expect(usd).resolves.toBe(true);
    expect(
      getOwnerReplayFrames({ storeName: STORE_NAME, ownerKey: OWNER_KEY })
        ?.currencyId,
    ).toBe('usd');
  });

  // PR #13695 review: a caller served from the replay cache took no seq, so
  // an older request a switch-back caller had joined landed with the newest
  // seq and replaced the cached currency's frames.
  it('a replay-cache hit after a joined older request keeps the cached currency frames', async () => {
    let resolveUsd: (value: unknown) => void = () => undefined;
    mockPrewarmFrames.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveUsd = resolve;
        }),
    );
    mockPrewarmFrames.mockResolvedValueOnce({
      ...makeBgResult(),
      currency: 'cny',
    });
    const usd = prewarmHomeTokenListOwner({ ...PARAMS, currencyId: 'usd' });
    await expect(
      prewarmHomeTokenListOwner({ ...PARAMS, currencyId: 'cny' }),
    ).resolves.toBe(true);
    const usdAgain = prewarmHomeTokenListOwner({
      ...PARAMS,
      currencyId: 'usd',
    });
    await expect(
      prewarmHomeTokenListOwner({ ...PARAMS, currencyId: 'cny' }),
    ).resolves.toBe(true);
    expect(mockPrewarmFrames).toHaveBeenCalledTimes(2);
    resolveUsd(makeBgResult());
    await expect(usdAgain).resolves.toBe(false);
    await expect(usd).resolves.toBe(false);
    expect(
      getOwnerReplayFrames({ storeName: STORE_NAME, ownerKey: OWNER_KEY })
        ?.currencyId,
    ).toBe('cny');
  });

  it('a newer request still replaces frames an older request wrote in another currency', async () => {
    mockPrewarmFrames.mockResolvedValueOnce(makeBgResult());
    await prewarmHomeTokenListOwner({ ...PARAMS, currencyId: 'usd' });
    mockPrewarmFrames.mockResolvedValueOnce({
      ...makeBgResult(),
      currency: 'cny',
    });
    await expect(
      prewarmHomeTokenListOwner({ ...PARAMS, currencyId: 'cny' }),
    ).resolves.toBe(true);
    expect(
      getOwnerReplayFrames({ storeName: STORE_NAME, ownerKey: OWNER_KEY })
        ?.currencyId,
    ).toBe('cny');
  });

  it('reports false when the background answers in another currency than the caller replays in', async () => {
    mockPrewarmFrames.mockResolvedValue(makeBgResult());
    await expect(
      prewarmHomeTokenListOwner({ ...PARAMS, currencyId: 'cny' }),
    ).resolves.toBe(false);
  });
});

// The open-selector prewarm and the tap build their params from the same row,
// so both warm the owner the tap publishes (PR #13695 review).
describe('buildAccountSelectorRowPrewarmParams', () => {
  it('warms an HD row by its indexed account on the selected network', () => {
    expect(
      buildAccountSelectorRowPrewarmParams({
        row: { indexedAccount: { id: 'hd-1--3' } },
        isOthersUniversal: false,
        selectedNetworkId: NETWORK_ID,
        selectedDeriveType: 'default',
        currencyId: 'usd',
      }),
    ).toEqual({
      networkId: NETWORK_ID,
      deriveType: 'default',
      indexedAccountId: 'hd-1--3',
      currencyId: 'usd',
    });
  });

  it('warms an others-wallet row by its DB account on the matched network', () => {
    // Others rows are DB accounts; their id is not an indexed account id.
    expect(
      buildAccountSelectorRowPrewarmParams({
        row: {
          account: { id: 'watching--60--0xabc' },
          avatarNetworkId: 'evm--1',
        },
        isOthersUniversal: true,
        selectedNetworkId: NETWORK_ID,
        selectedDeriveType: 'default',
        currencyId: 'usd',
      }),
    ).toEqual({
      networkId: 'evm--1',
      deriveType: 'default',
      othersWalletAccountId: 'watching--60--0xabc',
      currencyId: 'usd',
    });
  });

  it('keeps All Networks for an others-wallet row, as the selection does', () => {
    expect(
      buildAccountSelectorRowPrewarmParams({
        row: {
          account: { id: 'watching--60--0xabc' },
          avatarNetworkId: 'evm--1',
        },
        isOthersUniversal: true,
        selectedNetworkId: 'onekeyall--0',
        selectedDeriveType: 'default',
        currencyId: 'usd',
      }).networkId,
    ).toBe('onekeyall--0');
  });
});
