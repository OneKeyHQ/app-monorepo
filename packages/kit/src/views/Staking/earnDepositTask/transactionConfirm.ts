import { HardwareErrorCode } from '@onekeyfe/hd-shared';

import type { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { isHardwareErrorByCode } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

type INavigateToTxConfirm = ReturnType<
  typeof useSignatureConfirm
>['navigationToTxConfirm'];
type ITransactionParams = Pick<
  Parameters<INavigateToTxConfirm>[0],
  | 'encodedTx'
  | 'wrappedInfo'
  | 'stakingInfo'
  | 'approvesInfo'
  | 'useFeeInTx'
  | 'feeInfoEditable'
  | 'isNavigationCurrent'
  | 'onLateBroadcastAccepted'
>;

export type IEarnTxConfirmResult =
  | { status: 'success'; data: ISendTxOnSuccessData[] }
  | { status: 'cancel' };

export function waitForEarnTransactionConfirm({
  navigationToTxConfirm,
  expiredMessage,
  signal,
  beforeSendGuard,
  canSendNow,
  allowDeviceRejectionRetry,
  allowManualResubmission,
  onSendStarted,
  onSendBlocked,
  onSubmitted,
  onConfirmSuccess,
  onUncertainFailure,
  ...params
}: ITransactionParams & {
  navigationToTxConfirm: INavigateToTxConfirm;
  expiredMessage: string;
  signal?: AbortSignal;
  beforeSendGuard?: () => Promise<void>;
  canSendNow?: () => boolean;
  allowDeviceRejectionRetry?: boolean;
  allowManualResubmission?: boolean;
  onSendStarted?: () => void;
  onSendBlocked?: () => void;
  onSubmitted?: (
    data: ISendTxOnSuccessData[],
    options?: { lateAfterSettlement: boolean },
  ) => void;
  onConfirmSuccess?: () => void;
  onUncertainFailure?: () => void;
}): Promise<IEarnTxConfirmResult> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let sendStarted = false;
    let sendGuardInProgress = false;

    const resolveOnce = (result: IEarnTxConfirmResult) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', onAbort);
      resolve(result);
    };
    const rejectOnce = (error: unknown) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener('abort', onAbort);
      reject(error);
    };
    function onAbort() {
      try {
        if (!settled && sendStarted) onUncertainFailure?.();
      } finally {
        resolveOnce({ status: 'cancel' });
      }
    }
    const isExpired = () =>
      settled ||
      signal?.aborted ||
      (params.isNavigationCurrent && !params.isNavigationCurrent());
    if (signal?.aborted) {
      onAbort();
      return;
    }
    signal?.addEventListener('abort', onAbort, { once: true });
    void navigationToTxConfirm({
      ...params,
      onBeforeSend: () => {
        if (!allowManualResubmission) {
          if (isExpired() || sendStarted || sendGuardInProgress)
            throw new OneKeyLocalError(expiredMessage);
          const markSending = () => {
            if (
              isExpired() ||
              sendStarted ||
              sendGuardInProgress ||
              (canSendNow && !canSendNow())
            )
              throw new OneKeyLocalError(expiredMessage);
            sendGuardInProgress = true;
            try {
              onSendStarted?.();
              if (isExpired() || (canSendNow && !canSendNow()))
                throw new OneKeyLocalError(expiredMessage);
              sendStarted = true;
            } catch (error) {
              onSendBlocked?.();
              throw error;
            } finally {
              sendGuardInProgress = false;
            }
          };
          if (beforeSendGuard) return beforeSendGuard().then(markSending);
          markSending();
          return;
        }
        if (isExpired() || sendGuardInProgress)
          throw new OneKeyLocalError(expiredMessage);
        sendGuardInProgress = true;
        const markSending = () => {
          if (isExpired() || (canSendNow && !canSendNow()))
            throw new OneKeyLocalError(expiredMessage);
          const firstSend = !sendStarted;
          try {
            if (firstSend) onSendStarted?.();
            if (isExpired() || (canSendNow && !canSendNow()))
              throw new OneKeyLocalError(expiredMessage);
            sendStarted = true;
          } catch (error) {
            if (firstSend) onSendBlocked?.();
            throw error;
          }
        };
        if (beforeSendGuard)
          return Promise.resolve()
            .then(beforeSendGuard)
            .then(markSending)
            .finally(() => {
              sendGuardInProgress = false;
            });
        try {
          markSending();
        } finally {
          sendGuardInProgress = false;
        }
      },
      onSuccess: (data) => {
        try {
          if (!settled || sendStarted)
            onSubmitted?.(data, { lateAfterSettlement: settled });
          if (!settled) onConfirmSuccess?.();
        } finally {
          resolveOnce({ status: 'success', data });
        }
      },
      onSafePreSendFail: (error) => {
        if (settled || !sendStarted) return;
        sendStarted = false;
        try {
          onSendBlocked?.();
        } finally {
          rejectOnce(error);
        }
      },
      onFail: (error) => {
        try {
          if (!settled) {
            const rejectedOnDevice =
              sendStarted &&
              allowDeviceRejectionRetry &&
              Boolean(onSendBlocked) &&
              isHardwareErrorByCode({
                error: error as IOneKeyError,
                code: HardwareErrorCode.ActionCancelled,
              });
            if (rejectedOnDevice) onSendBlocked?.();
            else onUncertainFailure?.();
          }
        } finally {
          rejectOnce(error);
        }
      },
      onCancel: () => {
        try {
          if (!settled && sendStarted) onUncertainFailure?.();
        } finally {
          resolveOnce({ status: 'cancel' });
        }
      },
    })
      .then(() => {
        if (params.isNavigationCurrent && !params.isNavigationCurrent()) {
          onAbort();
        }
      })
      .catch((error: unknown) => rejectOnce(error));
  });
}
