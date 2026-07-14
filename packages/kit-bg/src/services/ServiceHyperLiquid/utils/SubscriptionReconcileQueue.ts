import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

export class LatestSubscriptionReconcileQueue {
  private pendingTask: (() => Promise<void>) | null = null;

  private runningPromise: Promise<void> | null = null;

  enqueue(task: () => Promise<void>): Promise<void> {
    this.pendingTask = task;
    if (!this.runningPromise) {
      this.runningPromise = this.drain().finally(() => {
        this.runningPromise = null;
      });
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
    if (firstError) {
      throw new OneKeyLocalError(firstError.message);
    }
  }
}
