type IRegistrationResult<T> =
  | { type: 'registered'; adapter: T }
  | { type: 'cancelled' }
  | { type: 'failed'; error: unknown };

/** Private one-shot handoff from asynchronous preflight to a workflow step. */
export function createEarnTaskAdapterRegistration<T>() {
  let settled = false;
  let resolveResult: (result: IRegistrationResult<T>) => void = () => undefined;
  const result = new Promise<IRegistrationResult<T>>((resolve) => {
    resolveResult = resolve;
  });
  const settle = (value: IRegistrationResult<T>) => {
    if (settled) return false;
    settled = true;
    resolveResult(value);
    return true;
  };
  const cancel = () => settle({ type: 'cancelled' });
  return {
    register: (adapter: T) => settle({ type: 'registered', adapter }),
    fail: (error: unknown) => settle({ type: 'failed', error }),
    cancel,
    wait: async (signal: AbortSignal): Promise<T | undefined> => {
      if (signal.aborted) cancel();
      else signal.addEventListener('abort', cancel, { once: true });
      try {
        const outcome = await result;
        if (signal.aborted || outcome.type === 'cancelled') return undefined;
        if (outcome.type === 'failed') throw outcome.error;
        return outcome.adapter;
      } finally {
        signal.removeEventListener('abort', cancel);
      }
    },
  };
}
