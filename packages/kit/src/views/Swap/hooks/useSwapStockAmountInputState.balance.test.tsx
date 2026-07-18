/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { getTokenIdentityKey } from './swapStockChannelUtils';
import {
  ESwapStockChannelAsyncStatus,
  ESwapStockTradeSide,
} from './useSwapStockChannel';
import { useSwapStockAmountInputState } from './useSwapStockTradeInputs';

import type { ISwapStockDisplaySnapshot } from './swapStockDisplaySnapshotUtils';
import type { IUseSwapStockChannelReturn } from './useSwapStockChannel';

const mockGetStockDisplaySnapshot = jest.fn<
  ISwapStockDisplaySnapshot | undefined,
  [string]
>();
const mockResetQuoteAction = jest.fn();
const mockSetFromTokenAmount = jest.fn();
const mockSetFromTokenBalance = jest.fn();
const mockSetSwapAlerts = jest.fn();
const mockSetToTokenAmount = jest.fn();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (
    _callback: unknown,
    _dependencies: unknown,
    options?: { initResult?: unknown; watchLoading?: boolean },
  ) => ({
    result: options?.initResult,
    isLoading: Boolean(options?.watchLoading),
  }),
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({ activeAccount: { ready: false } }),
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/swap', () => ({
  useSwapActions: () => ({
    current: { resetQuoteAction: mockResetQuoteAction },
  }),
  useSwapAlertsAtom: () => [undefined, mockSetSwapAlerts],
  useSwapFromTokenAmountAtom: () => [
    { value: '', isInput: true },
    mockSetFromTokenAmount,
  ],
  useSwapStockSelectedFromTokenBalanceAtom: () => ['', mockSetFromTokenBalance],
  useSwapToTokenAmountAtom: () => [
    { value: '', isInput: false },
    mockSetToTokenAmount,
  ],
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useCurrencyPersistAtom: () => [
    {
      currencyMap: {
        usd: { unit: '$' },
      },
    },
  ],
  useSettingsPersistAtom: () => [
    {
      currencyInfo: {
        id: 'usd',
        symbol: '$',
      },
    },
  ],
}));

jest.mock('./swapStockDisplaySnapshotStorage', () => ({
  swapStockDisplaySnapshotStorage: {
    get: (accountKey: string) => mockGetStockDisplaySnapshot(accountKey),
  },
}));

jest.mock('./useSwapStockChannel', () => ({
  ESwapStockChannelAsyncStatus: {
    Empty: 'empty',
    Idle: 'idle',
    Initializing: 'initializing',
    Ready: 'ready',
  },
  ESwapStockTradeSide: {
    Buy: 'buy',
    Sell: 'sell',
  },
}));

const stockToken: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '0xaapl',
  symbol: 'AAPLon',
  decimals: 18,
  isStock: true,
};

const payToken: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '0xusdc',
  symbol: 'USDC',
  decimals: 6,
};

const otherToken: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '0xusdt',
  symbol: 'USDT',
  decimals: 6,
};

function buildPersistedSnapshot({
  accountKey = 'account-1',
  inputToken = payToken,
}: {
  accountKey?: string;
  inputToken?: ISwapToken;
} = {}): ISwapStockDisplaySnapshot {
  const inputTokenKey = getTokenIdentityKey(inputToken);
  const now = Date.now();
  return {
    version: 2,
    identity: { accountKey: 'account-1' },
    balance: {
      identity: { accountKey, inputTokenKey },
      inputTokenKey,
      value: '12.5',
      updatedAt: now,
    },
    updatedAt: now,
  };
}

