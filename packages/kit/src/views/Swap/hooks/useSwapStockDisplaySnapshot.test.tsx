/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import {
  ESwapStockTradeSide,
  getTokenIdentityKey,
} from './swapStockChannelUtils';
import { mergeSwapStockDisplaySnapshot } from './swapStockDisplaySnapshotUtils';
import { useSwapStockDisplaySnapshot } from './useSwapStockDisplaySnapshot';

import type { ISwapStockDisplayIdentity } from './swapStockDisplaySnapshotUtils';

const mockCache = new Map<string, unknown>();
const mockStorageSet = jest.fn((accountKey: string, value: unknown) =>
  mockCache.set(accountKey, value),
);

let mockActiveAccount: {
  ready: boolean;
  wallet?: { id: string };
  indexedAccount?: { id: string };
  deriveType?: string;
} = {
  ready: true,
  wallet: { id: 'wallet-a' },
  indexedAccount: { id: 'account-a' },
  deriveType: 'default',
};
let mockInitialSelectedTokensSynced = true;
let mockCurrency = 'usd';

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({ activeAccount: mockActiveAccount }),
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/swap', () => ({
  useSwapInitialSelectedTokensSyncedAtom: () => [
    mockInitialSelectedTokensSynced,
  ],
  useSwapSelectedTokensColdStartContextAtom: () => [undefined],
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useSettingsPersistAtom: () => [
    {
      currencyInfo: {
        id: mockCurrency,
      },
    },
  ],
}));

jest.mock('./swapStockDisplaySnapshotStorage', () => ({
  swapStockDisplaySnapshotStorage: {
    get: (accountKey: string) => mockCache.get(accountKey),
    set: (accountKey: string, value: unknown) =>
      mockStorageSet(accountKey, value),
  },
}));

const stockA: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0xAa',
  decimals: 18,
  symbol: 'AAPL',
  isStock: true,
};
const stockB: ISwapToken = {
  ...stockA,
  contractAddress: '0xBb',
  symbol: 'TSLA',
};
const payToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0xCc',
  decimals: 6,
  symbol: 'USDC',
};

function buildIdentity({
  accountKey = 'wallet-a|account-a|default',
  stockToken = stockA,
}: {
  accountKey?: string;
  stockToken?: ISwapToken;
} = {}): ISwapStockDisplayIdentity {
  return {
    accountKey,
    stockTokenKey: getTokenIdentityKey(stockToken),
    payTokenKey: getTokenIdentityKey(payToken),
    tradeSide: ESwapStockTradeSide.Buy,
    currency: 'usd',
  };
}

function seedSnapshot(identity: ISwapStockDisplayIdentity, value: string) {
  mockCache.set(
    identity.accountKey,
    mergeSwapStockDisplaySnapshot({
      identity,
      patch: {
        balance: {
          inputTokenKey: identity.payTokenKey,
          value,
        },
      },
    }),
  );
}

