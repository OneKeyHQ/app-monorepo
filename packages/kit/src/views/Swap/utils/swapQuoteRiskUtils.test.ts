import type {
  IFetchQuoteResult,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import { getSwapQuoteTokenRisk } from './swapQuoteRiskUtils';

const fromToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '',
  symbol: 'ETH',
  decimals: 18,
};
const toToken: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0xAbC',
  symbol: 'TOKEN',
  decimals: 18,
};
const quote = {
  fromTokenInfo: fromToken,
  toTokenInfo: toToken,
  honeypot: true,
  lowLiquidity: true,
} as IFetchQuoteResult;
const params = { quote, fromToken, toToken };

describe('swap quote token risk', () => {
  it('prioritizes honeypot over low liquidity without changing quote action state', () => {
    expect(getSwapQuoteTokenRisk(params)).toBe('honeypot');
    expect(
      getSwapQuoteTokenRisk({
        ...params,
        quote: { ...quote, honeypot: false },
      }),
    ).toBe('lowLiquidity');
    expect(
      getSwapQuoteTokenRisk({
        ...params,
        quote: { ...quote, honeypot: false, lowLiquidity: false },
      }),
    ).toBeUndefined();
  });

  it('does not show stale token, missing, loading or failed quote warnings', () => {
    expect(
      getSwapQuoteTokenRisk({
        ...params,
        toToken: { ...toToken, contractAddress: '0xother' },
      }),
    ).toBeUndefined();
    expect(
      getSwapQuoteTokenRisk({
        ...params,
        fromToken: { ...fromToken, networkId: 'evm--56' },
      }),
    ).toBeUndefined();
    expect(
      getSwapQuoteTokenRisk({ ...params, isLoading: true }),
    ).toBeUndefined();
    expect(
      getSwapQuoteTokenRisk({ ...params, hasQuoteError: true }),
    ).toBeUndefined();
    expect(
      getSwapQuoteTokenRisk({
        ...params,
        quote: { ...quote, errorMessage: 'failed' },
      }),
    ).toBeUndefined();
    expect(
      getSwapQuoteTokenRisk({ ...params, quote: undefined }),
    ).toBeUndefined();
  });

  it('keeps risk when EVM token address casing or quote metadata changes', () => {
    expect(
      getSwapQuoteTokenRisk({
        ...params,
        toToken: { ...toToken, contractAddress: '0xabc', symbol: 'UPDATED' },
      }),
    ).toBe('honeypot');
  });
});
