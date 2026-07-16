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

export async function executeOrderBookSubscriptionTransition<T>({
  toDestroy,
  toCreate,
  destroy,
  create,
  isPending,
  runExclusive,
  reconnect,
}: {
  toDestroy: T[];
  toCreate: T[];
  destroy: (spec: T) => Promise<boolean>;
  create: (spec: T) => Promise<void>;
  isPending: (spec: T) => boolean;
  runExclusive: <R>(task: () => Promise<R>) => Promise<R>;
  reconnect: () => Promise<void>;
}): Promise<boolean> {
  const succeeded = await runExclusive(async () => {
    for (const spec of toDestroy) {
      if (!(await destroy(spec))) {
        return false;
      }
    }
    for (const spec of toCreate) {
      if (isPending(spec)) {
        await create(spec);
      }
    }
    return true;
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
