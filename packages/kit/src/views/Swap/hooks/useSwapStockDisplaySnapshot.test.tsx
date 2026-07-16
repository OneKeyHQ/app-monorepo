/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import {
  ESwapStockTradeSide,
  getTokenIdentityKey,
} from './swapStockChannelUtils';
import {
  buildSwapStockDisplayIdentityKey,
  mergeSwapStockDisplaySnapshot,
} from './swapStockDisplaySnapshotUtils';
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
        id: 'usd',
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
  });

  it('rejects the previous pair snapshot in the identity-changing render', () => {
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
    expect(result.current.snapshot).toBeUndefined();
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
      buildSwapStockDisplayIdentityKey(
        (
          mockCache.get('wallet-a|account-a|default') as {
            identity: ISwapStockDisplayIdentity;
          }
        ).identity,
      ),
    ).toBe(buildSwapStockDisplayIdentityKey(identityA));
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

    expect(mockStorageSet).toHaveBeenCalledTimes(1);

    rerender({
      currentStockToken: stockA,
      liveTokenDetail: buildLiveDetail(stockA, '101'),
    });
    expect(mockStorageSet).toHaveBeenCalledTimes(1);

    rerender({
      currentStockToken: stockB,
      liveTokenDetail: buildLiveDetail(stockB, '200'),
    });
    expect(mockStorageSet).toHaveBeenCalledTimes(2);
  });
});
