/** @jest-environment jsdom */

import { createContext } from 'react';
import type { PropsWithChildren, ReactElement, ReactNode } from 'react';

import { MarketDetailContent } from '.';

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type {
  IMarketDetailTicker,
  IMarketTokenDetail,
} from '@onekeyhq/shared/types/market';

import type { LayoutChangeEvent } from 'react-native';
import type { WebCollapsiblePagerViewProps } from 'react-native-pager-view';

let mockLocale = 'en';
let mockWeb = true;
let mockOverlayPage = true;
const mockLayoutHandlers = new Map<
  string,
  (event: LayoutChangeEvent) => void
>();
const mockLocaleContext = createContext('en');
const mockSdkProps = jest.fn<void, [WebCollapsiblePagerViewProps]>();
const mockTabBarProps = jest.fn<void, [{ indexDecimal?: unknown }]>();
const mockChartMount = jest.fn<void, []>();
const mockChartUnmount = jest.fn<void, []>();

const mockActivePage = { isFocused: true };
const mockInactivePage = { isFocused: false };

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNative: false,
    get isWeb() {
      return mockWeb;
    },
  },
}));
jest.mock('react-intl', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useIntl: () => {
      const locale = React.useContext(mockLocaleContext);
      return React.useMemo(
        () => ({
          formatMessage: ({ id }: { id: string }) => `${locale}:${id}`,
        }),
        [locale],
      );
    },
  };
});
jest.mock('react-native-reanimated', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useSharedValue: (initial: unknown) => {
      const ref = React.useRef<
        | { value: unknown; subscribe: (listener: () => void) => () => void }
        | undefined
      >(undefined);
      if (!ref.current) {
        let value = initial;
        const listeners = new Set<() => void>();
        ref.current = {
          get value() {
            return value;
          },
          set value(next) {
            if (Object.is(value, next)) return;
            value = next;
            listeners.forEach((listener) => listener());
          },
          subscribe: (listener) => {
            listeners.add(listener);
            return () => {
              listeners.delete(listener);
            };
          },
        };
      }
      return ref.current;
    },
  };
});
jest.mock('react-native', () => ({
  View: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));
jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { useDeferredPromise } = jest.requireActual<
    typeof import('../../../../../../components/src/hooks/useDeferredPromise')
  >('../../../../../../components/src/hooks/useDeferredPromise');
  const Box = ({
    children,
    testID,
    height,
    onLayout,
  }: PropsWithChildren<{
    testID?: string;
    height?: number;
    onLayout?: (event: LayoutChangeEvent) => void;
  }>) => {
    if (testID && onLayout) mockLayoutHandlers.set(testID, onLayout);
    return (
      <div data-testid={testID} data-height={height}>
        {children}
      </div>
    );
  };
  return {
    Page: Object.assign(Box, { Header: () => null, Body: Box }),
    Stack: Box,
    XStack: Box,
    YStack: Box,
    SizableText: Box,
    Spinner: () => <div data-testid="loading" />,
    Button: ({
      children,
      testID,
      onPress,
    }: PropsWithChildren<{ testID?: string; onPress: () => void }>) => (
      <button data-testid={testID} onClick={onPress}>
        {children}
      </button>
    ),
    ScrollContentRegistrationContext: React.createContext(undefined),
    getCurrentVisibilityState: () => true,
    onVisibilityStateChange: () => () => undefined,
    useDeferredPromise,
    useIsOverlayPage: () => mockOverlayPage,
    useNetInfo: () => ({ isRawInternetReachable: true }),
    TabBar: (props: {
      tabNames: string[];
      focusedTab: {
        value: string;
        subscribe: (listener: () => void) => () => void;
      };
      onTabPress: (name: string) => void;
      indexDecimal?: unknown;
      renderItem: (
        item: {
          name: string;
          isFocused: boolean;
          onPress: (name: string) => void;
        },
        index: number,
      ) => ReactNode;
    }) => {
      mockTabBarProps(props);
      const focused = React.useSyncExternalStore(
        props.focusedTab.subscribe,
        () => props.focusedTab.value,
      );
      return (
        <div role="tablist">
          {props.tabNames.map((name, index) => (
            <React.Fragment key={name}>
              {props.renderItem(
                {
                  name,
                  isFocused: name === focused,
                  onPress: props.onTabPress,
                },
                index,
              )}
            </React.Fragment>
          ))}
        </div>
      );
    },
    TabBarItem: ({
      name,
      isFocused,
      onPress,
      testID,
    }: {
      name: string;
      isFocused: boolean;
      onPress: (name: string) => void;
      testID: string;
    }) => (
      <button
        role="tab"
        aria-selected={isFocused}
        data-testid={testID}
        onClick={() => onPress(name)}
      >
        {name}
      </button>
    ),
  };
});
jest.mock('react-native-pager-view', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const PageContext = React.createContext({ isFocused: true });
  return {
    WebCollapsiblePagerView: React.forwardRef(
      (props: WebCollapsiblePagerViewProps, ref) => {
        mockSdkProps(props);
        const [selected, setSelected] = React.useState(props.initialPage ?? 0);
        const current = React.useRef(props);
        current.current = props;
        React.useImperativeHandle(ref, () => {
          const select = (position: number) => {
            setSelected(position);
            void current.current.onPageSelected?.({
              nativeEvent: { position },
            } as Parameters<
              NonNullable<WebCollapsiblePagerViewProps['onPageSelected']>
            >[0]);
          };
          return {
            setPage: select,
            setPageWithoutAnimation: select,
            restoreScrollPosition: () => true,
          };
        }, []);
        return (
          <div data-testid="sdk-pager">
            {props.header}
            {props.stickyHeader}
            {React.Children.map(props.children, (child, index) => (
              <PageContext.Provider
                value={index === selected ? mockActivePage : mockInactivePage}
              >
                <div aria-hidden={index !== selected}>{child}</div>
              </PageContext.Provider>
            ))}
          </div>
        );
      },
    ),
    NativeScroller: ({
      children,
      pagerScrollKey,
    }: PropsWithChildren<{ pagerScrollKey: string }>) => (
      <div data-testid={`scroll-${pagerScrollKey}`}>{children}</div>
    ),
    useWebCollapsiblePagerPage: () => React.useContext(PageContext),
  };
});
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocusedWhenEnabled: () => true,
}));
jest.mock('@onekeyhq/shared/src/utils/swrCacheUtils', () => ({
  swrCacheUtils: {},
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: { serviceMarket: { fetchMarketTokenDetail: jest.fn() } },
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({
    activeAccount: { account: { id: 'test-account' } },
  }),
}));
jest.mock('@onekeyhq/kit/src/components/AccountSelector', () => ({
  AccountSelectorProviderMirror: ({ children }: PropsWithChildren) => (
    <>{children}</>
  ),
}));
jest.mock('@onekeyhq/kit/src/components/Currency', () => ({
  Currency: ({ children }: PropsWithChildren) => <span>${children}</span>,
}));
jest.mock('../../../Market/components/MarketTokenIcon', () => ({
  MarketTokenIcon: () => null,
}));
jest.mock('../../../Market/components/PriceChangePercentage', () => ({
  PriceChangePercentage: () => null,
}));
jest.mock('../../../Market/components/MarketTradeButton', () => ({
  MarketTradeButton: () => <button disabled>Trade</button>,
}));
jest.mock('../../../Market/components/MarketDetailOverview', () => ({
  MarketDetailOverview: () => <div>Overview details</div>,
}));
jest.mock('../../../Market/components/MarketDetailPools', () => ({
  MarketDetailPools: () => <div>Pool details</div>,
}));
jest.mock('../../../Market/components/MarketDetailLinks', () => ({
  MarketDetailLinks: () => <input aria-label="links filter" defaultValue="" />,
}));
jest.mock('./MarketDetailChart', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    MarketDetailChart: () => {
      React.useEffect(() => {
        mockChartMount();
        return mockChartUnmount;
      }, []);
      return <input aria-label="interactive chart" defaultValue="" />;
    },
  };
});

