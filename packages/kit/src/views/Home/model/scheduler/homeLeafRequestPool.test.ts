import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { HomeLeafRequestPool } from './homeLeafRequestPool';

function createDeferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
}

describe('HomeLeafRequestPool', () => {
  test('shares the concurrency limit and reserves capacity for urgent work', async () => {
    const clientA = new HomeLeafRequestPool(2, 'pool-test-a');
    const clientB = new HomeLeafRequestPool(2, 'pool-test-b');
    const interactive = createDeferred<string>();
    const critical = createDeferred<string>();
    const background = createDeferred<string>();
    const startBackground = jest.fn(() => background.promise);
    const startCritical = jest.fn(() => critical.promise);

    const interactiveTask = clientA.run(
      'interactive',
      () => interactive.promise,
    );
    const backgroundTask = clientB.run('background', startBackground);
    expect(startBackground).not.toHaveBeenCalled();

    const criticalTask = clientB.run('critical', startCritical);
    expect(startCritical).toHaveBeenCalledTimes(1);
    expect(startBackground).not.toHaveBeenCalled();

    interactive.resolve('interactive');
    critical.resolve('critical');
    await Promise.all([interactiveTask, criticalTask]);
    await Promise.resolve();
    expect(startBackground).toHaveBeenCalledTimes(1);

    background.resolve('background');
    await expect(backgroundTask).resolves.toBe('background');
    clientA.dispose();
    clientB.dispose();
  });

  test('runs background work when the configured limit is one', async () => {
    const client = new HomeLeafRequestPool(1, 'pool-test-single', 7);
    const start = jest.fn(async () => 'done');

    await expect(client.run('background', start)).resolves.toBe('done');
    expect(start).toHaveBeenCalledTimes(1);
    client.dispose();
  });

  test('rejects queued work when its client lease is disposed', async () => {
    const activeClient = new HomeLeafRequestPool(1, 'pool-test-active', 9);
    const queuedClient = new HomeLeafRequestPool(1, 'pool-test-queued', 9);
    const active = createDeferred<string>();
    const activeTask = activeClient.run('critical', () => active.promise);
    const queuedTask = queuedClient.run('critical', async () => 'unexpected');

    queuedClient.dispose();
    await expect(queuedTask).rejects.toThrow(
      'Shared leaf request client is disposed',
    );
    active.resolve('done');
    await expect(activeTask).resolves.toBe('done');
    activeClient.dispose();
  });

  test('removes only queued leaves owned by a cancelled session', async () => {
    const client = new HomeLeafRequestPool(1, 'pool-test-session-cancel', 11);
    const running = createDeferred<string>();
    const runningTask = client.run(
      'critical',
      () => running.promise,
      'session-running',
    );
    const cancelledTask = client.run(
      'critical',
      async () => 'cancelled',
      'session-old',
    );
    const retainedTask = client.run(
      'critical',
      async () => 'retained',
      'session-new',
    );

    client.cancelSession('session-old');
    await expect(cancelledTask).rejects.toThrow(
      'Shared leaf request session was cancelled',
    );
    expect(client.getSnapshot()).toMatchObject({
      clientPendingCount: 1,
      runningCount: 1,
    });

    running.resolve('running');
    await expect(runningTask).resolves.toBe('running');
    await expect(retainedTask).resolves.toBe('retained');
    client.dispose();
  });

  test('aborts and rejects a running leaf owned by a cancelled session', async () => {
    const client = new HomeLeafRequestPool(
      1,
      'pool-test-running-session-cancel',
      12,
    );
    const underlying = createDeferred<string>();
    let signal: AbortSignal | undefined;
    const runningTask = client.run(
      'critical',
      (requestSignal) => {
        signal = requestSignal;
        return underlying.promise;
      },
      'session-old',
    );
    await Promise.resolve();
    const rejectedTask = runningTask.catch((error: unknown) => error);

    client.cancelSession('session-old');

    expect(signal?.aborted).toBe(true);
    await expect(rejectedTask).resolves.toMatchObject({
      message: 'Shared leaf request session was cancelled',
    });
    expect(client.getSnapshot()).toMatchObject({ runningCount: 1 });

    underlying.resolve('ignored');
    await Promise.resolve();
    await Promise.resolve();
    expect(client.getSnapshot()).toMatchObject({ runningCount: 0 });
    client.dispose();
  });

  test('allows a reused session to schedule a new request generation', async () => {
    const client = new HomeLeafRequestPool(1, 'pool-test-session-reuse', 13);
    const start = jest.fn(async () => 'recovered');

    client.cancelSession('session-old');

    await expect(client.run('critical', start, 'session-old')).resolves.toBe(
      'recovered',
    );
    expect(start).toHaveBeenCalledTimes(1);
    client.dispose();
  });

  test('allows a reused session after its cancelled leaf finishes', async () => {
    const client = new HomeLeafRequestPool(
      1,
      'pool-test-running-session-reuse',
      14,
    );
    const underlying = createDeferred<string>();
    const runningTask = client
      .run('critical', () => underlying.promise, 'session-reused')
      .catch((error: unknown) => error);

    client.cancelSession('session-reused');
    await expect(runningTask).resolves.toMatchObject({
      message: 'Shared leaf request session was cancelled',
    });

    const recoveredStart = jest.fn(async () => 'recovered');
    const recoveredTask = client.run(
      'critical',
      recoveredStart,
      'session-reused',
    );
    expect(recoveredStart).not.toHaveBeenCalled();

    underlying.resolve('ignored');
    await expect(recoveredTask).resolves.toBe('recovered');
    expect(recoveredStart).toHaveBeenCalledTimes(1);
    client.dispose();
  });

  test('treats every session cancellation as a new boundary', async () => {
    const client = new HomeLeafRequestPool(
      1,
      'pool-test-repeated-session-cancel',
      15,
    );
    const firstGeneration = createDeferred<string>();
    const firstTask = client
      .run('critical', () => firstGeneration.promise, 'session-repeated')
      .catch((error: unknown) => error);

    client.cancelSession('session-repeated');
    await expect(firstTask).resolves.toMatchObject({
      message: 'Shared leaf request session was cancelled',
    });
    firstGeneration.resolve('ignored');
    await Promise.resolve();

    const secondGeneration = createDeferred<string>();
    const secondTask = client
      .run('critical', () => secondGeneration.promise, 'session-repeated')
      .catch((error: unknown) => error);
    await Promise.resolve();

    client.cancelSession('session-repeated');
    await expect(secondTask).resolves.toMatchObject({
      message: 'Shared leaf request session was cancelled',
    });
    secondGeneration.resolve('ignored');
    client.dispose();
  });

  test('releases capacity when a leaf throws synchronously', async () => {
    const client = new HomeLeafRequestPool(1, 'pool-test-sync-throw', 16);

    await expect(
      client.run('critical', () => {
        throw new OneKeyLocalError('sync leaf failure');
      }),
    ).rejects.toThrow('sync leaf failure');
    await expect(client.run('critical', async () => 'recovered')).resolves.toBe(
      'recovered',
    );
    expect(client.getSnapshot()).toMatchObject({ runningCount: 0 });
    client.dispose();
  });
});
