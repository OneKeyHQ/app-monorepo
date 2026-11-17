/** @jest-environment jsdom */

import { createContext, useMemo } from 'react';
import type { PropsWithChildren, ReactElement } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IBorrowReserveDetail } from '@onekeyhq/shared/types/staking';

import { DetailsPart } from './DetailsPart';
import { ReserveDetailsTabs } from './ReserveDetailsTabs';

import type { LayoutChangeEvent, ViewProps } from 'react-native';
import type { CollapsiblePagerViewProps } from 'react-native-pager-view';

let mockPlatform: 'web' | 'ios' | 'android' = 'web';
let mockLocale = 'en';
let mockWide = false;
const mockEnvironment = createContext({ locale: 'en', wide: false });
const mockPagerProps = jest.fn<void, [CollapsiblePagerViewProps]>();
const mockCommands = jest.fn<void, [number, boolean]>();
const mockTabBarProps = jest.fn<
  void,
  [
    {
      tabNames: string[];
      indexDecimal?: { value: number };
      scrollable?: boolean;
      keepFocusedTabVisible?: boolean;
    },
  ]
>();
const mockHistory = jest.fn<
  void,
  [{ action: string; timePeriod: string; reserveAddress: string }]
>();

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isNative() {
      return mockPlatform !== 'web';
    },
    get isNativeAndroid() {
      return mockPlatform === 'android';
    },
  },
}));
jest.mock('react-intl', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useIntl: () => {
      const { locale } = React.useContext(mockEnvironment);
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
  StyleSheet: { create: <T,>(styles: T) => styles },
  View: ({ children }: PropsWithChildren) => <div>{children}</div>,
}));
jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Box = ({ children }: PropsWithChildren) => <div>{children}</div>;
  return {
    XStack: Box,
    YStack: Box,
    Divider: () => <hr />,
    useMedia: () => ({ gtMd: React.useContext(mockEnvironment).wide }),
    TabBar: ({
      tabNames,
      focusedTab,
      onTabPress,
      indexDecimal,
      scrollable,
      keepFocusedTabVisible,
    }: {
      tabNames: string[];
      focusedTab: {
        value: string;
        subscribe: (listener: () => void) => () => void;
      };
      onTabPress: (name: string) => void;
      indexDecimal?: { value: number };
      scrollable?: boolean;
      keepFocusedTabVisible?: boolean;
    }) => {
      mockTabBarProps({
        tabNames,
        indexDecimal,
        scrollable,
        keepFocusedTabVisible,
      });
      const focusedName = React.useSyncExternalStore(
        focusedTab.subscribe,
        () => focusedTab.value,
      );
      return (
        <div role="tablist">
          {tabNames.map((name) => (
            <button
              key={name}
              role="tab"
              aria-selected={focusedName === name}
              onClick={() => onTabPress(name)}
            >
              {name}
            </button>
          ))}
        </div>
      );
    },
  };
});
jest.mock('react-native-pager-view', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    CollapsiblePagerView: React.forwardRef(
      (props: CollapsiblePagerViewProps, ref) => {
        mockPagerProps(props);
        const [selected, setSelected] = React.useState(props.initialPage ?? 0);
        const latest = React.useRef(props);
        latest.current = props;
        React.useImperativeHandle(ref, () => {
          const select = (position: number, animated: boolean) => {
            mockCommands(position, animated);
            setSelected(position);
            const event = { nativeEvent: { position } } as Parameters<
              NonNullable<CollapsiblePagerViewProps['onPageSelected']>
            >[0];
            void latest.current.onPageSelected?.(event);
          };
          return {
            setPage: (index: number) => select(index, true),
            setPageWithoutAnimation: (index: number) => select(index, false),
          };
        }, []);
        return (
          <div data-testid="reserve-pager">
            {props.header}
            {props.stickyHeader}
            {React.Children.map(props.children, (child, index) => (
              <div aria-hidden={index !== selected}>{child}</div>
            ))}
          </div>
        );
      },
    ),
    NativeScroller: ({
      children,
      pagerScrollKey,
    }: PropsWithChildren<{ pagerScrollKey: string }>) => (
      <div data-testid={`scroller-${pagerScrollKey}`}>{children}</div>
    ),
  };
});
jest.mock('../hooks/useBorrowChartData', () => ({
  useApyChartColors: () => ({ supply: {}, borrow: {}, lineWidth: 2 }),
  useTimePeriodOptions: () => [
    { label: 'Week', value: 'week' },
    { label: 'Month', value: 'month' },
    { label: 'Quarter', value: 'quarter' },
  ],
  useApyLabels: () => ({
    supplyApyLabel: 'Supply APY',
    borrowApyLabel: 'Borrow APY',
  }),
  useBorrowBadges: () => ({}),
  useBorrowApyHistory: (params: {
    action: string;
    timePeriod: string;
    reserveAddress: string;
  }) => {
    mockHistory(params);
    return { history: [], isLoading: false };
  },
}));
jest.mock('./ApyChartSection', () => ({
  ApyChartSection: ({
    apyLabel,
    timePeriod,
    onTimePeriodChange,
  }: {
    apyLabel: string;
    timePeriod: string;
    onTimePeriodChange: (period: string) => void;
  }) => (
    <select
      aria-label={apyLabel}
      value={timePeriod}
      onChange={(event) => onTimePeriodChange(event.target.value)}
    >
      {['week', 'month', 'quarter'].map((period) => (
        <option key={period}>{period}</option>
      ))}
    </select>
  ),
}));
jest.mock('./BorrowFAQSection', () => ({
  BorrowFAQSection: () => <button>FAQ</button>,
}));
jest.mock('./DailyCapsSection', () => ({
  DailyCapsSection: () => <div>Daily caps</div>,
}));
jest.mock('./InterestRateModelSection', () => ({
  InterestRateModelSection: () => <div>Rate model</div>,
}));
jest.mock('./RiskSection', () => ({ RiskSection: () => <div>Risk</div> }));
jest.mock('./ChartSection', () => ({
  ChartSection: () => <div data-testid="wide-charts" />,
}));
jest.mock('./ReserveProtocolHeader', () => ({
  ReserveProtocolHeader: ({ symbol }: { symbol: string }) => (
    <div>{symbol} overview</div>
  ),
}));
jest.mock('./BorrowReserveDetailsSkeleton', () => ({
  BorrowReserveDetailsSkeleton: () => <div />,
}));
jest.mock('@onekeyhq/kit/src/components/Currency', () => ({
  useCurrency: () => ({ id: 'usd', symbol: '$' }),
}));
jest.mock('@onekeyhq/shared/src/locale/appLocale', () => ({
  appLocale: { intl: { locale: 'en' } },
}));
jest.mock('@onekeyhq/shared/src/utils/numberUtils', () => ({
  LOCALE_SEPARATORS: { en: { grouping: ',', decimal: '.' } },
  formatLocalizedNumberString: (value: string) => value,
}));
jest.mock('@onekeyhq/kit/src/views/Staking/components/PageFrame', () => ({
  PageFrame: ({ children }: PropsWithChildren) => <>{children}</>,
  isLoadingState: () => false,
  isErrorState: () => false,
}));

