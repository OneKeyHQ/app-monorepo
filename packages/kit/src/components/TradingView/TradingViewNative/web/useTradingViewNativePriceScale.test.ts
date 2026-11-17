/**
 * @jest-environment jsdom
 */

import type { PointerEvent as ReactPointerEvent } from 'react';

import { act, renderHook } from '@testing-library/react';

import {
  createTradingViewNativeWebPriceScaleModel,
  useTradingViewNativePriceScale,
} from './useTradingViewNativePriceScale';

function createPriceAxisElement() {
  const element = document.createElement('div');
  Object.defineProperties(element, {
    getBoundingClientRect: {
      value: () =>
        ({
          bottom: 220,
          height: 200,
          left: 280,
          right: 320,
          top: 20,
          width: 40,
          x: 280,
          y: 20,
        }) as DOMRect,
    },
    hasPointerCapture: { value: jest.fn(() => false) },
    releasePointerCapture: { value: jest.fn() },
    setPointerCapture: { value: jest.fn() },
  });
  return element;
}

function createPointerEvent({
  button = 0,
  clientY,
  currentTarget,
  pointerId = 1,
}: {
  button?: number;
  clientY: number;
  currentTarget: HTMLDivElement;
  pointerId?: number;
}) {
  return {
    button,
    clientX: 300,
    clientY,
    currentTarget,
    pointerId,
    preventDefault: jest.fn(),
  } as unknown as ReactPointerEvent<HTMLDivElement>;
}

describe('useTradingViewNativePriceScale', () => {
  it('toggles Auto and resets the range only when Auto is re-enabled', () => {
    const modelRef = { current: createTradingViewNativeWebPriceScaleModel() };
    modelRef.current.autoPriceRange = { maxPrice: 20, minPrice: 10 };
    modelRef.current.rangeScale = 2;
    const renderWithCrosshairHidden = jest.fn();
    const { result } = renderHook(() =>
      useTradingViewNativePriceScale({
        isLogScaleAvailable: true,
        modelRef,
        renderCurrentChart: jest.fn(),
        renderWithCrosshairHidden,
      }),
    );

    expect(result.current.isAutoScale).toBe(true);

    act(() => {
      result.current.handleAutoScalePress();
    });
    expect(result.current.isAutoScale).toBe(false);
    expect(modelRef.current.pinnedPriceRange).toEqual({
      maxPrice: 20,
      minPrice: 10,
    });
    expect(modelRef.current.rangeScale).toBe(2);

    modelRef.current.autoPriceRange = { maxPrice: 200, minPrice: 100 };
    act(() => {
      result.current.handleAutoScalePress();
    });
    expect(result.current.isAutoScale).toBe(true);
    expect(modelRef.current.pinnedPriceRange).toBeNull();
    expect(modelRef.current.rangeScale).toBe(1);
    expect(renderWithCrosshairHidden).toHaveBeenCalledTimes(2);
  });

  it('keeps Auto enabled for a click and disables it only after a drag', () => {
    const modelRef = { current: createTradingViewNativeWebPriceScaleModel() };
    modelRef.current.autoPriceRange = { maxPrice: 20, minPrice: 10 };
    const renderCurrentChart = jest.fn();
    const renderWithCrosshairHidden = jest.fn();
    const { result } = renderHook(() =>
      useTradingViewNativePriceScale({
        isLogScaleAvailable: true,
        modelRef,
        renderCurrentChart,
        renderWithCrosshairHidden,
      }),
    );
    const element = createPriceAxisElement();

    act(() => {
      result.current.handlePointerDown(
        createPointerEvent({ clientY: 100, currentTarget: element }),
      );
      result.current.finishPointerDrag(
        createPointerEvent({ clientY: 100, currentTarget: element }),
      );
    });
    expect(result.current.isAutoScale).toBe(true);
    expect(modelRef.current.rangeScale).toBe(1);

    act(() => {
      result.current.handlePointerDown(
        createPointerEvent({ clientY: 100, currentTarget: element }),
      );
      result.current.handlePointerMove(
        createPointerEvent({ clientY: 97, currentTarget: element }),
      );
    });
    expect(result.current.isAutoScale).toBe(true);

    act(() => {
      result.current.handlePointerMove(
        createPointerEvent({ clientY: 90, currentTarget: element }),
      );
    });
    expect(result.current.isAutoScale).toBe(false);
    expect(modelRef.current.pinnedPriceRange).toEqual({
      maxPrice: 20,
      minPrice: 10,
    });
    expect(modelRef.current.rangeScale).not.toBe(1);
    expect(renderCurrentChart).toHaveBeenCalledTimes(1);
  });

  it('returns to linear mode when logarithmic scaling becomes unavailable', () => {
    const modelRef = { current: createTradingViewNativeWebPriceScaleModel() };
    const renderWithCrosshairHidden = jest.fn();
    const { rerender, result } = renderHook(
      ({ isLogScaleAvailable }: { isLogScaleAvailable: boolean }) =>
        useTradingViewNativePriceScale({
          isLogScaleAvailable,
          modelRef,
          renderCurrentChart: jest.fn(),
          renderWithCrosshairHidden,
        }),
      { initialProps: { isLogScaleAvailable: true } },
    );

    act(() => {
      result.current.handleLogScalePress();
    });
    expect(result.current.mode).toBe('logarithmic');
    expect(modelRef.current.mode).toBe('logarithmic');

    rerender({ isLogScaleAvailable: false });
    expect(result.current.mode).toBe('linear');
    expect(modelRef.current.mode).toBe('linear');
    expect(renderWithCrosshairHidden).toHaveBeenCalledTimes(2);
  });
});
