/** @jest-environment jsdom */

import { createContext, useMemo } from 'react';
import type { CSSProperties, PropsWithChildren, ReactElement } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';
import BigNumber from 'bignumber.js';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { EarnMainTabs } from './EarnMainTabs';

import type { IUseEarnPortfolioReturn } from '../hooks/useEarnPortfolio';

type IEarnTabKey = 'assets' | 'portfolio' | 'faqs';
let mockLocale = 'en';
let mockNavigationFocused = true;
let mockRouteFocused = true;
const mockSetParams = jest.fn<void, [unknown]>();
const mockPagerCommand = jest.fn<void, [number, boolean]>();
const mockPagerProps = jest.fn<void, [unknown]>();
const mockTabBarNames = jest.fn<void, [string[]]>();
const mockAssetMount = jest.fn<void, []>();
const mockAssetUnmount = jest.fn<void, []>();
const mockSubscribe = jest.fn<void, []>();
const mockUnsubscribe = jest.fn<void, []>();
const mockEnvironmentContext = createContext({
  locale: 'en',
  navigationFocused: true,
  routeFocused: true,
});

jest.mock('@react-navigation/core', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useIsFocused: () =>
      React.useContext(mockEnvironmentContext).navigationFocused,
  };
});
jest.mock('../../../hooks/useRouteIsFocused', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useRouteIsFocused: () =>
      React.useContext(mockEnvironmentContext).routeFocused,
  };
});
jest.mock('react-intl', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useIntl: () => {
      const { locale } = React.useContext(mockEnvironmentContext);
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
        let current = initial;
        const listeners = new Set<() => void>();
        ref.current = {
          get value() {
            return current;
          },
          set value(next) {
            if (Object.is(current, next)) return;
            current = next;
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
  const Box = ({
    children,
    display,
    style,
  }: PropsWithChildren<{
    display?: 'flex' | 'none';
    style?: CSSProperties;
  }>) => <div style={{ ...style, display }}>{children}</div>;
  return {
    XStack: Box,
    YStack: Box,
    rootNavigationRef: {
      current: { setParams: (params: unknown) => mockSetParams(params) },
    },
    useScrollContentTabBarOffset: () => 0,
    TabBar: ({
      tabNames,
      focusedTab,
      onTabPress,
      renderToolbar,
    }: {
      tabNames: string[];
      focusedTab: {
        value: string;
        subscribe: (listener: () => void) => () => void;
      };
      onTabPress: (name: string) => void;
      renderToolbar: (props: { focusedTab: string }) => React.ReactNode;
    }) => {
      mockTabBarNames(tabNames);
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
          {renderToolbar({ focusedTab: focusedName })}
        </div>
      );
    },
  };
});
jest.mock('react-native-pager-view', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    default: React.forwardRef(
      (
        props: PropsWithChildren<{
          initialPage: number;
          scrollEnabled: boolean;
          onPageSelected?: (event: {
            nativeEvent: { position: number };
          }) => void;
          onPageScroll?: (event: {
            nativeEvent: { position: number; offset: number };
          }) => void;
          style?: unknown;
        }>,
        ref,
      ) => {
        mockPagerProps(props);
        const callbacks = React.useRef(props);
        callbacks.current = props;
        React.useImperativeHandle(
          ref,
          () => ({
            setPage: (position: number) => mockPagerCommand(position, true),
            setPageWithoutAnimation: (position: number) => {
              mockPagerCommand(position, false);
              callbacks.current.onPageScroll?.({
                nativeEvent: { position, offset: 0 },
              });
              callbacks.current.onPageSelected?.({ nativeEvent: { position } });
            },
          }),
          [],
        );
        return <div data-testid="earn-pager">{props.children}</div>;
      },
    ),
  };
});
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => {
  const listeners = new Set<(payload: { tab: IEarnTabKey }) => void>();
  return {
    EAppEventBusNames: { SwitchEarnTab: 'SwitchEarnTab' },
    appEventBus: {
      on: jest.fn(
        (_event: string, listener: (payload: { tab: IEarnTabKey }) => void) => {
          mockSubscribe();
          listeners.add(listener);
        },
      ),
      off: jest.fn(
        (_event: string, listener: (payload: { tab: IEarnTabKey }) => void) => {
          mockUnsubscribe();
          listeners.delete(listener);
        },
      ),
      emit: (_event: string, payload: { tab: IEarnTabKey }) =>
        listeners.forEach((listener) => listener(payload)),
    },
  };
});
jest.mock('../hooks/useEarnHideSmallAssets', () => ({
  useEarnHideSmallAssets: () => ({ hideSmallAssets: true }),
}));
jest.mock('./ProtocolsTabContent', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    ProtocolsTabContent: ({ isActive }: { isActive: boolean }) => {
      React.useEffect(() => {
        mockAssetMount();
        return mockAssetUnmount;
      }, []);
      const [filter, setFilter] = React.useState('');
      return (
        <input
          aria-label="asset filter"
          data-active={isActive}
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
      );
    },
  };
});
jest.mock('./PortfolioTabContent', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    PortfolioTabContent: ({
      hideSmallAssets,
    }: {
      hideSmallAssets: boolean;
    }) => {
      const [filter, setFilter] = React.useState('');
      return (
        <input
          aria-label="position filter"
          data-hide-small-assets={hideSmallAssets}
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
      );
    },
  };
});
jest.mock('./FAQContent', () => ({
  FAQContent: () => <button>FAQ answer</button>,
}));
jest.mock('./EarnPortfolioSettings', () => ({
  EarnPortfolioSettings: () => <button>Portfolio settings</button>,
}));

