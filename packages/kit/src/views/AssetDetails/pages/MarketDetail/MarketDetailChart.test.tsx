/**
 * @jest-environment jsdom
 */

import type { PropsWithChildren } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketTokenDetail } from '@onekeyhq/shared/types/market';

import { MarketDetailChart } from './MarketDetailChart';

jest.mock('@onekeyhq/components', () => ({
  Stack: ({ children }: PropsWithChildren) => <div>{children}</div>,
  Spinner: () => null,
}));
jest.mock('@onekeyhq/kit/src/components/TradingView/TradingViewV1', () => ({
  TradingViewV1: ({ onLoadError }: { onLoadError: () => void }) => (
    <button type="button" onClick={onLoadError}>
      Exchange chart
    </button>
  ),
}));
jest.mock('../../../Market/components/TokenPriceChart', () => ({
  TokenPriceChart: ({ coinGeckoId }: { coinGeckoId: string }) => (
    <div>App chart: {coinGeckoId}</div>
  ),
}));

const originalIsWeb = platformEnv.isWeb;
afterEach(() => {
  platformEnv.isWeb = originalIsWeb;
});

it('uses the same token app chart after the exchange page fails to load', () => {
  platformEnv.isWeb = false;
  const token = {
    tvPlatform: {
      identifier: 'binance',
      baseToken: 'BNB',
      targetToken: 'USDT',
    },
  } as IMarketTokenDetail;
  render(<MarketDetailChart coinGeckoId="binancecoin" token={token} />);
  fireEvent.click(screen.getByText('Exchange chart'));
  expect(screen.queryByText('Exchange chart')).toBeNull();
  expect(screen.getByText('App chart: binancecoin')).toBeTruthy();
});

it('uses the app datafeed on web even with a supported exchange ticker', () => {
  platformEnv.isWeb = true;
  const token = {
    tvPlatform: {
      identifier: 'binance',
      baseToken: 'BNB',
      targetToken: 'USDT',
    },
  } as IMarketTokenDetail;
  render(<MarketDetailChart coinGeckoId="binancecoin" token={token} />);
  expect(screen.queryByText('Exchange chart')).toBeNull();
  expect(screen.getByText('App chart: binancecoin')).toBeTruthy();
});
