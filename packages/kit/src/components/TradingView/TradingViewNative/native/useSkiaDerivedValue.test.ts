/** @jest-environment jsdom */
// cspell:ignore Skia

import { renderHook } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { useSkiaDerivedValue } from './useSkiaDerivedValue';

const mockStartMapper = jest.fn<number, [() => void, unknown[], unknown[]]>(
  () => 1,
);
const mockStopMapper = jest.fn();

jest.mock('react-native-reanimated', () => ({
  makeMutable: (value: unknown) => ({ value }),
  startMapper: (...args: Parameters<typeof mockStartMapper>) =>
    mockStartMapper(...args),
  stopMapper: (id: number) => {
    mockStopMapper(id);
  },
  useSharedValue: (value: unknown) => ({ value }),
}));

jest.mock('react-native-worklets', () => ({
  scheduleOnRN: (run: () => void) => run(),
}));

it('keeps the last valid mapper output and reports a UI failure once', () => {
  const input = { value: 3 };
  let shouldThrow = false;
  const read = () => {
    if (shouldThrow)
      throw new OneKeyLocalError('Skia failed on the UI runtime');
    return input.value * 2;
  };
  const onSkiaError = jest.fn();
  const { result, unmount } = renderHook(() =>
    useSkiaDerivedValue(read, [input], [], onSkiaError),
  );
  const [mapper, inputs, outputs] = mockStartMapper.mock.calls[0];
  expect(inputs).toEqual([input]);
  expect(outputs).toEqual([result.current]);
  expect(result.current.value).toBe(6);
  input.value = 4;
  mapper();
  expect(result.current.value).toBe(8);

  shouldThrow = true;
  mapper();
  mapper();
  expect(result.current.value).toBe(8);
  expect(onSkiaError).toHaveBeenCalledTimes(1);

  unmount();
  expect(mockStopMapper).toHaveBeenCalledWith(1);
});
