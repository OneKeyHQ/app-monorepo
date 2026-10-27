/** @jest-environment jsdom */
import type { ComponentProps, PropsWithChildren } from 'react';

import { render, screen } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { MarketDetailHeader } from './MarketDetailHeader';

let mockWidth = 900;
const mockPageHeader = jest.fn((_props: { headerShown?: boolean }) => null);

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('react-native', () => ({
  useWindowDimensions: () => ({ width: mockWidth }),
}));
jest.mock('@react-navigation/elements', () => ({ useHeaderHeight: () => 0 }));
jest.mock('@onekeyhq/components', () => {
  const Frame = ({ children }: PropsWithChildren) => <>{children}</>;
  return {
    Divider: Frame,
    HeaderIconButton: Frame,
    Icon: Frame,
    InteractiveIcon: Frame,
    NavBackButton: Frame,
    Page: {
      Header: (props: { headerShown?: boolean }) => mockPageHeader(props),
    },
    SizableText: Frame,
    Skeleton: { BodySm: Frame },
    XStack: Frame,
    YStack: Frame,
    glassBarItem: jest.fn(),
    useClipboard: () => ({ copyText: jest.fn() }),
    useIsOverlayPage: () => false,
    useMedia: () => ({
      md: mockWidth < 768,
      gtMd: mockWidth >= 768,
      gtLg: mockWidth >= 1024,
    }),
    useSafeAreaInsets: () => ({ left: 0, right: 0 }),
    useShare: () => ({ shareText: jest.fn() }),
  };
});
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isWeb: true,
    isWebDappMode: true,
    isNative: false,
    isNativeIOS26Plus: false,
  },
}));
jest.mock('@onekeyhq/kit/src/components/AccountSelector', () => ({
  AccountSelectorTriggerHome: () => null,
}));
jest.mock('@onekeyhq/kit/src/components/TabPageHeader', () => ({
  TabPageHeader: () => <div data-testid="global-header" />,
}));
jest.mock('@onekeyhq/kit/src/components/Token', () => ({
  Token: () => null,
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pushModal: jest.fn() }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useNetworkLogoUri', () => ({
  useNetworkLogoUri: () => undefined,
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {},
}));
jest.mock('../../../components/MarketStarV2', () => ({
  MarketStarV2: () => null,
  useStarV2Checked: () => ({ checked: false, onPress: jest.fn() }),
}));
jest.mock('../../../components/TokenTagsPopover', () => ({
  TokenTagsPopover: () => null,
}));
jest.mock(
  '../../../MarketHomeV2/components/MarketTokenList/hooks/useMarketTokenColumns/tokenAgeLabel',
  () => ({
    getTokenAgeLabel: () => undefined,
  }),
);
jest.mock('../../../marketUtils', () => ({ buildMarketFullUrlV2: jest.fn() }));
jest.mock('../../hooks/StockDetailContext', () => ({
  useStockDetail: () => ({}),
}));
jest.mock('../../hooks/useMarketDetailBackNavigation', () => ({
  useMarketDetailBackNavigation: () => ({ handleBackPress: jest.fn() }),
}));
jest.mock('../../hooks/useMarketDetailDisplayData', () => ({
  useMarketDetailHeaderDisplayData: () => ({
    networkId: 'evm--1',
    isNative: true,
    tokenDetail: { symbol: 'ETH', name: 'Ethereum' },
  }),
}));
jest.mock('../../hooks/useMarketDetailWatchlistIdentity', () => ({
  useMarketDetailWatchlistIdentity: () => ({ assetId: 'ethereum' }),
}));
jest.mock('../TokenDetailHeader/ShareButton', () => ({
  ShareButton: () => null,
}));
jest.mock('../TokenDetailHeader/TokenLaunchpad', () => ({
  TokenLaunchpad: () => null,
}));
jest.mock('./TabPageHeaderContainer', () => {
  const { TabPageHeaderContainer: ActualContainer } = jest.requireActual<
    typeof import('./TabPageHeaderContainer')
  >('./TabPageHeaderContainer');
  return {
    TabPageHeaderContainer: (props: ComponentProps<typeof ActualContainer>) => (
      <div data-testid="compact-header">
        <ActualContainer {...props} />
      </div>
    ),
  };
});

describe('Market detail global navigation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWidth = 900;
    jest.replaceProperty(platformEnv, 'isWebDappMode', true);
  });

  it.each([768, 900, 1023, 1024])(
    'retains the DappHeader entry at %spx when the sidebar is hidden',
    (width) => {
      mockWidth = width;
      render(<MarketDetailHeader marketTokenCategory="top_coins" />);
      expect(screen.getByTestId('global-header')).toBeTruthy();
      expect(
        mockPageHeader.mock.calls.some(
          ([props]) => props.headerShown === false,
        ),
      ).toBe(false);
      if (width < 1024) {
        expect(screen.getByTestId('compact-header')).toBeTruthy();
        expect(screen.getByTestId('compact-header').textContent).toContain(
          'ETH',
        );
      } else {
        expect(screen.queryByTestId('compact-header')).toBeNull();
      }
    },
  );

  it('keeps the compact detail header on phones', () => {
    mockWidth = 767;
    render(<MarketDetailHeader marketTokenCategory="top_coins" />);
    expect(screen.getByTestId('compact-header')).toBeTruthy();
    expect(screen.queryByTestId('global-header')).toBeNull();
    expect(
      mockPageHeader.mock.calls.some(([props]) => props.headerShown === false),
    ).toBe(true);
  });

  it('preserves the compact tablet header outside DApp mode', () => {
    jest.replaceProperty(platformEnv, 'isWebDappMode', false);
    render(<MarketDetailHeader marketTokenCategory="top_coins" />);
    expect(screen.getByTestId('compact-header')).toBeTruthy();
    expect(screen.queryByTestId('global-header')).toBeNull();
  });
});
