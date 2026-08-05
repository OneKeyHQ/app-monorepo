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

    const first = manager.runExclusiveOneKeyOperation({
      deviceKey: 'device-1',
      operation: async () => {
        executionOrder.push('first:start');
        await firstOperation.promise;
        executionOrder.push('first:end');
      },
    });
    const second = manager.runExclusiveOneKeyOperation({
      deviceKey: 'device-2',
      operation: async () => {
        executionOrder.push('second:start');
      },
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

  it('reuses the lease for a nested call without releasing it to competitors', async () => {
    const manager = new HardwareProcessingManager();
    const nestedOperation = createDeferred();
    const executionOrder: string[] = [];

    const outer = manager.runExclusiveOneKeyOperation({
      deviceKey: 'device-1',
      operation: async (lease) => {
        executionOrder.push('outer:start');
        await manager.runExclusiveOneKeyOperation({
          deviceKey: 'device-1',
          lease,
          operation: async () => {
            executionOrder.push('nested:start');
            await nestedOperation.promise;
            executionOrder.push('nested:end');
          },
        });
        executionOrder.push('outer:end');
      },
    });
    const competitor = manager.runExclusiveOneKeyOperation({
      deviceKey: 'device-2',
      operation: async () => {
        executionOrder.push('competitor:start');
      },
    });

    await Promise.resolve();
    expect(executionOrder).toEqual(['outer:start', 'nested:start']);

    nestedOperation.resolve();
    await Promise.all([outer, competitor]);

    expect(executionOrder).toEqual([
      'outer:start',
      'nested:start',
      'nested:end',
      'outer:end',
      'competitor:start',
    ]);
  });
});
