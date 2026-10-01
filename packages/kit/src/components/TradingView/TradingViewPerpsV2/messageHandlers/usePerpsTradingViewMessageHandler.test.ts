import { act, renderHook } from '@testing-library/react-native';

import type { IFill, IHex } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { getPerpsInteractionOverlayOpenState } from './interactionOverlayState';
import { usePerpsTradingViewMessageHandler } from './usePerpsTradingViewMessageHandler';

import type { IWebViewRef } from '../../../WebView/types';
import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

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
  usePerpsCustomSettingsAtom: () => [{ showTradeMarks: true }],
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
    (props: { symbol: string; userAddress: IHex | null }) =>
      usePerpsTradingViewMessageHandler({
        ...props,
        webRef,
        chartInstanceKey: 'chart',
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

function getMarksMessage(symbol: string, requestId: string) {
  return chartMessage('tradingview_getMarks', {
    symbol,
    requestId,
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

describe('usePerpsTradingViewMessageHandler account switch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadTradesHistory.mockImplementation((address) =>
      Promise.resolve(fillsByAccount[address] ?? []),
    );
  });

  it('keeps the chart and clears in place when only the confirmed symbol holds marks', async () => {
    const { result, rerender } = renderHandler('BTC', ACCOUNT_A);
    await flushBridge();
    await receive(result.current, getMarksMessage('BTC', 'r1'));
    mockSend.mockClear();

    rerender({ symbol: 'BTC', userAddress: ACCOUNT_B });

    expect(mockRebuild).not.toHaveBeenCalled();
    expect(sentMessages()[0]).toEqual({
      type: 'MARKS_UPDATE',
      payload: { marks: [], symbol: 'BTC', operation: 'clear' },
    });
  });

  it('rebuilds when another symbol still holds the previous account marks', async () => {
    const { result, rerender } = renderHandler('ETH', ACCOUNT_A);
    await flushBridge();
    await receive(result.current, getMarksMessage('ETH', 'r1'));
    rerender({ symbol: 'BTC', userAddress: ACCOUNT_A });
    await receive(result.current, getMarksMessage('BTC', 'r2'));

    rerender({ symbol: 'BTC', userAddress: ACCOUNT_B });

    expect(mockRebuild).toHaveBeenCalledTimes(1);
  });

  it('rebuilds when the chart has not confirmed the symbol switched back to', async () => {
    const { result, rerender } = renderHandler('BTC', ACCOUNT_A);
    await flushBridge();
    await receive(result.current, getMarksMessage('BTC', 'r1'));
    rerender({ symbol: 'ETH', userAddress: ACCOUNT_A });
    rerender({ symbol: 'BTC', userAddress: ACCOUNT_A });

    rerender({ symbol: 'BTC', userAddress: ACCOUNT_B });

    expect(mockRebuild).toHaveBeenCalledTimes(1);
  });

  it('answers a request for a symbol the app already left with no marks', async () => {
    const { result } = renderHandler('BTC', ACCOUNT_A);
    await flushBridge();

    await receive(result.current, getMarksMessage('ETH', 'r1'));

    expect(sentMessages()).toContainEqual({
      type: 'MARKS_RESPONSE',
      payload: { marks: [], requestId: 'r1' },
    });
  });

  it('answers a request from the previous account with no marks, then redraws the current account', async () => {
    const { result, rerender } = renderHandler('BTC', ACCOUNT_A);
    await flushBridge();
    let resolveStaleFetch: (fills: IFill[]) => void = () => {};
    mockLoadTradesHistory.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveStaleFetch = resolve;
        }),
    );
    const staleRequest = result.current.customReceiveHandler(
      getMarksMessage('BTC', 'r1'),
    ) as Promise<unknown>;
    rerender({ symbol: 'BTC', userAddress: ACCOUNT_B });
    await flushBridge();
    mockSend.mockClear();

    resolveStaleFetch(fillsByAccount[ACCOUNT_A]);
    await act(async () => {
      await staleRequest;
    });
    await flushBridge();

    const messages = sentMessages();
    expect(messages[0]).toEqual({
      type: 'MARKS_RESPONSE',
      payload: { marks: [], requestId: 'r1' },
    });
    expect(messages.at(-1)).toMatchObject({
      type: 'MARKS_UPDATE',
      payload: {
        symbol: 'BTC',
        operation: 'replace',
        marks: [expect.objectContaining({ id: 'trade_3' })],
      },
    });
  });
});
