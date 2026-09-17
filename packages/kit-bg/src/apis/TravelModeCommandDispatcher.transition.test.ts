import { TravelModeManager } from '@onekeyhq/shared/src/travelMode/TravelModeManager';
import type { ITravelModeControlStorage } from '@onekeyhq/shared/src/travelMode/types';

import { TravelModeCommandDispatcher } from './TravelModeCommandDispatcher';

let mockManager: TravelModeManager;

jest.mock('@onekeyhq/shared/src/travelMode', () => ({
  get travelModeManager() {
    return mockManager;
  },
}));

function buildManager(enabled: boolean, sync = true) {
  let value: string | null = JSON.stringify({
    enabled,
    verifyString: '|VS|test-verifier',
    version: 1,
  });
  let generation = 0;
  const storage: ITravelModeControlStorage = {
    getItem: async () => value,
    ...(sync ? { getItemSync: () => value } : {}),
    removeItem: async () => {
      value = null;
    },
    setItem: async (nextValue) => {
      value = nextValue;
    },
    getRuntimeGenerationSync: () => generation,
    setRuntimeGenerationSync: (nextGeneration) => {
      generation = nextGeneration;
    },
  };
  mockManager = new TravelModeManager(storage, true);
  return { manager: mockManager, storage };
}

describe('TravelModeCommandDispatcher transition admission', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it.each([false, true])(
    'never starts a business read after a transition from enabled=%s closes admission',
    async (enabled) => {
      const { manager } = buildManager(enabled);
      const dispatcher = new TravelModeCommandDispatcher();
      const blockedAtStart: boolean[] = [];
      const operation = jest.fn(async () => {
        const runtimeState = manager.getRuntimeStateSync();
        blockedAtStart.push(
          runtimeState !== 'active' && runtimeState !== 'inactive',
        );
        return 'wallet-data';
      });
      const transition = manager.transition({ enabled: !enabled });

      // Interleave the transition with admission after it reads a stable state.
      await Promise.resolve();
      await Promise.resolve();
      const request = dispatcher.runTransportServiceCall({
        method: 'serviceAccount.getWallets',
        operation,
      });
      await Promise.all([
        request.catch((error: unknown) => {
          expect(error).toMatchObject({ message: 'Unknown error' });
        }),
        jest.advanceTimersByTimeAsync(600),
        transition,
      ]);
      // Starting before the transition is valid; starting after its gate closes is not.
      expect(blockedAtStart).not.toContain(true);
    },
  );

  it('rejects a changed shared generation while preserving recovery retry', async () => {
    const { storage } = buildManager(false);
    const dispatcher = new TravelModeCommandDispatcher();
    const operation = jest.fn(async () => 'result');
    const updateGeneration = Promise.resolve().then(() => {
      storage.setRuntimeGenerationSync?.(1);
    });
    const request = dispatcher.runTransportServiceCall({
      method: 'serviceAccount.getWallets',
      operation,
    });
    await Promise.all([
      expect(request).rejects.toThrow('Unknown error'),
      jest.advanceTimersByTimeAsync(600),
      updateGeneration,
    ]);
    expect(operation).not.toHaveBeenCalled();

    await expect(
      dispatcher.runTransportServiceCall({
        method: 'serviceTravelMode.retryRestart',
        operation,
      }),
    ).resolves.toBe('result');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it.each([false, true])(
    'allows public initialization in a stable enabled=%s runtime',
    async (enabled) => {
      buildManager(enabled);
      const dispatcher = new TravelModeCommandDispatcher();
      const operation = jest.fn(async () => 'public-data');

      await expect(
        dispatcher.runTransportServiceCall({
          method: 'serviceDiscovery.fetchDiscoveryHomePageData',
          operation,
        }),
      ).resolves.toBe('public-data');
      expect(operation).toHaveBeenCalledTimes(1);
    },
  );

  it('waits for initialization before checking the runtime synchronously', async () => {
    buildManager(true, false);
    const dispatcher = new TravelModeCommandDispatcher();
    const operation = jest.fn(async () => 'public-data');

    await expect(
      dispatcher.runTransportServiceCall({
        method: 'serviceDiscovery.fetchDiscoveryHomePageData',
        operation,
      }),
    ).resolves.toBe('public-data');
    expect(operation).toHaveBeenCalledTimes(1);
  });
});
