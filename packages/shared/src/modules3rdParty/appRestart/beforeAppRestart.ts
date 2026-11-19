import type { IAppRestartOptions } from './types';

export type IBeforeAppRestartHandler = (
  options: IAppRestartOptions,
) => Promise<void>;

// A restart never waits longer than this for its handlers.
export const BEFORE_APP_RESTART_TIMEOUT_MS = 3000;

const handlers = new Set<IBeforeAppRestartHandler>();

/**
 * Registers work that has to finish before a restart rebuilds the background
 * runtime inside the same process, which only iOS does: whatever that runtime
 * holds in native memory keeps running after it is gone, with nothing left to
 * reach it.
 *
 * Handlers belong to the JS runtime that registers them. The main runtime
 * registers one that asks the background runtime to run its own.
 */
export function addBeforeAppRestartHandler(handler: IBeforeAppRestartHandler) {
  handlers.add(handler);
  return () => {
    handlers.delete(handler);
  };
}

/** Never rejects: a failing or slow handler must not stop the restart. */
export async function runBeforeAppRestartHandlers(
  options: IAppRestartOptions,
): Promise<void> {
  if (handlers.size === 0) {
    return;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, BEFORE_APP_RESTART_TIMEOUT_MS);
  });
  await Promise.race([
    Promise.allSettled([...handlers].map(async (handler) => handler(options))),
    timeout,
  ]);
  clearTimeout(timer);
}
