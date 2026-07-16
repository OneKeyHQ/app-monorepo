import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { ESwapStockTradeSide } from './useSwapStockChannel';
import {
  buildStockAmountQuoteIntent,
  commitStockAmountInputSnapshot,
  isStockAmountInputEditable,
  resolveStockAmountAtomInitialization,
  resolveStockAmountDisplayOwnerKey,
  resolveStockAmountInputTokens,
  resolveStockAmountInputValue,
} from './useSwapStockTradeInputs';

import type {
  ISwapStockDisplayAmountIdentity,
  ISwapStockDisplaySelectionSnapshot,
} from './swapStockDisplaySnapshotUtils';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: jest.fn(),
}));
jest.mock('./useSwapStockChannel', () => ({
  ESwapStockChannelAsyncStatus: {
    Idle: 'idle',
    Initializing: 'initializing',
    Ready: 'ready',
    Empty: 'empty',
  },
  ESwapStockTradeSide: {
    Buy: 'buy',
    Sell: 'sell',
  },
}));

const appleStockToken: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '0xaapl',
  symbol: 'AAPL',
  decimals: 18,
  isStock: true,
};

const micronStockToken: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '0xmu',
  symbol: 'MU',
  decimals: 18,
  isStock: true,
};

const usdcToken: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '0xusdc',
  symbol: 'USDC',
  decimals: 6,
};

const usdtToken: ISwapToken = {
  networkId: 'evm--56',
  contractAddress: '0xusdt',
  symbol: 'USDT',
  decimals: 6,
};

function buildSelection(
  overrides: Partial<ISwapStockDisplaySelectionSnapshot> = {},
): ISwapStockDisplaySelectionSnapshot {
  return {
    identity: { accountKey: 'account-1' },
    stockToken: appleStockToken,
    payToken: usdcToken,
    tradeSide: ESwapStockTradeSide.Buy,
    updatedAt: 1,
    ...overrides,
  };
}

const appleUsdcBuyIdentity: ISwapStockDisplayAmountIdentity = {
  accountKey: 'account-1',
  stockTokenKey: 'evm--56:0xaapl:token',
  payTokenKey: 'evm--56:0xusdc:token',
  tradeSide: ESwapStockTradeSide.Buy,
};

