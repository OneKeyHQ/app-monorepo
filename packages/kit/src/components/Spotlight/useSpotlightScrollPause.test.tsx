/** @jest-environment jsdom */

import type { RefObject } from 'react';

import { act, cleanup, fireEvent, renderHook } from '@testing-library/react';

import type { IElement } from '@onekeyhq/components';

import { useSpotlightScrollPause } from './useSpotlightScrollPause';

import type { TamaguiElementMethods } from '@tamagui/web';

describe('Spotlight DOM scroll pause', () => {
  let container: HTMLDivElement;
  let target: HTMLButtonElement & TamaguiElementMethods;
  let visibilityChange: jest.Mock<void, [boolean]>;
  let observerCallback: IntersectionObserverCallback | undefined;
  const observe = jest.fn();
  const disconnect = jest.fn();

  beforeEach(() => {
    jest.useFakeTimers();
    container = document.createElement('div');
    container.style.overflowY = 'auto';
    target = Object.assign(document.createElement('button'), {
      measure: jest
        .fn<void, Parameters<TamaguiElementMethods['measure']>>()
        .mockImplementation((callback) => callback(0, 0, 80, 48, 0, 0)),
      measureInWindow: jest
        .fn<void, Parameters<TamaguiElementMethods['measureInWindow']>>()
        .mockImplementation((callback) => callback(0, 0, 80, 48)),
      measureLayout: jest
        .fn<void, Parameters<TamaguiElementMethods['measureLayout']>>()
        .mockImplementation((_relativeTo, onSuccess) =>
          onSuccess(0, 0, 80, 48),
        ),
    });
    container.append(target);
    document.body.append(container);
    visibilityChange = jest.fn();
    observerCallback = undefined;
    observe.mockClear();
    disconnect.mockClear();
    globalThis.IntersectionObserver = jest.fn((callback) => {
      observerCallback = callback;
      return { observe, disconnect };
    }) as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    cleanup();
    container.remove();
    jest.clearAllTimers();
    jest.useRealTimers();
    Reflect.deleteProperty(globalThis, 'IntersectionObserver');
  });

  function renderPause(enabled = true) {
    const ref: RefObject<IElement> = { current: target };
    return renderHook(() =>
      useSpotlightScrollPause(ref, enabled, visibilityChange),
    );
  }

  function intersect(isIntersecting: boolean, intersectionRatio: number) {
    act(() => {
      observerCallback?.(
        [{ isIntersecting, intersectionRatio }] as IntersectionObserverEntry[],
        {} as IntersectionObserver,
      );
    });
  }

  it('does not observe or subscribe for a legacy tour', () => {
    renderPause(false);
    fireEvent.scroll(container);
    expect(observe).not.toHaveBeenCalled();
    expect(visibilityChange).not.toHaveBeenCalled();
  });

  it('waits at a restored scroll position, then resumes when scrolled back to top', () => {
    container.scrollTop = 120;
    renderPause();
    expect(visibilityChange).toHaveBeenLastCalledWith(true);
    container.scrollTop = 0;
    fireEvent.scroll(container);
    expect(visibilityChange).toHaveBeenLastCalledWith(true);
    act(() => jest.advanceTimersByTime(150));
    expect(visibilityChange).toHaveBeenLastCalledWith(false);
  });

  it('stays paused when the anchor is clipped by its scroll container', () => {
    renderPause();
    intersect(true, 0.5);
    expect(visibilityChange).toHaveBeenLastCalledWith(true);
    fireEvent.scroll(container);
    act(() => jest.advanceTimersByTime(150));
    expect(visibilityChange).toHaveBeenLastCalledWith(true);
    intersect(true, 1);
    expect(visibilityChange).toHaveBeenLastCalledWith(false);
  });

  it('ignores scrolling outside the anchor ancestor and disconnects on unmount', () => {
    const view = renderPause();
    visibilityChange.mockClear();
    const sibling = document.createElement('div');
    document.body.append(sibling);
    fireEvent.scroll(sibling);
    expect(visibilityChange).not.toHaveBeenCalled();
    fireEvent.scroll(container);
    expect(visibilityChange).toHaveBeenCalledTimes(1);
    view.unmount();
    act(() => jest.advanceTimersByTime(150));
    expect(visibilityChange).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
    sibling.remove();
  });
});
