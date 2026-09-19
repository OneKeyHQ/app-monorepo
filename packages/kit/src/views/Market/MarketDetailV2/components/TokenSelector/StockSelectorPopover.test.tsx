/**
 * @jest-environment jsdom
 */
import type { ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import {
  runPopoverCloseSideEffects,
  runPopoverOpenSideEffects,
} from '@onekeyhq/components/src/actions/Popover/popoverSideEffects';
import type { INativeSheetPresentationProps } from '@onekeyhq/components/src/hocs/NativeSheetPresentation/types';

import { StockSelectorPopover } from './StockSelectorPopover.native';

jest.mock('react-native', () => ({
  useWindowDimensions: () => ({ height: 907, width: 393 }),
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNativeIOS: true },
}));

// The repository mapper routes the components barrel and every subpath to
// one mock module. Keep their exports together while exercising the real
// native lifecycle hook and context through their relative source paths.
jest.mock('@onekeyhq/components', () => {
  const Wrapper = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  const lifecycle = jest.requireActual<
    typeof import('@onekeyhq/components/src/actions/Popover/useNativePortalLifecycle.native')
  >(
    '../../../../../../../components/src/actions/Popover/useNativePortalLifecycle.native',
  );
  const context = jest.requireActual<
    typeof import('@onekeyhq/components/src/actions/Popover/context')
  >('../../../../../../../components/src/actions/Popover/context');
  return {
    ...lifecycle,
    ...context,
    Stack: Wrapper,
    XStack: Wrapper,
    YStack: Wrapper,
    SizableText: Wrapper,
    useSafeAreaInsets: () => ({ top: 59, bottom: 34, left: 0, right: 0 }),
    runPopoverOpenSideEffects: jest.fn(),
    runPopoverCloseSideEffects: jest.fn(),
    Trigger: ({
      onPress,
      children,
    }: {
      onPress: () => void;
      children?: ReactNode;
    }) => (
      <button type="button" data-testid="trigger" onClick={onPress}>
        {children}
      </button>
    ),
    NativeSheetPresentation: ({
      children,
      height,
      maxHeight,
      open,
      onOpenChange,
      onAnimationComplete,
    }: INativeSheetPresentationProps) => (
      <div
        data-testid="native-sheet"
        data-open={String(open)}
        data-height={height}
        data-max-height={maxHeight}
      >
        {children}
        <button
          type="button"
          data-testid="native-dismiss"
          onClick={() => onOpenChange?.(false)}
        >
          Dismiss
        </button>
        <button
          type="button"
          data-testid="native-animation-complete"
          onClick={() => onAnimationComplete?.({ open: false })}
        >
          Finish closing
        </button>
      </div>
    ),
  };
});

function SelectorContent({ closePopover }: { closePopover: () => void }) {
  return (
    <button type="button" onClick={closePopover} data-testid="select">
      Select
    </button>
  );
}

const props = {
  title: 'Select stock tokens',
  renderTrigger: <span>AAPLon</span>,
  renderContent: SelectorContent,
};

function openSelector() {
  fireEvent.click(screen.getByTestId('trigger'));
  act(() => jest.advanceTimersByTime(32));
}

describe('StockSelectorPopover native sheet', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps a closing selection mounted until native animation completes', () => {
    const onOpenChange = jest.fn();
    render(<StockSelectorPopover {...props} onOpenChange={onOpenChange} />);
    expect(screen.queryByTestId('native-sheet')).toBeNull();

    openSelector();
    expect(screen.getByTestId('native-sheet').getAttribute('data-open')).toBe(
      'true',
    );
    fireEvent.click(screen.getByTestId('select'));
    expect(screen.getByTestId('native-sheet').getAttribute('data-open')).toBe(
      'false',
    );
    expect(onOpenChange.mock.calls).toEqual([[true], [false]]);

    fireEvent.click(screen.getByTestId('native-animation-complete'));
    expect(screen.queryByTestId('native-sheet')).toBeNull();
    expect(runPopoverOpenSideEffects).toHaveBeenCalledTimes(1);
    expect(runPopoverCloseSideEffects).toHaveBeenCalledTimes(1);
  });

  it('notifies native drag dismissal once and cancels a pending selection', () => {
    const onOpenChange = jest.fn();
    render(<StockSelectorPopover {...props} onOpenChange={onOpenChange} />);
    openSelector();
    fireEvent.click(screen.getByTestId('native-dismiss'));
    fireEvent.click(screen.getByTestId('native-dismiss'));
    expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
  });

  it('cancels the owner when navigation unmounts an open selector', () => {
    const onOpenChange = jest.fn();
    const view = render(
      <StockSelectorPopover {...props} onOpenChange={onOpenChange} />,
    );
    openSelector();
    view.unmount();
    expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
    expect(runPopoverCloseSideEffects).toHaveBeenCalledTimes(1);
  });

  it('keeps controlled presentation open until the owner acknowledges closing', () => {
    const onOpenChange = jest.fn();
    const view = render(
      <StockSelectorPopover {...props} open onOpenChange={onOpenChange} />,
    );
    act(() => jest.advanceTimersByTime(32));
    fireEvent.click(screen.getByTestId('select'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.getByTestId('native-sheet').getAttribute('data-open')).toBe(
      'true',
    );

    view.rerender(
      <StockSelectorPopover
        {...props}
        open={false}
        onOpenChange={onOpenChange}
      />,
    );
    expect(screen.getByTestId('native-sheet').getAttribute('data-open')).toBe(
      'false',
    );
  });

  it('sizes the ticker to 86 percent without counting the iOS bottom inset twice', () => {
    render(
      <StockSelectorPopover
        {...props}
        showHeader={false}
        sheetProps={{ snapPoints: [86], snapPointsMode: 'percent' }}
      />,
    );
    openSelector();
    expect(
      Number(screen.getByTestId('native-sheet').getAttribute('data-height')),
    ).toBeCloseTo(746.02);
    expect(screen.queryByTestId('stock-selector-close')).toBeNull();
    expect(screen.queryByText('Select stock tokens')).toBeNull();
  });

  it('lets issuer content fit while bounding the total surface to 92 percent', () => {
    render(<StockSelectorPopover {...props} />);
    openSelector();
    expect(
      screen.getByTestId('native-sheet').getAttribute('data-height'),
    ).toBeNull();
    expect(
      Number(
        screen.getByTestId('native-sheet').getAttribute('data-max-height'),
      ),
    ).toBeCloseTo(800.44);
  });
});
