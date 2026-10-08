/**
 * @jest-environment jsdom
 */

import { useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode, SetStateAction } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import type { IMarketTradingViewLayout } from '@onekeyhq/kit-bg/src/states/jotai/atoms/market';
import {
  createTradingViewNativeChartSettings,
  createTradingViewNativeIndicatorSettings,
} from '@onekeyhq/shared/types/tradingViewNative';

import { TradingViewNativeMultiChart } from './TradingViewNativeMultiChart';
import { useTradingViewPanelSettings } from './useTradingViewPanelSettings';

import type { ITradingViewPanelDividerProps } from './TradingViewPanelDivider';
import type { ITradingViewNativeProps } from './types';

let mockLayout: IMarketTradingViewLayout;
const mockListeners = new Set<() => void>();
const mockChartSettings = createTradingViewNativeChartSettings();
const mockIndicatorSettings = createTradingViewNativeIndicatorSettings();
const mockSetLayout = (update: SetStateAction<IMarketTradingViewLayout>) => {
  mockLayout = typeof update === 'function' ? update(mockLayout) : update;
  mockListeners.forEach((listener) => listener());
};
const mockDividers = new Map<string, ITradingViewPanelDividerProps>();
const mockControllerMounts = new Map<string, object>();
const mockControllerProps = new Map<string, ITradingViewNativeProps>();
const mockGridLayout = {
  nativeEvent: { layout: { width: 1000, height: 640 } },
};

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useMarketTradingViewLayoutPersistAtom: () => [
      React.useSyncExternalStore(
        (listener) => {
          mockListeners.add(listener);
          return () => {
            mockListeners.delete(listener);
          };
        },
        () => mockLayout,
      ),
      mockSetLayout,
    ],
    useMarketTradingViewChartSettingsPersistAtom: () => [
      mockChartSettings,
      jest.fn(),
    ],
    useMarketTradingViewIndicatorSettingsPersistAtom: () => [
      mockIndicatorSettings,
      jest.fn(),
    ],
  };
});

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Stack = ({
    children,
    testID,
    onLayout,
    ...props
  }: {
    children?: ReactNode;
    testID?: string;
    onLayout?: (event: typeof mockGridLayout) => void;
    width?: string;
    height?: string;
  }) => {
    React.useLayoutEffect(() => {
      onLayout?.(mockGridLayout);
    }, [onLayout]);
    return (
      <div
        data-testid={testID}
        style={{ width: props.width, height: props.height }}
      >
        {children}
      </div>
    );
  };
  return {
    Stack,
    XStack: Stack,
    SizableText: ({ children }: { children?: ReactNode }) => (
      <span>{children}</span>
    ),
    IconButton: ({
      testID,
      onPress,
      disabled,
    }: {
      testID?: string;
      onPress?: () => void;
      disabled?: boolean;
    }) => (
      <button
        type="button"
        data-testid={testID}
        aria-label={testID ?? 'Action'}
        onClick={onPress}
        disabled={disabled}
      />
    ),
    Select: ({
      onChange,
      value,
    }: {
      onChange: (value: number) => void;
      value: number;
    }) => (
      <select
        aria-label="Chart layout"
        data-testid="layout"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {[1, 2, 4].map((count) => (
          <option key={count} value={count}>
            {count}
          </option>
        ))}
      </select>
    ),
  };
});

jest.mock('./TradingViewPanelButton', () => ({
  TradingViewPanelButton: ({
    testID,
    onPress,
    disabled,
    accessibilityLabel,
  }: {
    testID: string;
    onPress?: () => void;
    disabled?: boolean;
    accessibilityLabel: string;
  }) => (
    <button
      type="button"
      data-testid={testID}
      aria-label={accessibilityLabel}
      onClick={onPress}
      disabled={disabled}
    />
  ),
}));

jest.mock('./TradingViewPanelDivider', () => ({
  TradingViewPanelDivider: (props: ITradingViewPanelDividerProps) => {
    mockDividers.set(`${props.axis}:${props.index}`, props);
    return null;
  },
}));

jest.mock('./TradingViewNativePresentation', () => ({
  TradingViewNativePresentation: ({
    children,
    isFullscreen,
  }: {
    children: ReactNode;
    isFullscreen: boolean;
  }) => <div key={isFullscreen ? 'fullscreen' : 'inline'}>{children}</div>,
}));

function MockChartController(props: ITradingViewNativeProps) {
  const id = props.panelId ?? 'main';
  const controller = useRef({});
  const [viewport, setViewport] = useState(1);
  mockControllerMounts.set(id, controller.current);
  mockControllerProps.set(id, props);
  const content = (
    <>
      {props.nativeChartWorkspaceControls}
      <button
        type="button"
        data-testid={`viewport-${id}`}
        onClick={() => setViewport((current) => current + 1)}
      >
        {viewport}
      </button>
    </>
  );
  useLayoutEffect(() => {
    props.onPresentationContentChange?.(content);
  });
  return null;
}

const source = {
  kind: 'market' as const,
  networkId: 'evm--1',
  tokenAddress: '0xabc',
  symbol: 'TOKEN',
  realtime: 'disabled' as const,
};

