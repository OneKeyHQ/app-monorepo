/** @jest-environment jsdom */
import type { PropsWithChildren } from 'react';

import { render, screen } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IMarketTokenDetail,
  IMarketTokenSecurityData,
} from '@onekeyhq/shared/types/marketV2';

import { InformationPanel } from './InformationPanel';

let mockSecurityData: IMarketTokenSecurityData | null = null;
let mockDetail: IMarketTokenDetail;
let mockMissingDetail = false;
let mockStockRoute = false;

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true },
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => {
  const View = ({
    children,
    testID,
  }: PropsWithChildren<{ testID?: string }>) => (
    <div data-testid={testID}>{children}</div>
  );
  return {
    XStack: View,
    YStack: View,
    SizableText: View,
    NumberSizeableText: View,
  };
});
jest.mock('@onekeyhq/kit/src/components/Currency', () => ({
  useCurrency: () => ({ symbol: '$' }),
}));
jest.mock('@onekeyhq/kit/src/views/Market/components/MarketTokenPrice', () => ({
  BaseMarketTokenPrice: () => null,
  MarketTokenPrice: () => null,
}));
jest.mock('../../../components/PerpsBadges', () => ({
  StockMarketStatusBadge: () => null,
}));
jest.mock('../../../components/TokenTagsPopover', () => ({
  TokenTagsPopover: () => null,
}));
jest.mock('../../hooks/BtcMetadataContext', () => ({
  useBtcMetadataContext: () => null,
}));
jest.mock('../../hooks/useMarketDetailDisplayData', () => ({
  useMarketDetailDisplayData: () => ({
    tokenDetail: mockMissingDetail ? undefined : mockDetail,
    networkId: mockDetail?.networkId,
    isStockToken: mockStockRoute || Boolean(mockDetail?.stock),
  }),
}));
jest.mock('../TokenSecurityAlert/hooks', () => ({
  useTokenSecurity: () => ({ securityData: mockSecurityData }),
}));
jest.mock('../TokenSecurityAlert', () => ({
  TokenSecurityAlert: () => <span>risk result</span>,
}));
jest.mock('./InformationPanelSkeleton', () => ({
  InformationPanelSkeleton: () => <span>generic price skeleton</span>,
}));
jest.mock('./StockMobilePriceHeader', () => ({
  StockMobilePriceHeader: () => <span>stock price header</span>,
}));

beforeEach(() => {
  jest.replaceProperty(platformEnv, 'isNative', true);
  mockSecurityData = null;
  mockStockRoute = false;
  mockMissingDetail = false;
  mockDetail = {
    address: '0xabc',
    networkId: 'evm--1',
    name: 'Test',
    symbol: 'TEST',
    decimals: 18,
    logoUrl: '',
    price: '1',
  };
});

it('shows audit in the native trending price header once security data arrives', () => {
  const { rerender } = render(<InformationPanel mobileDetailKind="trending" />);
  expect(screen.queryByText(ETranslations.dexmarket_audit)).toBeNull();
  expect(screen.queryByText(ETranslations.global_market_cap)).toBeNull();
  mockSecurityData = {
    check: { value: true, content: 'Test', riskType: 'caution' },
  };
  rerender(<InformationPanel mobileDetailKind="trending" />);
  expect(
    screen.getByTestId('market-detail-security-row').textContent,
  ).toContain(ETranslations.dexmarket_audit);
  expect(screen.getByText('risk result')).toBeTruthy();
  expect(screen.queryByText(ETranslations.global_market_cap)).toBeNull();
});

it('hides audit on the native stock header even with security data', () => {
  mockDetail = {
    ...mockDetail,
    stock: {
      subtitle: 'Apple',
      sourceLogoUri: '',
    },
  };
  mockSecurityData = {
    check: { value: true, content: 'Test', riskType: 'caution' },
  };
  render(<InformationPanel mobileDetailKind="trending" />);
  expect(screen.queryByText(ETranslations.dexmarket_audit)).toBeNull();
  expect(screen.queryByText('risk result')).toBeNull();
});

it('does not reserve a risk row for a native stock without a risk result', () => {
  mockDetail = {
    ...mockDetail,
    stock: {
      subtitle: 'Apple',
      sourceLogoUri: '',
    },
  };
  render(<InformationPanel mobileDetailKind="trending" />);
  expect(screen.queryByText(ETranslations.dexmarket_audit)).toBeNull();
  expect(screen.queryByText('risk result')).toBeNull();
});

it('does not reserve a risk row for native coins without a contract address', () => {
  mockDetail = {
    ...mockDetail,
    networkId: 'btc--0',
    address: '',
    isNative: true,
  };
  render(<InformationPanel mobileDetailKind="trending" />);
  expect(screen.queryByText(ETranslations.dexmarket_audit)).toBeNull();
});

it('preserves the existing non-native layout while security data is pending', () => {
  jest.replaceProperty(platformEnv, 'isNative', false);
  render(<InformationPanel mobileDetailKind="trending" />);
  expect(screen.queryByText(ETranslations.dexmarket_audit)).toBeNull();
});

it('hides contract audit for top coins and updates visibility when detail kind changes', () => {
  mockSecurityData = {
    check: { value: true, content: 'Test', riskType: 'caution' },
  };
  const { rerender } = render(<InformationPanel mobileDetailKind="topCoin" />);
  expect(screen.queryByTestId('market-detail-security-row')).toBeNull();
  rerender(<InformationPanel mobileDetailKind="trending" />);
  expect(screen.getByTestId('market-detail-security-row')).toBeTruthy();
  rerender(<InformationPanel mobileDetailKind="topCoin" />);
  expect(screen.queryByText('risk result')).toBeNull();
});

it('preserves the non-native audit result layout', () => {
  jest.replaceProperty(platformEnv, 'isNative', false);
  mockSecurityData = {
    check: { value: true, content: 'Test', riskType: 'caution' },
  };
  render(<InformationPanel />);
  expect(screen.getByText('risk result')).toBeTruthy();
  expect(screen.getByText(ETranslations.global_market_cap)).toBeTruthy();
});

it.each(['trending', 'topCoin'] as const)(
  'shows the dollar move and percentage for %s',
  (mobileDetailKind) => {
    mockDetail = { ...mockDetail, price: '110', priceChange24hPercent: '10' };
    const { rerender } = render(
      <InformationPanel mobileDetailKind={mobileDetailKind} />,
    );
    expect(
      screen.getByTestId('market-mobile-price-change-value').textContent,
    ).toBe('10');
    expect(screen.getByText('(+10%)')).toBeTruthy();
    mockDetail = { ...mockDetail, price: '90', priceChange24hPercent: '-10' };
    rerender(<InformationPanel mobileDetailKind={mobileDetailKind} />);
    expect(
      screen.getByTestId('market-mobile-price-change-value').textContent,
    ).toBe('-10');
  },
);

it('uses the stock price header before any token preview or detail is available', () => {
  mockStockRoute = true;
  mockMissingDetail = true;
  const { rerender } = render(<InformationPanel mobileDetailKind="stock" />);
  expect(screen.getByText('stock price header')).toBeTruthy();
  expect(screen.queryByText('generic price skeleton')).toBeNull();

  mockMissingDetail = false;
  mockDetail = {
    address: '0xabc',
    networkId: 'evm--1',
    name: 'Apple',
    symbol: 'AAPL',
    decimals: 18,
    logoUrl: '',
  };
  rerender(<InformationPanel mobileDetailKind="stock" />);
  expect(screen.getByText('stock price header')).toBeTruthy();
  expect(screen.queryByText('generic price skeleton')).toBeNull();
});
