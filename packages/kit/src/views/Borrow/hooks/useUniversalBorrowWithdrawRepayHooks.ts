import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import {
  getTaskAccountAddress,
  isTaskAccountCurrent,
  normalizeTaskAccountAddress,
} from '@onekeyhq/kit/src/views/Earn/tasks/taskAccount';
import { useEarnRiskWarningGate } from '@onekeyhq/kit/src/views/Staking/components/EarnRiskWarningDialog';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IModalSendParamList } from '@onekeyhq/shared/src/routes';
import type { IStakingInfo } from '@onekeyhq/shared/types/staking';

import { runBorrowConfirmationTask } from './borrowConfirmationTask';
import { useBorrowConfirmationScope } from './useBorrowConfirmationScope';

import type { IBorrowWorkflowHandoff } from './borrowConfirmationTask';
import type { IBorrowSettleResult } from './borrowTransactionUtils';

export {
  attachBorrowOrderId,
  handleBorrowSuccess,
  parseBorrowEncodedTx,
} from './borrowTransactionUtils';
export type { IBorrowSettleResult } from './borrowTransactionUtils';

export type IBorrowBuildTxParams = {
  amount: string;
  provider: string;
  marketAddress: string;
  reserveAddress: string;
  collateralReserveAddress?: string;
  withdrawAll?: boolean;
  repayAll?: boolean;
  unwrap?: boolean;
  needsSetupLut?: boolean;
  slippageBps?: number;
  routeKey?: string;
  stakingInfo?: IStakingInfo;
  onSetupLutReadyForRepay?: () => void;
  isActionCurrent?: () => boolean;
  onBeforeNavigate?: () => void | Promise<void>;
  canContinueAfterOwnerClose?: () => boolean;
  accountAddress?: string;
  workflowHandoff?: IBorrowWorkflowHandoff;
  ignoreOrderTrackingError?: boolean;
  onSettleResult?: (
    result: IBorrowSettleResult,
  ) => boolean | void | Promise<boolean | void>;
  onSuccess?: IModalSendParamList['SendConfirm']['onSuccess'];
  onFail?: IModalSendParamList['SendConfirm']['onFail'];
  onCancel?: IModalSendParamList['SendConfirm']['onCancel'];
};

// The dialog logs which asset the user was about to trade; borrow params carry
// the token on stakingInfo rather than as a plain symbol.
const getRiskGateSymbol = (stakingInfo?: IStakingInfo) =>
  stakingInfo?.send?.token.symbol ?? stakingInfo?.receive?.token.symbol;

/**
 * Resolves true once the flow has been handed to the transaction confirm page,
 * false when it never started — today only a declined risk disclaimer, but the
 * point is that no callback fires and nothing throws on that path. A caller
 * that took a lock (submit guard, spinner) before calling MUST release it on
 * false; `onSuccess` / `onFail` / `onCancel` are never invoked.
 */
export function useUniversalBorrowWithdraw({
  networkId,
  accountId,
  accountAddress,
}: {
  networkId: string;
  accountId: string;
  accountAddress?: string;
}) {
  const { navigationToTxConfirm } = useSignatureConfirm({
    accountId,
    networkId,
  });

  const ensureRiskAccepted = useEarnRiskWarningGate();
  const captureScope = useBorrowConfirmationScope(
    JSON.stringify([
      accountId,
      networkId,
      accountAddress
        ? normalizeTaskAccountAddress(networkId, accountAddress)
        : undefined,
    ]),
  );

  return useCallback(
    async ({
      amount,
      provider,
      marketAddress,
      reserveAddress,
      withdrawAll,
      unwrap,
      stakingInfo,
      onBeforeNavigate,
      canContinueAfterOwnerClose,
      accountAddress: approvalAccountAddress,
      workflowHandoff,
      onSettleResult,
      onSuccess,
      onFail,
      onCancel,
    }: IBorrowBuildTxParams): Promise<boolean> => {
      const scope = captureScope(canContinueAfterOwnerClose);
      if (!scope.isCurrent()) return false;
      // OK-59196: one-time DeFi risk disclaimer, same gate the earn stake flow
      // uses. Returns false so the caller can tell a rejection apart from a
      // completed hand-off and leave the form untouched.
      if (
        !(await ensureRiskAccepted({
          provider,
          symbol: getRiskGateSymbol(stakingInfo),
          networkId,
        }))
      ) {
        return false;
      }
      if (!scope.isCurrent()) return false;
      if (
        !approvalAccountAddress &&
        !accountAddress &&
        !scope.isOwnedCurrent()
      ) {
        throw new OneKeyLocalError('Borrow approval account unavailable');
      }
      const frozenAddress =
        approvalAccountAddress ??
        accountAddress ??
        (await getTaskAccountAddress({ accountId, networkId }));
      if (
        !approvalAccountAddress &&
        !accountAddress &&
        !scope.isOwnedCurrent()
      ) {
        throw new OneKeyLocalError('Borrow approval account unavailable');
      }
      if (!scope.isCurrent()) return false;
      const accountMatches = await isTaskAccountCurrent({
        accountId,
        networkId,
        accountAddress: frozenAddress,
      });
      if (!scope.isCurrent()) return false;
      if (!accountMatches) {
        throw new OneKeyLocalError('Borrow transaction confirmation expired');
      }
      return runBorrowConfirmationTask({
        identity: {
          accountId,
          networkId,
          accountAddress: frozenAddress,
          provider,
          action: 'withdraw',
          intent: {
            marketAddress,
            reserveAddress,
            amount,
            withdrawAll,
            unwrap,
          },
        },
        build: () =>
          backgroundApiProxy.serviceStaking.borrowBuildWithdrawTransaction({
            networkId,
            accountId,
            expectedAccountAddress: frozenAddress,
            provider,
            marketAddress,
            reserveAddress,
            amount,
            withdrawAll,
            ...(unwrap !== undefined ? { unwrap } : {}),
          }),
        stakingInfo,
        navigationToTxConfirm,
        isCurrent: scope.isCurrent,
        onBeforeNavigate,
        onSettleResult,
        onSuccess,
        onFail,
        onCancel,
        workflowHandoff,
      });
    },
    [
      accountAddress,
      accountId,
      captureScope,
      ensureRiskAccepted,
      networkId,
      navigationToTxConfirm,
    ],
  );
}

