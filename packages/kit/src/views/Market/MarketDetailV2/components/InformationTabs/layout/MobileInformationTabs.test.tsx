/** @jest-environment jsdom */
// cspell:ignore Financials

import { useEffect } from 'react';
import type { ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketAccountPortfolioDisplayItem } from '@onekeyhq/shared/types/marketV2';

import { Portfolio } from '../components/Portfolio';

import { MobileInformationTabs } from './MobileInformationTabs';

import type { CollapsibleProps } from 'react-native-collapsible-tab-view';

const mockContainerProps = jest.fn();
const mockChartMount = jest.fn();
const mockChartUnmount = jest.fn();
let mockGtLg = false;
let mockStockId: string | undefined;
let mockAccountAddress: string | undefined;

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => {
  const Box = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    DelayedFreeze:
      jest.requireActual<typeof import('react-freeze')>('react-freeze').Freeze,
    HeaderScrollGestureWrapper: Box,
    XStack: Box,
    YStack: Box,
    Stack: Box,
    Skeleton: Box,
    Empty: () => <div>No data</div>,
    SizableText: Box,
    DashText: Box,
    NumberSizeableText: ({
      children,
      color,
    }: {
      children?: ReactNode;
      color?: string;
    }) => <span data-color={color}>{children}</span>,
    useMedia: () => ({ gtLg: mockGtLg }),
    Tabs: {
      Container: (props: CollapsibleProps) => {
        mockContainerProps(props);
        const headerProps = {
          tabNames: ['transactions'],
          focusedTab: { value: 'transactions' },
        } as Parameters<NonNullable<CollapsibleProps['renderHeader']>>[0];
        return (
          <div data-testid="information-scroll-container">
            {props.renderHeader?.(headerProps)}
            {props.renderTabBar?.(headerProps)}
            {props.children}
          </div>
        );
      },
      Tab: ({ name, children }: { name?: string; children?: ReactNode }) => (
        <div data-testid={`information-tab-${name ?? ''}`}>{children}</div>
      ),
      ScrollView: Box,
      FlatList: ({
        data,
        renderItem,
        ListEmptyComponent,
      }: {
        data: IMarketAccountPortfolioDisplayItem[];
        renderItem: (info: {
          item: IMarketAccountPortfolioDisplayItem;
        }) => ReactNode;
        ListEmptyComponent: ReactNode;
      }) => (
        <div>
          {data.length > 0
            ? data.map((item) => (
                <div key={`${item.networkId}:${item.tokenAddress}`}>
                  {renderItem({ item })}
                </div>
              ))
            : ListEmptyComponent}
        </div>
      ),
      TabBar: () => <div data-testid="information-tab-bar" />,
    },
  };
});
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true },
}));
jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: { isBTCNetwork: () => false },
}));
jest.mock('@onekeyhq/kit/src/hooks/useTabContainerWidth', () => ({
  useTabContainerWidth: () => 390,
}));
jest.mock('../../../hooks/useMarketDetailPositionTab', () => ({
  useMarketDetailPositionTab: () => ({
    preferPosition: false,
    recordTabChange: jest.fn(),
  }),
}));
let mockNetworkId = 'evm--1';
let mockTokenAddress = '0xabc';
jest.mock('../../../hooks/useTokenDetail', () => ({
  useTokenDetail: () => ({
    networkId: mockNetworkId,
    tokenAddress: mockTokenAddress,
    isNative: true,
  }),
}));
jest.mock('../hooks/useNetworkAccountAddress', () => ({
  useNetworkAccountAddress: () => ({ accountAddress: mockAccountAddress }),
}));
jest.mock('../hooks/useBottomTabAnalytics', () => ({
  useBottomTabAnalytics: () => ({ handleTabChange: jest.fn() }),
}));
jest.mock('../../TokenLiquidityPools', () => ({
  TokenLiquidityPools: () => null,
}));
jest.mock('../components/Holders', () => ({ Holders: () => null }));
jest.mock('@onekeyhq/kit/src/components/Currency', () => ({
  Currency: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
}));
jest.mock('@onekeyhq/kit/src/components/Token', () => ({
  Token: ({ tokenImageUri }: { tokenImageUri?: string }) => (
    <img alt="" src={tokenImageUri} />
  ),
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useCurrencyPersistAtom: () => [{ currencyMap: {} }],
}));
jest.mock('../components/TransactionsHistory', () => ({
  TransactionsHistory: () => null,
}));
jest.mock('./StickyHeader', () => ({ StickyHeader: () => null }));
jest.mock('../../../hooks/StockDetailContext', () => ({
  useStockDetail: () => ({
    stockId: mockStockId,
    isTokenVariantsLoading: false,
  }),
}));
jest.mock('./MobileDetailOverviewPanels', () => ({
  MobileStockFinancialsPanel: () => null,
  MobileStockOverviewPanel: () => null,
  MobileTopCoinsOverviewPanel: () => null,
  MobileTrendingOverviewPanel: () => null,
}));

