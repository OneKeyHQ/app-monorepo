import type { RefObject } from 'react';

import type { IMarketTokenKLineResponse } from '@onekeyhq/shared/types/marketV2';

import { fetchTradingViewV2DataWithSlicing } from '../hooks';

import { handleKLineDataRequest } from './klineDataHandler';

import type { IMessageHandlerContext } from './types';
import type { IWebViewRef } from '../../../WebView/types';
import type { ICustomReceiveHandlerData } from '../types';

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
}): ICustomReceiveHandlerData['data'] {
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
});
