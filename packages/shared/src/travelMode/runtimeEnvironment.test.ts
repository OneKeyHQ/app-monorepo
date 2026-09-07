import { OneKeyLocalError } from '../errors';

import { RuntimeEnvironment } from './runtimeEnvironment';
import { getTravelModeRuntimeProfile } from './runtimeProfile';

type IStringPersistence = {
  get(): Promise<string | undefined>;
  set(value: string): Promise<void>;
};

function createRealPersistence(state: { value?: string }): IStringPersistence {
  return {
    async get() {
      return state.value;
    },
    async set(value) {
      state.value = value;
    },
  };
}

function createMaskedPersistence(): IStringPersistence {
  return {
    async get() {
      return undefined;
    },
    async set(_value) {},
  };
}

describe('RuntimeEnvironment', () => {
  it('creates immutable and independent main/bg environments', () => {
    const profile = getTravelModeRuntimeProfile(true);
    const main = RuntimeEnvironment.create(profile);
    const background = RuntimeEnvironment.create(profile);

    expect(main).not.toBe(background);
    expect(main.profile).toBe(background.profile);
    expect(main.persistence.kind).toBe('masked');
    expect(background.walletEffects.kind).toBe('suppressed');
    expect(Object.isFrozen(main)).toBe(true);
    expect(Object.isFrozen(main.persistence)).toBe(true);
    expect(Object.isFrozen(main.walletEffects)).toBe(true);
    expect(Object.isFrozen(main.notifications)).toBe(true);
    expect(Object.isFrozen(main.commands)).toBe(true);
    expect(Object.isFrozen(main.dappRequests)).toBe(true);
  });

  it.each([
    'Realm',
    'IndexedDB',
    'AppStorage',
    'business MMKV',
    'secure storage',
  ])('does not construct the real %s backend in a masked runtime', (name) => {
    const environment = RuntimeEnvironment.create(
      getTravelModeRuntimeProfile(true),
    );
    const createReal = jest.fn(() => {
      throw new OneKeyLocalError(`poison backend opened: ${name}`);
    });
    const masked = { name: 'masked' };

    const selected = environment.persistence.createAdapter({
      real: createReal,
      masked: () => masked,
    });

    expect(selected).toBe(masked);
    expect(createReal).not.toHaveBeenCalled();
  });

  it.each([
    { expectedRead: 'persisted', masked: false },
    { expectedRead: undefined, masked: true },
  ])(
    'runs the persistence contract for masked=$masked',
    async ({ expectedRead, masked }) => {
      const state = { value: 'persisted' };
      const environment = RuntimeEnvironment.create(
        getTravelModeRuntimeProfile(masked),
      );
      const persistence = environment.persistence.createAdapter({
        real: () => createRealPersistence(state),
        masked: createMaskedPersistence,
      });

      await expect(persistence.get()).resolves.toBe(expectedRead);
      await expect(persistence.set('changed')).resolves.toBeUndefined();
      expect(state.value).toBe(masked ? 'persisted' : 'changed');
    },
  );

  it('suppresses effects and default-denies commands without starting work', async () => {
    const environment = RuntimeEnvironment.create(
      getTravelModeRuntimeProfile(true),
    );
    const effect = jest.fn(async () => 'visible');
    const command = jest.fn(async () => 'visible');

    await expect(
      environment.walletEffects.run({
        operation: effect,
        onBlocked: () => 'empty',
      }),
    ).resolves.toBe('empty');
    await expect(environment.commands.run(command)).rejects.toThrow(
      'Unknown error',
    );
    await expect(environment.dappRequests.run(command)).rejects.toThrow(
      'Unknown error',
    );
    expect(effect).not.toHaveBeenCalled();
    expect(command).not.toHaveBeenCalled();
  });

  it('runs standard capabilities directly from the immutable boot profile', async () => {
    const environment = RuntimeEnvironment.create(
      getTravelModeRuntimeProfile(false),
    );
    const operation = jest.fn(async () => 'visible');
    const createRealAdapter = jest.fn(() => ({ kind: 'real' }));
    const maskedAdapter = { kind: 'masked' };

    expect(
      environment.persistence.createAdapter({
        real: createRealAdapter,
        masked: () => maskedAdapter,
      }),
    ).toEqual({ kind: 'real' });

    await expect(
      environment.persistence.run({
        operation,
        onBlocked: () => 'empty',
      }),
    ).resolves.toBe('visible');
    await expect(environment.commands.run(operation)).resolves.toBe('visible');
    expect(operation).toHaveBeenCalledTimes(2);
    expect(createRealAdapter).toHaveBeenCalledTimes(1);
  });

  it('uses one blocked callback for protocol-level command rejection', async () => {
    const environment = RuntimeEnvironment.create(
      getTravelModeRuntimeProfile(true),
    );
    const operation = jest.fn(async () => ({ result: 'visible' }));

    await expect(
      environment.dappRequests.runWithBlockedResult<
        { error: string } | { result: string }
      >({
        operation,
        onBlocked: () => ({ error: 'Unknown error' }),
      }),
    ).resolves.toEqual({ error: 'Unknown error' });
    expect(operation).not.toHaveBeenCalled();
  });

  it('delays a gate rejection by 600ms without starting the operation', async () => {
    jest.useFakeTimers();
    try {
      const environment = RuntimeEnvironment.create(
        getTravelModeRuntimeProfile(true),
      );
      const operation = jest.fn(async () => 'visible');
      const onRejected = jest.fn();
      const result = environment.commands.run(operation).catch((error) => {
        onRejected(error);
        return error as Error;
      });

      await jest.advanceTimersByTimeAsync(599);
      expect(onRejected).not.toHaveBeenCalled();

      await jest.advanceTimersByTimeAsync(1);
      await expect(result).resolves.toMatchObject({ message: 'Unknown error' });
      expect(onRejected).toHaveBeenCalledTimes(1);
      expect(operation).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});
