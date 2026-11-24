/** @jest-environment jsdom */

import type { MouseEventHandler } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { NavCloseButton } from './HeaderBackButton';

jest.mock('../../../primitives', () => ({
  ButtonFrame: ({ onPress }: { onPress: MouseEventHandler }) => (
    <button type="button" onClick={onPress}>
      Close
    </button>
  ),
  Icon: () => null,
  getSharedButtonStyles: () => ({}),
}));
jest.mock('../../../primitives/Button/GlassHeaderContext', () => ({
  useInGlassHeader: () => true,
}));
jest.mock('../../../utils/getFontSize', () => ({}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { ui: { button: { click: jest.fn() } } },
}));

afterEach(() => {
  jest.useRealTimers();
});

it('closes on the first press and ignores repeated presses during dismissal', () => {
  jest.useFakeTimers();
  const goBack = jest.fn();
  const nextGoBack = jest.fn();
  const { rerender } = render(<NavCloseButton onPress={goBack} />);
  const close = screen.getByRole('button');

  fireEvent.click(close);
  expect(goBack).toHaveBeenCalledTimes(1);

  jest.advanceTimersByTime(200);
  rerender(<NavCloseButton onPress={nextGoBack} />);
  fireEvent.click(close);
  jest.advanceTimersByTime(300);
  expect(goBack).toHaveBeenCalledTimes(1);
  expect(nextGoBack).not.toHaveBeenCalled();

  fireEvent.click(close);
  expect(nextGoBack).toHaveBeenCalledTimes(1);
});
