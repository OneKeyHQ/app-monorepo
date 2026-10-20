/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { ColorPicker } from '.';

import { act, fireEvent, render, screen } from '@testing-library/react';

import { NativePopoverPresentationContext } from '../../actions/Popover/context';

import type { EPortalContainerConstantName } from '../../hocs/Portal';

type IMockViewProps = {
  children?: ReactNode;
  testID?: string;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityState?: { disabled?: boolean; checked?: boolean };
};

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true, isNativeIOS: true },
}));
jest.mock('../../hooks', () => ({ useMedia: () => ({ md: true }) }));
jest.mock('../../actions', () => ({
  Popover: () => null,
  Trigger: ({ children, testID, onPress, disabled }: IMockViewProps) => (
    <button
      type="button"
      data-testid={testID}
      onClick={onPress}
      disabled={disabled}
    >
      {children}
    </button>
  ),
}));
jest.mock('../../hocs', () => ({
  Portal: {
    Constant: { FULL_WINDOW_OVERLAY_PORTAL: 'global-overlay' },
    Body: ({
      children,
      container,
    }: {
      children?: ReactNode;
      container: string;
    }) => (
      <div data-testid="portal" data-container={container}>
        {children}
      </div>
    ),
  },
}));
jest.mock('../../composite/Dialog', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    DialogContainer: ({
      open,
      nativeDrawer,
      showHeader,
      renderContent,
      onClose,
    }: {
      open: boolean;
      nativeDrawer?: { width: number; height: number };
      showHeader?: boolean;
      renderContent: ReactNode;
      onClose: () => Promise<void>;
    }) => {
      const handleClose = React.useCallback(() => void onClose(), [onClose]);
      return open ? (
        <div
          data-testid="dialog"
          data-width={nativeDrawer?.width}
          data-height={nativeDrawer?.height}
          data-header={String(showHeader)}
        >
          {renderContent}
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close color picker"
          />
        </div>
      ) : null;
    },
  };
});
jest.mock('../../primitives', () => {
  const View = ({
    children,
    testID,
    onPress,
    accessibilityLabel,
    accessibilityState,
  }: IMockViewProps) =>
    onPress ? (
      <button
        type="button"
        data-testid={testID}
        data-checked={String(accessibilityState?.checked)}
        aria-label={accessibilityLabel}
        onClick={onPress}
      >
        {children}
      </button>
    ) : (
      <div data-testid={testID}>{children}</div>
    );
  return { Stack: View, XStack: View, YStack: View };
});

const COLORS = ['#ff0000', '#0000ff', { value: '#00ff00', disabled: true }];
const CHART_PORTAL = 'chart-fullscreen' as EPortalContainerConstantName;
const CHART_PRESENTATION = {
  portalContainer: CHART_PORTAL,
  nativeDrawer: { width: 420, height: 402 },
};

function renderTrigger() {
  return <span>Choose color</span>;
}

describe('ColorPicker mobile presentation', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    act(() => jest.runOnlyPendingTimers());
    jest.useRealTimers();
  });

  it('keeps the global mobile dialog when no presentation is provided', () => {
    const onChange = jest.fn();
    render(
      <ColorPicker
        defaultValue="#ff0000"
        colors={COLORS}
        testID="color"
        onChange={onChange}
        renderTrigger={renderTrigger}
      />,
    );
    fireEvent.click(screen.getByTestId('color-trigger-wrapper'));
    expect(screen.getByTestId('portal').getAttribute('data-container')).toBe(
      'global-overlay',
    );
    expect(screen.getByTestId('dialog').hasAttribute('data-width')).toBe(false);
    expect(screen.getByTestId('dialog').getAttribute('data-header')).toBe(
      'false',
    );
    fireEvent.click(screen.getByTestId('color-palette-#00ff00'));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('dialog')).toBeTruthy();
    fireEvent.click(screen.getByTestId('color-palette-#0000ff'));
    expect(onChange).toHaveBeenCalledWith('#0000ff');
    expect(screen.queryByTestId('dialog')).toBeNull();
  });

  it('opens in the fullscreen drawer and closes after applying a color', () => {
    const onChange = jest.fn();
    const onOpenChange = jest.fn();
    render(
      <NativePopoverPresentationContext.Provider value={CHART_PRESENTATION}>
        <ColorPicker
          defaultValue="#ff0000"
          colors={COLORS}
          testID="color"
          onChange={onChange}
          onOpenChange={onOpenChange}
          renderTrigger={renderTrigger}
        />
      </NativePopoverPresentationContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('color-trigger-wrapper'));
    expect(screen.getByTestId('portal').getAttribute('data-container')).toBe(
      'chart-fullscreen',
    );
    expect(screen.getByTestId('dialog').getAttribute('data-width')).toBe('420');
    expect(screen.getByTestId('dialog').getAttribute('data-height')).toBe(
      '402',
    );
    expect(screen.getByTestId('dialog').getAttribute('data-header')).toBe(
      'true',
    );
    fireEvent.click(screen.getByTestId('color-palette-#0000ff'));
    expect(onChange).toHaveBeenCalledWith('#0000ff');
    expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
    act(() => jest.advanceTimersByTime(300));
    expect(screen.queryByTestId('portal')).toBeNull();
    fireEvent.click(screen.getByTestId('color-trigger-wrapper'));
    expect(
      screen.getByTestId('color-palette-#0000ff').getAttribute('data-checked'),
    ).toBe('true');
  });

  it('keeps the drawer open when requested and dismisses without another change', () => {
    const onChange = jest.fn();
    render(
      <NativePopoverPresentationContext.Provider value={CHART_PRESENTATION}>
        <ColorPicker
          colors={COLORS}
          closeOnSelect={false}
          testID="color"
          onChange={onChange}
          renderTrigger={renderTrigger}
        />
      </NativePopoverPresentationContext.Provider>,
    );
    fireEvent.click(screen.getByTestId('color-trigger-wrapper'));
    fireEvent.click(screen.getByTestId('color-palette-#0000ff'));
    expect(screen.getByTestId('dialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close color picker' }));
    expect(onChange.mock.calls).toEqual([['#0000ff']]);
    expect(screen.queryByTestId('dialog')).toBeNull();
  });
});
