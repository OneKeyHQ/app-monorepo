/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';

import { useCopyButtonKeyboardFocus } from './useCopyButtonKeyboardFocus';

function FocusHarness() {
  const { isKeyboardFocused, focusProps } = useCopyButtonKeyboardFocus();
  return (
    <>
      <button type="button" {...focusProps}>
        Copy
      </button>
      <output>{isKeyboardFocused ? 'revealed' : 'resting'}</output>
    </>
  );
}

afterEach(() => jest.restoreAllMocks());

test('reveals keyboard focus and restores the name on blur', () => {
  render(<FocusHarness />);
  const copy = screen.getByRole('button', { name: 'Copy' });
  jest.spyOn(copy, 'matches').mockReturnValue(true);

  fireEvent.focus(copy);
  expect(screen.getByRole('status').textContent).toBe('revealed');
  fireEvent.blur(copy);
  expect(screen.getByRole('status').textContent).toBe('resting');
});

test('keeps mouse focus resting and clears an existing keyboard reveal on pointer down', () => {
  render(<FocusHarness />);
  const copy = screen.getByRole('button', { name: 'Copy' });
  const matches = jest.spyOn(copy, 'matches').mockReturnValue(false);

  fireEvent.focus(copy);
  expect(screen.getByRole('status').textContent).toBe('resting');
  matches.mockReturnValue(true);
  fireEvent.keyDown(copy, { key: 'Enter' });
  expect(screen.getByRole('status').textContent).toBe('revealed');
  fireEvent.pointerDown(copy);
  expect(screen.getByRole('status').textContent).toBe('resting');
});
