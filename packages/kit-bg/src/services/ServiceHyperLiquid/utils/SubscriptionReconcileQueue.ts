import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

export class LatestSubscriptionReconcileQueue {
  private pendingTask: (() => Promise<void>) | null = null;

  private runningPromise: Promise<void> | null = null;

  enqueue(task: () => Promise<void>): Promise<void> {
    this.pendingTask = task;
    if (!this.runningPromise) {
      this.runningPromise = this.drain();
    }
    return this.runningPromise;
  }

  private async drain(): Promise<void> {
    let firstError: Error | undefined;
    while (this.pendingTask) {
      const task = this.pendingTask;
      this.pendingTask = null;
      try {
        await task();
      } catch (error) {
        firstError ??=
          error instanceof Error ? error : new Error(String(error));
      }
    }
    // Clear the running marker before this async function settles. A task
    // queued by an already-scheduled microtask will then start a new drain.
    this.runningPromise = null;
    if (firstError) {
      throw new OneKeyLocalError(firstError.message);
    }
  }
}
