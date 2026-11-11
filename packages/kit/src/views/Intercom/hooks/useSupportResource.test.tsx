/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react';

import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import { useSupportResource } from './useSupportResource';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

it('discards an old account response after a new loader takes over', async () => {
  const old = deferred<string>();
  const loadOld = () => old.promise;
  const loadNew = async () => 'new account';
  const { result, rerender } = renderHook(
    ({ load }) => useSupportResource(load, true),
    { initialProps: { load: loadOld } },
  );
  await act(async () => {
    rerender({ load: loadNew });
  });
  expect(result.current.data).toBe('new account');
  await act(async () => {
    old.resolve('old account');
  });
  expect(result.current.data).toBe('new account');
});

it('does not restore content after the screen locks or loses focus', async () => {
  const response = deferred<string>();
  const load = () => response.promise;
  const { result, rerender } = renderHook(
    ({ enabled }) => useSupportResource(load, enabled),
    { initialProps: { enabled: true } },
  );
  rerender({ enabled: false });
  await act(async () => {
    response.resolve('private conversation');
  });
  expect(result.current.data).toBeUndefined();
});

it('does not overlap slow polling requests and stops polling when disabled', async () => {
  jest.useFakeTimers();
  try {
    const response = deferred<string>();
    const load = jest.fn(() => response.promise);
    const { result, rerender, unmount } = renderHook(
      ({ enabled }) => useSupportResource(load, enabled, true),
      { initialProps: { enabled: true } },
    );
    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    expect(load).toHaveBeenCalledTimes(1);
    await act(async () => {
      response.resolve('loaded');
    });
    expect(result.current.data).toBe('loaded');
    rerender({ enabled: false });
    act(() => {
      jest.advanceTimersByTime(30_000);
    });
    expect(load).toHaveBeenCalledTimes(1);
    unmount();
  } finally {
    jest.useRealTimers();
  }
});

it('retains displayed data across focus changes while refreshing on resume', async () => {
  const refresh = deferred<string>();
  const load = jest
    .fn(async () => 'displayed')
    .mockImplementationOnce(async () => 'displayed');
  const { result, rerender } = renderHook(
    ({ enabled }) => useSupportResource(load, enabled),
    { initialProps: { enabled: true } },
  );
  await act(async () => {});
  expect(result.current.data).toBe('displayed');
  rerender({ enabled: false });
  expect(result.current.data).toBe('displayed');
  expect(result.current.loading).toBe(false);
  load.mockImplementationOnce(() => refresh.promise);
  rerender({ enabled: true });
  expect(result.current.data).toBe('displayed');
  expect(result.current.loading).toBe(true);
  await act(async () => refresh.resolve('fresh'));
  expect(result.current.data).toBe('fresh');
});

it('clears retained data when the loader identity changes while inactive', async () => {
  const first = async () => 'old account';
  const second = async () => 'new account';
  const { result, rerender } = renderHook(
    ({ load, enabled }) => useSupportResource(load, enabled),
    { initialProps: { load: first, enabled: true } },
  );
  await act(async () => {});
  rerender({ load: first, enabled: false });
  expect(result.current.data).toBe('old account');
  rerender({ load: second, enabled: false });
  expect(result.current.data).toBeUndefined();
  rerender({ load: second, enabled: true });
  await act(async () => {});
  expect(result.current.data).toBe('new account');
});

it('refreshes an active conversation immediately after a push and coalesces in-flight hints', async () => {
  const pending = deferred<string>();
  const load = jest
    .fn(async () => 'fresh')
    .mockImplementationOnce(() => pending.promise);
  const { result, unmount } = renderHook(() =>
    useSupportResource(load, true, true),
  );
  act(() => {
    for (let i = 0; i < 3; i += 1)
      appEventBus.emit(EAppEventBusNames.SupportConversationUpdated, {
        conversationId: '42',
      });
  });
  expect(load).toHaveBeenCalledTimes(1);
  await act(async () => pending.resolve('old response'));
  expect(load).toHaveBeenCalledTimes(2);
  expect(result.current.data).toBe('fresh');
  await act(async () => {
    appEventBus.emit(EAppEventBusNames.SupportConversationUpdated, {});
  });
  expect(load).toHaveBeenCalledTimes(3);
  unmount();
  appEventBus.emit(EAppEventBusNames.SupportConversationUpdated, {});
  expect(load).toHaveBeenCalledTimes(3);
});

it('drops a queued push on identity changes and ignores hints on inactive screens', async () => {
  const pending = deferred<string>();
  const oldLoad = jest.fn(() => pending.promise);
  const newLoad = jest.fn(async () => 'new account');
  const { result, rerender } = renderHook(
    ({ load, enabled }) => useSupportResource(load, enabled, true),
    { initialProps: { load: oldLoad, enabled: true } },
  );
  act(() => {
    appEventBus.emit(EAppEventBusNames.SupportConversationUpdated, {});
  });
  await act(async () => rerender({ load: newLoad, enabled: true }));
  await act(async () => pending.resolve('old account'));
  expect(result.current.data).toBe('new account');
  expect(oldLoad).toHaveBeenCalledTimes(1);
  expect(newLoad).toHaveBeenCalledTimes(1);
  rerender({ load: newLoad, enabled: false });
  appEventBus.emit(EAppEventBusNames.SupportConversationUpdated, {});
  expect(newLoad).toHaveBeenCalledTimes(1);
});
