import {
  createAuthLoginInterruptionCleanup,
  createSignalCleanupHandler,
  registerActiveAuthFlowCleanup,
  resetActiveAuthFlowCleanupForTests,
  runActiveAuthFlowCleanup,
} from '../core/auth/auth-flow-interruption';
import { AppError, ERROR_CODES } from '../errors';

describe('auth-flow-interruption', () => {
  afterEach(() => {
    resetActiveAuthFlowCleanupForTests();
  });

  it('runs the active auth flow cleanup only once', async () => {
    const cleanup = jest.fn(async () => undefined);

    registerActiveAuthFlowCleanup(cleanup);

    await Promise.all([
      runActiveAuthFlowCleanup(),
      runActiveAuthFlowCleanup(),
      runActiveAuthFlowCleanup(),
    ]);

    expect(cleanup).toHaveBeenCalledTimes(1);

    await runActiveAuthFlowCleanup();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('builds interrupted auth login cleanup from runtime disposal and session rollback', async () => {
    const replaceActiveSession = jest.fn(async () => undefined);
    const clearSession = jest.fn(async () => undefined);

    const cleanup = createAuthLoginInterruptionCleanup({
      clearSession,
      replaceActiveSession,
    });

    await cleanup();

    expect(replaceActiveSession).toHaveBeenCalledWith(null);
    expect(clearSession).toHaveBeenCalledTimes(1);
  });

  it('waits for cleanup before clearing secure cache and exiting', async () => {
    let resolveCleanup: (() => void) | undefined;
    const runCleanup = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveCleanup = resolve;
        }),
    );
    const clearSecureCache = jest.fn(() => undefined);
    const exit = jest.fn(() => undefined);

    const handler = createSignalCleanupHandler({
      exitCode: 130,
      runCleanup,
      clearSecureCache,
      exit,
    });

    handler();
    expect(runCleanup).toHaveBeenCalledTimes(1);
    expect(clearSecureCache).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();

    resolveCleanup?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(clearSecureCache).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(130);
  });

  it('still exits when signal cleanup throws', async () => {
    const runCleanup = jest.fn(async () => {
      throw new AppError(
        ERROR_CODES.SEC_STORAGE_ERROR.code,
        'cleanup failed',
        'retry',
      );
    });
    const clearSecureCache = jest.fn(() => undefined);
    const exit = jest.fn(() => undefined);

    const handler = createSignalCleanupHandler({
      exitCode: 143,
      runCleanup,
      clearSecureCache,
      exit,
    });

    handler();
    await Promise.resolve();
    await Promise.resolve();

    expect(clearSecureCache).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(143);
  });
});
