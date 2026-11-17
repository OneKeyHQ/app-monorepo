import type {
  IMarketTokenDetail,
  IMarketTokenDetailPreview,
} from '@onekeyhq/shared/types/marketV2';

import { buildMarketTradingViewBootstrap } from './marketTradingViewBootstrap';

const tokenAddress = '0x020bfc650a365f8bb26819deaabf3e21291018b4';
const networkId = 'evm--4663';

const preview: IMarketTokenDetailPreview = {
  address: tokenAddress,
  networkId,
  name: 'Cash Cat',
  symbol: 'CASHCAT',
  decimals: 8,
  selectedAt: 1,
};

describe('buildMarketTradingViewBootstrap', () => {
  it('builds chart params from the matching token preview', () => {
    expect(
      buildMarketTradingViewBootstrap({
        tokenAddress,
        networkId,
        tokenDetailPreview: preview,
        isNative: false,
      }),
    ).toEqual({
      tokenAddress,
      networkId,
      tokenSymbol: 'CASHCAT',
      decimal: 8,
      isNative: false,
    });
  });

  it('rejects a preview belonging to another token', () => {
    expect(
      buildMarketTradingViewBootstrap({
        tokenAddress,
        networkId,
        tokenDetailPreview: {
          ...preview,
          address: '0x0000000000000000000000000000000000000001',
        },
        isNative: false,
      }),
    ).toBeUndefined();
  });

  it('upgrades preview params with matching authoritative detail', () => {
    const tokenDetail = {
      address: tokenAddress,
      networkId,
      symbol: 'CASHCAT-V2',
      decimals: 9,
    } as IMarketTokenDetail;

    expect(
      buildMarketTradingViewBootstrap({
        tokenAddress,
        networkId,
        tokenDetail,
        tokenDetailPreview: preview,
        isNative: false,
      }),
    ).toMatchObject({
      tokenSymbol: 'CASHCAT-V2',
      decimal: 9,
    });
  });
});
