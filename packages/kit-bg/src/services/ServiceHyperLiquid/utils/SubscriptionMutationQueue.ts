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
