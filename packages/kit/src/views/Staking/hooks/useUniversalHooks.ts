import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import type { IEncodedTxBtc } from '@onekeyhq/core/src/chains/btc/types';
import type { IEncodedTx } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { waitForTxFinalStatus } from '@onekeyhq/kit/src/utils/waitForTxFinalStatus';
import {
  getTaskAccountAddress,
  isTaskAccountAddress,
  isTaskAccountCurrent,
  isTaskEncodedTxOwner,
} from '@onekeyhq/kit/src/views/Earn/tasks/taskAccount';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { type IModalSendParamList } from '@onekeyhq/shared/src/routes';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import {
  type EApproveType,
  EInternalDappEnum,
  EInternalStakingAction,
  type IEarnClaimType,
  type IEarnPermit2ApproveSignData,
  type IEarnStakeType,
  type IEarnWithdrawType,
  type IStakingInfo,
} from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import { getEarnProtocol } from '../../Earn/protocols';
import { withdrawProtocolRuntime } from '../../Earn/protocols/withdrawProtocolRuntime';
import {
  createEarnConfirmationLifecycle,
  createEarnConfirmationTaskAdapter,
} from '../../Earn/tasks/confirmationTaskAdapter';
import { createEarnWorkflowTaskController } from '../../Earn/tasks/earnWorkflowTaskController';
import { createEarnWorkflowTask } from '../../Earn/tasks/earnWorkflowTaskState';
import { createLateEarnOrderObserver } from '../../Earn/tasks/lateEarnOrderRecorder';
import { createEarnSingleTransactionTaskState } from '../../Earn/tasks/singleTransactionTaskState';
import { createEarnTransactionTaskController } from '../../Earn/tasks/transactionTaskController';
import {
  showEarnRiskWarningDialog,
  useEarnRiskWarningGate,
} from '../components/EarnRiskWarningDialog';
import { useShowClaimEstimateGasAlert } from '../components/EstimateNetworkFee';
import { runDirectDepositTask } from '../earnDepositTask/directDepositTask';
import {
  depositTaskRegistry,
  getDepositTaskOwnerKey,
} from '../earnDepositTask/registry';
import {
  buildEarnStakeConfirmation,
  createStakeInfoWithOrderId,
} from '../earnDepositTask/transactionBuilder';
import { waitForEarnTransactionConfirm } from '../earnDepositTask/transactionConfirm';
import { runWrappedStakeTask } from '../earnDepositTask/wrappedStakeTask';
import { isValidWrappedStakeToken } from '../utils/utils';

import { useCommittedEarnScopeGuard } from './useCommittedEarnScopeGuard';
import { useEarnSignMessageWithoutVerify } from './useEarnSignMessageWithoutVerify';

import type { createEthenaWithdrawFragment } from '../../Earn/protocols/ethena/withdrawTask';
import type { createLidoWithdrawFragment } from '../../Earn/protocols/lido/withdrawTask';
import type { createStakefishWithdrawFragment } from '../../Earn/protocols/stakefish/withdrawTask';
import type {
  ISingleWithdrawPrepared,
  IUniversalWithdrawContext,
  IUniversalWithdrawPrepared,
} from '../../Earn/protocols/withdrawProtocolRuntime';
import type { IEarnTaskScope } from '../../Earn/tasks/earnTaskPlan';
import type {
  IEarnWithdrawApprovalIdentity,
  IEarnWithdrawWorkflowAdapter,
} from '../../Earn/tasks/earnWithdrawApprovalTask';
import type {
  IEarnWorkflowPlanChange,
  IEarnWorkflowTaskStep,
} from '../../Earn/tasks/earnWorkflowTaskState';
import type { IEarnSingleTransactionStep } from '../../Earn/tasks/singleTransactionTaskState';
import type {
  IEarnTransactionTaskAdapter,
  IEarnTransactionTaskPreparation,
} from '../../Earn/tasks/transactionTaskController';
import type { IDepositTask, IDepositTaskState } from '../earnDepositTask/state';
import type {
  IDepositTaskHandle,
  IDirectDepositTaskConfig,
  IStakeWorkflowHandoff,
  IStakeWorkflowStep,
  IStakefishSignTaskConfig,
} from '../earnDepositTask/types';
import type { IUniversalWithdrawWorkflowHandoff } from '../earnWithdrawTask/types';

type ITransactionStep = Exclude<
  IEarnWorkflowTaskStep,
  { kind: 'sign' | 'external' | 'wait' }
>;
type ITransactionAdapter<T> = IEarnTransactionTaskAdapter<
  IEarnWithdrawApprovalIdentity,
  ITransactionStep,
  T,
  IEarnTransactionTaskPreparation<T, IEarnWorkflowPlanChange>
>;

export function mapWithdrawPrepared<T>(
  adapter: ITransactionAdapter<T>,
  wrap: (value: T) => IUniversalWithdrawPrepared,
  unwrap: (value: IUniversalWithdrawPrepared) => T,
): ITransactionAdapter<IUniversalWithdrawPrepared> {
  return {
    confirmationLifecycle: adapter.confirmationLifecycle,
    prepare: async (context) => {
      const result = await adapter.prepare(context);
      return result.type === 'confirm'
        ? { type: 'confirm', prepared: wrap(result.prepared) }
        : result;
    },
    beforeConfirm: adapter.beforeConfirm,
    confirm: (context) =>
      adapter.confirm({ ...context, prepared: unwrap(context.prepared) }),
    waitForFinalStatus: adapter.waitForFinalStatus,
    verify: adapter.verify,
  };
}

export function mapSingleWithdrawAdapter(
  adapter: ITransactionAdapter<ISingleWithdrawPrepared>,
): ITransactionAdapter<IUniversalWithdrawPrepared> {
  return mapWithdrawPrepared(
    adapter,
    (value) => ({ kind: 'single', value }),
    (value) => {
      if (value.kind !== 'single')
        throw new OneKeyLocalError('Invalid withdrawal transaction');
      return value.value;
    },
  );
}

export function mapProtocolWithdrawAdapter<C>(
  adapter: IEarnWithdrawWorkflowAdapter<
    Extract<IUniversalWithdrawPrepared, { kind: 'protocol' }>['value'],
    C
  >,
  project: (context: IUniversalWithdrawContext) => C,
): IEarnWithdrawWorkflowAdapter<
  IUniversalWithdrawPrepared,
  IUniversalWithdrawContext
> {
  if (adapter.kind === 'sign') {
    return {
      kind: 'sign',
      run: async (params) => {
        const result = await adapter.run({
          ...params,
          context: project(params.context),
          createContinuation: (binding) => {
            const continuation = params.createContinuation(binding);
            return {
              ...continuation,
              claim: (value) =>
                continuation.claim({
                  ...value,
                  context: { ...params.context, ...value.context },
                }),
            };
          },
        });
        return result.type === 'completed' || result.type === 'skipped'
          ? { ...result, context: { ...params.context, ...result.context } }
          : result;
      },
    };
  }
  if (adapter.kind === 'transaction') {
    const submittedContext = adapter.submittedContext;
    return {
      ...adapter,
      adapter: mapWithdrawPrepared(
        adapter.adapter,
        (value) => ({ kind: 'protocol', value }),
        (value) => {
          if (value.kind !== 'protocol')
            throw new OneKeyLocalError('Invalid withdrawal protocol');
          return value.value;
        },
      ),
      submittedContext: submittedContext
        ? (context, txid) => ({
            ...context,
            ...submittedContext(project(context), txid),
          })
        : undefined,
    };
  }
  if (adapter.kind === 'external') {
    return {
      kind: 'external',
      prepare: async (params) => ({
        ...params.context,
        ...(await adapter.prepare({
          ...params,
          context: project(params.context),
        })),
      }),
      execute: async (params) => {
        const result = await adapter.execute({
          ...params,
          context: project(params.context),
        });
        return result.type === 'completed'
          ? { ...result, context: { ...params.context, ...result.context } }
          : result;
      },
    };
  }
  return {
    kind: 'wait',
    run: async (params) => {
      const result = await adapter.run({
        ...params,
        context: project(params.context),
      });
      return result.type === 'completed' || result.type === 'pending'
        ? { ...result, context: { ...params.context, ...result.context } }
        : result;
    },
  };
}

const getEarnOrderTrackingInfo = (stakingInfo?: IStakingInfo) => ({
  stakingLabel: stakingInfo?.label,
  stakingProtocol: stakingInfo?.protocol,
  stakingTags: stakingInfo?.tags,
});

const recordStakeOrder = async ({
  data,
  stakeInfo,
  networkId,
  remoteSync,
  preserveExistingTx,
}: {
  data: ISendTxOnSuccessData[];
  stakeInfo?: IStakingInfo;
  networkId: string;
  remoteSync?: 'once';
  preserveExistingTx?: true;
}) => {
  const orderTx = Array.isArray(data) ? data[data.length - 1] : undefined;
  const txid =
    orderTx?.signedTx?.txid?.trim() || orderTx?.decodedTx?.txid?.trim();
  if (orderTx && txid && stakeInfo?.orderId) {
    return backgroundApiProxy.serviceStaking.addEarnOrder(
      {
        orderId: stakeInfo.orderId,
        networkId,
        txId: txid,
        status: orderTx.decodedTx.status,
        ...getEarnOrderTrackingInfo(stakeInfo),
      },
      remoteSync
        ? {
            remoteSync,
            ...(preserveExistingTx ? { preserveExistingTx } : undefined),
          }
        : undefined,
    );
  }
};

function createSubmittedFactReporter({
  onSubmitted,
  isOwnerCurrent,
}: {
  onSubmitted?: (txid: string) => void | Promise<void>;
  isOwnerCurrent: () => boolean;
}) {
  const attempts = new Map<string, Promise<boolean>>();
  return {
    report(txid: string) {
      const key = txid.trim();
      if (!key || attempts.has(key) || !onSubmitted) return;
      const pending = Promise.resolve()
        .then(() => onSubmitted(key))
        .then(
          () => true,
          (error: unknown) => {
            if (isOwnerCurrent()) errorToastUtils.showToastOfError(error);
            else console.error('Unable to record a submitted Earn action');
            return false;
          },
        );
      attempts.set(key, pending);
    },
    async wait(data: ISendTxOnSuccessData[]) {
      await Promise.resolve();
      const transaction = data[data.length - 1];
      const txid =
        transaction?.signedTx?.txid?.trim() ||
        transaction?.decodedTx?.txid?.trim();
      return txid ? ((await attempts.get(txid)) ?? true) : true;
    },
  };
}

const handleStakeSuccess = async ({
  data,
  stakeInfo,
  networkId,
  onSuccess,
}: {
  data: ISendTxOnSuccessData[];
  stakeInfo?: IStakingInfo;
  networkId: string;
  onSuccess?: IModalSendParamList['SendConfirm']['onSuccess'];
}) => {
  await recordStakeOrder({ data, stakeInfo, networkId });
  onSuccess?.(data);
};

const handleTaskStakeSuccess = async ({
  data,
  stakeInfo,
  networkId,
  accountId,
  accountAddress,
  isCurrent,
  lateAfterSettlement,
  onSuccess,
}: {
  data: ISendTxOnSuccessData[];
  stakeInfo?: IStakingInfo;
  networkId: string;
  accountId: string;
  accountAddress: string;
  isCurrent: () => boolean;
  lateAfterSettlement?: boolean;
  onSuccess?: IModalSendParamList['SendConfirm']['onSuccess'];
}) => {
  let result: Awaited<ReturnType<typeof recordStakeOrder>>;
  try {
    result = await recordStakeOrder({
      data,
      stakeInfo,
      networkId,
      remoteSync: 'once',
      ...(lateAfterSettlement
        ? { preserveExistingTx: true as const }
        : undefined),
    });
  } catch {
    return 'remoteUnknown' as const;
  }
  if (stakeInfo?.orderId && !result) return 'remoteUnknown' as const;
  if (result?.remoteStatus === 'failed') {
    return 'remoteUnknown' as const;
  }
  if (result?.localStatus === 'superseded') {
    return result.remoteStatus === 'skipped'
      ? ('superseded' as const)
      : ('remoteUnknown' as const);
  }
  if (
    result?.localStatus === 'failed' ||
    result?.localStatus === 'unavailable'
  ) {
    if (result.remoteStatus !== 'notAttempted') return 'remoteUnknown' as const;
    if (result.localStatus === 'failed')
      throw new OneKeyLocalError('Unable to store Earn order');
    return 'localUnavailable' as const;
  }
  if (
    result &&
    (result.localStatus !== 'saved' || result.remoteStatus !== 'synced')
  )
    return 'remoteUnknown' as const;
  if (!isCurrent() || lateAfterSettlement)
    return result ? undefined : ('notTracked' as const);
  try {
    if (
      !(await isTaskAccountCurrent({ accountId, networkId, accountAddress })) ||
      !isCurrent()
    ) {
      return result
        ? ('recordedAwaitingOwner' as const)
        : ('untrackedAwaitingOwner' as const);
    }
  } catch {
    return result
      ? ('recordedAwaitingOwner' as const)
      : ('untrackedAwaitingOwner' as const);
  }
  try {
    await Promise.resolve(onSuccess?.(data));
  } catch (error) {
    if (isCurrent()) errorToastUtils.showToastOfError(error);
  }
  if (!result) return 'notTracked' as const;
};

