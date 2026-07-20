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
  getPortfolioSyncCooldownRemainingMs,
  isPortfolioSyncDevEnabled,
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
  test('requires both the Pro 2 master switch and explicit portfolio switch', () => {
    expect(
      isPortfolioSyncDevEnabled({
        devSettings: {
          enabled: true,
          settings: {
            enablePortfolioSyncDev: true,
            enablePro2TestMode: false,
          },
        },
      }),
    ).toBe(false);

    expect(
      isPortfolioSyncDevEnabled({
        devSettings: {
          enabled: true,
          settings: {
            enablePortfolioSyncDev: true,
            enablePro2TestMode: true,
          },
        },
      }),
    ).toBe(true);

    expect(
      isPortfolioSyncDevEnabled({
        devSettings: {
          enabled: true,
          settings: {
            enablePro2TestMode: true,
          },
        },
      }),
    ).toBe(false);
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

  test('builds server portfolio.json without trusted iconName and mock signed payload with iconName', () => {
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
            networkId: 'evm--1',
          }),
          buildToken({
            $key: 'fake-usdt',
            address: '0x0000000000000000000000000000000000000001',
            isNative: false,
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
      currency: string;
      otherTokens: { count: number; fiat: string };
      totalFiat: string;
      tokens: {
        contractAddress: string;
        fiatValue: string;
        iconName: string | null;
        isAllNetworks: boolean;
        isNative: boolean;
        price: number;
      }[];
    };

    expect(portfolio).toMatchObject({
      account: {
        addressMasked: 'Account #1',
        label: 'Account #1',
      },
      currency: 'cny',
      otherTokens: { count: 5, fiat: '421.56' },
      totalFiat: '2500.56',
      tokens: [
        {
          contractAddress: '',
          fiatValue: '700.00',
          iconName: null,
          isAllNetworks: false,
          isNative: true,
          price: 700,
        },
        {
          contractAddress: '0x0000000000000000000000000000000000000001',
          fiatValue: '693.00',
          iconName: null,
          isAllNetworks: false,
          isNative: false,
          price: 7,
        },
        {
          contractAddress: '0xdac17f958d2ee523a2206206994597c13d831ec7',
          fiatValue: '686.00',
          iconName: null,
          isAllNetworks: false,
          isNative: false,
          price: 7,
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
    expect(portfolio.tokens[0]).not.toHaveProperty('icon');
    expect(artifacts.contentHash).toMatch(/^[\da-f]{64}$/);
    expect(artifacts.contentHash).not.toContain('cny');

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
});
