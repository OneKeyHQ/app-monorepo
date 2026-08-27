/**
 * @jest-environment jsdom
 */

import { act, renderHook } from '@testing-library/react';

import type { IWebViewRef } from '@onekeyhq/kit/src/components/WebView/types';

import { useTradingViewMessageHandler } from './useTradingViewMessageHandler';

import type { ICustomReceiveHandlerData } from '../../../types';

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('./analyticsHandler', () => ({
  handleAnalyticsEvent: jest.fn(),
}));
jest.mock('./klineDataHandler', () => ({
  fetchAccountTransactionMarks: jest.fn(),
  handleKLineDataRequest: jest.fn(),
  sendClearAccountMarks: jest.fn(),
  shouldMockEmptyKLineData: jest.fn(),
}));

function buildMessage({
  method,
  scope = '$private',
}: {
  method: string;
  scope?: string;
}): ICustomReceiveHandlerData {
  return {
    data: {
      scope,
      method,
      origin: 'test',
      data: { layout: '' },
    },
  };
}

describe('useTradingViewMessageHandler', () => {
  it('notifies when TradingView reports that the chart is ready', async () => {
    const onChartReady = jest.fn();
    const webRef = { current: null } as React.RefObject<IWebViewRef | null>;
    const { result } = renderHook(() =>
      useTradingViewMessageHandler({ webRef, onChartReady }),
    );

    await act(async () => {
      await result.current.customReceiveHandler(
        buildMessage({ method: 'tradingview_chartReady' }),
      );
    });

    expect(onChartReady).toHaveBeenCalledTimes(1);
  });

  it('ignores chart-ready messages outside the private scope', async () => {
    const onChartReady = jest.fn();
    const webRef = { current: null } as React.RefObject<IWebViewRef | null>;
    const { result } = renderHook(() =>
      useTradingViewMessageHandler({ webRef, onChartReady }),
    );

    await act(async () => {
      await result.current.customReceiveHandler(
        buildMessage({
          method: 'tradingview_chartReady',
          scope: 'public',
        }),
      );
    });

    expect(onChartReady).not.toHaveBeenCalled();
  });
});