const ticker: IMarketDetailTicker = {
  localId: 'ticker',
  base: 'ETH',
  target: 'USDT',
  market: {
    name: 'Sample exchange',
    identifier: 'sample',
    has_trading_incentive: false,
  },
  depth_data: null,
  last: 1000,
  last_updated_at: '2026-11-16T00:00:00Z',
  logo: '',
  volume: 1,
  trust_score: 'green',
  bid_ask_spread_percentage: 0,
  trade_url: 'https://example.com',
};
const token: IMarketTokenDetail = {
  name: 'Ethereum',
  symbol: 'ETH',
  image: '',
  about: '',
  explorers: [],
  links: {
    homePageUrl: '',
    discordUrl: '',
    twitterUrl: '',
    whitepaper: '',
    telegramUrl: '',
  },
  stats: {
    currentPrice: '1000',
    lastUpdated: '2026-11-16T00:00:00Z',
    performance: {
      priceChangePercentage1h: 0,
      priceChangePercentage24h: 1,
      priceChangePercentage7d: 0,
      priceChangePercentage14d: 0,
      priceChangePercentage30d: 0,
      priceChangePercentage1y: 0,
    },
    marketCap: 0,
    marketCapRank: 0,
    volume24h: 0,
    low24h: 0,
    high24h: 0,
    atl: { time: new Date(0), value: 0 },
    ath: { time: new Date(0), value: 0 },
    fdv: 0,
    circulatingSupply: 0,
    totalSupply: 0,
    maxSupply: 0,
  },
  fallbackToChart: true,
  detailPlatforms: {},
  platforms: {},
  tickers: [ticker],
};
const mockFetch = jest.spyOn(
  backgroundApiProxy.serviceMarket,
  'fetchMarketTokenDetail',
);
const latestSdk = () => mockSdkProps.mock.calls.at(-1)![0];
const selected = (key: string) =>
  expect(
    screen
      .getByTestId(`asset-market-detail-tab-${key}`)
      .getAttribute('aria-selected'),
  ).toBe('true');
