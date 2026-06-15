/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/marketV2';

import {
  useBtcMetadata,
  useBtcMetadataFromTokenDetail,
} from './useBtcMetadata';
import { useTokenDetail } from './useTokenDetail';

jest.mock('./useTokenDetail', () => ({
  useTokenDetail: jest.fn(),
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: (
      descriptor: { id: string },
      values?: { amount: number },
    ) => {
      if (descriptor.id === 'dexmarket.token_age_y')
        return `${values?.amount}Y`;
      if (descriptor.id === 'dexmarket.token_age_d')
        return `${values?.amount}D`;
      if (descriptor.id === 'dexmarket.token_age_h')
        return `${values?.amount}H`;
      if (descriptor.id === 'dexmarket_btc.next_halving_imminent')
        return 'Imminent';
      return descriptor.id;
    },
  }),
}));

const mockedUseTokenDetail = useTokenDetail as jest.MockedFunction<
  typeof useTokenDetail
>;

const baseReturn = {
  isLoading: false,
  tokenAddress: '',
  isNative: true,
  websocketConfig: undefined,
  perpsInfo: undefined,
  isReady: true,
  isStockToken: false,
};

const buildBtcMetadata = (
  overrides: Partial<NonNullable<IMarketTokenDetail['btcMetadata']>> = {},
): IMarketTokenDetail['btcMetadata'] => ({
  marketCap: '1545781500232',
  circulatingSupply: '20022175',
  remainingSupply: '977825',
  totalSupply: '21000000',
  fdv: '1545781500232',
  volume24h: '40906812011',
  blockHeight: '947103',
  blockReward: '3.125',
  nextHalving: {
    nextHalvingBlockHeight: 1_050_000,
    blocksUntilHalving: 102_897,
    estimatedSecondsUntilHalving: 66_630_489,
  },
  updatedAt: new Date().toISOString(),
  stale: false,
  ...overrides,
});

describe('useBtcMetadata', () => {
  afterEach(() => {
    mockedUseTokenDetail.mockReset();
  });

  it('returns null when networkId is not BTC', () => {
    mockedUseTokenDetail.mockReturnValue({
      ...baseReturn,
      tokenDetail: { btcMetadata: buildBtcMetadata() } as IMarketTokenDetail,
      networkId: 'evm--1',
    });
    const { result } = renderHook(() => useBtcMetadata());
    expect(result.current).toBeNull();
  });

  it('returns null when btcMetadata is missing', () => {
    mockedUseTokenDetail.mockReturnValue({
      ...baseReturn,
      tokenDetail: {} as IMarketTokenDetail,
      networkId: getNetworkIdsMap().btc,
    });
    const { result } = renderHook(() => useBtcMetadata());
    expect(result.current).toBeNull();
  });

  it('returns null when tokenDetail is not yet loaded', () => {
    mockedUseTokenDetail.mockReturnValue({
      ...baseReturn,
      tokenDetail: undefined,
      networkId: getNetworkIdsMap().btc,
    });
    const { result } = renderHook(() => useBtcMetadata());
    expect(result.current).toBeNull();
  });

  it('returns null when backend marks the metadata as stale', () => {
    mockedUseTokenDetail.mockReturnValue({
      ...baseReturn,
      tokenDetail: {
        btcMetadata: buildBtcMetadata({ stale: true }),
      } as IMarketTokenDetail,
      networkId: getNetworkIdsMap().btc,
    });
    const { result } = renderHook(() => useBtcMetadata());
    expect(result.current).toBeNull();
  });

  it('returns null when nextHalving metadata is missing', () => {
    mockedUseTokenDetail.mockReturnValue({
      ...baseReturn,
      tokenDetail: {
        btcMetadata: buildBtcMetadata({
          nextHalving: undefined as never,
        }),
      } as IMarketTokenDetail,
      networkId: getNetworkIdsMap().btc,
    });
    const { result } = renderHook(() => useBtcMetadata());
    expect(result.current).toBeNull();
  });

  it('returns null when nextHalving seconds are invalid', () => {
    mockedUseTokenDetail.mockReturnValue({
      ...baseReturn,
      tokenDetail: {
        btcMetadata: buildBtcMetadata({
          nextHalving: {
            nextHalvingBlockHeight: 1_050_000,
            blocksUntilHalving: 102_897,
            estimatedSecondsUntilHalving: Number.NaN,
          },
        }),
      } as IMarketTokenDetail,
      networkId: getNetworkIdsMap().btc,
    });
    const { result } = renderHook(() => useBtcMetadata());
    expect(result.current).toBeNull();
  });

  it('returns formatted struct for fresh BTC data', () => {
    mockedUseTokenDetail.mockReturnValue({
      ...baseReturn,
      tokenDetail: { btcMetadata: buildBtcMetadata() } as IMarketTokenDetail,
      networkId: getNetworkIdsMap().btc,
    });
    const { result } = renderHook(() => useBtcMetadata());
    expect(result.current).toEqual({
      marketCap: '1545781500232',
      circulatingSupply: '20022175',
      remainingSupply: '977825',
      totalSupply: '21000000',
      fdv: '1545781500232',
      volume24h: '40906812011',
      blockHeight: '947103',
      blockReward: '3.125',
      nextHalvingDisplay: '~2Y 41D',
    });
  });

  it('returns formatted struct from an explicit token detail source', () => {
    const { result } = renderHook(() =>
      useBtcMetadataFromTokenDetail({
        tokenDetail: { btcMetadata: buildBtcMetadata() } as IMarketTokenDetail,
        networkId: getNetworkIdsMap().btc,
      }),
    );

    expect(result.current).toEqual({
      marketCap: '1545781500232',
      circulatingSupply: '20022175',
      remainingSupply: '977825',
      totalSupply: '21000000',
      fdv: '1545781500232',
      volume24h: '40906812011',
      blockHeight: '947103',
      blockReward: '3.125',
      nextHalvingDisplay: '~2Y 41D',
    });
  });
});
