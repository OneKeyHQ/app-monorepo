/** @jest-environment jsdom */

import type { RefObject } from 'react';

import { act, renderHook } from '@testing-library/react';

import type { IWebViewRef } from '@onekeyhq/kit/src/components/WebView/types';

import {
  fetchAccountTransactionMarks,
  handleKLineDataRequest,
} from './klineDataHandler';
import { useTradingViewMessageHandler } from './useTradingViewMessageHandler';

import type { ICustomReceiveHandlerData } from '../../../types';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHyperliquid: {
      getTradingviewMidPrice: jest.fn(),
      getTradingviewDisplayPriceScale: jest.fn(),
      setTradingviewDisplayPriceScale: jest.fn(),
    },
  },
}));

jest.mock('@onekeyhq/shared/src/utils/perpsUtils', () => ({
  calculateDisplayPriceScale: jest.fn(() => 100),
}));

jest.mock('./analyticsHandler', () => ({
  handleAnalyticsEvent: jest.fn(),
}));

jest.mock('./layoutUpdateHandler', () => ({
  handleLayoutUpdate: jest.fn(),
}));

jest.mock('./klineDataHandler', () => ({
  fetchAccountTransactionMarks: jest.fn(),
  handleKLineDataRequest: jest.fn(),
  sendClearAccountMarks: jest.fn(),
  shouldMockEmptyKLineData: jest.fn(async () => false),
}));

const mockFetchAccountTransactionMarks =
  fetchAccountTransactionMarks as jest.MockedFunction<
    typeof fetchAccountTransactionMarks
  >;
const mockHandleKLineDataRequest =
  handleKLineDataRequest as jest.MockedFunction<typeof handleKLineDataRequest>;

function buildMessage(
  method: string,
  data: Record<string, unknown>,
): ICustomReceiveHandlerData {
  return {
    data: {
      scope: '$private',
      method,
      origin: 'onekey',
      data,
    },
  } as ICustomReceiveHandlerData;
}

function buildWebViewRef() {
  const sendMessageViaInjectedScript = jest.fn();
  return {
    sendMessageViaInjectedScript,
    webRef: {
      current: {
        loadURL: jest.fn(),
        reload: jest.fn(),
        sendMessageViaInjectedScript,
      },
    } as RefObject<IWebViewRef | null>,
  };
}

