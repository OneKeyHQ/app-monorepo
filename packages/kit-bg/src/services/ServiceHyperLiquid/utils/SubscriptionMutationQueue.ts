export class PerKeyMutationQueue {
  private queues = new Map<string, Promise<unknown>>();

  enqueue<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(key) ?? Promise.resolve();
    const nextTask = previous.then(task, task);
    const trackedTask = nextTask.catch(() => undefined);
    this.queues.set(key, trackedTask);
    void trackedTask.finally(() => {
      if (this.queues.get(key) === trackedTask) {
        this.queues.delete(key);
      }
    });
    return nextTask;
  }
}

export async function executeOrderBookSubscriptionTransition<
  T extends { key: string },
>({
  toDestroy,
  toCreate,
  destroy,
  create,
  isPending,
  getConflictKey,
  runExclusive,
  reconnect,
}: {
  toDestroy: T[];
  toCreate: T[];
  destroy: (spec: T) => Promise<boolean>;
  create: (spec: T) => Promise<void>;
  isPending: (spec: T) => boolean;
  getConflictKey: (spec: T) => string;
  runExclusive: <R>(task: () => Promise<R>) => Promise<R>;
  reconnect: () => Promise<void>;
}): Promise<boolean> {
  // Overlapping targets (same coin, e.g. a grouping change or same-key
  // re-create) must stay destroy-first: frames carry only the coin, so the
  // old stream is indistinguishable and would corrupt the new book. Distinct
  // coins subscribe first to save one server RTT; stale-coin frames are
  // dropped by coin checks.
  const destroyConflictKeys = new Set(toDestroy.map(getConflictKey));
  const hasTargetOverlap = toCreate.some((spec) =>
    destroyConflictKeys.has(getConflictKey(spec)),
  );

  const succeeded = await runExclusive(async () => {
    const destroyAll = async () => {
      for (const spec of toDestroy) {
        if (!(await destroy(spec))) {
          return false;
        }
      }
      return true;
    };
    const createAllPending = async () => {
      for (const spec of toCreate) {
        if (isPending(spec)) {
          await create(spec);
        }
      }
    };

    if (hasTargetOverlap) {
      if (!(await destroyAll())) {
        return false;
      }
      await createAllPending();
      return true;
    }

    await createAllPending();
    return destroyAll();
  });

  if (!succeeded) {
    await reconnect();
  }
  return succeeded;
}

export async function executeSubscriptionTasksWithOrderBookPriority({
  orderBookTask,
  otherTasks,
}: {
  orderBookTask: () => Promise<unknown>;
  otherTasks: Array<() => Promise<unknown>>;
}): Promise<void> {
  const orderBookPromise = orderBookTask();
  const otherPromises = otherTasks.map((task) => task());
  await Promise.all([orderBookPromise, ...otherPromises]);
}