export function useUniversalStake({
  networkId,
  accountId,
  scopeKey,
}: {
  networkId: string;
  accountId: string;
  scopeKey?: string;
}) {
  const operationScope = [accountId, networkId, scopeKey].join('|');
  const [scope, setScope] = useState(() => ({ operationScope }));
  if (scope.operationScope !== operationScope) setScope({ operationScope });
  const committedScopeRef = useRef(scope);
  useLayoutEffect(() => {
    committedScopeRef.current = scope;
  }, [scope]);
  const lifetimeRef = useRef<object | undefined>(undefined);
  const resultAttemptRef = useRef(0);
  const wrapAbortRef = useRef<
    { scope: typeof scope; controller: AbortController } | undefined
  >(undefined);
  const signedStakeRef = useRef<
    { scope: typeof scope; cancel: () => void } | undefined
  >(undefined);
  useEffect(
    () => () => {
      if (wrapAbortRef.current?.scope === scope) {
        wrapAbortRef.current.controller.abort();
      }
      if (signedStakeRef.current?.scope === scope)
        signedStakeRef.current.cancel();
    },
    [scope],
  );
  useEffect(() => {
    const lifetime = {};
    lifetimeRef.current = lifetime;
    return () => {
      if (lifetimeRef.current === lifetime) lifetimeRef.current = undefined;
    };
  }, []);
  const { navigationToTxConfirm } = useSignatureConfirm({
    accountId,
    networkId,
  });
  const intl = useIntl();
  const waitForTxConfirmResult = useCallback(
    (
      params: Omit<
        Parameters<typeof waitForEarnTransactionConfirm>[0],
        'navigationToTxConfirm' | 'expiredMessage'
      >,
    ) =>
      waitForEarnTransactionConfirm({
        ...params,
        navigationToTxConfirm,
        expiredMessage: intl.formatMessage({
          id: ETranslations.privacy_error_review_expired__msg,
        }),
      }),
    [intl, navigationToTxConfirm],
  );

  return useCallback(
    async ({
      amount,
      symbol,
      term,
      feeRate,
      protocolVault,
      approveType,
      permitSignature,
      unsignedMessage,
      message,
      provider,
      inputTokenAddress,
      outputTokenAddress,
      slippage,
      effectiveApy,
      stakeType,
      taskMode,
      taskAccountAddress,
      isSendCurrent,
      resumeTaskState,
      directDepositTask,
      prepareWrappedDeposit,
      beforeDepositTaskSend,
      canSendDepositTask,
      onDepositTaskReady,
      onDepositTaskChange,
      onDepositTaskSettled,
      canRecoverDepositRecording,
      stakefishSignTask,
      workflowHandoff,
      workflowSpenderAddress,
      postWrapStakeToken,
      inputToken,
      postWrapApproveSpenderAddress,
      stakingInfo,
      onSubmitted,
      onSuccess,
      onFail,
      onStepChange,
      onWrapStateChange,
      isActionCurrent,
      // Stakefish specific param
      validatorPublicKey,
    }: {
      amount: string;
      symbol: string;
      term?: number;
      feeRate?: number;
      protocolVault?: string;
      approveType?: EApproveType;
      permitSignature?: string;
      // Permit2 sign data for Morpho
      unsignedMessage?: IEarnPermit2ApproveSignData;
      // Stakefish: original message for permit signature
      message?: string;
      provider: string;
      inputTokenAddress?: string;
      outputTokenAddress?: string;
      slippage?: number;
      effectiveApy?: string | number;
      stakeType?: IEarnStakeType;
      taskMode?: 'deposit';
      taskAccountAddress?: string;
      isSendCurrent?: () => boolean;
      resumeTaskState?: IDepositTaskState;
      directDepositTask?: IDirectDepositTaskConfig;
      prepareWrappedDeposit?: IDirectDepositTaskConfig['prepareDeposit'];
      beforeDepositTaskSend?: (
        step: 'wrap' | 'resetApproval' | 'approve' | 'deposit',
      ) => Promise<boolean>;
      canSendDepositTask?: (
        step: 'wrap' | 'resetApproval' | 'approve' | 'deposit',
      ) => boolean;
      onDepositTaskReady?: (handle: IDepositTaskHandle) => boolean | void;
      onDepositTaskChange?: (task: IDepositTask) => void;
      onDepositTaskSettled?: (
        taskId: string,
        txid: string,
      ) => void | Promise<void>;
      canRecoverDepositRecording?: () => boolean;
      stakefishSignTask?: IStakefishSignTaskConfig;
      workflowHandoff?: IStakeWorkflowHandoff;
      workflowSpenderAddress?: string;
      postWrapStakeToken?: IToken;
      inputToken?: IToken;
      postWrapApproveSpenderAddress?: string;
      stakingInfo?: IStakingInfo;
      onSubmitted?: (txid: string) => void | Promise<void>;
      onSuccess?: IModalSendParamList['SendConfirm']['onSuccess'];
      onFail?: IModalSendParamList['SendConfirm']['onFail'];
      isActionCurrent?: () => boolean;
      onStepChange?: (
        step: number,
        options?: { shouldShowPostWrapApproveStep?: boolean },
      ) => void;
      onWrapStateChange?: (state: 'submitted' | 'failed' | 'unknown') => void;
      // Stakefish specific param
      validatorPublicKey?: string;
    }) => {
      const lifetime = lifetimeRef.current;
      const isSendOwnerCurrent = () =>
        Boolean(lifetime) &&
        lifetimeRef.current === lifetime &&
        committedScopeRef.current === scope &&
        (isSendCurrent?.() ?? true);
      const isOperationCurrent = () =>
        isSendOwnerCurrent() && (isActionCurrent?.() ?? true);
      if (!isOperationCurrent()) return false;
      resultAttemptRef.current += 1;
      const resultAttempt = resultAttemptRef.current;
      const isResultOwnerCurrent = () =>
        isSendOwnerCurrent() && resultAttemptRef.current === resultAttempt;
      const submittedFacts = createSubmittedFactReporter({
        onSubmitted,
        isOwnerCurrent: isResultOwnerCurrent,
      });
      const reportSubmitted = (txid: string) => submittedFacts.report(txid);
      const notifyStakeSuccess = (data: ISendTxOnSuccessData[]) => {
        if (!isResultOwnerCurrent()) return Promise.resolve();
        return Promise.resolve(onSuccess?.(data));
      };
      // OK-59196: one-time risk disclaimer gates the first earn trade on
      // this device; resolves immediately once accepted
      const riskConfirmed = await showEarnRiskWarningDialog({
        provider,
        symbol,
        networkId,
        title: intl.formatMessage({ id: ETranslations.global_warning }),
      });
      if (!riskConfirmed) {
        return false;
      }
      if (!isOperationCurrent()) return false;
      const buildStakeConfirmPayload = async ({
        confirmStakeType = stakeType,
        confirmInputTokenAddress = inputTokenAddress,
        confirmStakingInfo = stakingInfo,
        signedStake,
        expectedAccountAddress,
      }: {
        confirmStakeType?: IEarnStakeType;
        confirmInputTokenAddress?: string;
        confirmStakingInfo?: IStakingInfo | null;
        signedStake?: { signature: string; message: string };
        expectedAccountAddress?: string;
      } = {}) => {
        return buildEarnStakeConfirmation({
          request: {
            amount,
            networkId,
            accountId,
            symbol,
            term,
            provider,
            feeRate,
            protocolVault,
            approveType,
            permitSignature: signedStake?.signature ?? permitSignature,
            unsignedMessage,
            message: signedStake?.message ?? message,
            inputTokenAddress: confirmInputTokenAddress,
            outputTokenAddress,
            slippage,
            effectiveApy,
            stakeType: confirmStakeType,
            validatorPublicKey,
            ...(expectedAccountAddress !== undefined
              ? { expectedAccountAddress }
              : undefined),
          },
          stakingInfo: confirmStakingInfo,
        });
      };

      if (taskMode === 'deposit' && directDepositTask) {
        wrapAbortRef.current?.controller.abort();
        const controller = new AbortController();
        wrapAbortRef.current = { scope, controller };
        const isCurrent = () =>
          !controller.signal.aborted && isOperationCurrent();
        const accountAddress = await getTaskAccountAddress({
          accountId,
          networkId,
        });
        if (!isCurrent()) return false;
        if (
          !taskAccountAddress ||
          !isTaskAccountAddress(
            { accountAddress: taskAccountAddress, networkId },
            accountAddress,
          )
        ) {
          throw new OneKeyLocalError('Task account changed before preparation');
        }
        const canRecoverRecording = () =>
          Boolean(lifetime) &&
          lifetimeRef.current === lifetime &&
          (canRecoverDepositRecording?.() ?? isCurrent());
        const { token, spenderAddress } = directDepositTask;
        if (
          !inputTokenAddress ||
          inputTokenAddress.toLowerCase() !== token.address.toLowerCase()
        ) {
          throw new OneKeyLocalError('Direct deposit token mismatch');
        }
        return runDirectDepositTask({
          identity: {
            accountId,
            accountAddress,
            networkId,
            provider,
            vault: protocolVault ?? '',
            inputTokenAddress,
            depositTokenAddress: token.address,
            amount,
            spenderAddress,
            intent: {
              symbol,
              outputTokenAddress: outputTokenAddress ?? '',
              depositTokenDecimals: token.decimals,
              term,
              validatorPublicKey,
              slippage,
            },
          },
          token,
          resumeTaskState,
          requiresAllowanceReset: directDepositTask.requiresAllowanceReset,
          allowanceVerificationMode:
            directDepositTask.allowanceVerificationMode,
          signal: controller.signal,
          isCurrent,
          canRecoverRecording,
          confirm: waitForTxConfirmResult,
          confirmReset: directDepositTask.confirmReset,
          prepareDeposit: async (signal) => {
            const result = await directDepositTask.prepareDeposit(signal);
            if (result.type === 'cancelled' || !isCurrent()) {
              return { type: 'cancelled' };
            }
            return {
              type: 'confirm',
              prepared: await buildEarnStakeConfirmation({
                request: {
                  amount,
                  networkId,
                  accountId,
                  expectedAccountAddress: accountAddress,
                  symbol,
                  term,
                  provider,
                  feeRate,
                  protocolVault,
                  inputTokenAddress,
                  outputTokenAddress,
                  slippage,
                  effectiveApy: result.effectiveApy,
                  stakeType: 'normal',
                },
                stakingInfo,
              }),
            };
          },
          beforeSendGuard: beforeDepositTaskSend,
          canSendNow: canSendDepositTask,
          onTaskReady: onDepositTaskReady,
          onTaskChange: onDepositTaskChange,
          onTaskSettled: onDepositTaskSettled,
          onDepositSubmitted: reportSubmitted,
          onDepositSuccess: async (data, stakeInfo, options) =>
            handleTaskStakeSuccess({
              data,
              stakeInfo,
              networkId,
              accountId,
              accountAddress,
              isCurrent: () =>
                isCurrent() && (options?.isRecordingCurrent?.() ?? true),
              lateAfterSettlement: options?.lateAfterSettlement,
              onSuccess: notifyStakeSuccess,
            }),
          onFail,
          formatMessage: (id) => intl.formatMessage({ id }),
        });
      }

      if (stakeType === 'wrap') {
        wrapAbortRef.current?.controller.abort();
        const controller = new AbortController();
        wrapAbortRef.current = { scope, controller };
        const isCurrent = () =>
          !controller.signal.aborted && isOperationCurrent();
        const canRecoverRecording = () =>
          Boolean(lifetime) &&
          lifetimeRef.current === lifetime &&
          (canRecoverDepositRecording?.() ?? isCurrent());
        if (
          !isValidWrappedStakeToken({
            providerName: provider,
            networkId,
            token: postWrapStakeToken,
          })
        ) {
          throw new OneKeyLocalError('Invalid wrapped stake token');
        }
        if (!postWrapStakeToken?.address || !postWrapApproveSpenderAddress) {
          throw new OneKeyLocalError(
            'Wrap staking requires wrapped token approval config',
          );
        }
        if (!inputToken) {
          throw new OneKeyLocalError('Wrap staking requires an input token');
        }

        const amountBN = new BigNumber(amount);
        if (!amountBN.isFinite() || amountBN.lte(0)) {
          throw new OneKeyLocalError('Invalid wrap staking amount');
        }

        const accountAddress = await getTaskAccountAddress({
          accountId,
          networkId,
        });
        if (!isCurrent()) return false;
        if (
          (taskAccountAddress &&
            !isTaskAccountAddress(
              { accountAddress: taskAccountAddress, networkId },
              accountAddress,
            )) ||
          (!taskAccountAddress && onDepositTaskReady)
        ) {
          throw new OneKeyLocalError('Task account changed before preparation');
        }
        let fallbackReservation:
          | { ownerKey: string; token: symbol }
          | undefined;
        let fallbackHandle: IDepositTaskHandle | undefined;
        let reportedWrapState: 'submitted' | 'failed' | 'unknown' | undefined;
        let reportedApprovalStep = false;
        let reportedDepositStep = false;
        const usesLegacyProgress =
          taskMode !== 'deposit' &&
          getEarnProtocol(provider).usesLegacyWrapProgress();
        const reportWrapState = (state: 'submitted' | 'failed' | 'unknown') => {
          if (
            !usesLegacyProgress ||
            !isCurrent() ||
            state === reportedWrapState
          )
            return;
          reportedWrapState = state;
          onWrapStateChange?.(state);
        };
        const publishTaskChange = (task: IDepositTask) => {
          onDepositTaskChange?.(task);
          if (!usesLegacyProgress || !isCurrent()) return;
          const wrap = task.steps.find((step) => step.kind === 'wrap');
          const approve = task.steps.find((step) => step.kind === 'approve');
          const wrapStatus = wrap?.status.type;
          let wrapState: 'submitted' | 'failed' | 'unknown' | undefined;
          if (wrapStatus === 'succeeded') wrapState = 'submitted';
          else if (
            wrap?.status.type === 'failed' &&
            wrap.status.stage === 'onChain'
          )
            wrapState = 'failed';
          else if (
            wrapStatus === 'sending' ||
            wrapStatus === 'confirming' ||
            wrapStatus === 'verifying' ||
            wrapStatus === 'unknown'
          )
            wrapState = 'unknown';
          if (wrapState) reportWrapState(wrapState);
          if (
            !reportedApprovalStep &&
            approve &&
            (approve.status.type === 'awaitingUser' ||
              approve.status.type === 'skipped')
          ) {
            reportedApprovalStep = true;
            onStepChange?.(2, {
              shouldShowPostWrapApproveStep:
                approve.status.type === 'awaitingUser',
            });
          }
          if (!reportedDepositStep && approve?.status.type === 'succeeded') {
            reportedDepositStep = true;
            onStepChange?.(3);
          }
        };
        const releaseFallback = () => {
          if (!fallbackReservation) return;
          depositTaskRegistry.release(
            fallbackReservation.ownerKey,
            fallbackReservation.token,
          );
          fallbackReservation = undefined;
        };
        const notifyFallback = (task?: IDepositTask) => {
          const wrap = task?.steps.find((step) => step.kind === 'wrap');
          const current = task?.steps[task.currentStepIndex];
          const interruptedAfterWrap =
            wrap?.status.type === 'succeeded' &&
            (current?.status.type === 'cancelled' ||
              current?.status.type === 'failed');
          Toast.message(
            interruptedAfterWrap
              ? {
                  title: intl.formatMessage({
                    id: ETranslations.feedback_transaction_submitted,
                  }),
                  message: `${intl.formatMessage({ id: ETranslations.global_wallet_balance })}: ${postWrapStakeToken.symbol}`,
                }
              : {
                  title: intl.formatMessage({
                    id: ETranslations.global_pending,
                  }),
                  message: intl.formatMessage({
                    id: ETranslations.wallet_transaction_maybe_already_submitted_check_activity__msg,
                  }),
                },
          );
        };
        let started = false;
        try {
          started = await runWrappedStakeTask({
            accountAddress,
            resumeTaskState,
            request: {
              amount,
              networkId,
              accountId,
              symbol,
              term,
              provider,
              feeRate,
              protocolVault,
              approveType,
              permitSignature,
              unsignedMessage,
              message,
              inputTokenAddress,
              outputTokenAddress,
              slippage,
              effectiveApy,
              stakeType,
              validatorPublicKey,
            },
            stakingInfo,
            inputToken,
            wrappedToken: postWrapStakeToken,
            spenderAddress: postWrapApproveSpenderAddress,
            signal: controller.signal,
            isCurrent,
            canRecoverRecording,
            confirm: async (confirmation) => {
              try {
                return await waitForTxConfirmResult(confirmation);
              } catch (error) {
                if (!usesLegacyProgress) throw error;
                if (confirmation.wrappedInfo) reportWrapState('unknown');
                onFail?.(error as Error);
                return { status: 'cancel' as const };
              }
            },
            beforeDepositTaskSend,
            canSendDepositTask,
            prepareWrappedDeposit,
            onTaskReady:
              onDepositTaskReady ??
              ((handle) => {
                if (!handle.taskState)
                  throw new OneKeyLocalError('Missing deposit task state');
                const ownerKey = getDepositTaskOwnerKey({
                  accountId,
                  accountAddress,
                  networkId,
                  provider,
                  vault: protocolVault,
                });
                const token = depositTaskRegistry.reserve(
                  ownerKey,
                  handle.taskState,
                );
                if (!token) {
                  notifyFallback(
                    depositTaskRegistry.find(ownerKey)?.state.getTask(),
                  );
                  return false;
                }
                fallbackReservation = { ownerKey, token };
                fallbackHandle = handle;
                return true;
              }),
            onTaskChange: publishTaskChange,
            onTaskSettled: async (taskId, txid) => {
              await onDepositTaskSettled?.(taskId, txid);
              releaseFallback();
            },
            onDepositSubmitted: reportSubmitted,
            onDepositSuccess: async (data, stakeInfo, options) =>
              handleTaskStakeSuccess({
                data,
                stakeInfo,
                networkId,
                accountId,
                accountAddress,
                isCurrent: () =>
                  isCurrent() && (options?.isRecordingCurrent?.() ?? true),
                lateAfterSettlement: options?.lateAfterSettlement,
                onSuccess: notifyStakeSuccess,
              }),
            onFail,
            formatMessage: (id) =>
              intl.formatMessage({
                id:
                  fallbackReservation && id === ETranslations.global_pending
                    ? ETranslations.wallet_transaction_maybe_already_submitted_check_activity__msg
                    : id,
              }),
          });
          return started;
        } finally {
          if (fallbackHandle) {
            const wrap = fallbackHandle
              .getTask()
              .steps.find((step) => step.kind === 'wrap');
            if (
              wrap &&
              (wrap.status.type === 'cancelled' ||
                (wrap.status.type === 'failed' &&
                  (wrap.status.stage === 'beforeSend' ||
                    wrap.status.stage === 'onChain')))
            )
              releaseFallback();
            else if (
              !started &&
              fallbackReservation &&
              isCurrent() &&
              fallbackHandle.getTask().steps[
                fallbackHandle.getTask().currentStepIndex
              ]?.status.type !== 'unknown'
            ) {
              notifyFallback(fallbackHandle.getTask());
            }
          }
        }
      }

      const identity = {
        accountId,
        networkId,
        provider,
        accountAddress: taskAccountAddress,
        action: 'stake',
        intent: {
          amount,
          symbol,
          term,
          feeRate,
          protocolVault,
          inputTokenAddress,
          outputTokenAddress,
          slippage,
          effectiveApy,
          stakeType,
          validatorPublicKey,
        },
      };
      type IPreparedStake = Awaited<
        ReturnType<typeof buildStakeConfirmPayload>
      >;
      if (workflowHandoff) {
        const accountAddress = await getTaskAccountAddress({
          accountId,
          networkId,
        });
        if (!isOperationCurrent()) return false;
        if (
          !taskAccountAddress ||
          !isTaskAccountAddress(
            { networkId, accountAddress: taskAccountAddress },
            accountAddress,
          )
        )
          throw new OneKeyLocalError('Task account changed before stake');
        const observeLateOrder = createLateEarnOrderObserver({
          accountId,
          networkId,
          onError: () => {
            console.error('Unable to record late Earn order');
          },
        });
        let confirmationClosed = false;
        let sendStarted = false;
        let recordedTxid: string | undefined;
        let recording: Promise<unknown> | undefined;
        const confirmation = createEarnConfirmationTaskAdapter<
          IEarnTaskScope,
          IStakeWorkflowStep,
          IPreparedStake,
          ISendTxOnSuccessData[],
          Error
        >({
          prepare: async () => {
            if (
              !(await isTaskAccountCurrent({
                accountId,
                networkId,
                accountAddress,
              }))
            )
              throw new OneKeyLocalError('Task account changed before stake');
            return buildStakeConfirmPayload({
              expectedAccountAddress: accountAddress,
            });
          },
          navigate: async (payload, callbacks) =>
            navigationToTxConfirm({
              encodedTx: payload.encodedTx,
              stakingInfo: payload.stakeInfoWithOrderId,
              onSuccess: callbacks.onSuccess,
              onLateBroadcastAccepted: (fact) => {
                if (
                  fact.accountId !== accountId ||
                  fact.networkId !== networkId ||
                  !fact.uuid.trim() ||
                  !fact.txid.trim()
                )
                  return;
                if (recordedTxid) {
                  callbacks.onLateBroadcastAccepted(fact.txid);
                  return;
                }
                const pending = observeLateOrder({
                  fact,
                  stakeInfo: payload.stakeInfoWithOrderId,
                  onAccepted: (txid) => {
                    const accepted = callbacks.onLateBroadcastAccepted(txid);
                    if (accepted) {
                      recordedTxid = txid;
                      workflowHandoff.onSubmitted();
                    }
                    return accepted;
                  },
                });
                if (recordedTxid) recording = pending;
                return pending;
              },
              onFail: onFail
                ? (error) => {
                    confirmationClosed = true;
                    callbacks.onFail(error);
                  }
                : undefined,
              onConfirmationFail: (error) => {
                confirmationClosed = true;
                callbacks.onFail(error);
              },
              onCancel: () => {
                confirmationClosed = true;
                callbacks.onCancel();
              },
              onBeforeSend: async () => {
                if (
                  !workflowHandoff.isResultCurrent() ||
                  !(await isTaskAccountCurrent({
                    accountId,
                    networkId,
                    accountAddress,
                  })) ||
                  !workflowHandoff.isResultCurrent()
                )
                  throw new OneKeyLocalError(
                    'Task account changed before stake',
                  );
                sendStarted = true;
                callbacks.onSendObserved();
              },
              useFeeInTx: payload.useFeeInTx,
              feeInfoEditable: payload.feeInfoEditable,
              isNavigationCurrent: isOperationCurrent,
            }),
          onSuccess: async (data, payload) => {
            const tx = data[data.length - 1];
            const txid =
              tx?.signedTx?.txid?.trim() || tx?.decodedTx?.txid?.trim();
            if (txid && !recordedTxid) {
              recordedTxid = txid;
              workflowHandoff.onSubmitted();
              recording = recordStakeOrder({
                data,
                stakeInfo: payload.stakeInfoWithOrderId,
                networkId,
                ...(!confirmationClosed && workflowHandoff.isResultCurrent()
                  ? undefined
                  : {
                      remoteSync: 'once' as const,
                      preserveExistingTx: true as const,
                    }),
              });
            }
            await recording;
            if (
              !confirmationClosed &&
              workflowHandoff.isResultCurrent() &&
              (await isTaskAccountCurrent({
                accountId,
                networkId,
                accountAddress,
              })) &&
              !confirmationClosed &&
              workflowHandoff.isResultCurrent()
            )
              await notifyStakeSuccess(data);
          },
          onFail: onFail ? (error) => onFail(error) : undefined,
          onBroadcastAccepted: reportSubmitted,
          onObserverError: () => {
            console.error('Unable to update Earn task state');
          },
          getTxid: (data) =>
            data[data.length - 1]?.signedTx?.txid ||
            data[data.length - 1]?.decodedTx?.txid,
          failureCertainty: () => (sendStarted ? 'unknown' : 'beforeSend'),
          cancellationCertainty: () => (sendStarted ? 'unknown' : 'beforeSend'),
        });
        return workflowHandoff.register(
          {
            accountId,
            networkId,
            accountAddress,
            provider,
            action: 'stake',
            intent: {
              amount,
              symbol,
              inputTokenAddress: inputTokenAddress ?? '',
              protocolVault: protocolVault ?? '',
              spenderAddress: workflowSpenderAddress ?? '',
            },
          },
          confirmation,
        );
      }
      if (stakefishSignTask) {
        if (
          !getEarnProtocol(provider).supportsSignedValidatorStake() ||
          validatorPublicKey
        ) {
          throw new OneKeyLocalError('Invalid Stakefish signing task');
        }
        const accountAddress = await getTaskAccountAddress({
          accountId,
          networkId,
        });
        if (!isOperationCurrent()) return false;
        if (
          !accountAddress ||
          (taskAccountAddress &&
            !isTaskAccountAddress(
              { accountAddress: taskAccountAddress, networkId },
              accountAddress,
            ))
        ) {
          throw new OneKeyLocalError('Task account changed before signing');
        }
        const taskIdentity = { ...identity, accountAddress };
        const isSignedStakeResultCurrent =
          stakefishSignTask.isResultCurrent ?? isOperationCurrent;
        const task = createEarnWorkflowTask({
          taskId: generateUUID(),
          identity: taskIdentity,
          steps: [
            { id: 'validatorSign', kind: 'sign' },
            { id: 'deposit', kind: 'deposit', lateSubmitted: 'confirming' },
          ],
        });
        const observeLateOrder = createLateEarnOrderObserver({
          accountId,
          networkId,
          onError: () => {
            console.error('Unable to record late Earn order');
          },
        });
        type IStakeContext = {
          signedStake?: { signature: string; message: string };
        };
        type IStakeStep = Exclude<
          IEarnWorkflowTaskStep,
          { kind: 'sign' | 'external' | 'wait' }
        >;
        const confirmation = createEarnConfirmationTaskAdapter<
          typeof taskIdentity,
          IStakeStep,
          IPreparedStake,
          ISendTxOnSuccessData[],
          Error
        >({
          prepare: async () => {
            throw new OneKeyLocalError('Stake signing context unavailable');
          },
          navigate: async (payload, callbacks) => {
            await navigationToTxConfirm({
              encodedTx: payload.encodedTx,
              stakingInfo: payload.stakeInfoWithOrderId,
              onSuccess: callbacks.onSuccess,
              onLateBroadcastAccepted: (fact) =>
                observeLateOrder({
                  fact,
                  stakeInfo: payload.stakeInfoWithOrderId,
                  onAccepted: callbacks.onLateBroadcastAccepted,
                }),
              onFail: onFail ? callbacks.onFail : undefined,
              onConfirmationFail: callbacks.onFail,
              onCancel: callbacks.onCancel,
              onBeforeSend: async () => {
                if (
                  !isSignedStakeResultCurrent() ||
                  !(await isTaskAccountCurrent({
                    accountId,
                    networkId,
                    accountAddress,
                  })) ||
                  !isSignedStakeResultCurrent()
                ) {
                  throw new OneKeyLocalError(
                    'Task account changed before stake',
                  );
                }
                callbacks.onSendObserved();
              },
              useFeeInTx: payload.useFeeInTx,
              feeInfoEditable: payload.feeInfoEditable,
              isNavigationCurrent: isOperationCurrent,
            });
          },
          onSuccess: async (data, payload) => {
            await recordStakeOrder({
              data,
              stakeInfo: payload.stakeInfoWithOrderId,
              networkId,
              ...(isSignedStakeResultCurrent()
                ? undefined
                : {
                    remoteSync: 'once' as const,
                    preserveExistingTx: true as const,
                  }),
            });
            if (
              isSignedStakeResultCurrent() &&
              (await isTaskAccountCurrent({
                accountId,
                networkId,
                accountAddress,
              })) &&
              isSignedStakeResultCurrent()
            )
              await notifyStakeSuccess(data);
          },
          onFail: onFail ? (error) => onFail(error) : undefined,
          onBroadcastAccepted: reportSubmitted,
          onObserverError: () => {
            console.error('Unable to update Earn task state');
          },
          getTxid: (data) =>
            data[data.length - 1]?.signedTx?.txid ||
            data[data.length - 1]?.decodedTx?.txid,
          failureCertainty: () => 'unknown',
          cancellationCertainty: () => 'unknown',
        });
        const controller = createEarnWorkflowTaskController({
          task,
          initialContext: {} as IStakeContext,
          isCurrent: isOperationCurrent,
          expiredMessage: intl.formatMessage({
            id: ETranslations.privacy_error_review_expired__msg,
          }),
          onAsyncError: () => {
            console.error('Unable to update Earn task state');
          },
          getAdapter: (step, context) => {
            if (step.kind === 'sign')
              return {
                kind: 'sign',
                run: async ({ signal }) => {
                  const signedStake = await new Promise<
                    { signature: string; message: string } | undefined
                  >((resolve, reject) => {
                    const onAbort = () => resolve(undefined);
                    if (signal.aborted) {
                      resolve(undefined);
                      return;
                    }
                    signal.addEventListener('abort', onAbort, { once: true });
                    void Promise.resolve()
                      .then(() => stakefishSignTask.sign(accountAddress))
                      .then(
                        (signed) => {
                          signal.removeEventListener('abort', onAbort);
                          resolve(signed);
                        },
                        (error: unknown) => {
                          signal.removeEventListener('abort', onAbort);
                          reject(error);
                        },
                      );
                  });
                  if (
                    !signedStake ||
                    signal.aborted ||
                    !isOperationCurrent() ||
                    !(await stakefishSignTask.beforeDeposit(signal))
                  )
                    return { type: 'cancelled' };
                  return { type: 'completed', context: { signedStake } };
                },
              };
            return {
              kind: 'transaction',
              handoffOnSubmit: true,
              adapter: {
                ...confirmation.adapter,
                prepare: async () => {
                  if (
                    !context.signedStake ||
                    !(await isTaskAccountCurrent({
                      accountId,
                      networkId,
                      accountAddress,
                    }))
                  )
                    throw new OneKeyLocalError(
                      'Task account changed before deposit',
                    );
                  return {
                    type: 'confirm',
                    prepared: await buildStakeConfirmPayload({
                      signedStake: context.signedStake,
                      expectedAccountAddress: accountAddress,
                    }),
                  };
                },
              },
            };
          },
        });
        if (stakefishSignTask.onTaskChange)
          controller.subscribe(() =>
            stakefishSignTask.onTaskChange?.(controller.getTask()),
          );
        signedStakeRef.current = { scope, cancel: controller.cancel };
        try {
          const result = await confirmation.start(controller.run);
          return result === 'finished' && isOperationCurrent();
        } finally {
          if (signedStakeRef.current?.cancel === controller.cancel)
            signedStakeRef.current = undefined;
        }
      }
      const singleAccountAddress = await getTaskAccountAddress({
        accountId,
        networkId,
      });
      if (!isOperationCurrent()) return false;
      if (
        taskAccountAddress &&
        !isTaskAccountAddress(
          { accountAddress: taskAccountAddress, networkId },
          singleAccountAddress,
        )
      ) {
        throw new OneKeyLocalError('Task account changed before stake');
      }
      const singleIdentity = {
        ...identity,
        accountAddress: singleAccountAddress,
      };
      type ISingleStakeStep = IEarnSingleTransactionStep<'protocol'>;
      const taskState = createEarnSingleTransactionTaskState({
        taskId: generateUUID(),
        identity: singleIdentity,
        step: { id: 'stake', kind: 'protocol' as const },
        lateSubmitted: 'confirming',
      });
      const observeLateOrder = createLateEarnOrderObserver({
        accountId,
        networkId,
        onError: () => {
          console.error('Unable to record late Earn order');
        },
      });
      const confirmationLifetime = createEarnConfirmationLifecycle();
      let confirmationHandedOff = false;
      const confirmation = createEarnConfirmationTaskAdapter<
        typeof singleIdentity,
        ISingleStakeStep,
        IPreparedStake,
        ISendTxOnSuccessData[],
        Error
      >({
        prepare: async () => {
          const prepared = await buildStakeConfirmPayload({
            expectedAccountAddress: singleAccountAddress,
          });
          if (
            singleAccountAddress &&
            ((typeof prepared.encodedTx === 'object' &&
              prepared.encodedTx !== null &&
              'from' in prepared.encodedTx &&
              !isTaskEncodedTxOwner(
                { accountAddress: singleAccountAddress, networkId },
                prepared.encodedTx,
              )) ||
              !(await isTaskAccountCurrent({
                accountId,
                networkId,
                accountAddress: singleAccountAddress,
              })))
          ) {
            throw new OneKeyLocalError('Task account changed before stake');
          }
          return prepared;
        },
        navigate: async (payload, callbacks) => {
          await navigationToTxConfirm({
            encodedTx: payload.encodedTx,
            stakingInfo: payload.stakeInfoWithOrderId,
            onSuccess: callbacks.onSuccess,
            onLateBroadcastAccepted: (fact) =>
              observeLateOrder({
                fact,
                stakeInfo: payload.stakeInfoWithOrderId,
                onAccepted: callbacks.onLateBroadcastAccepted,
              }),
            onFail: onFail
              ? (error) => {
                  confirmationLifetime.close();
                  callbacks.onFail(error);
                }
              : undefined,
            onSafePreSendFail: (error) => onFail?.(error),
            onConfirmationFail: (error) => {
              confirmationLifetime.close();
              callbacks.onFail(error);
            },
            onCancel: () => {
              confirmationLifetime.close();
              callbacks.onCancel();
            },
            onBeforeSend: () =>
              confirmationLifetime.beforeSend(async () => {
                if (confirmationLifetime.isClosed() || !isSendOwnerCurrent())
                  throw new OneKeyLocalError(
                    'Task account changed before stake',
                  );
                if (
                  singleAccountAddress &&
                  !(await isTaskAccountCurrent({
                    accountId,
                    networkId,
                    accountAddress: singleAccountAddress,
                  }))
                )
                  throw new OneKeyLocalError(
                    'Task account changed before stake',
                  );
                if (confirmationLifetime.isClosed() || !isSendOwnerCurrent())
                  throw new OneKeyLocalError(
                    'Task account changed before stake',
                  );
                callbacks.onSendObserved();
              }),
            useFeeInTx: payload.useFeeInTx,
            feeInfoEditable: payload.feeInfoEditable,
            isNavigationCurrent: isOperationCurrent,
          });
          confirmationHandedOff = true;
        },
        onSuccess: async (data, payload) => {
          const ownerCurrent =
            !confirmationLifetime.isClosed() && isResultOwnerCurrent();
          const accountCheck =
            ownerCurrent && singleAccountAddress
              ? isTaskAccountCurrent({
                  accountId,
                  networkId,
                  accountAddress: singleAccountAddress,
                }).catch(() => false)
              : Promise.resolve(ownerCurrent);
          await recordStakeOrder({
            data,
            stakeInfo: payload.stakeInfoWithOrderId,
            networkId,
            ...(ownerCurrent
              ? undefined
              : {
                  remoteSync: 'once' as const,
                  preserveExistingTx: true as const,
                }),
          });
          if (
            !(await accountCheck) ||
            confirmationLifetime.isClosed() ||
            !isSendOwnerCurrent()
          )
            return;
          if (singleAccountAddress) {
            try {
              if (
                !(await isTaskAccountCurrent({
                  accountId,
                  networkId,
                  accountAddress: singleAccountAddress,
                }))
              )
                return;
            } catch {
              return;
            }
          }
          if (!confirmationLifetime.isClosed() && isResultOwnerCurrent())
            await notifyStakeSuccess(data);
        },
        onFail: onFail ? (error) => onFail(error) : undefined,
        onBroadcastAccepted: reportSubmitted,
        onObserverError: () => {
          console.error('Unable to update Earn task state');
        },
        getTxid: (data) => {
          const tx = data[data.length - 1];
          return tx?.signedTx?.txid || tx?.decodedTx?.txid;
        },
        failureCertainty: () => 'unknown',
        cancellationCertainty: () => 'unknown',
      });
      const controller = createEarnTransactionTaskController({
        state: taskState,
        adapter: confirmation.adapter,
        normalizePreparation: (preparation) => preparation,
        shouldHandoffOnSubmit: () => true,
        isCurrent: () =>
          confirmationHandedOff ? isSendOwnerCurrent() : isOperationCurrent(),
        onChange: () => undefined,
        expiredMessage: intl.formatMessage({
          id: ETranslations.privacy_error_review_expired__msg,
        }),
      });
      const result = await confirmation.start(controller.run);
      return result === 'finished' && isOperationCurrent();
    },
    [
      accountId,
      intl,
      networkId,
      navigationToTxConfirm,
      scope,
      waitForTxConfirmResult,
    ],
  );
}

