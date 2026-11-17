import { checkSesBehavior } from './runtimeCheckBehavior';
import { withSesCheckDeadline } from './runtimeCheckDeadline';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

test('a pending check fails at its deadline and cancels its resources', async () => {
  let resourceSignal: AbortSignal | undefined;
  const result = checkSesBehavior(
    'pending native call',
    'fixture',
    (signal) => {
      resourceSignal = signal;
      return new Promise<string>(() => {});
    },
    { timeoutMs: 100 },
  );
  await jest.advanceTimersByTimeAsync(100);
  expect(await result).toMatchObject({
    status: 'fail',
    detail: 'pending native call exceeded 100ms',
  });
  expect(resourceSignal?.aborted).toBe(true);
  expect(jest.getTimerCount()).toBe(0);
});

test('successful and rejected work release their timers', async () => {
  await expect(withSesCheckDeadline('success', () => 42)).resolves.toBe(42);
  await expect(
    withSesCheckDeadline('failure', () =>
      Promise.reject(new Error('fixture failure')),
    ),
  ).rejects.toThrow('fixture failure');
  expect(jest.getTimerCount()).toBe(0);
});

test('pre-cancelled work is not started', async () => {
  const controller = new AbortController();
  controller.abort();
  const task = jest.fn(() => 42);
  await expect(
    withSesCheckDeadline('cancelled work', task, { signal: controller.signal }),
  ).rejects.toThrow('cancelled work cancelled');
  expect(task).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
});

test('parent cancellation rejects pending work without waiting for its deadline', async () => {
  const controller = new AbortController();
  const result = withSesCheckDeadline('child', () => new Promise(() => {}), {
    signal: controller.signal,
  });
  const outcome = result.catch((error: unknown) => error);
  controller.abort();
  expect(await outcome).toMatchObject({ message: 'child cancelled' });
  expect(jest.getTimerCount()).toBe(0);
});

test('a late completion cannot replace a timeout result', async () => {
  let finish: (value: number) => void = () => {};
  const result = withSesCheckDeadline(
    'late work',
    () =>
      new Promise<number>((resolve) => {
        finish = resolve;
      }),
    { timeoutMs: 100 },
  );
  const outcome = result.catch((error: unknown) => error);
  await jest.advanceTimersByTimeAsync(100);
  finish(42);
  expect(await outcome).toMatchObject({ message: 'late work exceeded 100ms' });
  expect(jest.getTimerCount()).toBe(0);
});
