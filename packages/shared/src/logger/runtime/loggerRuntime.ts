export class LoggerRuntime {
  private static MAX_PENDING = 500;

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

    if (this._pendingEntries.length >= LoggerRuntime.MAX_PENDING) {
      this._pendingEntries.shift();
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
      try {
        processor(entry);
      } catch (error) {
        console.error('Logger drain error:', error);
      }
    }
  }
}

export const loggerRuntime = new LoggerRuntime();
