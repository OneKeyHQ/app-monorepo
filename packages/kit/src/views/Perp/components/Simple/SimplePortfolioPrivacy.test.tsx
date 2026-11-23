/** @jest-environment jsdom */

import { fireEvent, render, waitFor } from '@testing-library/react';

import type { IPerpsAssetPosition } from '@onekeyhq/shared/types/hyperliquid';

import { SimpleMarketPortfolio } from './SimpleMarketPortfolio';
import { SimpleOrderSummary } from './SimpleOrderSummary';
import { SimplePortfolioTabs } from './SimplePortfolioTabs';
import {
  SimplePositionCard,
  SimplePositionSummary,
} from './SimplePositionCard';
import { SimpleTwapEntry } from './SimpleTwapEntry';

let mockHideValue = false;
let mockSubmitting = false;
const mockSetSettings = jest.fn();
const mockSetFilter = jest.fn();
const mockSetViewState = jest.fn();
const mockCancelOrder = jest.fn();
const mockChaseOrder = jest.fn();
let mockCanMutateOrders = true;
let mockChasingOrderIds = new Set<number>();
const mockEditTpsl = jest.fn();
const mockAdjustMargin = jest.fn();
let mockOrders: {
  oid: number;
  coin: string;
  side: 'B';
  orderType: string;
  tif?: 'Gtc' | 'Ioc' | 'Alo';
  sz: string;
  origSz: string;
  limitPx: string;
  triggerPx: string;
  isTrigger: boolean;
  isPositionTpsl?: boolean;
  triggerCondition?: string;
  timestamp: number;
}[] = [];
let mockTwapState: {
  accountAddress: string;
  twapOrders: { twapId: number; state: { coin: string } }[];
} = { accountAddress: 'account-a', twapOrders: [] };
jest.mock('@onekeyhq/components', () => {
  const Box = ({
    children,
    testID,
    display,
    onPress,
    disabled,
    accessibilityState,
  }: {
    children?: React.ReactNode;
    testID?: string;
    display?: 'flex' | 'none';
    onPress?: () => void;
    disabled?: boolean;
    accessibilityState?: { selected?: boolean };
  }) =>
    onPress ? (
      <button
        type="button"
        data-testid={testID}
        style={{ display }}
        onClick={onPress}
        disabled={disabled}
        data-selected={accessibilityState?.selected}
      >
        {children}
      </button>
    ) : (
      <div data-testid={testID} style={{ display }}>
        {children}
      </div>
    );
  return {
    Button: Box,
    SizableText: Box,
    NumberSizeableText: Box,
    XStack: Box,
    YStack: Box,
    Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
    IconButton: () => null,
  };
});

