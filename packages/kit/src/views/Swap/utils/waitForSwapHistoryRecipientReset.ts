type IRecipientResetOptions = {
  reset: () => Promise<unknown>;
  readIsEnabled: () => Promise<boolean>;
  subscribe: (callback: () => void) => () => void;
  timeoutMs?: number;
};

export function waitForSwapHistoryRecipientReset({
  reset,
  readIsEnabled,
  subscribe,
  timeoutMs = 5000,
}: IRecipientResetOptions) {
  let cancel = () => {};
  const promise = new Promise<boolean>((resolve, reject) => {
    let settled = false;
    let resetFinished = false;
    let readVersion = 0;
    let unsubscribe = () => {};
    const timeout: { current?: ReturnType<typeof setTimeout> } = {};
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout.current);
      unsubscribe();
      callback();
    };
    timeout.current = setTimeout(() => {
      finish(() => reject(new Error('Recipient setting reset timed out')));
    }, timeoutMs);
    cancel = () => finish(() => resolve(false));
    const check = () => {
      if (!resetFinished || settled) return;
      readVersion += 1;
      const version = readVersion;
      void Promise.resolve()
        .then(readIsEnabled)
        .then(
          (enabled) => {
            if (!enabled && version === readVersion) {
              finish(() => resolve(true));
            }
          },
          (error: unknown) => finish(() => reject(error)),
        );
    };

    try {
      unsubscribe = subscribe(check);
      void reset().then(
        () => {
          resetFinished = true;
          check();
        },
        (error: unknown) => finish(() => reject(error)),
      );
    } catch (error) {
      finish(() => reject(error));
    }
  });
  return { promise, cancel: () => cancel() };
}
