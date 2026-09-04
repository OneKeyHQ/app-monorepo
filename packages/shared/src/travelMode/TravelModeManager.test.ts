import { OneKeyLocalError } from '../errors';

import { TravelModeManager } from './TravelModeManager';

import type { ITravelModeControlStorage } from './types';

function buildStorage(initialValue?: string | null) {
  let value = initialValue;
  let runtimeMasking: boolean | undefined;
  const storage: ITravelModeControlStorage = {
    async getItem() {
      return value;
    },
    async removeItem() {
      value = null;
    },
    getRuntimeMaskingSync() {
      return runtimeMasking;
    },
    setRuntimeMaskingSync(masking) {
      runtimeMasking = masking;
    },
    async setItem(nextValue) {
      value = nextValue;
    },
  };
  return {
    storage,
    getRuntimeMasking: () => runtimeMasking,
    getValue: () => value,
    setRuntimeMasking: (masking: boolean) => {
      runtimeMasking = masking;
    },
  };
}

describe('TravelModeManager', () => {
  test('initializes synchronously when native storage supports it', () => {
    const record = JSON.stringify({
      enabled: true,
      verifyString: '|VS|verifier',
      version: 1,
    });
    const { storage } = buildStorage(null);
    storage.getItemSync = () => record;

    const manager = new TravelModeManager(storage, true);

    expect(manager.isMaskingDataSync()).toBe(true);
  });

  test('defers asynchronous control storage reads until construction completes', async () => {
    const { storage } = buildStorage(null);
    const getItem = jest.spyOn(storage, 'getItem');

    const manager = new TravelModeManager(storage, true);

    expect(getItem).not.toHaveBeenCalled();
    await manager.ready;
    expect(getItem).toHaveBeenCalledTimes(1);
  });

  test('defers sync runtime masking publication until native runtime setup completes', async () => {
    const record = JSON.stringify({
      enabled: false,
      verifyString: '|VS|verifier',
      version: 1,
    });
    const { storage, getRuntimeMasking, setRuntimeMasking } =
      buildStorage(record);
    let bridgeInstalled = false;
    storage.getItemSync = () => record;
    storage.setRuntimeMaskingSync = (masking) => {
      if (!bridgeInstalled) {
        throw new OneKeyLocalError('shared fence unavailable');
      }
      setRuntimeMasking(masking);
    };

    const manager = new TravelModeManager(storage, true);
    await Promise.resolve();
    bridgeInstalled = true;

    await expect(manager.getRuntimeState()).resolves.toBe('inactive');
    expect(getRuntimeMasking()).toBe(false);
  });

  test('treats an absent record as inactive', async () => {
    const { storage } = buildStorage(null);
    const manager = new TravelModeManager(storage, true);

    await expect(manager.isActive()).resolves.toBe(false);
  });

  test('fails closed for an invalid record', async () => {
    const { storage } = buildStorage('{invalid');
    const manager = new TravelModeManager(storage, true);

    await expect(manager.isActive()).resolves.toBe(true);
  });

  test('fails closed when a disabled record has an empty verifier', async () => {
    const { storage } = buildStorage(
      JSON.stringify({ enabled: false, verifyString: '', version: 1 }),
    );
    const manager = new TravelModeManager(storage, true);

    await expect(manager.isActive()).resolves.toBe(true);
  });

  test('fails closed when a disabled record has a malformed verifier', async () => {
    const { storage } = buildStorage(
      JSON.stringify({ enabled: false, verifyString: 'verifier', version: 1 }),
    );
    const manager = new TravelModeManager(storage, true);

    await expect(manager.isActive()).resolves.toBe(true);
  });

  test('fails closed for a legacy device-bound verifier', async () => {
    const { storage } = buildStorage(
      JSON.stringify({
        enabled: true,
        verifyString: '|LSE1|VS|legacy',
        version: 1,
      }),
    );
    const manager = new TravelModeManager(storage, true);

    await expect(manager.isActive()).resolves.toBe(true);
    await expect(manager.getVerifyString()).rejects.toThrow(
      'verifier is unavailable',
    );
  });

  test('keeps the boot runtime profile immutable across a transition', async () => {
    const initial = JSON.stringify({
      enabled: false,
      verifyString: '|VS|verifier',
      version: 1,
    });
    const { storage } = buildStorage(initial);
    const manager = new TravelModeManager(storage, true);

    const bootProfile = await manager.getRuntimeProfile();
    await manager.transition({ enabled: true });

    expect(bootProfile).toMatchObject({
      dappRequests: 'allowed',
      kind: 'standard',
      persistence: 'real',
      walletEffects: 'enabled',
    });
    await expect(manager.getRuntimeProfile()).resolves.toBe(bootProfile);
    await expect(manager.getRuntimeState()).resolves.toBe(
      'transition-recovery',
    );
  });

  test('exports only a synthetic active control record after a failed read', async () => {
    const { storage } = buildStorage(null);
    storage.getItem = async () => {
      throw new OneKeyLocalError('read failed');
    };
    const manager = new TravelModeManager(storage, true);

    const value = await manager.getBootstrapControlValue();

    expect(JSON.parse(value ?? '')).toEqual({
      enabled: true,
      verifyString: '',
      version: 1,
    });
  });

  test('blocks new protected operations before activation drains', async () => {
    const initial = JSON.stringify({
      enabled: false,
      verifyString: '|VS|verifier',
      version: 1,
    });
    const { storage, getRuntimeMasking, getValue, setRuntimeMasking } =
      buildStorage(initial);
    let signalFenceClosed: (() => void) | undefined;
    const fenceClosed = new Promise<void>((resolve) => {
      signalFenceClosed = resolve;
    });
    storage.setRuntimeMaskingSync = (masking) => {
      setRuntimeMasking(masking);
      if (masking) {
        signalFenceClosed?.();
      }
    };
    const manager = new TravelModeManager(storage, true);
    const release = await manager.beginProtectedOperation();
    const transition = manager.transition({ enabled: true });

    await fenceClosed;
    expect(getRuntimeMasking()).toBe(true);
    await expect(manager.beginProtectedOperation()).resolves.toBeUndefined();
    release?.();
    await transition;

    expect(JSON.parse(getValue() ?? '')).toMatchObject({ enabled: true });
    await expect(manager.isActive()).resolves.toBe(true);
  });

  test('honors a masking fence published by the other native runtime', async () => {
    const { storage } = buildStorage(null);
    storage.getRuntimeMaskingSync = () => true;
    const manager = new TravelModeManager(storage, true);

    await manager.ready;

    expect(manager.isMaskingDataSync()).toBe(true);
    await expect(manager.beginProtectedOperation()).resolves.toBeUndefined();
  });

  test('returns the blocked value without running protected work', async () => {
    const initial = JSON.stringify({
      enabled: true,
      verifyString: '|VS|verifier',
      version: 1,
    });
    const { storage } = buildStorage(initial);
    const manager = new TravelModeManager(storage, true);
    const operation = jest.fn(async () => 'visible');

    await expect(
      manager.runProtectedOperation({
        operation,
        onBlocked: () => 'hidden',
      }),
    ).resolves.toBe('hidden');
    expect(operation).not.toHaveBeenCalled();
  });

  test('aborts activation when the cross-runtime fence cannot close', async () => {
    const initial = JSON.stringify({
      enabled: false,
      verifyString: '|VS|verifier',
      version: 1,
    });
    const { storage, getValue } = buildStorage(initial);
    let publishCount = 0;
    storage.setRuntimeMaskingSync = () => {
      publishCount += 1;
      if (publishCount > 1) {
        throw new OneKeyLocalError('shared fence unavailable');
      }
    };
    const manager = new TravelModeManager(storage, true);

    await expect(manager.transition({ enabled: true })).rejects.toThrow(
      'runtime masking fence update failed',
    );
    expect(JSON.parse(getValue() ?? '')).toMatchObject({ enabled: false });
    await expect(manager.getRuntimeState()).resolves.toBe(
      'transition-recovery',
    );
  });

  test('keeps masking after deactivation until restart', async () => {
    const initial = JSON.stringify({
      enabled: true,
      verifyString: '|VS|verifier',
      version: 1,
    });
    const { storage, getValue } = buildStorage(initial);
    const manager = new TravelModeManager(storage, true);

    await manager.transition({ enabled: false });

    expect(JSON.parse(getValue() ?? '')).toMatchObject({ enabled: false });
    await expect(manager.isActive()).resolves.toBe(true);
    await expect(manager.getRuntimeState()).resolves.toBe(
      'transition-recovery',
    );
  });

  test('restores the dedicated verifier and travel profile after restart', async () => {
    const { storage } = buildStorage(null);
    const manager = new TravelModeManager(storage, true);

    await manager.transition({
      enabled: true,
      verifyString: '|VS|portable',
    });

    const replacementManager = new TravelModeManager(storage, true);

    await expect(replacementManager.getVerifyString()).resolves.toBe(
      '|VS|portable',
    );
    await expect(replacementManager.getRuntimeProfile()).resolves.toMatchObject(
      {
        kind: 'travel-mode',
        persistence: 'masked',
      },
    );
  });

  test('does not roll back after the new state is committed', async () => {
    const initial = JSON.stringify({
      enabled: false,
      verifyString: '|VS|verifier',
      version: 1,
    });
    const { storage, getValue, setRuntimeMasking } = buildStorage(initial);
    let publishCount = 0;
    storage.setRuntimeMaskingSync = (masking) => {
      publishCount += 1;
      if (publishCount === 3) {
        throw new OneKeyLocalError('shared fence unavailable');
      }
      setRuntimeMasking(masking);
    };
    const manager = new TravelModeManager(storage, true);

    await expect(manager.transition({ enabled: true })).rejects.toThrow(
      'runtime masking fence update failed',
    );

    expect(JSON.parse(getValue() ?? '')).toMatchObject({ enabled: true });
    await expect(manager.getRuntimeState()).resolves.toBe(
      'transition-recovery',
    );
    expect(manager.isMaskingDataSync()).toBe(true);
  });
});