jest.mock('@onekeyhq/kit/src/components/Token', () => ({ Token: () => null }));
jest.mock('@onekeyhq/kit/src/views/Market/components/PerpsBadges', () => ({
  LeverageBadge: ({ leverage }: { leverage: number }) => (
    <span>{leverage}x</span>
  ),
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useSettingsValuePersistAtom: () => [{ hideValue: mockHideValue }],
  usePerpsCustomSettingsAtom: () => [
    { mobileTradingMode: 'simple' },
    mockSetSettings,
  ],
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({}),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid', () => ({
  useHyperliquidActions: () => ({
    current: {
      setTradeRouteViewState: mockSetViewState,
      showSetPositionTpslUI: mockEditTpsl,
    },
  }),
  useTradingLoadingAtom: () => [mockSubmitting],
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms', () => ({
  useOrderFilterByCurrentTokenAtom: () => [true, mockSetFilter],
  usePerpsActiveTwapOrdersAtom: () => [mockTwapState],
}));
jest.mock('../../hooks/usePerpsAccountScopedOpenOrdersByCoin', () => ({
  usePerpsAccountScopedOpenOrdersByCoin: () => mockOrders,
}));
jest.mock('../../hooks/usePerpsAccountScopedCacheAddress', () => ({
  usePerpsAccountScopedCacheAddress: () => 'account-a',
}));
jest.mock('../OrderInfoPanel/hooks/useOpenOrderActions', () => ({
  useOpenOrderActions: () => ({
    canMutateScopedOrders: mockCanMutateOrders,
    chasingOrderIds: mockChasingOrderIds,
    handleCancelOrder: mockCancelOrder,
    handleChaseOrderPress: mockChaseOrder,
  }),
}));
jest.mock('../../hooks/useShowPositionShare', () => ({
  useShowPositionShare: () => ({ showPositionShare: jest.fn() }),
}));
jest.mock('../OrderInfoPanel/AdjustPositionMarginModal', () => ({
  showAdjustPositionMarginDialog: (params: unknown) => {
    mockAdjustMargin(params);
  },
}));
jest.mock('../OrderInfoPanel/SetTpslModal', () => ({
  showSetTpslDialog: jest.fn(),
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

it('keeps TWAP accessible inside the orders tab when no basic orders exist', async () => {
  const { queryByTestId, getByTestId, rerender } = render(
    <SimplePortfolioTabs
      positionCount={0}
      orderCount={2}
      testIDPrefix="twap-only"
    >
      {(tab) => (tab === 'orders' ? <SimpleTwapEntry count={2} /> : null)}
    </SimplePortfolioTabs>,
  );
  expect(getByTestId('twap-only-orders-tab').textContent).toContain('2');
  expect(getByTestId('perps-simple-twap-entry').textContent).toContain('2');
  fireEvent.click(getByTestId('perps-simple-twap-entry'));
  await waitFor(() => expect(mockSetSettings).toHaveBeenCalledTimes(1));
  expect(mockSetFilter).toHaveBeenCalledWith(false);
  expect(mockSetViewState).toHaveBeenCalledWith({
    infoPanelTab: 'OpenOrders',
    openOrdersSubTab: 'twap',
  });
  const updateSettings = mockSetSettings.mock.calls[0][0] as (previous: {
    mobileTradingMode: string;
    otherSetting: boolean;
  }) => { mobileTradingMode: string; otherSetting: boolean };
  expect(
    updateSettings({ mobileTradingMode: 'simple', otherSetting: true }),
  ).toEqual({
    mobileTradingMode: 'pro',
    otherSetting: true,
  });
  rerender(<SimpleTwapEntry count={0} />);
  expect(queryByTestId('perps-simple-twap-entry')).toBeNull();
});

it('does not switch trading mode while an order is being submitted', () => {
  mockSetSettings.mockClear();
  mockSetViewState.mockClear();
  mockSetFilter.mockClear();
  mockSubmitting = true;
  const { getByTestId } = render(<SimpleTwapEntry count={1} />);
  fireEvent.click(getByTestId('perps-simple-twap-entry'));
  expect(mockSetSettings).not.toHaveBeenCalled();
  expect(mockSetViewState).not.toHaveBeenCalled();
  expect(mockSetFilter).not.toHaveBeenCalled();
  mockSubmitting = false;
});

it('offers Chase for eligible limit orders, hides spot, and summarizes scoped TWAP separately', () => {
  mockOrders = ['Limit', 'Stop Market', 'Take Profit Limit', 'Limit'].map(
    (orderType, index) => ({
      oid: index + 1,
      coin: index === 3 ? '@107' : 'BTC',
      side: 'B',
      orderType,
      tif: 'Gtc',
      sz: '1',
      origSz: '2',
      limitPx: '100',
      triggerPx: '90',
      isTrigger: index === 1 || index === 2,
      timestamp: 1_700_000_000_000,
    }),
  );
  mockTwapState = {
    accountAddress: 'account-a',
    twapOrders: [
      { twapId: 1, state: { coin: 'BTC' } },
      { twapId: 2, state: { coin: '@107' } },
    ],
  };
  const { getByTestId, queryByTestId, queryAllByTestId, rerender } = render(
    <SimpleMarketPortfolio coin="BTC" />,
  );
  expect(getByTestId('perps-simple-market-orders-tab').textContent).toContain(
    '4',
  );
  expect(queryAllByTestId('perps-simple-order-BTC')).toHaveLength(3);
  expect(queryByTestId('perps-simple-order-@107')).toBeNull();
  fireEvent.click(getByTestId('perps-simple-chase-order-1'));
  expect(mockChaseOrder).toHaveBeenCalledWith(mockOrders[0]);
  expect(queryByTestId('perps-simple-chase-order-2')).toBeNull();
  expect(queryByTestId('perps-simple-chase-order-3')).toBeNull();
  expect(queryByTestId('perps-simple-chase-order-4')).toBeNull();
  expect(getByTestId('perps-simple-twap-entry').textContent).toContain('1');
  fireEvent.click(getByTestId('perps-simple-close-order-1'));
  expect(mockCancelOrder).toHaveBeenCalledWith(mockOrders[0]);

  mockChaseOrder.mockClear();
  mockCancelOrder.mockClear();
  mockChasingOrderIds = new Set([1]);
  rerender(<SimpleMarketPortfolio coin="BTC" />);
  fireEvent.click(getByTestId('perps-simple-chase-order-1'));
  fireEvent.click(getByTestId('perps-simple-close-order-1'));
  expect(mockChaseOrder).not.toHaveBeenCalled();
  expect(mockCancelOrder).not.toHaveBeenCalled();

  mockChasingOrderIds = new Set();
  mockCanMutateOrders = false;
  rerender(<SimpleMarketPortfolio coin="BTC" />);
  fireEvent.click(getByTestId('perps-simple-chase-order-1'));
  fireEvent.click(getByTestId('perps-simple-close-order-1'));
  expect(mockChaseOrder).not.toHaveBeenCalled();
  expect(mockCancelOrder).not.toHaveBeenCalled();
  mockCanMutateOrders = true;

  mockOrders = [];
  rerender(<SimpleMarketPortfolio coin="BTC" />);
  expect(getByTestId('perps-simple-market-orders-tab').textContent).toContain(
    '1',
  );
  expect(getByTestId('perps-simple-twap-entry')).toBeTruthy();

  mockTwapState = { ...mockTwapState, accountAddress: 'account-b' };
  rerender(<SimpleMarketPortfolio coin="BTC" />);
  expect(queryByTestId('perps-simple-twap-entry')).toBeNull();
  mockTwapState = { accountAddress: 'account-a', twapOrders: [] };
});

it.each([undefined, 'orders'] as const)(
  'shows the market orders panel with initial tab %s and allows switching',
  (initialTab) => {
    mockOrders = [];
    mockTwapState = {
      accountAddress: 'account-a',
      twapOrders: [{ twapId: 1, state: { coin: 'BTC' } }],
    };
    const position = {
      position: {
        coin: 'BTC',
        szi: '1',
        unrealizedPnl: '0',
        returnOnEquity: '0',
        positionValue: '100',
        entryPx: '100',
        liquidationPx: '50',
        leverage: { type: 'cross', value: 2 },
      },
    } as IPerpsAssetPosition;
    const { getByTestId, rerender } = render(
      <SimpleMarketPortfolio
        coin="BTC"
        position={position}
        initialTab={initialTab}
      />,
    );
    const entry = getByTestId('perps-simple-twap-entry');
    const ordersPanel = entry.parentElement?.parentElement;
    expect(ordersPanel?.style.display).toBe(
      initialTab === 'orders' ? 'flex' : 'none',
    );
    fireEvent.click(getByTestId('perps-simple-market-orders-tab'));
    expect(ordersPanel?.style.display).toBe('flex');
    fireEvent.click(getByTestId('perps-simple-market-positions-tab'));
    expect(ordersPanel?.style.display).toBe('none');
    fireEvent.click(getByTestId('perps-simple-market-orders-tab'));
    mockTwapState = { accountAddress: 'account-a', twapOrders: [] };
    rerender(
      <SimpleMarketPortfolio
        coin="BTC"
        position={position}
        initialTab={initialTab}
      />,
    );
    expect(
      getByTestId('perps-simple-market-positions-tab').getAttribute(
        'data-selected',
      ),
    ).toBe('true');
  },
);

it('masks home summaries while keeping market details visible', () => {
  mockHideValue = false;
  const item = {
    position: {
      coin: 'BTC',
      szi: '12',
      unrealizedPnl: '123.45',
      returnOnEquity: '0.2345',
      positionValue: '987.65',
      entryPx: '54.32',
      liquidationPx: '43.21',
      leverage: { type: 'cross', value: 5 },
    },
  } as IPerpsAssetPosition;
  const content = () => (
    <>
      <div data-testid="home">
        <SimplePositionSummary item={item} onPress={jest.fn()} />
        <SimpleOrderSummary
          coin="ETH"
          side="B"
          orderType="Limit"
          size="789"
          price="456.78"
          hideValue={mockHideValue}
        />
      </div>
      <div data-testid="details">
        <SimplePositionCard item={item} />
        <SimpleOrderSummary
          coin="ETH"
          side="B"
          orderType="Limit"
          size="789"
          price="456.78"
          details={[{ label: 'Original size', value: '789 ETH' }]}
        />
      </div>
    </>
  );
  const { container, getByTestId, rerender } = render(content());
  const visibleText = container.textContent;
  const sensitiveValues = [
    '123.45',
    '23.45%',
    '987.65',
    '54.32',
    '43.21',
    '789',
    '456.78',
  ];
  for (const value of sensitiveValues) expect(visibleText).toContain(value);

  mockHideValue = true;
  rerender(content());
  for (const value of sensitiveValues) {
    expect(getByTestId('home').textContent).not.toContain(value);
    expect(getByTestId('details').textContent).toContain(value);
  }
  expect(getByTestId('home').textContent).toContain('****');
  expect(getByTestId('details').textContent).not.toContain('****');
  expect(container.textContent).toContain('BTC');
  expect(container.textContent).toContain('ETH');

  mockHideValue = false;
  rerender(content());
  expect(container.textContent).toBe(visibleText);
});

it('shows isolated margin, unavailable liquidation price and the existing TP/SL editor', () => {
  mockHideValue = false;
  mockOrders = [
    {
      oid: 1,
      coin: 'UNI',
      side: 'B',
      orderType: 'Stop Market',
      sz: '0',
      origSz: '0',
      isPositionTpsl: true,
      isTrigger: true,
      triggerCondition: 'Price below 6.5',
      limitPx: '6',
      triggerPx: '6.5',
      timestamp: 1_700_000_000_000,
    },
  ];
  const item = {
    position: {
      coin: 'UNI',
      szi: '8.8',
      unrealizedPnl: '1.34',
      returnOnEquity: '0.21',
      positionValue: '65.31',
      entryPx: '7.26945',
      liquidationPx: null,
      marginUsed: '12.34',
      leverage: { type: 'isolated', value: 10 },
    },
  } as IPerpsAssetPosition;
  const { container, getByTestId, queryByTestId, rerender } = render(
    <SimplePositionCard item={item} />,
  );
  expect(container.textContent).toContain('N/A');
  expect(getByTestId('perps-simple-position-margin').textContent).toContain(
    '$12.34',
  );
  expect(
    getByTestId('perps-simple-position-margin').querySelector(
      '[data-testid="icon-PencilOutline"]',
    ),
  ).toBeTruthy();
  fireEvent.click(getByTestId('perps-simple-position-margin'));
  expect(mockAdjustMargin).toHaveBeenCalledWith(
    expect.objectContaining({ coin: item.position.coin }),
  );
  fireEvent.click(getByTestId('perps-simple-position-tpsl'));
  expect(mockEditTpsl).toHaveBeenCalledWith(
    expect.objectContaining({ position: item.position, isMobile: true }),
  );
  mockHideValue = true;
  rerender(<SimplePositionCard item={item} />);
  expect(getByTestId('perps-simple-position-margin').textContent).toContain(
    '12.34',
  );
  expect(container.textContent).toContain('6.5');
  mockHideValue = false;
  rerender(
    <SimplePositionCard
      item={{
        ...item,
        position: {
          ...item.position,
          liquidationPx: '5',
          leverage: { type: 'cross', value: 10 },
        },
      }}
    />,
  );
  expect(queryByTestId('perps-simple-position-margin')).toBeNull();
  expect(container.textContent).not.toContain('N/A');
  expect(container.textContent).toContain('$5');
  mockOrders = [];
});

it('shows position-sized triggers with unspecified quantities, market price and full condition', () => {
  mockOrders = [
    {
      oid: 1,
      coin: 'UNI',
      side: 'B',
      orderType: 'Trigger',
      sz: '0',
      origSz: '0',
      isPositionTpsl: true,
      isTrigger: true,
      triggerCondition: 'Price above 7.5',
      limitPx: '8',
      triggerPx: '7.5',
      timestamp: 1_700_000_000_000,
    },
  ];
  const { getByTestId } = render(<SimpleMarketPortfolio coin="UNI" />);
  const card = getByTestId('perps-simple-order-UNI');
  expect(card.textContent).toContain('perp.order_stop_market');
  expect(card.textContent).toContain('perp.position_market');
  expect(card.textContent).toContain('Price above 7.5');
  expect(card.textContent).not.toContain('$8');
  expect(card.textContent).not.toContain('0 UNI');
  expect(card.textContent?.match(/--/g)).toHaveLength(4);
  expect(card.textContent).toContain('perp.open_orders_trigger_condition');
  expect(card.textContent).toContain('perp.open_orders_cancel');
  mockOrders = [];
});
