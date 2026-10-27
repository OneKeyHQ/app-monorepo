/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import { act, fireEvent, render } from '@testing-library/react';

import type {
  ITwapHistoryRecord,
  ITwapSliceFill,
} from '@onekeyhq/shared/types/hyperliquid/sdk';

import { PerpTwapList } from './PerpTwapList';

const mockSwitchInstrument = jest.fn();
const mockActions = {
  current: {
    loadTwapData: jest.fn(),
    switchTradeInstrument: mockSwitchInstrument,
  },
};
const mockHistory: ITwapHistoryRecord = {
  twapId: 1,
  time: 1_718_000_180_000,
  status: { status: 'finished' },
  state: {
    user: '0xabc',
    coin: 'ETH',
    side: 'B',
    sz: '1',
    executedSz: '1',
    executedNtl: '2000',
    minutes: 5,
    randomize: false,
    reduceOnly: false,
    timestamp: 1_718_000_000_000,
    trigger: null,
    stopPx: null,
  },
};
const mockFill: ITwapSliceFill = {
  twapId: 1,
  fill: {
    coin: 'ETH',
    px: '2000',
    sz: '1',
    side: 'B',
    time: 1_718_000_180_000,
    startPosition: '0',
    dir: 'Open Long',
    closedPnl: '0',
    hash: '0x1234',
    oid: 1,
    tid: 1,
    crossed: false,
    fee: '0.01',
    feeToken: 'USDC',
    twapId: 1,
  },
};
const mockFills = { accountAddress: '0xabc', fills: [mockFill] };

jest.mock('@onekeyhq/components', () => {
  const Stack = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    XStack: Stack,
    YStack: Stack,
    SizableText: ({
      children,
      onPress,
    }: {
      children?: ReactNode;
      onPress?: () => void;
    }) =>
      onPress ? (
        <button type="button" onClick={onPress}>
          {children}
        </button>
      ) : (
        <span>{children}</span>
      ),
    DashText: Stack,
    Divider: () => null,
    Tooltip: Stack,
    Popover: Stack,
    useMedia: () => ({ gtMd: false }),
  };
});
jest.mock('@onekeyhq/kit/src/components/ListItem', () => ({
  ListItem: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));
jest.mock('react-intl', () => ({
  ...jest.requireActual<typeof import('react-intl')>('react-intl'),
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    simpleDb: {
      perp: { getExpectMaxBuilderFee: () => Promise.resolve(undefined) },
    },
  },
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid', () => ({
  useHyperliquidActions: () => mockActions,
  usePerpsTwapSliceFillsAtom: () => [mockFills],
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpsActiveAccountAtom: () => [{ accountAddress: '0xabc' }],
  useSpotPairDisplayMapAtom: () => [{}],
  useSpotPairDisplayNameMapAtom: () => [{}],
}));
jest.mock('../../../hooks/useEnableTradingWithDepositFallback', () => ({
  useEnsureTradingEnabled: () => jest.fn(),
}));
jest.mock('../../../hooks/usePerpOrderInfoPanel', () => ({
  usePerpTwapHistoryViewAllUrl: () => ({ onViewAllUrl: jest.fn() }),
}));
jest.mock('../../../hooks/usePerpsAccountScopedActiveTwapOrders', () => ({
  usePerpsAccountScopedActiveTwapOrders: () => ({
    twapOrders: [],
    historyRows: [mockHistory],
    activeRuntimeInfoById: new Map(),
  }),
}));
jest.mock('../Components/PerpDesktopEmptyState', () => ({
  PerpDesktopEmptyState: () => null,
}));
jest.mock('../Components/PerpMobileEmptyState', () => ({
  PerpMobileEmptyState: () => null,
}));
jest.mock('../Components/OrderInfoSubTabs', () => ({
  OrderInfoSubTabs: () => null,
}));
jest.mock('./CommonTableListView', () => ({
  CommonTableListView: <T,>({
    data,
    renderRow,
  }: {
    data: T[];
    renderRow: (item: T, index: number) => ReactNode;
  }) => (
    <>
      {data.map((item, index) => (
        <div key={index}>{renderRow(item, index)}</div>
      ))}
    </>
  ),
}));

beforeEach(() => mockSwitchInstrument.mockClear());

it.each(['history', 'fills'] as const)(
  'delegates a %s symbol to the configured trading destination',
  async (tab) => {
    const switchDestination = jest.fn();
    const screen = render(
      <PerpTwapList
        isMobile
        initialTab={tab}
        enabledTabs={[tab]}
        onSwitchInstrument={switchDestination}
      />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.click(screen.getByText('ETH'));
    expect(switchDestination).toHaveBeenCalledWith('ETH');
    expect(mockSwitchInstrument).not.toHaveBeenCalled();
  },
);

it.each(['history', 'fills'] as const)(
  'switches from an embedded %s list without a modal callback',
  async (tab) => {
    const screen = render(
      <PerpTwapList isMobile initialTab={tab} enabledTabs={[tab]} />,
    );
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.click(screen.getByText('ETH'));
    expect(mockSwitchInstrument).toHaveBeenCalledWith({
      mode: 'perp',
      coin: 'ETH',
    });
  },
);
