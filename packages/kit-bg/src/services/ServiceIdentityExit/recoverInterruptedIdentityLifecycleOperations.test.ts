import { recoverInterruptedIdentityLifecycleOperations } from './recoverInterruptedIdentityLifecycleOperations';

describe('recoverInterruptedIdentityLifecycleOperations', () => {
  function createFixture(hasPendingRecovery: boolean) {
    const recoverInterruptedIdentityExitOperations = jest.fn(async () => ({
      recoveredOperationCount: 1,
      abandonedOperationCount: 2,
    }));
    const hasPendingIdentityLifecycleRecovery = jest.fn(
      async () => hasPendingRecovery,
    );
    const backgroundApi = {
      serviceIdentityExit: {
        recoverInterruptedIdentityExitOperations,
      },
      simpleDb: {
        prime: {
          hasPendingIdentityLifecycleRecovery,
        },
      },
    };
    return {
      backgroundApi,
      hasPendingIdentityLifecycleRecovery,
      recoverInterruptedIdentityExitOperations,
    };
  }

  it('keeps the full identity-exit service unloaded when there is no journal', async () => {
    const fixture = createFixture(false);

    await expect(
      recoverInterruptedIdentityLifecycleOperations(fixture.backgroundApi),
    ).resolves.toEqual({
      recoveredOperationCount: 0,
      abandonedOperationCount: 0,
    });
    expect(fixture.hasPendingIdentityLifecycleRecovery).toHaveBeenCalledTimes(
      1,
    );
    expect(
      fixture.recoverInterruptedIdentityExitOperations,
    ).not.toHaveBeenCalled();
  });

  it('loads the identity-exit service when a recovery journal exists', async () => {
    const fixture = createFixture(true);

    await expect(
      recoverInterruptedIdentityLifecycleOperations(fixture.backgroundApi),
    ).resolves.toEqual({
      recoveredOperationCount: 1,
      abandonedOperationCount: 2,
    });
    expect(
      fixture.recoverInterruptedIdentityExitOperations,
    ).toHaveBeenCalledTimes(1);
  });
});