function buildColdStartStockChannel(
  tradeSide: ESwapStockTradeSide,
): IUseSwapStockChannelReturn {
  const stockTokenKey = getTokenIdentityKey(stockToken);
  const payTokenKey = getTokenIdentityKey(payToken);
  const isBuySide = tradeSide === ESwapStockTradeSide.Buy;
  return {
    currentStockToken: isBuySide ? stockToken : undefined,
    disableNativePayToken: false,
    payToken: isBuySide ? undefined : payToken,
    payTokenOptionsLoading: isBuySide,
    payTokenStatus: isBuySide
      ? ESwapStockChannelAsyncStatus.Initializing
      : ESwapStockChannelAsyncStatus.Ready,
    payTokens: [],
    selectablePayTokens: [],
    selectPayToken: jest.fn(),
    stockDisplay: {
      amount: {
        commitSnapshot: jest.fn(),
        identity: {
          accountKey: 'account-1',
          stockTokenKey,
          payTokenKey,
          tradeSide,
          amountSessionId: 0,
        },
        ownerKey: `account-1|${stockTokenKey}|${payTokenKey}|${tradeSide}`,
        restoredValue: '',
      },
      commitSnapshotPatch: jest.fn(),
      identityKey: 'persisted-display-owner',
      selection: {
        snapshot: {
          identity: { accountKey: 'account-1' },
          stockToken,
          payToken,
          tradeSide,
          updatedAt: Date.now(),
        },
      },
      snapshot: undefined,
    },
    stockTokenStatus: isBuySide
      ? ESwapStockChannelAsyncStatus.Ready
      : ESwapStockChannelAsyncStatus.Initializing,
    tradeSide,
  } as unknown as IUseSwapStockChannelReturn;
}

describe('useSwapStockAmountInputState persisted balance wiring', () => {
  beforeEach(() => {
    mockGetStockDisplaySnapshot.mockReset();
    mockResetQuoteAction.mockClear();
    mockSetFromTokenAmount.mockClear();
    mockSetFromTokenBalance.mockClear();
    mockSetSwapAlerts.mockClear();
    mockSetToTokenAmount.mockClear();
  });

  it.each([
    {
      inputToken: payToken,
      tradeSide: ESwapStockTradeSide.Buy,
    },
    {
      inputToken: stockToken,
      tradeSide: ESwapStockTradeSide.Sell,
    },
  ])(
    'renders the exact persisted $tradeSide balance before live execution hydration',
    ({ inputToken, tradeSide }) => {
      mockGetStockDisplaySnapshot.mockReturnValue(
        buildPersistedSnapshot({ inputToken }),
      );
      const stockChannel = buildColdStartStockChannel(tradeSide);

      const { result } = renderHook(() =>
        useSwapStockAmountInputState({ stockChannel }),
      );

      expect(mockGetStockDisplaySnapshot).toHaveBeenCalledWith('account-1');
      expect(result.current.inputToken).toMatchObject({
        contractAddress: inputToken.contractAddress,
        symbol: inputToken.symbol,
      });
      expect(result.current.displayBalance).toBe('12.5');
      expect(result.current.balanceLoading).toBe(false);
      expect(result.current.balanceReadyForExecution).toBe(false);
      expect(result.current.shouldRenderSkeleton).toBe(false);
    },
  );

  it.each([
    {
      mismatch: 'account',
      snapshot: buildPersistedSnapshot({ accountKey: 'account-2' }),
      tradeSide: ESwapStockTradeSide.Buy,
    },
    {
      mismatch: 'token',
      snapshot: buildPersistedSnapshot({ inputToken: otherToken }),
      tradeSide: ESwapStockTradeSide.Buy,
    },
    {
      mismatch: 'account',
      snapshot: buildPersistedSnapshot({
        accountKey: 'account-2',
        inputToken: stockToken,
      }),
      tradeSide: ESwapStockTradeSide.Sell,
    },
    {
      mismatch: 'token',
      snapshot: buildPersistedSnapshot({ inputToken: otherToken }),
      tradeSide: ESwapStockTradeSide.Sell,
    },
  ])(
    'does not render a persisted $tradeSide balance owned by another $mismatch',
    ({ snapshot, tradeSide }) => {
      mockGetStockDisplaySnapshot.mockReturnValue(snapshot);
      const stockChannel = buildColdStartStockChannel(tradeSide);

      const { result } = renderHook(() =>
        useSwapStockAmountInputState({ stockChannel }),
      );

      expect(result.current.displayBalance).toBeUndefined();
      expect(result.current.balanceReadyForExecution).toBe(false);
    },
  );
});