function PanelSettings({ id }: { id: string }) {
  const {
    chartSettingsState: [settings, setSettings],
    indicatorSettingsState: [indicators, setIndicators],
  } = useTradingViewPanelSettings(id);
  return (
    <>
      <button
        type="button"
        data-testid={`style-${id}`}
        onClick={() => {
          void setSettings((current) => ({ ...current, chartType: 'line' }));
        }}
      >
        {settings.chartType}
      </button>
      <button
        type="button"
        data-testid={`indicators-${id}`}
        onClick={() => {
          void setIndicators((current) => ({ ...current, mainIndicators: [] }));
        }}
      >
        {indicators.mainIndicators.length}
      </button>
    </>
  );
}

describe('TradingView multi-chart workspace', () => {
  beforeEach(() => {
    mockLayout = {
      panelCount: 1,
      panelOrder: ['main', 'panel-2', 'panel-3', 'panel-4'],
      panelSettings: {},
    };
    mockControllerMounts.clear();
    mockControllerProps.clear();
    mockDividers.clear();
  });

  it.each([1, 2, 4] as const)(
    'keeps one quick bar reporter attached across layout changes from %s panels',
    (panelCount) => {
      mockLayout = { ...mockLayout, panelCount };
      const onQuickBarChange = jest.fn();
      render(
        <TradingViewNativeMultiChart
          source={source}
          ChartComponent={MockChartController}
          showNativeIndicatorQuickBar
          onNativeIndicatorQuickBarChange={onQuickBarChange}
        />,
      );
      const expectQuickBarOwner = (count: number) => {
        mockLayout.panelOrder.slice(0, count).forEach((id, index) => {
          expect(
            mockControllerProps.get(id)?.onNativeIndicatorQuickBarChange,
          ).toBe(index === 0 ? onQuickBarChange : undefined);
          expect(mockControllerProps.get(id)?.showNativeIndicatorQuickBar).toBe(
            count === 1,
          );
        });
      };
      expectQuickBarOwner(panelCount);
      [2, 4, 1].forEach((count) => {
        fireEvent.change(screen.getByTestId('layout'), {
          target: { value: String(count) },
        });
        expectQuickBarOwner(count);
      });
    },
  );

  it('retains each controller and its viewport across fullscreen and panel reordering', () => {
    const { rerender } = render(
      <TradingViewNativeMultiChart
        source={source}
        ChartComponent={MockChartController}
      />,
    );
    fireEvent.change(screen.getByTestId('layout'), { target: { value: '2' } });
    const main = mockControllerMounts.get('main');
    const second = mockControllerMounts.get('panel-2');
    fireEvent.click(screen.getByTestId('viewport-panel-2'));
    fireEvent.click(
      screen.getByTestId('trading-view-chart-panel-panel-2-move'),
    );
    expect(mockLayout.panelOrder[0]).toBe('panel-2');
    rerender(
      <TradingViewNativeMultiChart
        source={source}
        ChartComponent={MockChartController}
        isNativeChartFullscreen
      />,
    );
    expect(mockControllerMounts.get('main')).toBe(main);
    expect(mockControllerMounts.get('panel-2')).toBe(second);
    expect(screen.getByTestId('viewport-panel-2').textContent).toBe('2');
    expect(screen.getByTestId('viewport-main').textContent).toBe('1');
  });

  it('persists dragged proportions and restores them after changing layout', () => {
    render(
      <TradingViewNativeMultiChart
        source={source}
        ChartComponent={MockChartController}
      />,
    );
    fireEvent.change(screen.getByTestId('layout'), { target: { value: '2' } });
    const divider = mockDividers.get('columns:0');
    act(() => {
      divider?.onStart('columns', 0);
      divider?.onMove(100);
      divider?.onEnd(true);
    });
    expect(mockLayout.panelSizes?.['2:2'].columns).toEqual([0.6, 0.4]);
    fireEvent.change(screen.getByTestId('layout'), { target: { value: '4' } });
    expect(
      screen.getByTestId('trading-view-chart-panel-main').style.width,
    ).toBe('50%');
    fireEvent.change(screen.getByTestId('layout'), { target: { value: '2' } });
    expect(
      screen.getByTestId('trading-view-chart-panel-main').style.width,
    ).toBe('60%');
    expect(
      screen.getByTestId('trading-view-chart-panel-panel-2').style.width,
    ).toBe('40%');
  });

  it('writes panel settings independently and restores them on remount', () => {
    const panel2 = {
      chartSettings: mockChartSettings,
      indicatorSettings: mockIndicatorSettings,
    };
    const panel3 = {
      chartSettings: mockChartSettings,
      indicatorSettings: mockIndicatorSettings,
    };
    mockLayout.panelSettings = { 'panel-2': panel2, 'panel-3': panel3 };
    const { unmount } = render(
      <>
        <PanelSettings id="panel-2" />
        <PanelSettings id="panel-3" />
      </>,
    );
    fireEvent.click(screen.getByTestId('style-panel-2'));
    fireEvent.click(screen.getByTestId('indicators-panel-2'));
    expect(mockLayout.panelSettings['panel-2'].chartSettings.chartType).toBe(
      'line',
    );
    expect(mockLayout.panelSettings['panel-3']).toBe(panel3);
    unmount();
    render(<PanelSettings id="panel-2" />);
    expect(screen.getByTestId('style-panel-2').textContent).toBe('line');
  });
});
