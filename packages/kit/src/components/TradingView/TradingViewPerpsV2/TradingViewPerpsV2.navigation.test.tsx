/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, render, screen } from '@testing-library/react';

import { showLimitOrderDialog } from '@onekeyhq/kit/src/views/Perp/components/TradingPanel/panels/LimitOrderForm';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { TradingViewPerpsV2 } from './TradingViewPerpsV2';

import type { useChartLines } from './hooks';
import type { usePerpsTradingViewMessageHandler } from './messageHandlers';
import type { IWebViewProps } from '../../WebView';
import type { WebViewNavigationEvent } from 'react-native-webview/lib/WebViewTypes';

const mockWebViewProps = jest.fn<void, [IWebViewProps]>();
const mockMessageHandlerProps = jest.fn<
  void,
  Parameters<typeof usePerpsTradingViewMessageHandler>
>();
const mockChartLines = jest.fn<
  ReturnType<typeof useChartLines>,
  Parameters<typeof useChartLines>
>(() => ({
  hasAccountLinesRef: { current: false },
  sendLinesSync: jest.fn(),
  sendLinesClear: jest.fn(),
}));
const mockResetControls = jest.fn();
const mockSetMounted = jest.fn();
const mockSourcePage = { hostKey: 'main', ownerKey: 'perps' };

jest.mock('@onekeyfe/react-native-native-overlay', () => ({
  useOverlayPageScope: () => mockSourcePage,
}));

jest.mock('react-intl', () => ({ useIntl: () => ({}) }));
jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    Stack: ({ children }: { children?: ReactNode }) =>
      React.createElement('div', null, children),
    useTheme: () => ({ bgApp: { val: '#fff' } }),
  };
});
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true, isNativeAndroid: true },
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {},
  appEventBus: { on: jest.fn(), off: jest.fn() },
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHyperliquid: {
      getTradingviewPriceScale: async () => 100,
    },
  },
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid', () => ({
  useActiveTradeInstrumentAtom: () => [{ mode: 'perps' }],
  useHyperliquidActions: () => ({ current: {} }),
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpsCandlesWebviewMountedAtom: () => [{}, mockSetMounted],
}));
jest.mock(
  '@onekeyhq/kit/src/views/Perp/components/OrderInfoPanel/SetTpslModal',
  () => ({ showSetTpslDialog: jest.fn() }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Perp/components/TradingPanel/panels/LimitOrderForm',
  () => ({ showLimitOrderDialog: jest.fn() }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Perp/hooks/useEnableTradingWithDepositFallback',
  () => ({ useEnsureTradingEnabled: jest.fn() }),
);
jest.mock('../../../hooks/useNetworkRestore', () => ({
  useNetworkRestore: () => ({ restoreNonce: 0 }),
}));
jest.mock('../../../hooks/useThemeVariant', () => ({
  useThemeVariant: () => 'light',
}));
jest.mock('../../WebView', () => ({
  __esModule: true,
  default: (props: IWebViewProps) => {
    mockWebViewProps(props);
    return null;
  },
}));
jest.mock('../hooks', () => ({
  syncTradingViewTheme: jest.fn(),
  useNavigationHandler: () => ({ handleNavigation: jest.fn() }),
  useTradingViewUrl: () => ({
    finalUrl: 'https://chart.test',
    timezone: 'UTC',
  }),
}));
jest.mock('../TradingViewChartLoadingMask', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    TradingViewChartLoadingMask: () =>
      React.createElement('div', { 'data-testid': 'loading-mask' }),
  };
});
jest.mock('../TradingViewV2/components/TradingViewV2ChartControls', () => ({
  TradingViewV2ChartControlsContainer: () => null,
}));
jest.mock('./hooks', () => ({
  useChartLines: (...args: Parameters<typeof useChartLines>) =>
    mockChartLines(...args),
  useTradeUpdates: () => ({}),
}));
jest.mock('./hooks/usePerpsNativeChartControls', () => ({
  usePerpsNativeChartControls: () => ({
    reset: mockResetControls,
    controlsProps: {},
    isRestoringInterval: false,
  }),
}));
jest.mock('./messageHandlers', () => ({
  usePerpsTradingViewMessageHandler: (
    ...args: Parameters<typeof usePerpsTradingViewMessageHandler>
  ) => {
    mockMessageHandlerProps(...args);
    return { customReceiveHandler: jest.fn() };
  },
}));

