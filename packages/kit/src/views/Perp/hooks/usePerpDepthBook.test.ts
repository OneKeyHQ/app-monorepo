/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import type { IActiveTradeInstrument } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS } from '@onekeyhq/shared/src/consts/perpCache';
import type {
  EAppEventBusNames,
  IAppEventBusPayload,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IBook, IWsBbo } from '@onekeyhq/shared/types/hyperliquid/sdk';

import {
  usePerpDepthBook,
  usePerpDepthSubscriptionActive,
} from './usePerpDepthBook';

let mockBook: IBook | null = null;
let mockBbo: IWsBbo | null = null;
let mockMid: string | undefined;
const mockSubscribe = jest
  .fn<Promise<undefined>, unknown[]>()
  .mockResolvedValue(undefined);
const mockUnsubscribe = jest
  .fn<Promise<undefined>, unknown[]>()
  .mockResolvedValue(undefined);
type IDepthBookEvent =
  IAppEventBusPayload[EAppEventBusNames.HyperliquidPublicDepthBook];
const mockDepthBookListen = jest.fn<
  void,
  [string, (event: IDepthBookEvent) => void]
>();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHyperliquidSubscription: {
      subscribePublicDepthBook: (...args: unknown[]) => mockSubscribe(...args),
      unsubscribePublicDepthBook: (...args: unknown[]) =>
        mockUnsubscribe(...args),
    },
  },
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid', () => ({
  useBboForOrderPrice: () => mockBbo,
  useL2BookAtom: () => [mockBook],
  usePerpsMidByCoin: () => mockMid,
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpsWebSocketConnectedAtom: () => [true],
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    HyperliquidPublicDepthBook: 'HyperliquidPublicDepthBook',
  },
  appEventBus: {
    on: (type: string, listener: (event: IDepthBookEvent) => void) =>
      mockDepthBookListen(type, listener),
    off: jest.fn(),
  },
}));

const instrument = {
  coin: 'BTC',
  mode: 'perp',
  assetId: 0,
  universe: {
    assetId: 0,
    name: 'BTC',
    szDecimals: 5,
    maxLeverage: 40,
    marginTableId: 0,
  },
} satisfies IActiveTradeInstrument;

beforeEach(() => {
  mockBook = null;
  mockBbo = null;
  mockMid = '60000';
  mockSubscribe.mockClear();
  mockUnsubscribe.mockClear();
  mockDepthBookListen.mockClear();
});

it('keeps the center on the displayed book when BBO moves independently', async () => {
  jest.useFakeTimers();
  mockBook = {
    coin: 'BTC',
    nSigFigs: null,
    mantissa: null,
    time: Date.now(),
    levels: [
      [{ px: '59999', sz: '4', n: 1 }],
      [{ px: '60001', sz: '1', n: 1 }],
    ],
  };
  mockBbo = {
    coin: 'BTC',
    time: Date.now(),
    bbo: [
      { px: '60009', sz: '1', n: 1 },
      { px: '60011', sz: '1', n: 1 },
    ],
  };
  const { result, rerender, unmount } = renderHook(() =>
    usePerpDepthBook(instrument, true),
  );
  try {
    expect(result.current.referenceMidPrice).toBe(60_000);
    mockBbo = {
      ...mockBbo,
      bbo: [
        { px: '60019', sz: '1', n: 1 },
        { px: '60021', sz: '1', n: 1 },
      ],
    };
    rerender();
    await act(async () => jest.advanceTimersByTimeAsync(200));
    expect(result.current.referenceMidPrice).toBe(60_000);

    mockBook = { ...mockBook, levels: [mockBook.levels[0], []] };
    rerender();
    expect(result.current.referenceMidPrice).toBeUndefined();
  } finally {
    unmount();
    jest.useRealTimers();
  }
});

it('switches to its own stream when a matching shared book expires and does not switch back mid-session', async () => {
  jest.useFakeTimers();
  const createBook = (): IBook => ({
    coin: 'BTC',
    nSigFigs: null,
    mantissa: null,
    time: Date.now(),
    levels: [
      [{ px: '59840', sz: '1', n: 1 }],
      [{ px: '60160', sz: '1', n: 1 }],
    ],
  });
  mockBook = createBook();
  const { result, rerender, unmount } = renderHook(() =>
    usePerpDepthBook(instrument, true),
  );
  try {
    expect(result.current.status).toBe('ready');
    expect(mockSubscribe).not.toHaveBeenCalled();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(
        PERPS_L2_BOOK_INTERACTIVE_MAX_AGE_MS + 1,
      );
    });
    expect(result.current.status).toBe('stale');
    expect(mockSubscribe).toHaveBeenCalledTimes(1);

    mockBook = createBook();
    rerender();
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
    expect(mockUnsubscribe).not.toHaveBeenCalled();
  } finally {
    unmount();
    jest.useRealTimers();
  }
  expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
});

