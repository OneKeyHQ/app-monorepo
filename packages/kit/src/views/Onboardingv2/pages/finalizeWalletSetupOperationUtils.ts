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

// A retry can start a new setup run while the previous one is still
// settling, so the shared ref belongs to the newer attempt: an older attempt only releases the operation it opened itself.
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

// First-contact cleanup belongs to the attempt that started it, not the last
// asynchronous callback to return. Invalidating also retires late UI results.
export class FinalizeWalletSetupAttempts {
  private current = 0;

  private firstContact: number | undefined;

  begin(): number {
    this.current += 1;
    return this.current;
  }

  isCurrent(attempt: number): boolean {
    return attempt === this.current;
  }

  startFirstContact(attempt: number): void {
    if (this.isCurrent(attempt)) this.firstContact = attempt;
  }

  finishFirstContact(attempt: number): void {
    if (this.firstContact === attempt) this.firstContact = undefined;
  }

  invalidate(): boolean {
    const shouldCancelFirstContact = this.firstContact === this.current;
    this.current += 1;
    this.firstContact = undefined;
    return shouldCancelFirstContact;
  }
}
