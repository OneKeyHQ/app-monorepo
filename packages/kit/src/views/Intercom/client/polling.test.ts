import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { createSupportPollingTask } from './polling';

const tasks: ReturnType<typeof createSupportPollingTask>[] = [];
function task(run: () => Promise<void>, interval = 15_000) {
  const current = createSupportPollingTask(run, interval);
  tasks.push(current);
  return current;
}
beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(Math, 'random').mockReturnValue(0);
});
afterEach(() => {
  tasks.splice(0).forEach((current) => current.stop());
  jest.useRealTimers();
  jest.restoreAllMocks();
});
it('backs off failures to five minutes, ignores pushes during backoff, then resets on success', async () => {
  const run = jest.fn(async (): Promise<void> => {
    throw new OneKeyLocalError('offline');
  });
  const current = task(run);
  await current.refresh();
  expect(run).toHaveBeenCalledTimes(1);
  current.push();
  await jest.advanceTimersByTimeAsync(29_999);
  expect(run).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(1);
  expect(run).toHaveBeenCalledTimes(2);
  for (const delay of [60_000, 120_000, 240_000, 300_000, 300_000]) {
    const count = run.mock.calls.length;
    await jest.advanceTimersByTimeAsync(delay - 1);
    expect(run).toHaveBeenCalledTimes(count);
    await jest.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledTimes(count + 1);
  }
  run.mockImplementation(async () => {});
  await jest.advanceTimersByTimeAsync(300_000);
  const count = run.mock.calls.length;
  await jest.advanceTimersByTimeAsync(15_000);
  expect(run).toHaveBeenCalledTimes(count + 1);
});
it('retries a failed one-shot read with exponential backoff and stops after success', async () => {
  const run = jest.fn(async (): Promise<void> => {
    throw new OneKeyLocalError('offline');
  });
  const current = createSupportPollingTask(run);
  tasks.push(current);
  await current.refresh();
  expect(run).toHaveBeenCalledTimes(1);
  for (const delay of [30_000, 60_000, 120_000, 240_000, 300_000, 300_000]) {
    const count = run.mock.calls.length;
    await jest.advanceTimersByTimeAsync(delay - 1);
    expect(run).toHaveBeenCalledTimes(count);
    await jest.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledTimes(count + 1);
  }
  run.mockImplementation(async () => {});
  await jest.advanceTimersByTimeAsync(300_000);
  const count = run.mock.calls.length;
  expect(jest.getTimerCount()).toBe(0);
  await jest.advanceTimersByTimeAsync(3_600_000);
  expect(run).toHaveBeenCalledTimes(count);
});
it('coalesces concurrent refreshes and push hints without overlapping requests', async () => {
  let resolve!: () => void;
  const run = jest.fn(
    () =>
      new Promise<void>((done) => {
        resolve = done;
      }),
  );
  const current = task(run);
  const pending = current.refresh();
  await jest.advanceTimersByTimeAsync(0);
  current.push();
  current.push();
  void current.refresh();
  await jest.advanceTimersByTimeAsync(60_000);
  expect(run).toHaveBeenCalledTimes(1);
  resolve();
  await pending;
  await jest.advanceTimersByTimeAsync(0);
  expect(run).toHaveBeenCalledTimes(2);
  current.stop();
  resolve();
  await jest.advanceTimersByTimeAsync(60_000);
  expect(run).toHaveBeenCalledTimes(2);
});
it('uses one timer for unread, inbox and conversation jobs and cancels all work on stop', async () => {
  const run = jest.fn(async (): Promise<void> => {});
  const active = [task(run, 30_000), task(run), task(run)];
  await Promise.all(active.map((current) => current.refresh()));
  expect(jest.getTimerCount()).toBe(1);
  await jest.advanceTimersByTimeAsync(15_000);
  expect(run).toHaveBeenCalledTimes(5);
  active.forEach((current) => current.stop());
  expect(jest.getTimerCount()).toBe(0);
  await jest.advanceTimersByTimeAsync(300_000);
  expect(run).toHaveBeenCalledTimes(5);
});
it('allows explicit retry during backoff and never starts a task stopped before its first microtask', async () => {
  const run = jest.fn(async (): Promise<void> => {
    throw new OneKeyLocalError('offline');
  });
  const current = task(run);
  await current.refresh();
  await current.refresh();
  expect(run).toHaveBeenCalledTimes(2);
  const stopped = task(run);
  const pending = stopped.refresh();
  stopped.stop();
  await pending;
  expect(run).toHaveBeenCalledTimes(2);
});
