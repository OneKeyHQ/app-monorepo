import type { IBackgroundApi } from '../../apis/IBackgroundApi';

type IIdentityLifecycleRecoveryResult = {
  recoveredOperationCount: number;
  abandonedOperationCount: number;
};

type IIdentityLifecycleRecoveryBackgroundApi = {
  serviceIdentityExit: Pick<
    IBackgroundApi['serviceIdentityExit'],
    'recoverInterruptedIdentityExitOperations'
  >;
  simpleDb: {
    prime: Pick<
      IBackgroundApi['simpleDb']['prime'],
      'hasPendingIdentityLifecycleRecovery'
    >;
  };
};

export async function recoverInterruptedIdentityLifecycleOperations(
  backgroundApi: IIdentityLifecycleRecoveryBackgroundApi,
): Promise<IIdentityLifecycleRecoveryResult> {
  const hasPendingRecovery =
    await backgroundApi.simpleDb.prime.hasPendingIdentityLifecycleRecovery();
  if (!hasPendingRecovery) {
    return {
      recoveredOperationCount: 0,
      abandonedOperationCount: 0,
    };
  }
  return backgroundApi.serviceIdentityExit.recoverInterruptedIdentityExitOperations();
}
