import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { createEarnConfirmationTaskAdapter } from '@onekeyhq/kit/src/views/Earn/tasks/confirmationTaskAdapter';
import type { IEarnTaskScope } from '@onekeyhq/kit/src/views/Earn/tasks/earnTaskPlan';
import type { IEarnWorkflowTaskStep } from '@onekeyhq/kit/src/views/Earn/tasks/earnWorkflowTaskState';
import { createLateEarnOrderObserver } from '@onekeyhq/kit/src/views/Earn/tasks/lateEarnOrderRecorder';
import { createEarnSingleTransactionTaskState } from '@onekeyhq/kit/src/views/Earn/tasks/singleTransactionTaskState';
import type { IEarnSingleTransactionStep } from '@onekeyhq/kit/src/views/Earn/tasks/singleTransactionTaskState';
import { isTaskAccountCurrent } from '@onekeyhq/kit/src/views/Earn/tasks/taskAccount';
import { createEarnTransactionTaskController } from '@onekeyhq/kit/src/views/Earn/tasks/transactionTaskController';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IModalSendParamList } from '@onekeyhq/shared/src/routes';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import type { IStakingInfo } from '@onekeyhq/shared/types/staking';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import {
  attachBorrowOrderId,
  handleBorrowSuccess,
  parseBorrowEncodedTx,
} from './borrowTransactionUtils';

import type { IBorrowSettleResult } from './borrowTransactionUtils';

export type IBorrowConfirmationIdentity<TIntent> = {
  accountId: string;
  networkId: string;
  provider: string;
  accountAddress?: string;
  action:
    | 'supply'
    | 'borrow'
    | 'claim'
    | 'withdraw'
    | 'repay'
    | 'setCollateral';
  intent: TIntent;
};

export type IBorrowConfirmationPrepared = {
  encodedTx: ReturnType<typeof parseBorrowEncodedTx>;
  stakingInfo: IStakingInfo | undefined;
  orderId?: string;
};

export type IBorrowWorkflowTransactionStep = Exclude<
  IEarnWorkflowTaskStep,
  { kind: 'sign' | 'external' | 'wait' }
>;

function getBorrowTxid(data: ISendTxOnSuccessData[]) {
  for (let index = data.length - 1; index >= 0; index -= 1) {
    const tx = data[index];
    const txid = tx?.signedTx?.txid || tx?.decodedTx?.txid;
    if (txid) return txid;
  }
  return undefined;
}

export type IBorrowWorkflowHandoff = {
  register: (
    identity: IBorrowConfirmationIdentity<unknown>,
    confirmation: ReturnType<
      typeof createBorrowConfirmationAdapter<
        unknown,
        IBorrowWorkflowTransactionStep,
        IEarnTaskScope
      >
    >,
  ) => Promise<boolean>;
};

type IBorrowConfirmationTaskParams<TIntent> = {
  identity: IBorrowConfirmationIdentity<TIntent>;
  build: () => Promise<{ tx: string; orderId?: string }>;
  stakingInfo?: IStakingInfo;
  navigationToTxConfirm: ReturnType<
    typeof useSignatureConfirm
  >['navigationToTxConfirm'];
  isCurrent: () => boolean;
  onBeforeNavigate?: () => void | Promise<void>;
  ignoreOrderTrackingError?: boolean;
  waitForFinalStatus?: boolean;
  verifyAccountBeforeBuild?: boolean;
  onSettleResult?: (
    result: IBorrowSettleResult,
  ) => boolean | void | Promise<boolean | void>;
  onSuccess?: IModalSendParamList['SendConfirm']['onSuccess'];
  onFail?: IModalSendParamList['SendConfirm']['onFail'];
  onCancel?: IModalSendParamList['SendConfirm']['onCancel'];
  workflowHandoff?: IBorrowWorkflowHandoff;
};

export function createBorrowConfirmationAdapter<
  TIntent,
  TStep = IEarnSingleTransactionStep<'protocol'>,
  TTaskIdentity = IBorrowConfirmationIdentity<TIntent>,