it('does not change the active target when a later snapshot falls short', () => {
  const levels = (first: number, step: number) =>
    Array.from({ length: 20 }, (_, index) => ({
      px: String(first + index * step),
      sz: '1',
      n: 1,
    }));
  mockBbo = {
    coin: 'BTC',
    time: Date.now(),
    bbo: [
      { px: '59999', sz: '1', n: 1 },
      { px: '60001', sz: '1', n: 1 },
    ],
  };
  mockBook = {
    coin: 'BTC',
    time: Date.now(),
    nSigFigs: null,
    mantissa: null,
    levels: [levels(59_990, -10), levels(60_010, 10)],
  };
  const { result, rerender } = renderHook(() =>
    usePerpDepthBook(instrument, true),
  );
  const { targetKey } = result.current;
  expect(result.current.priceStep).toBe(1);

  mockBook = {
    ...mockBook,
    levels: [levels(59_999, -1), levels(60_001, 1)],
  };
  rerender();

  expect(result.current.targetKey).toBe(targetKey);
  expect(result.current.priceStep).toBe(1);
  expect(mockSubscribe).not.toHaveBeenCalled();
});

it('requests full precision separately from the ladder and rejects coarser updates', async () => {
  mockBbo = {
    coin: 'BTC',
    time: Date.now(),
    bbo: [
      { px: '60019', sz: '1', n: 1 },
      { px: '60021', sz: '1', n: 1 },
    ],
  };
  mockBook = {
    coin: 'BTC',
    time: Date.now(),
    nSigFigs: 4,
    mantissa: null,
    levels: [
      [{ px: '59990', sz: '1', n: 1 }],
      [{ px: '60010', sz: '1', n: 1 }],
    ],
  };
  const { result, unmount } = renderHook(() =>
    usePerpDepthBook(instrument, true),
  );
  expect(mockSubscribe).toHaveBeenCalledWith({
    coin: 'BTC',
    nSigFigs: null,
    mantissa: null,
  });
  expect(result.current.book).toBeUndefined();
  const onDepthBook = mockDepthBookListen.mock.lastCall?.[1];
  const coarseBook = mockBook;
  await act(async () =>
    onDepthBook?.({
      coin: 'BTC',
      options: { nSigFigs: 4, mantissa: null },
      book: coarseBook,
      status: 'ready',
      receivedAt: Date.now(),
    }),
  );
  expect(result.current.book).toBeUndefined();
  await act(async () =>
    onDepthBook?.({
      coin: 'BTC',
      options: { nSigFigs: null, mantissa: null },
      book: { ...coarseBook, nSigFigs: null },
      status: 'ready',
      receivedAt: Date.now(),
    }),
  );
  expect(result.current.book?.nSigFigs).toBeNull();
  expect(result.current.status).toBe('ready');
  expect(result.current.referenceMidPrice).toBe(60_000);
  unmount();
});

it('starts the raw feed before pricing inputs and recovers from disconnect without resubscribing', async () => {
  mockMid = undefined;
  const { result, rerender, unmount } = renderHook(
    ({ coin, hasMetadata }) =>
      usePerpDepthBook(
        {
          ...instrument,
          coin,
          universe: hasMetadata ? instrument.universe : undefined,
        },
        true,
      ),
    { initialProps: { coin: 'BTC', hasMetadata: false } },
  );
  try {
    const options: IDepthBookEvent['options'] = {
      nSigFigs: null,
      mantissa: null,
    };
    expect(mockSubscribe).toHaveBeenCalledWith({ coin: 'BTC', ...options });
    expect(result.current.status).toBe('loading');
    const receive = mockDepthBookListen.mock.lastCall?.[1];
    const ready = {
      coin: 'BTC',
      options,
      status: 'ready',
      receivedAt: Date.now(),
      book: {
        coin: 'BTC',
        ...options,
        time: Date.now(),
        levels: [
          [{ px: '59999', sz: '5', n: 1 }],
          [{ px: '60001', sz: '2', n: 1 }],
        ],
      },
    } satisfies IDepthBookEvent;
    await act(async () => receive?.(ready));
    expect(result.current.status).toBe('ready');
    expect(result.current.referenceMidPrice).toBe(60_000);
    expect(result.current.priceStep).toBeUndefined();
    rerender({ coin: 'BTC', hasMetadata: true });
    expect(result.current.priceStep).toBe(1);
    expect(mockSubscribe).toHaveBeenCalledTimes(1);

    await act(async () =>
      receive?.({ coin: 'BTC', options, status: 'disconnected' }),
    );
    expect(result.current.status).toBe('stale');
    expect(result.current.book?.levels[0][0]?.px).toBe('59999');
    await act(async () => receive?.(ready));
    expect(result.current.status).toBe('ready');
    expect(mockSubscribe).toHaveBeenCalledTimes(1);

    rerender({ coin: 'ETH', hasMetadata: false });
    expect(mockUnsubscribe).toHaveBeenCalledWith({ coin: 'BTC', ...options });
    expect(mockSubscribe).toHaveBeenLastCalledWith({ coin: 'ETH', ...options });
    await act(async () => receive?.(ready));
    expect(result.current.book).toBeUndefined();
    expect(result.current.status).toBe('loading');
  } finally {
    unmount();
  }
});