export function useUniversalWithdraw({
  networkId,
  accountId,
}: {
  networkId: string;
  accountId: string;
}) {
  const intl = useIntl();
  const resultScope = useCommittedEarnScopeGuard(
    JSON.stringify([accountId, networkId]),
  );
  const resultAttemptRef = useRef(0);
  const unknownEthenaSwapsRef = useRef(new Set<string>());
  const stakefishSignatureRef = useRef<
    { scope: string; signature: string; message: string } | undefined
  >(undefined);
  const signPersonalMessage = useEarnSignMessageWithoutVerify();
  const { navigationToTxConfirm } = useSignatureConfirm({
    accountId,
    networkId,
  });
  const ensureRiskAccepted = useEarnRiskWarningGate();

  return useCallback(
    async ({
      amount,
      symbol,
      provider,
      identity,
      inputTokenAddress,
      outputTokenAddress,
      protocolVault,
      withdrawAll,
      slippage,
      effectiveApy,
      withdrawType,
      stakingInfo,
      onSuccess,
      onFail,
      // Signature and message for withdraw all
      withdrawSignature,
      withdrawMessage,
      isTaskIntentCurrent,
      useEthenaCooldown,
      resumeEthenaCooldownUnstake,
      onStepChange,
      onEthenaCooldownUnstakeReady,
      signal,
      isActionCurrent,
      isSendCurrent,
      isResultCurrent,
      taskAccountAddress,
      workflowHandoff,
    }: {
      amount: string;
      symbol: string;
      provider: string;
      identity?: string;
      inputTokenAddress?: string;
      outputTokenAddress?: string;
      protocolVault?: string;
      withdrawAll: boolean;
      slippage?: number;
      effectiveApy?: string | number;
      withdrawType?: IEarnWithdrawType;
      stakingInfo?: IStakingInfo;
      onSuccess?: IModalSendParamList['SendConfirm']['onSuccess'];
      onFail?: IModalSendParamList['SendConfirm']['onFail'];
      // Signature and message for withdraw all
      withdrawSignature?: string;
      withdrawMessage?: string;
      isTaskIntentCurrent?: () => boolean;
      useEthenaCooldown?: boolean;
      resumeEthenaCooldownUnstake?: boolean;
      onStepChange?: (step: number) => void;
      onEthenaCooldownUnstakeReady?: () => void;
      signal?: AbortSignal;
      isActionCurrent?: () => boolean;
      // A form may reset after handoff, so send lifetime must be provided separately.
      isSendCurrent?: () => boolean;
      isResultCurrent?: () => boolean;
      taskAccountAddress?: string;
      workflowHandoff?: IUniversalWithdrawWorkflowHandoff;
    }) => {
      const isOwnerCurrent = resultScope.capture();
      if (!isOwnerCurrent()) return false;
      resultAttemptRef.current += 1;
      const resultAttempt = resultAttemptRef.current;
      const isResultOwnerCurrent = () =>
        isOwnerCurrent() &&
        resultAttemptRef.current === resultAttempt &&
        ((isResultCurrent ?? isSendCurrent ?? isActionCurrent)?.() ?? true);
      const normalizeScopeAddress = (value?: string) =>
        networkUtils.isEvmNetwork({ networkId })
          ? (value ?? '').toLowerCase()
          : (value ?? '');
      const ethenaScope = JSON.stringify([
        accountId,
        networkId,
        provider.toLowerCase(),
        symbol.toUpperCase(),
        normalizeScopeAddress(protocolVault),
        identity ?? '',
        normalizeScopeAddress(inputTokenAddress),
        normalizeScopeAddress(outputTokenAddress),
        withdrawType ?? '',
      ]);
      const showUnknownEthenaSwap = () =>
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.wallet_transaction_maybe_already_submitted_check_activity__msg,
          }),
        });
      if (
        useEthenaCooldown &&
        !resumeEthenaCooldownUnstake &&
        unknownEthenaSwapsRef.current.has(ethenaScope)
      ) {
        showUnknownEthenaSwap();
        return false;
      }
      // OK-59196: one-time DeFi risk disclaimer, same gate the earn stake flow
      // uses. Returning false lets the caller tell a rejection apart from a
      // completed hand-off and leave the form untouched.
      const needsStakefishSignature = getEarnProtocol(
        provider,
      ).requiresValidatorWithdrawSignature({
        symbol,
        withdrawAll,
        hasSignature: Boolean(withdrawSignature),
      });
      if (
        !needsStakefishSignature &&
        !(await ensureRiskAccepted({ provider, symbol, networkId }))
      ) {
        return false;
      }
      if (isActionCurrent && !isActionCurrent()) return false;

      const stakingConfig =
        await backgroundApiProxy.serviceStaking.getStakingConfigs({
          networkId,
          symbol,
          provider,
        });
      if (!stakingConfig) {
        throw new OneKeyLocalError('Staking config not found');
      }
      if (isActionCurrent && !isActionCurrent()) return false;
      if (
        needsStakefishSignature &&
        (stakingConfig.unstakeWithSignMessage ||
          stakingConfig.withdrawSignOnly ||
          useEthenaCooldown)
      )
        throw new OneKeyLocalError('Unsupported Stakefish withdrawal signing');

      const protocolPlan = getEarnProtocol(provider).resolveWithdraw({
        config: stakingConfig,
        useEthenaCooldown,
      });
      const withdrawProtocol = withdrawProtocolRuntime[protocolPlan.kind];
      if (withdrawProtocol.kind === 'lido') {
        const lidoParams = {
          accountId,
          networkId,
          provider,
          expectedAccountAddress: taskAccountAddress,
          intent: {
            amount,
            symbol,
            inputTokenAddress,
            outputTokenAddress,
            effectiveApy,
            withdrawType,
          },
          stakingInfo,
          services: {
            getAccount: (args) =>
              backgroundApiProxy.serviceAccount.getAccount(args),
            buildPermit: (args) =>
              backgroundApiProxy.serviceStaking.buildLidoEthPermitMessageData(
                args,
              ),
            signMessage: (args) =>
              backgroundApiProxy.serviceDApp.openSignMessageModal(args),
            buildUnstake: (args) =>
              backgroundApiProxy.serviceStaking.buildUnstakeTransaction(args),
            buildInternalTx: (args) =>
              backgroundApiProxy.serviceStaking.buildInternalDappTx(args),
          },
          navigate: navigationToTxConfirm,
          ...(workflowHandoff
            ? {
                onSafePreSendFail: (error: Error) => onFail?.(error),
                verifyEncodedTx: (
                  encodedTx: IEncodedTx,
                  accountAddress: string,
                ) => {
                  if (
                    typeof encodedTx === 'object' &&
                    encodedTx !== null &&
                    'from' in encodedTx &&
                    !isTaskEncodedTxOwner(
                      { accountAddress, networkId },
                      encodedTx,
                    )
                  )
                    throw new OneKeyLocalError(
                      'Task account changed before withdrawal',
                    );
                },
              }
            : undefined),
          isActionCurrent: signal
            ? () => !signal.aborted && (isActionCurrent?.() ?? true)
            : isActionCurrent,
          isSendCurrent,
          expiredMessage: intl.formatMessage({
            id: ETranslations.privacy_error_review_expired__msg,
          }),
          onSuccess: async (data, stakeInfo) => {
            if (!isSendCurrent && !isResultCurrent) {
              await handleStakeSuccess({
                data,
                stakeInfo,
                networkId,
                onSuccess: (submitted) => {
                  if (isActionCurrent?.() ?? true) onSuccess?.(submitted);
                },
              });
              return;
            }
            try {
              await handleStakeSuccess({ data, stakeInfo, networkId });
            } catch (error) {
              errorToastUtils.showToastOfError(error);
            }
            if (
              (isResultCurrent ?? isSendCurrent ?? isActionCurrent)?.() ??
              true
            )
              onSuccess?.(data);
          },
          onFail,
          onObserverError: () => {
            console.error('Unable to update Earn task state');
          },
        } satisfies Parameters<typeof createLidoWithdrawFragment>[0];
        if (workflowHandoff) {
          const accountAddress = await getTaskAccountAddress({
            accountId,
            networkId,
          });
          if (signal?.aborted || !(isActionCurrent?.() ?? true)) return false;
          if (
            !taskAccountAddress ||
            !isTaskAccountAddress(
              { accountAddress: taskAccountAddress, networkId },
              accountAddress,
            )
          )
            throw new OneKeyLocalError(
              'Task account changed before withdrawal',
            );
          const fragment =
            withdrawProtocol.createFragment<IUniversalWithdrawContext>(
              lidoParams,
            );
          const abortPage = () => fragment.abortPage();
          signal?.addEventListener('abort', abortPage, { once: true });
          try {
            if (signal?.aborted) {
              abortPage();
              return false;
            }
            return await workflowHandoff.register({
              identity: {
                accountId,
                networkId,
                accountAddress,
                provider,
                action: 'withdraw',
              },
              steps: withdrawProtocol.getSteps(),
              getAdapter: (step, context) => {
                const adapter = fragment.getAdapter(step, context);
                if (adapter.kind === 'sign') return adapter;
                return mapProtocolWithdrawAdapter(adapter, (value) => value);
              },
              result: fragment.result,
              observeTask: fragment.observeTask,
              cancel: fragment.cancel,
              onStaleTransactionError: fragment.onStaleTransactionError,
              isExpectedCancellation: fragment.isExpectedCancellation,
            });
          } finally {
            signal?.removeEventListener('abort', abortPage);
          }
        }
        const task = withdrawProtocol.createTask({
          taskId: generateUUID(),
          ...lidoParams,
        });

        const cancelTask = () => task.cancel();
        signal?.addEventListener('abort', cancelTask, { once: true });
        try {
          if (signal?.aborted) cancelTask();
          return await task.run();
        } finally {
          signal?.removeEventListener('abort', cancelTask);
        }
      }

      if (workflowHandoff && stakingConfig.withdrawSignOnly) {
        throw new OneKeyLocalError('Unsupported withdrawal approval workflow');
      }

      if (
        withdrawProtocol.kind === 'babylon' ||
        withdrawProtocol.kind === 'signOnly'
      ) {
        const task = withdrawProtocol.createTask({
          taskId: generateUUID(),
          accountId,
          networkId,
          provider,
          identity,
          intent: {
            amount,
            symbol,
            inputTokenAddress,
            outputTokenAddress,
            protocolVault,
            withdrawAll,
            signature: withdrawSignature,
            message: withdrawMessage,
            slippage,
            effectiveApy,
            withdrawType,
          },
          stakingInfo,
          services: {
            getAccountAddress: getTaskAccountAddress,
            buildUnstake: (args) =>
              backgroundApiProxy.serviceStaking.buildUnstakeTransaction(args),
            buildInternalTx: (args) =>
              backgroundApiProxy.serviceStaking.buildInternalDappTx(args),
            unstakePush: (args) =>
              backgroundApiProxy.serviceStaking.unstakePush(args),
          },
          navigate: navigationToTxConfirm,
          isActionCurrent: signal
            ? () => !signal.aborted && (isActionCurrent?.() ?? true)
            : isActionCurrent,
          isSendCurrent,
          isResultCurrent: signal
            ? () =>
                !signal.aborted &&
                ((isResultCurrent ?? isSendCurrent ?? isActionCurrent)?.() ??
                  true)
            : isResultCurrent,
          expiredMessage: intl.formatMessage({
            id: ETranslations.privacy_error_review_expired__msg,
          }),
          onSuccess,
          onFail,
          onPushError: (error) => errorToastUtils.showToastOfError(error),
          onExternalBroadcast: () => {
            Toast.success({
              title: intl.formatMessage({
                id: ETranslations.feedback_transaction_submitted,
              }),
            });
          },
          onObserverError: () => {
            console.error('Unable to update Earn task state');
          },
        });
        const cancelTask = () => task.cancel();
        signal?.addEventListener('abort', cancelTask, { once: true });
        try {
          if (signal?.aborted) cancelTask();
          return await task.run();
        } finally {
          signal?.removeEventListener('abort', cancelTask);
        }
      }

      if (withdrawProtocol.kind === 'stakefish') {
        const stakefishAccountAddress = await getTaskAccountAddress({
          accountId,
          networkId,
        });
        if (signal?.aborted || !(isActionCurrent?.() ?? true)) return false;
        if (
          taskAccountAddress &&
          !isTaskAccountAddress(
            { accountAddress: taskAccountAddress, networkId },
            stakefishAccountAddress,
          )
        ) {
          throw new OneKeyLocalError('Task account changed before withdrawal');
        }
        const stakefishIdentity = {
          accountId,
          networkId,
          accountAddress: stakefishAccountAddress,
          provider,
          action: 'withdraw' as const,
          intent: {
            amount,
            symbol,
            identity,
            inputTokenAddress,
            outputTokenAddress,
            protocolVault,
            withdrawAll,
            slippage,
            effectiveApy,
            withdrawType,
          },
        };
        let stakefishHandedOff = false;
        const isStakefishActionCurrent = () =>
          (isActionCurrent?.() ?? true) &&
          (stakefishHandedOff || (!signal?.aborted && isOwnerCurrent())) &&
          (stakefishHandedOff ||
            !needsStakefishSignature ||
            (isTaskIntentCurrent?.() ?? true));
        const signatureScope = JSON.stringify([
          accountId,
          networkId,
          provider.toLowerCase(),
          symbol.toUpperCase(),
          identity,
          normalizeScopeAddress(stakefishAccountAddress),
        ]);
        const stakefishParams = {
          identity: stakefishIdentity,
          ownerKey: JSON.stringify([
            accountId,
            networkId,
            provider.toLowerCase(),
            symbol.toUpperCase(),
            identity ?? '',
            normalizeScopeAddress(protocolVault),
          ]),
          signWithdrawal: needsStakefishSignature
            ? async () => {
                if (!isStakefishActionCurrent()) return undefined;
                let signed =
                  stakefishSignatureRef.current?.scope === signatureScope
                    ? stakefishSignatureRef.current
                    : undefined;
                if (!signed) {
                  try {
                    const result = await signPersonalMessage({
                      networkId,
                      accountId,
                      provider,
                      symbol,
                      action: 'unstake',
                      identity,
                      expectedAccountAddress: stakefishAccountAddress,
                      isCurrent: isStakefishActionCurrent,
                    });
                    if (!isStakefishActionCurrent()) return undefined;
                    signed = { ...result, scope: signatureScope };
                    stakefishSignatureRef.current = signed;
                  } catch (error) {
                    console.error('Stakefish withdraw sign error:', error);
                    return undefined;
                  }
                }
                if (
                  !signed ||
                  signal?.aborted ||
                  !isOwnerCurrent() ||
                  !isStakefishActionCurrent()
                )
                  return undefined;
                try {
                  if (
                    !(await isTaskAccountCurrent({
                      accountId,
                      networkId,
                      accountAddress: stakefishAccountAddress,
                    })) ||
                    !isStakefishActionCurrent()
                  )
                    return undefined;
                  if (
                    !(await ensureRiskAccepted({ provider, symbol, networkId }))
                  )
                    return undefined;
                } catch (error) {
                  if (!isStakefishActionCurrent()) return undefined;
                  throw error;
                }
                if (
                  signal?.aborted ||
                  !isOwnerCurrent() ||
                  !isStakefishActionCurrent()
                )
                  return undefined;
                return signed;
              }
            : undefined,
          build: (signed) =>
            backgroundApiProxy.serviceStaking.buildUnstakeTransaction({
              amount,
              identity,
              networkId,
              accountId,
              expectedAccountAddress: stakefishAccountAddress,
              symbol,
              provider,
              inputTokenAddress,
              outputTokenAddress,
              protocolVault,
              withdrawAll,
              signature: signed?.signature ?? withdrawSignature,
              message: signed?.message ?? withdrawMessage,
              slippage,
              effectiveApy,
              withdrawType,
            }),
          isExitBroadcast: (transaction) =>
            typeof transaction.tx === 'object' &&
            transaction.tx !== null &&
            'exitBroadcasted' in transaction.tx &&
            transaction.tx.exitBroadcasted === true,
          prepare: async (transaction) => {
            const encodedTx =
              await backgroundApiProxy.serviceStaking.buildInternalDappTx({
                networkId,
                accountId,
                tx: transaction.tx,
                internalDappType: EInternalDappEnum.Staking,
                stakingAction: EInternalStakingAction.Withdraw,
              });
            if (
              (typeof encodedTx === 'object' &&
                encodedTx !== null &&
                'from' in encodedTx &&
                !isTaskEncodedTxOwner(
                  { accountAddress: stakefishAccountAddress, networkId },
                  encodedTx,
                )) ||
              !(await isTaskAccountCurrent({
                accountId,
                networkId,
                accountAddress: stakefishAccountAddress,
              }))
            ) {
              throw new OneKeyLocalError(
                'Task account changed before withdrawal',
              );
            }
            const useFeeInTx =
              networkUtils.isBTCNetwork(networkId) &&
              Boolean((encodedTx as IEncodedTxBtc).fee);
            return {
              encodedTx,
              stakeInfo: createStakeInfoWithOrderId({
                stakingInfo,
                orderId: transaction.orderId,
              }),
              ...(useFeeInTx
                ? { useFeeInTx: true, feeInfoEditable: false }
                : undefined),
            };
          },
          navigate: navigationToTxConfirm,
          isActionCurrent: isStakefishActionCurrent,
          isSendCurrent,
          isAccountCurrent: () =>
            isTaskAccountCurrent({
              accountId,
              networkId,
              accountAddress: stakefishAccountAddress,
            }),
          signal,
          onExit: () => {
            void (async () => {
              if (!isResultOwnerCurrent()) return;
              try {
                if (
                  !(await isTaskAccountCurrent({
                    accountId,
                    networkId,
                    accountAddress: stakefishAccountAddress,
                  }))
                )
                  return;
              } catch {
                return;
              }
              if (!isResultOwnerCurrent()) return;
              Toast.success({
                title: intl.formatMessage({
                  id: ETranslations.feedback_transaction_submitted,
                }),
              });
              onSuccess?.([]);
            })();
          },
          onSubmitted: async (data, stakeInfo, options) => {
            const ownerCurrent =
              !options?.isConfirmationClosed && isResultOwnerCurrent();
            const accountCheck = ownerCurrent
              ? isTaskAccountCurrent({
                  accountId,
                  networkId,
                  accountAddress: stakefishAccountAddress,
                }).catch(() => false)
              : Promise.resolve(false);
            try {
              await recordStakeOrder({
                data,
                stakeInfo,
                networkId,
                ...(ownerCurrent
                  ? undefined
                  : {
                      remoteSync: 'once' as const,
                      preserveExistingTx: true as const,
                    }),
              });
            } catch (error) {
              if (!isSendCurrent && !isResultCurrent) throw error;
              errorToastUtils.showToastOfError(error);
            }
            if (!(await accountCheck) || !isResultOwnerCurrent()) return;
            try {
              if (
                !(await isTaskAccountCurrent({
                  accountId,
                  networkId,
                  accountAddress: stakefishAccountAddress,
                }))
              )
                return;
            } catch {
              return;
            }
            if (isResultOwnerCurrent()) onSuccess?.(data);
          },
          onFail,
          onObserverError: () => {
            console.error('Unable to update Earn task state');
          },
          expiredMessage: intl.formatMessage({
            id: ETranslations.privacy_error_review_expired__msg,
          }),
          inFlightMessage: intl.formatMessage({
            id: ETranslations.global_pending,
          }),
        } satisfies Parameters<typeof createStakefishWithdrawFragment>[0];
        if (workflowHandoff) {
          if (
            !taskAccountAddress ||
            !isTaskAccountAddress(
              { accountAddress: taskAccountAddress, networkId },
              stakefishAccountAddress,
            )
          )
            throw new OneKeyLocalError(
              'Task account changed before withdrawal',
            );
          const fragment =
            withdrawProtocol.createFragment<IEarnWithdrawApprovalIdentity>(
              stakefishParams,
            );
          const abortPage = () => fragment.abortPage();
          signal?.addEventListener('abort', abortPage, { once: true });
          try {
            if (signal?.aborted) {
              abortPage();
              return false;
            }
            const started = await workflowHandoff.register({
              identity: stakefishParams.identity,
              steps: fragment.steps,
              getAdapter: (step, context) =>
                mapProtocolWithdrawAdapter(
                  fragment.getAdapter(step, context),
                  (value) => value,
                ),
              result: fragment.result,
              observeTask: fragment.observeTask,
              cancel: fragment.cancel,
              onStaleTransactionError: fragment.onStaleTransactionError,
              isExpectedCancellation: fragment.isExpectedCancellation,
              hasDeliveredExternalEffect: fragment.hasReportedExit,
            });
            if (started) {
              stakefishHandedOff = true;
              if (stakefishSignatureRef.current?.scope === signatureScope)
                stakefishSignatureRef.current = undefined;
            }
            return started;
          } finally {
            signal?.removeEventListener('abort', abortPage);
          }
        }
        const started = await withdrawProtocol.runTask({
          taskId: generateUUID(),
          ...stakefishParams,
        });
        if (started) {
          stakefishHandedOff = true;
          if (stakefishSignatureRef.current?.scope === signatureScope)
            stakefishSignatureRef.current = undefined;
        }
        return started;
      }

      if (withdrawProtocol.kind === 'single') {
        const singleAccountAddress = await getTaskAccountAddress({
          accountId,
          networkId,
        });
        if (signal?.aborted || !(isActionCurrent?.() ?? true)) return false;
        if (
          taskAccountAddress &&
          !isTaskAccountAddress(
            { accountAddress: taskAccountAddress, networkId },
            singleAccountAddress,
          )
        ) {
          throw new OneKeyLocalError('Task account changed before withdrawal');
        }
        const taskIdentity = {
          accountId,
          networkId,
          accountAddress: singleAccountAddress,
          provider,
          action: 'withdraw',
          intent: {
            amount,
            symbol,
            identity,
            inputTokenAddress,
            outputTokenAddress,
            protocolVault,
            withdrawAll,
            slippage,
            effectiveApy,
            withdrawType,
          },
        };
        type IWithdrawStep = Exclude<
          IEarnWorkflowTaskStep,
          { kind: 'sign' | 'external' | 'wait' }
        >;
        type IPreparedWithdraw = ISingleWithdrawPrepared;
        const observeLateOrder = createLateEarnOrderObserver({
          accountId,
          networkId,
          onError: () => {
            console.error('Unable to record late Earn order');
          },
        });
        const confirmationLifetime = createEarnConfirmationLifecycle();
        let confirmationHandedOff = false;
        let preparationStarted = false;
        let preparationSettled = false;
        const isPageActionCurrent = () =>
          !signal?.aborted && (isActionCurrent?.() ?? true);
        const confirmation = createEarnConfirmationTaskAdapter<
          IEarnTaskScope,
          IWithdrawStep,
          IPreparedWithdraw,
          ISendTxOnSuccessData[],
          Error
        >({
          prepare: async () => {
            if (!isPageActionCurrent()) return { type: 'cancelled' };
            preparationStarted = true;
            try {
              const transaction =
                await backgroundApiProxy.serviceStaking.buildUnstakeTransaction(
                  {
                    amount,
                    identity,
                    networkId,
                    accountId,
                    ...(singleAccountAddress
                      ? { expectedAccountAddress: singleAccountAddress }
                      : undefined),
                    symbol,
                    provider,
                    inputTokenAddress,
                    outputTokenAddress,
                    protocolVault,
                    withdrawAll,
                    signature: withdrawSignature,
                    message: withdrawMessage,
                    slippage,
                    effectiveApy,
                    withdrawType,
                  },
                );
              if (!isPageActionCurrent()) return { type: 'cancelled' };
              if (
                typeof transaction.tx === 'object' &&
                transaction.tx !== null &&
                'exitBroadcasted' in transaction.tx &&
                transaction.tx.exitBroadcasted === true
              ) {
                return { type: 'exitBroadcasted' };
              }
              const encodedTx =
                await backgroundApiProxy.serviceStaking.buildInternalDappTx({
                  networkId,
                  accountId,
                  tx: transaction.tx,
                  internalDappType: EInternalDappEnum.Staking,
                  stakingAction: EInternalStakingAction.Withdraw,
                });
              if (!isPageActionCurrent()) return { type: 'cancelled' };
              if (
                singleAccountAddress &&
                ((typeof encodedTx === 'object' &&
                  encodedTx !== null &&
                  'from' in encodedTx &&
                  !isTaskEncodedTxOwner(
                    { accountAddress: singleAccountAddress, networkId },
                    encodedTx,
                  )) ||
                  !(await isTaskAccountCurrent({
                    accountId,
                    networkId,
                    accountAddress: singleAccountAddress,
                  })))
              ) {
                throw new OneKeyLocalError(
                  'Task account changed before withdrawal',
                );
              }
              const useFeeInTx =
                networkUtils.isBTCNetwork(networkId) &&
                Boolean((encodedTx as IEncodedTxBtc).fee);
              return {
                type: 'transaction',
                encodedTx,
                stakeInfo: createStakeInfoWithOrderId({
                  stakingInfo,
                  orderId: transaction.orderId,
                }),
                ...(useFeeInTx
                  ? { useFeeInTx: true, feeInfoEditable: false }
                  : undefined),
              };
            } finally {
              preparationSettled = true;
            }
          },
          navigate: async (prepared, callbacks) => {
            if (prepared.type === 'cancelled' || !isPageActionCurrent()) return;
            if (prepared.type === 'exitBroadcasted') {
              if (!isResultOwnerCurrent()) return;
              try {
                if (
                  !(await isTaskAccountCurrent({
                    accountId,
                    networkId,
                    accountAddress: singleAccountAddress,
                  }))
                )
                  return;
              } catch {
                return;
              }
              if (!isResultOwnerCurrent()) return;
              Toast.success({
                title: intl.formatMessage({
                  id: ETranslations.feedback_transaction_submitted,
                }),
              });
              onSuccess?.([]);
              return;
            }
            const onBeforeSend = () =>
              confirmationLifetime.beforeSend(async () => {
                if (
                  confirmationLifetime.isClosed() ||
                  !isOwnerCurrent() ||
                  !(isSendCurrent?.() ?? true) ||
                  !(await isTaskAccountCurrent({
                    accountId,
                    networkId,
                    accountAddress: singleAccountAddress,
                  })) ||
                  confirmationLifetime.isClosed() ||
                  !isOwnerCurrent() ||
                  !(isSendCurrent?.() ?? true)
                ) {
                  throw new OneKeyLocalError(
                    'Task account changed before withdrawal',
                  );
                }
                callbacks.onSendObserved();
              });
            await navigationToTxConfirm({
              encodedTx: prepared.encodedTx,
              isNavigationCurrent: () =>
                !signal?.aborted && (isActionCurrent?.() ?? true),
              onBeforeSend,
              stakingInfo: prepared.stakeInfo,
              useFeeInTx: prepared.useFeeInTx,
              feeInfoEditable: prepared.feeInfoEditable,
              onSuccess: callbacks.onSuccess,
              onLateBroadcastAccepted: (fact) =>
                observeLateOrder({
                  fact,
                  stakeInfo: prepared.stakeInfo,
                  onAccepted: callbacks.onLateBroadcastAccepted,
                }),
              onFail: onFail
                ? (error) => {
                    confirmationLifetime.close();
                    callbacks.onFail(error);
                  }
                : undefined,
              onSafePreSendFail: (error) => onFail?.(error),
              onConfirmationFail: (error) => {
                confirmationLifetime.close();
                callbacks.onFail(error);
              },
              onCancel: () => {
                confirmationLifetime.close();
                callbacks.onCancel();
              },
            });
            confirmationHandedOff = true;
          },
          onSuccess: async (data, prepared) => {
            if (prepared.type !== 'transaction') return;
            const ownerCurrent =
              !confirmationLifetime.isClosed() && isResultOwnerCurrent();
            const accountCheck = ownerCurrent
              ? isTaskAccountCurrent({
                  accountId,
                  networkId,
                  accountAddress: singleAccountAddress,
                }).catch(() => false)
              : Promise.resolve(false);
            try {
              await recordStakeOrder({
                data,
                stakeInfo: prepared.stakeInfo,
                networkId,
                ...(ownerCurrent
                  ? undefined
                  : {
                      remoteSync: 'once' as const,
                      preserveExistingTx: true as const,
                    }),
              });
            } catch (error) {
              if (!isSendCurrent && !isResultCurrent) throw error;
              errorToastUtils.showToastOfError(error);
            }
            if (
              !(await accountCheck) ||
              confirmationLifetime.isClosed() ||
              !isResultOwnerCurrent()
            )
              return;
            try {
              if (
                !(await isTaskAccountCurrent({
                  accountId,
                  networkId,
                  accountAddress: singleAccountAddress,
                }))
              )
                return;
            } catch {
              return;
            }
            if (!confirmationLifetime.isClosed() && isResultOwnerCurrent())
              onSuccess?.(data);
          },
          onFail: onFail ? (error) => onFail(error) : undefined,
          onObserverError: () => {
            console.error('Unable to update Earn task state');
          },
          getTxid: (data) => {
            const transaction = data[data.length - 1];
            return transaction?.signedTx?.txid || transaction?.decodedTx?.txid;
          },
          failureCertainty: () => 'unknown',
          cancellationCertainty: () => 'unknown',
        });
        if (workflowHandoff) {
          if (
            !taskAccountAddress ||
            !isTaskAccountAddress(
              { accountAddress: taskAccountAddress, networkId },
              singleAccountAddress,
            )
          )
            throw new OneKeyLocalError(
              'Task account changed before withdrawal',
            );
          let cancelBeforePreparation: () => void = () => undefined;
          const cancelled = new Promise<false>((resolve) => {
            cancelBeforePreparation = () => resolve(false);
          });
          const result = Promise.race([
            confirmation.navigation.then(
              (value) => value === 'finished' && isPageActionCurrent(),
            ),
            cancelled,
          ]);
          const cancelFromPage = () => {
            if (!confirmationHandedOff) confirmationLifetime.close();
            if (!preparationStarted || preparationSettled)
              cancelBeforePreparation();
          };
          signal?.addEventListener('abort', cancelFromPage, { once: true });
          try {
            if (signal?.aborted) cancelFromPage();
            return await workflowHandoff.register({
              identity: {
                accountId,
                networkId,
                accountAddress: singleAccountAddress,
                provider,
                action: 'withdraw',
              },
              steps: withdrawProtocol.getSteps(),
              getAdapter: (step) => {
                if (step.id !== 'withdraw' || step.kind !== 'protocol')
                  throw new OneKeyLocalError(
                    'Invalid withdrawal workflow step',
                  );
                return {
                  kind: 'transaction',
                  handoffOnSubmit: true,
                  adapter: mapSingleWithdrawAdapter(confirmation.adapter),
                };
              },
              result,
              cancel: cancelFromPage,
            });
          } finally {
            signal?.removeEventListener('abort', cancelFromPage);
          }
        }
        const task = createEarnWorkflowTask({
          taskId: generateUUID(),
          identity: taskIdentity,
          steps: [
            { id: 'withdraw', kind: 'protocol', lateSubmitted: 'confirming' },
          ],
        });
        const controller = createEarnWorkflowTaskController({
          task,
          initialContext: {},
          getAdapter: (step) => {
            if (step.id !== 'withdraw' || step.kind !== 'protocol') {
              throw new OneKeyLocalError('Invalid withdrawal workflow step');
            }
            return {
              kind: 'transaction',
              adapter: confirmation.adapter,
              handoffOnSubmit: true,
            };
          },
          isCurrent: () =>
            !signal?.aborted &&
            (confirmationHandedOff
              ? isOwnerCurrent() && (isSendCurrent?.() ?? true)
              : (isActionCurrent?.() ?? true)),
          onAsyncError: () => {
            console.error('Unable to update Earn task state');
          },
          expiredMessage: intl.formatMessage({
            id: ETranslations.privacy_error_review_expired__msg,
          }),
        });
        const result = await confirmation.start(controller.run);
        return result === 'finished' && (isActionCurrent?.() ?? true);
      }

      if (withdrawProtocol.kind === 'ethena') {
        const ethenaAccountAddress = workflowHandoff
          ? await getTaskAccountAddress({ accountId, networkId })
          : undefined;
        if (
          workflowHandoff &&
          (signal?.aborted || !(isActionCurrent?.() ?? true))
        )
          return false;
        if (
          workflowHandoff &&
          (!ethenaAccountAddress ||
            !taskAccountAddress ||
            !isTaskAccountAddress(
              { accountAddress: taskAccountAddress, networkId },
              ethenaAccountAddress,
            ))
        )
          throw new OneKeyLocalError('Task account changed before withdrawal');
        const ethenaIdentity = {
          accountId,
          networkId,
          provider,
          action: 'withdraw' as const,
          ...(ethenaAccountAddress
            ? { accountAddress: ethenaAccountAddress }
            : undefined),
          intent: {
            amount,
            symbol,
            identity,
            inputTokenAddress,
            outputTokenAddress,
            protocolVault,
            withdrawAll,
            slippage,
            effectiveApy,
            withdrawType,
          },
        };
        const ethenaExpired = new OneKeyLocalError('Earn withdrawal expired');
        const ensureEthenaActionCurrent = () => {
          if (
            workflowHandoff &&
            (signal?.aborted || !(isActionCurrent?.() ?? true))
          )
            throw ethenaExpired;
        };
        const ethenaParams = {
          identity: ethenaIdentity,
          resumeUnstake: resumeEthenaCooldownUnstake ?? false,
          signal,
          prepare: async (stage) => {
            ensureEthenaActionCurrent();
            const transaction =
              await backgroundApiProxy.serviceStaking.buildUnstakeTransaction({
                amount,
                identity,
                networkId,
                accountId,
                ...(workflowHandoff && ethenaAccountAddress
                  ? { expectedAccountAddress: ethenaAccountAddress }
                  : undefined),
                symbol,
                provider,
                inputTokenAddress,
                outputTokenAddress,
                protocolVault,
                withdrawAll,
                ...(stage === 'swap'
                  ? { ethenaPath: true }
                  : { useEthenaCooldown: true }),
                slippage,
                effectiveApy,
                withdrawType,
              });
            ensureEthenaActionCurrent();
            if (
              workflowHandoff &&
              ethenaAccountAddress &&
              !(await isTaskAccountCurrent({
                accountId,
                networkId,
                accountAddress: ethenaAccountAddress,
              }))
            )
              throw new OneKeyLocalError(
                'Task account changed before withdrawal',
              );
            ensureEthenaActionCurrent();
            const encoded =
              await backgroundApiProxy.serviceStaking.buildInternalDappTx({
                networkId,
                accountId,
                tx: transaction.tx,
                internalDappType: EInternalDappEnum.Staking,
                stakingAction: EInternalStakingAction.Withdraw,
              });
            ensureEthenaActionCurrent();
            if (
              workflowHandoff &&
              ethenaAccountAddress &&
              ((typeof encoded === 'object' &&
                encoded !== null &&
                'from' in encoded &&
                !isTaskEncodedTxOwner(
                  { accountAddress: ethenaAccountAddress, networkId },
                  encoded,
                )) ||
                !(await isTaskAccountCurrent({
                  accountId,
                  networkId,
                  accountAddress: ethenaAccountAddress,
                })))
            )
              throw new OneKeyLocalError(
                'Task account changed before withdrawal',
              );
            ensureEthenaActionCurrent();
            return {
              encodedTx: encoded,
              stakeInfo: createStakeInfoWithOrderId({
                stakingInfo,
                orderId: transaction.orderId,
              }),
            };
          },
          navigate: navigationToTxConfirm,
          isActionCurrent,
          isSendCurrent,
          isExpectedCancellation: workflowHandoff
            ? (error: unknown) => error === ethenaExpired
            : undefined,
          verifyBeforeSend:
            workflowHandoff && ethenaAccountAddress
              ? async () => {
                  if (
                    !(await isTaskAccountCurrent({
                      accountId,
                      networkId,
                      accountAddress: ethenaAccountAddress,
                    }))
                  )
                    throw new OneKeyLocalError(
                      'Task account changed before withdrawal',
                    );
                }
              : undefined,
          onSubmitted: async (stage, data, stakeInfo) => {
            const resultCurrent = () =>
              !signal?.aborted &&
              ((isResultCurrent ?? isSendCurrent ?? isActionCurrent)?.() ??
                true);
            if (stage === 'swap')
              unknownEthenaSwapsRef.current.add(ethenaScope);
            if (stage === 'unstake' && resultCurrent()) onStepChange?.(3);
            await handleStakeSuccess({
              data,
              stakeInfo,
              networkId,
            });
            if (stage === 'unstake' && resultCurrent()) onSuccess?.(data);
          },
          waitForSwap: async (txid) => {
            onStepChange?.(2);
            if (txid) {
              const status = await waitForTxFinalStatus({
                accountId,
                networkId,
                txid,
                signal,
              });
              if (signal?.aborted || !(isActionCurrent?.() ?? true)) {
                if (status === EOnChainHistoryTxStatus.Failed) {
                  unknownEthenaSwapsRef.current.delete(ethenaScope);
                }
                return false;
              }
              if (
                status === EOnChainHistoryTxStatus.Failed ||
                (status === EOnChainHistoryTxStatus.Success &&
                  !signal?.aborted &&
                  (isActionCurrent?.() ?? true))
              ) {
                unknownEthenaSwapsRef.current.delete(ethenaScope);
              }
              if (status !== EOnChainHistoryTxStatus.Success) {
                if (status !== EOnChainHistoryTxStatus.Failed) {
                  unknownEthenaSwapsRef.current.add(ethenaScope);
                }
                if (!signal?.aborted) {
                  Toast.error({
                    title: intl.formatMessage({
                      id: ETranslations.global_failed,
                    }),
                  });
                }
                return false;
              }
            } else {
              unknownEthenaSwapsRef.current.delete(ethenaScope);
            }
            if (signal?.aborted) return false;
            onEthenaCooldownUnstakeReady?.();
            // Allow the first confirmation modal to close before opening another.
            await timerUtils.wait(150);
            return !signal?.aborted;
          },
          onUnknownSwap: () => unknownEthenaSwapsRef.current.add(ethenaScope),
          onSwapSendBlocked: () =>
            unknownEthenaSwapsRef.current.delete(ethenaScope),
          onSwapSend: () => {
            if (unknownEthenaSwapsRef.current.has(ethenaScope)) {
              throw new OneKeyLocalError(
                intl.formatMessage({
                  id: ETranslations.wallet_transaction_maybe_already_submitted_check_activity__msg,
                }),
              );
            }
            unknownEthenaSwapsRef.current.add(ethenaScope);
          },
          onFail,
          onObserverError: () => {
            console.error('Unable to update Earn task state');
          },
        } satisfies Parameters<typeof createEthenaWithdrawFragment>[0];
        if (workflowHandoff && ethenaAccountAddress) {
          const fragment =
            withdrawProtocol.createFragment<IEarnWithdrawApprovalIdentity>({
              ...ethenaParams,
              identity: {
                accountId,
                networkId,
                provider,
                accountAddress: ethenaAccountAddress,
                action: 'withdraw',
              },
            });
          const abortFragment = () => fragment.cancel();
          signal?.addEventListener('abort', abortFragment, { once: true });
          try {
            if (signal?.aborted) {
              abortFragment();
              return false;
            }
            return await workflowHandoff.register({
              identity: {
                ...ethenaParams.identity,
                accountAddress: ethenaAccountAddress,
              },
              steps: fragment.steps,
              getAdapter: (step, context) =>
                mapProtocolWithdrawAdapter(
                  fragment.getAdapter(step, context),
                  (value) => value,
                ),
              result: fragment.result,
              cancel: fragment.cancel,
              isExpectedCancellation: (error) => error === ethenaExpired,
            });
          } finally {
            signal?.removeEventListener('abort', abortFragment);
          }
        }
        return withdrawProtocol.runTask({
          taskId: generateUUID(),
          ...ethenaParams,
        });
      }
      throw new OneKeyLocalError('Unsupported withdrawal workflow');
    },
    [
      accountId,
      ensureRiskAccepted,
      signPersonalMessage,
      networkId,
      navigationToTxConfirm,
      intl,
      resultScope,
    ],
  );
}

