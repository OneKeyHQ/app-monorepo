import { HardwareProcessingManager } from './HardwareProcessingManager';

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('HardwareProcessingManager OneKey operation lease', () => {
  it('allows only one OneKey operation to own SDK UI responses at a time', async () => {
    const manager = new HardwareProcessingManager();
    const firstOperation = createDeferred();
    const executionOrder: string[] = [];

    const first = manager.runExclusiveOneKeyOperation(async () => {
      executionOrder.push('first:start');
      await firstOperation.promise;
      executionOrder.push('first:end');
    });
    const second = manager.runExclusiveOneKeyOperation(async () => {
      executionOrder.push('second:start');
    });

    await Promise.resolve();
    expect(executionOrder).toEqual(['first:start']);

    firstOperation.resolve();
    await Promise.all([first, second]);

    expect(executionOrder).toEqual([
      'first:start',
      'first:end',
      'second:start',
    ]);
  });
});
