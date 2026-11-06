/** @jest-environment jsdom */

import { useRef } from 'react';
import type { PropsWithChildren } from 'react';

import { render } from '@testing-library/react';

let reducedMotion = false;
const timing = jest.fn((value: number) => value);
const cancel = jest.fn();
const Box = ({ children }: PropsWithChildren) => <div>{children}</div>;

jest.mock('@onekeyhq/components', () => ({
  SizableText: Box,
  Stack: Box,
  XStack: Box,
  getFontToken: () => ({ lineHeight: 24 }),
}));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: Box },
  Easing: { cubic: 'cubic', out: (easing: string) => easing },
  useReducedMotion: () => reducedMotion,
  useSharedValue: (value: number) => useRef({ value }).current,
  useAnimatedStyle: (callback: () => unknown) => callback(),
  withTiming: timing,
  cancelAnimation: cancel,
}));

const { RollingNumberText } = jest.requireActual<typeof import('.')>('.');

beforeEach(() => {
  reducedMotion = false;
  jest.clearAllMocks();
});

it('only rolls changed digits with a 400ms transition', () => {
  const { rerender } = render(<RollingNumberText>$123.45</RollingNumberText>);
  timing.mockClear();
  rerender(<RollingNumberText>$123.46</RollingNumberText>);

  expect(timing).toHaveBeenCalledTimes(1);
  expect(timing).toHaveBeenCalledWith(-6 * 24, {
    duration: 400,
    easing: 'cubic',
  });
});

it('preserves decimal columns when the integer gains a digit', () => {
  const { rerender } = render(<RollingNumberText>$9.99</RollingNumberText>);
  timing.mockClear();
  cancel.mockClear();
  rerender(<RollingNumberText>$10.99</RollingNumberText>);

  expect(timing).toHaveBeenCalledTimes(2);
  expect(cancel).toHaveBeenCalledTimes(1);
});

it('unmounts all previous digits immediately when assets are hidden', () => {
  const { container, rerender } = render(
    <RollingNumberText>-$123.45 (-6.78%)</RollingNumberText>,
  );
  rerender(<RollingNumberText>****</RollingNumberText>);

  expect(container.textContent).toBe('****');
  expect(cancel).toHaveBeenCalledTimes(8);
});

it('renders exact formatted text without rolling when motion is reduced', () => {
  reducedMotion = true;
  const { container, rerender } = render(
    <RollingNumberText>+$1.234,56 (+2,34%)</RollingNumberText>,
  );
  expect(container.textContent).toBe('+$1.234,56 (+2,34%)');
  rerender(<RollingNumberText>-$1.234,57 (-2,35%)</RollingNumberText>);
  expect(container.textContent).toBe('-$1.234,57 (-2,35%)');
  expect(timing).not.toHaveBeenCalled();
});

it('renders unavailable values without retaining numeric strips', () => {
  const { container, rerender } = render(
    <RollingNumberText>$1</RollingNumberText>,
  );
  rerender(<RollingNumberText>--</RollingNumberText>);
  expect(container.textContent).toBe('--');
});

it('cancels rolling and displays chart-selected values immediately', () => {
  const { container, rerender } = render(
    <RollingNumberText>$123.45</RollingNumberText>,
  );
  timing.mockClear();
  rerender(<RollingNumberText animated={false}>$110.25</RollingNumberText>);
  expect(container.textContent).toBe('$110.25');
  expect(cancel).toHaveBeenCalledTimes(5);
  rerender(<RollingNumberText animated={false}>$111.26</RollingNumberText>);
  expect(container.textContent).toBe('$111.26');
  expect(timing).not.toHaveBeenCalled();

  rerender(<RollingNumberText>$123.45</RollingNumberText>);
  timing.mockClear();
  rerender(<RollingNumberText>$123.46</RollingNumberText>);
  expect(timing).toHaveBeenCalledTimes(1);
});
