/*
yarn test packages/kit-bg/src/services/ServiceHardware/serviceHardwarePortfolioSync/serviceHardwarePortfolioSyncUtils.test.ts
*/
import type {
  EAppEventBusNames,
  IAppEventBusPayload,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { ICurrencyItem } from '@onekeyhq/shared/types/currency';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import {
  PORTFOLIO_SYNC_TRANSFER_COOLDOWN_MS,
  buildPortfolioSyncArtifacts,
  getPortfolioDisplayTimestamp,
  getPortfolioSyncCooldownRemainingMs,
} from './serviceHardwarePortfolioSyncUtils';

const currencyMap: Record<string, ICurrencyItem> = {
  cny: {
    id: 'cny',
    name: 'Chinese Yuan',
    type: ['fiat'],
    unit: '¥',
    value: '7',
  },
  usd: {
    id: 'usd',
    name: 'US Dollar',
    type: ['fiat'],
    unit: '$',
    value: '1',
  },
};

function buildToken(params: Partial<IAccountToken>): IAccountToken {
  return {
    $key: params.$key ?? 'eth',
    address: params.address ?? '0xeeee',
    decimals: params.decimals ?? 18,
    isNative: params.isNative ?? true,
    name: params.name ?? 'Ethereum',
    symbol: params.symbol ?? 'ETH',
    ...params,
  };
}

function buildFiat(params: Partial<ITokenFiat>): ITokenFiat {
  return {
    balance: params.balance ?? '1',
    balanceParsed: params.balanceParsed ?? '1',
    currency: params.currency ?? 'usd',
    fiatValue: params.fiatValue ?? '100',
    price: params.price ?? 100,
    ...params,
  };
}

describe('serviceHardwarePortfolioSyncUtils', () => {
  test('converts a Unix timestamp to the App local display time', () => {
    expect(
      getPortfolioDisplayTimestamp({
        timestamp: 1_784_592_000_000,
        timezoneOffsetMinutes: -540,
      }),
    ).toBe(1_784_624_400_000);
  });

  test('calculates the 20s hardware transfer cooldown window', () => {
    expect(
      getPortfolioSyncCooldownRemainingMs({
        lastTransferAt: undefined,
        now: 1000,
      }),
    ).toBe(0);

    expect(
      getPortfolioSyncCooldownRemainingMs({
        lastTransferAt: 1000,
        now: 6000,
      }),
    ).toBe(PORTFOLIO_SYNC_TRANSFER_COOLDOWN_MS - 5000);

    expect(
      getPortfolioSyncCooldownRemainingMs({
        lastTransferAt: 1000,
        now: PORTFOLIO_SYNC_TRANSFER_COOLDOWN_MS + 1000,
      }),
    ).toBe(0);
  });

  test('builds portfolio.json without client-generated colors', () => {
    const payload: IAppEventBusPayload[EAppEventBusNames.AllNetworksTokenListSettled] =
      {
        accountAddress: '0x1234567890abcdef',
        accountId: 'evm--1',
        accountName: 'Account #1',
        aggregateTokenMap: {},
        deviceConnectId: 'connect-1',
        indexedAccountId: 'hd-1--m/44',
        indexedAccountIndex: 0,
        indexedAccountName: 'Account #1',
        networkId: 'all--networks',
        ownerAccountId: 'evm--1',
        ownerNetworkId: 'all--networks',
        totalFiat: '2500.555',
        totalTokenCount: 8,
        tokenMap: {
          eth: buildFiat({ fiatValue: '100', price: 100 }),
          'fake-usdt': buildFiat({ fiatValue: '99', price: 1 }),
          'real-usdt': buildFiat({ fiatValue: '98', price: 1 }),
        },
        tokens: [
          buildToken({
            $key: 'eth',
            coingeckoId: 'ethereum',
            logoURI: 'https://example.com/eth.png',
            networkId: 'evm--1',
          }),
          buildToken({
            $key: 'fake-usdt',
            address: '0x0000000000000000000000000000000000000001',
            isNative: false,
            logoURI: 'https://example.com/usdt.png',
            name: 'Tether USD',
            networkId: 'evm--1',
            symbol: 'USDT',
          }),
          buildToken({
            $key: 'real-usdt',
            address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
            isNative: false,
            name: 'Tether USD',
            networkId: 'evm--1',
            symbol: 'USDT',
          }),
        ],
        walletId: 'hw-1',
        walletType: 'hw',
      };

    const artifacts = buildPortfolioSyncArtifacts({
      currencyMap,
      displayCurrency: { id: 'cny', symbol: '¥' },
      eventPayload: payload,
      timestamp: 1_780_900_000,
    });
    const portfolioJson = Buffer.from(artifacts.portfolioJsonBytes).toString(
      'utf8',
    );
    const portfolio = JSON.parse(portfolioJson) as {
      account: { addressMasked: string; label: string };
      otherTokens: {
        count: number;
        fiat: string;
        portfolioPercentage: number;
      };
      totalFiat: string;
      tokens: {
        contractAddress: string;
        fiatValue: string;
        iconName: string | null;
        isAllNetworks: boolean;
        isNative: boolean;
        logoURI: string;
        portfolioPercentage: number;
      }[];
    };

    expect(portfolio).toMatchObject({
      account: {
        addressMasked: 'Account #1',
        label: 'Account #1',
      },
      otherTokens: {
        count: 5,
        fiat: '¥421.56',
        portfolioPercentage: 16.86,
      },
      totalFiat: '¥2,500.56',
      tokens: [
        {
          contractAddress: '',
          fiatValue: '¥700.00',
          iconName: null,
          isAllNetworks: false,
          isNative: true,
          logoURI: 'https://example.com/eth.png',
          portfolioPercentage: 28,
        },
        {
          contractAddress: '0x0000000000000000000000000000000000000001',
          fiatValue: '¥693.00',
          iconName: null,
          isAllNetworks: false,
          isNative: false,
          logoURI: 'https://example.com/usdt.png',
          portfolioPercentage: 27.71,
        },
        {
          contractAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
          fiatValue: '¥686.00',
          iconName: null,
          isAllNetworks: false,
          isNative: false,
          logoURI: '',
          portfolioPercentage: 27.43,
        },
      ],
    });
    const mockPortfolioJson = JSON.parse(
      Buffer.from(artifacts.mockPortfolioJsonBytes).toString('utf8'),
    ) as typeof portfolio;

    expect(
      artifacts.mockPortfolio.tokens.map((token) => token.iconName),
    ).toEqual(['ETH', null, 'USDT']);
    expect(mockPortfolioJson.tokens.map((token) => token.iconName)).toEqual([
      'ETH',
      null,
      'USDT',
    ]);
    expect(Object.keys(portfolio).toSorted()).toEqual(
      [
        'account',
        'otherTokens',
        'tokenCount',
        'tokens',
        'totalFiat',
        'ts',
        'v',
      ].toSorted(),
    );
    expect(portfolio.tokens[0]).not.toHaveProperty('price');
    expect(portfolio.tokens[0]).not.toHaveProperty('change24h');
    expect(portfolio.tokens[0]).not.toHaveProperty('color');
    expect(mockPortfolioJson.tokens[0]).not.toHaveProperty('logoURI');
    expect(mockPortfolioJson.tokens[0]).not.toHaveProperty('color');
    expect(artifacts.contentHash).toMatch(/^[\da-f]{64}$/);

    const view = new DataView(artifacts.mockArchiveBytes);
    expect(view.getUint32(0, true)).toBe(0x52_41_4b_4f);
    expect(view.getUint32(6, true)).toBe(1);
    expect(artifacts.mockArchiveBytes.byteLength).toBeGreaterThan(
      artifacts.mockPortfolioJsonBytes.byteLength,
    );
  });

  test('builds portfolio account identity from indexed account metadata', () => {
    const payload: IAppEventBusPayload[EAppEventBusNames.AllNetworksTokenListSettled] =
      {
        accountAddress: 'AllNetworkAddress',
        accountId: 'allnetwork--account',
        accountName: 'AllNetwork Account',
        aggregateTokenMap: {},
        deviceConnectId: 'connect-1',
        indexedAccountId: 'hd-1--m/44',
        indexedAccountIndex: 2,
        indexedAccountName: 'Custom Account',
        networkId: 'all--networks',
        ownerAccountId: 'evm--1',
        ownerNetworkId: 'all--networks',
        totalFiat: '100',
        totalTokenCount: 1,
        tokenMap: {
          eth: buildFiat({ fiatValue: '100', price: 100 }),
        },
        tokens: [
          buildToken({
            $key: 'eth',
            coingeckoId: 'ethereum',
            networkId: 'evm--1',
          }),
        ],
        walletId: 'hw-1',
        walletType: 'hw',
      };

    const artifacts = buildPortfolioSyncArtifacts({
      currencyMap,
      displayCurrency: { id: 'usd', symbol: '$' },
      eventPayload: payload,
      timestamp: 1_780_900_000,
    });

    expect(artifacts.portfolio.account).toEqual({
      addressMasked: 'Account #3',
      label: 'Custom Account',
    });
  });

  test('keeps server logoURI aligned after filtering ineligible tokens', () => {
    const payload: IAppEventBusPayload[EAppEventBusNames.AllNetworksTokenListSettled] =
      {
        accountAddress: '0x1234567890abcdef',
        accountId: 'evm--1',
        accountName: 'Account #1',
        aggregateTokenMap: {},
        deviceConnectId: 'connect-1',
        indexedAccountId: 'hd-1--m/44',
        indexedAccountIndex: 0,
        indexedAccountName: 'Account #1',
        networkId: 'all--networks',
        ownerAccountId: 'evm--1',
        ownerNetworkId: 'all--networks',
        totalFiat: '100',
        totalTokenCount: 2,
        tokenMap: {
          advertising: buildFiat({ fiatValue: '50' }),
          eth: buildFiat({ fiatValue: '50' }),
        },
        tokens: [
          buildToken({
            $key: 'advertising',
            logoURI: 'https://example.com/advertising.png',
            symbol: 'Telegram @example',
          }),
          buildToken({
            $key: 'eth',
            logoURI: 'https://example.com/eth.png',
            symbol: 'ETH',
          }),
        ],
        walletId: 'hw-1',
        walletType: 'hw',
      };

    const artifacts = buildPortfolioSyncArtifacts({
      currencyMap,
      displayCurrency: { id: 'usd', symbol: '$' },
      eventPayload: payload,
      timestamp: 1_780_900_000,
    });

    expect(artifacts.portfolio.tokens).toHaveLength(1);
    expect(artifacts.portfolio.tokens[0]).toMatchObject({
      logoURI: 'https://example.com/eth.png',
      symbol: 'ETH',
    });
  });
});