function Environment({ children }: PropsWithChildren) {
  const locale = mockLocale;
  const wide = mockWide;
  const value = useMemo(() => ({ locale, wide }), [locale, wide]);
  return (
    <mockEnvironment.Provider value={value}>
      {children}
    </mockEnvironment.Provider>
  );
}
const renderTabs = (ui: ReactElement) => render(ui, { wrapper: Environment });
const latest = () => mockPagerProps.mock.calls.at(-1)![0];
const route = {
  networkId: 'evm--1',
  provider: 'aave',
  marketAddress: 'market',
  reserveAddress: 'reserve',
};
const label = (key: 'supply' | 'borrow' | 'more') =>
  `${mockLocale}:${{ supply: ETranslations.defi_supply_info, borrow: ETranslations.defi_borrow_info, more: ETranslations.global_more }[key]}`;
const press = (key: 'supply' | 'borrow' | 'more') =>
  fireEvent.click(screen.getByRole('tab', { name: label(key) }));
const selected = (key: 'supply' | 'borrow' | 'more') =>
  expect(
    screen.getByRole('tab', { name: label(key) }).getAttribute('aria-selected'),
  ).toBe('true');
const layout = (height: number) =>
  ({
    nativeEvent: { layout: { x: 0, y: 0, width: 375, height } },
  }) as LayoutChangeEvent;
