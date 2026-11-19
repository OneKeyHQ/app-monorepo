import type { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import type { reserveEarnFundingContinuation } from '@onekeyhq/kit/src/views/Earn/pages/EarnRouter/earnFundingContinuation';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

type INavigate = ReturnType<
  typeof useSignatureConfirm
>['navigationToTxConfirm'];

export type IStakeFundingGuard = NonNullable<
  ReturnType<typeof reserveEarnFundingContinuation>
>;

export function withStakeFundingConfirmation({
  navigationToTxConfirm,
  guard,
  onFundingError,
}: {
  navigationToTxConfirm: INavigate;
  guard: IStakeFundingGuard;
  onFundingError: (error: unknown) => void;
}): INavigate {
  return async (params) => {
    // Wrapping and approvals use their existing task state, independently
    // of the deposit whose confirmation consumes the funded receipt.
    if (!params.encodedTx || params.wrappedInfo || params.approvesInfo?.length)
      return navigationToTxConfirm(params);

    let sendObserved = false;
    let guardEntered = false;
    let closed = false;
    const invokeFunding = (operation: () => Promise<void>) => {
      void Promise.resolve().then(operation).catch(onFundingError);
    };
    const release = () => {
      closed = true;
      invokeFunding(guard.onSafeCancel);
    };
    try {
      await navigationToTxConfirm({
        ...params,
        onBeforeSend: async () => {
          if (closed || guardEntered)
            throw new OneKeyLocalError('Stake confirmation closed');
          guardEntered = true;
          await guard.beforeSend();
          if (closed) throw new OneKeyLocalError('Stake confirmation closed');
          await params.onBeforeSend?.();
          if (closed) throw new OneKeyLocalError('Stake confirmation closed');
          sendObserved = true;
        },
        onFail: (error) => {
          release();
          params.onFail?.(error);
        },
        onConfirmationFail: (error) => {
          sendObserved = true;
          closed = true;
          invokeFunding(guard.onUncertain);
          (params.onConfirmationFail ?? params.onFail)?.(error);
        },
        onSafePreSendFail: (error) => {
          if (guardEntered) release();
          (params.onSafePreSendFail ?? params.onFail)?.(error);
        },
        onCancel: () => {
          closed = true;
          if (!sendObserved) release();
          params.onCancel?.();
        },
      });
      if (
        params.isNavigationCurrent &&
        !params.isNavigationCurrent() &&
        !sendObserved
      )
        await guard.onNotStarted();
    } catch (error) {
      if (!sendObserved) await guard.onSafeCancel();
      throw error;
    }
  };
}
