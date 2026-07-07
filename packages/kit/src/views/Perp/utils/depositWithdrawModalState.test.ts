import type { IPerpsDepositToken } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import {
  getPerpsDepositMinAmountTextColor,
  mergePerpsDepositTokensPreservingOrder,
  shouldRefreshPerpsDepositQuote,
  shouldWaitForPerpsDepositQuoteDebounce,
} from './depositWithdrawModalState';

function buildDepositToken({
  networkId,
  contractAddress,
  symbol,
  balanceParsed,
}: {
  networkId: string;
  contractAddress: string;
  symbol: string;
  balanceParsed: string;
}): IPerpsDepositToken {
  return {
    networkId,
    contractAddress,
    symbol,
    balanceParsed,
    name: symbol,
    decimals: 6,
    networkLogoURI: '',
  };
}

describe('depositWithdrawModalState', () => {
  it('does not wait for a deposit quote when the current amount is empty', () => {
    expect(
      shouldWaitForPerpsDepositQuoteDebounce({
        selectedAction: 'deposit',
        isArbitrumUsdcToken: false,
        canQuoteDepositAmount: true,
        tokenAmount: '',
        debouncedTokenAmount: '1.23',
      }),
    ).toBe(false);

    expect(
      shouldWaitForPerpsDepositQuoteDebounce({
        selectedAction: 'deposit',
        isArbitrumUsdcToken: false,
        canQuoteDepositAmount: true,
        tokenAmount: '',
        debouncedTokenAmount: '0',
      }),
    ).toBe(false);
  });

  it('waits for a deposit quote when a positive amount has not reached debounce', () => {
    expect(
      shouldWaitForPerpsDepositQuoteDebounce({
        selectedAction: 'deposit',
        isArbitrumUsdcToken: false,
        canQuoteDepositAmount: true,
        tokenAmount: '1.23',
        debouncedTokenAmount: '',
      }),
    ).toBe(true);
  });

  it('does not wait for a deposit quote for Arbitrum USDC direct deposits', () => {
    expect(
      shouldWaitForPerpsDepositQuoteDebounce({
        selectedAction: 'deposit',
        isArbitrumUsdcToken: true,
        canQuoteDepositAmount: true,
        tokenAmount: '1.23',
        debouncedTokenAmount: '',
      }),
    ).toBe(false);
  });

  it('does not request quote refresh when the current amount is empty', () => {
    expect(
      shouldRefreshPerpsDepositQuote({
        selectedAction: 'deposit',
        isArbitrumUsdcToken: false,
        canQuoteDepositAmount: true,
        isQuoteLoading: false,
        tokenAmount: '',
        quoteToAmount: undefined,
      }),
    ).toBe(false);
  });

  it('requests quote refresh when a positive amount has no quote result', () => {
    expect(
      shouldRefreshPerpsDepositQuote({
        selectedAction: 'deposit',
        isArbitrumUsdcToken: false,
        canQuoteDepositAmount: true,
        isQuoteLoading: false,
        tokenAmount: '1.23',
        quoteToAmount: undefined,
      }),
    ).toBe(true);
  });

  it('uses red text for the deposit minimum amount hint', () => {
    expect(getPerpsDepositMinAmountTextColor('deposit')).toBe('$textCritical');
    expect(getPerpsDepositMinAmountTextColor('withdraw')).toBe('$textSubdued');
  });

  it('merges refreshed deposit tokens without reordering visible rows', () => {
    const usdc = buildDepositToken({
      networkId: 'evm--42161',
      contractAddress: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
      symbol: 'USDC',
      balanceParsed: '1',
    });
    const eth = buildDepositToken({
      networkId: 'evm--1',
      contractAddress: '',
      symbol: 'ETH',
      balanceParsed: '0.1',
    });
    const matic = buildDepositToken({
      networkId: 'evm--137',
      contractAddress: '',
      symbol: 'POL',
      balanceParsed: '20',
    });
    const hiddenToken = buildDepositToken({
      networkId: 'evm--10',
      contractAddress: '',
      symbol: 'OP',
      balanceParsed: '3',
    });

    const merged = mergePerpsDepositTokensPreservingOrder({
      currentTokens: [usdc, hiddenToken, eth],
      nextTokens: [
        { ...eth, balanceParsed: '0.2' },
        matic,
        { ...usdc, balanceParsed: '2' },
      ],
    });

    expect(merged.map((token) => token.symbol)).toEqual(['USDC', 'ETH', 'POL']);
    expect(merged.map((token) => token.balanceParsed)).toEqual([
      '2',
      '0.2',
      '20',
    ]);
  });
});
