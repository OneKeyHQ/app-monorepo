import { HomeRequestScheduler } from './homeRequestScheduler';

function deferred() {
  let resolve: (() => void) | undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve: () => resolve?.() };
}

describe('HomeRequestScheduler', () => {
  it('bounds running work and drains by priority', async () => {
    const first = deferred();
    const order: string[] = [];
    const scheduler = new HomeRequestScheduler({
      maxRunning: 1,
      requestLeaf: jest.fn(),
    });
    const schedule = (
      taskId: string,
      priority: 'interactive' | 'critical' | 'background',
      run: () => Promise<void>,
    ) =>
      scheduler.schedule({
        taskId,
        key: taskId,
        groupKey: 'group-a',
        clientInstanceId: 'client-a',
        appEpoch: 'epoch-a',
        sessionId: 'session-a',
        requestGroupId: `group:${taskId}`,
        priority,
        policy: 'queue',
        timeoutMs: 5000,
        run: async () => {
          order.push(taskId);
          await run();
        },
      });

    const firstOutcome = schedule('first', 'background', () => first.promise);
    const backgroundOutcome = schedule(
      'background',
      'background',
      async () => undefined,
    );
    const interactiveOutcome = schedule(
      'interactive',
      'interactive',
      async () => undefined,
    );
    expect(scheduler.getSnapshot().runningCount).toBe(1);
    first.resolve();
    await firstOutcome;
    await interactiveOutcome;
    await backgroundOutcome;

    expect(order).toEqual(['first', 'interactive', 'background']);
    expect(scheduler.getSnapshot()).toMatchObject({
      pendingCount: 0,
      runningCount: 0,
      peakRunningCount: 1,
    });
  });

  it('cancels a complete owner session without admitting stale pending work', async () => {
    const running = deferred();
    const scheduler = new HomeRequestScheduler({
      maxRunning: 1,
      requestLeaf: jest.fn(),
    });
    const createTask = (taskId: string) =>
      scheduler.schedule({
        taskId,
        key: taskId,
        groupKey: 'group-a',
        clientInstanceId: 'client-a',
        appEpoch: 'epoch-a',
        sessionId: 'session-a',
        requestGroupId: `group:${taskId}`,
        priority: 'background',
        policy: 'queue',
        timeoutMs: 5000,
        run: () => running.promise,
      });
    const active = createTask('active');
    const pending = createTask('pending');

    scheduler.cancelSession('session-a');
    running.resolve();

    await expect(active).resolves.toEqual({ kind: 'cancelled' });
    await expect(pending).resolves.toEqual({ kind: 'cancelled' });
  });

  it('supersedes the same source group when its key changes', async () => {
    const stale = deferred();
    const scheduler = new HomeRequestScheduler({
      maxRunning: 2,
      requestLeaf: jest.fn(),
    });
    const schedule = (taskId: string, key: string, run: () => Promise<void>) =>
      scheduler.schedule({
        taskId,
        key,
        groupKey: 'session-a',
        clientInstanceId: 'client-a',
        appEpoch: 'epoch-a',
        sessionId: 'session-a',
        requestGroupId: 'session-a:portfolio',
        priority: 'interactive',
        policy: 'takeLatest',
        timeoutMs: 5000,
        run,
      });

    const staleOutcome = schedule(
      'stale',
      'portfolio:old',
      () => stale.promise,
    );
    const currentOutcome = schedule(
      'current',
      'portfolio:new',
      async () => undefined,
    );

    await expect(currentOutcome).resolves.toEqual({
      kind: 'fulfilled',
      value: undefined,
    });
    stale.resolve();
    await expect(staleOutcome).resolves.toEqual({ kind: 'superseded' });
  });

  it('admits a reused session behind its cancelled running generation', async () => {
    const cancelledGeneration = deferred();
    const nextRun = jest.fn(async () => undefined);
    const scheduler = new HomeRequestScheduler({
      maxRunning: 1,
      requestLeaf: jest.fn(),
    });
    const schedule = (taskId: string, run: () => Promise<void>) =>
      scheduler.schedule({
        taskId,
        key: 'portfolio:key',
        groupKey: 'session-a',
        clientInstanceId: 'client-a',
        appEpoch: 'epoch-a',
        sessionId: 'session-a',
        requestGroupId: 'session-a:portfolio',
        priority: 'critical',
        policy: 'exhaust',
        timeoutMs: 5000,
        run,
      });
    const cancelledOutcome = schedule(
      'cancelled-generation',
      () => cancelledGeneration.promise,
    );

    scheduler.cancelSession('session-a');
    const nextOutcome = schedule('next-generation', nextRun);
    expect(nextRun).not.toHaveBeenCalled();
    expect(scheduler.getSnapshot()).toMatchObject({
      pendingCount: 1,
      runningCount: 1,
    });

    cancelledGeneration.resolve();
    await expect(cancelledOutcome).resolves.toEqual({ kind: 'cancelled' });
    await expect(nextOutcome).resolves.toEqual({
      kind: 'fulfilled',
      value: undefined,
    });
    expect(nextRun).toHaveBeenCalledTimes(1);
  });
});