describe('useSwapStockTradeInputs amount ownership helpers', () => {
  it('uses an account-owned selection only as the display token while live execution is absent', () => {
    const result = resolveStockAmountInputTokens({
      currentStockToken: appleStockToken,
      payToken: undefined,
      selection: buildSelection(),
      tradeSide: ESwapStockTradeSide.Buy,
    });

    expect(result.executionInputToken).toBeUndefined();
    expect(result.displayInputToken).toMatchObject({
      contractAddress: usdcToken.contractAddress,
      symbol: usdcToken.symbol,
    });
    expect(
      isStockAmountInputEditable({
        amountOwnerKey: 'owner-1',
        canonicalOwnerReady: false,
      }),
    ).toBe(false);
  });

  it('always prefers the live canonical token for display and execution once it lands', () => {
    const result = resolveStockAmountInputTokens({
      currentStockToken: appleStockToken,
      payToken: usdtToken,
      selection: buildSelection(),
      tradeSide: ESwapStockTradeSide.Buy,
    });

    expect(result.executionInputToken).toBe(usdtToken);
    expect(result.displayInputToken).toBe(usdtToken);
    expect(
      isStockAmountInputEditable({
        amountOwnerKey: 'owner-1',
        canonicalOwnerReady: true,
      }),
    ).toBe(true);
  });

  it('rejects a restored display token owned by another stock or side', () => {
    expect(
      resolveStockAmountInputTokens({
        currentStockToken: micronStockToken,
        selection: buildSelection(),
        tradeSide: ESwapStockTradeSide.Buy,
      }).displayInputToken,
    ).toBeUndefined();
    expect(
      resolveStockAmountInputTokens({
        currentStockToken: undefined,
        selection: buildSelection(),
        tradeSide: ESwapStockTradeSide.Sell,
      }).displayInputToken,
    ).toBeUndefined();
  });

  it('fails closed when the amount owner differs by stock, pay token, or side', () => {
    const params = {
      amountIdentity: appleUsdcBuyIdentity,
      amountOwnerKey: 'account-1|aapl|usdc|buy',
      currentStockToken: appleStockToken,
      payToken: usdcToken,
      tradeSide: ESwapStockTradeSide.Buy,
    };
    expect(resolveStockAmountDisplayOwnerKey(params)).toBe(
      params.amountOwnerKey,
    );
    expect(
      resolveStockAmountDisplayOwnerKey({
        ...params,
        currentStockToken: micronStockToken,
      }),
    ).toBe('');
    expect(
      resolveStockAmountDisplayOwnerKey({
        ...params,
        payToken: usdtToken,
      }),
    ).toBe('');
    expect(
      resolveStockAmountDisplayOwnerKey({
        ...params,
        tradeSide: ESwapStockTradeSide.Sell,
      }),
    ).toBe('');
  });

  it('projects the restored amount on the first frame instead of a stale atom owner', () => {
    expect(
      resolveStockAmountInputValue({
        amountAtomOwnerState: {
          ownerKey: 'old-owner',
          initialized: true,
        },
        amountOwnerKey: 'new-owner',
        atomValue: '999',
        restoredValue: '12.5',
      }),
    ).toBe('12.5');
    expect(
      resolveStockAmountInputValue({
        amountAtomOwnerState: {
          ownerKey: 'old-owner',
          initialized: true,
        },
        amountOwnerKey: 'new-owner',
        atomValue: '999',
        restoredValue: '',
      }),
    ).toBe('');
  });

  it('uses atom input only after that exact owner has initialized', () => {
    expect(
      resolveStockAmountInputValue({
        amountAtomOwnerState: {
          ownerKey: 'owner-1',
          initialized: true,
        },
        amountOwnerKey: 'owner-1',
        atomValue: '7',
        restoredValue: '3',
      }),
    ).toBe('7');
  });

  it('seeds only an exact canonical owner and publishes it as fresh quote intent', () => {
    expect(
      resolveStockAmountAtomInitialization({
        amountAtomOwnerState: {
          ownerKey: 'owner-1',
          initialized: false,
        },
        amountOwnerKey: 'owner-1',
        canonicalOwnerReady: true,
        restoredValue: '8.25',
      }),
    ).toEqual({ shouldInitialize: true, seedValue: '8.25' });
    expect(buildStockAmountQuoteIntent('8.25')).toEqual({
      value: '8.25',
      isInput: true,
    });
    expect(
      resolveStockAmountAtomInitialization({
        amountAtomOwnerState: {
          ownerKey: 'old-owner',
          initialized: false,
        },
        amountOwnerKey: 'owner-1',
        canonicalOwnerReady: true,
        restoredValue: '8.25',
      }).shouldInitialize,
    ).toBe(false);
    expect(
      resolveStockAmountAtomInitialization({
        amountAtomOwnerState: {
          ownerKey: 'owner-1',
          initialized: false,
        },
        amountOwnerKey: 'owner-1',
        canonicalOwnerReady: false,
        restoredValue: '8.25',
      }).shouldInitialize,
    ).toBe(false);
  });

  it('preserves an explicit empty-string tombstone as quote-clearing intent', () => {
    const initialization = resolveStockAmountAtomInitialization({
      amountAtomOwnerState: {
        ownerKey: 'owner-1',
        initialized: false,
      },
      amountOwnerKey: 'owner-1',
      canonicalOwnerReady: true,
      restoredValue: '',
    });

    expect(initialization).toEqual({
      shouldInitialize: true,
      seedValue: '',
    });
    expect(
      buildStockAmountQuoteIntent(initialization.seedValue ?? 'x'),
    ).toEqual({
      value: '',
      isInput: true,
    });
  });

  it('commits user input immediately only for the current canonical owner', () => {
    const commitSnapshot = jest.fn(() => true);
    const common = {
      amountAtomOwnerState: {
        ownerKey: 'owner-1',
        initialized: true,
      },
      canonicalOwnerKey: 'owner-1',
      commitSnapshot,
      expectedOwnerKey: 'owner-1',
    };

    expect(commitStockAmountInputSnapshot({ ...common, value: '' })).toBe(true);
    expect(commitSnapshot).toHaveBeenCalledWith({
      expectedOwnerKey: 'owner-1',
      value: '',
    });

    commitSnapshot.mockClear();
    expect(
      commitStockAmountInputSnapshot({
        ...common,
        canonicalOwnerKey: 'owner-2',
        value: '1',
      }),
    ).toBe(false);
    expect(
      commitStockAmountInputSnapshot({
        ...common,
        amountAtomOwnerState: {
          ownerKey: 'owner-2',
          initialized: true,
        },
        value: '1',
      }),
    ).toBe(false);
    expect(commitSnapshot).not.toHaveBeenCalled();
  });
});
