/**
 * @jest-environment jsdom
 */

import type { ReactNode, TouchEvent } from 'react';

import { fireEvent, render, screen, within } from '@testing-library/react';

import { TradingViewNativeIndicatorQuickBar } from './NativeIndicatorControls';

import type { ITradingViewNativeIndicatorState } from './hooks/useNativeIndicatorActiveValues';
import type { ITradingViewNativeChartControlsConfigData } from '../../types';

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  type IMockTouchHandler = (event: {
    nativeEvent: { pageX: number; pageY: number };
  }) => void;

  function forwardTouchEvent(handler?: IMockTouchHandler) {
    if (!handler) {
      return undefined;
    }

    return (event: TouchEvent<HTMLDivElement>) => {
      const touch = event.touches[0] ?? event.changedTouches[0];
      handler({
        nativeEvent: {
          pageX: touch?.pageX ?? 0,
          pageY: touch?.pageY ?? 0,
        },
      });
    };
  }

  function MockStack({
    children,
    testID,
    width,
    flex,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onTouchCancel,
  }: {
    children?: ReactNode;
    testID?: string;
    width?: number | string;
    flex?: number;
    onTouchStart?: IMockTouchHandler;
    onTouchMove?: IMockTouchHandler;
    onTouchEnd?: IMockTouchHandler;
    onTouchCancel?: IMockTouchHandler;
  }) {
    return React.createElement(
      'div',
      {
        'data-testid': testID,
        'data-width': width,
        'data-flex': flex,
        onTouchStart: forwardTouchEvent(onTouchStart),
        onTouchMove: forwardTouchEvent(onTouchMove),
        onTouchEnd: forwardTouchEvent(onTouchEnd),
        onTouchCancel: forwardTouchEvent(onTouchCancel),
      },
      children,
    );
  }

  function MockText({ children }: { children?: ReactNode }) {
    return React.createElement('span', undefined, children);
  }

  function MockScrollView({
    children,
    testID,
    flex,
  }: {
    children?: ReactNode;
    testID?: string;
    flex?: number;
  }) {
    return React.createElement(
      'div',
      {
        'data-testid': testID,
        'data-flex': flex,
        'data-scrollable': 'true',
      },
      children,
    );
  }

  return {
    ScrollView: MockScrollView,
    SizableText: MockText,
    Stack: MockStack,
    XStack: MockStack,
  };
});

jest.mock(
  '../../../TradingViewChartControls/indicatorSelector/NativeIndicatorSelector',
  () => ({
    IndicatorListDialogContent: () => null,
    IndicatorPopover: () => null,
  }),
);

const nativeChartControlsConfig: ITradingViewNativeChartControlsConfigData = {
  indicators: [
    { label: 'MA', value: 'MA', active: true },
    { label: 'VOL', value: 'VOL', active: true },
  ],
  chartTypes: [],
  activeChartType: 0,
};

function createNativeIndicatorState(): ITradingViewNativeIndicatorState {
  const activeIndicatorValues = new Set(['MA', 'VOL']);

  return {
    activeIndicatorValues,
    isInitialized: true,
    sourceIndicators: nativeChartControlsConfig.indicators,
    getActiveIndicatorValues: () => activeIndicatorValues,
    updateActiveIndicatorValue: jest.fn(),
  };
}

describe('TradingView native indicator quick bar', () => {
  it('keeps the main indicators fixed and scrolls the sub indicators', () => {
    render(
      <TradingViewNativeIndicatorQuickBar
        nativeChartControlsConfig={nativeChartControlsConfig}
        nativeIndicatorState={createNativeIndicatorState()}
        splitSections
        onIndicatorSelect={jest.fn()}
      />,
    );

    const mainSection = screen.getByTestId(
      'trading-view-native-indicator-quick-bar-main',
    );
    const divider = screen.getByTestId(
      'trading-view-native-indicator-quick-bar-divider',
    );
    const subSection = screen.getByTestId(
      'trading-view-native-indicator-quick-bar-sub',
    );

    expect(within(mainSection).getByText('MA')).toBeTruthy();
    expect(within(mainSection).queryByText('VOL')).toBeNull();
    expect(within(subSection).getByText('VOL')).toBeTruthy();
    expect(within(subSection).queryByText('MA')).toBeNull();
    expect(mainSection.getAttribute('data-width')).toBe('184');
    expect(mainSection.getAttribute('data-scrollable')).toBeNull();
    expect(subSection.getAttribute('data-flex')).toBe('1');
    expect(subSection.getAttribute('data-scrollable')).toBe('true');
    expect(divider.parentElement).toBe(mainSection.parentElement);
    expect(divider.parentElement).toBe(subSection.parentElement);
  });

  it('bridges vertical movement without rerouting a horizontal gesture', () => {
    const onTouchScroll = jest.fn();
    render(
      <TradingViewNativeIndicatorQuickBar
        nativeChartControlsConfig={nativeChartControlsConfig}
        nativeIndicatorState={createNativeIndicatorState()}
        splitSections
        onIndicatorSelect={jest.fn()}
        onTouchScroll={onTouchScroll}
      />,
    );

    const quickBar = screen.getByTestId(
      'trading-view-native-indicator-quick-bar',
    );
    fireEvent.touchStart(quickBar, {
      touches: [{ pageX: 100, pageY: 100 }],
    });
    fireEvent.touchMove(quickBar, {
      touches: [{ pageX: 102, pageY: 90 }],
    });
    fireEvent.touchMove(quickBar, {
      touches: [{ pageX: 103, pageY: 82 }],
    });
    fireEvent.touchEnd(quickBar, { changedTouches: [] });

    expect(onTouchScroll).toHaveBeenNthCalledWith(1, 10);
    expect(onTouchScroll).toHaveBeenNthCalledWith(2, 8);

    fireEvent.touchStart(quickBar, {
      touches: [{ pageX: 100, pageY: 100 }],
    });
    fireEvent.touchMove(quickBar, {
      touches: [{ pageX: 110, pageY: 102 }],
    });
    fireEvent.touchMove(quickBar, {
      touches: [{ pageX: 112, pageY: 80 }],
    });

    expect(onTouchScroll).toHaveBeenCalledTimes(2);
  });
});
