/* cspell:ignore Infini */
type ISessionPersistenceTask<T> = () => Promise<T>;

export function createPrimeInfiniPaymentSessionQueue() {
  let queue: Promise<void> = Promise.resolve();
  let finalized = false;

  const enqueue = <T>(task: ISessionPersistenceTask<T>) => {
    const pendingTask = queue.catch(() => undefined).then(task);
    queue = pendingTask.then(
      () => undefined,
      () => undefined,
    );
    return pendingTask;
  };

  return {
    persist<T>(task: ISessionPersistenceTask<T>) {
      return finalized ? Promise.resolve(undefined) : enqueue(task);
    },
    async finalize<T>(task: ISessionPersistenceTask<T>) {
      finalized = true;
      try {
        return await enqueue(task);
      } catch (error) {
        finalized = false;
        throw error;
      }
    },
  };
}
