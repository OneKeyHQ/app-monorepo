import type { RefObject } from 'react';

import type { IWebViewRef } from '@onekeyhq/kit/src/components/WebView/types';
import type { IMarketTokenKLineResponse } from '@onekeyhq/shared/types/marketV2';

import { fetchTradingViewV2DataWithSlicing } from '../hooks';

import { handleKLineDataRequest } from './klineDataHandler';

import type { IMessageHandlerContext } from './types';
import type { ICustomReceiveHandlerData } from '../../../types';

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
  resolution = '1',
}: {
  firstDataRequest: boolean;
  resolution?: string;
}): ICustomReceiveHandlerData['data'] {
  return {
    scope: '$private',
    method: 'tradingview_getKLineData',
    origin: 'onekey',
    data: {
      method: 'getBars',
      resolution,
      from: 1000,
      to: 2000,
      firstDataRequest,
    },
  };
}

function buildContext() {
  const sendMessageViaInjectedScript = jest.fn();
  const webRef = {
    current: {
      sendMessageViaInjectedScript,
    },
  } as unknown as RefObject<IWebViewRef | null>;
  const context: IMessageHandlerContext = {
    tokenAddress: '0x123',
    networkId: 'evm--1',
    webRef,
    onKLineLoadError: jest.fn(),
    onKLineDataReady: jest.fn(),
  };

  return {
    context,
    sendMessageViaInjectedScript,
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
    });
    expect(context.onKLineDataReady).not.toHaveBeenCalled();
  });

  it('responds with empty history when the only K-line source fails', async () => {
    mockFetchTradingViewV2DataWithSlicing.mockResolvedValueOnce(null);
    const { context, sendMessageViaInjectedScript } = buildContext();
    context.primaryKLineDataUnavailable = true;

    await handleKLineDataRequest({
      data: buildHistoryMessage({ firstDataRequest: true }),
      context,
    });

    expect(mockFetchTradingViewV2DataWithSlicing).toHaveBeenCalledWith(
      expect.objectContaining({
        autoHandleError: false,
        primaryKLineDataUnavailable: true,
      }),
    );
    expect(sendMessageViaInjectedScript).toHaveBeenCalledWith({
      type: 'kLineData',
      payload: expect.objectContaining({
        type: 'history',
        kLineData: {
          points: [],
          total: 0,
        },
      }),
    });
    expect(context.onKLineLoadError).toHaveBeenCalledWith({
      status: 'empty',
      period: '1m',
    });
  });

  it.each([
    ['1', '1m'],
    ['60', '1H'],
  ])(
    'normalizes TradingView resolution %s before requesting K-line data',
    async (resolution, interval) => {
      mockFetchTradingViewV2DataWithSlicing.mockResolvedValueOnce({
        points: [],
        total: 0,
      });
      const { context } = buildContext();

      await handleKLineDataRequest({
        data: buildHistoryMessage({
          firstDataRequest: false,
          resolution,
        }),
        context,
      });

      expect(mockFetchTradingViewV2DataWithSlicing).toHaveBeenCalledWith(
        expect.objectContaining({ interval }),
      );
    },
  );
});
