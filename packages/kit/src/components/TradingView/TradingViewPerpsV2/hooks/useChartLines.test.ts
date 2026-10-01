import { act, renderHook } from '@testing-library/react-native';

import { useChartLines } from './useChartLines';

import type { IWebViewRef } from '../../../WebView/types';
import type { ITVLine } from '../types';

let mockOrders: { oid: number }[] = [];

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid', () => ({
  useActiveTradeInstrumentAtom: () => [{ mode: 'perp' }],
}));

jest.mock(
  '@onekeyhq/kit/src/views/Perp/hooks/usePerpsAccountScopedActivePositions',
  () => ({ usePerpsAccountScopedActivePositions: () => [] }),
);

jest.mock(
  '@onekeyhq/kit/src/views/Perp/hooks/usePerpsAccountScopedOpenOrdersByCoin',
  () => ({ usePerpsAccountScopedOpenOrdersByCoin: () => mockOrders }),
);

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpsCustomSettingsAtom: () => [{ showChartLines: true }],
  useSpotActiveOpenOrdersAtom: () => [{ openOrders: [] }],
}));

jest.mock('../utils/lineBuilder', () => ({
  buildAllLinesForSymbol: (
    _positions: unknown[],
    orders: { oid: number }[],
    symbol: string,
  ) =>
    orders.map((order) => ({
      id: `order:${order.oid}`,
      symbol,
      kind: 'order',
      price: '1',
      version: 1,
    })),
}));

const mockSend = jest.fn();
const webRef = {
  current: {
    reload: () => {},
    loadURL: () => {},
    sendMessageViaInjectedScript: mockSend,
  } as IWebViewRef,
};

describe('useChartLines account switch', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('drops a pending symbol-switch sync that still holds the previous account lines', () => {
    mockOrders = [{ oid: 1 }];
    const { rerender } = renderHook(
      ({ symbol, userAddress }: { symbol: string; userAddress: string }) =>
        useChartLines({
          symbol,
          szDecimals: 2,
          userAddress,
          webRef,
          isReady: true,
        }),
      { initialProps: { symbol: 'BTC', userAddress: '0xaaa' } },
    );
    rerender({ symbol: 'ETH', userAddress: '0xaaa' });
    mockOrders = [];
    rerender({ symbol: 'ETH', userAddress: '0xbbb' });
    mockSend.mockClear();

    act(() => {
      jest.advanceTimersByTime(200);
    });

    const syncedLineIds = mockSend.mock.calls
      .map(
        ([message]) =>
          message as { type: string; payload: { lines?: ITVLine[] } },
      )
      .filter((message) => message.type === 'PERPS_TV_LINES_SYNC')
      .flatMap((message) => message.payload.lines ?? [])
      .map((line) => line.id);
    expect(syncedLineIds).not.toContain('order:1');
  });
});