>({
  identity,
  build,
  stakingInfo,
  navigationToTxConfirm,
  isCurrent,
  onBeforeNavigate,
  ignoreOrderTrackingError,
  waitForFinalStatus,
  verifyAccountBeforeBuild,
  onSettleResult,
  onSuccess,
  onFail,
  onCancel,
  workflowHandoff,
}: IBorrowConfirmationTaskParams<TIntent>) {
  let cancelled = false;
  let acceptedLateTxid: string | undefined;
  let successTxid: string | undefined;
  let lateRecord: Promise<void> | undefined;
  const isOwnerCurrent = async () => {
    if (!isCurrent()) return false;
    if (identity.accountAddress) {
      try {
        if (
          !(await isTaskAccountCurrent({
            accountId: identity.accountId,
            networkId: identity.networkId,
            accountAddress: identity.accountAddress,
          }))
        )
          return false;
      } catch {
        return false;
      }
    }
    return isCurrent();
  };
  const verifyAccount = async () => {
    if (!isCurrent()) {
      throw new OneKeyLocalError('Borrow transaction confirmation expired');
    }
    if (
      identity.accountAddress &&
      !(await isTaskAccountCurrent({
        accountId: identity.accountId,
        networkId: identity.networkId,
        accountAddress: identity.accountAddress,
      }))
    ) {
      throw new OneKeyLocalError('Borrow transaction confirmation expired');
    }
    if (!isCurrent()) {
      throw new OneKeyLocalError('Borrow transaction confirmation expired');
    }
  };
  const observeLateOrder = createLateEarnOrderObserver({
    accountId: identity.accountId,
    networkId: identity.networkId,
    onError: () => {
      console.error('Unable to record late Borrow order');
    },
  });
  const confirmation = createEarnConfirmationTaskAdapter<
    TTaskIdentity,
    TStep,
    IBorrowConfirmationPrepared,
    ISendTxOnSuccessData[],
    Error
  >({
    prepare: async () => {
      if (identity.accountAddress && verifyAccountBeforeBuild)
        await verifyAccount();
      const result = await build();
      if (isCurrent() && identity.accountAddress) await verifyAccount();
      if (isCurrent() && onBeforeNavigate) {
        await onBeforeNavigate();
        if (isCurrent() && identity.accountAddress) await verifyAccount();
      }
      return {
        encodedTx: parseBorrowEncodedTx(result.tx),
        stakingInfo: attachBorrowOrderId({
          stakingInfo,
          orderId: result.orderId,
        }),
        orderId: result.orderId,
      };
    },
    navigate: async (prepared, callbacks) =>
      navigationToTxConfirm({
        encodedTx: prepared.encodedTx,
        stakingInfo: prepared.stakingInfo,
        onSuccess: callbacks.onSuccess,
        onLateBroadcastAccepted: async (fact) => {
          if (workflowHandoff && successTxid === fact.txid) return;
          const recording = observeLateOrder({
            fact,
            stakeInfo: prepared.stakingInfo,
            orderId: prepared.orderId,
            onAccepted: (txid) => {
              const accepted = callbacks.onLateBroadcastAccepted(txid);
              if (accepted) acceptedLateTxid = txid;
              return accepted;
            },
          });
          lateRecord = recording;
          await recording;
        },
        onFail: onFail
          ? (error) => {
              cancelled = true;
              callbacks.onFail(error);
            }
          : undefined,
        onConfirmationFail: (error) => {
          cancelled = true;
          callbacks.onFail(error);
        },
        onCancel: () => {
          cancelled = true;
          callbacks.onCancel();
        },
        onBeforeSend: async () => {
          await verifyAccount();
          callbacks.onSendObserved();
        },
        isNavigationCurrent: isCurrent,
      }),
    onSuccess: async (data, prepared) => {
      if (workflowHandoff) {
        successTxid = getBorrowTxid(data);
        if (lateRecord) await lateRecord;
        if (successTxid && successTxid === acceptedLateTxid) return;
        const ownerCurrent = await isOwnerCurrent();
        if (cancelled || !ownerCurrent) {
          if (prepared.orderId && successTxid) {
            await backgroundApiProxy.serviceStaking.addEarnOrder(
              {
                orderId: prepared.orderId,
                networkId: identity.networkId,
                txId: successTxid,
                status: data[data.length - 1]?.decodedTx.status,
                stakingLabel: prepared.stakingInfo?.label,
                stakingProtocol: prepared.stakingInfo?.protocol,
                stakingTags: prepared.stakingInfo?.tags,
              },
              { remoteSync: 'once', preserveExistingTx: true },
            );
          }
          return;
        }
      }
      return handleBorrowSuccess({
        data,
        orderId: prepared.orderId,
        networkId: identity.networkId,
        accountId: identity.accountId,
        expectedAccountAddress: identity.accountAddress,
        stakingInfo: prepared.stakingInfo,
        ignoreOrderTrackingError,
        waitForFinalStatus,
        onSettleResult,
        onSuccess,
        canNotify: workflowHandoff ? isOwnerCurrent : undefined,
      });
    },
    onFail: onFail ? (error) => onFail(error) : undefined,
    onCancel: onCancel ? () => onCancel() : undefined,
    onObserverError: () => {
      console.error('Unable to update Borrow task state');
    },
    getTxid: getBorrowTxid,
    failureCertainty: () => 'unknown',
    cancellationCertainty: () => 'unknown',
  });
  return confirmation;
}

export async function runBorrowConfirmationTask<TIntent>(
  params: IBorrowConfirmationTaskParams<TIntent>,
): Promise<boolean> {
  const { identity, isCurrent } = params;
  if (params.workflowHandoff) {
    const confirmation = createBorrowConfirmationAdapter<
      TIntent,
      IBorrowWorkflowTransactionStep,
      IEarnTaskScope
    >(params);
    return params.workflowHandoff.register(identity, confirmation);
  }
  const confirmation = createBorrowConfirmationAdapter(params);
  const taskState = createEarnSingleTransactionTaskState({
    taskId: generateUUID(),
    identity,
    step: { id: identity.action, kind: 'protocol' as const },
    lateSubmitted: 'confirming',
  });
  const controller = createEarnTransactionTaskController({
    state: taskState,
    adapter: confirmation.adapter,
    normalizePreparation: (preparation) => preparation,
    shouldHandoffOnSubmit: () => true,
    isCurrent,
    onChange: () => undefined,
    expiredMessage: 'Borrow transaction confirmation expired',
  });
  return (
    (await confirmation.start(controller.run)) === 'finished' && isCurrent()
  );
}
