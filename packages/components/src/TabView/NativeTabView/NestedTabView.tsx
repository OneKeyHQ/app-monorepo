/* eslint-disable @typescript-eslint/no-use-before-define */
import type { ForwardRefRenderFunction } from 'react';
import {
  forwardRef,
  memo,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';

import { UIManager, findNodeHandle } from 'react-native';

import { Stack } from '../../Stack';

import NativeNestedTabView from './NativeNestedTabView';

import type { Route } from '../types';
import type { PagerViewViewManagerType } from './NativeNestedTabView';
import type {
  NestedTabViewProps,
  OnPageChangeEvent,
  OnPageScrollStateChangeEvent,
} from './types';
import type { LayoutChangeEvent } from 'react-native';

export type ForwardRefHandle = {
  setHeaderHeight: (headerHeight: number) => void;
  setPageIndex: (pageIndex: number) => void;
  setRefreshing: (refreshing: boolean) => void;
};

const NestedTabView: ForwardRefRenderFunction<
  ForwardRefHandle,
  NestedTabViewProps<Route>
> = (
  {
    routes,
    renderScene,
    renderHeaderView,
    onPageChange,
    onPageScrollStateChange,
    onPageVerticalScroll,
    scrollEnabled = true,
    ...rest
  },
  ref,
) => {
  const isScrolling = useRef(false);
  const tabRef = useRef<PagerViewViewManagerType>(null);

  const setPageIndex = useCallback((pageIndex: number) => {
    try {
      UIManager.dispatchViewManagerCommand(
        findNodeHandle(tabRef.current),
        'setPageIndex',
        [pageIndex],
      );
    } catch (error) {
      console.log(`switch account tab error`, error);
    }
  }, []);

  const setRefreshing = useCallback((refreshing: boolean) => {
    try {
      UIManager.dispatchViewManagerCommand(
        findNodeHandle(tabRef.current),
        'setRefreshing',
        [refreshing],
      );
    } catch (error) {
      console.log(`set refreshing error`, error);
    }
  }, []);

  const setHeaderHeight = useCallback((headerHeight: number) => {
    try {
      UIManager.dispatchViewManagerCommand(
        findNodeHandle(tabRef.current),
        'setHeaderHeight',
        [headerHeight],
      );
    } catch (error) {
      console.log(`set headerHeight error`, error);
    }
  }, []);

  useImperativeHandle(ref, () => ({
    setPageIndex,
    setRefreshing,
    setHeaderHeight,
  }));

  const onTabChange = useCallback(
    (e: OnPageChangeEvent) => {
      onPageChange?.(e);
    },
    [onPageChange],
  );

  const onVerticalCall = useCallback(() => {
    isScrolling.current = false;
    onPageVerticalScroll?.();
  }, [onPageVerticalScroll]);

  const onMoveShouldSetResponderCapture = useCallback(
    () => isScrolling.current,
    [],
  );

  const onPageScrollStateChangeCall = useCallback(
    (e: OnPageScrollStateChangeEvent) => {
      onPageScrollStateChange?.(e);
      if (e.nativeEvent.state === 'idle') {
        isScrolling.current = false;
      }
      if (e.nativeEvent.state === 'dragging') {
        isScrolling.current = true;
      }
    },
    [onPageScrollStateChange],
  );

  const onLayoutCallback = useCallback(
    (event: LayoutChangeEvent) => {
      const { height } = event.nativeEvent.layout;
      setHeaderHeight(height);
    },
    [setHeaderHeight],
  );

  const headerView = useMemo(() => renderHeaderView?.(), [renderHeaderView]);

  const tabValues = useMemo(
    () =>
      routes.map((route) => ({
        name: route.key,
        label: route.title,
      })),
    [routes],
  );

  return (
    <NativeNestedTabView
      values={tabValues}
      onPageChange={onTabChange}
      onPageScrollStateChange={onPageScrollStateChangeCall}
      onPageVerticalScroll={onVerticalCall}
      scrollEnabled={scrollEnabled}
      onMoveShouldSetResponderCapture={onMoveShouldSetResponderCapture}
      disableTabSlide={false}
      // @ts-expect-error
      ref={tabRef}
      {...rest}
    >
      {/* native code get first child as header */}
      <Stack onLayout={onLayoutCallback}>{headerView}</Stack>

      {/* @ts-expect-error */}
      {routes.map((route) => renderScene({ route }))}
    </NativeNestedTabView>
  );
};

export default memo(forwardRef(NestedTabView));
