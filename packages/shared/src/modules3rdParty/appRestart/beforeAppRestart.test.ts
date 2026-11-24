/*
yarn jest packages/shared/src/modules3rdParty/appRestart/beforeAppRestart.test.ts

Handlers that run before a full restart: every one runs, and neither a failing
nor a slow one can stop the restart.
*/

import { OneKeyLocalError } from '../../errors';

import {
  BEFORE_APP_RESTART_TIMEOUT_MS,
  addBeforeAppRestartHandler,
  runBeforeAppRestartHandlers,
} from './beforeAppRestart';
import { EAppRestartMode } from './types';

const OPTIONS = { mode: EAppRestartMode.All, reason: 'test.restart' };

describe('beforeAppRestart', () => {
  let removeHandlers: (() => void)[] = [];
  const add = (handler: Parameters<typeof addBeforeAppRestartHandler>[0]) => {
    removeHandlers.push(addBeforeAppRestartHandler(handler));
  };

  afterEach(() => {
    removeHandlers.forEach((remove) => remove());
    removeHandlers = [];
    jest.useRealTimers();
  });

  it('resolves at once when nothing is registered', async () => {
    await expect(runBeforeAppRestartHandlers(OPTIONS)).resolves.toBeUndefined();
  });

  it('waits for every handler and passes the restart options on', async () => {
    const finished: string[] = [];
    const first = jest.fn(async () => {
      await Promise.resolve();
      finished.push('first');
    });
    const second = jest.fn(async () => {
      finished.push('second');
    });
    add(first);
    add(second);

    await runBeforeAppRestartHandlers(OPTIONS);

    expect(first).toHaveBeenCalledWith(OPTIONS);
    expect(second).toHaveBeenCalledWith(OPTIONS);
    expect(finished.toSorted()).toEqual(['first', 'second']);
  });

  it('does not reject when a handler fails, and still runs the others', async () => {
    const working = jest.fn(async () => undefined);
    add(async () => {
      throw new OneKeyLocalError('disconnect failed');
    });
    add(() => {
      throw new OneKeyLocalError('threw before returning a promise');
    });
    add(working);

    await expect(runBeforeAppRestartHandlers(OPTIONS)).resolves.toBeUndefined();
    expect(working).toHaveBeenCalledTimes(1);
  });

  it('stops waiting for a handler that never finishes', async () => {
    jest.useFakeTimers();
    add(() => new Promise<void>(() => undefined));
    let done = false;

    const run = runBeforeAppRestartHandlers(OPTIONS).then(() => {
      done = true;
    });
    await jest.advanceTimersByTimeAsync(BEFORE_APP_RESTART_TIMEOUT_MS - 1);
    expect(done).toBe(false);

    await jest.advanceTimersByTimeAsync(1);
    await run;
    expect(done).toBe(true);
  });

  it('waits for a Lightning Self-Custody connect in flight to settle', async () => {
    jest.useFakeTimers();
    // On the iOS simulator a connect in flight took about 7 s to give its
    // SDK up; the restart must not rebuild the runtime before that.
    const SETTLE_MS = 10_000;
    add(
      () =>
        new Promise<void>((resolve) => {
          setTimeout(resolve, SETTLE_MS);
        }),
    );
    let done = false;

    const run = runBeforeAppRestartHandlers(OPTIONS).then(() => {
      done = true;
    });
    await jest.advanceTimersByTimeAsync(SETTLE_MS - 1);
    expect(done).toBe(false);

    await jest.advanceTimersByTimeAsync(1);
    await run;
    expect(done).toBe(true);
  });

  it('no longer calls a handler that was removed', async () => {
    const handler = jest.fn(async () => undefined);
    const remove = addBeforeAppRestartHandler(handler);
    remove();

    await runBeforeAppRestartHandlers(OPTIONS);

    expect(handler).not.toHaveBeenCalled();
  });
});
