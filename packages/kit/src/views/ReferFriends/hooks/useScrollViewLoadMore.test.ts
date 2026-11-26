/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import { useScrollViewLoadMore } from './useScrollViewLoadMore';

import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';

type IProps = Parameters<typeof useScrollViewLoadMore>[0];

const layoutEvent = (height: number) =>
  ({
    nativeEvent: { layout: { x: 0, y: 0, width: 0, height } },
  }) as unknown as LayoutChangeEvent;

const scrollEvent = (offset: number, visible: number, content: number) =>
  ({
    nativeEvent: {
      contentOffset: { x: 0, y: offset },
      layoutMeasurement: { width: 0, height: visible },
      contentSize: { width: 0, height: content },
    },
  }) as unknown as NativeSyntheticEvent<NativeScrollEvent>;

function setup(initial: Partial<IProps> = {}) {
  const onLoadMore = jest.fn();
  let props: IProps = {
    cursor: 'page-1',
    isLoading: false,
    listVersion: 0,
    onLoadMore,
    ...initial,
  };
  const hook = renderHook((p: IProps) => useScrollViewLoadMore(p), {
    initialProps: props,
  });
  const rerender = (next: Partial<IProps>) => {
    props = { ...props, ...next };
    hook.rerender(props);
  };
  const measure = (visible: number, content: number) =>
    act(() => {
      hook.result.current.onLayout(layoutEvent(visible));
      hook.result.current.onContentSizeChange(0, content);
    });
  return { hook, rerender, measure, onLoadMore };
}

describe('useScrollViewLoadMore', () => {
  it('keeps loading while the list is shorter than the viewport', () => {
    const { hook, rerender, measure, onLoadMore } = setup();

    measure(900, 700);
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    // The loading row is measured, then the page lands before its rows are:
    // stale metrics must not request another page.
    rerender({ isLoading: true });
    act(() => {
      hook.result.current.onContentSizeChange(0, 740);
    });
    rerender({ isLoading: false, cursor: 'page-2' });
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    act(() => {
      hook.result.current.onContentSizeChange(0, 850);
    });
    expect(onLoadMore).toHaveBeenCalledTimes(2);

    // Once the content overflows, the next page waits for a scroll.
    rerender({ isLoading: true });
    rerender({ isLoading: false, cursor: 'page-3' });
    act(() => {
      hook.result.current.onContentSizeChange(0, 2000);
    });
    expect(onLoadMore).toHaveBeenCalledTimes(2);

    act(() => {
      hook.result.current.onScroll(scrollEvent(1050, 900, 2000));
    });
    expect(onLoadMore).toHaveBeenCalledTimes(3);
  });

  it('does not retry a failed page when the loading row crosses the threshold', () => {
    const { hook, rerender, onLoadMore } = setup();
    // 90px from the end.
    act(() => {
      hook.result.current.onScroll(scrollEvent(1010, 900, 2000));
    });
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    // The loading row pushes the end 130px away, then the request fails.
    rerender({ isLoading: true });
    act(() => {
      hook.result.current.onContentSizeChange(0, 2040);
    });
    rerender({ isLoading: false });
    act(() => {
      hook.result.current.onContentSizeChange(0, 2000);
    });
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    // Scrolling away and back retries.
    act(() => {
      hook.result.current.onScroll(scrollEvent(0, 900, 2000));
      hook.result.current.onScroll(scrollEvent(1100, 900, 2000));
    });
    expect(onLoadMore).toHaveBeenCalledTimes(2);
  });

  it('does not re-arm while a page is loading', () => {
    const { hook, rerender, onLoadMore } = setup();
    act(() => {
      hook.result.current.onScroll(scrollEvent(1100, 900, 2000));
    });
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    // The user scrolls away and back while the page loads.
    rerender({ isLoading: true });
    act(() => {
      hook.result.current.onScroll(scrollEvent(0, 900, 2040));
      hook.result.current.onScroll(scrollEvent(1140, 900, 2040));
    });

    // The page lands; nothing is sent until its rows are measured.
    rerender({ isLoading: false, cursor: 'page-2' });
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    act(() => {
      hook.result.current.onContentSizeChange(0, 3000);
    });
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('continues after a page without a height change once the user scrolls', () => {
    const { hook, rerender, measure, onLoadMore } = setup();
    measure(900, 700);
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    // An empty page advances the cursor without resizing the content.
    rerender({ isLoading: true });
    rerender({ isLoading: false, cursor: 'page-2' });
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    act(() => {
      hook.result.current.onScroll(scrollEvent(0, 900, 700));
    });
    expect(onLoadMore).toHaveBeenCalledTimes(2);
  });

  it('requests a cursor once when size events arrive before loading renders', () => {
    const { hook, measure, onLoadMore } = setup();
    measure(800, 1000);
    expect(onLoadMore).not.toHaveBeenCalled();

    act(() => {
      hook.result.current.onLayout(layoutEvent(950));
      hook.result.current.onContentSizeChange(0, 1030);
    });
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('loads again when a replaced list reuses the cursor and height', () => {
    const { rerender, measure, onLoadMore } = setup();
    measure(900, 700);
    expect(onLoadMore).toHaveBeenCalledTimes(1);

    // A sort supersedes the page request and returns a same-height list.
    rerender({ isLoading: true });
    rerender({ isLoading: false, listVersion: 1 });
    expect(onLoadMore).toHaveBeenCalledTimes(2);
  });

  it('resumes after another load ends without a layout change', () => {
    const { rerender, measure, onLoadMore } = setup({ isLoading: true });
    measure(900, 700);
    expect(onLoadMore).not.toHaveBeenCalled();

    rerender({ isLoading: false });
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('stays idle without a cursor', () => {
    const { measure, onLoadMore } = setup({ cursor: undefined });
    measure(900, 700);
    expect(onLoadMore).not.toHaveBeenCalled();
  });
});
