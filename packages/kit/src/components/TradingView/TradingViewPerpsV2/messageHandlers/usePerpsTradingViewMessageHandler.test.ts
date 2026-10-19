import { act, renderHook } from '@testing-library/react-native';

import type { IFill, IHex } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { getPerpsInteractionOverlayOpenState } from './interactionOverlayState';
import { usePerpsTradingViewMessageHandler } from './usePerpsTradingViewMessageHandler';

import type { IWebViewRef } from '../../../WebView/types';
import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

let mockShowTradeMarks = true;
const mockHasAccountLinesRef = { current: false };

const mockLoadTradesHistory = jest.fn<Promise<IFill[]>, [string]>();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHyperliquid: {
      loadTradesHistory: (address: string) => mockLoadTradesHistory(address),
    },
  },
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/perps', () => ({
  usePerpsCustomSettingsAtom: () => [{ showTradeMarks: mockShowTradeMarks }],
  usePerpsLayoutStateAtom: () => [{}, () => {}],
  usePerpsTradesHistoryRefreshHookAtom: () => [{ refreshHook: 0 }],
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: { HyperliquidDataUpdate: 'HyperliquidDataUpdate' },
  appEventBus: { on: () => {}, off: () => {} },
}));

describe('getPerpsInteractionOverlayOpenState', () => {
  it('parses explicit TradingView overlay visibility state', () => {
    expect(getPerpsInteractionOverlayOpenState({ isOpen: true })).toBe(true);
    expect(getPerpsInteractionOverlayOpenState({ isOpen: false })).toBe(false);
  });

  it('parses TradingView overlay action state', () => {
    expect(getPerpsInteractionOverlayOpenState({ action: 'open' })).toBe(true);
    expect(getPerpsInteractionOverlayOpenState({ action: 'close' })).toBe(
      false,
    );
  });

  it('ignores malformed TradingView overlay payloads', () => {
    expect(getPerpsInteractionOverlayOpenState(undefined)).toBeUndefined();
    expect(
      getPerpsInteractionOverlayOpenState({ action: 'toggle' }),
    ).toBeUndefined();
  });
});

const ACCOUNT_A = '0xaaa' as IHex;
const ACCOUNT_B = '0xbbb' as IHex;

function createFill(coin: string, tid: number): IFill {
  return {
    coin,
    px: '100',
    sz: '1',
    side: 'B',
    time: 1_700_000_000_000,
    oid: tid,
    tid,
    dir: 'Open Long',
  } as IFill;
}

const fillsByAccount: Record<string, IFill[]> = {
  [ACCOUNT_A]: [createFill('BTC', 1), createFill('ETH', 2)],
  [ACCOUNT_B]: [createFill('BTC', 3)],
};

const mockSend = jest.fn();
const mockRebuild = jest.fn();
const webRef = {
  current: {
    reload: () => {},
    loadURL: () => {},
    sendMessageViaInjectedScript: mockSend,
  } as IWebViewRef,
};

function renderHandler(symbol: string, userAddress: IHex | null) {
  return renderHook(
    (props: {
      symbol: string;
      userAddress: IHex | null;
      chartInstanceKey?: string;
    }) =>
      usePerpsTradingViewMessageHandler({
        ...props,
        webRef,
        chartInstanceKey: props.chartInstanceKey ?? 'chart',
        hasAccountLinesRef: mockHasAccountLinesRef,
        onAccountMarksRebuild: mockRebuild,
      }),
    { initialProps: { symbol, userAddress } },
  );
}

function chartMessage(method: string, data: unknown) {
  return {
    data: { scope: '$private', method, data },
  } as IJsBridgeMessagePayload;
}

function getMarksMessage(
  symbol: string,
  requestId: string,
  accountRevision?: number,
) {
  return chartMessage('tradingview_getMarks', {
    symbol,
    requestId,
    ...(accountRevision === undefined ? {} : { accountRevision }),
    from: 0,
    to: 1,
  });
}

function sentMessages() {
  return mockSend.mock.calls.map(
    ([message]) => message as { type: string; payload: unknown },
  );
}

async function flushBridge() {
  await act(async () => {
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
  });
}

