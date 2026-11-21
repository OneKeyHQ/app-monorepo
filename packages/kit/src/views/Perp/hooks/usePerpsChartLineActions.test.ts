/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import type { ITVLine } from '@onekeyhq/kit/src/components/TradingView/TradingViewPerpsV2/types';

import { usePerpsChartLineActions } from './usePerpsChartLineActions';

const mockAmendChartOrder = jest.fn<Promise<void>, [{ oid: number }]>();
const mockCancelChartOrder = jest.fn<Promise<void>, [{ oid: number }]>();

jest.mock('@onekeyhq/components', () => ({
  Toast: { error: jest.fn() },
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({
    activeAccount: { ready: true, account: { id: 'account-1' } },
  }),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid', () => ({
  useHyperliquidActions: () => ({
    current: {
      amendChartOrder: mockAmendChartOrder,
      cancelChartOrder: mockCancelChartOrder,
    },
  }),
}));
jest.mock(
  '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/utils/config',
  () => ({ getPerpsOrderChangedMessage: () => 'order changed' }),
);
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpsActiveAccountAtom: () => [
    { accountId: 'account-1', accountAddress: '0xabc' },
  ],
  usePerpsAccountLoadingInfoAtom: () => [{ selectAccountLoading: false }],
}));
jest.mock('./useEnableTradingWithDepositFallback', () => ({
  useEnsureTradingEnabled: () => async () => {},
}));

let orderId = 0;

function createOrderLine(price: string): ITVLine {
  orderId += 1;
  return {
    id: `order:${orderId}`,
    price,
    editable: true,
    meta: { orderId: String(orderId), coin: 'BTC' },
  } as ITVLine;
}

// One chart of a split view; `enabled` is on for the selected panel only.
function renderChart(lines: ITVLine[], enabled: boolean, symbol = 'BTC') {
  return renderHook(
    (props: { lines: ITVLine[]; enabled: boolean }) =>
      usePerpsChartLineActions({
        ...props,
        symbol,
        szDecimals: 5,
        isSpot: false,
      }),
    { initialProps: { lines, enabled } },
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
});

it('keeps an order locked in a second chart of the same token', async () => {
  const line = createOrderLine('100');
  let finishAmend: () => void = () => {};
  mockAmendChartOrder.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishAmend = resolve;
      }),
  );
  const first = renderChart([line], true);
  const second = renderChart([line], false);
  const id = first.result.current.getLineId(line);
  const amend = (chart: typeof first, price: number) =>
    chart.result.current.onReferenceLineAction({
      id,
      type: 'priceChange',
      originalPrice: 100,
      price,
    });

  let request: Promise<void> = Promise.resolve();
  await act(async () => {
    request = amend(first, 110);
  });
  // The other chart shows the change while it is on its way.
  expect(second.result.current.pending[id]).toMatchObject({ price: 110 });

  // Trading moves to the second chart with the selection.
  first.rerender({ lines: [line], enabled: false });
  second.rerender({ lines: [line], enabled: true });
  await act(async () => {
    await amend(second, 120);
  });
  expect(mockAmendChartOrder).toHaveBeenCalledTimes(1);

  // Still locked after the request, until the order stream shows the price.
  await act(async () => {
    finishAmend();
    await request;
  });
  await act(async () => {
    await amend(second, 120);
  });
  expect(mockAmendChartOrder).toHaveBeenCalledTimes(1);
  expect(second.result.current.pending[id]).toMatchObject({ price: 110 });

  const amended = { ...line, price: '110' };
  first.rerender({ lines: [amended], enabled: false });
  second.rerender({ lines: [amended], enabled: true });
  expect(second.result.current.pending[id]).toBeUndefined();
  mockAmendChartOrder.mockResolvedValueOnce();
  await act(async () => {
    await second.result.current.onReferenceLineAction({
      id,
      type: 'priceChange',
      originalPrice: 110,
      price: 120,
    });
  });
  expect(mockAmendChartOrder).toHaveBeenCalledTimes(2);
});

it('lets go of a change the order stream never confirms', async () => {
  jest.useFakeTimers();
  const line = createOrderLine('100');
  mockAmendChartOrder.mockResolvedValue();
  const chart = renderChart([line], true);
  const id = chart.result.current.getLineId(line);
  const amend = () =>
    chart.result.current.onReferenceLineAction({
      id,
      type: 'priceChange',
      originalPrice: 100,
      price: 110,
    });

  await act(async () => {
    await amend();
  });
  expect(chart.result.current.pending[id]).toMatchObject({ price: 110 });

  act(() => {
    jest.advanceTimersByTime(10_000);
  });
  expect(chart.result.current.pending[id]).toBeUndefined();
  await act(async () => {
    await amend();
  });
  expect(mockAmendChartOrder).toHaveBeenCalledTimes(2);
});

it('leaves a chart of another token out of it', async () => {
  const line = createOrderLine('100');
  let finishCancel: () => void = () => {};
  mockCancelChartOrder.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finishCancel = resolve;
      }),
  );
  const trading = renderChart([line], true);
  // Shows other lines, and never clears what it does not own.
  const other = renderChart([], true, 'ETH');
  const id = trading.result.current.getLineId(line);

  let request: Promise<void> = Promise.resolve();
  await act(async () => {
    request = trading.result.current.onReferenceLineAction({
      id,
      type: 'cancel',
      originalPrice: 100,
    });
  });
  expect(trading.result.current.pending[id]).toMatchObject({ type: 'cancel' });
  expect(other.result.current.pending).toEqual({});

  await act(async () => {
    finishCancel();
    await request;
  });
  expect(trading.result.current.pending[id]).toBeUndefined();
});
