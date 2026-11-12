/** @jest-environment jsdom */
/* oxlint-disable react-perf/jsx-no-new-function-as-prop -- Callbacks in test fixtures are intentionally recreated for each render. */

import type { ReactNode } from 'react';

import { ok as assert } from 'node:assert/strict';

import { act, fireEvent, render, screen } from '@testing-library/react';

jest.mock('../../primitives', () => ({
  Stack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

const { BannerSwiper } =
  require('./BannerSwiper.web') as typeof import('./BannerSwiper.web');

const originalIntersectionObserver = Object.getOwnPropertyDescriptor(
  globalThis,
  'IntersectionObserver',
);
let initialVisibility: boolean | null = true;
const visibilityObservers: {
  disconnect: jest.Mock<void, []>;
  notify: (visible: boolean) => void;
}[] = [];

function changeVisibility(visible: boolean) {
  const current = visibilityObservers.at(-1);
  assert(current, 'Missing banner visibility observer');
  act(() => current.notify(visible));
}

function pointer(target: EventTarget, type: string, x: number) {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX: x,
    clientY: 40,
  });
  Object.defineProperty(event, 'pointerId', { value: 1 });
  act(() => {
    target.dispatchEvent(event);
  });
}

function setup({
  count = 2,
  autoplay = false,
  autoplayLoop = false,
  autoplayDelayMs = 1000,
} = {}) {
  const onOpen = jest.fn();
  const { container, unmount } = render(
    <BannerSwiper
      data={Array.from({ length: count }, (_, index) => index)}
      autoplay={autoplay}
      autoplayLoop={autoplayLoop}
      autoplayDelayMs={autoplayDelayMs}
      renderItem={({ item }) => (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpen(item);
          }}
        >
          {item}
        </button>
      )}
      renderPagination={({ currentIndex, goToIndex }) => (
        <>
          <output data-testid="index">{currentIndex}</output>
          <button type="button" onClick={() => goToIndex(currentIndex)}>
            Current banner
          </button>
        </>
      )}
    />,
  );
  const viewport = container.firstElementChild?.firstElementChild;
  assert(viewport, 'Missing banner viewport');
  const activeCard = () => {
    const card = container.querySelector<HTMLButtonElement>(
      '[aria-hidden="false"] button',
    );
    assert(card, 'Missing active banner');
    return card;
  };
  return { viewport, activeCard, onOpen, unmount };
}

