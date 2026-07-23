/** @jest-environment jsdom */

import { render, screen } from '@testing-library/react';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { TradingViewV2 } from './TradingViewV2';

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    SizableText: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    Stack: ({
      children,
      testID,
    }: {
      children?: React.ReactNode;
      testID?: string;
    }) => React.createElement('div', { 'data-testid': testID }, children),
    useTheme: () => ({ bgApp: { val: '#000000' } }),
  };
});

jest.mock('@onekeyhq/kit/src/components/TradingView/hooks', () => ({
  useNavigationHandler: () => ({ handleNavigation: () => true }),
  useTradingViewUrl: () => ({
    finalUrl: 'https://tradingview.onekey.so',
    timezone: 'Etc/UTC',
  }),
}));

const mockWebViewProps: Record<string, unknown>[] = [];
const mockUseAutoKLineUpdate = jest.fn();
const mockUseAutoTokenDetailUpdate = jest.fn();
const mockUseMarketSymbolSync = jest.fn();
const mockUseTradingViewV2WebSocket = jest.fn();
const mockUseTradingViewMessageHandler = jest.fn();
let mockRouteIsFocused = true;

jest.mock('@onekeyhq/kit/src/components/WebView', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    default: (props: Record<string, unknown>) => {
      mockWebViewProps.push(props);
      return React.createElement('div', {
        'data-testid': 'trading-view-webview',
        'data-src': props.src,
      });
    },
  };
});

jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => mockRouteIsFocused,
}));

jest.mock('@onekeyhq/kit/src/hooks/useThemeVariant', () => ({
  useThemeVariant: () => 'dark',
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings', () => ({
  useDevSettingsPersistAtom: () => [{ enabled: false, settings: {} }],
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: { SwapTxHistoryStatusUpdate: 'SwapTxHistoryStatusUpdate' },
  appEventBus: { on: jest.fn(), off: jest.fn() },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    dex: { tradingView: { dexTVFirstPaint: jest.fn() } },
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    appPlatform: 'ios',
    isNative: true,
    isNativeIOS: true,
  },
}));

jest.mock('@onekeyhq/shared/src/utils/perpsUtils', () => ({
  calculateDisplayPriceScale: () => 1,
}));

jest.mock('@onekeyhq/shared/types/swap/types', () => ({
  ESwapTxHistoryStatus: {
    SUCCESS: 'SUCCESS',
    PARTIALLY_FILLED: 'PARTIALLY_FILLED',
  },
}));

jest.mock('../TradingViewNativeChartControls', () => ({
  TradingViewNativeChartControls: () => null,
  TradingViewNativeIndicatorQuickBar: () => null,
  getTradingViewNativeSubIndicatorCount: () => 0,
  getTradingViewNativeSubIndicatorCountFromOptions: () => 0,
  useNativeIndicatorActiveValues: () => ({
    activeIndicatorValues: new Set<string>(),
    isInitialized: false,
  }),
}));

jest.mock('./hooks', () => ({
  buildMarketTradingViewUrl: ({ baseUrl }: { baseUrl: string }) => baseUrl,
  getTradingViewV2FirstScreenPrefetchPromise: () => undefined,
  useAutoKLineUpdate: (params: unknown) => {
    mockUseAutoKLineUpdate(params);
  },
  useAutoTokenDetailUpdate: (params: unknown) => {
    mockUseAutoTokenDetailUpdate(params);
  },
  useHyperLiquidKlineSource: () => ({
    isHyperLiquidSource: false,
    symbol: undefined,
    isLoading: true,
  }),
  useMarketSymbolSync: (params: unknown) => {
    mockUseMarketSymbolSync(params);
  },
  useMarketTradingViewFrameIdentity: ({
    staticTradingViewUrl,
    identity,
  }: {
    staticTradingViewUrl: string;
    identity: unknown;
  }) => ({ staticTradingViewUrl, identity }),
  useTradingViewV2WebSocket: (params: unknown) => {
    mockUseTradingViewV2WebSocket(params);
  },
}));

jest.mock('./messageHandlers', () => ({
  DEFAULT_TRADING_VIEW_KLINE_RESOLUTION: '1m',
  fetchAndSendAccountMarks: jest.fn(),
  normalizeTradingViewKLineInterval: (interval: string) => interval,
  useTradingViewMessageHandler: (params: unknown) => {
    mockUseTradingViewMessageHandler(params);
    return {
      customReceiveHandler: jest.fn(async () => undefined),
    };
  },
}));

const mockTradingViewLogger = defaultLogger.dex.tradingView as unknown as {
  dexTVFirstPaint: jest.Mock;
};