const press = (key: string) =>
  fireEvent.click(screen.getByTestId(`asset-market-detail-tab-${key}`));
function Environment({ children }: PropsWithChildren) {
  return (
    <mockLocaleContext.Provider value={mockLocale}>
      {children}
    </mockLocaleContext.Provider>
  );
}
const renderMarket = () =>
  render(<MarketDetailContent coinGeckoId="ethereum" />, {
    wrapper: Environment,
  });
const flush = async () => {
  await act(() => jest.advanceTimersByTimeAsync(0));
};
const poll = async () => {
  await act(() => jest.advanceTimersByTimeAsync(45_000));
};

beforeEach(() => {
  jest.useFakeTimers();
  mockLocale = 'en';
  mockWeb = true;
  mockOverlayPage = true;
  mockLayoutHandlers.clear();
  jest.clearAllMocks();
  mockFetch.mockReset();
  mockFetch.mockResolvedValue(token);
});
afterEach(() => {
  cleanup();
  jest.clearAllTimers();
  jest.useRealTimers();
});

it('keeps the header, all page owners and interactive chart while polling or locale changes', async () => {
  const view = renderMarket();
  await flush();
  expect(mockFetch).toHaveBeenCalledWith('ethereum', true, 'usd');
  expect(latestSdk().scrollEnabled).toBe(false);
  expect(latestSdk().pageRetentionDistance).toBe(4);
  expect(mockTabBarProps.mock.calls.at(-1)?.[0].indexDecimal).toBeUndefined();
  expect(
    screen.getByTestId('sdk-pager').querySelector('[data-height="170"]'),
  ).toBeTruthy();
  const chart = screen.getByRole('textbox', { name: 'interactive chart' });
  fireEvent.change(chart, { target: { value: 'crosshair state' } });
  press('links');
  const links = screen.getByRole('textbox', { name: 'links filter' });
  fireEvent.change(links, { target: { value: 'saved filter' } });
  const owner = screen.getByTestId('scroll-links:0');
  owner.scrollTop = 200;
  mockFetch.mockResolvedValueOnce({
    ...token,
    stats: { ...token.stats, currentPrice: '1001' },
  });
  await poll();
  selected('links');
  expect(screen.getByTestId('scroll-links:0')).toBe(owner);
  expect(owner.scrollTop).toBe(200);
  mockLocale = 'zh';
  view.rerender(<MarketDetailContent coinGeckoId="ethereum" />);
  selected('links');
  expect(screen.getByRole('textbox', { name: 'links filter' })).toBe(links);
  expect((links as HTMLInputElement).value).toBe('saved filter');
  expect(
    screen.queryByRole('textbox', { name: 'interactive chart' }),
  ).toBeNull();
  press('chart');
  expect(screen.getByRole('textbox', { name: 'interactive chart' })).toBe(
    chart,
  );
  expect((chart as HTMLInputElement).value).toBe('crosshair state');
  mockFetch.mockRejectedValueOnce(new Error('transient public API failure'));
  await poll();
  expect(screen.getByRole('textbox', { name: 'interactive chart' })).toBe(
    chart,
  );
  expect(mockChartMount).toHaveBeenCalledTimes(1);
  expect(mockChartUnmount).not.toHaveBeenCalled();
});