const measure = (slot: 'header' | 'stickyHeader', height: number) =>
  act(() => {
    (latest()[slot] as ReactElement<ViewProps>).props.onLayout?.(
      layout(height),
    );
  });

const token = {
  uniqueKey: 'sample',
  address: 'reserve',
  decimals: 6,
  isNative: false,
  logoURI: '',
  name: 'USD Coin',
  symbol: 'USDC',
  totalSupply: '0',
  riskLevel: 0,
  coingeckoId: 'usd-coin',
  networkId: 'evm--1',
};
const usage = {
  percentage: '0',
  title: { text: '0' },
  description: { text: 'Sample' },
};
const zero = { title: { text: '0 USDC' } };
const details: IBorrowReserveDetail = {
  reserveSize: '1M',
  utilizationRatio: '50%',
  liquidity: '500K',
  oraclePrice: '1',
  interestRateModel: 'sample',
  userInfo: {
    walletBalance: zero,
    suppliedBalance: zero,
    borrowedBalance: zero,
    availableBorrowBalance: zero,
  },
  supply: {
    reserveAddress: 'reserve',
    token,
    apyDetail: { apy: '4' },
    categories: [],
    canBeCollateral: true,
    usage,
    maxLtv: { text: { text: '75%' } },
    liquidationLtv: { text: { text: '80%' } },
    softLiquidation: { text: { text: '-' } },
  },
  borrow: {
    reserveAddress: 'reserve',
    token,
    apyDetail: { apy: '5' },
    categories: [],
    canBeBorrowed: true,
    usage,
    borrowFactor: '1',
  },
};
const partProps = {
  ...route,
  details,
  isLoading: false,
  onRefresh: jest.fn<void, []>(),
  symbol: 'USDC',
};

beforeEach(() => {
  mockPlatform = 'web';
  mockLocale = 'en';
  mockWide = false;
  jest.clearAllMocks();
});

it.each(['web', 'ios', 'android'] as const)(
  'keeps one retained scroller per page and platform scroll behavior (%s)',
  (platform) => {
    mockPlatform = platform;
    renderTabs(
      <ReserveDetailsTabs
        {...route}
        details={details}
        header={<div>Reserve overview</div>}
      />,
    );
    expect(latest().scrollEnabled).toBe(platform !== 'web');
    const bar = mockTabBarProps.mock.calls.at(-1)?.[0];
    expect(Boolean(bar?.indexDecimal)).toBe(platform !== 'web');
    expect(bar?.scrollable).toBe(platform !== 'web');
    expect(bar?.keepFocusedTabVisible).toBe(platform !== 'web');
    expect(latest().nestedScrollEnabled).toBe(true);
    expect(latest().pageRetentionDistance).toBe(2);
    expect(latest().offscreenPageLimit).toBe(
      platform === 'android' ? 2 : undefined,
    );
    for (const key of ['supply', 'borrow', 'more'])
      expect(
        screen
          .getByTestId(`scroller-${key}`)
          .querySelector('[data-testid^="scroller-"]'),
      ).toBeNull();
    press('borrow');
    selected('borrow');
    expect(mockCommands).toHaveBeenLastCalledWith(1, platform !== 'web');
    expect(screen.getByTestId('scroller-supply')).toBeTruthy();
    expect(screen.getByTestId('scroller-more')).toBeTruthy();
  },
);

