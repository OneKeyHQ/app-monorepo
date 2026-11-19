/**
 * @jest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react';

import { useBrowserSubmenuCloseArm } from './useBrowserSubmenuCloseArm';

const DELAY_MS = 250;
const THRESHOLD_PX = 4;

function setup() {
  const hook = renderHook(
    ({ isExpanded }: { isExpanded: boolean }) =>
      useBrowserSubmenuCloseArm({
        isExpanded,
        delayMs: DELAY_MS,
        thresholdPx: THRESHOLD_PX,
      }),
    { initialProps: { isExpanded: false } },
  );
  const api = () => hook.result.current;
  const enter = (x: number, y: number) =>
    act(() => api().onPointerEnter({ x, y }));
  const move = (x: number, y: number) =>
    act(() => api().onPointerMove({ x, y }));
  // Mirrors the column: disarm in the same batch as expanding.
  const expand = () =>
    act(() => {
      api().disarm();
      hook.rerender({ isExpanded: true });
    });
  const collapse = () => act(() => hook.rerender({ isExpanded: false }));
  const leave = () => act(() => api().onPointerLeave());
  const settle = () => act(() => jest.advanceTimersByTime(DELAY_MS));
  return { api, enter, move, expand, collapse, leave, settle };
}

describe('useBrowserSubmenuCloseArm', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('arms on the first move of at least the threshold after a stationary enter', () => {
    const { api, enter, move, expand, settle } = setup();
    enter(100, 100);
    expand();
    settle();
    expect(api().isCloseArmed).toBe(false);
    move(104, 100);
    expect(api().isCloseArmed).toBe(true);
  });

  it('does not arm on a first move below the threshold after a stationary enter', () => {
    const { api, enter, move, expand, settle } = setup();
    enter(100, 100);
    expand();
    settle();
    move(102, 102);
    expect(api().isCloseArmed).toBe(false);
  });

  it('arms on a first diagonal move over the threshold after a stationary enter', () => {
    const { api, enter, move, expand, settle } = setup();
    enter(100, 100);
    expand();
    settle();
    move(103, 103);
    expect(api().isCloseArmed).toBe(true);
  });

  it('ignores moves before the settle delay expires', () => {
    const { api, enter, move, expand } = setup();
    enter(100, 100);
    expand();
    act(() => jest.advanceTimersByTime(DELAY_MS - 1));
    move(150, 150);
    expect(api().isCloseArmed).toBe(false);
  });

  it('does not use a position left from an earlier expand as origin', () => {
    const { api, enter, move, expand, collapse, leave, settle } = setup();
    enter(0, 0);
    expand();
    settle();
    move(10, 0);
    expect(api().isCloseArmed).toBe(true);
    leave();
    collapse();
    expect(api().lastPointerRef.current).toBeNull();

    // Second expand: the column appears under a stationary cursor.
    enter(100, 100);
    expand();
    expect(api().isCloseArmed).toBe(false);
    settle();
    // Sub-threshold jitter must not arm against the stale (10, 0) origin.
    move(102, 100);
    expect(api().isCloseArmed).toBe(false);
    move(104, 100);
    expect(api().isCloseArmed).toBe(true);
  });

  it('clears the recorded position on leave', () => {
    const { api, enter, leave } = setup();
    enter(100, 100);
    expect(api().lastPointerRef.current).toEqual({ x: 100, y: 100 });
    leave();
    expect(api().lastPointerRef.current).toBeNull();
  });

  it('clears the recorded position on collapse', () => {
    const { api, enter, expand, collapse } = setup();
    enter(100, 100);
    expand();
    collapse();
    expect(api().lastPointerRef.current).toBeNull();
  });

  it('overwrites a stale position on enter', () => {
    const { api, enter, move, expand, settle } = setup();
    move(0, 0);
    enter(100, 100);
    expand();
    settle();
    move(102, 100);
    expect(api().isCloseArmed).toBe(false);
  });
});
