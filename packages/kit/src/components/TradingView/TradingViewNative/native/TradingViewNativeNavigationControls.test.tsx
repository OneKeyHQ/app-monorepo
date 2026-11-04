/**
 * @jest-environment jsdom
 */

import type { ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { TradingViewNativeNavigationControls } from './TradingViewNativeNavigationControls';

const mockStack = jest.fn<void, [Record<string, unknown>]>();
const mockXStack = jest.fn<void, [Record<string, unknown>]>();

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: ({ children }: { children?: ReactNode }) => children,
  Path: () => null,
}));

jest.mock('@onekeyhq/components', () => ({
  Stack: ({
    children,
    onPress,
    ...props
  }: {
    children?: ReactNode;
    onPress?: () => void;
    accessibilityLabel?: string;
    testID?: string;
  }) => {
    mockStack(props);
    return (
      <button
        type="button"
        data-testid={props.testID}
        aria-label={props.accessibilityLabel}
        onClick={onPress}
      >
        {children}
      </button>
    );
  },
  XStack: ({ children, ...props }: { children?: ReactNode }) => {
    mockXStack(props);
    return <div>{children}</div>;
  },
  useTheme: () => ({ text: { val: '#000000' } }),
}));

describe('Native TradingViewNativeNavigationControls', () => {
  beforeEach(() => jest.clearAllMocks());

  it('exposes all five actions with translated accessible labels', () => {
    const onAction = jest.fn();
    render(
      <TradingViewNativeNavigationControls
        backgroundColor="#ffffff"
        chartWidth={320}
        isResetVisible
        onAction={onAction}
        timeAxisHeight={24}
        testID="chart"
      />,
    );

    const actions = ['zoomOut', 'zoomIn', 'scrollLeft', 'scrollRight', 'reset'];
    const labels = [
      'menu.zoom_out',
      'menu.zoom_in',
      'chart_scroll_left__action',
      'chart_scroll_right__action',
      'global.reset',
    ];
    actions.forEach((action, index) => {
      const button = screen.getByRole('button', { name: labels[index] });
      expect(button.getAttribute('data-testid')).toBe(
        `chart-navigation-${action}`,
      );
      fireEvent.click(button);
      expect(onAction).toHaveBeenNthCalledWith(index + 1, action);
    });
    expect(onAction).toHaveBeenCalledTimes(5);
  });

  it('limits touch handling to 28px buttons and leaves gaps available for chart gestures', () => {
    render(
      <TradingViewNativeNavigationControls
        backgroundColor="#ffffff"
        chartWidth={320}
        isResetVisible
        onAction={jest.fn()}
        timeAxisHeight={24}
      />,
    );

    expect(mockXStack.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({
        bottom: 36,
        gap: 6,
        paddingRight: 0,
        pointerEvents: 'box-none',
        width: 320,
      }),
    );
    for (const [props] of mockStack.mock.calls) {
      expect(props).toEqual(
        expect.objectContaining({
          accessibilityRole: 'button',
          width: 28,
          height: 28,
        }),
      );
      expect(props).not.toHaveProperty('hitSlop');
    }
  });

  it('hides reset while the chart is at its default view', () => {
    render(
      <TradingViewNativeNavigationControls
        backgroundColor="#ffffff"
        chartWidth={320}
        isResetVisible={false}
        onAction={jest.fn()}
        timeAxisHeight={24}
        testID="chart"
      />,
    );

    expect(screen.queryByTestId('chart-navigation-reset')).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(4);
  });

  it('keeps the primary buttons in flow and pins reset beside them', () => {
    render(
      <TradingViewNativeNavigationControls
        backgroundColor="#ffffff"
        chartWidth={320}
        isResetVisible
        onAction={jest.fn()}
        timeAxisHeight={24}
        testID="chart"
      />,
    );

    const propsByTestID = new Map(
      mockStack.mock.calls.map(([props]) => [props.testID, props]),
    );
    // Four 28px buttons with 6px gaps span 130px, centered in 320px.
    expect(propsByTestID.get('chart-navigation-reset')).toEqual(
      expect.objectContaining({ position: 'absolute', top: 0, left: 231 }),
    );
    for (const action of ['zoomOut', 'zoomIn', 'scrollLeft', 'scrollRight']) {
      expect(propsByTestID.get(`chart-navigation-${action}`)?.position).toBe(
        undefined,
      );
    }
  });

  it('keeps reset inside a narrow chart', () => {
    render(
      <TradingViewNativeNavigationControls
        backgroundColor="#ffffff"
        chartWidth={180}
        isResetVisible
        onAction={jest.fn()}
        timeAxisHeight={24}
        testID="chart"
      />,
    );

    expect(mockXStack.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({ paddingRight: 18, width: 180 }),
    );
    const resetProps = mockStack.mock.calls.find(
      ([props]) => props.testID === 'chart-navigation-reset',
    )?.[0];
    // 152 + 28 ends exactly at the 180px chart edge.
    expect(resetProps).toEqual(expect.objectContaining({ left: 152 }));
  });
});