it('preserves the Links owner and correct selected index when Pools is removed and added', async () => {
  renderMarket();
  await flush();
  press('links');
  const owner = screen.getByTestId('scroll-links:0');
  owner.scrollTop = 180;
  mockFetch.mockResolvedValueOnce({ ...token, tickers: [] });
  await poll();
  selected('links');
  expect(screen.queryByTestId('asset-market-detail-tab-pools')).toBeNull();
  expect(screen.getByTestId('scroll-links:0')).toBe(owner);
  expect(owner.scrollTop).toBe(180);
  mockFetch.mockResolvedValueOnce({ ...token, tickers: [ticker] });
  await poll();
  selected('links');
  expect(screen.getByTestId('scroll-links:0')).toBe(owner);
  expect(screen.getByTestId('asset-market-detail-tab-pools')).toBeTruthy();
  expect(mockChartMount).toHaveBeenCalledTimes(1);
});

it('returns to Chart when the active Pools page disappears and does not revive it on addition', async () => {
  renderMarket();
  await flush();
  press('pools');
  selected('pools');
  mockFetch.mockResolvedValueOnce({ ...token, tickers: [] });
  await poll();
  selected('chart');
  expect(
    screen.getByRole('textbox', { name: 'interactive chart' }),
  ).toBeTruthy();
  mockFetch.mockResolvedValueOnce({ ...token, tickers: [ticker] });
  await poll();
  selected('chart');
});

it('retains initial loading and retry behavior before mounting a pager', async () => {
  mockFetch.mockRejectedValueOnce(new Error('initial public API failure'));
  renderMarket();
  expect(screen.getByTestId('loading')).toBeTruthy();
  expect(screen.queryByTestId('sdk-pager')).toBeNull();
  await flush();
  fireEvent.click(screen.getByTestId('asset-market-detail-retry'));
  await flush();
  selected('chart');
  expect(screen.getByTestId('sdk-pager')).toBeTruthy();
  expect(mockFetch).toHaveBeenCalledTimes(2);
});

it('sizes only the Web overlay chart from the measured body and tab bar through resize', async () => {
  renderMarket();
  await flush();
  const chart = screen.getByRole('textbox', { name: 'interactive chart' });
  expect(chart.parentElement?.getAttribute('data-height')).toBeNull();
  const measure = (body: number, bar: number) =>
    act(() => {
      const event = (height: number) =>
        ({
          nativeEvent: { layout: { x: 0, y: 0, width: 375, height } },
        }) as LayoutChangeEvent;
      mockLayoutHandlers.get('asset-market-detail')?.(event(body));
      const sticky = latestSdk().stickyHeader as ReactElement<{
        onLayout?: (layout: LayoutChangeEvent) => void;
      }>;
      sticky.props.onLayout?.(event(bar));
    });
  measure(791.2, 44.2);
  expect(chart.parentElement?.getAttribute('data-height')).toBe('747');
  measure(587.2, 44.2);
  expect(chart.parentElement?.getAttribute('data-height')).toBe('543');
  measure(587.2, 55.2);
  expect(chart.parentElement?.getAttribute('data-height')).toBe('532');
  measure(20, 45);
  expect(chart.parentElement?.getAttribute('data-height')).toBe('0');
  expect(mockChartMount).toHaveBeenCalledTimes(1);
  expect(mockChartUnmount).not.toHaveBeenCalled();
});

it.each([
  { web: false, overlay: true },
  { web: true, overlay: false },
])(
  'keeps the existing chart height path without a wrapper (web=$web, overlay=$overlay)',
  async ({ web, overlay }) => {
    mockWeb = web;
    mockOverlayPage = overlay;
    renderMarket();
    await flush();
    const chart = screen.getByRole('textbox', { name: 'interactive chart' });
    expect(chart.parentElement?.getAttribute('data-testid')).toBe(
      'scroll-chart:0',
    );
    expect(mockLayoutHandlers.has('asset-market-detail')).toBe(false);
  },
);
