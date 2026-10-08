/** @jest-environment jsdom */

import type { ComponentProps, ReactNode } from 'react';

import { act, render, screen } from '@testing-library/react';

import {
  readTradingViewNativeActiveInterval,
  saveTradingViewNativeActiveInterval,
} from '@onekeyhq/kit/src/components/TradingView/TradingViewNative/data/tradingViewNativeIntervalStorage';
import type { IWebViewRef } from '@onekeyhq/kit/src/components/WebView/types';

import { TradingViewV2 } from './TradingViewV2';

import type { TradingViewRuntimeView } from './TradingViewRuntimeView';
import type { ITradingViewIntervalConfigData } from '../../types';
import type { TradingViewV2ChartControlsContainer } from '../TradingViewV2ChartControls';

const mockStorage = new Map<string, unknown>();
const mockSendMessage = jest.fn();
const mockRuntimeProps = jest.fn<
  void,
  [ComponentProps<typeof TradingViewRuntimeView>]
>();
const mockControlsProps = jest.fn<
  void,
  [ComponentProps<typeof TradingViewV2ChartControlsContainer>]
>();

jest.mock('@onekeyhq/shared/src/storage/appStorage', () => ({
  __esModule: true,
  default: {
    syncStorage: {
      getObject: (key: string) => mockStorage.get(key),
      setObject: (key: string, value: unknown) => mockStorage.set(key, value),
    },
  },
}));
jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    Stack: ({ children }: { children?: ReactNode }) =>
      React.createElement('div', null, children),
    useTheme: () => ({ bgApp: { val: '#fff' } }),
  };
});
jest.mock(
  '@onekeyhq/kit/src/components/TradingView/TradingViewChartLoadingMask',
  () => {
    const React = jest.requireActual<typeof import('react')>('react');
    return {
      TradingViewChartLoadingMask: ({ testID }: { testID: string }) =>
        React.createElement('div', { 'data-testid': testID }),
    };
  },
);
jest.mock('@onekeyhq/kit/src/components/TradingView/hooks', () => ({
  syncTradingViewTheme: jest.fn(),
  useNavigationHandler: () => ({ handleNavigation: jest.fn() }),
  useTradingViewUrl: () => ({
    finalUrl: 'https://chart.test',
    timezone: 'UTC',
  }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => true,
}));
jest.mock('@onekeyhq/kit/src/hooks/useThemeVariant', () => ({
  useThemeVariant: () => 'light',
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings', () => ({
  useDevSettingsPersistAtom: () => [{ enabled: false }],
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('./hooks', () => ({
  useAutoKLineUpdate: jest.fn(),
  useAutoTokenDetailUpdate: jest.fn(),
  useHyperLiquidKlineSource: () => ({ isHyperLiquidSource: false }),
  useTradingViewV2WebSocket: jest.fn(),
}));
jest.mock('./messageHandlers/analyticsHandler', () => ({
  handleAnalyticsEvent: jest.fn(),
}));
jest.mock('./messageHandlers/klineDataHandler', () => ({
  DEFAULT_TRADING_VIEW_KLINE_RESOLUTION: '1',
  normalizeTradingViewKLineInterval: (interval: string) => interval,
  fetchAccountTransactionMarks: jest.fn(),
  handleKLineDataRequest: jest.fn(),
  sendClearAccountMarks: jest.fn(),
  shouldMockEmptyKLineData: jest.fn(),
}));
jest.mock('../TradingViewV2ChartControls', () => ({
  TradingViewV2ChartControlsContainer: (
    props: ComponentProps<typeof TradingViewV2ChartControlsContainer>,
  ) => {
    mockControlsProps(props);
    return null;
  },
  getTradingViewNativeSubIndicatorCountForSnapshot: () => 0,
  useNativeIndicatorActiveValues: () => ({}),
}));
jest.mock('./TradingViewRuntimeView', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    TradingViewRuntimeView: (
      props: ComponentProps<typeof TradingViewRuntimeView>,
    ) => {
      mockRuntimeProps(props);
      const { onWebViewRef } = props;
      React.useLayoutEffect(() => {
        onWebViewRef?.({
          reload: jest.fn(),
          loadURL: jest.fn(),
          sendMessageViaInjectedScript: mockSendMessage,
        } as IWebViewRef);
      }, [onWebViewRef]);
      return null;
    },
  };
});

const intervals = ['1', '15', '60', '1D'].map((value) => ({
  label: value,
  value,
}));
const loadingMask = () =>
  screen.queryByTestId('trading-view-interval-sync-loading');
const controls = () => mockControlsProps.mock.lastCall?.[0];

async function receive(
  method: string,
  data: ITradingViewIntervalConfigData & { layoutRestored?: boolean },
) {
  const handler = mockRuntimeProps.mock.lastCall?.[0].customReceiveHandler;
  expect(handler).toBeDefined();
  await act(async () => {
    await handler?.({
      data: {
        scope: '$private',
        method,
        origin: 'test',
        data:
          method === 'tradingview_nativeChartControlsConfig'
            ? {
                ...data,
                indicators: [],
                chartTypes: [{ label: 'Candles', value: 1 }],
                activeChartType: 1,
              }
            : data,
      },
    });
  });
}

describe('TradingViewV2 interval message integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage.clear();
  });
  afterEach(() => jest.useRealTimers());

  it('does not acknowledge a matching control snapshot before a delayed layout interval', async () => {
    await saveTradingViewNativeActiveInterval({
      interval: '15',
      namespace: 'token',
    });
    render(
      <TradingViewV2
        symbol="TEST"
        decimal={18}
        intervalStorageNamespace="token"
        enableNativeChartControls
        showNativeIndicatorQuickBar={false}
      />,
    );
    await receive('tradingview_nativeChartControlsConfig', {
      intervals,
      activeInterval: '15',
      layoutRestored: false,
    });
    expect(mockSendMessage).not.toHaveBeenCalled();
    await receive('tradingview_nativeChartControlsConfig', {
      intervals,
      activeInterval: '15',
      layoutRestored: true,
    });
    await receive('tradingview_intervalConfig', {
      intervals,
      activeInterval: '60',
    });
    expect(readTradingViewNativeActiveInterval('token')).toBe('15');
    expect(controls()?.intervalConfig?.activeInterval).toBe('15');
    expect(loadingMask()).not.toBeNull();
    expect(mockSendMessage).toHaveBeenCalledWith({
      type: 'TRADINGVIEW_INTERVAL_CHANGE',
      payload: { interval: '15', resetPriceScaleRange: true },
    });
    await receive('tradingview_intervalConfig', {
      intervals,
      activeInterval: '15',
      persist: true,
    });
    expect(loadingMask()).toBeNull();
    await receive('tradingview_nativeChartControlsConfig', {
      intervals,
      activeInterval: '60',
      layoutRestored: true,
    });
    expect(readTradingViewNativeActiveInterval('token')).toBe('15');
  });

  it('unmasks an automatic fallback after a user selection without changing the saved interval', async () => {
    jest.useFakeTimers();
    render(
      <TradingViewV2
        symbol="TEST"
        decimal={18}
        intervalStorageNamespace="token"
        enableNativeChartControls
        showNativeIndicatorQuickBar={false}
      />,
    );
    await receive('tradingview_nativeChartControlsConfig', {
      intervals,
      activeInterval: '60',
      layoutRestored: true,
    });
    act(() => controls()?.onIntervalChange('1'));
    // A matching snapshot is still not a confirmation from IntervalManager.
    await receive('tradingview_nativeChartControlsConfig', {
      intervals,
      activeInterval: '1',
      layoutRestored: true,
    });
    await receive('tradingview_intervalConfig', {
      intervals,
      activeInterval: '1D',
      persist: false,
    });
    expect(loadingMask()).not.toBeNull();
    act(() => jest.advanceTimersByTime(5000));
    expect(loadingMask()).toBeNull();
    expect(controls()?.intervalConfig?.activeInterval).toBe('1D');
    expect(readTradingViewNativeActiveInterval('token')).toBe('1');
  });
});
