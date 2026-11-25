/** @jest-environment jsdom */

import { render, screen } from '@testing-library/react';

import {
  OverlayPageHostLayoutProvider,
  useOverlayPageHostLayout,
} from './OverlayPageHostLayoutContext';

import type { SafeAreaListenerProps } from 'react-native-safe-area-context';

jest.mock('react-native', () =>
  jest.requireActual<typeof import('react-native')>('react-native'),
);

jest.mock('react-native-safe-area-context', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return {
    // Model Android's provider: pointerEvents on the listener is ignored.
    SafeAreaListener: ({ onChange }: SafeAreaListenerProps) => {
      useEffect(
        () =>
          onChange({
            insets: { top: 0, bottom: 34, left: 0, right: 0 },
            frame: { x: 0, y: 0, width: 400, height: 500 },
          }),
        [onChange],
      );
      return <div data-testid="safe-area-listener" />;
    },
  };
});

function PageContent() {
  const layout = useOverlayPageHostLayout();
  return <button type="button">Bottom inset: {layout?.insets?.bottom}</button>;
}

it('excludes the whole measurement subtree from touches without disabling page controls', () => {
  render(
    <OverlayPageHostLayoutProvider>
      <PageContent />
    </OverlayPageHostLayoutProvider>,
  );
  const listener = screen.getByTestId('safe-area-listener');
  const touchBoundary = listener.parentElement;
  expect(touchBoundary).not.toBeNull();
  expect(getComputedStyle(touchBoundary as HTMLElement).pointerEvents).toBe(
    'none',
  );
  const button = screen.getByRole('button', { name: 'Bottom inset: 34' });
  expect(touchBoundary?.contains(button)).toBe(false);
});
