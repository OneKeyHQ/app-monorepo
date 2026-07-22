/**
 * @jest-environment jsdom
 */

import { StrictMode } from 'react';

import { act, renderHook } from '@testing-library/react';

import {
  normalizeDeviceBrightness,
  useDeviceBrightnessSlider,
} from './DeviceBrightnessSlider';

describe('DeviceBrightnessSlider', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const tick = async (ms: number) => {
    await act(async () => {
      jest.advanceTimersByTime(ms);
      await Promise.resolve();
      await Promise.resolve();
    });
  };

  it('clamps and rounds brightness to the supported range', () => {
    expect(normalizeDeviceBrightness(9.6)).toBe(10);
    expect(normalizeDeviceBrightness(67.6)).toBe(68);
    expect(normalizeDeviceBrightness(100.4)).toBe(100);
  });

  it('updates immediately and commits only the trailing value', async () => {
    const onCommit = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useDeviceBrightnessSlider({ value: 50, onCommit }),
    );

    act(() => {
      result.current.handleChange(61.2);
      result.current.handleChange(72.8);
    });

    expect(result.current.displayValue).toBe(73);
    expect(onCommit).not.toHaveBeenCalled();

    await tick(299);
    expect(onCommit).not.toHaveBeenCalled();

    await tick(1);
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(73);
  });

  it('flushes the final value when sliding completes', async () => {
    const onCommit = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useDeviceBrightnessSlider({ value: 40, onCommit }),
    );

    act(() => {
      result.current.handleChange(84.6);
      result.current.handleSlideComplete();
    });
    await tick(0);

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(85);
  });

  it('cancels a pending write when unmounted', async () => {
    const onCommit = jest.fn().mockResolvedValue(undefined);
    const { result, unmount } = renderHook(() =>
      useDeviceBrightnessSlider({ value: 50, onCommit }),
    );

    act(() => {
      result.current.handleChange(70);
    });
    unmount();
    await tick(300);

    expect(onCommit).not.toHaveBeenCalled();
  });

  it('rolls back to the last device value when the latest write fails', async () => {
    const onCommit = jest.fn().mockRejectedValue(new Error('write failed'));
    const { result } = renderHook(() =>
      useDeviceBrightnessSlider({ value: 40, onCommit }),
    );

    act(() => {
      result.current.handleChange(80);
      result.current.handleSlideComplete();
    });
    await tick(0);

    expect(result.current.displayValue).toBe(40);
  });

  it('keeps failure rollback active under React StrictMode', async () => {
    const onCommit = jest.fn().mockRejectedValue(new Error('write failed'));
    const { result } = renderHook(
      () => useDeviceBrightnessSlider({ value: 30, onCommit }),
      {
        wrapper: ({ children }) => <StrictMode>{children}</StrictMode>,
      },
    );

    act(() => {
      result.current.handleChange(90);
      result.current.handleSlideComplete();
    });
    await tick(0);

    expect(result.current.displayValue).toBe(30);
  });
});
