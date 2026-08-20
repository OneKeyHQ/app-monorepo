/**
 * @jest-environment jsdom
 */

import type { ReactNode } from 'react';

import { TableSplitViewContainer, useSetSplitViewDetailFullscreen } from '.';
import { fireEvent, render, screen } from '@testing-library/react';

let mockIsSplitView = true;
let mockIsOnBoardingOpen = false;

jest.mock('@onekeyhq/components', () => ({
  Divider: ({ display }: { display?: string }) => (
    <div data-display={display} data-testid="split-divider" />
  ),
  XStack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  YStack: ({
    children,
    display,
  }: {
    children?: ReactNode;
    display?: string;
  }) => <div data-display={display}>{children}</div>,
  useIsSplitView: () => mockIsSplitView,
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/onboarding', () => ({
  useIsOnBoardingOpenAtom: () => [mockIsOnBoardingOpen],
}));

function DetailFullscreenControls() {
  const setDetailFullscreen = useSetSplitViewDetailFullscreen();
  return (
    <>
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
});
