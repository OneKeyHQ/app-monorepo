/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import type { IMarketTokenDetailPreview } from '@onekeyhq/shared/types/marketV2';

import { useMarketTradingViewParams } from './useTokenDetail';

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/marketV2', () => ({}));

const tokenAddress = '0x020bfc650a365f8bb26819deaabf3e21291018b4';
const networkId = 'evm--4663';
const tokenDetailPreview: IMarketTokenDetailPreview = {
  address: tokenAddress,
  networkId,
  name: 'Cash Cat',
  symbol: 'CASHCAT',
  decimals: 8,
  selectedAt: 1,
};
const initialProps: Parameters<typeof useMarketTradingViewParams>[0] = {
  tokenAddress,
  networkId,
  tokenDetailPreview,
  isNative: false,
};

describe('useMarketTradingViewParams', () => {
  it('keeps the matching preview bootstrap during a transient detail reset', () => {
    const { result, rerender } = renderHook(
      (props: Parameters<typeof useMarketTradingViewParams>[0]) =>
        useMarketTradingViewParams(props),
      {
        initialProps,
      },
    );

    expect(result.current).toMatchObject({
      tokenAddress,
      networkId,
      tokenSymbol: 'CASHCAT',
      decimal: 8,
      dataSource: 'polling',
    });

    rerender({
      tokenAddress,
      networkId,
      tokenDetailPreview: undefined,
      isNative: false,
    });

    expect(result.current?.tokenSymbol).toBe('CASHCAT');
  });

  it('clears a previous bootstrap when the active token changes', () => {
    const { result, rerender } = renderHook(
      (props: Parameters<typeof useMarketTradingViewParams>[0]) =>
        useMarketTradingViewParams(props),
      {
        initialProps,
      },
    );

    rerender({
      tokenAddress: '0x0000000000000000000000000000000000000002',
      networkId,
      tokenDetailPreview: undefined,
      isNative: false,
    });

    expect(result.current).toBeUndefined();
  });
});
