import { LatestSubscriptionReconcileQueue } from './SubscriptionReconcileQueue';

describe('LatestSubscriptionReconcileQueue', () => {
  it('serializes reconciles and runs only the latest pending request', async () => {
    const queue = new LatestSubscriptionReconcileQueue();
    const events: string[] = [];
    let releaseFirst: (() => void) | undefined;
    const firstBlocked = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = queue.enqueue(async () => {
      events.push('first:start');
      await firstBlocked;
      events.push('first:end');
    });
    const stale = queue.enqueue(async () => {
      events.push('stale');
    });
    const latest = queue.enqueue(async () => {
      events.push('latest');
    });

    await Promise.resolve();
    expect(events).toEqual(['first:start']);

    releaseFirst?.();
    await Promise.all([first, stale, latest]);

    expect(events).toEqual(['first:start', 'first:end', 'latest']);
  });

  it('does not strand a reconcile queued while the current drain settles', async () => {
    const queue = new LatestSubscriptionReconcileQueue();
    const events: string[] = [];
    let lateReconcile: Promise<void> | undefined;

    const firstReconcile = queue.enqueue(async () => {
      events.push('first');
      queueMicrotask(() => {
        queueMicrotask(() => {
          lateReconcile = queue.enqueue(async () => {
            events.push('late');
          });
        });
      });
    });

    await firstReconcile;
    await lateReconcile;

    expect(events).toEqual(['first', 'late']);
  });
});
