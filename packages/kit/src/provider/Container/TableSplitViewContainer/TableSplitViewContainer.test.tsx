/**
 * @jest-environment jsdom
 */

import type { ReactNode } from 'react';

import { TableSplitViewContainer, useSetSplitViewDetailFullscreen } from '.';

import { act, fireEvent, render, screen } from '@testing-library/react';

import { useSplitViewDetailOffset } from './SplitViewDetailOffsetContext';

let mockIsSplitView = true;
let mockIsOnBoardingOpen = false;
let mockIsNativeAndroid = true;
let mockDetailOnLayout:
  | ((event: { nativeEvent: { layout: { x: number } } }) => void)
  | undefined;

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
  XStack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
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
    mockIsNativeAndroid = true;
    mockDetailOnLayout = undefined;
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
    act(() => mockDetailOnLayout?.({ nativeEvent: { layout: { x: 421.5 } } }));
    expect(screen.getByTestId('detail-offset').textContent).toBe('421.5');
    act(() => mockDetailOnLayout?.({ nativeEvent: { layout: { x: 501 } } }));
    expect(screen.getByTestId('detail-offset').textContent).toBe('501');
  });

  it('clears the active offset immediately while the detail pane is fullscreen', () => {
    render(
      <TableSplitViewContainer
        mainRouter={null}
        detailRouter={<DetailFullscreenControls />}
      />,
    );
    act(() => mockDetailOnLayout?.({ nativeEvent: { layout: { x: 421.5 } } }));

    fireEvent.click(screen.getByText('Enter fullscreen'));
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
      act(() =>
        mockDetailOnLayout?.({ nativeEvent: { layout: { x: 421.5 } } }),
      );

      mockIsSplitView = mode !== 'folded';
      mockIsOnBoardingOpen = mode === 'onboarding';
      rerender(
        <TableSplitViewContainer
          mainRouter={null}
          detailRouter={<DetailFullscreenControls />}
        />,
      );
      expect(screen.getByTestId('detail-offset').textContent).toBe('0');
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
    expect(screen.getByTestId('detail-offset').textContent).toBe('0');
  });
});
