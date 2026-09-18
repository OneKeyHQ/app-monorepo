import type { EHardwareVendor } from '@onekeyhq/shared/types/device';

export interface IFinalizeWalletSetupOperation {
  vendor: EHardwareVendor;
  operationId: string;
}

export interface IFinalizeWalletSetupActiveOperation extends IFinalizeWalletSetupOperation {
  attempt: number;
}

export interface IFinalizeWalletSetupOperationRelease {
  operationToRelease: IFinalizeWalletSetupOperation | undefined;
  shouldClearActiveOperation: boolean;
}

// A retry can start a new setup run while the previous one is still settling.
// The shared ref then belongs to the newer attempt, so a finishing older
// attempt must neither clear it nor release the operation it points at — it
// only releases the operation it opened itself.
export function resolveOperationReleaseForAttempt({
  attempt,
  activeOperation,
  ownOperation,
}: {
  attempt: number;
  activeOperation: IFinalizeWalletSetupActiveOperation | undefined;
  ownOperation: IFinalizeWalletSetupOperation | undefined;
}): IFinalizeWalletSetupOperationRelease {
  const isCurrentAttempt = activeOperation?.attempt === attempt;
  if (isCurrentAttempt) {
    return {
      operationToRelease: activeOperation,
      shouldClearActiveOperation: true,
    };
  }
  return {
    operationToRelease: ownOperation,
    shouldClearActiveOperation: false,
  };
}