it('measures intrinsic header and sticky content, rounds up and accepts later size changes', () => {
  renderTabs(
    <ReserveDetailsTabs {...route} header={<div>Reserve overview</div>} />,
  );
  expect(latest().nativeSmoothHeaderScrollEnabled).toBe(false);
  expect((latest().header as ReactElement<ViewProps>).props.style).toEqual({
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  });
  measure('header', 180.2);
  expect(latest().headerHeight).toBe(181);
  expect(latest().nativeSmoothHeaderScrollEnabled).toBe(false);
  measure('stickyHeader', 48.1);
  expect(latest().stickyHeaderHeight).toBe(49);
  expect(latest().nativeSmoothHeaderScrollEnabled).toBe(true);
  measure('header', 260.4);
  expect(latest().headerHeight).toBe(261);
  measure('header', 140.1);
  expect(latest().headerHeight).toBe(141);
  measure('stickyHeader', 0);
  expect(latest().stickyHeaderHeight).toBe(0);
  expect(latest().nativeSmoothHeaderScrollEnabled).toBe(false);
});

it('keeps independent chart periods and page instances through data and locale updates', () => {
  const view = renderTabs(<DetailsPart {...partProps} />);
  const supplyScroller = screen.getByTestId('scroller-supply');
  supplyScroller.scrollTop = 180;
  fireEvent.change(screen.getByRole('combobox', { name: 'Supply APY' }), {
    target: { value: 'month' },
  });
  press('borrow');
  fireEvent.change(screen.getByRole('combobox', { name: 'Borrow APY' }), {
    target: { value: 'quarter' },
  });
  press('more');
  const names = mockTabBarProps.mock.calls.at(-1)![0].tabNames;
  const renders = mockTabBarProps.mock.calls.length;
  view.rerender(
    <DetailsPart {...partProps} details={{ ...details, liquidity: '550K' }} />,
  );
  expect(mockTabBarProps.mock.calls.length).toBeGreaterThan(renders);
  expect(mockTabBarProps.mock.calls.at(-1)![0].tabNames).toBe(names);
  selected('more');
  mockLocale = 'zh';
  view.rerender(
    <DetailsPart {...partProps} details={{ ...details, liquidity: '600K' }} />,
  );
  selected('more');
  expect(mockTabBarProps.mock.calls.at(-1)![0].tabNames).not.toBe(names);
  expect(mockTabBarProps.mock.calls.at(-1)![0].tabNames).toEqual(
    (['supply', 'borrow', 'more'] as const).map(label),
  );
  expect(screen.getByTestId('scroller-supply')).toBe(supplyScroller);
  expect(supplyScroller.scrollTop).toBe(180);
  press('supply');
  expect(
    (screen.getByRole('combobox', { name: 'Supply APY' }) as HTMLSelectElement)
      .value,
  ).toBe('month');
  press('borrow');
  expect(
    (screen.getByRole('combobox', { name: 'Borrow APY' }) as HTMLSelectElement)
      .value,
  ).toBe('quarter');
  expect(
    mockHistory.mock.calls
      .filter(([params]) => params.action === 'supply')
      .at(-1)?.[0].timePeriod,
  ).toBe('month');
  expect(
    mockHistory.mock.calls
      .filter(([params]) => params.action === 'borrow')
      .at(-1)?.[0].timePeriod,
  ).toBe('quarter');
});

it.each(['networkId', 'provider', 'marketAddress', 'reserveAddress'] as const)(
  'resets only when reserve identity %s changes',
  (field) => {
    const view = renderTabs(<DetailsPart {...partProps} />);
    const previous = screen.getByTestId('scroller-supply');
    fireEvent.change(screen.getByRole('combobox', { name: 'Supply APY' }), {
      target: { value: 'month' },
    });
    press('more');
    view.rerender(
      <DetailsPart
        {...partProps}
        {...{ [field]: `${partProps[field]}-new` }}
      />,
    );
    selected('supply');
    expect(screen.getByTestId('scroller-supply')).not.toBe(previous);
    expect(
      (
        screen.getByRole('combobox', {
          name: 'Supply APY',
        }) as HTMLSelectElement
      ).value,
    ).toBe('week');
  },
);

it('keeps the existing wide-screen chart layout outside the pager', () => {
  mockWide = true;
  renderTabs(<DetailsPart {...partProps} />);
  expect(screen.getByTestId('wide-charts')).toBeTruthy();
  expect(screen.queryByTestId('reserve-pager')).toBeNull();
  expect(screen.getByText('USDC overview')).toBeTruthy();
});
