/**
 * @jest-environment jsdom
 */
/* oxlint-disable react-perf/jsx-no-jsx-as-prop, react-perf/jsx-no-new-function-as-prop */

import { Profiler } from 'react';
import type { ReactNode } from 'react';

import { SelectableRow } from '.';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';

jest.mock('react-native', () =>
  jest.requireActual<typeof import('react-native')>('react-native'),
);

jest.mock('react-native-reanimated', () => ({
  useReducedMotion: () => false,
}));

// These layout primitives are not involved in selection; use the real
// React Native Web Pressable so disabled and pointer behavior stay exercised.
jest.mock('../../primitives', () => {
  const { View } =
    jest.requireActual<typeof import('react-native')>('react-native');
  function Box({ children }: { children?: ReactNode }) {
    return <View>{children}</View>;
  }
  return { Stack: Box, XStack: Box };
});

afterEach(cleanup);

it('exposes controlled selection and reports presses to the caller', () => {
  const onSelect = jest.fn();
  const { rerender } = render(
    <SelectableRow
      accessibilityLabel="Sample asset, 5%"
      selected={false}
      onPress={onSelect}
    >
      <span>Sample asset</span>
    </SelectableRow>,
  );

  const row = screen.getByRole('button', { name: 'Sample asset, 5%' });
  expect(row.getAttribute('aria-pressed')).toBe('false');
  fireEvent.click(row);
  expect(onSelect).toHaveBeenCalledTimes(1);
  // Selection is controlled by the caller, not changed by a press alone.
  expect(row.getAttribute('aria-pressed')).toBe('false');

  rerender(
    <SelectableRow
      accessibilityLabel="Sample asset, 5%"
      selected
      onPress={onSelect}
    >
      <span>Sample asset</span>
    </SelectableRow>,
  );
  expect(row.getAttribute('aria-pressed')).toBe('true');
  expect(onSelect).toHaveBeenCalledTimes(1);
});

it('keeps its action independent even when selection is disabled', () => {
  const onSelect = jest.fn();
  const onAction = jest.fn();
  const { rerender } = render(
    <SelectableRow
      accessibilityLabel="Sample asset"
      selected={false}
      onPress={onSelect}
      action={
        <button type="button" onClick={onAction}>
          Details
        </button>
      }
    >
      <span>Sample asset</span>
    </SelectableRow>,
  );

  fireEvent.click(screen.getByRole('button', { name: 'Details' }));
  expect(onAction).toHaveBeenCalledTimes(1);
  expect(onSelect).not.toHaveBeenCalled();

  const row = screen.getByRole('button', { name: 'Sample asset' });
  fireEvent.click(row);
  expect(onSelect).toHaveBeenCalledTimes(1);
  expect(onAction).toHaveBeenCalledTimes(1);

  rerender(
    <SelectableRow
      accessibilityLabel="Sample asset"
      selected={false}
      disabled
      onPress={onSelect}
      action={
        <button type="button" onClick={onAction}>
          Details
        </button>
      }
    >
      <span>Sample asset</span>
    </SelectableRow>,
  );
  expect(row.getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(row);
  expect(onSelect).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Details' }));
  expect(onAction).toHaveBeenCalledTimes(2);
});

it('keeps focus updates within the interacted row', () => {
  const firstCommit = jest.fn();
  const secondCommit = jest.fn();
  const onPress = jest.fn();
  render(
    <>
      <Profiler id="first" onRender={firstCommit}>
        <SelectableRow
          accessibilityLabel="First"
          selected={false}
          onPress={onPress}
        >
          <span>First</span>
        </SelectableRow>
      </Profiler>
      <Profiler id="second" onRender={secondCommit}>
        <SelectableRow
          accessibilityLabel="Second"
          selected={false}
          onPress={onPress}
        >
          <span>Second</span>
        </SelectableRow>
      </Profiler>
    </>,
  );
  firstCommit.mockClear();
  secondCommit.mockClear();

  fireEvent.focus(screen.getByRole('button', { name: 'First' }));
  expect(firstCommit).toHaveBeenCalled();
  expect(secondCommit).not.toHaveBeenCalled();
});