/**
 * Resolves true once the flow has been handed to the transaction confirm page,
 * false when it never started — today only a declined risk disclaimer, but the
 * point is that no callback fires and nothing throws on that path. A caller
 * that took a lock (submit guard, spinner) before calling MUST release it on
 * false; `onSuccess` / `onFail` / `onCancel` are never invoked.
 */
export function useUniversalBorrowRepay({
  networkId,
  accountId,
  accountAddress,
}: {
  networkId: string;
  accountId: string;
  accountAddress?: string;
}) {
  const { navigationToTxConfirm } = useSignatureConfirm({
    accountId,
    networkId,
  });

  const ensureRiskAccepted = useEarnRiskWarningGate();
  const captureScope = useBorrowConfirmationScope(
    JSON.stringify([
      accountId,
      networkId,
      accountAddress
        ? normalizeTaskAccountAddress(networkId, accountAddress)
        : undefined,
    ]),
  );

  return useCallback(
    async ({
      amount,
      provider,
      marketAddress,
      reserveAddress,
      repayAll,
      stakingInfo,
      onBeforeNavigate,
      canContinueAfterOwnerClose,
      accountAddress: approvalAccountAddress,
      workflowHandoff,
      ignoreOrderTrackingError,
      onSettleResult,
      onSuccess,
      onFail,
      onCancel,
    }: IBorrowBuildTxParams): Promise<boolean> => {
      const scope = captureScope(canContinueAfterOwnerClose);
      if (!scope.isCurrent()) return false;
      // OK-59196: one-time DeFi risk disclaimer, same gate the earn stake flow
      // uses. Returns false so the caller can tell a rejection apart from a
      // completed hand-off and leave the form untouched.
      if (
        !(await ensureRiskAccepted({
          provider,
          symbol: getRiskGateSymbol(stakingInfo),
          networkId,
        }))
      ) {
        return false;
      }
      if (!scope.isCurrent()) return false;
      if (
        !approvalAccountAddress &&
        !accountAddress &&
        !scope.isOwnedCurrent()
      ) {
        throw new OneKeyLocalError('Borrow approval account unavailable');
      }
      const frozenAddress =
        approvalAccountAddress ??
        accountAddress ??
        (await getTaskAccountAddress({ accountId, networkId }));
      if (
        !approvalAccountAddress &&
        !accountAddress &&
        !scope.isOwnedCurrent()
      ) {
        throw new OneKeyLocalError('Borrow approval account unavailable');
      }
      if (!scope.isCurrent()) return false;
      const accountMatches = await isTaskAccountCurrent({
        accountId,
        networkId,
        accountAddress: frozenAddress,
      });
      if (!scope.isCurrent()) return false;
      if (!accountMatches) {
        throw new OneKeyLocalError('Borrow transaction confirmation expired');
      }
      return runBorrowConfirmationTask({
        identity: {
          accountId,
          networkId,
          accountAddress: frozenAddress,
          provider,
          action: 'repay',
          intent: { marketAddress, reserveAddress, amount, repayAll },
        },
        build: () =>
          backgroundApiProxy.serviceStaking.borrowBuildRepayTransaction({
            networkId,
            accountId,
            expectedAccountAddress: frozenAddress,
            provider,
            marketAddress,
            reserveAddress,
            amount,
            repayAll,
          }),
        stakingInfo,
        navigationToTxConfirm,
        isCurrent: scope.isCurrent,
        onBeforeNavigate,
        ignoreOrderTrackingError,
        onSettleResult,
        onSuccess,
        onFail,
        onCancel,
        workflowHandoff,
      });
    },
    [
      accountAddress,
      accountId,
      captureScope,
      ensureRiskAccepted,
      networkId,
      navigationToTxConfirm,
    ],
  );
}
