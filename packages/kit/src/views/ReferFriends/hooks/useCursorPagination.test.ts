/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import { useCursorPagination } from './useCursorPagination';

interface IPage {
  items: string[];
  cursor?: string;
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function setup() {
  const fetchPage = jest.fn<Promise<IPage>, [string | undefined]>();
  const hook = renderHook(
    ({ queryKey }: { queryKey: string }) =>
      useCursorPagination({ queryKey, fetchPage }),
    { initialProps: { queryKey: 'a' } },
  );
  return { hook, fetchPage };
}

describe('useCursorPagination', () => {
  it('keeps only the latest first page', async () => {
    const { hook, fetchPage } = setup();
    const older = createDeferred<IPage>();
    const newer = createDeferred<IPage>();
    fetchPage
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise);

    let olderResult: Promise<IPage | undefined> | undefined;
    act(() => {
      olderResult = hook.result.current.loadFirstPage();
      void hook.result.current.loadFirstPage();
    });
    await act(async () => {
      newer.resolve({ items: ['new'], cursor: 'new-1' });
      older.resolve({ items: ['old'], cursor: 'old-1' });
      await Promise.all([newer.promise, older.promise]);
    });

    await expect(olderResult).resolves.toBeUndefined();
    expect(hook.result.current.items).toEqual(['new']);
    expect(hook.result.current.scrollProps.cursor).toBe('new-1');
    expect(hook.result.current.scrollProps.isLoading).toBe(false);
  });

  it('drops an append that a new first page replaced and re-arms its cursor', async () => {
    const { hook, fetchPage } = setup();
    fetchPage.mockResolvedValueOnce({ items: ['a1'], cursor: 'c1' });
    await act(async () => {
      await hook.result.current.loadFirstPage();
    });
    const versionAfterFirstPage = hook.result.current.scrollProps.listVersion;

    const append = createDeferred<IPage>();
    const refresh = createDeferred<IPage>();
    fetchPage
      .mockReturnValueOnce(append.promise)
      .mockReturnValueOnce(refresh.promise);
    act(() => {
      void hook.result.current.scrollProps.onLoadMore();
    });
    act(() => {
      void hook.result.current.loadFirstPage().catch(() => undefined);
    });
    expect(hook.result.current.isLoadingMore).toBe(false);
    expect(hook.result.current.scrollProps.listVersion).toBe(
      versionAfterFirstPage + 1,
    );

    await act(async () => {
      append.resolve({ items: ['stale'], cursor: 'stale-cursor' });
      refresh.reject(new Error('Refresh failed'));
      await Promise.allSettled([append.promise, refresh.promise]);
    });

    expect(hook.result.current.items).toEqual(['a1']);
    expect(hook.result.current.scrollProps.cursor).toBe('c1');
    expect(hook.result.current.scrollProps.isLoading).toBe(false);
  });

  it('pages only the rows of the active query', async () => {
    const { hook, fetchPage } = setup();
    fetchPage.mockResolvedValueOnce({ items: ['a1'], cursor: 'c1' });
    await act(async () => {
      await hook.result.current.loadFirstPage();
    });

    // The new query's first page fails, so the old rows stay on screen.
    hook.rerender({ queryKey: 'b' });
    fetchPage.mockRejectedValueOnce(new Error('First page failed'));
    await act(async () => {
      await hook.result.current.loadFirstPage().catch(() => undefined);
    });

    expect(hook.result.current.items).toEqual(['a1']);
    expect(hook.result.current.scrollProps.cursor).toBeUndefined();
  });
});
