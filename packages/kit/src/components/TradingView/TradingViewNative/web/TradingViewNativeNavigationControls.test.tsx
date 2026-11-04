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
  isResetVisible = true,
  isVisible = false,
  isMobileLayout = false,
  onAction = jest.fn(),
}: {
  isResetVisible?: boolean;
  isVisible?: boolean;
  isMobileLayout?: boolean;
  onAction?: jest.Mock;
} = {}) {
  const props = {
    backgroundColor: '#ffffff',
    chartWidth: 600,
    isMobileLayout,
    isVisible,
    onAction,
    timeAxisHeight: 24,
    testID: 'chart',
  };
  const { rerender } = render(
    <TradingViewNativeNavigationControls
      {...props}
      isResetVisible={isResetVisible}
    />,
  );
  return {
    onAction,
    setResetVisible: (nextIsResetVisible: boolean) =>
      rerender(
        <TradingViewNativeNavigationControls
          {...props}
          isResetVisible={nextIsResetVisible}
        />,
      ),
  };
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

  it('keeps mobile controls visible without hover or keyboard focus and uses touch sizes', () => {
    const { onAction } = renderControls({
      isMobileLayout: true,
      isVisible: true,
    });
    const zoomIn = screen.getByTestId('chart-navigation-zoomIn');
    jest.spyOn(zoomIn, 'matches').mockReturnValue(false);

    fireEvent.pointerDown(zoomIn);
    fireEvent.focus(zoomIn);
    fireEvent.click(zoomIn);
    fireEvent.blur(zoomIn);

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith('zoomIn');
    expect(mockXStack.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({
        opacity: 1,
        pointerEvents: 'box-none',
        gap: 6,
      }),
    );
    for (const [props] of mockStack.mock.calls) {
      expect(props).toEqual(
        expect.objectContaining({
          width: 28,
          height: 28,
          pointerEvents: 'auto',
        }),
      );
    }
  });

  it('retains compact desktop buttons while visible', () => {
    renderControls({ isVisible: true });

    expect(mockXStack.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({ gap: 6 }),
    );
    for (const [props] of mockStack.mock.calls) {
      expect(props).toEqual(expect.objectContaining({ width: 25, height: 25 }));
    }
  });

  it('hides reset while the chart is at its default view', () => {
    renderControls({ isResetVisible: false, isVisible: true });

    expect(screen.queryByTestId('chart-navigation-reset')).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(4);
  });

  it('pins reset beside the centered primary buttons', () => {
    renderControls({ isVisible: true });

    const propsByLabel = new Map(
      mockStack.mock.calls.map(([props]) => [props['aria-label'], props]),
    );
    // Four 25px buttons with 6px gaps span 118px, centered in 600px.
    expect(propsByLabel.get('global.reset')).toEqual(
      expect.objectContaining({ position: 'absolute', top: 0, left: 365 }),
    );
    expect(propsByLabel.get('menu.zoom_in')?.position).toBe(undefined);
  });

  it('hides the bar once a keyboard-focused reset unmounts', () => {
    const { setResetVisible } = renderControls();
    const reset = screen.getByTestId('chart-navigation-reset');
    jest.spyOn(reset, 'matches').mockReturnValue(true);

    fireEvent.focus(reset);
    expect(mockXStack.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({ opacity: 1 }),
    );

    setResetVisible(false);
    expect(mockXStack.mock.lastCall?.[0]).toEqual(
      expect.objectContaining({ opacity: 0, pointerEvents: 'none' }),
    );
  });
});
