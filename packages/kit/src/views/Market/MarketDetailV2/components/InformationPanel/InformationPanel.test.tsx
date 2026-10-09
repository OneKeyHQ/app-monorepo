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
    tokenDetail: mockDetail,
    networkId: mockDetail.networkId,
    isStockToken: Boolean(mockDetail.stock),
  }),
}));
jest.mock('../TokenSecurityAlert/hooks', () => ({
  useTokenSecurity: () => ({ securityData: mockSecurityData }),
}));
jest.mock('../TokenSecurityAlert', () => ({
  TokenSecurityAlert: () => <span>risk result</span>,
}));
jest.mock('./InformationPanelSkeleton', () => ({
  InformationPanelSkeleton: () => null,
}));
jest.mock('./StockMobilePriceHeader', () => ({
  StockMobilePriceHeader: () => null,
}));

beforeEach(() => {
  jest.replaceProperty(platformEnv, 'isNative', true);
  mockSecurityData = null;
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

it('keeps native token stats and audit out of the price header', () => {
  const { rerender } = render(<InformationPanel />);
  expect(screen.queryByText(ETranslations.dexmarket_audit)).toBeNull();
  expect(screen.queryByText(ETranslations.global_market_cap)).toBeNull();
  mockSecurityData = {
    check: { value: true, content: 'Test', riskType: 'caution' },
  };
  rerender(<InformationPanel />);
  expect(screen.queryByText(ETranslations.dexmarket_audit)).toBeNull();
  expect(screen.queryByText('risk result')).toBeNull();
});

it('shows the wrapped-token risk result on the native stock header', () => {
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
  render(<InformationPanel />);
  expect(screen.getByText(ETranslations.dexmarket_audit)).toBeTruthy();
  expect(screen.getByText('risk result')).toBeTruthy();
});

it('does not reserve a risk row for a native stock without a risk result', () => {
  mockDetail = {
    ...mockDetail,
    stock: {
      subtitle: 'Apple',
      sourceLogoUri: '',
    },
  };
  render(<InformationPanel />);
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
  render(<InformationPanel />);
  expect(screen.queryByText(ETranslations.dexmarket_audit)).toBeNull();
});

it('preserves the existing non-native layout while security data is pending', () => {
  jest.replaceProperty(platformEnv, 'isNative', false);
  render(<InformationPanel />);
  expect(screen.queryByText(ETranslations.dexmarket_audit)).toBeNull();
});
