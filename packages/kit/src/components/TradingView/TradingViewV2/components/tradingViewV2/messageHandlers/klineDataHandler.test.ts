import type { RefObject } from 'react';

import type { IWebViewRef } from '@onekeyhq/kit/src/components/WebView/types';
import type { IMarketTokenKLineResponse } from '@onekeyhq/shared/types/marketV2';

import { fetchTradingViewV2DataWithSlicing } from '../hooks';

import { handleKLineDataRequest } from './klineDataHandler';

import type { IMessageHandlerContext } from './types';
import type {
  ICustomReceiveHandlerData,
  ITradingViewHistoryData,
} from '../../../types';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceDevSetting: {
      getDevSetting: jest.fn(async () => ({
        enabled: false,
        settings: {},
      })),
    },
  },
}));

jest.mock('../hooks', () => ({
  fetchTradingViewV2DataWithSlicing: jest.fn(),
}));

const mockFetchTradingViewV2DataWithSlicing =
  fetchTradingViewV2DataWithSlicing as jest.MockedFunction<
    typeof fetchTradingViewV2DataWithSlicing
  >;

function buildHistoryMessage({
  firstDataRequest,
}: {
  firstDataRequest: boolean;
}): ICustomReceiveHandlerData['data'] & { data: ITradingViewHistoryData } {
  return {
    scope: '$private',
    method: 'tradingview_getKLineData',
    origin: 'onekey',
    data: {
      method: 'getBars',
      resolution: '1',
      from: 1000,
      to: 2000,
      firstDataRequest,
    },
  };
}

function buildContext() {
  const sendMessageViaInjectedScript = jest.fn();
  const webViewLoadGeneration = { current: 1 };
  const webRef = {
    current: {
      sendMessageViaInjectedScript,
    },
  } as unknown as RefObject<IWebViewRef | null>;
  const context: IMessageHandlerContext = {
    tokenAddress: '0x123',
    networkId: 'evm--1',
    webRef,
    webViewLoadGeneration,
    onKLineLoadError: jest.fn(),
    onKLineDataReady: jest.fn(),
  };

  return {
    context,
    sendMessageViaInjectedScript,
    webViewLoadGeneration,
  };
}

describe('handleKLineDataRequest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not report empty load error for non-first history requests', async () => {
    const emptyKLineData: IMarketTokenKLineResponse = {
      points: [],
      total: 0,
    };
    mockFetchTradingViewV2DataWithSlicing.mockResolvedValueOnce(emptyKLineData);
    const { context, sendMessageViaInjectedScript } = buildContext();

    await handleKLineDataRequest({
      data: buildHistoryMessage({ firstDataRequest: false }),
      context,
    });

    expect(context.onKLineLoadError).not.toHaveBeenCalled();
    expect(context.onKLineDataReady).not.toHaveBeenCalled();
    expect(sendMessageViaInjectedScript).toHaveBeenCalledWith({
      type: 'kLineData',
      payload: expect.objectContaining({
        type: 'history',
        kLineData: emptyKLineData,
      }),
    });
  });

  it('reports empty load error for first history requests', async () => {
    mockFetchTradingViewV2DataWithSlicing.mockResolvedValueOnce({
      points: [],
      total: 0,
    });
    const { context } = buildContext();

    await handleKLineDataRequest({
      data: buildHistoryMessage({ firstDataRequest: true }),
      context,
    });

    expect(context.onKLineLoadError).toHaveBeenCalledWith({
      status: 'empty',
      period: '1m',
      requestRange: {
        from: 1000,
        to: 2000,
        countBack: 17,
        firstDataRequest: true,
      },
    });
    expect(context.onKLineDataReady).not.toHaveBeenCalled();
  });

  it('drops a K-line response after the WebView document reloads', async () => {
    mockFetchTradingViewV2DataWithSlicing.mockResolvedValueOnce({
      points: [{ t: 1000, o: 1, h: 1, l: 1, c: 1, v: 1 }],
      total: 1,
    });
    const { context, sendMessageViaInjectedScript, webViewLoadGeneration } =
      buildContext();

    const request = handleKLineDataRequest({
      data: buildHistoryMessage({ firstDataRequest: true }),
      context,
    });
    webViewLoadGeneration.current += 1;
    await request;

    expect(sendMessageViaInjectedScript).not.toHaveBeenCalled();
    expect(context.onKLineDataReady).not.toHaveBeenCalled();
  });

  it.each([
    { from: Number.NaN, to: 2000 },
    { from: 1000, to: Number.POSITIVE_INFINITY },
    { from: 2000, to: 1000 },
  ])('ignores an invalid history range %#', async ({ from, to }) => {
    const { context, sendMessageViaInjectedScript } = buildContext();
    const marksTimeRange = { current: null };
    context.marksTimeRange = marksTimeRange;
    const message = buildHistoryMessage({ firstDataRequest: true });
    message.data.from = from;
    message.data.to = to;

    await handleKLineDataRequest({ data: message, context });

    expect(mockFetchTradingViewV2DataWithSlicing).not.toHaveBeenCalled();
    expect(sendMessageViaInjectedScript).not.toHaveBeenCalled();
    expect(marksTimeRange.current).toBeNull();
  });
});
