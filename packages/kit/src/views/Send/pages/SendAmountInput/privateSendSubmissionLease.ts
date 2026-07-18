import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

export type IPrivateSendSubmissionLease = {
  id: string;
  scopeKey: string;
  phase: 'validating' | 'building' | 'orderCreated' | 'postCreateFailure';
};

export class PrivateSendSubmissionLeaseCoordinator {
  private current?: IPrivateSendSubmissionLease;

  acquire(scopeKey: string): IPrivateSendSubmissionLease | undefined {
    if (this.current) {
      return undefined;
    }
    const lease: IPrivateSendSubmissionLease = {
      id: generateUUID(),
      scopeKey,
      phase: 'validating',
    };
    this.current = lease;
    return lease;
  }

  isPreBuildOwner(lease: IPrivateSendSubmissionLease, liveScopeKey: string) {
    return (
      this.current === lease &&
      (lease.phase === 'validating' || lease.phase === 'building') &&
      lease.scopeKey === liveScopeKey
    );
  }

  markBuilding(lease: IPrivateSendSubmissionLease, liveScopeKey: string) {
    if (!this.isPreBuildOwner(lease, liveScopeKey)) {
      return false;
    }
    lease.phase = 'building';
    return true;
  }

  markOrderCreated(lease: IPrivateSendSubmissionLease) {
    const isExpectedTransition =
      this.current === lease && lease.phase === 'building';
    if (!isExpectedTransition) {
      // The provider order already exists. Even when the local lease is in an
      // unexpected state, fail closed so this component cannot create another
      // external order for the same user action.
      lease.phase = 'postCreateFailure';
      if (!this.current) {
        this.current = lease;
      }
      return false;
    }
    lease.phase = 'orderCreated';
    return true;
  }

  shouldContinueCreatedOrder(lease: IPrivateSendSubmissionLease) {
    return this.current === lease && lease.phase === 'orderCreated';
  }

  markPostCreateFailure(lease: IPrivateSendSubmissionLease) {
    if (
      this.current === lease &&
      (lease.phase === 'orderCreated' || lease.phase === 'postCreateFailure')
    ) {
      lease.phase = 'postCreateFailure';
      return true;
    }
    return false;
  }

  markBuildOutcomeUnknown(lease: IPrivateSendSubmissionLease) {
    if (this.current === lease && lease.phase === 'building') {
      // A rejected create-order request has an ambiguous outcome: the server
      // may have created the external order before its response was lost.
      // Keep this component fail-closed instead of making an unsafe retry.
      lease.phase = 'postCreateFailure';
      return true;
    }
    return false;
  }

  hasPostCreateFailure() {
    return this.current?.phase === 'postCreateFailure';
  }

  releasePreOrderFailure(lease: IPrivateSendSubmissionLease) {
    if (
      this.current === lease &&
      (lease.phase === 'validating' || lease.phase === 'building')
    ) {
      this.current = undefined;
      return true;
    }
    return false;
  }

  completeCreatedOrder(lease: IPrivateSendSubmissionLease) {
    if (this.current === lease && lease.phase === 'orderCreated') {
      this.current = undefined;
      return true;
    }
    return false;
  }
}

export async function runPrivateSendOrderBuild<TBuild, TValidated>({
  coordinator,
  lease,
  liveScopeKey,
  build,
  validate,
}: {
  coordinator: PrivateSendSubmissionLeaseCoordinator;
  lease: IPrivateSendSubmissionLease;
  liveScopeKey: string;
  build: () => Promise<TBuild>;
  validate: (result: TBuild) => Promise<TValidated> | TValidated;
}): Promise<
  { status: 'scopeChanged' } | { status: 'validated'; value: TValidated }
> {
  if (!coordinator.markBuilding(lease, liveScopeKey)) {
    return { status: 'scopeChanged' };
  }

  let result: TBuild;
  try {
    result = await build();
  } catch (error) {
    coordinator.markBuildOutcomeUnknown(lease);
    throw error;
  }
  // A successful response from this non-idempotent build endpoint means the
  // provider create-order operation may have completed even if the response is
  // malformed or missing its order payload. Cross the irreversible boundary
  // before parsing any response fields so validation failure cannot unlock a
  // second submission.
  if (!coordinator.markOrderCreated(lease)) {
    throw new OneKeyLocalError(
      'Private Send submission lease lost after provider order creation',
    );
  }

  try {
    return {
      status: 'validated',
      value: await validate(result),
    };
  } catch (error) {
    coordinator.markPostCreateFailure(lease);
    throw error;
  }
}

export function createPrivateSendCreatedOrderLifecycle<TSuccess>({
  coordinator,
  lease,
  onSuccess,
  onFail,
  onCancel,
  onPostCreateFailure,
}: {
  coordinator: PrivateSendSubmissionLeaseCoordinator;
  lease: IPrivateSendSubmissionLease;
  onSuccess?: (data: TSuccess) => Promise<void> | void;
  onFail?: (error: Error) => void;
  onCancel?: () => void;
  onPostCreateFailure: (reason: 'failed' | 'cancelled', error?: Error) => void;
}) {
  return {
    onSuccess: async (data: TSuccess) => {
      try {
        await onSuccess?.(data);
      } finally {
        coordinator.completeCreatedOrder(lease);
      }
    },
    onFail: (error: Error) => {
      coordinator.markPostCreateFailure(lease);
      onPostCreateFailure('failed', error);
      onFail?.(error);
    },
    onCancel: () => {
      coordinator.markPostCreateFailure(lease);
      onPostCreateFailure('cancelled');
      onCancel?.();
    },
  };
}
