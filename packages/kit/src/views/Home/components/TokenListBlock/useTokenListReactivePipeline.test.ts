/**
 * @jest-environment jsdom
 */
/**
 * useTokenListReactivePipeline — facade orchestration tests (design §2, §2.7).
 *
 * The facade owns the all-network LWW pipeline (FloorView + merge + ingestRound
 * feed). These tests pin the facade-specific invariants in isolation (the BG
 * `ingestRound` is mocked, the merge + LwwMaterializedView are real):
 *   - the unified kill-switch (`enabled:false` → no ingest);
 *   - the owner guard (a round for a different owner never ingests);
 *   - cache seed → immediate flush → ONE merged `ingestRound`;
 *   - P1-g epoch asymmetry: the authoritative commit bumps the epoch so a
 *     trailing throttled flush is superseded, while `reset()` does NOT — a
 *     pending flush after a plain reset still paints.
 */
import type { MutableRefObject } from 'react';

import { act, renderHook } from '@testing-library/react';

import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import * as snapshotUtils from '@onekeyhq/shared/src/utils/buildMergedAllNetworkSnapshot';
import type { IHomeTokenRequest } from '@onekeyhq/shared/types/token';

const mockIngestRound = jest.fn(async (..._args: unknown[]) => undefined);
const mockIngestHomeTokenRounds = jest.fn(async (..._args: unknown[]) => true);
const mockIsHomeTokenRequestCurrent = jest.fn(() => true);
const mockGetVaultSettings = jest.fn(async () => ({
  mergeDeriveAssetsEnabled: false,
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceTokenViewModel: {
      ingestRound: (...args: unknown[]) => mockIngestRound(...args),
      ingestHomeTokenRounds: (...args: unknown[]) =>
        mockIngestHomeTokenRounds(...args),
    },
    serviceNetwork: {
      getVaultSettings: () => mockGetVaultSettings(),
    },
  },
}));

jest.mock('@onekeyhq/shared/src/utils/homeTokenRequest', () => ({
  isHomeTokenRequestCurrent: () => mockIsHomeTokenRequestCurrent(),
}));
jest.mock('@onekeyhq/shared/src/utils/buildMergedAllNetworkSnapshot', () => {
  const actual = jest.requireActual<typeof snapshotUtils>(
    '@onekeyhq/shared/src/utils/buildMergedAllNetworkSnapshot',
  );
  return {
    ...actual,
    buildMergedAllNetworkSnapshot: jest.fn(
      actual.buildMergedAllNetworkSnapshot,
    ),
  };
});

// The unit-under-test import must come AFTER jest.mock (hoisting); the type
// import is colocated so import/order's value-before-type rule is satisfied.
/* eslint-disable import/first, import/order */
import {
  PROGRESSIVE_PAINT_THROTTLE_MS,
  useTokenListReactivePipeline,
} from './useTokenListReactivePipeline';

import type {
  ICacheSeedItem,
  ICellsIngestInputs,
  ILiveRound,
} from './useTokenListReactivePipeline';
/* eslint-enable import/first, import/order */

const OWNER = { accountId: 'acc1', networkId: 'evm--1' };

function makeInputsRef(): MutableRefObject<ICellsIngestInputs> {
  return {
    current: { ownerKey: 'acc1__evm--1', nonZeroInputs: {} },
  };
}

function makeCacheItem(over: Partial<ICacheSeedItem> = {}): ICacheSeedItem {
  return {
    accountId: OWNER.accountId,
    networkId: OWNER.networkId,
    tokenList: [
      {
        $key: 'a1',
        name: 'A1',
        symbol: 'A1',
        decimals: 18,
        address: '0xa1',
        isNative: false,
      },
    ] as ICacheSeedItem['tokenList'],
    smallBalanceTokenList: [],
    riskyTokenList: [],
    tokenListMap: {
      a1: { balance: '1', balanceParsed: '1', fiatValue: '10', price: 1 },
    },
    ...over,
  };
}

function makeHomeRequest(generation: number): IHomeTokenRequest {
  return {
    mainRuntimeId: 'main-runtime',
    generation,
    ownerKey: 'acc1__evm--1',
  };
}

