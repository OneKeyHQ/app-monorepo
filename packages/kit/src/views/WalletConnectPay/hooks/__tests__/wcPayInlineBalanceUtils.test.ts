import BigNumber from 'bignumber.js';

import type { IFeeInfoUnit } from '@onekeyhq/shared/types/fee';
import type { IFetchTokenDetailItem } from '@onekeyhq/shared/types/token';

import {
  findWcPayInlineBalanceShortfall,
  formatWcPayInlineAmount,
  readWcPayInlineRawBalance,
} from '../wcPayInlineBalanceUtils';

import type { IWcPayInlineBalances } from '../wcPayInlineBalanceUtils';

// The module reaches the network through backgroundApiProxy; these tests only
// exercise its pure functions, so the proxy is stubbed to an empty object
// purely to keep the real one out of the import graph.
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));

// 21000 gas * 1 Gwei = 0.000021 ETH = 21_000_000_000_000 wei
const FEE_NATIVE = '0.000021';
const FEE_WEI = '21000000000000';

const feeInfo = {
  common: {
    feeDecimals: 9,
    feeSymbol: 'Gwei',
    nativeDecimals: 18,
    nativeSymbol: 'ETH',
    nativeTokenPrice: 2000,
  },
} as IFeeInfoUnit;

function buildDetail(
  overrides: Partial<{
    balance: string;
    balanceParsed: string;
    decimals: number;
  }> = {},
): IFetchTokenDetailItem {
  const { balance, balanceParsed, decimals = 18 } = overrides;
  return {
    info: {
      address: '',
      symbol: 'ETH',
      name: 'Ethereum',
      decimals,
      isNative: true,
    },
    balance,
    balanceParsed,
    fiatValue: '0',
    price: 1,
  } as unknown as IFetchTokenDetailItem;
}

function nativeBalances(balance: string): IWcPayInlineBalances {
  return { nativeBalance: new BigNumber(balance) };
}

function tokenBalances({
  native,
  token,
}: {
  native: string;
  token: string;
}): IWcPayInlineBalances {
  return {
    nativeBalance: new BigNumber(native),
    token: { balance: new BigNumber(token), symbol: 'USDC', decimals: 6 },
  };
}

describe('readWcPayInlineRawBalance', () => {
  it('reads the raw balance field', () => {
    expect(readWcPayInlineRawBalance(buildDetail({ balance: '123' }))).toEqual(
      new BigNumber('123'),
    );
  });

  it('treats a zero balance as a valid reading, not a missing one', () => {
    const result = readWcPayInlineRawBalance(buildDetail({ balance: '0' }));
    expect(result).toBeDefined();
    expect(result?.isZero()).toBe(true);
  });

  it('back-fills from balanceParsed when the raw balance is nil', () => {
    expect(
      readWcPayInlineRawBalance(
        buildDetail({ balanceParsed: '1.5', decimals: 6 }),
      ),
    ).toEqual(new BigNumber('1500000'));
  });

  it('returns undefined when neither field is usable', () => {
    expect(readWcPayInlineRawBalance(buildDetail())).toBeUndefined();
    expect(
      readWcPayInlineRawBalance(buildDetail({ balance: 'not-a-number' })),
    ).toBeUndefined();
  });

  it('rejects a negative balance rather than reading it as funds', () => {
    expect(
      readWcPayInlineRawBalance(buildDetail({ balance: '-1' })),
    ).toBeUndefined();
  });

  it('returns undefined for a missing detail (server returned [])', () => {
    expect(readWcPayInlineRawBalance(undefined)).toBeUndefined();
  });
});

describe('formatWcPayInlineAmount', () => {
  it('shifts a raw amount down by its decimals', () => {
    expect(formatWcPayInlineAmount(new BigNumber(FEE_WEI), 18)).toBe(
      FEE_NATIVE,
    );
  });
});

describe('findWcPayInlineBalanceShortfall', () => {
  const orderAmount = '1000000000000000000'; // 1 ETH, native branch

  it('requires fee + amount from the native balance on a native transfer', () => {
    const exact = new BigNumber(orderAmount).plus(FEE_WEI).toFixed();
    expect(
      findWcPayInlineBalanceShortfall({
        balances: nativeBalances(exact),
        feeInfo,
        totalNative: FEE_NATIVE,
        orderAmount,
      }),
    ).toBeUndefined();
  });

  it('reports a shortfall one wei below the exact requirement', () => {
    const oneWeiShort = new BigNumber(orderAmount)
      .plus(FEE_WEI)
      .minus(1)
      .toFixed();
    const shortfall = findWcPayInlineBalanceShortfall({
      balances: nativeBalances(oneWeiShort),
      feeInfo,
      totalNative: FEE_NATIVE,
      orderAmount,
    });
    expect(shortfall).toContain('Insufficient ETH');
  });

  it('reports a shortfall when the native balance covers only the amount', () => {
    expect(
      findWcPayInlineBalanceShortfall({
        balances: nativeBalances(orderAmount),
        feeInfo,
        totalNative: FEE_NATIVE,
        orderAmount,
      }),
    ).toContain('Insufficient ETH');
  });

  it('requires only the fee from native on a token transfer', () => {
    expect(
      findWcPayInlineBalanceShortfall({
        balances: tokenBalances({ native: FEE_WEI, token: '1000000' }),
        feeInfo,
        totalNative: FEE_NATIVE,
        orderAmount: '1000000',
      }),
    ).toBeUndefined();
  });

  it('reports the native symbol when a token transfer cannot cover the fee', () => {
    const shortfall = findWcPayInlineBalanceShortfall({
      balances: tokenBalances({
        native: new BigNumber(FEE_WEI).minus(1).toFixed(),
        token: '1000000',
      }),
      feeInfo,
      totalNative: FEE_NATIVE,
      orderAmount: '1000000',
    });
    expect(shortfall).toContain('Insufficient ETH');
  });

  it('reports the token symbol when the token balance is short', () => {
    const shortfall = findWcPayInlineBalanceShortfall({
      balances: tokenBalances({ native: FEE_WEI, token: '999999' }),
      feeInfo,
      totalNative: FEE_NATIVE,
      orderAmount: '1000000',
    });
    expect(shortfall).toContain('Insufficient USDC');
    expect(shortfall).toContain('1');
  });

  it('throws on an uncomputable fee rather than returning a verdict', () => {
    expect(() =>
      findWcPayInlineBalanceShortfall({
        balances: nativeBalances('0'),
        feeInfo,
        totalNative: 'not-a-number',
        orderAmount,
      }),
    ).toThrow('Network fee could not be computed');
  });

  it('throws on a zero or unparsable order amount', () => {
    expect(() =>
      findWcPayInlineBalanceShortfall({
        balances: nativeBalances(orderAmount),
        feeInfo,
        totalNative: FEE_NATIVE,
        orderAmount: '0',
      }),
    ).toThrow('Invalid payment amount');
    expect(() =>
      findWcPayInlineBalanceShortfall({
        balances: nativeBalances(orderAmount),
        feeInfo,
        totalNative: FEE_NATIVE,
        orderAmount: 'nope',
      }),
    ).toThrow('Invalid payment amount');
  });
});
