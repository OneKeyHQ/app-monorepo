/**
 * @jest-environment jsdom
 */

import type { ReactNode } from 'react';

import { TableSplitViewContainer, useSetSplitViewDetailFullscreen } from '.';

import { act, fireEvent, render, screen } from '@testing-library/react';

import { useSplitViewDetailOffset } from './SplitViewDetailOffsetContext';

let mockIsSplitView = true;
let mockIsOnBoardingOpen = false;
let mockIsRealWidthMediaHeld = false;
let mockIsNativeAndroid = true;
let mockDetailOnLayout:
  | ((event: { nativeEvent: { layout: { x: number; width: number } } }) => void)
  | undefined;
let mockContainerOnLayout: typeof mockDetailOnLayout;

function measureSplit(detailX = 421.5) {
  act(() => {
    mockContainerOnLayout?.({ nativeEvent: { layout: { x: 0, width: 842 } } });
    mockDetailOnLayout?.({
      nativeEvent: { layout: { x: detailX, width: 420.5 } },
    });
  });
}

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isNativeAndroid() {
      return mockIsNativeAndroid;
    },
  },
}));

jest.mock('@onekeyhq/components', () => ({
  Divider: ({ display }: { display?: string }) => (
    <div data-display={display} data-testid="split-divider" />
  ),
  XStack: ({
    children,
    onLayout,
  }: {
    children?: ReactNode;
    onLayout?: typeof mockContainerOnLayout;
  }) => {
    mockContainerOnLayout = onLayout;
    return <div>{children}</div>;
  },
  YStack: ({
    children,
    display,
    onLayout,
  }: {
    children?: ReactNode;
    display?: string;
    onLayout?: typeof mockDetailOnLayout;
  }) => {
    if (display === undefined) {
      mockDetailOnLayout = onLayout;
    }
    return <div data-display={display}>{children}</div>;
  },
  useIsNativeTabletRealWidthMediaHeld: () => mockIsRealWidthMediaHeld,
  useIsSplitView: () => mockIsSplitView,
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/onboarding', () => ({
  useIsOnBoardingOpenAtom: () => [mockIsOnBoardingOpen],
}));

function DetailFullscreenControls() {
  const setDetailFullscreen = useSetSplitViewDetailFullscreen();
  const detailOffset = useSplitViewDetailOffset();
  return (
    <>
      <span data-testid="detail-offset">{detailOffset}</span>
      <button onClick={() => setDetailFullscreen(true)} type="button">
        Enter fullscreen
      </button>
      <button onClick={() => setDetailFullscreen(false)} type="button">
        Exit fullscreen
      </button>
    </>
  );
}