describe('useTradingViewMessageHandler request lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not start data requests while the persistent WebView is parked', async () => {
    const { webRef } = buildWebViewRef();
    const { result } = renderHook(() =>
      useTradingViewMessageHandler({
        tokenAddress: '0xabc',
        networkId: 'evm--1',
        webRef,
        isDataRequestEnabled: () => false,
      }),
    );

    await act(async () => {
      await result.current.customReceiveHandler(
        buildMessage('tradingview_getKLineData', {
          method: 'getBars',
          resolution: '1m',
          from: 1,
          to: 2,
          firstDataRequest: true,
        }),
      );
    });

    expect(mockHandleKLineDataRequest).not.toHaveBeenCalled();
  });

  it('safely forwards a malformed K-line payload to the guarded handler', async () => {
    const { webRef } = buildWebViewRef();
    const onKLineRequestStart = jest.fn();
    const { result } = renderHook(() =>
      useTradingViewMessageHandler({
        tokenAddress: '0xabc',
        networkId: 'evm--1',
        webRef,
        onKLineRequestStart,
      }),
    );

    await expect(
      act(async () => {
        await result.current.customReceiveHandler({
          data: {
            scope: '$private',
            method: 'tradingview_getKLineData',
            origin: 'onekey',
            data: null,
          },
        } as unknown as ICustomReceiveHandlerData);
      }),
    ).resolves.toBeUndefined();

    expect(onKLineRequestStart).not.toHaveBeenCalled();
    expect(mockHandleKLineDataRequest).toHaveBeenCalledTimes(1);
  });

  it('lets a request accepted while active finish after the WebView is parked', async () => {
    const { webRef } = buildWebViewRef();
    let isVisible = true;
    let resolveRequest: (() => void) | undefined;
    const requestFinished = new Promise<void>((resolve) => {
      resolveRequest = resolve;
    });
    mockHandleKLineDataRequest.mockImplementationOnce(async ({ context }) => {
      await requestFinished;
      expect(context.isRequestIdentityCurrent?.()).toBe(true);
      expect(
        context.isCurrentKLineRequest?.({
          tokenAddress: '0xabc',
          networkId: 'evm--1',
        }),
      ).toBe(true);
    });
    const { result } = renderHook(() =>
      useTradingViewMessageHandler({
        tokenAddress: '0xabc',
        networkId: 'evm--1',
        webRef,
        isDataRequestEnabled: () => isVisible,
      }),
    );

    let requestPromise: Promise<void> | undefined;
    act(() => {
      requestPromise = result.current.customReceiveHandler(
        buildMessage('tradingview_getKLineData', {
          method: 'getBars',
          resolution: '1m',
          from: 1,
          to: 2,
          firstDataRequest: true,
        }),
      );
    });
    expect(mockHandleKLineDataRequest).toHaveBeenCalledTimes(1);

    isVisible = false;
    resolveRequest?.();
    await act(async () => {
      await requestPromise;
    });
  });

  it('reports whether symbol sync safely refreshes active studies', async () => {
    const { webRef } = buildWebViewRef();
    const onMarketSymbolSyncSupportChange = jest.fn();
    const onMarketSymbolSyncStudiesSupportChange = jest.fn();
    const { result } = renderHook(() =>
      useTradingViewMessageHandler({
        tokenAddress: '0xabc',
        networkId: 'evm--1',
        webRef,
        onMarketSymbolSyncSupportChange,
        onMarketSymbolSyncStudiesSupportChange,
      }),
    );

    await act(async () => {
      await result.current.customReceiveHandler(
        buildMessage('tradingview_chartReady', {
          capabilities: {
            marketSymbolSync: true,
            marketSymbolSyncStudies: true,
          },
        }),
      );
      await result.current.customReceiveHandler(
        buildMessage('tradingview_chartReady', {
          capabilities: {
            marketSymbolSync: true,
          },
        }),
      );
    });

    expect(onMarketSymbolSyncSupportChange).toHaveBeenNthCalledWith(1, true);
    expect(onMarketSymbolSyncSupportChange).toHaveBeenNthCalledWith(2, true);
    expect(onMarketSymbolSyncStudiesSupportChange).toHaveBeenNthCalledWith(
      1,
      true,
    );
    expect(onMarketSymbolSyncStudiesSupportChange).toHaveBeenNthCalledWith(
      2,
      false,
    );
  });

  it('drops marks after the WebView document reloads', async () => {
    const { sendMessageViaInjectedScript, webRef } = buildWebViewRef();
    const webViewLoadGeneration = { current: 1 };
    mockFetchAccountTransactionMarks.mockImplementationOnce(async () => {
      webViewLoadGeneration.current += 1;
      return [];
    });
    const { result } = renderHook(() =>
      useTradingViewMessageHandler({
        tokenAddress: '0xabc',
        networkId: 'evm--1',
        webRef,
        webViewLoadGeneration,
        isDataRequestEnabled: () => true,
        isKLineHistoryReady: true,
      }),
    );

    await act(async () => {
      await result.current.customReceiveHandler(
        buildMessage('tradingview_getMarks', {
          requestId: 'marks-1',
          from: 1,
          to: 2,
          resolution: '1m',
        }),
      );
    });

    expect(mockFetchAccountTransactionMarks).toHaveBeenCalledTimes(1);
    expect(sendMessageViaInjectedScript).not.toHaveBeenCalled();
  });

  it('rejects identity-less readiness acknowledgements for a stale target', async () => {
    const { webRef } = buildWebViewRef();
    const onHistoryReady = jest.fn();
    const onFirstPaintReady = jest.fn();
    const resolveReadinessAckTarget = jest
      .fn<boolean | undefined, [unknown]>()
      .mockReturnValue(false);
    const { result } = renderHook(() =>
      useTradingViewMessageHandler({
        tokenAddress: '0xdef',
        networkId: 'evm--1',
        tokenSymbol: 'DEF',
        webRef,
        resolveReadinessAckTarget,
        onHistoryReady,
        onFirstPaintReady,
      }),
    );
    const historyReadyMessage = buildMessage('tradingview_historyReady', {
      requestId: 'token-a-history',
      resolution: '1m',
      firstDataRequest: true,
      status: 'success',
    });
    const firstPaintReadyMessage = buildMessage('tradingview_firstPaintReady', {
      requestId: 'token-a-first-paint',
      resolution: '1m',
      firstDataRequest: true,
      status: 'rendered',
      returnedCount: 100,
      source: 'bridge',
    });

    await act(async () => {
      await result.current.customReceiveHandler(historyReadyMessage);
      await result.current.customReceiveHandler(firstPaintReadyMessage);
    });

    expect(onHistoryReady).not.toHaveBeenCalled();
    expect(onFirstPaintReady).not.toHaveBeenCalled();

    resolveReadinessAckTarget.mockReturnValue(true);
    await act(async () => {
      await result.current.customReceiveHandler(historyReadyMessage);
      await result.current.customReceiveHandler(firstPaintReadyMessage);
    });

    expect(onHistoryReady).toHaveBeenCalledTimes(1);
    expect(onFirstPaintReady).toHaveBeenCalledTimes(1);
  });
});
