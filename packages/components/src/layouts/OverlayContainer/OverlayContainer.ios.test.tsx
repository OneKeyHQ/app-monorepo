/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { act, render, screen } from '@testing-library/react';

import {
  dismissNativeStorageRecovery,
  requestNativeStorageRecovery,
} from '@onekeyhq/shared/src/storage/nativeStorageRecovery';

import { OverlayContainer } from './OverlayContainer.ios';

jest.mock('react-native', () => ({
  StyleSheet: {
    create: (styles: unknown) => styles,
    absoluteFill: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
  },
  View: ({
    children,
    style,
    pointerEvents,
    accessibilityElementsHidden,
  }: {
    children?: ReactNode;
    style: import('react').CSSProperties;
    pointerEvents?: string;
    accessibilityElementsHidden?: boolean;
  }) => (
    <div
      data-testid="window-content"
      style={style}
      data-pointer-events={pointerEvents}
      aria-hidden={accessibilityElementsHidden}
    >
      {children}
    </div>
  ),
}));
jest.mock('react-native-screens', () => ({
  FullWindowOverlay: ({
    children,
    bringToFrontToken,
  }: {
    children?: ReactNode;
    bringToFrontToken?: number;
  }) => (
    <div data-testid="native-window" data-raise-token={bringToFrontToken}>
      {children}
    </div>
  ),
}));

it('hides the real native window contents during recovery without unmounting them, including later window raises', () => {
  dismissNativeStorageRecovery();
  const view = render(
    <OverlayContainer bringToFrontToken={1}>
      <input data-testid="retained-overlay-input" />
    </OverlayContainer>,
  );
  const input = screen.getByTestId(
    'retained-overlay-input',
  ) as HTMLInputElement;
  input.value = 'retained local state';
  act(() => requestNativeStorageRecovery('appStorage'));
  expect(screen.getByTestId('window-content').style.display).toBe('none');
  expect(
    screen.getByTestId('window-content').getAttribute('data-pointer-events'),
  ).toBe('none');
  expect(screen.getByTestId('window-content').getAttribute('aria-hidden')).toBe(
    'true',
  );
  view.rerender(
    <OverlayContainer bringToFrontToken={2}>
      <input data-testid="retained-overlay-input" />
    </OverlayContainer>,
  );
  expect(
    screen.getByTestId('native-window').getAttribute('data-raise-token'),
  ).toBe('2');
  expect(screen.getByTestId('window-content').style.display).toBe('none');
  act(() => dismissNativeStorageRecovery());
  expect(screen.getByTestId('retained-overlay-input')).toBe(input);
  expect(input.value).toBe('retained local state');
  expect(screen.getByTestId('window-content').style.display).toBe('');
  expect(
    screen.getByTestId('window-content').getAttribute('data-pointer-events'),
  ).toBe('box-none');
});
