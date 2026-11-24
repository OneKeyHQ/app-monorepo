import { OneKeyLocalError } from '../../errors';

export type ISesCheckDeadline = {
  timeoutMs?: number;
  signal?: AbortSignal;
};

export async function withSesCheckDeadline<T>(
  name: string,
  task: (signal: AbortSignal) => T | Promise<T>,
  { timeoutMs = 10_000, signal }: ISesCheckDeadline = {},
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new OneKeyLocalError(`${name} requires a positive finite timeout`);
  }
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort = () => {};
  const stopped = new Promise<never>((_resolve, reject) => {
    onAbort = () => {
      reject(new OneKeyLocalError(`${name} cancelled`));
      controller.abort();
    };
    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener('abort', onAbort, { once: true });
    timer = setTimeout(() => {
      reject(new OneKeyLocalError(`${name} exceeded ${timeoutMs}ms`));
      controller.abort();
    }, timeoutMs);
  });
  try {
    if (signal?.aborted) return await stopped;
    return await Promise.race([
      Promise.resolve().then(() => {
        if (controller.signal.aborted)
          throw new OneKeyLocalError(`${name} cancelled`);
        return task(controller.signal);
      }),
      stopped,
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
    controller.abort();
  }
}