function render(enabled = true, homeRequest?: IHomeTokenRequest) {
  const cellsIngestInputsRef = makeInputsRef();
  const homeRequestRef = { current: homeRequest };
  const ownerCurrentRef = { current: true };
  const isHomeRequestCurrent = () => ownerCurrentRef.current;
  return {
    cellsIngestInputsRef,
    homeRequestRef,
    ownerCurrentRef,
    ...renderHook(
      ({
        ownerAccountId,
        ownerNetworkId,
        enabled: isEnabled,
      }: {
        ownerAccountId: string | undefined;
        ownerNetworkId: string | undefined;
        enabled: boolean;
      }) =>
        useTokenListReactivePipeline({
          ownerAccountId,
          ownerNetworkId,
          ownerCreateAtNetwork: undefined,
          cellsIngestInputsRef,
          homeRequestRef,
          isHomeRequestCurrent,
          enabled: isEnabled,
        }),
      {
        initialProps: {
          ownerAccountId: OWNER.accountId,
          ownerNetworkId: OWNER.networkId,
          enabled,
        },
      },
    ),
  };
}

function makeLiveRound(over: Partial<ILiveRound> = {}): ILiveRound {
  return {
    accountId: OWNER.accountId,
    networkId: OWNER.networkId,
    ownerAccountId: OWNER.accountId,
    ownerNetworkId: OWNER.networkId,
    tokens: {
      data: [
        {
          $key: 'live-a1',
          name: 'Live A1',
          symbol: 'LA1',
          decimals: 18,
          address: '0xlivea1',
          isNative: false,
        },
      ],
      keys: 'live-a1',
      map: {
        'live-a1': {
          balance: '1',
          balanceParsed: '1',
          fiatValue: '10',
          price: 1,
        },
      },
    },
    smallBalanceTokens: { data: [], keys: '', map: {} },
    riskTokens: { data: [], keys: '', map: {} },
    ...over,
  };
}

