export class LoggerRuntime {
  private _pendingEntries: Array<{
    entry: unknown;
    processor: (entry: unknown) => void;
  }> = [];

  enqueueOrProcess<T>(
    isReady: boolean,
    entry: T,
    processor: (resolvedEntry: T) => void,
  ): void {
    if (isReady) {
      processor(entry);
      return;
    }

    this._pendingEntries.push({
      entry,
      processor: processor as (resolvedEntry: unknown) => void,
    });
  }

  drain(): void {
    const queued = this._pendingEntries;
    this._pendingEntries = [];

    for (const { entry, processor } of queued) {
      processor(entry);
    }
  }
}

export const loggerRuntime = new LoggerRuntime();
