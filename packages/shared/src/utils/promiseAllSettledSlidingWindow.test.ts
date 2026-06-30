/**
 * promiseAllSettledSlidingWindow (L4) — a worker-pool executor that keeps
 * `concurrency` tasks in flight and starts the next the instant one settles
 * (unlike the batch-barrier `promiseAllSettledEnhanced`, which waits for a whole
 * wave). Results are returned in INPUT order; `onSettled(result, index)` fires
 * per task as it completes (the per-round hook L2 needs).
 */
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { promiseAllSettledSlidingWindow } from './promiseAllSettledSlidingWindow';

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('promiseAllSettledSlidingWindow', () => {
  it('returns results in input order even when tasks settle out of order', async () => {
    const ds = [deferred<string>(), deferred<string>(), deferred<string>()];
    const p = promiseAllSettledSlidingWindow(
      ds.map((d) => () => d.promise),
      { concurrency: 3, continueOnError: true },
    );
    ds[2].resolve('c');
    ds[0].resolve('a');
    ds[1].resolve('b');
    expect(await p).toEqual(['a', 'b', 'c']);
  });

  it('never exceeds the concurrency limit', async () => {
    const ds = Array.from({ length: 5 }, () => deferred<number>());
    let active = 0;
    let peak = 0;
    const p = promiseAllSettledSlidingWindow(
      ds.map((d) => async () => {
        active += 1;
        peak = Math.max(peak, active);
        const v = await d.promise;
        active -= 1;
        return v;
      }),
      { concurrency: 2, continueOnError: true },
    );
    await flush();
    expect(active).toBe(2);
    for (let i = 0; i < ds.length; i += 1) {
      ds[i].resolve(i);
      // eslint-disable-next-line no-await-in-loop
      await flush();
    }
    expect(await p).toEqual([0, 1, 2, 3, 4]);
    expect(peak).toBe(2);
  });

  it('starts a waiting task as soon as a slot frees (sliding, not batch)', async () => {
    const started: number[] = [];
    const ds = [deferred<number>(), deferred<number>(), deferred<number>()];
    const p = promiseAllSettledSlidingWindow(
      ds.map((d, i) => () => {
        started.push(i);
        return d.promise;
      }),
      { concurrency: 2, continueOnError: true },
    );
    await flush();
    expect(started).toEqual([0, 1]); // task 2 not started while 0 & 1 occupy slots
    ds[1].resolve(1); // free one slot; task 0 still pending
    await flush();
    expect(started).toEqual([0, 1, 2]); // task 2 started without waiting for task 0
    ds[0].resolve(0);
    ds[2].resolve(2);
    expect(await p).toEqual([0, 1, 2]);
  });

  it('nulls errored tasks and reports every settle via onSettled (continueOnError)', async () => {
    const seen: Array<{ i: number; v: number | null }> = [];
    const res = await promiseAllSettledSlidingWindow<number>(
      [
        async () => 10,
        async () => {
          throw new OneKeyLocalError('boom');
        },
        async () => 30,
      ],
      {
        concurrency: 2,
        continueOnError: true,
        onSettled: (v, i) => seen.push({ i, v }),
      },
    );
    expect(res).toEqual([10, null, 30]);
    expect(seen.toSorted((a, b) => a.i - b.i)).toEqual([
      { i: 0, v: 10 },
      { i: 1, v: null },
      { i: 2, v: 30 },
    ]);
  });

  it('returns [] for empty input', async () => {
    expect(
      await promiseAllSettledSlidingWindow([], { concurrency: 4 }),
    ).toEqual([]);
  });
});