async function receive(
  handler: ReturnType<typeof usePerpsTradingViewMessageHandler>,
  message: IJsBridgeMessagePayload,
) {
  await act(async () => {
    await handler.customReceiveHandler(message);
  });
  await flushBridge();
}

const capableChartReady = chartMessage('tradingview_chartReady', {
  capabilities: { perpsAccountMarksReset: true },
});

describe('usePerpsTradingViewMessageHandler account switch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockShowTradeMarks = true;
    mockHasAccountLinesRef.current = false;
    mockLoadTradesHistory.mockImplementation((address) =>
      Promise.resolve(fillsByAccount[address] ?? []),
    );
  });

  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['BTC', false, false],
    ['ETH', false, true],
    ['ETH', true, false],
  ] as const)(
    'switches accounts after %s -> BTC (reset=%s, rebuild=%s)',
    async (firstSymbol, reset, rebuild) => {
      const { result, rerender } = renderHandler(firstSymbol, ACCOUNT_A);
      if (reset) await receive(result.current, capableChartReady);
      await receive(result.current, getMarksMessage(firstSymbol, 'r1'));
      rerender({ symbol: 'BTC', userAddress: ACCOUNT_A });
      await receive(result.current, getMarksMessage('BTC', 'r2'));
      mockSend.mockClear();
      rerender({ symbol: 'BTC', userAddress: ACCOUNT_B });
      await flushBridge();

      expect(mockRebuild).toHaveBeenCalledTimes(rebuild ? 1 : 0);
      if (rebuild) return;
      expect(sentMessages()[0]).toEqual({
        type: 'MARKS_UPDATE',
        payload: {
          marks: [],
          symbol: 'BTC',
          operation: 'clear',
          ...(reset ? { accountRevision: 1 } : {}),
        },
      });
      expect(sentMessages().at(-1)).toMatchObject({
        payload: { marks: [expect.objectContaining({ id: 'trade_3' })] },
      });
      rerender({ symbol: 'BTC', userAddress: ACCOUNT_A });
      await flushBridge();
      expect(sentMessages().at(-1)).toMatchObject({
        payload: {
          marks: [expect.objectContaining({ id: 'trade_1' })],
          ...(reset ? { accountRevision: 2 } : {}),
        },
      });
      expect(mockRebuild).not.toHaveBeenCalled();
    },
  );

  it('re-establishes the revision on same-key reload and falls back for an old chart', async () => {
    const { result, rerender } = renderHandler('BTC', ACCOUNT_A);
    await receive(result.current, capableChartReady);
    rerender({ symbol: 'BTC', userAddress: ACCOUNT_B });
    await flushBridge();
    mockSend.mockClear();
    await receive(result.current, capableChartReady);
    expect(sentMessages()[0]).toMatchObject({
      type: 'MARKS_UPDATE',
      payload: { operation: 'clear', accountRevision: 1 },
    });
    await receive(result.current, chartMessage('tradingview_chartReady', {}));
    mockSend.mockClear();
    rerender({ symbol: 'BTC', userAddress: ACCOUNT_A });
    await flushBridge();
    expect(
      sentMessages().every(
        (message) =>
          !Object.hasOwn(message.payload as object, 'accountRevision'),
      ),
    ).toBe(true);
  });

  it.each([false, true])(
    'rebuilds interactive account lines even with empty marks (reset=%s)',
    async (reset) => {
      mockLoadTradesHistory.mockResolvedValue([]);
      const { result, rerender } = renderHandler('BTC', ACCOUNT_A);
      if (reset) await receive(result.current, capableChartReady);
      await flushBridge();
      mockHasAccountLinesRef.current = true;
      rerender({ symbol: 'BTC', userAddress: ACCOUNT_B });
      expect(mockRebuild).toHaveBeenCalledTimes(1);
    },
  );

  it('requires a fresh capability after the chart instance changes', async () => {
    const { result, rerender } = renderHandler('ETH', ACCOUNT_A);
    await receive(result.current, capableChartReady);
    rerender({
      symbol: 'ETH',
      userAddress: ACCOUNT_A,
      chartInstanceKey: 'new',
    });
    await receive(result.current, getMarksMessage('ETH', 'r1'));
    rerender({
      symbol: 'BTC',
      userAddress: ACCOUNT_A,
      chartInstanceKey: 'new',
    });
    await receive(result.current, getMarksMessage('BTC', 'r2'));
    rerender({
      symbol: 'BTC',
      userAddress: ACCOUNT_B,
      chartInstanceKey: 'new',
    });
    expect(mockRebuild).toHaveBeenCalledTimes(1);
  });

  it.each([
    [undefined, false, false],
    [undefined, true, false],
    [undefined, false, true],
    [0, false, false],
  ] as const)(
    'rejects late account data (revision=%s, fails=%s, returnToA=%s)',
    async (revision, fails, returnToA) => {
      const { result, rerender } = renderHandler('BTC', ACCOUNT_A);
      if (revision !== undefined)
        await receive(result.current, capableChartReady);
      await flushBridge();
      let complete: () => void = () => {};
      mockLoadTradesHistory.mockImplementationOnce(
        () =>
          new Promise((resolve, reject) => {
            complete = () => {
              if (fails) reject(new Error('old request failed'));
              else resolve([createFill('BTC', 99)]);
            };
          }),
      );
      const pending = result.current.customReceiveHandler(
        getMarksMessage('BTC', 'old', revision),
      );
      rerender({ symbol: 'BTC', userAddress: ACCOUNT_B });
      if (returnToA) rerender({ symbol: 'BTC', userAddress: ACCOUNT_A });
      await flushBridge();
      mockSend.mockClear();
      if (fails) jest.spyOn(console, 'error').mockImplementation(() => {});
      await act(async () => {
        complete();
        await pending;
      });
      await flushBridge();
      expect(sentMessages()[0]).toEqual({
        type: 'MARKS_RESPONSE',
        payload: {
          marks: [],
          requestId: 'old',
          ...(revision === undefined ? {} : { accountRevision: revision }),
        },
      });
      if (revision !== undefined) {
        expect(sentMessages()).toHaveLength(1);
      } else {
        expect(sentMessages().at(-1)).toMatchObject({
          type: 'MARKS_UPDATE',
          payload: {
            symbol: 'BTC',
            operation: 'replace',
            marks: [
              expect.objectContaining({
                id: returnToA ? 'trade_1' : 'trade_3',
              }),
            ],
          },
        });
      }
    },
  );

  it.each([
    undefined,
    'tradingview_priceUpdate',
    'tradingview_chartReady',
    'tradingview_getMarks',
  ])(
    'rebuilds after BTC -> ETH -> BTC even with delayed %s',
    async (method) => {
      const { result, rerender } = renderHandler('BTC', ACCOUNT_A);
      await receive(result.current, getMarksMessage('BTC', 'first'));
      rerender({ symbol: 'ETH', userAddress: ACCOUNT_A });
      rerender({ symbol: 'BTC', userAddress: ACCOUNT_A });
      if (method)
        await receive(
          result.current,
          chartMessage(method, { symbol: 'BTC', requestId: 'late' }),
        );
      rerender({ symbol: 'BTC', userAddress: ACCOUNT_B });
      expect(mockRebuild).toHaveBeenCalledTimes(1);
    },
  );

  it('answers a request for a symbol the app already left with no marks', async () => {
    const { result } = renderHandler('BTC', ACCOUNT_A);
    await receive(result.current, getMarksMessage('ETH', 'r1'));
    expect(sentMessages()).toContainEqual({
      type: 'MARKS_RESPONSE',
      payload: { marks: [], requestId: 'r1' },
    });
  });

  it('keeps an empty initial-symbol chart after trade marks are disabled', async () => {
    const { result, rerender } = renderHandler('BTC', ACCOUNT_A);
    await receive(result.current, getMarksMessage('BTC', 'first'));
    mockShowTradeMarks = false;
    rerender({ symbol: 'BTC', userAddress: ACCOUNT_A });
    await flushBridge();
    rerender({ symbol: 'ETH', userAddress: ACCOUNT_A });
    await flushBridge();
    rerender({ symbol: 'ETH', userAddress: ACCOUNT_B });
    expect(mockRebuild).not.toHaveBeenCalled();
  });
});