function Chart() {
  useEffect(() => {
    mockChartMount();
    return () => {
      mockChartUnmount();
    };
  }, []);
  return <input aria-label="chart viewport" defaultValue="latest" />;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockNetworkId = 'evm--1';
  mockTokenAddress = '0xabc';
  mockStockId = undefined;
});

it.each(['address', 'network'] as const)(
  'resets scrolling when the token %s changes with the same tabs',
  (identity) => {
    const renderTabs = () => (
      <MobileInformationTabs
        renderHeader={() => <Chart />}
        onScrollEnd={jest.fn()}
        portfolioData={[]}
      />
    );
    const { rerender } = render(renderTabs());
    const container = screen.getByTestId('information-scroll-container');
    container.scrollTop = 400;

    // Refreshing the current token must preserve its scroll position.
    rerender(renderTabs());
    expect(screen.getByTestId('information-scroll-container')).toBe(container);
    expect(container.scrollTop).toBe(400);

    if (identity === 'address') {
      mockTokenAddress = '0xdef';
    } else {
      mockNetworkId = 'evm--8453';
    }
    rerender(renderTabs());
    const nextContainer = screen.getByTestId('information-scroll-container');
    expect(nextContainer).not.toBe(container);
    expect(nextContainer.scrollTop).toBe(0);
  },
);

describe('MobileInformationTabs chart fullscreen', () => {
  it('keeps the chart controller mounted while the hidden information content is frozen', async () => {
    const renderTabs = (isChartFullscreen: boolean) => (
      <MobileInformationTabs
        freezeContent={isChartFullscreen}
        containerWidth={390}
        scrollEnabled={!isChartFullscreen}
        renderHeader={() => <Chart />}
        onScrollEnd={jest.fn()}
        portfolioData={[]}
      />
    );
    const { rerender } = render(renderTabs(false));
    const chart = screen.getByRole('textbox', { name: 'chart viewport' });
    fireEvent.change(chart, { target: { value: 'historical candles' } });
    expect(screen.queryByTestId('information-tab-bar')).not.toBeNull();

    await act(async () => rerender(renderTabs(true)));
    expect(mockContainerProps).toHaveBeenLastCalledWith(
      expect.objectContaining({
        width: 390,
      }),
    );
    expect(screen.queryByTestId('information-tab-bar')).not.toBeNull();

    await act(async () => rerender(renderTabs(false)));
    expect(mockContainerProps).toHaveBeenLastCalledWith(
      expect.objectContaining({
        width: 390,
      }),
    );
    expect(screen.queryByTestId('information-tab-bar')).not.toBeNull();
    expect(screen.getByRole('textbox', { name: 'chart viewport' })).toBe(chart);
    expect((chart as HTMLInputElement).value).toBe('historical candles');
    expect(mockChartMount).toHaveBeenCalledTimes(1);
    expect(mockChartUnmount).not.toHaveBeenCalled();
    expect(
      screen.getByTestId('information-tab-dexmarket.details_myposition'),
    ).toBeTruthy();
  });
});

it('mounts stock content before the token network resolves and keeps the same chart', () => {
  mockStockId = 'AAPL';
  mockNetworkId = '';
  const renderTabs = () => (
    <MobileInformationTabs
      detailKind="stock"
      renderHeader={() => <Chart />}
      onScrollEnd={jest.fn()}
      portfolioData={[]}
    />
  );
  const { rerender } = render(renderTabs());
  const chart = screen.getByRole('textbox', { name: 'chart viewport' });
  mockNetworkId = 'evm--1';
  rerender(renderTabs());
  expect(screen.getByRole('textbox', { name: 'chart viewport' })).toBe(chart);

  const container = screen.getByTestId('information-scroll-container');
  container.scrollTop = 400;
  mockStockId = 'TSLA';
  rerender(renderTabs());
  const nextContainer = screen.getByTestId('information-scroll-container');
  expect(nextContainer).not.toBe(container);
  expect(nextContainer.scrollTop).toBe(0);
});

