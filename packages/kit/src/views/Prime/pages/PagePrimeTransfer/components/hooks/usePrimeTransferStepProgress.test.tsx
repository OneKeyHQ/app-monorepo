/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import {
  PRIME_TRANSFER_PROGRESS_STEP_MS,
  usePrimeTransferStepProgress,
} from './usePrimeTransferStepProgress';

type IProps = Parameters<typeof usePrimeTransferStepProgress>[0];

function renderProgress(initialProps: IProps) {
  const visible: (number | undefined)[] = [];
  const hook = renderHook(
    (props: IProps) => {
      const value = usePrimeTransferStepProgress(props);
      visible.push(value);
      return value;
    },
    { initialProps },
  );
  return { ...hook, visible };
}

function tick(times = 1) {
  for (let i = 0; i < times; i += 1) {
    act(() => {
      jest.advanceTimersByTime(PRIME_TRANSFER_PROGRESS_STEP_MS);
    });
  }
}

function expectSingleSteps(values: (number | undefined)[]) {
  const numbers = values.filter((v): v is number => v !== undefined);
  numbers.slice(1).forEach((value, index) => {
    expect(value - numbers[index]).toBeGreaterThanOrEqual(0);
    expect(value - numbers[index]).toBeLessThanOrEqual(1);
  });
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

test('catches up from 20% to a 40% target in about one second, then pauses', () => {
  const { result, rerender, visible } = renderProgress({
    phaseKey: 'preparation:task',
    target: 20,
  });
  tick(20);
  expect(result.current).toBe(20);
  rerender({ phaseKey: 'preparation:task', target: 40 });
  tick(19);
  expect(result.current).toBe(39);
  tick();
  expect(result.current).toBe(40);
  tick(10);
  expect(result.current).toBe(40);
  expect(jest.getTimerCount()).toBe(0);
  rerender({ phaseKey: 'preparation:task', target: 42 });
  tick(2);
  expect(result.current).toBe(42);
  expectSingleSteps(visible);
});

test.each([
  [0, 10],
  [10, 40],
  [40, 80],
])('a target jump from %i to %i is shown one point at a time', (from, to) => {
  const { result, rerender, visible } = renderProgress({
    phaseKey: 'network:sending:task',
    target: from,
  });
  tick(from);
  expect(result.current).toBe(from);
  rerender({ phaseKey: 'network:sending:task', target: to });
  tick(to - from);
  expect(result.current).toBe(to);
  expectSingleSteps(visible);
});

test('a blocked thread resumes with one step, not a burst', () => {
  const { result } = renderProgress({
    phaseKey: 'preparation:task',
    target: 80,
  });
  act(() => {
    jest.advanceTimersByTime(PRIME_TRANSFER_PROGRESS_STEP_MS * 10);
  });
  expect(result.current).toBe(1);
});

test('never passes 99% before completion, then jumps straight to 100%', () => {
  const { result, rerender } = renderProgress({
    phaseKey: 'network:sending:task',
    target: 100,
  });
  tick(5);
  expect(result.current).toBe(5);
  rerender({ phaseKey: 'network:sending:task', target: 100, completed: true });
  expect(result.current).toBe(100);
  expect(jest.getTimerCount()).toBe(0);

  const unfinished = renderProgress({
    phaseKey: 'network:sending:other',
    target: 100,
  });
  tick(150);
  expect(unfinished.result.current).toBe(99);
});

test('a new phase restarts at 0% and pending steps from the old phase cannot advance it', () => {
  const { result, rerender, visible } = renderProgress({
    phaseKey: 'preparation:task',
    target: 100,
    completed: true,
  });
  expect(result.current).toBe(100);
  rerender({ phaseKey: 'network:sending:task', target: 30 });
  expect(result.current).toBe(0);
  tick(3);
  expect(result.current).toBe(3);

  rerender({ phaseKey: 'preparation:next-task', target: 50 });
  expect(result.current).toBe(0);
  tick();
  expect(result.current).toBe(1);
  expect(visible.at(-1)).toBe(1);
});

test('indeterminate progress has no percentage', () => {
  const { result } = renderProgress({
    phaseKey: 'network:sending:task',
    target: undefined,
  });
  tick(5);
  expect(result.current).toBeUndefined();
  expect(jest.getTimerCount()).toBe(0);
});

test('unmounting clears the pending step', () => {
  const { unmount } = renderProgress({
    phaseKey: 'preparation:task',
    target: 50,
  });
  expect(jest.getTimerCount()).toBe(1);
  unmount();
  expect(jest.getTimerCount()).toBe(0);
});