function MockEnvironment({ children }: PropsWithChildren) {
  const locale = mockLocale;
  const navigationFocused = mockNavigationFocused;
  const routeFocused = mockRouteFocused;
  const value = useMemo(
    () => ({ locale, navigationFocused, routeFocused }),
    [locale, navigationFocused, routeFocused],
  );
  return (
    <mockEnvironmentContext.Provider value={value}>
      {children}
    </mockEnvironmentContext.Provider>
  );
}
const renderTabs = (ui: ReactElement) =>
  render(ui, { wrapper: MockEnvironment });

const portfolioData: IUseEarnPortfolioReturn = {
  investments: [],
  earnTotalFiatValue: new BigNumber(0),
  earnTotalEarnings24hFiatValue: new BigNumber(0),
  cachedOverviewTotalFiatValue: undefined,
  cachedOverviewEarnings24h: undefined,
  isLoading: false,
  refresh: async () => undefined,
};
const props = { faqList: [], portfolioData };
const ids = {
  assets: ETranslations.earn_available_assets,
  portfolio: ETranslations.earn_positions,
  faqs: ETranslations.global_faqs,
};
const tab = (key: IEarnTabKey) =>
  screen.getByRole('tab', { name: `${mockLocale}:${ids[key]}` });
const selected = (key: IEarnTabKey) =>
  expect(tab(key).getAttribute('aria-selected')).toBe('true');

beforeEach(() => {
  mockLocale = 'en';
  mockNavigationFocused = true;
  mockRouteFocused = true;
  jest.clearAllMocks();
});

it.each([undefined, 'assets', 'portfolio', 'faqs'] as const)(
  'seeds the route tab %s and preserves the outer scroll owner',
  (defaultTab) => {
    renderTabs(<EarnMainTabs {...props} defaultTab={defaultTab} />);
    selected(defaultTab ?? 'assets');
    const pagerProps = mockPagerProps.mock.calls.at(-1)?.[0] as {
      initialPage: number;
      scrollEnabled: boolean;
      style?: unknown;
    };
    expect(pagerProps.initialPage).toBe(
      { assets: 0, portfolio: 1, faqs: 2 }[defaultTab ?? 'assets'],
    );
    expect(pagerProps.scrollEnabled).toBe(false);
    expect(pagerProps.style).toBeUndefined();
    expect(screen.getByTestId('earn-pager').children).toHaveLength(3);
    expect(
      screen.queryByRole('button', { name: 'Portfolio settings' }) !== null,
    ).toBe(defaultTab === 'portfolio');
    expect(mockSetParams).not.toHaveBeenCalled();
  },
);

it('keeps tab names stable across portfolio data updates', () => {
  const view = renderTabs(<EarnMainTabs {...props} defaultTab="portfolio" />);
  const names = mockTabBarNames.mock.calls.at(-1)![0];
  const renders = mockTabBarNames.mock.calls.length;
  view.rerender(
    <EarnMainTabs
      {...props}
      defaultTab="portfolio"
      portfolioData={{ ...portfolioData, isLoading: true }}
    />,
  );
  expect(mockTabBarNames.mock.calls.length).toBeGreaterThan(renders);
  expect(mockTabBarNames.mock.calls.at(-1)![0]).toBe(names);
  selected('portfolio');
});

it('synchronizes route changes and focus return without writing route params', () => {
  const view = renderTabs(<EarnMainTabs {...props} defaultTab="assets" />);
  view.rerender(<EarnMainTabs {...props} defaultTab="faqs" />);
  selected('faqs');
  expect(mockSetParams).not.toHaveBeenCalled();
  fireEvent.click(tab('portfolio'));
  expect(mockSetParams).toHaveBeenLastCalledWith({ tab: 'portfolio' });
  mockSetParams.mockClear();
  mockRouteFocused = false;
  view.rerender(<EarnMainTabs {...props} defaultTab="faqs" />);
  mockRouteFocused = true;
  view.rerender(<EarnMainTabs {...props} defaultTab="faqs" />);
  selected('faqs');
  expect(mockSetParams).not.toHaveBeenCalled();
});

