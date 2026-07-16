/** @jest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';

import { useIdentityScopedSilentRefresh } from './useIdentityScopedSilentRefresh';

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}

describe('useIdentityScopedSilentRefresh', () => {
  it('paints a restored value while silently refreshing it', async () => {
    const deferred = createDeferred<
      { status: 'success'; data: string } | { status: 'empty' }
    >();
    const onCommit = jest.fn();
    const { result } = renderHook(() =>
      useIdentityScopedSilentRefresh({
        ownerKey: 'account-a|stock-a|usd',
        requestKey: '1W',
        restored: {
          ownerKey: 'account-a|stock-a|usd',
          requestKey: '1W',
          data: 'snapshot',
        },
        load: () => deferred.promise,
        onCommit,
      }),
    );

    expect(result.current.visible?.data).toBe('snapshot');
    expect(result.current.phase).toBe('refreshing');

    await act(async () => {
      deferred.resolve({ status: 'success', data: 'fresh' });
      await deferred.promise;
    });

    expect(result.current.visible).toMatchObject({
      data: 'fresh',
      requestKey: '1W',
      source: 'live',
    });
    expect(result.current.phase).toBe('ready');
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('retains the visible range while a new requested range is pending', async () => {
    const nextRange = createDeferred<
      { status: 'success'; data: string } | { status: 'empty' }
    >();
    const load = jest
      .fn<
        Promise<{ status: 'success'; data: string } | { status: 'empty' }>,
        []
      >()
      .mockResolvedValueOnce({ status: 'success', data: 'one-week' })
      .mockImplementationOnce(() => nextRange.promise);
    const { result, rerender } = renderHook(
      ({ requestKey }: { requestKey: string }) =>
        useIdentityScopedSilentRefresh({
          ownerKey: 'account-a|stock-a|usd',
          requestKey,
          load,
        }),
      { initialProps: { requestKey: '1W' } },
    );
    await waitFor(() => expect(result.current.phase).toBe('ready'));

    rerender({ requestKey: '1M' });

    expect(result.current.requested.requestKey).toBe('1M');
    expect(result.current.visible?.requestKey).toBe('1W');
    expect(result.current.visible?.data).toBe('one-week');
    expect(result.current.isVisibleExact).toBe(false);
    expect(result.current.phase).toBe('refreshing');
  });

  it.each([
    ['empty', { status: 'empty' } as const, undefined],
    ['error', undefined, new Error('offline')],
  ])('does not erase last-good data on %s', async (_, response, error) => {
    const onCommit = jest.fn();
    const load = error
      ? jest.fn().mockRejectedValue(error)
      : jest.fn().mockResolvedValue(response);
    const { result } = renderHook(() =>
      useIdentityScopedSilentRefresh({
        ownerKey: 'account-a|stock-a|usd',
        requestKey: '1W',
        restored: {
          ownerKey: 'account-a|stock-a|usd',
          requestKey: '1W',
          data: 'last-good',
        },
        load,
        onCommit,
      }),
    );

    await waitFor(() =>
      expect(result.current.phase).toBe(error ? 'stale-error' : 'stale-empty'),
    );
    expect(result.current.visible?.data).toBe('last-good');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('rejects a late response after the owner changes', async () => {
    const oldRequest = createDeferred<
      { status: 'success'; data: string } | { status: 'empty' }
    >();
    const onCommit = jest.fn();
    const load = jest
      .fn<
        Promise<{ status: 'success'; data: string } | { status: 'empty' }>,
        []
      >()
      .mockImplementationOnce(() => oldRequest.promise)
      .mockResolvedValueOnce({ status: 'success', data: 'account-b' });
    const { result, rerender } = renderHook(
      ({ ownerKey }: { ownerKey: string }) =>
        useIdentityScopedSilentRefresh({
          ownerKey,
          requestKey: '1W',
          load,
          onCommit,
        }),
      { initialProps: { ownerKey: 'account-a|stock-a|usd' } },
    );

    rerender({ ownerKey: 'account-b|stock-a|usd' });
    expect(result.current.visible).toBeUndefined();

    await waitFor(() => expect(result.current.visible?.data).toBe('account-b'));
    await act(async () => {
      oldRequest.resolve({ status: 'success', data: 'late-account-a' });
      await oldRequest.promise;
    });

    expect(result.current.visible?.data).toBe('account-b');
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({ ownerKey: 'account-b|stock-a|usd' }),
    );
  });

  it('retries an empty state without changing identity', async () => {
    const load = jest
      .fn()
      .mockResolvedValueOnce({ status: 'empty' })
      .mockResolvedValueOnce({ status: 'success', data: 'recovered' });
    const { result } = renderHook(() =>
      useIdentityScopedSilentRefresh({
        ownerKey: 'account-a|stock-a|usd',
        requestKey: '1W',
        load,
      }),
    );
    await waitFor(() => expect(result.current.phase).toBe('empty'));

    act(() => result.current.refresh());

    await waitFor(() => expect(result.current.visible?.data).toBe('recovered'));
  });
});
