import type { IEncodedTxBtc } from '@onekeyhq/core/src/chains/btc/types';
import type { IEncodedTx } from '@onekeyhq/core/src/types';
import type { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import {
  EInternalDappEnum,
  EInternalStakingAction,
  type IStakeTxResponse,
  type IStakingInfo,
  type IWithdrawBaseParams,
} from '@onekeyhq/shared/types/staking';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import { createEarnWorkflowTaskController } from '../../tasks/earnWorkflowTaskController';
import { createEarnWorkflowTask } from '../../tasks/earnWorkflowTaskState';

import type { IEarnTaskScope } from '../../tasks/earnTaskPlan';
import type {
  IEarnWorkflowStepPlan,
  IEarnWorkflowTaskStep,
} from '../../tasks/earnWorkflowTaskState';

type IBabylonEncodeServices = {
  buildInternalTx: (params: {
    accountId: string;
    networkId: string;
    tx: IStakeTxResponse['tx'];
    internalDappType: EInternalDappEnum.Staking;
    stakingAction: EInternalStakingAction.Withdraw;
  }) => Promise<IEncodedTx>;
};

type IBabylonPrepared = {
  encodedTx: IEncodedTx;
  stakeInfo?: IStakingInfo;
  useFeeInTx?: boolean;
  feeInfoEditable?: boolean;
};

function isExternalBroadcast(tx: IStakeTxResponse['tx']): boolean {
  return (
    typeof tx === 'object' &&
    tx !== null &&
    'exitBroadcasted' in tx &&
    tx.exitBroadcasted === true
  );
}

/** Encodes a response obtained by an external task step. */
export async function prepareBabylonConfirmation({
  request,
  stakeTx,
  stakingInfo,
  services,
  isActionCurrent,
}: {
  request: Pick<IWithdrawBaseParams, 'accountId' | 'networkId'>;
  stakeTx: IStakeTxResponse;
  stakingInfo?: IStakingInfo;
  services: IBabylonEncodeServices;
  isActionCurrent: () => boolean;
}): Promise<
  | { type: 'prepared'; value: IBabylonPrepared }
  | { type: 'cancelled' }
  | { type: 'externalBroadcast' }
> {
  const { accountId, networkId } = request;
  if (isExternalBroadcast(stakeTx.tx)) return { type: 'externalBroadcast' };
  if (!isActionCurrent()) return { type: 'cancelled' };
  const encodedTx = await services.buildInternalTx({
    networkId,
    accountId,
    tx: stakeTx.tx,
    internalDappType: EInternalDappEnum.Staking,
    stakingAction: EInternalStakingAction.Withdraw,
  });
  if (!isActionCurrent()) return { type: 'cancelled' };
  const hasFee =
    networkUtils.isBTCNetwork(networkId) && (encodedTx as IEncodedTxBtc).fee;
  return {
    type: 'prepared',
    value: {
      encodedTx,
      stakeInfo: stakingInfo
        ? {
            ...stakingInfo,
            ...(stakeTx.orderId ? { orderId: stakeTx.orderId } : undefined),
          }
        : undefined,
      useFeeInTx: hasFee ? true : undefined,
      feeInfoEditable: hasFee ? false : undefined,
    },
  };
}

type IBabylonIntent = Omit<
  IWithdrawBaseParams,
  'accountId' | 'networkId' | 'provider' | 'identity'
>;
type IBabylonStage =
  | { type: 'initial' }
  | { type: 'address'; accountAddress: string }
  | { type: 'built'; stakeTx: IStakeTxResponse; accountAddress: string }
  | { type: 'signed'; psbt: string; accountAddress: string };
export type IBabylonWithdrawContext = { babylon?: IBabylonStage };
export type IBabylonWithdrawFacts = {
  build: 'pending' | 'prepared' | 'broadcast';
};
export type IBabylonWithdrawFact = {
  type: 'buildAccepted';
  broadcast: boolean;
};
type IBabylonFactRecorder = (params: {
  stepId: string;
  attemptId: string;
  fact: IBabylonWithdrawFact;
}) => boolean;

type IBabylonAdapter<TContext> = Extract<
  ReturnType<
    Parameters<
      typeof createEarnWorkflowTaskController<
        IEarnTaskScope,
        TContext,
        never,
        IBabylonWithdrawFacts,
        IBabylonWithdrawFact
      >
    >[0]['getAdapter']
  >,
  { kind: 'external' | 'sign' }
>;
type IBabylonServices = IBabylonEncodeServices & {
  getAccountAddress: (params: {
    accountId: string;
    networkId: string;
  }) => Promise<string>;
  buildUnstake: (
    params: IWithdrawBaseParams & { expectedAccountAddress: string },
  ) => Promise<IStakeTxResponse>;
  unstakePush: (params: {
    txId: string;
    networkId: string;
    accountId: string;
    symbol: string;
    provider: string;
    unstakeTxHex: string;
    expectedAccountAddress: string;
  }) => Promise<unknown>;
};
type INavigate = ReturnType<
  typeof useSignatureConfirm
>['navigationToTxConfirm'];

export type IBabylonWithdrawFragmentParams = {
  accountId: string;
  networkId: string;
  provider: string;
  identity?: string;
  intent: IBabylonIntent;
  stakingInfo?: IStakingInfo;
  services: IBabylonServices;
  navigate: INavigate;
  isActionCurrent?: () => boolean;
  isSendCurrent?: () => boolean;
  isResultCurrent?: () => boolean;
  expiredMessage: string;
  onSuccess?: (data: ISendTxOnSuccessData[]) => void;
  onFail?: (error: Error) => void;
  onObserverError: (error: unknown) => void;
  onPushError: (error: unknown) => void;
  onExternalBroadcast?: () => void;
};

export function getBabylonWithdrawSteps(): readonly IEarnWorkflowStepPlan[] {
  return [
    { id: 'build', kind: 'external' },
    { id: 'sign', kind: 'sign' },
    { id: 'push', kind: 'external' },
  ];
}

export function createBabylonWithdrawFragment<
  TContext extends IBabylonWithdrawContext,
>({
  accountId,
  networkId,
  provider,
  identity,
  intent,
  stakingInfo,
  services,
  navigate,
  isActionCurrent,
  isSendCurrent,
  isResultCurrent,
  expiredMessage,
  onSuccess,
  onFail,
  onObserverError,
  onPushError,
  onExternalBroadcast,
}: IBabylonWithdrawFragmentParams) {
  const request: IWithdrawBaseParams = {
    ...intent,
    accountId,
    networkId,
    provider,
    identity,
  };
  const current = () => isActionCurrent?.() ?? true;
  let viewDetached = false;
  let dispatched = false;
  let navigationInvoked = false;
  let navigationBlocked = false;
  let claimed = false;
  let pendingOperations = 0;
  let navigationPending = false;
  let continuationPending = false;
  let terminal = false;
  let lifecycleSettled = false;
  let resolveLifecycle: () => void = () => undefined;
  const lifecycle = new Promise<void>((resolve) => {
    resolveLifecycle = resolve;
  });
  const finishLifecycle = () => {
    if (
      !lifecycleSettled &&
      terminal &&
      pendingOperations === 0 &&
      !navigationPending &&
      !continuationPending
    ) {
      lifecycleSettled = true;
      resolveLifecycle();
    }
  };
  const track = async <T>(operation: () => Promise<T>): Promise<T> => {
    pendingOperations += 1;
    try {
      return await operation();
    } catch (error) {
      terminal = true;
      throw error;
    } finally {
      pendingOperations -= 1;
      finishLifecycle();
    }
  };
  let startedSettled = false;
  let resolveStarted: (value: boolean) => void = () => undefined;
  let rejectStarted: (error: unknown) => void = () => undefined;
  const started = new Promise<boolean>((resolve, reject) => {
    resolveStarted = resolve;
    rejectStarted = reject;
  });
  void started.catch(() => undefined);
  let recordFact: IBabylonFactRecorder | undefined;
  const settleStarted = (value: boolean) => {
    if (!startedSettled) {
      startedSettled = true;
      resolveStarted(value);
    }
  };
  const failStarted = (error: unknown) => {
    if (!startedSettled) {
      startedSettled = true;
      rejectStarted(error);
    }
  };
  const bindRuntime = (runtime: {
    retained: boolean;
    recordFact: IBabylonFactRecorder;
  }) => {
    if (!runtime.retained) {
      const error = new OneKeyLocalError('Babylon requires a retained task');
      terminal = true;
      finishLifecycle();
      failStarted(error);
      throw error;
    }
    if (recordFact) throw new OneKeyLocalError('Babylon runtime already bound');
    recordFact = runtime.recordFact;
  };
  const getAdapter = (
    step: IEarnWorkflowTaskStep,
    context: TContext,
  ): IBabylonAdapter<TContext> => {
    if (step.id === 'build' && step.kind === 'external') {
      return {
        kind: 'external',
        prepare: ({ context: previous }) =>
          track(async () => {
            const accountAddress = await services.getAccountAddress({
              accountId,
              networkId,
            });
            if (!accountAddress.trim())
              throw new OneKeyLocalError('Missing task account address');
            return {
              ...previous,
              babylon: { type: 'address', accountAddress },
            };
          }),
        execute: ({ stepId, attemptId, context: prepared }) =>
          track(async () => {
            const stage = prepared.babylon;
            if (stage?.type !== 'address')
              throw new OneKeyLocalError('Babylon account address is missing');
            if (!recordFact)
              throw new OneKeyLocalError('Babylon runtime is not bound');
            const stakeTx = await services.buildUnstake({
              ...request,
              expectedAccountAddress: stage.accountAddress,
            });
            const broadcast = isExternalBroadcast(stakeTx.tx);
            recordFact({
              stepId,
              attemptId,
              fact: { type: 'buildAccepted', broadcast },
            });
            return {
              type: 'completed',
              context: {
                ...prepared,
                babylon: {
                  type: 'built',
                  stakeTx,
                  accountAddress: stage.accountAddress,
                },
              },
            };
          }),
      };
    }
    if (step.id === 'sign' && step.kind === 'sign') {
      return {
        kind: 'sign',
        run: ({ createContinuation }) =>
          track(async () => {
            const stage = context.babylon;
            if (stage?.type !== 'built')
              throw new OneKeyLocalError(
                'Babylon withdrawal response is missing',
              );
            const prepared = await prepareBabylonConfirmation({
              request,
              stakeTx: stage.stakeTx,
              stakingInfo,
              services,
              isActionCurrent: () => !viewDetached && current(),
            });
            if (prepared.type === 'cancelled') {
              terminal = true;
              settleStarted(false);
              return { type: 'cancelled' };
            }
            if (prepared.type === 'externalBroadcast') {
              terminal = true;
              if (!viewDetached && current()) {
                onExternalBroadcast?.();
                if ((isResultCurrent ?? isSendCurrent)?.() ?? true)
                  onSuccess?.([]);
              }
              settleStarted(!viewDetached && current());
              return { type: 'cancelled' };
            }
            let resolveSigned: (
              result: { type: 'continued' } | { type: 'cancelled' },
            ) => void = () => undefined;
            const signed = new Promise<
              { type: 'continued' } | { type: 'cancelled' }
            >((resolve) => {
              resolveSigned = resolve;
            });
            const continuation = createContinuation({
              externalStepId: 'push',
              requestId: identity,
            });
            dispatched = true;
            continuationPending = true;
            const close = () => {
              continuation.close();
              resolveSigned({ type: 'cancelled' });
              if (!claimed) {
                continuationPending = false;
                terminal = true;
                finishLifecycle();
              }
            };
            navigationInvoked = true;
            navigationPending = true;
            let navigation: ReturnType<INavigate>;
            try {
              navigation = navigate({
                encodedTx: prepared.value.encodedTx,
                stakingInfo: prepared.value.stakeInfo,
                signOnly: true,
                useFeeInTx: prepared.value.useFeeInTx,
                feeInfoEditable: prepared.value.feeInfoEditable,
                isNavigationCurrent: () => {
                  const allowed = !viewDetached && current();
                  if (!allowed) navigationBlocked = true;
                  return allowed;
                },
                onBeforeSend: isSendCurrent
                  ? () => {
                      if (!isSendCurrent()) {
                        close();
                        throw new OneKeyLocalError(expiredMessage);
                      }
                    }
                  : undefined,
                onSuccess: (data) => {
                  const followup = (async () => {
                    const psbt = data[0]?.signedTx?.finalizedPsbtHex;
                    const signedAccount = data[0]?.decodedTx?.accountId;
                    const signedNetwork = data[0]?.decodedTx?.networkId;
                    if (
                      !continuation.claim({
                        context: {
                          ...context,
                          babylon: {
                            type: 'signed',
                            psbt: psbt ?? '',
                            accountAddress: stage.accountAddress,
                          },
                        },
                        hasPayload: Boolean(psbt),
                        eligible:
                          Boolean(identity) &&
                          signedAccount === accountId &&
                          signedNetwork === networkId,
                      })
                    ) {
                      resolveSigned({ type: 'cancelled' });
                      if (!claimed) {
                        continuationPending = false;
                        terminal = true;
                        finishLifecycle();
                      }
                      return;
                    }
                    claimed = true;
                    resolveSigned({ type: 'continued' });
                    try {
                      await continuation.completion;
                      if (
                        !viewDetached &&
                        ((isResultCurrent ?? isSendCurrent)?.() ?? current())
                      )
                        onSuccess?.(data);
                    } finally {
                      continuationPending = false;
                      terminal = true;
                      finishLifecycle();
                    }
                  })();
                  void followup.catch((error: unknown) => {
                    if (
                      !viewDetached &&
                      ((isResultCurrent ?? isSendCurrent)?.() ?? current())
                    )
                      onPushError(error);
                    else onObserverError(error);
                  });
                  return followup;
                },
                onFail: onFail
                  ? (error) => {
                      try {
                        onFail(error);
                      } finally {
                        close();
                      }
                    }
                  : undefined,
                onConfirmationFail: (error) => {
                  try {
                    onFail?.(error);
                  } finally {
                    close();
                  }
                },
                onCancel: close,
              });
            } catch (error) {
              navigationPending = false;
              close();
              throw error;
            }
            void navigation.then(
              () => {
                navigationPending = false;
                if (navigationBlocked && !claimed) close();
                settleStarted(!viewDetached && current());
                finishLifecycle();
              },
              (error: unknown) => {
                navigationPending = false;
                close();
                failStarted(error);
                finishLifecycle();
              },
            );
            return signed;
          }),
      };
    }
    if (step.id !== 'push' || step.kind !== 'external')
      throw new OneKeyLocalError('Invalid Babylon withdrawal step');
    return {
      kind: 'external',
      prepare: async ({ context: previous }) => previous,
      execute: ({ context: prepared }) =>
        track(async () => {
          const stage = prepared.babylon;
          if (stage?.type !== 'signed' || !identity)
            throw new OneKeyLocalError('Babylon signed withdrawal is missing');
          await services.unstakePush({
            txId: identity,
            networkId,
            accountId,
            symbol: request.symbol,
            provider,
            unstakeTxHex: stage.psbt,
            expectedAccountAddress: stage.accountAddress,
          });
          return {
            type: 'completed',
            context: { ...prepared, babylon: { type: 'initial' } },
          };
        }),
    };
  };
  return {
    getAdapter,
    result: started,
    lifecycle,
    handlesContinuationErrors: true as const,
    bindRuntime,
    detachView: () => {
      viewDetached = true;
      terminal = true;
      finishLifecycle();
    },
    isDispatched: () => dispatched,
    isViewCurrent: () => !viewDetached && current(),
    isCurrent: current,
    onRunComplete: () => {
      terminal = true;
      finishLifecycle();
      if (!navigationInvoked && !startedSettled) settleStarted(false);
    },
    onRunError: (error: unknown) => {
      terminal = true;
      finishLifecycle();
      if (!startedSettled) failStarted(error);
      else if (!claimed) onObserverError(error);
    },
  };
}

/** The caller owns the risk gate and the separate send/result scopes. */
export function createBabylonWithdrawTask({
  taskId,
  ...params
}: IBabylonWithdrawFragmentParams & { taskId: string }) {
  const task = createEarnWorkflowTask({
    taskId,
    identity: {
      accountId: params.accountId,
      networkId: params.networkId,
      provider: params.provider,
      action: 'withdraw',
      intent: {
        amount: params.intent.amount,
        symbol: params.intent.symbol,
        identity: params.identity,
        inputTokenAddress: params.intent.inputTokenAddress,
        outputTokenAddress: params.intent.outputTokenAddress,
        protocolVault: params.intent.protocolVault,
        withdrawAll: params.intent.withdrawAll,
        slippage: params.intent.slippage,
        effectiveApy: params.intent.effectiveApy,
        withdrawType: params.intent.withdrawType,
      },
    },
    steps: getBabylonWithdrawSteps(),
  });
  const fragment =
    createBabylonWithdrawFragment<IBabylonWithdrawContext>(params);
  const controller = createEarnWorkflowTaskController<
    typeof task.identity,
    IBabylonWithdrawContext,
    never,
    IBabylonWithdrawFacts,
    IBabylonWithdrawFact
  >({
    task,
    initialContext: {},
    retained: true,
    isCurrent: fragment.isCurrent,
    expiredMessage: params.expiredMessage,
    onAsyncError: params.onObserverError,
    facts: {
      initial: { build: 'pending' },
      reduce: (facts, fact) =>
        fact.type === 'buildAccepted'
          ? { ...facts, build: fact.broadcast ? 'broadcast' : 'prepared' }
          : facts,
    },
    getAdapter: fragment.getAdapter,
  });
  fragment.bindRuntime({ retained: true, recordFact: controller.recordFact });
  const owner = controller.attachOwner(fragment.isViewCurrent);
  let invoked = false;
  const run = async () => {
    if (invoked) return false;
    invoked = true;
    if (!fragment.isCurrent()) {
      controller.cancel();
      fragment.onRunComplete();
      return false;
    }
    void controller
      .run(owner)
      .then(fragment.onRunComplete, fragment.onRunError);
    return fragment.result;
  };
  const cancel = () => {
    fragment.detachView();
    if (fragment.isDispatched()) controller.detachOwner(owner);
    else controller.cancel();
  };
  return {
    run,
    cancel,
    getTask: controller.getTask,
    subscribe: controller.subscribe,
  };
}
