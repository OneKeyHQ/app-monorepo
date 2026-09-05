import { OneKeyLocalError } from '../errors';

import { TravelModeManager } from './TravelModeManager';

import type { ITravelModeControlStorage } from './types';

function buildStorage(initialValue?: string | null) {
  let value = initialValue;
  const storage: ITravelModeControlStorage = {
    async getItem() {
      return value;
    },
    async removeItem() {
      value = null;
    },
    async setItem(nextValue) {
      value = nextValue;
    },
  };
  return {
    storage,
    getValue: () => value,
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
    await expect(manager.isActive()).resolves.toBe(false);
    expect(manager.isMaskingDataSync()).toBe(false);
    await expect(manager.getPersistedEnabled()).resolves.toBe(true);
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

  test('applies an activation only when replacement runtimes initialize', async () => {
    const initial = JSON.stringify({
      enabled: false,
      verifyString: '|VS|verifier',
      version: 1,
    });
    const { storage, getValue } = buildStorage(initial);
    const manager = new TravelModeManager(storage, true);
    const operation = jest.fn(async () => 'visible');

    await manager.transition({ enabled: true });
    const currentEnvironment = await manager.getRuntimeEnvironment();
    await expect(
      currentEnvironment.persistence.run({
        operation,
        onBlocked: () => 'hidden',
      }),
    ).resolves.toBe('visible');

    expect(JSON.parse(getValue() ?? '')).toMatchObject({ enabled: true });
    expect(operation).toHaveBeenCalledTimes(1);

    const replacementManager = new TravelModeManager(storage, true);
    const replacementEnvironment =
      await replacementManager.getRuntimeEnvironment();
    await expect(
      replacementEnvironment.persistence.run({
        operation,
        onBlocked: () => 'hidden',
      }),
    ).resolves.toBe('hidden');
    expect(operation).toHaveBeenCalledTimes(1);
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
});