function markChartReady() {
  act(() => {
    mockMessageHandlerProps.mock.calls.at(-1)?.[0].onChartLinesReady?.({});
  });
}

function emitNativeLoadStart(loading: boolean) {
  act(() => {
    mockWebViewProps.mock.calls.at(-1)?.[0].onLoadStart?.({
      nativeEvent: { loading, url: 'https://chart.test?symbol=ETH' },
    } as WebViewNavigationEvent);
  });
}

describe('Perps chart navigation readiness', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    platformEnv.isNativeAndroid = true;
  });

  it('keeps the Android chart and order lines ready after a same-document URL update', () => {
    render(<TradingViewPerpsV2 symbol="BTC" userAddress={undefined} />);
    markChartReady();
    expect(screen.queryByTestId('loading-mask')).toBeNull();

    emitNativeLoadStart(false);

    expect(screen.queryByTestId('loading-mask')).toBeNull();
    expect(mockChartLines.mock.calls.at(-1)?.[0].isReady).toBe(true);
    expect(mockResetControls).not.toHaveBeenCalled();
  });

  it('waits for fresh chart readiness after a real Android page load', () => {
    render(<TradingViewPerpsV2 symbol="BTC" userAddress={undefined} />);
    markChartReady();

    emitNativeLoadStart(true);

    expect(screen.getByTestId('loading-mask')).toBeTruthy();
    expect(mockChartLines.mock.calls.at(-1)?.[0].isReady).toBe(false);
    expect(mockResetControls).toHaveBeenCalledTimes(1);
    markChartReady();
    expect(screen.queryByTestId('loading-mask')).toBeNull();
    expect(mockChartLines.mock.calls.at(-1)?.[0].isReady).toBe(true);
  });

  it.each([
    { isMainFrame: true, isInPlace: true, shouldReset: false },
    { isMainFrame: false, isInPlace: false, shouldReset: false },
    { isMainFrame: true, isInPlace: false, shouldReset: true },
  ])('handles desktop navigation $isMainFrame/$isInPlace', (navigation) => {
    platformEnv.isNativeAndroid = false;
    render(<TradingViewPerpsV2 symbol="BTC" userAddress={undefined} />);
    markChartReady();

    act(() => {
      mockWebViewProps.mock.calls.at(-1)?.[0].onDidStartNavigation?.(
        Object.assign(new Event('did-start-navigation'), {
          isMainFrame: navigation.isMainFrame,
          isInPlace: navigation.isInPlace,
          url: 'https://chart.test',
          frameProcessId: 1,
          frameRoutingId: 1,
        }),
      );
    });

    expect(Boolean(screen.queryByTestId('loading-mask'))).toBe(
      navigation.shouldReset,
    );
    expect(mockChartLines.mock.calls.at(-1)?.[0].isReady).toBe(
      !navigation.shouldReset,
    );
    expect(mockResetControls).toHaveBeenCalledTimes(
      navigation.shouldReset ? 1 : 0,
    );
  });

  it('captures the page source only when opening a chart limit order', async () => {
    render(
      <TradingViewPerpsV2
        symbol="BTC"
        userAddress={undefined}
        enablePerpsTradingUi
      />,
    );
    await act(async () => {
      mockMessageHandlerProps.mock.calls.at(-1)?.[0].onChartOrderIntent?.({
        intent: 'limitEntry',
        symbol: 'BTC',
        price: '83000',
      });
      await Promise.resolve();
    });
    expect(showLimitOrderDialog).toHaveBeenCalledWith(
      expect.objectContaining({ sourcePage: mockSourcePage }),
    );
  });
});
