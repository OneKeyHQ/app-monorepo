import { OneKeyLocalError } from '../errors';

import { TravelModeManager } from './TravelModeManager';

import type { ITravelModeControlStorage } from './types';

function buildStorage(initialValue?: string | null) {
  let value = initialValue;
  let generation = 0;
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
    getRuntimeGenerationSync: () => generation,
    setRuntimeGenerationSync(nextGeneration) {
      generation = nextGeneration;
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
    expect(manager.getRuntimeStateSync()).toBe('active');
  });

  test('defers asynchronous control storage reads until construction completes', async () => {
    const { storage } = buildStorage(null);
    const getItem = jest.spyOn(storage, 'getItem');

    const manager = new TravelModeManager(storage, true);

    expect(getItem).not.toHaveBeenCalled();
    expect(manager.getRuntimeStateSync()).toBe('initializing');
    await manager.ready;
    expect(getItem).toHaveBeenCalledTimes(1);
    expect(manager.getRuntimeStateSync()).toBe('inactive');
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

  test('blocks cached main/bg capabilities through activation and restart failure', async () => {
    const { storage } = buildStorage(null);
    const main = new TravelModeManager(storage, true);
    const background = new TravelModeManager(storage, true);
    const environments = await Promise.all([
      main.getRuntimeEnvironment(),
      background.getRuntimeEnvironment(),
    ]);
    const operation = jest.fn(async () => 'started');
    for (const environment of environments) {
      await expect(
        environment.walletEffects.runOrReject(operation),
      ).resolves.toBe('started');
    }
    operation.mockClear();

    await background.transition({
      enabled: true,
      verifyString: '|VS|verifier',
    });
    background.markRestartFailed();

    for (const environment of environments) {
      expect(environment.profile.kind).toBe('standard');
      expect(environment.persistence.kind).toBe('real');
      expect(environment.walletEffects.isSuppressed).toBe(true);
      expect(environment.notifications.isSuppressed).toBe(true);
      await expect(environment.commands.run(operation)).rejects.toThrow(
        'Unknown error',
      );
      await expect(environment.dappRequests.run(operation)).rejects.toThrow(
        'Unknown error',
      );
      await expect(
        environment.walletEffects.runOrReject(operation),
      ).rejects.toThrow('Unknown error');
    }
    expect(operation).not.toHaveBeenCalled();
    await expect(main.getRuntimeState()).resolves.toBe('transition-recovery');

    const travelBackground = new TravelModeManager(storage, true);
    await travelBackground.transition({ enabled: false });
    const standardBackground = new TravelModeManager(storage, true);
    const standardEnvironment =
      await standardBackground.getRuntimeEnvironment();
    await expect(
      standardEnvironment.walletEffects.runOrReject(operation),
    ).resolves.toBe('started');
    expect(environments[0].walletEffects.isSuppressed).toBe(true);
    expect(environments[1].walletEffects.isSuppressed).toBe(true);
  });

  test('blocks a runtime initialized while the new control record is being written', async () => {
    const { storage } = buildStorage(null);
    const background = new TravelModeManager(storage, true);
    const write = storage.setItem.bind(storage);
    let concurrentMain: TravelModeManager | undefined;
    storage.setItem = async (value) => {
      concurrentMain = new TravelModeManager(storage, true);
      await concurrentMain.ready;
      await write(value);
    };

    await background.transition({
      enabled: true,
      verifyString: '|VS|verifier',
    });

    expect(concurrentMain).toBeDefined();
    const environment = await concurrentMain?.getRuntimeEnvironment();
    expect(environment?.profile.kind).toBe('standard');
    expect(environment?.walletEffects.isSuppressed).toBe(true);
  });

  test.each([false, true])(
    'releases the transition gate only after verified rollback (failed=%s)',
    async (rollbackFails) => {
      const { storage } = buildStorage(null);
      const main = new TravelModeManager(storage, true);
      const background = new TravelModeManager(storage, true);
      const environment = await main.getRuntimeEnvironment();
      storage.setItem = async () => {
        expect(environment.walletEffects.isSuppressed).toBe(true);
        throw new OneKeyLocalError('write failed');
      };
      if (rollbackFails) {
        storage.removeItem = async () => {
          throw new OneKeyLocalError('rollback failed');
        };
      }

      await expect(
        background.transition({ enabled: true, verifyString: '|VS|verifier' }),
      ).rejects.toThrow('write failed');

      expect(environment.walletEffects.isSuppressed).toBe(rollbackFails);
      await expect(background.getRuntimeState()).resolves.toBe(
        rollbackFails ? 'transition-recovery' : 'inactive',
      );
    },
  );

  test('keeps effects blocked when the native generation cannot be read', async () => {
    const { storage } = buildStorage(null);
    const manager = new TravelModeManager(storage, true);
    const environment = await manager.getRuntimeEnvironment();
    storage.getRuntimeGenerationSync = () => undefined;
    expect(environment.walletEffects.isSuppressed).toBe(true);
    storage.getRuntimeGenerationSync = () => {
      throw new OneKeyLocalError('native store unavailable');
    };
    expect(environment.commands.isBlocked).toBe(true);
  });

  test('leaves unsupported platforms independent of the native transition gate', async () => {
    const { storage } = buildStorage(null);
    storage.getRuntimeGenerationSync = () => {
      throw new OneKeyLocalError('native store unavailable');
    };
    const manager = new TravelModeManager(storage, false);
    const environment = await manager.getRuntimeEnvironment();
    expect(environment.walletEffects.isSuppressed).toBe(false);
    expect(environment.commands.isBlocked).toBe(false);
  });
});
