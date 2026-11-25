import type { IEarnTaskScope } from '@onekeyhq/kit/src/views/Earn/tasks/earnTaskPlan';
import { createEarnTaskReservationRegistry } from '@onekeyhq/kit/src/views/Earn/tasks/earnTaskReservationRegistry';
import type { IEarnWorkflowTask } from '@onekeyhq/kit/src/views/Earn/tasks/earnWorkflowTaskState';
import { normalizeTaskAccountAddress } from '@onekeyhq/kit/src/views/Earn/tasks/taskAddress';

export type IBorrowApprovalScope = {
  accountId: string;
  networkId: string;
  accountAddress: string;
  kind: 'token' | 'delegation';
  target: string;
  asset: string;
};
type IApprovalController = {
  getTask: () => IEarnWorkflowTask<IEarnTaskScope>;
  recordRecovery: (params: {
    stepId: string;
    attemptId: string;
    txid: string;
    status: 'confirmed' | 'failed';
  }) => boolean;
};

function keyOf(scope: IBorrowApprovalScope) {
  const normalize = (address: string) =>
    normalizeTaskAccountAddress(scope.networkId, address);
  return JSON.stringify([
    scope.networkId,
    normalize(scope.accountAddress),
    scope.kind,
    normalize(scope.target),
    normalize(scope.asset),
  ]);
}

/** Runtime-local reservations retain the task itself, not a copy of its status. */
export function createBorrowApprovalTaskRegistry() {
  const registry = createEarnTaskReservationRegistry<
    string,
    { accountId: string; controller: IApprovalController }
  >();
  const owned = (scope: IBorrowApprovalScope, token: symbol) => {
    const entry = registry.find(keyOf(scope));
    return Boolean(
      entry &&
      entry.token === token &&
      entry.controller.accountId === scope.accountId,
    );
  };
  return {
    find: (scope: IBorrowApprovalScope) => {
      const entry = registry.find(keyOf(scope));
      if (!entry) return undefined;
      if (entry.controller.accountId !== scope.accountId)
        return { type: 'conflict' as const };
      return {
        type: 'owned' as const,
        token: entry.token,
        controller: entry.controller.controller,
      };
    },
    reserve: (scope: IBorrowApprovalScope, controller: IApprovalController) =>
      controller.getTask().identity.accountId === scope.accountId
        ? registry.reserve(keyOf(scope), {
            accountId: scope.accountId,
            controller,
          })
        : undefined,
    release: (scope: IBorrowApprovalScope, token: symbol) =>
      owned(scope, token) && registry.release(keyOf(scope), token),
    acquireRecovery: (scope: IBorrowApprovalScope, token: symbol) =>
      owned(scope, token)
        ? registry.acquireRecovery(keyOf(scope), token)
        : undefined,
    releaseRecovery: (
      scope: IBorrowApprovalScope,
      token: symbol,
      lease: symbol,
    ) =>
      owned(scope, token) &&
      registry.releaseRecovery(keyOf(scope), token, lease),
  };
}

export const borrowApprovalTaskRegistry = createBorrowApprovalTaskRegistry();
