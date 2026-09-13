/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';

import { EMarketBannerType } from '@onekeyhq/shared/types/marketV2';

import { MarketBannerDetail } from './MarketBannerDetail';
import { useMarketBannerDetail } from './useMarketBannerDetail';

let mockType = EMarketBannerType.Mixed;
let mockWide = false;
jest.mock('@react-navigation/core', () => ({
  useRoute: () => ({
    params: { title: 'Composite', type: mockType, tokenListId: 'composite' },
  }),
}));
jest.mock('@react-navigation/elements', () => ({ useHeaderHeight: () => 0 }));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: () => 'Change' }),
}));
jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Container = ({ children }: import('react').PropsWithChildren) =>
    React.createElement('div', null, children);
  return {
    Page: Object.assign(Container, { Header: () => null, Body: Container }),
    Stack: Container,
    XStack: Container,
    YStack: Container,
    SizableText: Container,
    NavBackButton: () => null,
    HeaderButtonGroup: () => null,
    useMedia: () => ({ gtMd: mockWide }),
    useSafeAreaInsets: () => ({ top: 0 }),
  };
});
jest.mock('@onekeyhq/kit/src/components/AccountSelector', () => ({
  AccountSelectorProviderMirror: ({
    children,
  }: import('react').PropsWithChildren) => children,
}));
jest.mock(
  '@onekeyhq/kit/src/components/TabPageHeader/components/HeaderNotificationIconButton',
  () => ({ HeaderNotificationIconButton: () => null }),
);
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  EJotaiContextStoreNames: { marketWatchListV2: 'market' },
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isWeb: true },
}));
jest.mock('../../../components/TabPageHeader', () => ({
  TabPageHeader: () => null,
}));
jest.mock('../MarketDetailV2/hooks/useMarketDetailBackNavigation', () => ({
  useMarketDetailBackNavigation: () => ({ handleBackPress: jest.fn() }),
}));
jest.mock(
  '../MarketHomeV2/components/MarketTokenList/hooks/useToMarketDetailPage',
  () => ({ useToDetailPage: () => jest.fn() }),
);
jest.mock(
  '../MarketHomeV2/components/MarketTokenList/MarketTokenListBase',
  () => ({ MarketTokenListBase: () => <div data-testid="stocks" /> }),
);
jest.mock('../MarketWatchListProviderMirrorV2', () => ({
  MarketWatchListProviderMirrorV2: ({
    children,
  }: import('react').PropsWithChildren) => children,
}));
jest.mock('./BannerDetailTokenFlatList', () => ({
  BannerDetailTokenFlatList: () => <div data-testid="stocks" />,
}));
jest.mock('./PerpsTokenListSection', () => ({
  PerpsTokenListSection: ({ tokenListId }: { tokenListId: string }) => (
    <div data-testid="perps">{tokenListId}</div>
  ),
}));
jest.mock('./useMarketBannerDetail', () => ({
  useMarketBannerDetail: jest.fn(() => ({ listResult: {}, mobileData: [] })),
}));

it.each([
  { type: EMarketBannerType.Mixed, wide: false },
  { type: EMarketBannerType.Mixed, wide: true },
  { type: EMarketBannerType.StockPerps, wide: false },
  { type: EMarketBannerType.StockPerps, wide: true },
])('renders both sections for $type (wide=$wide)', ({ type, wide }) => {
  mockType = type;
  mockWide = wide;
  render(<MarketBannerDetail />);
  expect(useMarketBannerDetail).toHaveBeenLastCalledWith({
    tokenListId: 'composite',
    isPerps: false,
    isStock: true,
    isIndex: false,
  });
  expect(screen.getByTestId('stocks')).toBeTruthy();
  expect(screen.getByTestId('perps').textContent).toBe('composite');
});
