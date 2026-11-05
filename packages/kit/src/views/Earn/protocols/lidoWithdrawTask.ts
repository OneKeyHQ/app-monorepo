import type { IEncodedTx } from '@onekeyhq/core/src/types';
import type { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';
import {
  EInternalDappEnum,
  EInternalStakingAction,
  type IEarnWithdrawType,
  type IStakeTxResponse,
  type IStakingInfo,
} from '@onekeyhq/shared/types/staking';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import { createEarnConfirmationTaskAdapter } from '../tasks/confirmationTaskAdapter';
import { createEarnWorkflowTaskController } from '../tasks/earnWorkflowTaskController';
import { createEarnWorkflowTask } from '../tasks/earnWorkflowTaskState';
import { createLateEarnOrderRecorder } from '../tasks/lateEarnOrderRecorder';

import { getLidoWithdrawSteps } from './lidoWithdrawPlan';

import type { IEarnWithdrawTransaction } from './withdrawProtocol';
import type { IEarnTaskScope } from '../tasks/earnTaskPlan';
import type { IEarnWorkflowTaskStep } from '../tasks/earnWorkflowTaskState';

type ITransactionStep = Exclude<
  IEarnWorkflowTaskStep,
  { kind: 'sign' | 'external' | 'wait' }
>;
export type ILidoWithdrawPermit = {
  signature: string;
  deadline: number;
  accountAddress: string;
};
export type ILidoWithdrawContext = { lidoPermit?: ILidoWithdrawPermit };
type ILidoIntent = Readonly<{
  amount: string;
  symbol: string;
  inputTokenAddress?: string;
  outputTokenAddress?: string;
  effectiveApy?: string | number;
  withdrawType?: IEarnWithdrawType;
}>;
export type ILidoWithdrawPrepared = IEarnWithdrawTransaction;
type INavigate = ReturnType<
  typeof useSignatureConfirm
>['navigationToTxConfirm'];
type ILidoServices = {
  getAccount: (params: {
    accountId: string;
    networkId: string;
  }) => Promise<{ address: string }>;
  buildPermit: (params: {
    accountId: string;
    networkId: string;
    amount: string;
    expectedAccountAddress: string;
  }) => Promise<{ message: string; deadline: number }>;
  signMessage: (params: {
    accountId: string;
    networkId: string;
    request: { origin: string; scope: 'ethereum' };
    unsignedMessage: {
      type: EMessageTypesEth.TYPED_DATA_V4;
      message: string;
      payload: string[];
    };
    walletInternalSign: true;
  }) => Promise<unknown>;
  buildUnstake: (
    params: ILidoIntent & {
      accountId: string;
      networkId: string;
      provider: string;
      signature: string;
      deadline: number;
      expectedAccountAddress: string;
    },
  ) => Promise<IStakeTxResponse>;
  buildInternalTx: (params: {
    accountId: string;
    networkId: string;
    tx: IStakeTxResponse['tx'];
    internalDappType: EInternalDappEnum.Staking;
    stakingAction: EInternalStakingAction.Withdraw;
  }) => Promise<IEncodedTx>;
};

export type ILidoWithdrawFragmentParams = {
  accountId: string;
  networkId: string;
  provider: string;
  expectedAccountAddress?: string;
  intent: ILidoIntent;
  stakingInfo?: IStakingInfo;
  services: ILidoServices;
  navigate: INavigate;
  verifyEncodedTx?: (encodedTx: IEncodedTx, accountAddress: string) => void;
  isActionCurrent?: () => boolean;
  isSendCurrent?: () => boolean;
  expiredMessage: string;
  onSuccess: (
    data: ISendTxOnSuccessData[],
    stakeInfo?: IStakingInfo,
  ) => void | Promise<void>;
  onFail?: (error: Error) => void;
  onSafePreSendFail?: (error: Error) => void;
  onObserverError: (error: unknown) => void;
};

export function createLidoWithdrawFragment<
  TContext extends ILidoWithdrawContext,
>({
  accountId,
  networkId,
  provider,
  expectedAccountAddress,
  intent,
  stakingInfo,
  services,
  navigate,
  verifyEncodedTx,
  isActionCurrent,
  isSendCurrent,
  expiredMessage,
  onSuccess,
  onFail,
  onSafePreSendFail,
  onObserverError,
}: ILidoWithdrawFragmentParams) {
  const snapshot = { ...intent };
  const recordLateOrder = createLateEarnOrderRecorder();
  const current = () => isActionCurrent?.() ?? true;
  let navigationStarted = false;
  let cancelled = false;
  let pendingProtocolOperations = 0;
  const actionExpired = new OneKeyLocalError(expiredMessage);
  const isMatchingAccount = (expected: string, actual: string) =>
    Boolean(expected.trim() && actual.trim()) &&
    (networkUtils.isEvmNetwork({ networkId })
      ? expected.toLowerCase() === actual.toLowerCase()
      : expected === actual);
  const verifyAccount = async (expected: string, isCurrent: () => boolean) => {
    if (!isCurrent()) return false;
    const account = await services.getAccount({ accountId, networkId });
    if (!isCurrent()) return false;
    if (!isMatchingAccount(expected, account.address))
      throw new OneKeyLocalError('Task account address changed');
    return true;
  };
  let resolveResult: (value: boolean) => void = () => undefined;
  let rejectResult: (error: unknown) => void = () => undefined;
  const result = new Promise<boolean>((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });
  void result.catch(() => undefined);
  const finishWithoutNavigation = () => {
    if (!navigationStarted && pendingProtocolOperations === 0)
      resolveResult(false);
  };
  let navigationOutcome:
    | Promise<{ type: 'resolved' } | { type: 'rejected'; error: unknown }>
    | undefined;
  const onStaleTransactionError = (error: unknown) => {
    if (error !== actionExpired) throw error;
  };
  const getAdapter: Parameters<
    typeof createEarnWorkflowTaskController<
      IEarnTaskScope,
      TContext,
      ILidoWithdrawPrepared
    >
  >[0]['getAdapter'] = (step, context) => {
    if (step.id === 'permit' && step.kind === 'sign') {
      return {
        kind: 'sign',
        run: async ({ signal }) => {
          pendingProtocolOperations += 1;
          try {
            const account = await services.getAccount({ accountId, networkId });
            if (!current() || signal.aborted) return { type: 'cancelled' };
            if (!account.address.trim())
              throw new OneKeyLocalError('Task account address changed');
            if (
              expectedAccountAddress !== undefined &&
              !isMatchingAccount(expectedAccountAddress, account.address)
            )
              throw new OneKeyLocalError('Task account address changed');
            const { message, deadline } = await services.buildPermit({
              accountId,
              networkId,
              amount: snapshot.amount,
              expectedAccountAddress: account.address,
            });
            const isSignCurrent = () => current() && !signal.aborted;
            if (!(await verifyAccount(account.address, isSignCurrent)))
              return { type: 'cancelled' };
            const signature = (await services.signMessage({
              accountId,
              networkId,
              request: { origin: 'https://lido.fi/', scope: 'ethereum' },
              unsignedMessage: {
                type: EMessageTypesEth.TYPED_DATA_V4,
                message,
                payload: [account.address, message],
              },
              walletInternalSign: true,
            })) as string;
            if (!(await verifyAccount(account.address, isSignCurrent)))
              return { type: 'cancelled' };
            return {
              type: 'completed',
              context: {
                ...context,
                lidoPermit: {
                  signature,
                  deadline,
                  accountAddress: account.address,
                },
              },
            };
          } catch (error) {
            rejectResult(error);
            throw error;
          } finally {
            pendingProtocolOperations -= 1;
            if (cancelled || !current()) finishWithoutNavigation();
          }
        },
      };
    }
    if (step.id !== 'unstake' || step.kind !== 'protocol')
      throw new OneKeyLocalError('Invalid Lido withdrawal step');
    const permit = context.lidoPermit;
    if (!permit) throw new OneKeyLocalError('Lido permit is missing');
    const confirmation = createEarnConfirmationTaskAdapter<
      IEarnTaskScope,
      ITransactionStep,
      ILidoWithdrawPrepared,
      ISendTxOnSuccessData[],
      Error
    >({
      prepare: async ({ signal }) => {
        pendingProtocolOperations += 1;
        try {
          const stakeTx = await services.buildUnstake({
            ...snapshot,
            accountId,
            networkId,
            provider,
            signature: permit.signature,
            deadline: permit.deadline,
            expectedAccountAddress: permit.accountAddress,
          });
          const isPreparing = () => current() && !signal.aborted;
          if (!(await verifyAccount(permit.accountAddress, isPreparing)))
            throw actionExpired;
          const encodedTx = await services.buildInternalTx({
            accountId,
            networkId,
            tx: stakeTx.tx,
            internalDappType: EInternalDappEnum.Staking,
            stakingAction: EInternalStakingAction.Withdraw,
          });
          if (!(await verifyAccount(permit.accountAddress, isPreparing)))
            throw actionExpired;
          verifyEncodedTx?.(encodedTx, permit.accountAddress);
          return {
            encodedTx,
            stakeInfo: stakingInfo
              ? {
                  ...stakingInfo,
                  ...(stakeTx.orderId
                    ? { orderId: stakeTx.orderId }
                    : undefined),
                }
              : undefined,
          };
        } catch (error) {
          if (error !== actionExpired) rejectResult(error);
          throw error;
        } finally {
          pendingProtocolOperations -= 1;
          if (cancelled || !current()) finishWithoutNavigation();
        }
      },
      navigate: async (prepared, callbacks) => {
        navigationStarted = true;
        await navigate({
          encodedTx: prepared.encodedTx,
          stakingInfo: prepared.stakeInfo,
          isNavigationCurrent: isActionCurrent,
          onBeforeSend: async () => {
            const isSendOwnerCurrent = () => isSendCurrent?.() ?? true;
            if (
              !(await verifyAccount(permit.accountAddress, isSendOwnerCurrent))
            )
              throw new OneKeyLocalError(expiredMessage);
            callbacks.onSendObserved();
          },
          onSuccess: callbacks.onSuccess,
          onLateBroadcastAccepted: async (fact) => {
            if (
              fact.accountId !== accountId ||
              fact.networkId !== networkId ||
              !fact.uuid.trim()
            )
              return;
            if (!callbacks.onLateBroadcastAccepted(fact.txid)) return;
            const recordingResult = await recordLateOrder({
              fact,
              accountId,
              networkId,
              stakeInfo: prepared.stakeInfo,
            });
            if (
              recordingResult !== 'synced' &&
              recordingResult !== 'notTracked' &&
              recordingResult !== 'superseded'
            ) {
              onObserverError(
                new OneKeyLocalError('Unable to record late Earn order'),
              );
            }
          },
          onFail: onFail ? callbacks.onFail : undefined,
          onConfirmationFail: callbacks.onFail,
          onSafePreSendFail,
          onCancel: callbacks.onCancel,
        });
      },
      onSuccess: (data, prepared) => onSuccess(data, prepared.stakeInfo),
      onFail: onFail ? (error) => onFail(error) : undefined,
      onObserverError,
      getTxid: (data) => {
        const tx = data[data.length - 1];
        return tx?.signedTx?.txid?.trim() || tx?.decodedTx?.txid?.trim();
      },
      failureCertainty: () => 'unknown',
      cancellationCertainty: () => 'unknown',
    });
    navigationOutcome = confirmation.navigation.then(
      () => ({ type: 'resolved' as const }),
      (error: unknown) => ({ type: 'rejected' as const, error }),
    );
    void navigationOutcome.then((outcome) => {
      if (!navigationStarted) return;
      if (outcome.type === 'rejected') rejectResult(outcome.error);
      else resolveResult(!cancelled && current());
    });
    return {
      kind: 'transaction',
      handoffOnSubmit: true,
      adapter: confirmation.adapter,
    };
  };
  const getResultAfterRun = async () => {
    if (!navigationStarted) return false;
    const outcome = await navigationOutcome;
    if (outcome?.type === 'rejected') throw outcome.error;
    return !cancelled && current();
  };
  const observeTask = ({
    steps,
    currentStepIndex,
  }: {
    steps: readonly { id: string; status: { type: string } }[];
    currentStepIndex: number;
  }) => {
    const step = steps[currentStepIndex];
    if (step?.status.type === 'cancelled' || step?.status.type === 'failed')
      finishWithoutNavigation();
  };
  return {
    getAdapter,
    result,
    getResultAfterRun,
    finishWithoutNavigation,
    observeTask,
    fail: rejectResult,
    onStaleTransactionError,
    isExpectedCancellation: (error: unknown) => error === actionExpired,
    cancel: () => {
      cancelled = true;
      finishWithoutNavigation();
    },
    abortPage: () => {
      cancelled = true;
      if (navigationStarted) resolveResult(false);
      else finishWithoutNavigation();
    },
    isCancelled: () => cancelled,
    isCurrent: current,
  };
}

/** Risk gating and the lifetime of the UI remain the caller's responsibility. */
export function createLidoWithdrawTask({
  taskId,
  ...params
}: ILidoWithdrawFragmentParams & { taskId: string }) {
  const task = createEarnWorkflowTask({
    taskId,
    identity: {
      accountId: params.accountId,
      networkId: params.networkId,
      provider: params.provider,
      action: 'withdraw',
      intent: { ...params.intent },
    },
    steps: getLidoWithdrawSteps(),
  });
  const fragment = createLidoWithdrawFragment<ILidoWithdrawContext>(params);
  const controller = createEarnWorkflowTaskController<
    typeof task.identity,
    ILidoWithdrawContext,
    ILidoWithdrawPrepared
  >({
    task,
    initialContext: {},
    isCurrent: fragment.isCurrent,
    expiredMessage: params.expiredMessage,
    onAsyncError: params.onObserverError,
    onStaleTransactionError: fragment.onStaleTransactionError,
    getAdapter: fragment.getAdapter,
  });
  const run = async () => {
    if (
      fragment.isCancelled() ||
      controller.getTask().steps[0].status.type !== 'ready'
    )
      return false;
    if (!fragment.isCurrent()) {
      fragment.cancel();
      controller.cancel();
      return false;
    }
    try {
      await controller.run();
    } catch (error) {
      fragment.fail(error);
      throw error;
    }
    fragment.finishWithoutNavigation();
    return fragment.getResultAfterRun();
  };
  return {
    run,
    cancel: () => {
      fragment.cancel();
      controller.cancel();
    },
    getTask: controller.getTask,
    subscribe: controller.subscribe,
  };
}