describe('stock positions', () => {
  const positions: IMarketAccountPortfolioDisplayItem[] = [
    {
      networkId: 'evm--1',
      accountAddress: 'account-ethereum',
      tokenAddress: '0xNVDAon',
      tokenLogoUrl: 'https://example.com/nvda-on.png',
      symbol: 'NVDAon',
      amount: '1',
      tokenPrice: '100',
      totalPrice: '100',
      pnl: {
        isPnlSupported: true,
        unrealizedPnlUsd: '-5',
        unrealizedPnlPercent: '-4.76',
        totalPnlUsd: '10',
        totalPnlPercent: '10',
      },
    },
    {
      networkId: 'sol--101',
      accountAddress: 'account-solana',
      tokenAddress: 'NVDAB',
      tokenLogoUrl: 'https://example.com/nvda-b.png',
      symbol: 'NVDAB',
      amount: '2',
      tokenPrice: '100',
      totalPrice: '200',
    },
  ];

  beforeEach(() => {
    mockNetworkId = 'sol--101';
    mockStockId = 'NVDA';
    mockAccountAddress = undefined;
    mockGtLg = false;
    platformEnv.isNative = true;
  });

  afterEach(() => {
    mockStockId = undefined;
    mockAccountAddress = undefined;
    mockGtLg = false;
    platformEnv.isNative = true;
  });

  it('shows every stock variant with its identity and value even without a selected-network account', () => {
    const { container } = render(
      <MobileInformationTabs
        detailKind="stock"
        renderHeader={() => null}
        onScrollEnd={jest.fn()}
        portfolioData={positions}
        hasPortfolioAccount
      />,
    );

    expect(screen.getByText('NVDAon')).toBeTruthy();
    expect(screen.getByText('NVDAB')).toBeTruthy();
    expect(screen.getByText('100')).toBeTruthy();
    expect(screen.getByText('200')).toBeTruthy();
    expect(screen.getByText('-4.76').getAttribute('data-color')).toBe(
      '$textCritical',
    );
    expect(screen.queryByText('No data')).toBeNull();
    expect(
      Array.from(container.querySelectorAll('img'), (img) => img.src),
    ).toEqual(positions.map((position) => position.tokenLogoUrl));
  });

  it('keeps the desktop stock table columns', () => {
    platformEnv.isNative = false;
    mockGtLg = true;
    render(
      <Portfolio standalone isStock hasAccount portfolioData={positions} />,
    );

    expect(screen.getByText('NVDAon')).toBeTruthy();
    expect(screen.getByText('NVDAB')).toBeTruthy();
    expect(screen.getByText('marketdex.unrealized_pnl')).toBeTruthy();
    expect(screen.getByText('marketdex.total_pnl')).toBeTruthy();
  });

  it('hides stock dust and retains the holding at the USD visibility threshold', () => {
    render(
      <Portfolio
        standalone
        isStock
        hasAccount
        portfolioData={[
          positions[0],
          {
            ...positions[1],
            tokenAddress: 'dust',
            symbol: 'DUST',
            amount: '0.00005',
            totalPrice: '0.005',
          },
          {
            ...positions[1],
            tokenAddress: 'boundary',
            symbol: 'BOUNDARY',
            amount: '0.0001',
            totalPrice: '0.01',
          },
        ]}
      />,
    );
    expect(screen.getByText('NVDAon')).toBeTruthy();
    expect(screen.getByText('BOUNDARY')).toBeTruthy();
    expect(screen.queryByText('DUST')).toBeNull();
  });

  it('uses Name and Value/PNL columns for stocks on wide native screens too', () => {
    mockGtLg = true;
    render(
      <Portfolio standalone isStock hasAccount portfolioData={positions} />,
    );

    expect(screen.getByText('NVDAon')).toBeTruthy();
    expect(screen.getByText('NVDAB')).toBeTruthy();
    expect(screen.getByText('dexmarket.token_name')).toBeTruthy();
    expect(
      screen.getByText(
        'dexmarket.details_history_value / perp.position_pnl_mobile',
      ),
    ).toBeTruthy();
    expect(screen.queryByText('marketdex.total_pnl')).toBeNull();
  });
});
