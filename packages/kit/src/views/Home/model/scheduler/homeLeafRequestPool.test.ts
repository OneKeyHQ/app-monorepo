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
});
