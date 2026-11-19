/** @jest-environment jsdom */

import type { PropsWithChildren, RefObject } from 'react';

import { cleanup, renderHook } from '@testing-library/react';

import type { IElement } from '@onekeyhq/components';

import { SpotlightScrollStateContext } from './SpotlightScrollStateContext';
import { useSpotlightScrollPause } from './useSpotlightScrollPause.native';

import type { ISpotlightScrollState } from './SpotlightScrollStateContext';

describe('Spotlight native scroll pause', () => {
  const ref = { current: null } as RefObject<IElement | null>;
  let state: ISpotlightScrollState | null | undefined;
  const wrapper = ({ children }: PropsWithChildren) => (
    <SpotlightScrollStateContext.Provider value={state}>
      {children}
    </SpotlightScrollStateContext.Provider>
  );

  beforeEach(() => {
    state = null;
  });
  afterEach(cleanup);

  it.each([undefined, null])('keeps an unknown source paused (%s)', (value) => {
    state = value;
    const notify = jest.fn();
    renderHook(() => useSpotlightScrollPause(ref, true, notify), { wrapper });
    expect(notify.mock.calls).toEqual([[true]]);
  });

  it('uses native settling without an additional delay', () => {
    const notify = jest.fn();
    const view = renderHook(() => useSpotlightScrollPause(ref, true, notify), {
      wrapper,
    });
    state = { pageKey: 'Spot', headerSettledAtTop: true };
    view.rerender();
    expect(notify.mock.calls).toEqual([[true], [false]]);
    state = { pageKey: 'Spot', headerSettledAtTop: false };
    view.rerender();
    expect(notify).toHaveBeenLastCalledWith(true);
  });

  it('uses the latest native snapshot when enabled later', () => {
    state = { pageKey: 'Spot', headerSettledAtTop: true };
    const notify = jest.fn();
    const view = renderHook(
      ({ enabled }) => useSpotlightScrollPause(ref, enabled, notify),
      {
        wrapper,
        initialProps: { enabled: false },
      },
    );
    expect(notify).not.toHaveBeenCalled();
    view.rerender({ enabled: true });
    expect(notify.mock.calls).toEqual([[false]]);
    view.rerender({ enabled: false });
    state = { pageKey: 'Spot', headerSettledAtTop: false };
    view.rerender({ enabled: false });
    expect(notify.mock.calls).toEqual([[false]]);
  });

  it('notifies a new owner even when the settled value is unchanged', () => {
    state = { pageKey: 'Spot', headerSettledAtTop: true };
    const notify = jest.fn();
    const view = renderHook(() => useSpotlightScrollPause(ref, true, notify), {
      wrapper,
    });
    state = { pageKey: 'Other', headerSettledAtTop: true };
    view.rerender();
    expect(notify.mock.calls).toEqual([[false], [false]]);
    state = null;
    view.rerender();
    expect(notify).toHaveBeenLastCalledWith(true);
  });

  it('stops notifying a retired subscriber', () => {
    state = { pageKey: 'Spot', headerSettledAtTop: true };
    const previous = jest.fn();
    const next = jest.fn();
    const view = renderHook(
      ({ notify }) => useSpotlightScrollPause(ref, true, notify),
      {
        wrapper,
        initialProps: { notify: previous },
      },
    );
    view.rerender({ notify: next });
    previous.mockClear();
    state = { pageKey: 'Spot', headerSettledAtTop: false };
    view.rerender({ notify: next });
    expect(previous).not.toHaveBeenCalled();
    expect(next.mock.calls).toEqual([[false], [true]]);
    view.unmount();
    expect(next.mock.calls).toEqual([[false], [true]]);
  });
});