describe('Banner Web pointer interaction', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    initialVisibility = true;
    visibilityObservers.length = 0;
    Object.defineProperty(globalThis, 'IntersectionObserver', {
      configurable: true,
      writable: true,
      value: jest.fn((callback: IntersectionObserverCallback) => {
        let target: Element | undefined;
        const disconnect = jest.fn<void, []>();
        const observe = jest.fn<void, [Element]>();
        const observer: IntersectionObserver = {
          root: null,
          rootMargin: '0px',
          scrollMargin: '0px',
          thresholds: [0.1],
          observe,
          unobserve: jest.fn(),
          disconnect,
          takeRecords: () => [],
        };
        const notify = (visible: boolean) => {
          assert(target, 'Missing observed banner');
          const bounds = target.getBoundingClientRect();
          callback(
            [
              {
                target,
                isIntersecting: visible,
                intersectionRatio: visible ? 1 : 0,
                boundingClientRect: bounds,
                intersectionRect: bounds,
                rootBounds: null,
                time: performance.now(),
              },
            ],
            observer,
          );
        };
        observe.mockImplementation((element: Element) => {
          target = element;
          if (initialVisibility !== null) notify(initialVisibility);
        });
        visibilityObservers.push({ disconnect, notify });
        return observer;
      }),
    });
    // The shared Jest setup replaces this with a no-op for non-DOM suites.
    const eventTarget: EventTarget = globalThis;
    jest
      .spyOn(eventTarget, 'addEventListener')
      .mockImplementation((...args) =>
        EventTarget.prototype.addEventListener.call(eventTarget, ...args),
      );
    jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      right: 360,
      top: 0,
      bottom: 160,
      width: 360,
      height: 160,
      toJSON: () => ({}),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
    if (originalIntersectionObserver) {
      Object.defineProperty(
        globalThis,
        'IntersectionObserver',
        originalIntersectionObserver,
      );
    } else {
      Reflect.deleteProperty(globalThis, 'IntersectionObserver');
    }
  });

  it('blocks a delayed click after a short drag and allows the next click', () => {
    const { viewport, activeCard, onOpen } = setup();
    pointer(viewport, 'pointerdown', 180);
    pointer(globalThis, 'pointermove', 165);
    pointer(globalThis, 'pointerup', 165);
    act(() => jest.advanceTimersByTime(5000));
    fireEvent.click(activeCard(), { detail: 1 });
    expect(onOpen).not.toHaveBeenCalled();
    expect(screen.getByTestId('index').textContent).toBe('0');

    pointer(viewport, 'pointerdown', 180);
    pointer(globalThis, 'pointerup', 180);
    fireEvent.click(activeCard(), { detail: 1 });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('remembers a drag that returns to its starting point', () => {
    const { viewport, activeCard, onOpen } = setup();
    pointer(viewport, 'pointerdown', 180);
    pointer(globalThis, 'pointermove', 80);
    pointer(globalThis, 'pointermove', 180);
    pointer(globalThis, 'pointerup', 180);
    fireEvent.click(activeCard(), { detail: 1 });
    expect(onOpen).not.toHaveBeenCalled();
    expect(screen.getByTestId('index').textContent).toBe('0');
  });

  it('loops two banners in both directions when released outside the viewport', () => {
    const { viewport } = setup();
    pointer(viewport, 'pointerdown', 180);
    pointer(globalThis, 'pointermove', 600);
    pointer(globalThis, 'pointerup', 600);
    act(() => jest.advanceTimersByTime(350));
    expect(screen.getByTestId('index').textContent).toBe('1');

    pointer(viewport, 'pointerdown', 180);
    pointer(globalThis, 'pointerup', -80);
    act(() => jest.advanceTimersByTime(350));
    expect(screen.getByTestId('index').textContent).toBe('0');
  });

  it('pauses autoplay while pressed and resumes after release', () => {
    const { viewport } = setup({ autoplay: true });
    pointer(viewport, 'pointerdown', 180);
    act(() => jest.advanceTimersByTime(5000));
    expect(screen.getByTestId('index').textContent).toBe('0');
    pointer(globalThis, 'pointerup', 180);
    act(() => jest.advanceTimersByTime(1000));
    expect(screen.getByTestId('index').textContent).toBe('1');
  });

  it('stops autoplay at the last banner when autoplayLoop is false', () => {
    setup({ autoplay: true, autoplayLoop: false });
    act(() => jest.advanceTimersByTime(1000));
    expect(screen.getByTestId('index').textContent).toBe('1');
    act(() => jest.advanceTimersByTime(5000));
    expect(screen.getByTestId('index').textContent).toBe('1');
  });

  it('wraps autoplay when autoplayLoop is true', () => {
    setup({ autoplay: true, autoplayLoop: true });
    act(() => jest.advanceTimersByTime(1000));
    expect(screen.getByTestId('index').textContent).toBe('1');
    act(() => jest.advanceTimersByTime(1000));
    expect(screen.getByTestId('index').textContent).toBe('0');
  });

  it('keeps autoplay running when the current dot is clicked just before its timeout', () => {
    setup({ autoplay: true, autoplayLoop: true, autoplayDelayMs: 3000 });
    act(() => jest.advanceTimersByTime(2800));
    fireEvent.click(screen.getByRole('button', { name: 'Current banner' }));
    act(() => jest.advanceTimersByTime(200));
    expect(screen.getByTestId('index').textContent).toBe('1');
    act(() => jest.advanceTimersByTime(3000));
    expect(screen.getByTestId('index').textContent).toBe('0');
  });

  it('waits for the initial visibility report before starting autoplay', () => {
    initialVisibility = null;
    setup({ autoplay: true, autoplayLoop: true });
    act(() => jest.advanceTimersByTime(5000));
    expect(screen.getByTestId('index').textContent).toBe('0');

    changeVisibility(true);
    act(() => jest.advanceTimersByTime(999));
    expect(screen.getByTestId('index').textContent).toBe('0');
    act(() => jest.advanceTimersByTime(1));
    expect(screen.getByTestId('index').textContent).toBe('1');
  });

  it('cancels a pending tick offscreen and restarts a full interval on return', () => {
    setup({ autoplay: true, autoplayLoop: true });
    act(() => jest.advanceTimersByTime(999));
    changeVisibility(false);
    act(() => jest.advanceTimersByTime(5000));
    expect(screen.getByTestId('index').textContent).toBe('0');

    changeVisibility(true);
    act(() => jest.advanceTimersByTime(999));
    expect(screen.getByTestId('index').textContent).toBe('0');
    act(() => jest.advanceTimersByTime(1));
    expect(screen.getByTestId('index').textContent).toBe('1');
  });

  it('preserves the current slide while hidden and resumes looping when visible', () => {
    setup({ autoplay: true, autoplayLoop: true });
    act(() => jest.advanceTimersByTime(1000));
    expect(screen.getByTestId('index').textContent).toBe('1');
    changeVisibility(false);
    act(() => jest.advanceTimersByTime(5000));
    expect(screen.getByTestId('index').textContent).toBe('1');
    changeVisibility(true);
    act(() => jest.advanceTimersByTime(1000));
    expect(screen.getByTestId('index').textContent).toBe('0');
  });

  it('disconnects on unmount and ignores a queued visibility callback', () => {
    const { unmount } = setup({ autoplay: true, autoplayLoop: true });
    const current = visibilityObservers.at(-1);
    assert(current, 'Missing banner visibility observer');
    unmount();
    expect(current.disconnect).toHaveBeenCalledTimes(1);
    act(() => current.notify(true));
    expect(jest.getTimerCount()).toBe(0);
  });

  it('keeps autoplay available without IntersectionObserver', () => {
    Reflect.deleteProperty(globalThis, 'IntersectionObserver');
    setup({ autoplay: true, autoplayLoop: true });
    act(() => jest.advanceTimersByTime(1000));
    expect(screen.getByTestId('index').textContent).toBe('1');
  });
});