describe('useSwapStockDisplaySnapshot', () => {
  beforeEach(() => {
    mockCache.clear();
    mockStorageSet.mockClear();
    mockActiveAccount = {
      ready: true,
      wallet: { id: 'wallet-a' },
      indexedAccount: { id: 'account-a' },
      deriveType: 'default',
    };
    mockInitialSelectedTokensSynced = true;
    mockCurrency = 'usd';
  });

  it('rejects stock-owned regions but retains the same input-token balance', () => {
    const identityA = buildIdentity();
    seedSnapshot(identityA, '10');
    const { result, rerender } = renderHook(
      ({ currentStockToken }: { currentStockToken: ISwapToken }) =>
        useSwapStockDisplaySnapshot({
          currentStockToken,
          payToken,
          tradeSide: ESwapStockTradeSide.Buy,
        }),
      {
        initialProps: {
          currentStockToken: stockA,
        },
      },
    );

    expect(result.current.snapshot?.balance?.value).toBe('10');
    const staleIdentityKey = result.current.identityKey;

    rerender({ currentStockToken: stockB });

    expect(result.current.identityKey).not.toBe(staleIdentityKey);
    expect(result.current.snapshot).toMatchObject({
      tokenDetail: undefined,
      chart: undefined,
      balance: { value: '10' },
    });
  });

  it('rejects a stale async patch after the pair owner changes', () => {
    const identityA = buildIdentity();
    seedSnapshot(identityA, '10');
    const { result, rerender } = renderHook(
      ({ currentStockToken }: { currentStockToken: ISwapToken }) =>
        useSwapStockDisplaySnapshot({
          currentStockToken,
          payToken,
          tradeSide: ESwapStockTradeSide.Buy,
        }),
      {
        initialProps: {
          currentStockToken: stockA,
        },
      },
    );
    const staleIdentityKey = result.current.identityKey;

    rerender({ currentStockToken: stockB });
    let committed = true;
    act(() => {
      committed = result.current.commitSnapshotPatch({
        expectedIdentityKey: staleIdentityKey,
        patch: {
          balance: {
            inputTokenKey: getTokenIdentityKey(payToken),
            value: '999',
          },
        },
      });
    });

    expect(committed).toBe(false);
    expect(
      (
        mockCache.get('wallet-a|account-a|default') as {
          balance?: { value: string };
        }
      ).balance?.value,
    ).toBe('10');
  });

  it('never restores another account snapshot during an account switch', () => {
    const identityA = buildIdentity();
    seedSnapshot(identityA, '10');
    const { result, rerender } = renderHook(() =>
      useSwapStockDisplaySnapshot({
        currentStockToken: stockA,
        payToken,
        tradeSide: ESwapStockTradeSide.Buy,
      }),
    );
    expect(result.current.snapshot?.balance?.value).toBe('10');

    mockActiveAccount = {
      ready: true,
      wallet: { id: 'wallet-b' },
      indexedAccount: { id: 'account-b' },
      deriveType: 'default',
    };
    rerender();

    expect(result.current.accountKey).toBe('wallet-b|account-b|default');
    expect(result.current.snapshot).toBeUndefined();
  });

  it('does not checkpoint preserved live state while the account owner is unresolved', () => {
    const liveTokenDetail = {
      address: stockA.contractAddress,
      decimals: stockA.decimals,
      logoUrl: '',
      name: stockA.symbol,
      networkId: stockA.networkId,
      price: '100',
      stock: { subtitle: stockA.symbol },
      symbol: stockA.symbol,
    } as IMarketTokenDetail;
    const { result, rerender } = renderHook(() =>
      useSwapStockDisplaySnapshot({
        currentStockToken: stockA,
        liveTokenDetail,
        payToken,
        tradeSide: ESwapStockTradeSide.Buy,
      }),
    );
    expect(result.current.accountKey).toBe('wallet-a|account-a|default');
    mockStorageSet.mockClear();

    mockActiveAccount = { ready: false };
    rerender();

    expect(result.current.accountKey).toBeUndefined();
    expect(result.current.identityKey).toBe('');
    expect(result.current.chart.ownerKey).toBe('');
    expect(result.current.amount.ownerKey).toBe('');
    expect(mockStorageSet).not.toHaveBeenCalled();
  });

  it('checkpoints token detail once per active identity instead of every live tick', () => {
    const buildLiveDetail = (
      token: ISwapToken,
      price: string,
    ): IMarketTokenDetail =>
      ({
        address: token.contractAddress,
        decimals: token.decimals,
        logoUrl: '',
        name: token.symbol,
        networkId: token.networkId,
        price,
        stock: {
          subtitle: token.symbol,
        },
        symbol: token.symbol,
      }) as IMarketTokenDetail;
    const { rerender } = renderHook(
      ({ currentStockToken, liveTokenDetail }) =>
        useSwapStockDisplaySnapshot({
          currentStockToken,
          liveTokenDetail,
          payToken,
          tradeSide: ESwapStockTradeSide.Buy,
        }),
      {
        initialProps: {
          currentStockToken: stockA,
          liveTokenDetail: buildLiveDetail(stockA, '100'),
        },
      },
    );

    expect(mockStorageSet).toHaveBeenCalledTimes(2);

    rerender({
      currentStockToken: stockA,
      liveTokenDetail: buildLiveDetail(stockA, '101'),
    });
    expect(mockStorageSet).toHaveBeenCalledTimes(2);

    rerender({
      currentStockToken: stockB,
      liveTokenDetail: buildLiveDetail(stockB, '200'),
    });
    expect(mockStorageSet).toHaveBeenCalledTimes(4);
  });

  it('restores chart before pay token lands and keeps its owner across side and currency changes', () => {
    const identityA = buildIdentity();
    mockCache.set(
      identityA.accountKey,
      mergeSwapStockDisplaySnapshot({
        identity: identityA,
        patch: {
          chart: {
            range: '1W',
            data: [[1_725_000_000, 213.49]],
          },
        },
      }),
    );
    const { result, rerender } = renderHook(
      ({
        selectedPayToken,
        side,
      }: {
        selectedPayToken?: ISwapToken;
        side: ESwapStockTradeSide;
      }) =>
        useSwapStockDisplaySnapshot({
          currentStockToken: stockA,
          payToken: selectedPayToken,
          tradeSide: side,
        }),
      {
        initialProps: {
          selectedPayToken: undefined as ISwapToken | undefined,
          side: ESwapStockTradeSide.Buy,
        },
      },
    );

    const chartOwnerKey = result.current.chart.ownerKey;
    expect(result.current.identityKey).toBe('');
    expect(result.current.chart.snapshot?.data).toEqual([
      [1_725_000_000, 213.49],
    ]);

    mockCurrency = 'eur';
    rerender({
      selectedPayToken: payToken,
      side: ESwapStockTradeSide.Sell,
    });

    expect(result.current.chart.ownerKey).toBe(chartOwnerKey);
    expect(result.current.chart.snapshot?.range).toBe('1W');
  });

  it('rejects a chart synchronously when the stock owner changes', () => {
    const identityA = buildIdentity();
    mockCache.set(
      identityA.accountKey,
      mergeSwapStockDisplaySnapshot({
        identity: identityA,
        patch: {
          chart: { range: '1W', data: [[1_725_000_000, 213.49]] },
        },
      }),
    );
    const { result, rerender } = renderHook(
      ({ stockToken }: { stockToken: ISwapToken }) =>
        useSwapStockDisplaySnapshot({
          currentStockToken: stockToken,
          payToken,
          tradeSide: ESwapStockTradeSide.Buy,
        }),
      { initialProps: { stockToken: stockA } },
    );
    const staleOwnerKey = result.current.chart.ownerKey;

    rerender({ stockToken: stockB });

    expect(result.current.chart.ownerKey).not.toBe(staleOwnerKey);
    expect(result.current.chart.snapshot).toBeUndefined();
    expect(
      result.current.chart.commitSnapshot({
        expectedOwnerKey: staleOwnerKey,
        chart: { range: '1M', data: [[1_725_000_000, 999]] },
      }),
    ).toBe(false);
  });

  it('restores display amount from account selection before live pay token lands', () => {
    const identityA = buildIdentity();
    mockCache.set(
      identityA.accountKey,
      mergeSwapStockDisplaySnapshot({
        identity: identityA,
        patch: {
          selection: {
            stockToken: stockA,
            payToken,
            tradeSide: ESwapStockTradeSide.Buy,
          },
          amount: { value: '42.5' },
        },
      }),
    );

    const { result } = renderHook(() =>
      useSwapStockDisplaySnapshot({
        currentStockToken: stockA,
        tradeSide: ESwapStockTradeSide.Buy,
      }),
    );

    expect(result.current.identityKey).toBe('');
    expect(result.current.restoredSelection).toMatchObject({ symbol: 'AAPL' });
    expect(result.current.restoredAmount).toBe('42.5');
    expect(result.current.amount.ownerKey).not.toBe('');
  });
});
