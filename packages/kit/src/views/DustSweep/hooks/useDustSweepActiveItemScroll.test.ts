/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import type { IScrollViewRef } from '@onekeyhq/components';

import {
  getDustSweepItemScrollOffset,
  useDustSweepActiveItemScroll,
} from './useDustSweepActiveItemScroll';

import type { IDustSweepState } from '../stateMachine';
import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';

const viewport = {
  height: 60,
  offset: 300,
  viewportHeight: 400,
  bottomInset: 18,
};

it('keeps a fully visible row in place, including exact viewport edges', () => {
  expect(
    getDustSweepItemScrollOffset({ ...viewport, top: 400 }),
  ).toBeUndefined();
  expect(
    getDustSweepItemScrollOffset({ ...viewport, top: 300 }),
  ).toBeUndefined();
  expect(
    getDustSweepItemScrollOffset({ ...viewport, top: 622 }),
  ).toBeUndefined();
});

it('reveals a row below the viewport with only the necessary movement', () => {
  expect(getDustSweepItemScrollOffset({ ...viewport, top: 900 })).toBe(578);
});

it('clears the mobile footer overlap even when only the row bottom is obscured', () => {
  expect(getDustSweepItemScrollOffset({ ...viewport, top: 630 })).toBe(308);
});

it('reveals a row clipped above the viewport', () => {
  expect(getDustSweepItemScrollOffset({ ...viewport, top: 280 })).toBe(280);
});

it('uses the full desktop viewport without a mobile footer inset', () => {
  expect(
    getDustSweepItemScrollOffset({ ...viewport, top: 640, bottomInset: 0 }),
  ).toBeUndefined();
});

it('never requests a negative offset', () => {
  expect(getDustSweepItemScrollOffset({ ...viewport, top: -1 })).toBe(0);
});

const token = {
  key: 'token',
  networkId: 'evm--1',
  contractAddress: 'token',
  symbol: 'TOKEN',
  decimals: 18,
  amount: '1',
  valueUsd: '1',
  suspicious: false,
};
const activeState: IDustSweepState = {
  phase: 'running',
  snapshot: {
    id: 'session',
    accountId: 'account',
    address: 'address',
    networkId: 'evm--1',
    slippage: 5,
    nativeToken: { ...token, contractAddress: '', isNative: true },
    tokens: [token],
  },
  items: [{ token, status: 'preparing' }],
};
const layout = (y: number, height: number) =>
  ({
    nativeEvent: { layout: { x: 0, y, width: 300, height } },
  }) as LayoutChangeEvent;
const scroll = (y: number) =>
  ({
    nativeEvent: { contentOffset: { x: 0, y } },
  }) as NativeSyntheticEvent<NativeScrollEvent>;

function setup() {
  const scrollTo = jest.fn();
  const hook = renderHook(
    ({ state }) =>
      useDustSweepActiveItemScroll({
        state,
        rowHeight: 60,
        bottomInset: 18,
      }),
    { initialProps: { state: activeState } },
  );
  hook.result.current.scrollViewRef.current = {
    scrollTo,
  } as unknown as IScrollViewRef;
  return { ...hook, scrollTo };
}

it('waits for both layouts before revealing an active item', () => {
  const { result, scrollTo } = setup();
  act(() => result.current.onLayout(layout(0, 400)));
  expect(scrollTo).not.toHaveBeenCalled();
  act(() => result.current.onRowsLayout(layout(500, 0)));
  expect(scrollTo).not.toHaveBeenCalled();
  act(() => result.current.onRowsLayout(layout(500, 60)));
  expect(scrollTo).toHaveBeenCalledWith({ y: 178, animated: true });
});

it('does not reclaim scrolling when a later layout clips an already checked item', () => {
  const { result, scrollTo } = setup();
  act(() => {
    result.current.onLayout(layout(0, 600));
    result.current.onRowsLayout(layout(400, 60));
  });
  expect(scrollTo).not.toHaveBeenCalled();
  act(() => result.current.onLayout(layout(0, 400)));
  expect(scrollTo).not.toHaveBeenCalled();
});

it('allows manual scrolling through same-item status changes and duplicate layouts', () => {
  const { result, rerender, scrollTo } = setup();
  act(() => {
    result.current.onLayout(layout(0, 400));
    result.current.onRowsLayout(layout(100, 60));
    result.current.onScroll(scroll(200));
  });
  rerender({
    state: { ...activeState, items: [{ token, status: 'signing' }] },
  });
  act(() => {
    result.current.onLayout(layout(0, 400));
    result.current.onRowsLayout(layout(100, 60));
  });
  expect(scrollTo).not.toHaveBeenCalled();
});

it('does not reveal a token again after it waits during a pause and resumes', () => {
  const { result, rerender, scrollTo } = setup();
  act(() => {
    result.current.onLayout(layout(0, 400));
    result.current.onRowsLayout(layout(100, 60));
  });
  rerender({
    state: {
      ...activeState,
      phase: 'paused',
      items: [{ token, status: 'waiting' }],
    },
  });
  act(() => result.current.onScroll(scroll(200)));
  rerender({ state: activeState });
  expect(scrollTo).not.toHaveBeenCalled();
});

it('reveals the same token again in a new session', () => {
  const { result, rerender, scrollTo } = setup();
  act(() => {
    result.current.onLayout(layout(0, 400));
    result.current.onRowsLayout(layout(100, 60));
    result.current.onScroll(scroll(200));
  });
  rerender({
    state: {
      ...activeState,
      snapshot: { ...activeState.snapshot!, id: 'next-session' },
    },
  });
  expect(scrollTo).toHaveBeenCalledWith({ y: 100, animated: true });
});