describe('TradingViewV2 native source discovery', () => {
  beforeEach(() => {
    mockWebViewProps.length = 0;
    mockUseAutoKLineUpdate.mockClear();
    mockUseAutoTokenDetailUpdate.mockClear();
    mockUseMarketSymbolSync.mockClear();
    mockUseTradingViewV2WebSocket.mockClear();
    mockUseTradingViewMessageHandler.mockClear();
    mockTradingViewLogger.dexTVFirstPaint.mockClear();
    mockRouteIsFocused = true;
  });

  it('mounts the native WebView while the K-line source is still loading', () => {
    render(
      <TradingViewV2
        symbol="ABC"
        tokenAddress="0xabc"
        networkId="evm--1"
        decimal={8}
      />,
    );

    expect(screen.getByTestId('trading-view-webview')).toBeTruthy();
  });

  it('uses the minimal native chart bridge without the wallet provider', () => {
    render(
      <TradingViewV2
        symbol="ABC"
        tokenAddress="0xabc"
        networkId="evm--1"
        decimal={8}
      />,
    );

    const webViewProps = mockWebViewProps.at(-1);
    const injectedScript =
      webViewProps?.nativeInjectedJavaScriptBeforeContentLoaded;

    expect(webViewProps?.useInjectedNativeCode).toBe(false);
    expect(webViewProps?.skipBackgroundBridge).toBe(true);
    expect(webViewProps?.cacheEnabled).toBe(true);
    expect(webViewProps?.useSharedProcessPool).toBe(true);
    expect(typeof injectedScript).toBe('string');
    expect((injectedScript as string).length).toBeLessThan(3000);
    expect(injectedScript).toContain('window.ReactNativeWebView');
    expect(injectedScript).toContain("scope: '$private'");
  });

  it('pauses realtime work while a persistent chart session is inactive', () => {
    render(
      <TradingViewV2
        symbol="ABC"
        tokenAddress="0xabc"
        networkId="evm--1"
        decimal={8}
        enabled={false}
      />,
    );

    expect(mockUseMarketSymbolSync).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: false }),
    );
    expect(mockUseTradingViewV2WebSocket).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: false }),
    );
    expect(mockUseAutoKLineUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: false }),
    );
    expect(mockUseAutoTokenDetailUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: false }),
    );
    const messageHandlerParams = mockUseTradingViewMessageHandler.mock.calls.at(
      -1,
    )?.[0] as { isDataRequestEnabled?: () => boolean } | undefined;
    expect(messageHandlerParams?.isDataRequestEnabled?.()).toBe(false);
  });

  it('uses the persistent host session as visibility source', () => {
    mockRouteIsFocused = false;

    render(
      <TradingViewV2
        symbol="ABC"
        tokenAddress="0xabc"
        networkId="evm--1"
        decimal={8}
        enabled
        isVisibilityManagedExternally
      />,
    );

    const messageHandlerParams = mockUseTradingViewMessageHandler.mock.calls.at(
      -1,
    )?.[0] as { isDataRequestEnabled?: () => boolean } | undefined;
    expect(messageHandlerParams?.isDataRequestEnabled?.()).toBe(true);
    expect(mockUseAutoTokenDetailUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ enabled: true }),
    );
  });

  it('tracks first paint again after the same WebView document reloads', () => {
    const onFirstPaintReady = jest.fn();
    render(
      <TradingViewV2
        symbol="ABC"
        tokenAddress="0xabc"
        networkId="evm--1"
        decimal={8}
        onFirstPaintReady={onFirstPaintReady}
      />,
    );

    const firstPaintData = {
      requestId: 'request-1',
      resolution: '1m',
      firstDataRequest: true,
      status: 'rendered',
      returnedCount: 100,
      source: 'bridge',
    };
    const getFirstPaintHandler = () =>
      (
        mockUseTradingViewMessageHandler.mock.calls.at(-1)?.[0] as
          | {
              onFirstPaintReady?: (data: typeof firstPaintData) => void;
            }
          | undefined
      )?.onFirstPaintReady;

    getFirstPaintHandler()?.(firstPaintData);
    expect(onFirstPaintReady).toHaveBeenCalledTimes(1);
    expect(mockTradingViewLogger.dexTVFirstPaint).toHaveBeenCalledTimes(1);

    const webViewProps = mockWebViewProps.at(-1);
    (
      webViewProps?.onLoadStart as
        | ((event: Record<string, unknown>) => void)
        | undefined
    )?.({});
    getFirstPaintHandler()?.(firstPaintData);

    expect(onFirstPaintReady).toHaveBeenCalledTimes(2);
    expect(mockTradingViewLogger.dexTVFirstPaint).toHaveBeenCalledTimes(2);
  });

  it('forwards a later successful first paint after an initial failure', () => {
    const onFirstPaintReady = jest.fn();
    render(
      <TradingViewV2
        symbol="ABC"
        tokenAddress="0xabc"
        networkId="evm--1"
        decimal={8}
        onFirstPaintReady={onFirstPaintReady}
      />,
    );

    const getFirstPaintHandler = () =>
      (
        mockUseTradingViewMessageHandler.mock.calls.at(-1)?.[0] as
          | {
              onFirstPaintReady?: (data: {
                requestId: string;
                resolution: string;
                firstDataRequest: true;
                status: 'failed' | 'rendered';
                returnedCount: number;
                source: 'bridge';
              }) => void;
            }
          | undefined
      )?.onFirstPaintReady;

    getFirstPaintHandler()?.({
      requestId: 'request-failed',
      resolution: '1m',
      firstDataRequest: true,
      status: 'failed',
      returnedCount: 0,
      source: 'bridge',
    });
    getFirstPaintHandler()?.({
      requestId: 'request-success',
      resolution: '1m',
      firstDataRequest: true,
      status: 'rendered',
      returnedCount: 100,
      source: 'bridge',
    });

    expect(onFirstPaintReady).toHaveBeenCalledTimes(2);
    expect(mockTradingViewLogger.dexTVFirstPaint).toHaveBeenCalledTimes(1);
  });
});
