import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { ESwapStockTradeSide } from './useSwapStockChannel';
import {
  buildStockAmountQuoteIntent,
  commitStockAmountInputSnapshot,
  isStockAmountInputEditable,
  markStockAmountOwnerInitialized,
  resolveStockAmountAtomInitialization,
  resolveStockAmountDisplayOwnerKey,
  resolveStockAmountInputTokens,
  resolveStockAmountInputValue,
  resolveStockAmountOwnerTransition,
  resolveStockRenderedBalanceSnapshot,
} from './useSwapStockTradeInputs';

import type {
  ISwapStockDisplayAmountIdentity,
  ISwapStockDisplaySelectionSnapshot,
  ISwapStockDisplaySnapshot,
} from './swapStockDisplaySnapshotUtils';

const mockGetStockDisplaySnapshot = jest.fn<
  ISwapStockDisplaySnapshot | undefined,
  [string]
>();

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
jest.mock('./swapStockDisplaySnapshotStorage', () => ({
  swapStockDisplaySnapshotStorage: {
    get: (accountKey: string) => mockGetStockDisplaySnapshot(accountKey),
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
  amountSessionId: 0,
};

describe('useSwapStockTradeInputs amount ownership helpers', () => {
  beforeEach(() => {
    mockGetStockDisplaySnapshot.mockReset();
  });

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

  it('uses an exact stored balance only for display before the execution token hydrates', () => {
    const { displayInputToken, executionInputToken } =
      resolveStockAmountInputTokens({
        currentStockToken: appleStockToken,
        payToken: undefined,
        selection: buildSelection(),
        tradeSide: ESwapStockTradeSide.Buy,
      });
    const now = Date.now();
    mockGetStockDisplaySnapshot.mockReturnValue({
      version: 2,
      identity: { accountKey: 'account-1' },
      balance: {
        identity: {
          accountKey: 'account-1',
          inputTokenKey: 'evm--56:0xusdc:token',
        },
        inputTokenKey: 'evm--56:0xusdc:token',
        value: '12.5',
        updatedAt: now,
      },
      updatedAt: now,
    });

    const displayBalance = resolveStockRenderedBalanceSnapshot({
      displayAccountKey: 'account-1',
      displayInputToken,
      matchingSnapshotBalance: undefined,
    });

    expect(executionInputToken).toBeUndefined();
    expect(mockGetStockDisplaySnapshot).toHaveBeenCalledWith('account-1');
    expect(displayBalance?.value).toBe('12.5');
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

  it('rebinds the current input across a stock-only owner change without restoring target history', () => {
    const transition = resolveStockAmountOwnerTransition({
      amountAtomOwnerState: {
        ownerKey: 'account-1|aapl|usdc|buy',
        identity: appleUsdcBuyIdentity,
        initialized: true,
        hasResolvedOwner: true,
      },
      atomValue: '10',
      nextIdentity: {
        ...appleUsdcBuyIdentity,
        stockTokenKey: 'evm--56:0xmu:token',
      },
      nextOwnerKey: 'account-1|mu|usdc|buy',
      restoredValue: '99',
    });

    expect(transition).toMatchObject({
      atomValue: '10',
      displayValue: '10',
      ownerChanged: true,
      shouldCommitSnapshot: true,
      shouldPreserveInput: true,
      nextState: {
        ownerKey: 'account-1|mu|usdc|buy',
        initialized: true,
      },
    });
    expect(
      resolveStockAmountInputValue({
        amountAtomOwnerState: transition.nextState,
        amountOwnerKey: 'account-1|mu|usdc|buy',
        atomValue: transition.atomValue,
        restoredValue: '99',
      }),
    ).toBe('10');
  });

  it('rebinds the current input across a pay-token owner change in the same runtime', () => {
    const transition = resolveStockAmountOwnerTransition({
      amountAtomOwnerState: {
        ownerKey: 'account-1|aapl|usdc|buy',
        identity: appleUsdcBuyIdentity,
        initialized: true,
        hasResolvedOwner: true,
      },
      atomValue: '10',
      nextIdentity: {
        ...appleUsdcBuyIdentity,
        payTokenKey: 'evm--56:0xusdt:token',
      },
      nextOwnerKey: 'account-1|aapl|usdt|buy',
      restoredValue: '99',
    });

    expect(transition).toMatchObject({
      atomValue: '10',
      displayValue: '10',
      ownerChanged: true,
      shouldCommitSnapshot: true,
      shouldPreserveInput: true,
      nextState: {
        ownerKey: 'account-1|aapl|usdt|buy',
        initialized: true,
      },
    });
  });

  it('rebinds the current input when stock and pay token change together in the same runtime', () => {
    const transition = resolveStockAmountOwnerTransition({
      amountAtomOwnerState: {
        ownerKey: 'account-1|aapl|usdc|buy',
        identity: appleUsdcBuyIdentity,
        initialized: true,
        hasResolvedOwner: true,
      },
      atomValue: '10',
      nextIdentity: {
        ...appleUsdcBuyIdentity,
        stockTokenKey: 'evm--56:0xmu:token',
        payTokenKey: 'evm--56:0xusdt:token',
      },
      nextOwnerKey: 'account-1|mu|usdt|buy',
      restoredValue: '99',
    });

    expect(transition).toMatchObject({
      atomValue: '10',
      displayValue: '10',
      ownerChanged: true,
      shouldCommitSnapshot: true,
      shouldPreserveInput: true,
      nextState: {
        ownerKey: 'account-1|mu|usdt|buy',
        initialized: true,
      },
    });
  });

  it.each([
    {
      name: 'account',
      identity: { ...appleUsdcBuyIdentity, accountKey: 'account-2' },
    },
    {
      name: 'trade side',
      identity: {
        ...appleUsdcBuyIdentity,
        tradeSide: ESwapStockTradeSide.Sell,
      },
    },
  ])('fails closed when the $name owner changes', ({ identity }) => {
    const transition = resolveStockAmountOwnerTransition({
      amountAtomOwnerState: {
        ownerKey: 'account-1|aapl|usdc|buy',
        identity: appleUsdcBuyIdentity,
        initialized: true,
        hasResolvedOwner: true,
      },
      atomValue: '10',
      nextIdentity: identity,
      nextOwnerKey: `next-${identity.accountKey}-${identity.payTokenKey}-${identity.tradeSide}`,
      restoredValue: '99',
    });

    expect(transition).toMatchObject({
      atomValue: '',
      displayValue: '',
      shouldCommitSnapshot: true,
      shouldPreserveInput: false,
      nextState: { initialized: true },
    });
  });

  it('allows only the first resolved owner to restore its exact snapshot', () => {
    const transition = resolveStockAmountOwnerTransition({
      amountAtomOwnerState: {
        ownerKey: '',
        initialized: false,
        hasResolvedOwner: false,
      },
      atomValue: '999',
      nextIdentity: appleUsdcBuyIdentity,
      nextOwnerKey: 'account-1|aapl|usdc|buy',
      restoredValue: '8.25',
    });

    expect(transition).toMatchObject({
      atomValue: '',
      displayValue: '8.25',
      shouldCommitSnapshot: false,
      shouldPreserveInput: false,
      nextState: {
        initialized: false,
        hasResolvedOwner: true,
      },
    });
  });

  it('preserves owner identity through initialization and user input before switching stocks', () => {
    const firstOwnerTransition = resolveStockAmountOwnerTransition({
      amountAtomOwnerState: {
        ownerKey: '',
        initialized: false,
        hasResolvedOwner: false,
      },
      atomValue: '',
      nextIdentity: appleUsdcBuyIdentity,
      nextOwnerKey: 'account-1|aapl|usdc|buy',
      restoredValue: '8.25',
    });
    const initialization = resolveStockAmountAtomInitialization({
      amountAtomOwnerState: firstOwnerTransition.nextState,
      amountOwnerKey: 'account-1|aapl|usdc|buy',
      canonicalOwnerReady: true,
      restoredValue: '8.25',
    });
    expect(initialization).toEqual({
      shouldInitialize: true,
      seedValue: '8.25',
    });

    const initializedOwnerState = markStockAmountOwnerInitialized({
      amountAtomOwnerState: firstOwnerTransition.nextState,
      amountIdentity: appleUsdcBuyIdentity,
      amountOwnerKey: 'account-1|aapl|usdc|buy',
    });
    const userInputOwnerState = markStockAmountOwnerInitialized({
      amountAtomOwnerState: initializedOwnerState,
      amountIdentity: appleUsdcBuyIdentity,
      amountOwnerKey: 'account-1|aapl|usdc|buy',
    });
    expect(userInputOwnerState).toMatchObject({
      identity: appleUsdcBuyIdentity,
      initialized: true,
      hasResolvedOwner: true,
    });

    const stockSwitchTransition = resolveStockAmountOwnerTransition({
      amountAtomOwnerState: userInputOwnerState,
      atomValue: '10',
      nextIdentity: {
        ...appleUsdcBuyIdentity,
        stockTokenKey: 'evm--56:0xmu:token',
      },
      nextOwnerKey: 'account-1|mu|usdc|buy',
      restoredValue: '99',
    });
    expect(stockSwitchTransition).toMatchObject({
      atomValue: '10',
      displayValue: '10',
      shouldPreserveInput: true,
      nextState: {
        ownerKey: 'account-1|mu|usdc|buy',
        initialized: true,
      },
    });
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
