import { readLoanRoutePosition } from './useLoanRouterFacts';

import type { ILoanRoute } from './loanRouter.utils';

const mockGetReserves = jest.fn<Promise<unknown>, [unknown]>();
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStaking: {
      getBorrowReserves: (params: unknown) => mockGetReserves(params),
      getBorrowHealthFactor: jest.fn(async () => undefined),
    },
  },
}));

const route: ILoanRoute = {
  key: 'market',
  marketLabel: 'Aave',
  market: {
    provider: 'aave',
    networkId: 'evm--1',
    marketAddress: 'market',
    name: 'Aave',
    logoURI: '',
    network: {
      networkId: 'evm--1',
      network: 'Ethereum',
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
      logoURI: '',
      indexerSupported: true,
      fallbackSupported: true,
      nativeTokenAddress: '',
      coingeckoPlatform: 'ethereum',
      nativeTokenCoingeckoId: 'ethereum',
    },
  },
  collateral: {
    reserveAddress: 'wbtc',
    symbol: 'WBTC',
    name: 'WBTC',
    logoURI: '',
    address: 'wbtc',
    decimals: 8,
    networkId: 'evm--1',
    supplyApy: 1,
    liquidationLtv: 0.8,
  },
  borrow: {
    reserveAddress: 'usdc',
    symbol: 'USDC',
    name: 'USDC',
    logoURI: '',
    address: 'usdc',
    decimals: 6,
    networkId: 'evm--1',
    borrowApy: 2,
    borrowFactor: 1,
  },
};

it('keeps supplied balance as a fixed decimal through the position read', async () => {
  const reserves = {
    supplied: {
      assets: [
        {
          reserveAddress: 'wbtc',
          token: { symbol: 'WBTC' },
          suppliedAmount: { amount: '1e-8' },
        },
      ],
    },
    borrowed: { assets: [] },
    supply: { assets: [] },
    borrow: { assets: [] },
  };
  mockGetReserves.mockResolvedValueOnce(reserves);
  await expect(
    readLoanRoutePosition({ route, networkAccountId: 'account' }),
  ).resolves.toEqual(
    expect.objectContaining({ collateralSupplied: '0.00000001' }),
  );
});

it('does not treat an invalid matching supplied balance as zero', async () => {
  const reserves = {
    supplied: {
      assets: [
        {
          reserveAddress: 'wbtc',
          token: { symbol: 'WBTC' },
          suppliedAmount: { amount: 'invalid' },
        },
      ],
    },
    borrowed: { assets: [] },
    supply: { assets: [] },
    borrow: { assets: [] },
  };
  mockGetReserves.mockResolvedValueOnce(reserves);
  await expect(
    readLoanRoutePosition({ route, networkAccountId: 'account' }),
  ).resolves.toBeUndefined();
});
