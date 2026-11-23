/** @jest-environment jsdom */
import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

import { act, fireEvent, render } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import { PositionRow } from './PositionsRow';

import type { IPositionRowItem } from './PositionsRow';

let mockVisibility: Partial<
  Record<'add' | 'reverse' | 'tpsl' | 'close', boolean>
> = {};
let mockOrder: { orderType: string; reduceOnly: boolean } | undefined;
const mockShowTpsl = jest.fn();
const mockViewOrders = jest.fn();
const mockUpdateMargin = jest.fn();
const mockCloseMargin = jest.fn();
const MockAccount = createContext('0x1111');
const MockScopedAccount = createContext('0x1111');

const mockShowMargin = jest.fn(
  ({ renderContent }: { renderContent: ReactNode }) => ({
    renderContent,
    close: mockCloseMargin,
  }),
);

jest.mock('@onekeyhq/components', () => {
  const Stack = ({
    children,
    onPress,
    testID,
  }: {
    children?: ReactNode;
    onPress?: () => void;
    testID?: string;
  }) => {
    const Element = onPress ? 'button' : 'div';
    return (
      <Element
        data-testid={testID}
        onClick={onPress}
        type={onPress ? 'button' : undefined}
      >
        {children}
      </Element>
    );
  };
  return {
    Dialog: {
      show: (params: { renderContent: ReactNode }) => mockShowMargin(params),
    },
    Select: ({
      items,
      value,
      onChange,
    }: {
      items: { value: string }[];
      value: string;
      onChange: (value: string) => void;
    }) => (
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {items.map((item) => (
          <option key={item.value} value={item.value}>
            {item.value}
          </option>
        ))}
      </select>
    ),
    XStack: Stack,
    YStack: Stack,
    SizableText: Stack,
    DashText: Stack,
    DebugRenderTracker: Stack,
    Button: Stack,
    Icon: () => null,
    IconButton: ({
      icon,
      testID,
      onPress,
    }: {
      icon: string;
      testID: string;
      onPress?: () => void;
    }) =>
      onPress ? (
        <button
          type="button"
          aria-label={icon}
          data-testid={testID}
          onClick={onPress}
        />
      ) : (
        <span aria-label={icon} />
      ),
    Divider: () => null,
    Tooltip: ({ renderTrigger }: { renderTrigger: ReactNode }) => renderTrigger,
  };
});
jest.mock('@onekeyhq/kit/src/components/ListItem', () => ({
  ListItem: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({}),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid', () => ({
  useHyperliquidActions: () => ({
    current: {
      showSetPositionTpslUI: mockShowTpsl,
      updateIsolatedMargin: mockUpdateMargin,
    },
  }),
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpsActiveAccountAtom: () => [
    { accountAddress: useContext(MockAccount) },
  ],
  usePerpsComputedAccountValueAtom: () => [{ withdrawable: '100' }],
  usePerpsCustomSettingsAtom: () => [
    { positionActionVisibility: mockVisibility },
  ],
}));
jest.mock('../../../hooks/usePerpsAccountScopedOpenOrdersByCoin', () => ({
  usePerpsAccountScopedOpenOrdersByCoin: () =>
    mockOrder ? [{ ...mockOrder, isPositionTpsl: false }] : [],
}));
jest.mock('../../../hooks/usePerpsMidPrice', () => ({
  usePerpsMidPrice: () => ({ midFormattedByDecimals: '2000' }),
}));
jest.mock('../../../hooks/useShowPositionShare', () => ({
  useShowPositionShare: () => ({ showPositionShare: jest.fn() }),
}));
jest.mock('../AddPositionModal', () => ({ showAddPositionDialog: jest.fn() }));
jest.mock('../../../PerpsAccountSelectorProviderMirror', () => ({
  PerpsAccountSelectorProviderMirror: ({ children }: { children: ReactNode }) =>
    children,
}));
jest.mock('../../../PerpsProviderMirror', () => ({
  PerpsProviderMirror: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('../../TradingGuardWrapper', () => ({
  TradingGuardWrapper: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('../../TradingPanel/inputs/TradingFormInput', () => ({
  TradingFormInput: ({
    value,
    onChange,
    customSuffix,
  }: {
    value: string;
    onChange: (value: string) => void;
    customSuffix: ReactNode;
  }) => (
    <>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
      {customSuffix}
    </>
  ),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHyperliquid: { getSymbolMeta: async () => ({ assetId: 1 }) },
  },
}));
jest.mock('../ClosePositionModal', () => ({
  showClosePositionDialog: jest.fn(),
}));
jest.mock('../ReversePositionModal', () => ({
  showReversePositionDialog: jest.fn(),
}));
jest.mock('../SetTpslModal', () => ({ showSetTpslDialog: jest.fn() }));
jest.mock('./PositionFundingDetails', () => ({
  PositionFundingDetails: () => null,
  showPositionFundingDetailsDialog: jest.fn(),
}));

const row: IPositionRowItem = {
  index: 0,
  accountAddress: '0x1111',
  activePosition: {
    type: 'oneWay',
    position: {
      coin: 'ETH',
      szi: '1',
      leverage: { type: 'cross', value: 10 },
      entryPx: '2000',
      positionValue: '2000',
      unrealizedPnl: '0',
      returnOnEquity: '0',
      marginUsed: '200',
      liquidationPx: '1000',
      maxLeverage: 20,
      cumFunding: { allTime: '0', sinceOpen: '0', sinceChange: '0' },
    },
  },
};
const mockIsolatedRow: IPositionRowItem = {
  ...row,
  activePosition: {
    ...row.activePosition,
    position: {
      ...row.activePosition.position,
      marginUsed: '210',
      leverage: { type: 'isolated', value: 10, rawUsd: '210' },
    },
  },
};
jest.mock('../../../hooks/usePerpsAccountScopedActivePositions', () => ({
  usePerpsAccountScopedPositionsState: () => ({
    activePositions: [mockIsolatedRow.activePosition],
    accountAddress: useContext(MockScopedAccount),
  }),
}));

const columns = Array.from({ length: 10 }, (_, index) => ({
  key: String(index),
  title: String(index),
}));

function renderPosition(position = row) {
  return render(
    <PositionRow
      mockedPosition={position}
      cellMinWidth={900}
      columnConfigs={columns}
      handleViewTpslOrders={mockViewOrders}
      fundingHistory={[]}
      isFundingHistoryLoading={false}
      isFundingHistoryError={false}
    />,
  );
}

describe('desktop position action visibility', () => {
  beforeEach(() => {
    mockVisibility = {};
    mockOrder = undefined;
    jest.clearAllMocks();
  });

  it('shows existing controls when no visibility preference is saved', () => {
    const view = renderPosition();
    expect(view.getByTestId('perp-position-add-button')).toBeTruthy();
    expect(view.getByTestId('perp-position-reverse-button')).toBeTruthy();
    expect(view.getByText(ETranslations.perp_position_market)).toBeTruthy();
    expect(view.getByText(ETranslations.perp_position_limit)).toBeTruthy();
    expect(view.getByLabelText('HighlightOutline')).toBeTruthy();
    fireEvent.click(view.getByText('--/--'));
    expect(mockShowTpsl).toHaveBeenCalledTimes(1);
  });

  it('does not open a cached row belonging to the incoming account', () => {
    const view = renderPosition({
      ...mockIsolatedRow,
      accountAddress: '0x2222',
    });
    fireEvent.click(
      view.getByTestId('perp-position-row-desktop-margin-icon-btn'),
    );
    expect(mockShowMargin).not.toHaveBeenCalled();
  });

  it.each(['add', 'remove', 'account switch', 'scope switch'] as const)(
    'binds the isolated margin dialog to the row owner on %s',
    async (scenario) => {
      const view = renderPosition(mockIsolatedRow);
      fireEvent.click(
        view.getByTestId('perp-position-row-desktop-margin-icon-btn'),
      );
      const { renderContent } = mockShowMargin.mock.calls[0][0];
      const dialog = render(
        <MockAccount.Provider value="0x1111">
          <MockScopedAccount.Provider value="0x1111">
            {renderContent}
          </MockScopedAccount.Provider>
        </MockAccount.Provider>,
      );
      await act(async () => {});
      const amount = dialog.getByRole('textbox');
      if (scenario === 'remove') {
        fireEvent.change(dialog.getByRole('combobox'), {
          target: { value: 'remove' },
        });
      }
      fireEvent.change(amount, { target: { value: '1.23' } });
      if (scenario === 'account switch' || scenario === 'scope switch') {
        // Both accounts have an isolated ETH position.
        dialog.rerender(
          <MockAccount.Provider
            value={scenario === 'account switch' ? '0x2222' : '0x1111'}
          >
            <MockScopedAccount.Provider
              value={scenario === 'scope switch' ? '0x2222' : '0x1111'}
            >
              {renderContent}
            </MockScopedAccount.Provider>
          </MockAccount.Provider>,
        );
        expect(dialog.queryByTestId('perp-btn')).toBeNull();
        expect(mockCloseMargin).toHaveBeenCalled();
        expect(mockUpdateMargin).not.toHaveBeenCalled();
      } else {
        await act(async () => {
          fireEvent.click(dialog.getByTestId('perp-btn'));
        });
        expect(mockUpdateMargin).toHaveBeenCalledWith(
          expect.objectContaining({
            asset: 1,
            isBuy: true,
            ntli: scenario === 'add' ? 1_230_000 : -1_230_000,
            expectedAccountAddress: '0x1111',
          }),
        );
      }
    },
  );

  it('hides disabled desktop actions and keeps the TP/SL value read-only', () => {
    mockVisibility = { add: false, reverse: false, close: false, tpsl: false };
    const view = renderPosition();
    expect(view.queryByTestId('perp-position-add-button')).toBeNull();
    expect(view.queryByTestId('perp-position-reverse-button')).toBeNull();
    expect(view.queryByText(ETranslations.perp_position_market)).toBeNull();
    expect(view.queryByText(ETranslations.perp_position_limit)).toBeNull();
    expect(view.queryByLabelText('HighlightOutline')).toBeNull();
    fireEvent.click(view.getByText('--/--'));
    expect(mockShowTpsl).not.toHaveBeenCalled();
  });

  it('hides only the disabled action', () => {
    mockVisibility = { reverse: false };
    const view = renderPosition();
    expect(view.queryByTestId('perp-position-reverse-button')).toBeNull();
    expect(view.getByTestId('perp-position-add-button')).toBeTruthy();
    expect(view.getByText(ETranslations.perp_position_market)).toBeTruthy();
    expect(view.getByText(ETranslations.perp_position_limit)).toBeTruthy();
    expect(view.getByLabelText('HighlightOutline')).toBeTruthy();
  });

  it.each([
    { orderType: 'Limit', reduceOnly: false },
    { orderType: 'Limit', reduceOnly: true },
    { orderType: 'Stop Market', reduceOnly: false },
  ])(
    'does not show TP/SL orders for $orderType reduceOnly=$reduceOnly',
    (order) => {
      mockOrder = order;
      const view = renderPosition();
      expect(
        view.queryByText(ETranslations.perp_position_view_orders),
      ).toBeNull();
      expect(view.getByText('--/--')).toBeTruthy();
    },
  );

  it.each(['Take Profit Market', 'Stop Market'])(
    'keeps viewing %s orders available when TP/SL editing is hidden',
    (orderType) => {
      mockVisibility = { tpsl: false };
      mockOrder = { orderType, reduceOnly: true };
      const view = renderPosition();
      expect(view.queryByLabelText('HighlightOutline')).toBeNull();
      fireEvent.click(view.getByText(ETranslations.perp_position_view_orders));
      expect(mockViewOrders).toHaveBeenCalledTimes(1);
      expect(mockShowTpsl).not.toHaveBeenCalled();
    },
  );
});