describe('useTokenListReactivePipeline', () => {
  beforeEach(() => {
    mockIngestRound.mockReset().mockResolvedValue(undefined);
    mockIngestHomeTokenRounds.mockReset().mockResolvedValue(true);
    mockGetVaultSettings.mockReset().mockResolvedValue({
      mergeDeriveAssetsEnabled: false,
    });
    mockIsHomeTokenRequestCurrent.mockReset().mockReturnValue(true);
  });

  it('does not build an authoritative empty snapshot before any round materializes', async () => {
    const { result } = render(true);
    act(() => {
      result.current.setEnabledKeys([OWNER]);
    });

    await expect(
      result.current.buildAuthoritativeSnapshot(),
    ).resolves.toBeUndefined();
  });

  it('builds a legitimate empty snapshot after an empty live round materializes', async () => {
    const { result } = render(true);
    act(() => {
      result.current.setEnabledKeys([OWNER]);
      result.current.ingestLiveRound(
        makeLiveRound({
          tokens: { data: [], keys: '', map: {} },
        }),
        1,
      );
    });

    const snapshot = await result.current.buildAuthoritativeSnapshot();
    expect(snapshot).toBeDefined();
    expect(snapshot?.orderedTokens).toEqual([]);
    expect(snapshot?.createAtNetworkWorth).toBe('0');
  });

  it('kill-switch: enabled:false → seedAndFlushCache does not ingest', async () => {
    const { result } = render(false);
    act(() => {
      result.current.setEnabledKeys([OWNER]);
    });
    await act(async () => {
      await result.current.seedAndFlushCache({
        data: [makeCacheItem()],
        accountId: OWNER.accountId,
        networkId: OWNER.networkId,
        generation: 1,
      });
    });
    expect(mockIngestRound).not.toHaveBeenCalled();
  });

  it('owner guard: a cache round for a different owner does not ingest', async () => {
    const { result } = render(true);
    act(() => {
      result.current.setEnabledKeys([OWNER]);
    });
    await act(async () => {
      await result.current.seedAndFlushCache({
        data: [makeCacheItem()],
        accountId: 'OTHER_ACC',
        networkId: 'evm--999',
        generation: 1,
      });
    });
    expect(mockIngestRound).not.toHaveBeenCalled();
  });

  it('cache seed → immediate flush → one merged ingestRound (source cacheSeed)', async () => {
    const { result } = render(true);
    act(() => {
      result.current.setEnabledKeys([OWNER]);
    });
    await act(async () => {
      await result.current.seedAndFlushCache({
        data: [
          makeCacheItem({
            tokenList: [
              {
                $key: 'agg-usdt',
                name: 'USDT',
                symbol: 'USDT',
                decimals: 6,
                address: 'agg-usdt',
                isNative: false,
                isAggregateToken: true,
              },
            ] as ICacheSeedItem['tokenList'],
            aggregateTokenListMap: {
              'agg-usdt': {
                tokens: [
                  {
                    $key: 'evm--1_usdt',
                    name: 'USDT',
                    symbol: 'USDT',
                    decimals: 6,
                    address: '0xusdt',
                    isNative: false,
                    networkId: OWNER.networkId,
                  },
                ] as ICacheSeedItem['tokenList'],
              },
            },
            aggregateTokenMap: {
              'agg-usdt': {
                balance: '2',
                balanceParsed: '2',
                fiatValue: '20',
                price: 1,
              },
            },
          }),
        ],
        accountId: OWNER.accountId,
        networkId: OWNER.networkId,
        generation: 1,
      });
    });
    expect(mockIngestRound).toHaveBeenCalledTimes(1);
    const arg = mockIngestRound.mock.calls[0][0] as {
      source: string;
      ownerKey: string;
      orderedTokens: { $key: string }[];
      aggregateTokensMap: Record<
        string,
        Record<string, { fiatValue?: string }>
      >;
      ownedAggregateTokenListMap: Record<
        string,
        { tokens: { $key: string }[] }
      >;
    };
    expect(arg.source).toBe('cacheSeed');
    expect(arg.ownerKey).toBe('acc1__evm--1');
    expect(arg.orderedTokens.map((t) => t.$key)).toContain('agg-usdt');
    expect(
      arg.aggregateTokensMap['agg-usdt']?.[OWNER.networkId]?.fiatValue,
    ).toBe('20');
    expect(arg.ownedAggregateTokenListMap['agg-usdt']?.tokens[0]?.$key).toBe(
      'evm--1_usdt',
    );
  });

  it('cache seed merges cached derive rows without vault-settings lookup', async () => {
    const { result } = render(true);
    const btcAccount = { accountId: 'btc-derive-86', networkId: 'btc--0' };
    act(() => {
      result.current.setEnabledKeys([btcAccount]);
    });
    await act(async () => {
      await result.current.seedAndFlushCache({
        data: [
          makeCacheItem({
            accountId: btcAccount.accountId,
            networkId: btcAccount.networkId,
            tokenList: [
              {
                $key: 'btc--0_xpub86_native',
                name: 'Bitcoin',
                symbol: 'BTC',
                decimals: 8,
                address: 'native',
                isNative: true,
                mergeAssets: true,
              },
              {
                $key: 'btc--0_xpub84_native',
                name: 'Bitcoin',
                symbol: 'BTC',
                decimals: 8,
                address: 'native',
                isNative: true,
                mergeAssets: true,
              },
            ] as ICacheSeedItem['tokenList'],
            tokenListMap: {
              'btc--0_xpub86_native': {
                balance: '1',
                balanceParsed: '1',
                fiatValue: '10',
                price: 10,
              },
              'btc--0_xpub84_native': {
                balance: '2',
                balanceParsed: '2',
                fiatValue: '20',
                price: 10,
              },
            },
          }),
        ],
        accountId: OWNER.accountId,
        networkId: OWNER.networkId,
        generation: 1,
      });
    });

    expect(mockIngestRound).toHaveBeenCalledTimes(1);
    const arg = mockIngestRound.mock.calls[0][0] as {
      orderedTokens: { $key: string }[];
      tokenListMap: Record<string, { balance?: string; fiatValue?: string }>;
    };
    expect(arg.orderedTokens.map((t) => t.$key)).toEqual(['btc--0_native']);
    expect(arg.tokenListMap['btc--0_native']?.balance).toBe('3');
    expect(arg.tokenListMap['btc--0_native']?.fiatValue).toBe('30');
    expect(mockGetVaultSettings).not.toHaveBeenCalled();
  });

  it('buildAuthoritativeSnapshot + commit → authoritative ingest', async () => {
    const { result } = render(true);
    act(() => {
      result.current.setEnabledKeys([OWNER]);
    });
    // seed something into the view first
    await act(async () => {
      await result.current.seedAndFlushCache({
        data: [makeCacheItem()],
        accountId: OWNER.accountId,
        networkId: OWNER.networkId,
        generation: 1,
      });
    });
    mockIngestRound.mockClear();

    await act(async () => {
      const snap = await result.current.buildAuthoritativeSnapshot();
      expect(snap).toBeDefined();
      if (snap) {
        result.current.commitAuthoritativeIngest(snap);
      }
    });
    expect(mockIngestRound).toHaveBeenCalledTimes(1);
    expect(
      (mockIngestRound.mock.calls[0][0] as { source: string }).source,
    ).toBe('authoritative');
  });

  it('cache seed: explicit tokenListValue keeps risk-only map keys out of the worth', async () => {
    // The cache stores ONE full tokenListMap (normal + small + risk entries)
    // that seedAndFlushCache reuses for all three group maps. The cached
    // tokenListValue counts tokens + smallBalanceTokens only, so it must be
    // carried as the round's explicit accountWorth — a map-derived sum would
    // add risk-only keys and write the authoritative worth too high.
    const { result } = render(true);
    act(() => {
      result.current.setEnabledKeys([OWNER]);
    });
    let worth: string | undefined;
    await act(async () => {
      await result.current.seedAndFlushCache({
        data: [
          makeCacheItem({
            riskyTokenList: [
              {
                $key: 'scam',
                name: 'Scam',
                symbol: 'SCAM',
                decimals: 18,
                address: '0xscam',
                isNative: false,
              },
            ] as ICacheSeedItem['riskyTokenList'],
            tokenListMap: {
              a1: {
                balance: '1',
                balanceParsed: '1',
                fiatValue: '10',
                price: 1,
              },
              scam: {
                balance: '1',
                balanceParsed: '1',
                fiatValue: '999',
                price: 1,
              },
            },
            tokenListValue: '10',
          }),
        ],
        accountId: OWNER.accountId,
        networkId: OWNER.networkId,
        generation: 1,
      });
      const snap = await result.current.buildAuthoritativeSnapshot();
      expect(snap).toBeDefined();
      worth =
        snap?.accountsWorth[
          accountUtils.buildAccountValueKey({
            accountId: OWNER.accountId,
            networkId: OWNER.networkId,
          })
        ];
    });
    expect(worth).toBe('10');
  });

  it('P1-g: a throttled live flush is SUPERSEDED by an authoritative commit (epoch bump)', async () => {
    jest.useFakeTimers();
    try {
      const { result } = render(true);
      act(() => {
        result.current.setEnabledKeys([OWNER]);
      });
      // schedule a throttled progPaint flush
      act(() => {
        result.current.ingestLiveRound(
          {
            accountId: OWNER.accountId,
            networkId: OWNER.networkId,
            ownerAccountId: OWNER.accountId,
            ownerNetworkId: OWNER.networkId,
            tokens: { data: [], keys: '', map: {} },
            smallBalanceTokens: { data: [], keys: '', map: {} },
            riskTokens: { data: [], keys: '', map: {} },
          } as Parameters<typeof result.current.ingestLiveRound>[0],
          1,
        );
      });
      // authoritative commit lands first (bumps the epoch)
      await act(async () => {
        const snap = await result.current.buildAuthoritativeSnapshot();
        expect(snap).toBeDefined();
        if (snap) {
          result.current.commitAuthoritativeIngest(snap);
        }
      });
      mockIngestRound.mockClear();
      // now let the throttled flush fire — it must abort (epoch superseded)
      await act(async () => {
        await jest.advanceTimersByTimeAsync(400);
      });
      expect(mockIngestRound).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('keeps the previous authoritative rounds as the next warm-refresh floor', async () => {
    jest.useFakeTimers();
    try {
      const { result } = render(true);
      act(() => {
        result.current.setEnabledKeys([
          OWNER,
          { accountId: OWNER.accountId, networkId: 'evm--56' },
        ]);
      });
      await act(async () => {
        await result.current.seedAndFlushCache({
          data: [
            makeCacheItem({
              tokenList: [
                {
                  $key: 'old-a1',
                  name: 'Old A1',
                  symbol: 'OA1',
                  decimals: 18,
                  address: '0xolda1',
                  isNative: false,
                },
              ] as ICacheSeedItem['tokenList'],
              tokenListMap: {
                'old-a1': {
                  balance: '1',
                  balanceParsed: '1',
                  fiatValue: '10',
                  price: 1,
                },
              },
            }),
            makeCacheItem({
              networkId: 'evm--56',
              tokenList: [
                {
                  $key: 'b1',
                  name: 'B1',
                  symbol: 'B1',
                  decimals: 18,
                  address: '0xb1',
                  isNative: false,
                },
              ] as ICacheSeedItem['tokenList'],
              tokenListMap: {
                b1: {
                  balance: '1',
                  balanceParsed: '1',
                  fiatValue: '5',
                  price: 1,
                },
              },
            }),
          ],
          accountId: OWNER.accountId,
          networkId: OWNER.networkId,
          generation: 1,
        });
        const snap = await result.current.buildAuthoritativeSnapshot();
        expect(snap).toBeDefined();
        if (snap) {
          result.current.commitAuthoritativeIngest(snap);
        }
      });
      mockIngestRound.mockClear();

      act(() => {
        result.current.ingestLiveRound(makeLiveRound(), 2);
      });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(PROGRESSIVE_PAINT_THROTTLE_MS + 1);
      });

      expect(mockIngestRound).toHaveBeenCalledTimes(1);
      const arg = mockIngestRound.mock.calls[0][0] as {
        source: string;
        orderedTokens: { $key: string }[];
      };
      expect(arg.source).toBe('progPaint');
      expect(arg.orderedTokens.map((t) => t.$key)).toEqual(['live-a1', 'b1']);
    } finally {
      jest.useRealTimers();
    }
  });

  it('drops an in-flight progressive flush after owner switch before BG ingest', async () => {
    jest.useFakeTimers();
    try {
      let resolveVaultSettings:
        | ((value: { mergeDeriveAssetsEnabled: boolean }) => void)
        | undefined;
      mockGetVaultSettings.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveVaultSettings = resolve;
          }),
      );

      const { result, rerender, cellsIngestInputsRef } = render(true);
      act(() => {
        result.current.setEnabledKeys([OWNER]);
        result.current.ingestLiveRound(makeLiveRound(), 1);
      });

      await act(async () => {
        jest.advanceTimersByTime(PROGRESSIVE_PAINT_THROTTLE_MS + 1);
        await Promise.resolve();
      });
      expect(mockGetVaultSettings).toHaveBeenCalledTimes(1);

      act(() => {
        cellsIngestInputsRef.current = {
          ownerKey: 'acc2__evm--1',
          nonZeroInputs: {},
        };
      });
      rerender({
        ownerAccountId: 'acc2',
        ownerNetworkId: OWNER.networkId,
        enabled: true,
      });
      act(() => {
        result.current.reset();
      });

      await act(async () => {
        resolveVaultSettings?.({ mergeDeriveAssetsEnabled: false });
        await Promise.resolve();
      });
      expect(mockIngestRound).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('rejects stale cache and live results for the same owner before seeding', async () => {
    const staleRequest = makeHomeRequest(1);
    const currentRequest = makeHomeRequest(3);
    const { result } = render(true, currentRequest);
    act(() => {
      result.current.setEnabledKeys([OWNER]);
      result.current.ingestLiveRound(
        makeLiveRound({ homeRequest: staleRequest }),
        1,
      );
    });
    await act(async () => {
      await result.current.seedAndFlushCache({
        data: [makeCacheItem({ homeRequest: staleRequest })],
        ...OWNER,
        generation: 1,
      });
    });
    expect(mockIngestRound).not.toHaveBeenCalled();
    await expect(
      result.current.buildAuthoritativeSnapshot(),
    ).resolves.toBeUndefined();
  });

  it('never adopts an old pending timer or a pure old floor into a new request', async () => {
    jest.useFakeTimers();
    try {
      const homeRequest = makeHomeRequest(1);
      const { result, homeRequestRef } = render(true, homeRequest);
      act(() => {
        result.current.setEnabledKeys([OWNER]);
        result.current.ingestLiveRound(makeLiveRound({ homeRequest }), 1);
        homeRequestRef.current = makeHomeRequest(2);
      });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(PROGRESSIVE_PAINT_THROTTLE_MS + 1);
      });
      expect(mockIngestRound).not.toHaveBeenCalled();
      expect(mockGetVaultSettings).not.toHaveBeenCalled();
      await expect(
        result.current.buildAuthoritativeSnapshot(),
      ).resolves.toBeUndefined();
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not ingest a current request whose owner key no longer matches the cells owner', async () => {
    const homeRequest = makeHomeRequest(1);
    const { result, cellsIngestInputsRef } = render(true, homeRequest);
    act(() => {
      result.current.setEnabledKeys([OWNER]);
      cellsIngestInputsRef.current.ownerKey = 'acc2__evm--1';
      result.current.ingestLiveRound(makeLiveRound({ homeRequest }), 1);
    });
    await act(async () => {
      await result.current.seedAndFlushCache({
        data: [makeCacheItem({ homeRequest })],
        ...OWNER,
        generation: 1,
      });
    });
    expect(mockIngestRound).not.toHaveBeenCalled();
    await expect(
      result.current.buildAuthoritativeSnapshot(),
    ).resolves.toBeUndefined();
  });

  it('replaces an old pending timer and retains the other network floor for the new round', async () => {
    jest.useFakeTimers();
    try {
      const oldRequest = makeHomeRequest(1);
      const newRequest = makeHomeRequest(2);
      const { result, homeRequestRef } = render(true, oldRequest);
      act(() => {
        result.current.setEnabledKeys([
          OWNER,
          { accountId: OWNER.accountId, networkId: 'evm--56' },
        ]);
      });
      await act(async () => {
        await result.current.seedAndFlushCache({
          data: [
            makeCacheItem({ networkId: 'evm--56', homeRequest: oldRequest }),
          ],
          ...OWNER,
          generation: 1,
        });
      });
      mockIngestRound.mockClear();
      act(() => {
        result.current.ingestLiveRound(
          makeLiveRound({ homeRequest: oldRequest }),
          1,
        );
        homeRequestRef.current = newRequest;
        result.current.ingestLiveRound(
          makeLiveRound({ homeRequest: newRequest }),
          2,
        );
      });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(PROGRESSIVE_PAINT_THROTTLE_MS + 1);
      });
      expect(mockIngestRound).toHaveBeenCalledTimes(1);
      expect(mockIngestRound.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          source: 'progPaint',
          homeRequest: newRequest,
          orderedTokens: expect.arrayContaining([
            expect.objectContaining({ $key: 'a1' }),
            expect.objectContaining({ $key: 'live-a1' }),
          ]),
        }),
      );
      expect(
        (mockIngestRound.mock.calls[0][0] as { homeRequest: IHomeTokenRequest })
          .homeRequest,
      ).toBe(newRequest);
    } finally {
      jest.useRealTimers();
    }
  });

  it.each(['progressive', 'authoritative'] as const)(
    'drops an awaiting %s build when the same-owner request changes',
    async (source) => {
      jest.useFakeTimers();
      try {
        let resolveVaultSettings:
          | ((value: { mergeDeriveAssetsEnabled: boolean }) => void)
          | undefined;
        mockGetVaultSettings.mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveVaultSettings = resolve;
            }),
        );
        const homeRequest = makeHomeRequest(1);
        const { result, homeRequestRef } = render(true, homeRequest);
        act(() => {
          result.current.setEnabledKeys([OWNER]);
          result.current.ingestLiveRound(makeLiveRound({ homeRequest }), 1);
        });
        let authoritative:
          | ReturnType<typeof result.current.buildAuthoritativeSnapshot>
          | undefined;
        await act(async () => {
          if (source === 'progressive') {
            jest.advanceTimersByTime(PROGRESSIVE_PAINT_THROTTLE_MS);
          } else {
            authoritative = result.current.buildAuthoritativeSnapshot();
          }
          await Promise.resolve();
        });
        expect(mockGetVaultSettings).toHaveBeenCalledTimes(1);
        homeRequestRef.current = makeHomeRequest(3);
        await act(async () => {
          resolveVaultSettings?.({ mergeDeriveAssetsEnabled: false });
          await Promise.resolve();
        });
        if (authoritative) await expect(authoritative).resolves.toBeUndefined();
        expect(mockIngestRound).not.toHaveBeenCalled();
      } finally {
        jest.useRealTimers();
      }
    },
  );

  it('checks owner validity after the cache flush awaits even when the token stays unchanged', async () => {
    const homeRequest = makeHomeRequest(1);
    const { result, ownerCurrentRef } = render(true, homeRequest);
    act(() => result.current.setEnabledKeys([OWNER]));
    await act(async () => {
      const pending = result.current.seedAndFlushCache({
        data: [makeCacheItem({ homeRequest })],
        ...OWNER,
        generation: 1,
      });
      ownerCurrentRef.current = false;
      await pending;
    });
    expect(mockIngestRound).not.toHaveBeenCalled();
  });

  it('rejects a stale authoritative commit without clearing the current request timer', async () => {
    jest.useFakeTimers();
    try {
      const homeRequest = makeHomeRequest(1);
      const { result, homeRequestRef } = render(true, homeRequest);
      act(() => result.current.setEnabledKeys([OWNER]));
      await act(async () => {
        await result.current.seedAndFlushCache({
          data: [makeCacheItem({ homeRequest })],
          ...OWNER,
          generation: 1,
        });
      });
      const snapshot = await result.current.buildAuthoritativeSnapshot();
      expect(snapshot).toBeDefined();
      mockIngestRound.mockClear();
      const newRequest = makeHomeRequest(2);
      act(() => {
        homeRequestRef.current = newRequest;
        result.current.ingestLiveRound(
          makeLiveRound({ homeRequest: newRequest }),
          2,
        );
        if (snapshot)
          result.current.commitAuthoritativeIngest(snapshot, homeRequest);
      });
      await act(async () => {
        await jest.advanceTimersByTimeAsync(PROGRESSIVE_PAINT_THROTTLE_MS + 1);
      });
      expect(mockIngestRound).toHaveBeenCalledTimes(1);
      expect(mockIngestRound.mock.calls[0][0]).toEqual(
        expect.objectContaining({
          source: 'progPaint',
          homeRequest: newRequest,
        }),
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('checks the global main generation again before ingest even if the component ref is unchanged', async () => {
    const homeRequest = makeHomeRequest(1);
    const { result } = render(true, homeRequest);
    act(() => result.current.setEnabledKeys([OWNER]));
    await act(async () => {
      const pending = result.current.seedAndFlushCache({
        data: [makeCacheItem({ homeRequest })],
        ...OWNER,
        generation: 1,
      });
      mockIsHomeTokenRequestCurrent.mockReturnValue(false);
      await pending;
    });
    expect(mockIngestRound).not.toHaveBeenCalled();
  });

  it('consumes cancellation errors returned by the background VM', async () => {
    const canceled = new Error('canceled');
    canceled.name = 'CanceledError';
    mockIngestRound.mockRejectedValueOnce(canceled);
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    try {
      const homeRequest = makeHomeRequest(1);
      const { result } = render(true, homeRequest);
      act(() => result.current.setEnabledKeys([OWNER]));
      await act(async () => {
        await result.current.seedAndFlushCache({
          data: [makeCacheItem({ homeRequest })],
          ...OWNER,
          generation: 1,
        });
      });
      expect(mockIngestRound).toHaveBeenCalledTimes(1);
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it('sends only exact cache/live references and preserves the other network floor', async () => {
    jest.useFakeTimers();
    const merge = jest.mocked(snapshotUtils.buildMergedAllNetworkSnapshot);
    merge.mockClear();
    try {
      const homeRequest = makeHomeRequest(1);
      const { result } = render(true, homeRequest);
      act(() =>
        result.current.setEnabledKeys([
          OWNER,
          { accountId: OWNER.accountId, networkId: 'evm--56' },
        ]),
      );
      await act(async () => {
        await result.current.seedAndFlushCache({
          data: [
            makeCacheItem({ homeRequest, homeTokenRoundRef: 'cache-a' }),
            makeCacheItem({
              homeRequest,
              networkId: 'evm--56',
              homeTokenRoundRef: 'cache-b',
            }),
          ],
          ...OWNER,
          generation: 1,
        });
      });
      act(() =>
        result.current.ingestLiveRound(
          makeLiveRound({
            homeRequest,
            homeTokenRoundRef: 'live-a',
            mergeDeriveAssets: false,
          }),
          1,
        ),
      );
      await act(async () => {
        await jest.advanceTimersByTimeAsync(PROGRESSIVE_PAINT_THROTTLE_MS + 1);
      });
      expect(mockIngestRound).not.toHaveBeenCalled();
      expect(merge).not.toHaveBeenCalled();
      expect(mockIngestHomeTokenRounds).toHaveBeenCalledTimes(2);
      expect(mockIngestHomeTokenRounds.mock.calls[1][0]).toMatchObject({
        roundRefs: ['live-a', 'cache-b'],
        source: 'progPaint',
        homeRequest,
      });
      expect(mockIngestHomeTokenRounds.mock.calls[1][0]).not.toHaveProperty(
        'orderedTokens',
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it('falls back to the exact full snapshot only when references are explicitly missing', async () => {
    mockIngestHomeTokenRounds.mockResolvedValueOnce(false);
    const homeRequest = makeHomeRequest(1);
    const { result } = render(true, homeRequest);
    act(() => result.current.setEnabledKeys([OWNER]));
    await act(async () => {
      await result.current.seedAndFlushCache({
        data: [makeCacheItem({ homeRequest, homeTokenRoundRef: 'evicted' })],
        ...OWNER,
        generation: 1,
      });
    });
    expect(mockIngestRound).toHaveBeenCalledTimes(1);
    expect(mockIngestRound.mock.calls[0][0]).toMatchObject({
      source: 'cacheSeed',
      homeRequest,
      homePublication: 1,
      orderedTokens: [expect.objectContaining({ $key: 'a1' })],
    });
  });

  it('commits the authoritative snapshot references captured before a newer live result', async () => {
    const homeRequest = makeHomeRequest(1);
    const { result } = render(true, homeRequest);
    act(() => result.current.setEnabledKeys([OWNER]));
    await act(async () => {
      await result.current.seedAndFlushCache({
        data: [makeCacheItem({ homeRequest, homeTokenRoundRef: 'snapshot-a' })],
        ...OWNER,
        generation: 1,
      });
      const snapshot = await result.current.buildAuthoritativeSnapshot();
      result.current.ingestLiveRound(
        makeLiveRound({
          homeRequest,
          homeTokenRoundRef: 'live-b',
          mergeDeriveAssets: false,
        }),
        1,
      );
      if (snapshot)
        result.current.commitAuthoritativeIngest(snapshot, homeRequest);
    });
    expect(mockIngestHomeTokenRounds.mock.calls[1][0]).toMatchObject({
      source: 'authoritative',
      roundRefs: ['snapshot-a'],
    });
    expect(mockIngestRound).not.toHaveBeenCalled();
  });

  it.each(['authoritative', 'new-owner'] as const)(
    'drops a delayed missing-reference fallback after %s supersedes it',
    async (superseding) => {
      let resolveMissing: ((value: boolean) => void) | undefined;
      mockIngestHomeTokenRounds.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveMissing = resolve;
          }),
      );
      const homeRequest = makeHomeRequest(1);
      const { result, homeRequestRef } = render(true, homeRequest);
      act(() => result.current.setEnabledKeys([OWNER]));
      await act(async () => {
        await result.current.seedAndFlushCache({
          data: [makeCacheItem({ homeRequest, homeTokenRoundRef: 'cache' })],
          ...OWNER,
          generation: 1,
        });
      });
      if (superseding === 'authoritative') {
        await act(async () => {
          const snapshot = await result.current.buildAuthoritativeSnapshot();
          if (snapshot)
            result.current.commitAuthoritativeIngest(snapshot, homeRequest);
        });
        expect(mockIngestHomeTokenRounds).toHaveBeenCalledTimes(2);
        expect(mockIngestHomeTokenRounds.mock.calls[1][0]).toMatchObject({
          source: 'authoritative',
          homePublication: 2,
          roundRefs: ['cache'],
        });
      } else {
        homeRequestRef.current = makeHomeRequest(2);
      }
      await act(async () => {
        resolveMissing?.(false);
        await Promise.resolve();
      });
      expect(mockIngestRound).not.toHaveBeenCalled();
    },
  );
});
