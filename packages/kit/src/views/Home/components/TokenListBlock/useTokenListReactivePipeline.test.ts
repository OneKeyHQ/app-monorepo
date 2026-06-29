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

const mockIngestRound = jest.fn();
const mockGetVaultSettings = jest.fn(async () => ({
  mergeDeriveAssetsEnabled: false,
}));

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceTokenViewModel: {
      ingestRound: (...args: unknown[]) => {
        mockIngestRound(...args);
      },
    },
    serviceNetwork: {
      getVaultSettings: () => mockGetVaultSettings(),
    },
  },
}));

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

function render(enabled = true) {
  const cellsIngestInputsRef = makeInputsRef();
  return {
    cellsIngestInputsRef,
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
    mockIngestRound.mockClear();
    mockGetVaultSettings.mockClear();
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
      result.current.commitAuthoritativeIngest(snap);
    });
    expect(mockIngestRound).toHaveBeenCalledTimes(1);
    expect(
      (mockIngestRound.mock.calls[0][0] as { source: string }).source,
    ).toBe('authoritative');
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
      // authoritative commit lands first (bumps the epoch + clears the view)
      await act(async () => {
        const snap = await result.current.buildAuthoritativeSnapshot();
        result.current.commitAuthoritativeIngest(snap);
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
});