export function useUniversalClaim({
  networkId,
  accountId,
}: {
  networkId: string;
  accountId: string;
}) {
  const intl = useIntl();
  const resultAttemptRef = useRef(0);
  const scope = useCommittedEarnScopeGuard(
    JSON.stringify([accountId, networkId]),
  );
  const { navigationToTxConfirm } = useSignatureConfirm({
    accountId,
    networkId,
  });
  const showClaimEstimateGasAlert = useShowClaimEstimateGasAlert();
  const ensureRiskAccepted = useEarnRiskWarningGate();

  return useCallback(
    async ({
      identity,
      amount,
      provider,
      claimTokenAddress,
      claimType,
      protocolVault,
      vault,
      symbol,
      stakingInfo,
      taskAccountAddress,
      onSubmitted,
      onSuccess,
      onFail,
    }: {
      identity?: string;
      amount: string;
      symbol: string;
      provider: string;
      claimTokenAddress?: string;
      claimType?: IEarnClaimType;
      protocolVault?: string;
      stakingInfo?: IStakingInfo;
      taskAccountAddress?: string;
      onSubmitted?: (
        txid: string,
        accountAddress: string,
        accountPublicKey?: string,
      ) => void | Promise<void>;
      vault: string;
      onSuccess?: IModalSendParamList['SendConfirm']['onSuccess'];
      onFail?: IModalSendParamList['SendConfirm']['onFail'];
      portfolioSymbol?: string;
      portfolioRewardSymbol?: string;
    }) => {
      const isCurrent = scope.capture();
      if (!isCurrent()) return false;
      resultAttemptRef.current += 1;
      const resultAttempt = resultAttemptRef.current;
      const isResultCurrent = () =>
        isCurrent() && resultAttemptRef.current === resultAttempt;
      const amountNumber = BigNumber(amount || 0);
      const normalizedAmount = amountNumber.isNaN()
        ? '0'
        : amountNumber.toFixed();
      // OK-59196: one-time DeFi risk disclaimer, same gate the earn stake flow
      // uses.
      if (!(await ensureRiskAccepted({ provider, symbol, networkId }))) {
        return false;
      }
      if (!isCurrent()) return false;
      const accountAddress = await getTaskAccountAddress({
        accountId,
        networkId,
      });
      if (!isCurrent()) return false;
      if (
        taskAccountAddress &&
        !isTaskAccountAddress(
          { accountAddress: taskAccountAddress, networkId },
          accountAddress,
        )
      ) {
        throw new OneKeyLocalError('Claim account changed');
      }

      const continueClaim = async () => {
        let claimOwnerPublicKey: string | undefined;
        const submittedFacts = createSubmittedFactReporter({
          onSubmitted: onSubmitted
            ? (txid) =>
                claimOwnerPublicKey
                  ? onSubmitted(txid, accountAddress, claimOwnerPublicKey)
                  : onSubmitted(txid, accountAddress)
            : undefined,
          isOwnerCurrent: isResultCurrent,
        });
        const reportSubmitted = (txid: string) => submittedFacts.report(txid);
        if (!isCurrent()) return false;
        const scopeExpired = new OneKeyLocalError('Claim scope expired');
        const taskIdentity = {
          accountId,
          networkId,
          accountAddress,
          provider,
          action: 'claim',
          intent: {
            amount: normalizedAmount,
            symbol,
            identity,
            claimTokenAddress,
            claimType,
            protocolVault,
            vault,
          },
        };
        const prepareClaim = async () => {
          try {
            const stakeTx =
              await backgroundApiProxy.serviceStaking.buildClaimTransaction({
                networkId,
                accountId,
                expectedAccountAddress: accountAddress,
                symbol,
                provider,
                amount: normalizedAmount,
                identity,
                claimTokenAddress,
                claimType,
                vault,
              });
            if (!isCurrent()) throw scopeExpired;
            claimOwnerPublicKey = stakeTx.claimOwnerPublicKey;
            const encodedTx =
              await backgroundApiProxy.serviceStaking.buildInternalDappTx({
                networkId,
                accountId,
                tx: stakeTx.tx,
                internalDappType: EInternalDappEnum.Staking,
                stakingAction: EInternalStakingAction.Claim,
              });
            if (!isCurrent()) throw scopeExpired;
            if (
              (typeof encodedTx === 'object' &&
                encodedTx !== null &&
                'from' in encodedTx &&
                !isTaskEncodedTxOwner(
                  { accountAddress, networkId },
                  encodedTx,
                )) ||
              !(await isTaskAccountCurrent({
                accountId,
                networkId,
                accountAddress,
              }))
            ) {
              throw new OneKeyLocalError('Claim account changed');
            }
            if (!isCurrent()) throw scopeExpired;
            let useFeeInTx;
            let feeInfoEditable;
            if (
              networkUtils.isBTCNetwork(networkId) &&
              (encodedTx as IEncodedTxBtc).fee
            ) {
              useFeeInTx = true;
              feeInfoEditable = false;
            }

            const stakeInfoWithOrderId = createStakeInfoWithOrderId({
              stakingInfo,
              orderId: stakeTx.orderId,
            });

            return {
              encodedTx,
              stakeInfoWithOrderId,
              useFeeInTx,
              feeInfoEditable,
            };
          } catch (error) {
            if (!isCurrent()) throw scopeExpired;
            throw error;
          }
        };
        type IPreparedClaim = Awaited<ReturnType<typeof prepareClaim>>;
        type IClaimStep = IEarnSingleTransactionStep<'protocol'>;
        const taskState = createEarnSingleTransactionTaskState({
          taskId: generateUUID(),
          identity: taskIdentity,
          step: { id: 'claim', kind: 'protocol' as const },
          lateSubmitted: 'confirming',
        });
        const observeLateOrder = createLateEarnOrderObserver({
          accountId,
          networkId,
          onError: () => {
            console.error('Unable to record late Earn order');
          },
        });
        const confirmationLifetime = createEarnConfirmationLifecycle();
        const confirmation = createEarnConfirmationTaskAdapter<
          typeof taskIdentity,
          IClaimStep,
          IPreparedClaim,
          ISendTxOnSuccessData[],
          Error
        >({
          prepare: prepareClaim,
          navigate: async (payload, callbacks) => {
            await navigationToTxConfirm({
              encodedTx: payload.encodedTx,
              stakingInfo: payload.stakeInfoWithOrderId,
              onSuccess: callbacks.onSuccess,
              onLateBroadcastAccepted: (fact) =>
                observeLateOrder({
                  fact,
                  stakeInfo: payload.stakeInfoWithOrderId,
                  onAccepted: callbacks.onLateBroadcastAccepted,
                }),
              onFail: onFail
                ? (error) => {
                    confirmationLifetime.close();
                    callbacks.onFail(error);
                  }
                : undefined,
              onSafePreSendFail: (error) => onFail?.(error),
              onConfirmationFail: (error) => {
                confirmationLifetime.close();
                callbacks.onFail(error);
              },
              onCancel: () => {
                confirmationLifetime.close();
                callbacks.onCancel();
              },
              onBeforeSend: () =>
                confirmationLifetime.beforeSend(async () => {
                  if (
                    confirmationLifetime.isClosed() ||
                    !isCurrent() ||
                    !(await isTaskAccountCurrent({
                      accountId,
                      networkId,
                      accountAddress,
                    })) ||
                    confirmationLifetime.isClosed() ||
                    !isCurrent()
                  ) {
                    throw new OneKeyLocalError('Claim account changed');
                  }
                  callbacks.onSendObserved();
                }),
              isNavigationCurrent: isCurrent,
              useFeeInTx: payload.useFeeInTx,
              feeInfoEditable: payload.feeInfoEditable,
            });
          },
          onSuccess: async (data, payload) => {
            const ownerCurrent =
              !confirmationLifetime.isClosed() && isResultCurrent();
            const accountCheck = ownerCurrent
              ? isTaskAccountCurrent({
                  accountId,
                  networkId,
                  accountAddress,
                }).catch(() => false)
              : Promise.resolve(false);
            await recordStakeOrder({
              data,
              stakeInfo: payload.stakeInfoWithOrderId,
              networkId,
              ...(ownerCurrent
                ? undefined
                : {
                    remoteSync: 'once' as const,
                    preserveExistingTx: true as const,
                  }),
            });
            if (
              !(await accountCheck) ||
              confirmationLifetime.isClosed() ||
              !isCurrent()
            )
              return;
            try {
              if (
                !(await isTaskAccountCurrent({
                  accountId,
                  networkId,
                  accountAddress,
                }))
              )
                return;
            } catch {
              return;
            }
            if (!(await submittedFacts.wait(data))) return;
            if (confirmationLifetime.isClosed() || !isResultCurrent()) return;
            try {
              if (
                !(await isTaskAccountCurrent({
                  accountId,
                  networkId,
                  accountAddress,
                }))
              )
                return;
            } catch {
              return;
            }
            if (!confirmationLifetime.isClosed() && isResultCurrent())
              onSuccess?.(data);
          },
          onBroadcastAccepted: reportSubmitted,
          onFail: onFail ? (error) => onFail(error) : undefined,
          onObserverError: () => {
            console.error('Unable to update Earn task state');
          },
          getTxid: (data) => {
            const tx = data[data.length - 1];
            return tx?.signedTx?.txid || tx?.decodedTx?.txid;
          },
          failureCertainty: () => 'unknown',
          cancellationCertainty: () => 'unknown',
        });
        const controller = createEarnTransactionTaskController({
          state: taskState,
          adapter: confirmation.adapter,
          normalizePreparation: (preparation) => preparation,
          shouldHandoffOnSubmit: () => true,
          isCurrent,
          onChange: () => undefined,
          expiredMessage: intl.formatMessage({
            id: ETranslations.privacy_error_review_expired__msg,
          }),
        });
        try {
          const result = await confirmation.start(controller.run);
          return result === 'finished' && isCurrent();
        } catch (error) {
          if (error === scopeExpired) return false;
          throw error;
        }
      };
      if (amountNumber.gt(0)) {
        const estimateFeeResp =
          await backgroundApiProxy.serviceStaking.estimateFee({
            networkId,
            provider,
            symbol,
            action: 'claim',
            amount: normalizedAmount,
            protocolVault,
            identity,
            accountAddress,
          });
        if (!isCurrent()) return false;
        // Only check gas fee vs claim value if token price is available
        if (estimateFeeResp.token?.price) {
          const tokenFiatValueBN = BigNumber(
            estimateFeeResp.token.price,
          ).multipliedBy(normalizedAmount);
          if (tokenFiatValueBN.lt(estimateFeeResp.feeFiatValue)) {
            showClaimEstimateGasAlert({
              claimTokenFiatValue: tokenFiatValueBN.toFixed(),
              estFiatValue: estimateFeeResp.feeFiatValue,
              onConfirm: async () => {
                await continueClaim();
              },
            });
            // The alert owns the flow from here; it either continues or the
            // user dismisses it, so the hand-off counts as started.
            return true;
          }
        }
      }
      return continueClaim();
    },
    [
      ensureRiskAccepted,
      intl,
      navigationToTxConfirm,
      accountId,
      networkId,
      scope,
      showClaimEstimateGasAlert,
    ],
  );
}
