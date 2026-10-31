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

  it('limits touch handling to 36px buttons and leaves gaps available for chart gestures', () => {
    render(
      <TradingViewNativeNavigationControls
        backgroundColor="#ffffff"
        chartWidth={320}
        onAction={jest.fn()}
        timeAxisHeight={24}
      />,
    );

    expect(mockXStack.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({
        bottom: 36,
        gap: 8,
        pointerEvents: 'box-none',
        width: 320,
      }),
    );
    for (const [props] of mockStack.mock.calls) {
      expect(props).toEqual(
        expect.objectContaining({
          accessibilityRole: 'button',
          width: 36,
          height: 36,
        }),
      );
      expect(props).not.toHaveProperty('hitSlop');
    }
  });
});
