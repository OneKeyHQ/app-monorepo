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
import { useTokenListReactivePipeline } from './useTokenListReactivePipeline';

import type { ICacheSeedItem } from './useTokenListReactivePipeline';
/* eslint-enable import/first, import/order */

const OWNER = { accountId: 'acc1', networkId: 'evm--1' };

function makeInputsRef(): MutableRefObject<{
  ownerKey: string;
  nonZeroInputs: Record<string, never>;
}> {
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
  return renderHook(() =>
    useTokenListReactivePipeline({
      ownerAccountId: OWNER.accountId,
      ownerNetworkId: OWNER.networkId,
      ownerCreateAtNetwork: undefined,
      cellsIngestInputsRef,
      enabled,
    }),
  );
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
        data: [makeCacheItem()],
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
    };
    expect(arg.source).toBe('cacheSeed');
    expect(arg.ownerKey).toBe('acc1__evm--1');
    expect(arg.orderedTokens.map((t) => t.$key)).toContain('a1');
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
});
