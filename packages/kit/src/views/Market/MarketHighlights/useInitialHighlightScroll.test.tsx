/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import type { IElement, IScrollViewRef } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketHighlight } from '@onekeyhq/shared/types/marketV2';

import { useInitialHighlightScroll } from './useInitialHighlightScroll';

import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));
const items: IMarketHighlight[] = ['first', 'middle', 'last'].map((id) => ({
  highlightId: id,
  title: id,
  description: id,
  publishedAt: '2026-11-17T00:00:00Z',
  assets: [],
  links: [],
}));
const scrollEvent = (y: number) =>
  ({
    nativeEvent: { contentOffset: { x: 0, y } },
  }) as NativeSyntheticEvent<NativeScrollEvent>;

function setup({
  id = 'middle',
  top = 350,
  contentHeight = 1000,
  viewportHeight = 500,
  deferLayout = false,
} = {}) {
  const scrollTo = jest.fn();
  const view = renderHook(() => useInitialHighlightScroll(items, id));
  const content = document.createElement('div');
  const target = document.createElement('div');
  const viewport = document.createElement('div');
  Object.defineProperty(content, 'offsetHeight', { value: contentHeight });
  Object.defineProperty(target, 'offsetTop', { value: top });
  Object.defineProperty(viewport, 'clientHeight', {
    value: viewportHeight,
    configurable: true,
  });
  view.result.current.contentRef.current = content as unknown as IElement;
  view.result.current.targetRef.current = target as unknown as IElement;
  view.result.current.viewportRef.current = viewport as unknown as IElement;
  view.result.current.scrollRef.current = {
    scrollTo,
  } as unknown as IScrollViewRef;
  const reportTargetLayout = () =>
    act(() => {
      view.result.current.onContentLayout({
        nativeEvent: { layout: { height: contentHeight } },
      } as LayoutChangeEvent);
      view.result.current.onTargetLayout({
        nativeEvent: { layout: { y: top } },
      } as LayoutChangeEvent);
    });
  const reportLayout = () =>
    act(() => {
      view.result.current.onViewportLayout({
        nativeEvent: { layout: { height: viewportHeight } },
      } as LayoutChangeEvent);
      items.forEach((item) =>
        view.result.current.onDescriptionMeasured(item.highlightId),
      );
      if (!deferLayout) reportTargetLayout();
    });
  const measure = () => {
    reportLayout();
    act(() => view.result.current.onPageMounted());
    act(() => jest.advanceTimersByTime(40));
  };
  return {
    ...view,
    viewport,
    reportLayout,
    scrollTo,
    measure,
    reportTargetLayout,
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  platformEnv.isNative = false;
});
afterEach(() => jest.useRealTimers());

it.each([false, true])(
  'positions before revealing, at 40px below the top (native=%s)',
  (native) => {
    platformEnv.isNative = native;
    const view = setup();
    expect(view.result.current.visible).toBe(false);
    view.measure();
    expect(view.scrollTo).toHaveBeenCalledWith({ y: 310, animated: false });
    expect(view.result.current.visible).toBe(false);
    act(() => view.result.current.onScroll(scrollEvent(0)));
    expect(view.result.current.visible).toBe(false);
    act(() => view.result.current.onScroll(scrollEvent(310)));
    expect(view.result.current.visible).toBe(true);
    view.rerender();
    view.measure();
    expect(view.scrollTo).toHaveBeenCalledTimes(1);
  },
);

it.each([false, true])(
  'clamps the last headline to the real bottom without extra padding (native=%s)',
  (native) => {
    platformEnv.isNative = native;
    const view = setup({ id: 'last', top: 850 });
    view.measure();
    expect(view.scrollTo).toHaveBeenCalledWith({ y: 500, animated: false });
    act(() => view.result.current.onScroll(scrollEvent(500)));
    expect(view.result.current.visible).toBe(true);
  },
);

it.each(['first', 'missing'])('keeps the top for headline=%s', (id) => {
  const view = setup({ id });
  view.measure();
  expect(view.result.current.visible).toBe(true);
  expect(view.scrollTo).not.toHaveBeenCalled();
});

it('keeps a short list at the top when the entire list fits', () => {
  const view = setup({ id: 'last', top: 250, contentHeight: 400 });
  view.measure();
  expect(view.result.current.visible).toBe(true);
  expect(view.scrollTo).not.toHaveBeenCalled();
});

it('does not issue a late native scroll after the user starts interacting', () => {
  platformEnv.isNative = true;
  const view = setup({ deferLayout: true });
  view.measure();
  expect(view.scrollTo).not.toHaveBeenCalled();
  act(() => view.result.current.finish());
  view.reportTargetLayout();
  act(() => jest.advanceTimersByTime(100));
  expect(view.scrollTo).not.toHaveBeenCalled();
  expect(view.result.current.visible).toBe(true);
});

it('cancels pending native positioning after unmount', () => {
  platformEnv.isNative = true;
  const view = setup();
  view.reportLayout();
  act(() => view.result.current.onPageMounted());
  view.unmount();
  act(() => jest.advanceTimersByTime(100));
  expect(view.scrollTo).not.toHaveBeenCalled();
});

it('waits for the final modal viewport before deciding that content fits', () => {
  const view = setup({ viewportHeight: 1000 });
  view.reportLayout();
  act(() => view.result.current.onPageMounted());
  act(() => jest.advanceTimersByTime(16));
  Object.defineProperty(view.viewport, 'clientHeight', {
    value: 500,
    configurable: true,
  });
  act(() => jest.advanceTimersByTime(16));
  expect(view.scrollTo).not.toHaveBeenCalled();
  expect(view.result.current.visible).toBe(false);
  act(() => jest.advanceTimersByTime(16));
  expect(view.scrollTo).toHaveBeenCalledWith({ y: 310, animated: false });
});

it('cancels pending web positioning when the user starts interacting', () => {
  const view = setup();
  view.reportLayout();
  act(() => view.result.current.finish());
  act(() => view.result.current.onPageMounted());
  act(() => jest.advanceTimersByTime(100));
  expect(view.scrollTo).not.toHaveBeenCalled();
  expect(view.result.current.visible).toBe(true);
});

it.each([false, true])(
  'waits for the final modal viewport (native=%s)',
  (native) => {
    platformEnv.isNative = native;
    const view = setup({
      id: 'last',
      top: 838,
      contentHeight: 1029,
      viewportHeight: 778,
    });
    view.reportLayout();
    act(() => jest.advanceTimersByTime(100));
    expect(view.scrollTo).not.toHaveBeenCalled();
    expect(view.result.current.visible).toBe(false);
    Object.defineProperty(view.viewport, 'clientHeight', { value: 708 });
    act(() => {
      view.result.current.onViewportLayout({
        nativeEvent: { layout: { height: 708 } },
      } as LayoutChangeEvent);
      view.result.current.onPageMounted();
    });
    act(() => jest.advanceTimersByTime(40));
    expect(view.scrollTo).toHaveBeenCalledWith({ y: 321, animated: false });
    act(() => view.result.current.onScroll(scrollEvent(321)));
    expect(view.result.current.visible).toBe(true);
  },
);
