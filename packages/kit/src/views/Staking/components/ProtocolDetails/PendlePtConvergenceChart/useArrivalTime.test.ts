/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import { useArrivalTime } from './useArrivalTime';

describe('useArrivalTime', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('keeps the mount time while the data stays the same', () => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(1000);
    const data = { currentRate: 0.9947 };
    const { result, rerender } = renderHook(
      ({ value }) => useArrivalTime(value),
      { initialProps: { value: data } },
    );
    expect(result.current).toBe(1000);

    clock.mockReturnValue(5000);
    rerender({ value: data });
    expect(result.current).toBe(1000);
  });

  it('takes the time again when a refresh brings new data', () => {
    const clock = jest.spyOn(Date, 'now').mockReturnValue(1000);
    const { result, rerender } = renderHook(
      ({ value }) => useArrivalTime(value),
      { initialProps: { value: { currentRate: 0.9947 } } },
    );

    clock.mockReturnValue(5000);
    // Same numbers, new response object: still a refresh.
    rerender({ value: { currentRate: 0.9947 } });
    expect(result.current).toBe(5000);
  });
});
