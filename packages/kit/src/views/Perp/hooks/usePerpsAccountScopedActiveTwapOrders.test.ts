/* eslint-disable import/first */

import { renderHook } from '@testing-library/react-native';

import type {
  IPerpsActiveTwapOrder,
  IPerpsActiveTwapOrdersAtom,
  IPerpsTwapHistoryAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import type { ITwapHistoryRecord } from '@onekeyhq/shared/types/hyperliquid/sdk';

let mockOrders: IPerpsActiveTwapOrdersAtom;
let mockHistory: IPerpsTwapHistoryAtom;

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms', () => ({
  usePerpsActiveTwapOrdersAtom: () => [mockOrders],
  usePerpsTwapHistoryAtom: () => [mockHistory],
}));

import { usePerpsAccountScopedActiveTwapOrders } from './usePerpsAccountScopedActiveTwapOrders';

const accountAddress = '0xabc';
const state: IPerpsActiveTwapOrder['state'] = {
  user: '0xabc',
  coin: 'ETH',
  side: 'B',
  sz: '1',
  executedSz: '0',
  executedNtl: '0',
  minutes: 5,
  randomize: false,
  reduceOnly: false,
  timestamp: 1_718_000_000_000,
  trigger: null,
  stopPx: null,
};
const orders: IPerpsActiveTwapOrder[] = [
  { twapId: 1, state },
  { twapId: 2, state: { ...state, coin: 'BTC' } },
  { twapId: 3, state: { ...state, timestamp: state.timestamp + 1 } },
  { twapId: 4, state },
];

function historyRecord(
  order: IPerpsActiveTwapOrder,
  status: ITwapHistoryRecord['status'],
  time = 1_718_000_180,
): ITwapHistoryRecord {
  return { state: order.state, status, time, twapId: order.twapId };
}

function setHistory(history: ITwapHistoryRecord[]) {
  mockHistory = { accountAddress, isLoaded: true, history };
}

describe('usePerpsAccountScopedActiveTwapOrders', () => {
  beforeEach(() => {
    mockOrders = {
      accountAddress,
      twapOrders: orders,
      twapOrdersByCoin: {
        ETH: [orders[0], orders[2], orders[3]],
        BTC: [orders[1]],
      },
    };
    mockHistory = { accountAddress, history: [], isLoaded: false };
  });

  it.each(['finished', 'stopped', 'terminated', 'error'] as const)(
    'excludes a stale %s order by ID, preserving even an identical same-timestamp order',
    (status) => {
      setHistory([
        historyRecord(
          orders[0],
          status === 'error' ? { status, description: 'Stopped' } : { status },
        ),
        historyRecord(orders[0], { status: 'activated' }, 1_718_000_120),
        historyRecord(orders[1], { status: 'activated' }, 1_718_000_200_000),
      ]);
      const { result } = renderHook(() =>
        usePerpsAccountScopedActiveTwapOrders('0xAbC'),
      );

      expect(result.current.twapOrders.map((order) => order.twapId)).toEqual([
        2, 3, 4,
      ]);
      expect(result.current.activeRuntimeInfoById.get(1)).toEqual({
        reportedStatus: status,
        activatedAt: 1_718_000_120_000,
      });
      expect(result.current.activeRuntimeInfoById.get(2)?.activatedAt).toBe(
        1_718_000_200_000,
      );
    },
  );

  it('updates the visible orders and count when terminal history arrives first', () => {
    const { result, rerender } = renderHook(() =>
      usePerpsAccountScopedActiveTwapOrders(accountAddress),
    );
    expect(result.current.twapOrders).toHaveLength(4);

    setHistory(
      orders.map((order) => historyRecord(order, { status: 'stopped' })),
    );
    rerender({});

    expect(result.current.twapOrders).toEqual([]);
    expect(result.current.historyRows).toHaveLength(4);
  });

  it('does not use an unidentified legacy event to hide an active TWAP', () => {
    setHistory([
      {
        ...historyRecord(orders[0], { status: 'finished' }),
        twapId: undefined,
      },
    ]);
    const { result } = renderHook(() =>
      usePerpsAccountScopedActiveTwapOrders(accountAddress),
    );
    expect(result.current.twapOrders).toEqual(orders);
  });

  it('ignores another account history during an account switch', () => {
    setHistory(
      orders.map((order) => historyRecord(order, { status: 'finished' })),
    );
    const { result, rerender } = renderHook(
      ({ address }: { address: string }) =>
        usePerpsAccountScopedActiveTwapOrders(address),
      { initialProps: { address: accountAddress } },
    );
    expect(result.current.twapOrders).toEqual([]);

    rerender({ address: '0xdef' });
    expect(result.current.twapOrders).toEqual([]);
    expect(result.current.historyRows).toEqual([]);

    const otherOrders = orders.map((order) => ({
      ...order,
      state: { ...order.state, user: '0xdef' as const },
    }));
    mockOrders = {
      accountAddress: '0xdef',
      twapOrders: otherOrders,
      twapOrdersByCoin: {
        ETH: [otherOrders[0], otherOrders[2], otherOrders[3]],
        BTC: [otherOrders[1]],
      },
    };
    rerender({ address: '0xdef' });
    expect(result.current.twapOrders.map((order) => order.twapId)).toEqual([
      1, 2, 3, 4,
    ]);
    expect(result.current.activeRuntimeInfoById.size).toBe(0);
  });

  it('hides orders and history while the active account is unresolved', () => {
    const { result } = renderHook(() =>
      usePerpsAccountScopedActiveTwapOrders(undefined),
    );
    expect(result.current.twapOrders).toEqual([]);
    expect(result.current.historyRows).toEqual([]);
  });
});
