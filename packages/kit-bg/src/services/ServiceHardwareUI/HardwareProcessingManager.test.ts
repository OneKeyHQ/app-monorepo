import { HardwareProcessingManager } from './HardwareProcessingManager';

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('HardwareProcessingManager OneKey operation lease', () => {
  it('joins repeated cancellation cleanup before handing the lease to the next operation', async () => {
    const manager = new HardwareProcessingManager();
    const gate = createDeferred();
    const cleanup = jest.fn(async () => gate.promise);
    let oldLease: ReturnType<typeof manager.getActiveOneKeyOperationLease>;
    const order: string[] = [];
    const active = manager.runExclusiveOneKeyOperation({
      operation: async (lease) => {
        oldLease = lease;
        manager.cancelOneKeyOperation(lease);
        expect(lease.signal?.aborted).toBe(true);
        const first = manager.runOneKeyOperationCleanup(lease, cleanup);
        expect(manager.runOneKeyOperationCleanup(lease, cleanup)).toBe(first);
      },
    });
    const next = manager.runExclusiveOneKeyOperation({
      operation: async (lease) => {
        manager.cancelOneKeyOperation(oldLease!);
        await manager.runOneKeyOperationCleanup(oldLease!, cleanup);
        expect(lease.signal?.aborted).toBe(false);
        order.push('next');
      },
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(order).toEqual([]);
    gate.resolve();
    await Promise.all([active, next]);
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(order).toEqual(['next']);
  });

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

  it('does not queue a best-effort operation when the channel is occupied', async () => {
    const manager = new HardwareProcessingManager();
    const activeOperation = createDeferred();
    const bestEffortOperation = jest.fn();

    const active = manager.runExclusiveOneKeyOperation({
      deviceKey: 'device-1',
      operation: async () => activeOperation.promise,
    });
    await Promise.resolve();

    await expect(
      manager.tryRunExclusiveOneKeyOperation({
        deviceKey: 'device-2',
        operation: bestEffortOperation,
      }),
    ).resolves.toEqual({ acquired: false });

    activeOperation.resolve();
    await active;
    expect(bestEffortOperation).not.toHaveBeenCalled();
  });
});
