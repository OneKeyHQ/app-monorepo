import { LoggerRuntime } from './loggerRuntime';

describe('LoggerRuntime', () => {
  it('queues entries until config becomes ready and drains them in order', () => {
    const runtime = new LoggerRuntime();
    const processed: number[] = [];

    runtime.enqueueOrProcess(false, 1, (value) => {
      processed.push(value);
    });
    runtime.enqueueOrProcess(false, 2, (value) => {
      processed.push(value);
    });

    expect(processed).toEqual([]);

    runtime.drain();

    expect(processed).toEqual([1, 2]);

    runtime.drain();

    expect(processed).toEqual([1, 2]);
  });

  it('processes entries immediately once config is ready', () => {
    const runtime = new LoggerRuntime();
    const processed: number[] = [];

    runtime.enqueueOrProcess(true, 42, (value) => {
      processed.push(value);
    });

    expect(processed).toEqual([42]);
  });
});
