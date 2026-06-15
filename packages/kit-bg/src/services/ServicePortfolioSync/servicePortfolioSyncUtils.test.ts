/*
yarn test packages/kit-bg/src/services/ServicePortfolioSync/servicePortfolioSyncUtils.test.ts
*/
import type {
  EAppEventBusNames,
  IAppEventBusPayload,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { ICurrencyItem } from '@onekeyhq/shared/types/currency';
import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import { buildPortfolioSyncArtifacts } from './servicePortfolioSyncUtils';

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

describe('servicePortfolioSyncUtils', () => {
  test('builds portfolio.json bytes and mock archive bytes from a settled token list', () => {
    const payload: IAppEventBusPayload[EAppEventBusNames.AllNetworksTokenListSettled] =
      {
        accountAddress: '0x1234567890abcdef',
        accountId: 'evm--1',
        accountName: 'Account #1',
        aggregateTokenMap: {},
        deviceConnectId: 'connect-1',
        indexedAccountId: 'hd-1--m/44',
        networkId: 'all--networks',
        ownerAccountId: 'evm--1',
        ownerNetworkId: 'all--networks',
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
      totalFiat: string;
      tokens: { fiatValue: string; icon: string; price: number }[];
    };

    expect(portfolio).toMatchObject({
      account: {
        addressMasked: '0x123456...abcdef',
        label: 'Account #1',
      },
      currency: 'cny',
      totalFiat: '700',
      tokens: [
        {
          fiatValue: '700',
          icon: 'ethereum',
          price: 700,
        },
      ],
    });
    expect(artifacts.contentHash).toMatch(/^[\da-f]{64}$/);
    expect(artifacts.contentHash).not.toContain('cny');

    const view = new DataView(artifacts.mockArchiveBytes);
    expect(view.getUint32(0, true)).toBe(0x52_41_4b_4f);
    expect(view.getUint32(6, true)).toBe(1);
    expect(artifacts.mockArchiveBytes.byteLength).toBeGreaterThan(
      artifacts.portfolioJsonBytes.byteLength,
    );
  });
});
