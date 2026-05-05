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

  it('drops oldest entries when pending queue exceeds MAX_PENDING', () => {
    const runtime = new LoggerRuntime();
    const processed: number[] = [];

    for (let i = 0; i < 510; i += 1) {
      runtime.enqueueOrProcess(false, i, (value) => {
        processed.push(value);
      });
    }

    runtime.drain();

    expect(processed.length).toBe(500);
    expect(processed[0]).toBe(10);
    expect(processed[499]).toBe(509);
  });
});
