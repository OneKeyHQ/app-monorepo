/**
 * @jest-environment jsdom
 */

import type { ReactNode } from 'react';

import { act, fireEvent, render } from '@testing-library/react';

import { TradingViewNativeSubIndicatorPriceAxis } from './TradingViewNativeSubIndicatorPriceAxis';
import { createTradingViewNativeWebPriceScaleModel } from './useTradingViewNativePriceScale';

import type { ITradingViewNativeWebPriceScaleModel } from './useTradingViewNativePriceScale';

jest.mock('@onekeyhq/components', () => ({
  SizableText: ({ children }: { children?: ReactNode }) => children,
  XStack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Stack: ({
    children,
    onPress,
    testID,
    ...props
  }: {
    children?: ReactNode;
    onPress?: () => void;
    testID?: string;
    'aria-pressed'?: boolean;
    'aria-disabled'?: boolean;
  }) => (
    <button
      type="button"
      data-testid={testID}
      onClick={onPress}
      aria-pressed={props['aria-pressed']}
      disabled={props['aria-disabled']}
    >
      {children}
    </button>
  ),
}));

function setup() {
  const models = [
    {
      ...createTradingViewNativeWebPriceScaleModel(),
      autoPriceRange: { minPrice: -10, maxPrice: 20 },
    },
    {
      ...createTradingViewNativeWebPriceScaleModel(),
      autoPriceRange: { minPrice: 1, maxPrice: 100 },
    },
  ];
  const renderCurrentChart = jest.fn();
  const renderWithCrosshairHidden = jest.fn();
  const wheelHandlers = new Map<
    ITradingViewNativeWebPriceScaleModel,
    (deltaY: number) => void
  >();
  const screen = render(
    <>
      {models.map((model, index) => (
        <TradingViewNativeSubIndicatorPriceAxis
          key={index === 0 ? 'macd' : 'rsi'}
          backgroundColor="#fff"
          height={100}
          isLogScaleAvailable={index === 1}
          model={model}
          onActivate={jest.fn()}
          renderCurrentChart={renderCurrentChart}
          renderWithCrosshairHidden={renderWithCrosshairHidden}
          testID={`axis-${index}`}
          top={100 + index * 100}
          width={60}
          wheelHandlers={wheelHandlers}
        />
      ))}
    </>,
  );
  const axes = models.map((_model, index) => {
    const axis = screen.getByTestId(`axis-${index}`);
    Object.defineProperties(axis, {
      getBoundingClientRect: {
        value: () => ({
          top: 100 + index * 100,
          height: 100,
          left: 300,
          right: 360,
          bottom: 200 + index * 100,
        }),
      },
      setPointerCapture: { value: jest.fn() },
      hasPointerCapture: { value: () => true },
      releasePointerCapture: { value: jest.fn() },
    });
    return axis;
  });
  return {
    models,
    axes,
    renderCurrentChart,
    renderWithCrosshairHidden,
    screen,
    wheelHandlers,
  };
}

function pointer(
  axis: HTMLElement,
  type: string,
  y: number,
  pointerId = 1,
  button = 0,
) {
  fireEvent(
    axis,
    Object.assign(new Event(type, { bubbles: true, cancelable: true }), {
      button,
      clientX: 330,
      clientY: y,
      pointerId,
    }),
  );
}

describe('indicator price-axis interaction', () => {
  it('keeps A/L controls independent, updates Auto after scrolling, and preserves logarithmic mode on reset', () => {
    const { models, axes, screen, wheelHandlers } = setup();
    const auto = screen.getByTestId('axis-1-price-scale-auto');
    const log = screen.getByTestId('axis-1-price-scale-log');
    expect(auto.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(log);
    expect(models[1].mode).toBe('logarithmic');
    act(() => wheelHandlers.get(models[1])?.(1));
    expect(auto.getAttribute('aria-pressed')).toBe('false');
    expect(models[1].pinnedPriceRange).toEqual({ minPrice: 1, maxPrice: 100 });
    fireEvent.click(auto);
    expect(models[1].pinnedPriceRange).toBeNull();
    expect(models[1].rangeScale).toBe(1);
    fireEvent.click(auto);
    expect(models[1].pinnedPriceRange).not.toBeNull();
    fireEvent.doubleClick(axes[1]);
    expect(auto.getAttribute('aria-pressed')).toBe('true');
    expect(models[1].mode).toBe('logarithmic');
    fireEvent.click(screen.getByTestId('axis-0-price-scale-log'));
    expect(models[0].mode).toBe('linear');
    expect(models[0].pinnedPriceRange).toBeNull();
  });
  it('scales only the dragged pane, keeps its pinned range, and restores auto scale on double click', () => {
    const { models, axes, renderCurrentChart, renderWithCrosshairHidden } =
      setup();
    pointer(axes[0], 'pointerdown', 150);
    pointer(axes[0], 'pointermove', 180);
    pointer(axes[0], 'pointerup', 180);
    expect(models[0].rangeScale).toBeGreaterThan(1);
    expect(models[0].pinnedPriceRange).toEqual({ minPrice: -10, maxPrice: 20 });
    expect(models[1].pinnedPriceRange).toBeNull();
    expect(models[1].rangeScale).toBe(1);
    models[0].autoPriceRange = { minPrice: -30, maxPrice: 50 };
    pointer(axes[0], 'pointerdown', 150);
    pointer(axes[0], 'pointermove', 140);
    pointer(axes[0], 'pointerup', 140);
    expect(models[0].pinnedPriceRange).toEqual({ minPrice: -10, maxPrice: 20 });
    fireEvent.doubleClick(axes[0]);
    expect(models[0].pinnedPriceRange).toBeNull();
    expect(models[0].rangeScale).toBe(1);
    expect(models[0].autoPriceRange).toEqual({ minPrice: -30, maxPrice: 50 });
    expect(renderCurrentChart).toHaveBeenCalledTimes(2);
    expect(renderWithCrosshairHidden).toHaveBeenCalled();
  });

  it('ignores clicks, unrelated pointers, and movement after cancellation', () => {
    const { models, axes } = setup();
    pointer(axes[1], 'pointerdown', 250);
    pointer(axes[1], 'pointermove', 253);
    pointer(axes[1], 'pointermove', 270, 2);
    expect(models[1].pinnedPriceRange).toBeNull();
    pointer(axes[1], 'pointermove', 270);
    const scale = models[1].rangeScale;
    pointer(axes[1], 'pointercancel', 270);
    pointer(axes[1], 'pointermove', 290);
    expect(models[1].rangeScale).toBe(scale);
    pointer(axes[1], 'pointerdown', 250, 1, 2);
    pointer(axes[1], 'pointermove', 290);
    expect(models[1].rangeScale).toBe(scale);
  });
});