it('uses a fresh matching raw book before exchange precision is known', () => {
  mockMid = undefined;
  mockBook = {
    coin: 'BTC',
    nSigFigs: null,
    mantissa: null,
    time: Date.now(),
    levels: [[{ px: '59999', sz: '5', n: 1 }], []],
  };
  const { result } = renderHook(() =>
    usePerpDepthBook({ ...instrument, universe: undefined }, true),
  );
  expect(result.current.status).toBe('ready');
  expect(result.current.book).toBe(mockBook);
  expect(mockSubscribe).not.toHaveBeenCalled();
});

it('keeps receiving depth updates for 60 seconds after tab close, then reacquires on reopen', async () => {
  jest.useFakeTimers();
  const show = { visible: true, foreground: true };
  const hide = { ...show, visible: false };
  const { result, rerender, unmount } = renderHook(
    ({ visible, foreground }) => {
      const active = usePerpDepthSubscriptionActive(
        'perp:BTC',
        visible,
        foreground,
      );
      return usePerpDepthBook(instrument, active);
    },
    { initialProps: hide },
  );
  try {
    expect(mockSubscribe).not.toHaveBeenCalled();
    rerender(show);
    const options: IDepthBookEvent['options'] = {
      nSigFigs: null,
      mantissa: null,
    };
    expect(mockSubscribe).toHaveBeenCalledWith({ coin: 'BTC', ...options });
    const onDepthBook = mockDepthBookListen.mock.lastCall?.[1];
    const receive = (size: string) => {
      onDepthBook?.({
        coin: 'BTC',
        options,
        status: 'ready',
        receivedAt: Date.now(),
        book: {
          coin: 'BTC',
          ...options,
          time: Date.now(),
          levels: [[{ px: '59990', sz: size, n: 1 }], []],
        },
      });
    };
    await act(async () => receive('2'));
    expect(result.current.status).toBe('ready');

    rerender(hide);
    await act(async () => jest.advanceTimersByTimeAsync(59_999));
    await act(async () => receive('3'));
    rerender(show);
    expect(result.current.status).toBe('ready');
    expect(result.current.book?.levels[0][0]?.sz).toBe('3');
    expect(mockSubscribe).toHaveBeenCalledTimes(1);
    expect(mockUnsubscribe).not.toHaveBeenCalled();

    rerender(hide);
    await act(async () => jest.advanceTimersByTimeAsync(60_000));
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    rerender(show);
    expect(mockSubscribe).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe('loading');
  } finally {
    unmount();
    jest.useRealTimers();
  }
});

it.each(['blur', 'market change'] as const)(
  'discards hidden depth warmth immediately on %s',
  async (exit) => {
    jest.useFakeTimers();
    const visible = { marketKey: 'perp:BTC', selected: true, foreground: true };
    const hidden = { ...visible, selected: false };
    const { result, rerender, unmount } = renderHook(
      ({ marketKey, selected, foreground }) => {
        const active = usePerpDepthSubscriptionActive(
          marketKey,
          selected,
          foreground,
        );
        usePerpDepthBook(instrument, active);
        return active;
      },
      { initialProps: visible },
    );
    try {
      await act(async () => jest.advanceTimersByTimeAsync(1));
      rerender(hidden);
      expect(result.current).toBe(true);
      rerender(
        exit === 'blur'
          ? { ...hidden, foreground: false }
          : { ...hidden, marketKey: 'perp:ETH' },
      );
      expect(result.current).toBe(false);
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
      rerender(hidden);
      expect(result.current).toBe(false);
      expect(mockSubscribe).toHaveBeenCalledTimes(1);

      rerender(visible);
      await act(async () => jest.advanceTimersByTimeAsync(60_000));
      expect(result.current).toBe(true);
      expect(mockSubscribe).toHaveBeenCalledTimes(2);
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    } finally {
      unmount();
      jest.useRealTimers();
    }
    expect(mockUnsubscribe).toHaveBeenCalledTimes(2);
  },
);
