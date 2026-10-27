/**
 * @jest-environment jsdom
 */

import { isValidElement } from 'react';
import type {
  FocusEventHandler,
  KeyboardEventHandler,
  PointerEventHandler,
  ReactNode,
} from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { TradingViewNativeNavigationControls } from './TradingViewNativeNavigationControls';

const mockStack = jest.fn<void, [Record<string, unknown>]>();
const mockXStack = jest.fn<void, [Record<string, unknown>]>();

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => ({
  Stack: ({
    children,
    testID,
    onPress,
    onFocus,
    onKeyDown,
    onBlur,
    onPointerDown,
    ...props
  }: {
    children?: ReactNode;
    testID?: string;
    onPress?: () => void;
    onFocus?: FocusEventHandler<HTMLButtonElement>;
    onKeyDown?: KeyboardEventHandler<HTMLButtonElement>;
    onBlur?: FocusEventHandler<HTMLButtonElement>;
    onPointerDown?: PointerEventHandler<HTMLButtonElement>;
    'aria-label'?: string;
  }) => {
    mockStack(props);
    return (
      <button
        type="button"
        data-testid={testID}
        aria-label={props['aria-label']}
        onClick={onPress}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        onPointerDown={onPointerDown}
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

function renderControls({
  isVisible = false,
  onAction = jest.fn(),
}: {
  isVisible?: boolean;
  onAction?: jest.Mock;
} = {}) {
  render(
    <TradingViewNativeNavigationControls
      backgroundColor="#ffffff"
      chartWidth={600}
      isVisible={isVisible}
      onAction={onAction}
      timeAxisHeight={24}
      testID="chart"
    />,
  );
  return { onAction };
}

describe('Web TradingViewNativeNavigationControls', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps hidden buttons reachable as native buttons', () => {
    renderControls();

    expect(mockXStack.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({ opacity: 0, pointerEvents: 'none' }),
    );
    expect(mockXStack.mock.lastCall?.[0]).not.toHaveProperty('aria-hidden');
    for (const [props] of mockStack.mock.calls) {
      expect(props).not.toHaveProperty('tabIndex');
      expect(isValidElement(props.render) && props.render.type).toBe('button');
    }
  });

  it('reveals the bar while a button has keyboard focus', () => {
    renderControls();
    const zoomIn = screen.getByTestId('chart-navigation-zoomIn');
    jest.spyOn(zoomIn, 'matches').mockReturnValue(true);

    fireEvent.focus(zoomIn);
    expect(mockXStack.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({ opacity: 1, pointerEvents: 'box-none' }),
    );

    fireEvent.blur(zoomIn);
    expect(mockXStack.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({ opacity: 0, pointerEvents: 'none' }),
    );
  });

  it('keeps the bar hidden after pointer focus', () => {
    renderControls();
    const reset = screen.getByTestId('chart-navigation-reset');
    jest.spyOn(reset, 'matches').mockReturnValue(false);

    fireEvent.pointerDown(reset);
    fireEvent.focus(reset);

    expect(mockXStack.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({ opacity: 0 }),
    );
  });

  it('labels every button with translated copy', () => {
    renderControls();

    expect(
      ['zoomOut', 'zoomIn', 'scrollLeft', 'scrollRight', 'reset'].map(
        (action) =>
          screen
            .getByTestId(`chart-navigation-${action}`)
            .getAttribute('aria-label'),
      ),
    ).toEqual([
      'menu.zoom_out',
      'menu.zoom_in',
      'chart_scroll_left__action',
      'chart_scroll_right__action',
      'global.reset',
    ]);
  });

  it('runs the pressed navigation action', () => {
    const { onAction } = renderControls({ isVisible: true });

    fireEvent.click(screen.getByTestId('chart-navigation-scrollLeft'));

    expect(onAction).toHaveBeenCalledWith('scrollLeft');
  });
});
