/** @jest-environment jsdom */

import type { PropsWithChildren } from 'react';

import { render, screen } from '@testing-library/react';

import { NativePopoverOverlay } from './NativePopoverOverlay';

jest.mock('../../hocs', () => ({
  Portal: {
    Body: ({
      children,
      container,
    }: PropsWithChildren<{ container: string }>) => (
      <div data-testid="portal" data-container={container}>
        {children}
      </div>
    ),
    Constant: {
      FULL_WINDOW_OVERLAY_PORTAL: 'FULL_WINDOW_OVERLAY_PORTAL',
    },
  },
}));

jest.mock('../../layouts/OverlayContainer', () => ({
  OverlayContainer: ({
    children,
    bringToFrontToken,
  }: PropsWithChildren<{ bringToFrontToken?: number }>) => (
    <div data-testid="overlay" data-raise-token={bringToFrontToken}>
      {children}
    </div>
  ),
}));

describe('NativePopoverOverlay', () => {
  it('hosts the sheet in a full-window overlay and raises it on each open', () => {
    const view = render(
      <NativePopoverOverlay active>
        <span>sheet</span>
      </NativePopoverOverlay>,
    );

    expect(screen.getByTestId('portal').getAttribute('data-container')).toBe(
      'FULL_WINDOW_OVERLAY_PORTAL',
    );
    expect(screen.getByText('sheet')).toBeTruthy();

    const firstToken = Number(
      screen.getByTestId('overlay').getAttribute('data-raise-token'),
    );
    expect(firstToken).toBeGreaterThan(0);

    view.rerender(
      <NativePopoverOverlay active={false}>
        <span>sheet</span>
      </NativePopoverOverlay>,
    );
    expect(screen.getByTestId('overlay').getAttribute('data-raise-token')).toBe(
      String(firstToken),
    );

    view.rerender(
      <NativePopoverOverlay active>
        <span>sheet</span>
      </NativePopoverOverlay>,
    );
    expect(
      Number(screen.getByTestId('overlay').getAttribute('data-raise-token')),
    ).toBeGreaterThan(firstToken);
  });

  it('does not consume a raise token until the sheet becomes active', () => {
    const view = render(
      <NativePopoverOverlay active={false}>
        <span>sheet</span>
      </NativePopoverOverlay>,
    );

    expect(screen.getByTestId('overlay').getAttribute('data-raise-token')).toBe(
      '0',
    );

    view.rerender(
      <NativePopoverOverlay active>
        <span>sheet</span>
      </NativePopoverOverlay>,
    );
    expect(
      Number(screen.getByTestId('overlay').getAttribute('data-raise-token')),
    ).toBeGreaterThan(0);
  });
});