describe('TableSplitViewContainer', () => {
  beforeEach(() => {
    mockIsSplitView = true;
    mockIsOnBoardingOpen = false;
    mockIsRealWidthMediaHeld = false;
    mockIsNativeAndroid = true;
    mockDetailOnLayout = undefined;
    mockContainerOnLayout = undefined;
  });

  it('hides the main pane while real-width media is held before the onboarding atom updates', () => {
    mockIsRealWidthMediaHeld = true;
    render(
      <TableSplitViewContainer
        mainRouter={<div data-testid="split-main-router" />}
        detailRouter={null}
      />,
    );

    const mainPane = screen.getByTestId('split-main-router').parentElement;
    expect(mainPane?.getAttribute('data-display')).toBe('none');
    expect(
      screen.getByTestId('split-divider').getAttribute('data-display'),
    ).toBe('none');
  });

  it('expands the detail pane across a foldable screen while fullscreen', () => {
    render(
      <TableSplitViewContainer
        mainRouter={<div data-testid="split-main-router" />}
        detailRouter={<DetailFullscreenControls />}
      />,
    );

    const mainPane = screen.getByTestId('split-main-router').parentElement;
    expect(mainPane?.getAttribute('data-display')).toBe('flex');
    expect(
      screen.getByTestId('split-divider').getAttribute('data-display'),
    ).toBe('flex');

    fireEvent.click(screen.getByText('Enter fullscreen'));

    expect(mainPane?.getAttribute('data-display')).toBe('none');
    expect(
      screen.getByTestId('split-divider').getAttribute('data-display'),
    ).toBe('none');

    fireEvent.click(screen.getByText('Exit fullscreen'));

    expect(mainPane?.getAttribute('data-display')).toBe('flex');
  });

  it('uses the measured Android detail offset and updates it after layout changes', () => {
    render(
      <TableSplitViewContainer
        mainRouter={null}
        detailRouter={<DetailFullscreenControls />}
      />,
    );

    expect(screen.getByTestId('detail-offset').textContent).toBe('0');
    expect(mockDetailOnLayout).toBeDefined();
    measureSplit();
    expect(screen.getByTestId('detail-offset').textContent).toBe('421.5');
    act(() => {
      mockContainerOnLayout?.({
        nativeEvent: { layout: { x: 0, width: 1001 } },
      });
      mockDetailOnLayout?.({ nativeEvent: { layout: { x: 501, width: 500 } } });
    });
    expect(screen.getByTestId('detail-offset').textContent).toBe('501');
  });

  it('clears the active offset immediately while the detail pane is fullscreen', () => {
    render(
      <TableSplitViewContainer
        mainRouter={null}
        detailRouter={<DetailFullscreenControls />}
      />,
    );
    measureSplit();

    fireEvent.click(screen.getByText('Enter fullscreen'));
    act(() =>
      mockDetailOnLayout?.({ nativeEvent: { layout: { x: 0, width: 842 } } }),
    );
    expect(screen.getByTestId('detail-offset').textContent).toBe('0');
    fireEvent.click(screen.getByText('Exit fullscreen'));
    expect(screen.getByTestId('detail-offset').textContent).toBe('421.5');
  });

  it.each(['folded', 'onboarding'])(
    'clears the offset when %s hides the main pane',
    (mode) => {
      const element = (
        <TableSplitViewContainer
          mainRouter={null}
          detailRouter={<DetailFullscreenControls />}
        />
      );
      const { rerender } = render(element);
      measureSplit();

      mockIsSplitView = mode !== 'folded';
      mockIsOnBoardingOpen = mode === 'onboarding';
      rerender(
        <TableSplitViewContainer
          mainRouter={null}
          detailRouter={<DetailFullscreenControls />}
        />,
      );
      act(() =>
        mockDetailOnLayout?.({ nativeEvent: { layout: { x: 0, width: 842 } } }),
      );
      expect(screen.getByTestId('detail-offset').textContent).toBe('0');
      mockIsSplitView = true;
      mockIsOnBoardingOpen = false;
      rerender(element);
      expect(screen.getByTestId('detail-offset').textContent).toBe('421.5');
    },
  );

  it('does not register layout measurement or provide an offset on iOS', () => {
    mockIsNativeAndroid = false;
    render(
      <TableSplitViewContainer
        mainRouter={null}
        detailRouter={<DetailFullscreenControls />}
      />,
    );
    expect(mockDetailOnLayout).toBeUndefined();
    expect(mockContainerOnLayout).toBeUndefined();
    expect(screen.getByTestId('detail-offset').textContent).toBe('0');
  });

  it('measures the same logical start offset when the RTL detail pane is at x=0', () => {
    render(
      <TableSplitViewContainer
        mainRouter={null}
        detailRouter={<DetailFullscreenControls />}
      />,
    );
    measureSplit(0);
    expect(screen.getByTestId('detail-offset').textContent).toBe('421.5');
  });

  it('handles detail layout arriving before container layout', () => {
    render(
      <TableSplitViewContainer
        mainRouter={null}
        detailRouter={<DetailFullscreenControls />}
      />,
    );
    act(() =>
      mockDetailOnLayout?.({ nativeEvent: { layout: { x: 0, width: 420.5 } } }),
    );
    expect(screen.getByTestId('detail-offset').textContent).toBe('0');
    act(() =>
      mockContainerOnLayout?.({
        nativeEvent: { layout: { x: 0, width: 842 } },
      }),
    );
    expect(screen.getByTestId('detail-offset').textContent).toBe('421.5');
  });
});