it.each([undefined, 'assets'] as const)(
  'keeps a manual selection and local filters across locale changes (override=%s)',
  (defaultTab) => {
    const view = renderTabs(
      <EarnMainTabs {...props} defaultTab={defaultTab} />,
    );
    const assetFilter = screen.getByRole('textbox', { name: 'asset filter' });
    fireEvent.change(assetFilter, { target: { value: 'ETH' } });
    fireEvent.click(tab('portfolio'));
    const positionFilter = screen.getByRole('textbox', {
      name: 'position filter',
    });
    fireEvent.change(positionFilter, { target: { value: 'USDC' } });
    expect(screen.queryByRole('textbox', { name: 'asset filter' })).toBeNull();
    const names = mockTabBarNames.mock.calls.at(-1)![0];
    mockLocale = 'zh';
    view.rerender(<EarnMainTabs {...props} defaultTab={defaultTab} />);
    selected('portfolio');
    expect(mockTabBarNames.mock.calls.at(-1)![0]).not.toBe(names);
    expect(mockTabBarNames.mock.calls.at(-1)![0]).toEqual(
      Object.values(ids).map((id) => `zh:${id}`),
    );
    expect(screen.getByRole('textbox', { name: 'position filter' })).toBe(
      positionFilter,
    );
    expect((positionFilter as HTMLInputElement).value).toBe('USDC');
    expect(mockSetParams).toHaveBeenCalledTimes(1);
    fireEvent.click(tab('assets'));
    expect(screen.getByRole('textbox', { name: 'asset filter' })).toBe(
      assetFilter,
    );
    expect((assetFilter as HTMLInputElement).value).toBe('ETH');
    expect(mockAssetMount).toHaveBeenCalledTimes(1);
    expect(mockAssetUnmount).not.toHaveBeenCalled();
  },
);

it('routes mounted SwitchEarnTab events once and gates asset work by business and page activity', () => {
  const view = renderTabs(<EarnMainTabs {...props} isActive={false} />);
  const assetFilter = screen.getByRole('textbox', { name: 'asset filter' });
  expect(assetFilter.getAttribute('data-active')).toBe('false');
  view.rerender(<EarnMainTabs {...props} isActive />);
  expect(assetFilter.getAttribute('data-active')).toBe('true');
  act(() => {
    void appEventBus.emit(EAppEventBusNames.SwitchEarnTab, {
      tab: 'portfolio',
    });
  });
  selected('portfolio');
  expect(mockSetParams).toHaveBeenCalledTimes(1);
  expect(mockSetParams).toHaveBeenLastCalledWith({ tab: 'portfolio' });
  expect(assetFilter.getAttribute('data-active')).toBe('false');
  expect(
    screen
      .getByRole('textbox', { name: 'position filter' })
      .getAttribute('data-hide-small-assets'),
  ).toBe('true');
  expect(
    screen.getByRole('button', { name: 'Portfolio settings' }),
  ).toBeTruthy();
  act(() => {
    void appEventBus.emit(EAppEventBusNames.SwitchEarnTab, { tab: 'assets' });
  });
  selected('assets');
  expect(assetFilter.getAttribute('data-active')).toBe('true');
  expect(mockSetParams).toHaveBeenCalledTimes(2);
  expect(mockPagerCommand.mock.calls.every((call) => call[1] === false)).toBe(
    true,
  );
});

it('waits for the first navigation focus before mounting content or subscribing', () => {
  mockNavigationFocused = false;
  const view = renderTabs(<EarnMainTabs {...props} />);
  expect(mockAssetMount).not.toHaveBeenCalled();
  expect(mockSubscribe).not.toHaveBeenCalled();
  mockNavigationFocused = true;
  view.rerender(<EarnMainTabs {...props} />);
  expect(mockAssetMount).toHaveBeenCalledTimes(1);
  expect(mockSubscribe).toHaveBeenCalledTimes(1);
  view.unmount();
  expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
});

it('commits only the final page when same-task events return to the starting page', () => {
  renderTabs(<EarnMainTabs {...props} />);
  mockPagerCommand.mockClear();
  act(() => {
    void appEventBus.emit(EAppEventBusNames.SwitchEarnTab, {
      tab: 'portfolio',
    });
    void appEventBus.emit(EAppEventBusNames.SwitchEarnTab, { tab: 'assets' });
  });
  selected('assets');
  expect(
    screen
      .getByRole('textbox', { name: 'asset filter' })
      .getAttribute('data-active'),
  ).toBe('true');
  expect(screen.queryByRole('textbox', { name: 'position filter' })).toBeNull();
  expect(mockSetParams.mock.calls).toEqual([
    [{ tab: 'portfolio' }],
    [{ tab: 'assets' }],
  ]);
  expect(mockPagerCommand).not.toHaveBeenCalled();
  expect(mockPagerProps.mock.calls.at(-1)?.[0]).not.toHaveProperty(
    'onPageSelected',
  );
});
