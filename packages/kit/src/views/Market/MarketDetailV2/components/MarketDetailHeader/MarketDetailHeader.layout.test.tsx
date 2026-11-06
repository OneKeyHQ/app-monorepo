/** @jest-environment jsdom */
import type { ComponentProps, PropsWithChildren, ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { MarketDetailHeader } from './MarketDetailHeader';

import type { ShareButton } from '../TokenDetailHeader/ShareButton';

let mockWidth = 900;
const mockPageHeader = jest.fn(
  (_props: {
    headerShown?: boolean;
    unstable_headerRightItems?: () => { element: ReactNode }[];
  }) => null,
);
const mockShareButton = jest.fn(
  (_props: ComponentProps<typeof ShareButton>) => undefined,
);
const mockShareText = jest.fn();
let mockTokenAddress: string | undefined;
let mockIsNative = true;
let mockStockId: string | undefined;
let mockNetworkId = 'evm--1';

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('react-native', () => ({
  useWindowDimensions: () => ({ width: mockWidth }),
}));
jest.mock('@react-navigation/elements', () => ({ useHeaderHeight: () => 0 }));
jest.mock('@onekeyhq/components', () => {
  const Frame = ({ children }: PropsWithChildren) => <>{children}</>;
  const ShareIconButton = ({
    icon,
    onPress,
    disabled,
  }: {
    icon: string;
    onPress?: () => void;
    disabled?: boolean;
  }) => (
    <button
      type="button"
      aria-label={icon}
      onClick={onPress}
      disabled={disabled}
    />
  );
  return {
    Divider: Frame,
    HeaderIconButton: ShareIconButton,
    IconButton: ShareIconButton,
    Icon: Frame,
    InteractiveIcon: Frame,
    NavBackButton: Frame,
    Page: {
      Header: (props: Parameters<typeof mockPageHeader>[0]) => {
        mockPageHeader(props);
        const items = props.unstable_headerRightItems?.();
        return (
          <>
            {items?.[0]?.element}
            {items?.[1]?.element}
          </>
        );
      },
    },
    SizableText: Frame,
    Skeleton: { BodySm: Frame },
    XStack: Frame,
    YStack: Frame,
    glassBarItem: (element: ReactNode) => ({ element }),
    useClipboard: () => ({ copyText: jest.fn() }),
    useIsOverlayPage: () => false,
    useMedia: () => ({
      md: mockWidth < 768,
      gtMd: mockWidth >= 768,
      gtLg: mockWidth >= 1024,
    }),
    useSafeAreaInsets: () => ({ left: 0, right: 0 }),
    useShare: () => ({ shareText: mockShareText }),
  };
});
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isDev: true,
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
jest.mock('../../hooks/StockDetailContext', () => ({
  useStockDetail: () => ({}),
}));
jest.mock('../../hooks/useMarketDetailBackNavigation', () => ({
  useMarketDetailBackNavigation: () => ({ handleBackPress: jest.fn() }),
}));
jest.mock('../../hooks/useMarketDetailDisplayData', () => ({
  useMarketDetailHeaderDisplayData: () => ({
    networkId: mockNetworkId,
    tokenAddress: mockTokenAddress,
    isNative: mockIsNative,
    isStockToken: Boolean(mockStockId),
    tokenDetail: { symbol: 'ETH', name: 'Ethereum', address: mockTokenAddress },
  }),
}));
jest.mock('../../hooks/useMarketDetailWatchlistIdentity', () => ({
  useMarketDetailWatchlistIdentity: () => ({
    assetId: mockStockId ? undefined : 'ethereum',
    stockId: mockStockId,
  }),
}));
jest.mock('../TokenDetailHeader/ShareButton', () => {
  const { ShareButton: ActualShareButton } = jest.requireActual<
    typeof import('../TokenDetailHeader/ShareButton')
  >('../TokenDetailHeader/ShareButton');
  return {
    ShareButton: (props: ComponentProps<typeof ActualShareButton>) => {
      mockShareButton(props);
      return <ActualShareButton {...props} />;
    },
  };
});
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
    mockTokenAddress = undefined;
    mockIsNative = true;
    mockStockId = undefined;
    mockNetworkId = 'evm--1';
    jest.replaceProperty(platformEnv, 'isWebDappMode', true);
    jest.replaceProperty(platformEnv, 'isWeb', true);
    jest.replaceProperty(platformEnv, 'isNative', false);
    jest.replaceProperty(platformEnv, 'isNativeIOS26Plus', false);
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

  it('shares the active contract address even while detail is loading', () => {
    mockWidth = 767;
    mockIsNative = false;
    mockTokenAddress = '0xactive';
    render(<MarketDetailHeader />);
    expect(mockShareButton).toHaveBeenCalledWith(
      expect.objectContaining({ address: '0xactive' }),
    );
  });

  it('does not share an incomplete contract identity', () => {
    mockWidth = 767;
    mockIsNative = false;
    render(<MarketDetailHeader />);
    expect(mockShareButton).not.toHaveBeenCalled();
  });

  it.each(['ios26', 'native', 'web'])(
    'shares the stock listing before and after token resolution on %s',
    (platform) => {
      mockWidth = 767;
      mockStockId = 'AAPL';
      mockNetworkId = '';
      mockIsNative = false;
      jest.replaceProperty(platformEnv, 'isWeb', platform === 'web');
      jest.replaceProperty(platformEnv, 'isNative', platform !== 'web');
      jest.replaceProperty(
        platformEnv,
        'isNativeIOS26Plus',
        platform === 'ios26',
      );
      const view = render(<MarketDetailHeader showFavoriteButton={false} />);

      fireEvent.click(screen.getByRole('button', { name: 'ShareOutline' }));
      expect(mockShareText).toHaveBeenLastCalledWith(
        'https://app.onekey.so/market/stock/AAPL',
      );

      mockNetworkId = 'evm--56';
      mockTokenAddress = '0x390a684ef9cade28a7ad0dfa61ab1eb3842618c4';
      view.rerender(<MarketDetailHeader showFavoriteButton={false} />);
      fireEvent.click(screen.getByRole('button', { name: 'ShareOutline' }));
      expect(mockShareText).toHaveBeenLastCalledWith(
        'https://app.onekey.so/market/stock/AAPL',
      );
    },
  );

  it.each([false, true])(
    'preserves token sharing with iOS 26=%s',
    (isIOS26) => {
      mockWidth = 767;
      mockIsNative = false;
      mockTokenAddress = '0xactive';
      jest.replaceProperty(platformEnv, 'isWeb', false);
      jest.replaceProperty(platformEnv, 'isNative', true);
      jest.replaceProperty(platformEnv, 'isNativeIOS26Plus', isIOS26);
      render(<MarketDetailHeader showFavoriteButton={false} />);
      fireEvent.click(screen.getByRole('button', { name: 'ShareOutline' }));
      expect(mockShareText).toHaveBeenCalledWith(
        'https://app.onekey.so/market/token/eth/0xactive',
      );
    },
  );

  it('preserves the compact tablet header outside DApp mode', () => {
    jest.replaceProperty(platformEnv, 'isWebDappMode', false);
    render(<MarketDetailHeader marketTokenCategory="top_coins" />);
    expect(screen.getByTestId('compact-header')).toBeTruthy();
    expect(screen.queryByTestId('global-header')).toBeNull();
  });
});
