/** @jest-environment jsdom */

import type { PropsWithChildren } from 'react';

import { render } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ToastOverlayContainer } from './ToastOverlayContainer.native';

const mockState = {
  locked: false,
  toasts: [] as Array<{ id: string; createdAt: number; visible: boolean }>,
};

jest.mock('@backpackapp-io/react-native-toast', () => ({
  useToasterStore: () => ({ toasts: mockState.toasts }),
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/passwordLock', () => ({
  useAppIsLockedAtom: () => [mockState.locked],
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNativeIOS: true },
}));

jest.mock('@onekeyhq/components', () => ({
  OverlayContainer: ({
    children,
    bringToFrontToken,
  }: PropsWithChildren<{ bringToFrontToken?: number }>) => (
    <div data-testid="overlay" data-raise-token={bringToFrontToken}>
      {children}
    </div>
  ),
}));

describe('iOS toast window ordering', () => {
  beforeEach(() => {
    mockState.locked = false;
    mockState.toasts = [];
    platformEnv.isNativeIOS = true;
  });

  it('raises the existing overlay for each newly shown toast without remounting it', () => {
    const view = render(<ToastOverlayContainer />);
    const overlay = view.getByTestId('overlay');
    expect(overlay.getAttribute('data-raise-token')).toBe('0');
    mockState.toasts = [{ id: 'saved', createdAt: 1, visible: true }];
    view.rerender(<ToastOverlayContainer />);
    expect(view.getByTestId('overlay')).toBe(overlay);
    expect(overlay.getAttribute('data-raise-token')).toBe('1');
    mockState.toasts = [
      ...mockState.toasts,
      { id: 'next', createdAt: 2, visible: true },
    ];
    view.rerender(<ToastOverlayContainer />);
    expect(overlay.getAttribute('data-raise-token')).toBe('2');
  });

  it('ignores layout updates and dismissals but raises a reused toast ID', () => {
    mockState.toasts = [{ id: 'saved', createdAt: 1, visible: true }];
    const view = render(<ToastOverlayContainer />);
    mockState.toasts = mockState.toasts.map((toast) => ({ ...toast }));
    view.rerender(<ToastOverlayContainer />);
    expect(view.getByTestId('overlay').getAttribute('data-raise-token')).toBe(
      '1',
    );
    mockState.toasts = [{ id: 'saved', createdAt: 1, visible: false }];
    view.rerender(<ToastOverlayContainer />);
    expect(view.getByTestId('overlay').getAttribute('data-raise-token')).toBe(
      '1',
    );
    mockState.toasts = [{ id: 'saved', createdAt: 2, visible: true }];
    view.rerender(<ToastOverlayContainer />);
    expect(view.getByTestId('overlay').getAttribute('data-raise-token')).toBe(
      '2',
    );
  });

  it('preserves the hardware stage raise token', () => {
    const view = render(<ToastOverlayContainer bringToFrontToken={3} />);
    mockState.toasts = [{ id: 'saved', createdAt: 1, visible: true }];
    view.rerender(<ToastOverlayContainer bringToFrontToken={3} />);
    expect(view.getByTestId('overlay').getAttribute('data-raise-token')).toBe(
      '4',
    );
    view.rerender(<ToastOverlayContainer bringToFrontToken={4} />);
    expect(view.getByTestId('overlay').getAttribute('data-raise-token')).toBe(
      '5',
    );
  });

  it('does not raise notifications above the lock screen or replay them on unlock', () => {
    const view = render(<ToastOverlayContainer />);
    mockState.locked = true;
    mockState.toasts = [{ id: 'saved', createdAt: 1, visible: true }];
    view.rerender(<ToastOverlayContainer />);
    expect(view.getByTestId('overlay').getAttribute('data-raise-token')).toBe(
      '0',
    );
    mockState.locked = false;
    view.rerender(<ToastOverlayContainer />);
    expect(view.getByTestId('overlay').getAttribute('data-raise-token')).toBe(
      '0',
    );
    mockState.toasts = [{ id: 'new', createdAt: 2, visible: true }];
    view.rerender(<ToastOverlayContainer />);
    expect(view.getByTestId('overlay').getAttribute('data-raise-token')).toBe(
      '1',
    );
  });

  it('does not change Android window ordering', () => {
    platformEnv.isNativeIOS = false;
    mockState.toasts = [{ id: 'saved', createdAt: 1, visible: true }];
    const view = render(<ToastOverlayContainer bringToFrontToken={3} />);
    expect(view.getByTestId('overlay').getAttribute('data-raise-token')).toBe(
      '3',
    );
  });
});
