import {
  EApproveType,
  type IEarnManagePageResponse,
  type IEarnToken,
  type IEarnTokenInfo,
} from '@onekeyhq/shared/types/staking';

import {
  buildSelectedBorrowManagePageRequestKey,
  resolveBorrowManageApproveType,
  resolveBorrowManageTokenInfo,
  resolveScopedBorrowManagePageResult,
  settleScopedBorrowManagePageRequest,
} from './WithdrawSection.utils';

const createToken = (symbol: string): IEarnToken => ({
  uniqueKey: `${symbol}-key`,
  address: `${symbol}-address`,
  decimals: 6,
  isNative: false,
  logoURI: `${symbol}-logo`,
  name: symbol,
  symbol,
  totalSupply: '1000',
  riskLevel: 0,
  coingeckoId: symbol.toLowerCase(),
  networkId: 'evm--1',
});

const fallbackTokenInfo: IEarnTokenInfo = {
  networkId: 'evm--1',
  provider: 'aave',
  vault: undefined,
  accountId: 'account-1',
  indexedAccountId: 'indexed-account-1',
  balanceParsed: '9',
  token: createToken('USDC'),
  price: '1',
};

describe('resolveBorrowManageApproveType', () => {
  it('normalizes unsupported Borrow Permit metadata to ERC20 approval', () => {
    expect(
      resolveBorrowManageApproveType({
        isBorrowTokenApproval: true,
        approveType: EApproveType.Permit,
      }),
    ).toBe(EApproveType.Legacy);
  });

  it('preserves generic Earn permit behavior', () => {
    expect(
      resolveBorrowManageApproveType({
        isBorrowTokenApproval: false,
        approveType: EApproveType.Permit,
      }),
    ).toBe(EApproveType.Permit);
  });
});

describe('selected Borrow manage-page request identity', () => {
  const requestParams = {
    accountId: 'account-1',
    networkId: 'evm--1',
    provider: 'aave',
    marketAddress: 'market-1',
    action: 'repay' as const,
  };

  it('changes when the selected reserve changes', () => {
    expect(
      buildSelectedBorrowManagePageRequestKey({
        ...requestParams,
        reserveAddress: 'reserve-a',
      }),
    ).not.toBe(
      buildSelectedBorrowManagePageRequestKey({
        ...requestParams,
        reserveAddress: 'reserve-b',
      }),
    );
  });

  it('fails closed while the previous selected reserve result is visible', () => {
    const currentRequestKey = buildSelectedBorrowManagePageRequestKey({
      ...requestParams,
      reserveAddress: 'reserve-b',
    });
    const previousRequestKey = buildSelectedBorrowManagePageRequestKey({
      ...requestParams,
      reserveAddress: 'reserve-a',
    });
    const previousData: IEarnManagePageResponse = {
      repay: {
        type: 'repay',
        disabled: false,
        text: { text: 'Repay' },
        data: {
          balance: '1',
          token: {
            info: createToken('DAI'),
            price: '1',
          },
        },
      },
    };

    expect(
      resolveScopedBorrowManagePageResult({
        requestKey: currentRequestKey,
        result: {
          requestKey: previousRequestKey,
          data: previousData,
        },
        isLoading: false,
      }),
    ).toEqual({
      data: undefined,
      isPending: true,
    });
  });

  it('settles a rejected current request without exposing stale data', async () => {
    const currentRequestKey = buildSelectedBorrowManagePageRequestKey({
      ...requestParams,
      reserveAddress: 'reserve-b',
    });
    const result = await settleScopedBorrowManagePageRequest({
      requestKey: currentRequestKey,
      request: jest.fn().mockRejectedValue(new Error('network unavailable')),
    });

    expect(result).toEqual({
      requestKey: currentRequestKey,
      failed: true,
    });
    expect(
      resolveScopedBorrowManagePageResult({
        requestKey: currentRequestKey,
        result,
        isLoading: false,
      }),
    ).toEqual({
      data: undefined,
      isPending: false,
    });
  });

  it('does not let a rejected previous request settle the current scope', async () => {
    const currentRequestKey = buildSelectedBorrowManagePageRequestKey({
      ...requestParams,
      reserveAddress: 'reserve-b',
    });
    const previousRequestKey = buildSelectedBorrowManagePageRequestKey({
      ...requestParams,
      reserveAddress: 'reserve-a',
    });
    const previousResult = await settleScopedBorrowManagePageRequest({
      requestKey: previousRequestKey,
      request: jest.fn().mockRejectedValue(new Error('stale failure')),
    });

    expect(
      resolveScopedBorrowManagePageResult({
        requestKey: currentRequestKey,
        result: previousResult,
        isLoading: false,
      }),
    ).toEqual({
      data: undefined,
      isPending: true,
    });
  });
});

describe('resolveBorrowManageTokenInfo', () => {
  it('keeps the route token info when no asset is selected', () => {
    expect(
      resolveBorrowManageTokenInfo({
        action: 'repay',
        hasSelectedAsset: false,
        selectedManagePageData: undefined,
        fallbackTokenInfo,
      }),
    ).toBe(fallbackTokenInfo);
  });

  it.each([
    ['repay', 'DAI', '0.99', '12'],
    ['withdraw', 'USDT', '1.01', '34'],
  ] as const)(
    'uses the selected %s action token, price, and balance',
    (action, symbol, price, balance) => {
      const selectedToken = createToken(symbol);
      const actionData = {
        disabled: false,
        text: { text: action },
        data: {
          balance,
          token: {
            info: selectedToken,
            price,
          },
        },
      };
      const selectedManagePageData: IEarnManagePageResponse =
        action === 'repay'
          ? { repay: { ...actionData, type: 'repay' } }
          : { withdraw: { ...actionData, type: 'withdraw' } };

      expect(
        resolveBorrowManageTokenInfo({
          action,
          hasSelectedAsset: true,
          selectedManagePageData,
          fallbackTokenInfo,
        }),
      ).toEqual({
        ...fallbackTokenInfo,
        balanceParsed: balance,
        token: selectedToken,
        price,
      });
    },
  );

  it('does not use another action token for the selected asset', () => {
    expect(
      resolveBorrowManageTokenInfo({
        action: 'repay',
        hasSelectedAsset: true,
        selectedManagePageData: {
          withdraw: {
            type: 'withdraw',
            disabled: false,
            text: { text: 'Withdraw' },
            data: {
              balance: '10',
              token: {
                info: createToken('DAI'),
                price: '1',
              },
            },
          },
        },
        fallbackTokenInfo,
      }),
    ).toBeUndefined();
  });

  it.each([
    ['loading response', undefined],
    [
      'response without an action token',
      {
        repay: {
          type: 'repay',
          disabled: false,
          text: { text: 'Repay' },
          data: { balance: '10' },
        },
      },
    ],
  ] as const)('fails closed for a selected asset with %s', (_, data) => {
    expect(
      resolveBorrowManageTokenInfo({
        action: 'repay',
        hasSelectedAsset: true,
        selectedManagePageData: data,
        fallbackTokenInfo,
      }),
    ).toBeUndefined();
  });
});
