/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import { fireEvent, render } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import { PositionRow } from './PositionsRow';

import type { IPositionRowItem } from './PositionsRow';

let mockVisibility: Partial<
  Record<'add' | 'reverse' | 'tpsl' | 'close', boolean>
> = {};
let mockHasOtherOrders = false;
const mockShowTpsl = jest.fn();
const mockViewOrders = jest.fn();

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
    XStack: Stack,
    YStack: Stack,
    SizableText: Stack,
    DashText: Stack,
    DebugRenderTracker: Stack,
    Button: Stack,
    Icon: () => null,
    IconButton: ({ icon }: { icon: string }) => <span aria-label={icon} />,
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
    current: { showSetPositionTpslUI: mockShowTpsl },
  }),
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpsActiveAccountAtom: () => [{ accountAddress: '0x1111' }],
  usePerpsCustomSettingsAtom: () => [
    { positionActionVisibility: mockVisibility },
  ],
}));
jest.mock('../../../hooks/usePerpsAccountScopedOpenOrdersByCoin', () => ({
  usePerpsAccountScopedOpenOrdersByCoin: () =>
    mockHasOtherOrders ? [{ isPositionTpsl: false }] : [],
}));
jest.mock('../../../hooks/usePerpsMidPrice', () => ({
  usePerpsMidPrice: () => ({ midFormattedByDecimals: '2000' }),
}));
jest.mock('../../../hooks/useShowPositionShare', () => ({
  useShowPositionShare: () => ({ showPositionShare: jest.fn() }),
}));
jest.mock('../AddPositionModal', () => ({ showAddPositionDialog: jest.fn() }));
jest.mock('../AdjustPositionMarginModal', () => ({
  showAdjustPositionMarginDialog: jest.fn(),
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
const columns = Array.from({ length: 10 }, (_, index) => ({
  key: String(index),
  title: String(index),
}));

function renderPosition() {
  return render(
    <PositionRow
      mockedPosition={row}
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
    mockHasOtherOrders = false;
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

  it('keeps viewing existing orders available when TP/SL editing is hidden', () => {
    mockVisibility = { tpsl: false };
    mockHasOtherOrders = true;
    const view = renderPosition();
    expect(view.queryByLabelText('HighlightOutline')).toBeNull();
    fireEvent.click(view.getByText(ETranslations.perp_position_view_orders));
    expect(mockViewOrders).toHaveBeenCalledTimes(1);
    expect(mockShowTpsl).not.toHaveBeenCalled();
  });
});
