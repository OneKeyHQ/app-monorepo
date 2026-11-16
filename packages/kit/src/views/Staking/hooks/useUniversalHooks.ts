import { useCallback } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import type { IEncodedTxBtc } from '@onekeyhq/core/src/chains/btc/types';
import type { IEncodedTx } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { waitForTxFinalStatus } from '@onekeyhq/kit/src/utils/waitForTxFinalStatus';
import type { IApproveInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import {
  EtherFiLiquidReferContract,
  EthereumWETH,
} from '@onekeyhq/shared/src/consts/addresses';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { type IModalSendParamList } from '@onekeyhq/shared/src/routes';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';
import {
  type EApproveType,
  EInternalDappEnum,
  EInternalStakingAction,
  type IClaimApproveInfo,
  type IClaimFollowUpInfo,
  type IEarnClaimType,
  type IEarnPermit2ApproveSignData,
  type IEarnStakeType,
  type IEarnUtmParams,
  type IEarnWithdrawType,
  type IStakeTxResponse,
  type IStakeTxStakefishExitBroadcast,
  type IStakingInfo,
} from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';
import {
  EDecodedTxStatus,
  type IBroadcastAcceptedFact,
  type ISendTxOnSuccessData,
} from '@onekeyhq/shared/types/tx';

import { runClaimConversion } from '../components/ClaimConversionDialog';
import {
  showEarnRiskWarningDialog,
  useEarnRiskWarningGate,
} from '../components/EarnRiskWarningDialog';
import { useShowClaimEstimateGasAlert } from '../components/EstimateNetworkFee';
import { showServerExecutedOrderDialog } from '../components/ServerExecutedOrderDialog';

import { etherFiDepositRecovery } from './etherFiDepositRecovery';
import {
  getEtherFiNativeRecoveryBalance,
  refreshEtherFiNativeDepositRecovery,
} from './useEtherFiNativeDepositRecovery';

import type { IntlShape } from 'react-intl';

const createStakeInfoWithOrderId = ({
  stakingInfo,
  orderId,
}: {
  stakingInfo: IStakingInfo | undefined;
  orderId?: string;
}): IStakingInfo | undefined =>
  stakingInfo
    ? {
        ...stakingInfo,
        ...(orderId ? { orderId } : undefined),
      }
    : undefined;

const getEarnOrderTrackingInfo = (stakingInfo?: IStakingInfo) => ({
  stakingLabel: stakingInfo?.label,
  stakingProtocol: stakingInfo?.protocol,
  stakingTags: stakingInfo?.tags,
});

async function recordLateEtherFiOrder({
  fact,
  accountId,
  networkId,
  stakeInfo,
  signal,
  intl,
}: {
  fact: IBroadcastAcceptedFact;
  accountId: string;
  networkId: string;
  stakeInfo?: IStakingInfo;
  signal?: AbortSignal;
  intl: IntlShape;
}) {
  if (
    !stakeInfo?.orderId ||
    fact.accountId !== accountId ||
    fact.networkId !== networkId
  )
    return;
  let result: Awaited<
    ReturnType<typeof backgroundApiProxy.serviceStaking.recordLateEtherFiOrder>
  >;
  try {
    result = await backgroundApiProxy.serviceStaking.recordLateEtherFiOrder({
      uuid: fact.uuid,
      accountId,
      networkId,
      order: {
        orderId: stakeInfo.orderId,
        networkId,
        txId: fact.txid,
        status: EDecodedTxStatus.Pending,
        ...getEarnOrderTrackingInfo(stakeInfo),
      },
    });
  } catch {
    result = 'unknown';
  }
  if (result === 'synced') return;
  if (!signal?.aborted) {
    Toast.error({
      title: intl.formatMessage({ id: ETranslations.global_an_error_occurred }),
    });
  } else {
    console.warn('EtherFi late order synchronization is incomplete');
  }
}

type ITxConfirmResult =
  | {
      status: 'success';
      data: ISendTxOnSuccessData[];
    }
  | {
      status: 'cancel';
    };

/**
 * Server-executed order (OK-61790, Unitas): the stake / unstake response
 * carries `tx: null` and an orderId. The order stays tracked server side when
 * the user closes the dialog before it reaches a final state.
 */
const handleServerExecutedOrder = async ({
  orderId,
  networkId,
  accountId,
  intl,
  onSuccess,
  onFail,
}: {
  orderId: string;
  networkId: string;
  accountId: string;
  intl: IntlShape;
  onSuccess?: IModalSendParamList['SendConfirm']['onSuccess'];
  onFail?: IModalSendParamList['SendConfirm']['onFail'];
}) => {
  const order = await showServerExecutedOrderDialog({
    orderId,
    networkId,
    accountId,
  });
  if (order?.status === 'failed') {
    onFail?.(
      new OneKeyLocalError(
        order.errorMessage ??
          intl.formatMessage({ id: ETranslations.global_failed }),
      ),
    );
    return false;
  }
  onSuccess?.([]);
  return true;
};

type IStakeConfirmPayload = {
  encodedTx?: IEncodedTx;
  stakeInfoWithOrderId?: IStakingInfo;
  useFeeInTx?: boolean;
  feeInfoEditable?: boolean;
  /** Set when the protocol executes the order itself (tx === null). */
  serverOrderId?: string;
};

const handleStakeSuccess = async ({
  data,
  stakeInfo,
  networkId,
  onSuccess,
  etherFiOrder,
}: {
  data: ISendTxOnSuccessData[];
  stakeInfo?: IStakingInfo;
  networkId: string;
  onSuccess?: IModalSendParamList['SendConfirm']['onSuccess'];
  etherFiOrder?: { signal?: AbortSignal; intl: IntlShape; accountId: string };
}) => {
  const orderTx = Array.isArray(data) ? data[data.length - 1] : undefined;
  if (orderTx?.signedTx?.txid && stakeInfo?.orderId) {
    const order = {
      orderId: stakeInfo.orderId,
      networkId,
      txId: orderTx.signedTx.txid,
      status: orderTx.decodedTx.status,
      ...getEarnOrderTrackingInfo(stakeInfo),
    };
    if (!etherFiOrder) {
      await backgroundApiProxy.serviceStaking.addEarnOrder(order);
    } else {
      let synced = false;
      try {
        synced =
          (await backgroundApiProxy.serviceStaking.addEarnOrder(order, {
            etherFiOnce: true,
            accountId: etherFiOrder.accountId,
          })) === 'synced';
      } catch {
        synced = false;
      }
      if (!synced) {
        if (!etherFiOrder.signal?.aborted) {
          Toast.error({
            title: etherFiOrder.intl.formatMessage({
              id: ETranslations.global_an_error_occurred,
            }),
          });
        } else {
          console.warn('EtherFi order synchronization is incomplete');
        }
      }
    }
  }
  onSuccess?.(data);
};

export function useUniversalStake({
  networkId,
  accountId,
}: {
  networkId: string;
  accountId: string;
}) {
  const { navigationToTxConfirm } = useSignatureConfirm({
    accountId,
    networkId,
  });
  const intl = useIntl();
  const waitForTxConfirmResult = useCallback(
    async ({
      encodedTx,
      stakingInfo,
      approvesInfo,
      useFeeInTx,
      feeInfoEditable,
      signal,
      verifyAccount,
      onAttemptStarted,
      onTransactionSuccess,
      onLateBroadcastAccepted,
    }: {
      encodedTx?: IEncodedTx;
      stakingInfo?: IStakingInfo;
      approvesInfo?: IApproveInfo[];
      useFeeInTx?: boolean;
      feeInfoEditable?: boolean;
      signal?: AbortSignal;
      verifyAccount?: () => Promise<void>;
      onAttemptStarted?: (uuid: string) => void;
      onTransactionSuccess?: (data: ISendTxOnSuccessData[]) => void;
      onLateBroadcastAccepted?: (fact: IBroadcastAcceptedFact) => void;
    }): Promise<ITxConfirmResult> =>
      new Promise((resolve, reject) => {
        let settled = false;

        const resolveOnce = (result: ITxConfirmResult) => {
          if (settled) {
            return;
          }
          settled = true;
          signal?.removeEventListener('abort', onAbort);
          resolve(result);
        };

        const rejectOnce = (error: unknown) => {
          if (settled) {
            return;
          }
          settled = true;
          signal?.removeEventListener('abort', onAbort);
          reject(error);
        };

        function onAbort() {
          resolveOnce({ status: 'cancel' });
        }
        if (signal?.aborted) {
          onAbort();
          return;
        }
        signal?.addEventListener('abort', onAbort, { once: true });

        void navigationToTxConfirm({
          encodedTx,
          stakingInfo,
          approvesInfo,
          useFeeInTx,
          feeInfoEditable,
          isNavigationCurrent: signal
            ? () => !signal.aborted && !settled
            : undefined,
          onNavigationSkipped: signal ? onAbort : undefined,
          onBeforeSend: signal
            ? async () => {
                if (signal.aborted || settled)
                  throw new OneKeyLocalError('Stake context expired');
                await verifyAccount?.();
                if (signal.aborted || settled)
                  throw new OneKeyLocalError('Stake context expired');
              }
            : undefined,
          onBroadcastStart: signal
            ? (uuid) => {
                if (signal.aborted || settled)
                  throw new OneKeyLocalError('Stake context expired');
                onAttemptStarted?.(uuid);
              }
            : undefined,
          onSuccess: (data) => {
            onTransactionSuccess?.(data);
            resolveOnce({ status: 'success', data });
          },
          onFail: (error) => rejectOnce(error),
          onCancel: () => resolveOnce({ status: 'cancel' }),
          onLateBroadcastAccepted,
        }).catch((error) => rejectOnce(error));
      }),
    [navigationToTxConfirm],
  );

  return useCallback(
    async ({
      amount,
      actionSignal,
      verifyEtherFiLegacyApproval,
      etherFiNativeRecovery,
      beforeEtherFiPostWrapDeposit,
      onTransactionSubmitted,
      expectedAccountAddress,
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
      postWrapStakeToken,
      postWrapApproveSpenderAddress,
      stakingInfo,
      onSuccess,
      onFail,
      onStepChange,
      // Stakefish specific param
      validatorPublicKey,
      utm,
    }: {
      amount: string;
      actionSignal?: AbortSignal;
      verifyEtherFiLegacyApproval?: () => Promise<boolean>;
      etherFiNativeRecovery?: { id: symbol; owner: symbol; amount: string };
      beforeEtherFiPostWrapDeposit?: (signal?: AbortSignal) => Promise<boolean>;
      onTransactionSubmitted?: () => void;
      expectedAccountAddress?: string;
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
      postWrapStakeToken?: IToken;
      postWrapApproveSpenderAddress?: string;
      stakingInfo?: IStakingInfo;
      onSuccess?: IModalSendParamList['SendConfirm']['onSuccess'];
      onFail?: IModalSendParamList['SendConfirm']['onFail'];
      onStepChange?: (
        step: number,
        options?: { shouldShowPostWrapApproveStep?: boolean },
      ) => void;
      // Stakefish specific param
      validatorPublicKey?: string;
      // Campaign attribution, forwarded to the server unchanged
      utm?: IEarnUtmParams;
    }) => {
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
      if (actionSignal?.aborted) return false;
      if (
        earnUtils.isEtherFiProvider({ providerName: provider }) &&
        !expectedAccountAddress
      ) {
        throw new OneKeyLocalError('Stake account unavailable');
      }
      const verifyAccount = expectedAccountAddress
        ? async () => {
            const account = await backgroundApiProxy.serviceAccount.getAccount({
              accountId,
              networkId,
            });
            if (
              account.address.toLowerCase() !==
              expectedAccountAddress.toLowerCase()
            ) {
              throw new OneKeyLocalError('Stake account changed');
            }
            if (
              verifyEtherFiLegacyApproval &&
              !(await verifyEtherFiLegacyApproval())
            ) {
              throw new OneKeyLocalError('Legacy approval changed');
            }
          }
        : undefined;
      const buildStakeConfirmPayload = async ({
        confirmStakeType = stakeType,
        confirmInputTokenAddress = inputTokenAddress,
        confirmStakingInfo = stakingInfo,
      }: {
        confirmStakeType?: IEarnStakeType;
        confirmInputTokenAddress?: string;
        confirmStakingInfo?: IStakingInfo;
      } = {}): Promise<IStakeConfirmPayload> => {
        const stakeTx =
          await backgroundApiProxy.serviceStaking.buildStakeTransaction({
            amount,
            networkId,
            accountId,
            expectedAccountAddress,
            symbol,
            term,
            provider,
            feeRate,
            protocolVault,
            approveType,
            permitSignature,
            unsignedMessage,
            message,
            inputTokenAddress: confirmInputTokenAddress,
            outputTokenAddress,
            slippage,
            effectiveApy,
            stakeType: confirmStakeType,
            // Stakefish specific param
            validatorPublicKey,
            ...utm,
          });

        if (!stakeTx.tx) {
          if (!stakeTx.orderId) {
            throw new OneKeyLocalError(
              'Stake response has neither a transaction nor an orderId',
            );
          }
          return { serverOrderId: stakeTx.orderId };
        }

        const encodedTx =
          await backgroundApiProxy.serviceStaking.buildInternalDappTx({
            networkId,
            accountId,
            tx: stakeTx.tx,
            internalDappType: EInternalDappEnum.Staking,
            stakingAction: EInternalStakingAction.Stake,
          });

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
          stakingInfo: confirmStakingInfo,
          orderId: stakeTx.orderId,
        });

        return {
          encodedTx,
          stakeInfoWithOrderId,
          useFeeInTx,
          feeInfoEditable,
        };
      };

      if (stakeType === 'wrap') {
        if (!postWrapStakeToken?.address || !postWrapApproveSpenderAddress) {
          throw new OneKeyLocalError(
            'Native wrap staking requires wrapped token approval config',
          );
        }

        const isEtherFi = earnUtils.isEtherFiProvider({
          providerName: provider,
        });
        const recoverable =
          isEtherFi &&
          Boolean(actionSignal && expectedAccountAddress && protocolVault);
        if (etherFiNativeRecovery && !recoverable)
          throw new OneKeyLocalError('EtherFi recovery context unavailable');
        let recoveryId: symbol | undefined = etherFiNativeRecovery?.id;
        let recoveryOwner: symbol | undefined = etherFiNativeRecovery?.owner;
        const wrapAttempt: { value?: symbol; uuid?: string } = {};
        const approvalAttempt: { value?: symbol; uuid?: string } = {};
        const depositAttempt: { value?: symbol; uuid?: string } = {};
        let handedOff = false;
        let preserveRecoveryOwner = false;
        const detachRecovery = () => {
          if (recoveryId && recoveryOwner)
            etherFiDepositRecovery.detach(recoveryId, recoveryOwner);
        };
        actionSignal?.addEventListener('abort', detachRecovery, { once: true });
        const startRecoveryAttempt = (
          attempt: { value?: symbol; uuid?: string },
          phase: 'wrap' | 'approve' | 'deposit',
          uuid: string,
        ) => {
          if (!recoverable || !expectedAccountAddress || !protocolVault) return;
          if (attempt.value) {
            const record = recoveryId
              ? etherFiDepositRecovery.get(recoveryId)
              : undefined;
            if (
              attempt.uuid === uuid &&
              record?.attemptId === attempt.value &&
              record.owner === recoveryOwner &&
              !record.detached &&
              record.phase === phase &&
              record.status === 'unknown'
            )
              return;
            throw new OneKeyLocalError(
              'EtherFi recovery step is already pending',
            );
          }
          recoveryId ??= etherFiDepositRecovery.begin(
            {
              accountId,
              accountAddress: expectedAccountAddress,
              networkId,
              vault: protocolVault,
            },
            amount,
            'wrap',
          );
          recoveryOwner ??= recoveryId;
          const nextAttempt = etherFiDepositRecovery.markSending(
            recoveryId,
            recoveryOwner,
            phase,
          );
          if (!nextAttempt)
            throw new OneKeyLocalError(
              'EtherFi recovery step is already pending',
            );
          attempt.value = nextAttempt;
          attempt.uuid = uuid;
        };
        const recordRecoveryTransaction = (
          attempt: { value?: symbol },
          data: ISendTxOnSuccessData[],
        ) => {
          if (!recoveryId || !attempt.value) return;
          const txid = data[0]?.signedTx?.txid || data[0]?.decodedTx?.txid;
          if (txid)
            etherFiDepositRecovery.recordTxid(recoveryId, attempt.value, txid);
        };
        const recordLateRecoveryTransaction = (
          attempt: { value?: symbol },
          fact: IBroadcastAcceptedFact,
        ) => {
          if (!recoveryId || !attempt.value) return;
          if (
            etherFiDepositRecovery.recordTxid(
              recoveryId,
              attempt.value,
              fact.txid,
            )
          )
            void refreshEtherFiNativeDepositRecovery(recoveryId).catch(
              () => undefined,
            );
        };
        const prepareRecoveryPhase = (phase: 'approve' | 'deposit') => {
          if (!recoveryId || !recoveryOwner) return true;
          const record = etherFiDepositRecovery.get(recoveryId);
          if (!record || record.owner !== recoveryOwner || record.detached)
            return false;
          if (record.phase === phase && record.status === 'preparing')
            return true;
          if (
            record.status === 'preparing' &&
            record.completedPhases.includes('wrap')
          ) {
            return etherFiDepositRecovery.replanUnsent(
              recoveryId,
              recoveryOwner,
              phase,
            );
          }
          return etherFiDepositRecovery.advance(
            recoveryId,
            recoveryOwner,
            phase,
          );
        };
        try {
          if (etherFiNativeRecovery) {
            const record = etherFiDepositRecovery.get(etherFiNativeRecovery.id);
            if (
              !record ||
              record.detached ||
              record.owner !== etherFiNativeRecovery.owner ||
              record.scope.accountId !== accountId ||
              record.scope.networkId !== networkId ||
              record.scope.accountAddress.toLowerCase() !==
                expectedAccountAddress?.toLowerCase() ||
              record.scope.vault.toLowerCase() !==
                protocolVault?.toLowerCase() ||
              !new BigNumber(record.amount).eq(amount) ||
              !record.completedPhases.includes('wrap') ||
              postWrapStakeToken.address.toLowerCase() !==
                EthereumWETH.toLowerCase() ||
              postWrapApproveSpenderAddress.toLowerCase() !==
                EtherFiLiquidReferContract.toLowerCase()
            )
              throw new OneKeyLocalError('EtherFi recovery intent changed');
          } else {
            const wrapConfirmPayload = await buildStakeConfirmPayload({
              confirmStakeType: 'wrap',
              confirmStakingInfo: undefined,
            });
            if (actionSignal?.aborted) return false;
            if (wrapConfirmPayload.serverOrderId) {
              throw new OneKeyLocalError(
                'Native wrap staking cannot be executed by the protocol',
              );
            }

            let wrapConfirmResult: ITxConfirmResult;
            try {
              wrapConfirmResult = await waitForTxConfirmResult({
                encodedTx: wrapConfirmPayload.encodedTx,
                stakingInfo: wrapConfirmPayload.stakeInfoWithOrderId,
                useFeeInTx: wrapConfirmPayload.useFeeInTx,
                feeInfoEditable: wrapConfirmPayload.feeInfoEditable,
                signal: actionSignal,
                verifyAccount,
                onAttemptStarted: (uuid) =>
                  startRecoveryAttempt(wrapAttempt, 'wrap', uuid),
                onTransactionSuccess: (data) =>
                  recordRecoveryTransaction(wrapAttempt, data),
                onLateBroadcastAccepted: recoverable
                  ? (fact) => recordLateRecoveryTransaction(wrapAttempt, fact)
                  : undefined,
              });
            } catch (error) {
              onFail?.(error as Error);
              return false;
            }

            if (wrapConfirmResult.status !== 'success') {
              return false;
            }
            if (actionSignal?.aborted) return false;

            await handleStakeSuccess({
              data: wrapConfirmResult.data,
              stakeInfo: wrapConfirmPayload.stakeInfoWithOrderId,
              networkId,
            });

            const wrapTxId =
              wrapConfirmResult.data[0]?.signedTx?.txid ||
              wrapConfirmResult.data[0]?.decodedTx?.txid;
            if (!wrapTxId) {
              Toast.error({
                title: intl.formatMessage({
                  id: ETranslations.global_failed,
                }),
              });
              return false;
            }

            const wrapStatus = await waitForTxFinalStatus({
              accountId,
              networkId,
              txid: wrapTxId,
              signal: actionSignal,
            });
            if (actionSignal?.aborted) return false;
            const verifiedWrapStatus = recoveryId
              ? await refreshEtherFiNativeDepositRecovery(recoveryId).catch(
                  () => 'pending' as const,
                )
              : undefined;
            if (
              (recoveryId && verifiedWrapStatus !== 'success') ||
              (!recoveryId && wrapStatus !== EOnChainHistoryTxStatus.Success)
            ) {
              Toast.error({
                title: intl.formatMessage({
                  id:
                    recoveryId && verifiedWrapStatus !== 'failed'
                      ? ETranslations.global_pending
                      : ETranslations.global_failed,
                }),
              });
              return false;
            }
          }

          if (recoveryId && expectedAccountAddress && protocolVault) {
            await getEtherFiNativeRecoveryBalance({
              scope: {
                accountId,
                accountAddress: expectedAccountAddress,
                networkId,
                vault: protocolVault,
              },
              amount,
              isCurrent: () => Boolean(actionSignal && !actionSignal.aborted),
            });
          }

          const postWrapStakingInfo = stakingInfo
            ? {
                ...stakingInfo,
                send: stakingInfo.send
                  ? {
                      ...stakingInfo.send,
                      token: postWrapStakeToken,
                    }
                  : undefined,
              }
            : undefined;

          const amountBN = new BigNumber(amount);
          const fetchPostWrapAllowance = async () => {
            const allowanceInfo =
              await backgroundApiProxy.serviceStaking.fetchTokenAllowance({
                accountId,
                networkId,
                expectedAccountAddress: earnUtils.isEtherFiProvider({
                  providerName: provider,
                })
                  ? expectedAccountAddress
                  : undefined,
                spenderAddress: postWrapApproveSpenderAddress,
                tokenAddress: postWrapStakeToken.address,
              });
            return new BigNumber(allowanceInfo.allowanceParsed || '0');
          };
          const waitForPostWrapAllowance = async ({
            maxAttempts = 15,
            intervalMs = 2000,
          }: {
            maxAttempts?: number;
            intervalMs?: number;
          } = {}) => {
            if (amountBN.isNaN() || amountBN.lte(0)) {
              return true;
            }

            for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
              try {
                const latestAllowanceBN = await fetchPostWrapAllowance();
                if (
                  !latestAllowanceBN.isNaN() &&
                  latestAllowanceBN.gte(amountBN)
                ) {
                  return true;
                }
              } catch {
                // Keep polling; a transient allowance read should not abort the
                // post-approve stake step.
              }

              if (attempt < maxAttempts - 1) {
                await timerUtils.wait(intervalMs);
              }
            }

            return false;
          };

          const allowanceBN = await fetchPostWrapAllowance();
          if (actionSignal?.aborted) return false;
          const shouldApprovePostWrapStake =
            !amountBN.isNaN() &&
            !allowanceBN.isNaN() &&
            allowanceBN.lt(amountBN);
          onStepChange?.(2, {
            shouldShowPostWrapApproveStep: shouldApprovePostWrapStake,
          });

          await timerUtils.wait(150);

          if (shouldApprovePostWrapStake) {
            const account = await backgroundApiProxy.serviceAccount.getAccount({
              accountId,
              networkId,
            });
            if (actionSignal?.aborted) return false;
            if (!prepareRecoveryPhase('approve')) return false;

            let approveConfirmResult: ITxConfirmResult;
            try {
              approveConfirmResult = await waitForTxConfirmResult({
                approvesInfo: [
                  {
                    owner: account.address,
                    spender: postWrapApproveSpenderAddress,
                    amount,
                    tokenInfo: postWrapStakeToken,
                  },
                ],
                signal: actionSignal,
                verifyAccount,
                onAttemptStarted: (uuid) =>
                  startRecoveryAttempt(approvalAttempt, 'approve', uuid),
                onTransactionSuccess: (data) =>
                  recordRecoveryTransaction(approvalAttempt, data),
                onLateBroadcastAccepted: recoverable
                  ? (fact) =>
                      recordLateRecoveryTransaction(approvalAttempt, fact)
                  : undefined,
              });
            } catch (error) {
              onFail?.(error as Error);
              return false;
            }

            if (approveConfirmResult.status !== 'success') {
              return false;
            }

            if (recoveryId) {
              const approvalTxId =
                approveConfirmResult.data[0]?.signedTx?.txid ||
                approveConfirmResult.data[0]?.decodedTx?.txid;
              if (!approvalTxId) return false;
              await waitForTxFinalStatus({
                accountId,
                networkId,
                txid: approvalTxId,
                signal: actionSignal,
              });
              if (actionSignal?.aborted) return false;
              const verifiedApproval =
                await refreshEtherFiNativeDepositRecovery(recoveryId).catch(
                  () => 'pending' as const,
                );
              if (verifiedApproval !== 'success') return false;
            }

            await timerUtils.wait(150);

            const allowanceReady = await waitForPostWrapAllowance();
            if (actionSignal?.aborted) return false;
            if (!allowanceReady) {
              Toast.error({
                title: intl.formatMessage({
                  id: ETranslations.global_failed,
                }),
              });
              return false;
            }

            onStepChange?.(3);
          }

          if (!prepareRecoveryPhase('deposit')) return false;

          if (recoverable) {
            const confirmed =
              await beforeEtherFiPostWrapDeposit?.(actionSignal);
            if (!confirmed || actionSignal?.aborted) {
              preserveRecoveryOwner = Boolean(
                etherFiNativeRecovery && !actionSignal?.aborted,
              );
              return false;
            }
          }

          const normalConfirmPayload = await buildStakeConfirmPayload({
            confirmStakeType: 'normal',
            confirmInputTokenAddress: postWrapStakeToken.address,
            confirmStakingInfo: postWrapStakingInfo,
          });
          if (actionSignal?.aborted) return false;
          if (normalConfirmPayload.serverOrderId) {
            return handleServerExecutedOrder({
              orderId: normalConfirmPayload.serverOrderId,
              networkId,
              accountId,
              intl,
              onSuccess,
              onFail,
            });
          }

          await navigationToTxConfirm({
            encodedTx: normalConfirmPayload.encodedTx,
            stakingInfo: normalConfirmPayload.stakeInfoWithOrderId,
            onSuccess: async (data) => {
              recordRecoveryTransaction(depositAttempt, data);
              if (recoveryId)
                void refreshEtherFiNativeDepositRecovery(recoveryId).catch(
                  () => undefined,
                );
              detachRecovery();
              if (!actionSignal?.aborted) onTransactionSubmitted?.();
              await handleStakeSuccess({
                data,
                stakeInfo: normalConfirmPayload.stakeInfoWithOrderId,
                networkId,
                etherFiOrder: isEtherFi
                  ? { signal: actionSignal, intl, accountId }
                  : undefined,
                onSuccess: actionSignal
                  ? (result) => {
                      if (!actionSignal.aborted) onSuccess?.(result);
                    }
                  : onSuccess,
              });
            },
            onFail: (error) => {
              detachRecovery();
              onFail?.(error);
            },
            onCancel: detachRecovery,
            onNavigationSkipped: detachRecovery,
            onLateBroadcastAccepted: isEtherFi
              ? async (fact) => {
                  recordLateRecoveryTransaction(depositAttempt, fact);
                  await recordLateEtherFiOrder({
                    fact,
                    accountId,
                    networkId,
                    stakeInfo: normalConfirmPayload.stakeInfoWithOrderId,
                    signal: actionSignal,
                    intl,
                  });
                }
              : undefined,
            useFeeInTx: normalConfirmPayload.useFeeInTx,
            feeInfoEditable: normalConfirmPayload.feeInfoEditable,
            isNavigationCurrent: actionSignal
              ? () => !actionSignal.aborted
              : undefined,
            onBeforeSend: actionSignal
              ? async () => {
                  if (actionSignal.aborted)
                    throw new OneKeyLocalError('Stake context expired');
                  await verifyAccount?.();
                  if (actionSignal.aborted)
                    throw new OneKeyLocalError('Stake context expired');
                }
              : undefined,
            onBroadcastStart: actionSignal
              ? (uuid) => {
                  if (actionSignal.aborted)
                    throw new OneKeyLocalError('Stake context expired');
                  startRecoveryAttempt(depositAttempt, 'deposit', uuid);
                }
              : undefined,
          });
          handedOff = true;
          return true;
        } finally {
          if (!handedOff && !preserveRecoveryOwner) detachRecovery();
        }
      }

      const stakeConfirmPayload = await buildStakeConfirmPayload();
      if (actionSignal?.aborted) return false;
      if (stakeConfirmPayload.serverOrderId) {
        return handleServerExecutedOrder({
          orderId: stakeConfirmPayload.serverOrderId,
          networkId,
          accountId,
          intl,
          onSuccess,
          onFail,
        });
      }

      await navigationToTxConfirm({
        encodedTx: stakeConfirmPayload.encodedTx,
        stakingInfo: stakeConfirmPayload.stakeInfoWithOrderId,
        onSuccess: async (data) => {
          if (!actionSignal?.aborted) onTransactionSubmitted?.();
          await handleStakeSuccess({
            data,
            stakeInfo: stakeConfirmPayload.stakeInfoWithOrderId,
            networkId,
            etherFiOrder: earnUtils.isEtherFiProvider({
              providerName: provider,
            })
              ? { signal: actionSignal, intl, accountId }
              : undefined,
            onSuccess: actionSignal
              ? (result) => {
                  if (!actionSignal.aborted) onSuccess?.(result);
                }
              : onSuccess,
          });
        },
        onFail,
        onLateBroadcastAccepted: earnUtils.isEtherFiProvider({
          providerName: provider,
        })
          ? (fact) =>
              recordLateEtherFiOrder({
                fact,
                accountId,
                networkId,
                stakeInfo: stakeConfirmPayload.stakeInfoWithOrderId,
                signal: actionSignal,
                intl,
              })
          : undefined,
        useFeeInTx: stakeConfirmPayload.useFeeInTx,
        feeInfoEditable: stakeConfirmPayload.feeInfoEditable,
        isNavigationCurrent: actionSignal
          ? () => !actionSignal.aborted
          : undefined,
        onBeforeSend: actionSignal
          ? async () => {
              if (actionSignal.aborted)
                throw new OneKeyLocalError('Stake context expired');
              await verifyAccount?.();
              if (actionSignal.aborted)
                throw new OneKeyLocalError('Stake context expired');
            }
          : undefined,
      });

      return true;
    },
    [accountId, intl, networkId, navigationToTxConfirm, waitForTxConfirmResult],
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
  const { navigationToTxConfirm } = useSignatureConfirm({
    accountId,
    networkId,
  });
  const waitForTxConfirmResult = useCallback(
    async ({
      encodedTx,
      stakingInfo,
      signOnly,
      useFeeInTx,
      feeInfoEditable,
    }: {
      encodedTx?: IEncodedTx;
      stakingInfo?: IStakingInfo;
      signOnly?: boolean;
      useFeeInTx?: boolean;
      feeInfoEditable?: boolean;
    }): Promise<ITxConfirmResult> =>
      new Promise((resolve, reject) => {
        let settled = false;

        const resolveOnce = (result: ITxConfirmResult) => {
          if (settled) {
            return;
          }
          settled = true;
          resolve(result);
        };

        const rejectOnce = (error: unknown) => {
          if (settled) {
            return;
          }
          settled = true;
          reject(error);
        };

        void navigationToTxConfirm({
          encodedTx,
          stakingInfo,
          signOnly,
          useFeeInTx,
          feeInfoEditable,
          onSuccess: (data) => resolveOnce({ status: 'success', data }),
          onFail: (error) => rejectOnce(error),
          onCancel: () => resolveOnce({ status: 'cancel' }),
        }).catch((error) => rejectOnce(error));
      }),
    [navigationToTxConfirm],
  );
  const ensureRiskAccepted = useEarnRiskWarningGate();

  return useCallback(
    async ({
      amount,
      symbol,
      provider,
      identity,
      expectedAccountAddress,
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
      useEthenaCooldown,
      resumeEthenaCooldownUnstake,
      onStepChange,
      onEthenaCooldownUnstakeReady,
      signal,
      verifyEtherFiLegacyApproval,
      utm,
    }: {
      amount: string;
      symbol: string;
      provider: string;
      identity?: string;
      expectedAccountAddress?: string;
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
      useEthenaCooldown?: boolean;
      resumeEthenaCooldownUnstake?: boolean;
      onStepChange?: (step: number) => void;
      onEthenaCooldownUnstakeReady?: () => void;
      signal?: AbortSignal;
      verifyEtherFiLegacyApproval?: () => Promise<boolean>;
      // Campaign attribution, forwarded to the server unchanged
      utm?: IEarnUtmParams;
    }) => {
      const isEtherFi = earnUtils.isEtherFiProvider({ providerName: provider });
      if (
        isEtherFi &&
        (!expectedAccountAddress ||
          !protocolVault ||
          (withdrawType === 'cancel' && !identity))
      ) {
        throw new OneKeyLocalError('EtherFi withdrawal identity is missing');
      }
      if (isEtherFi && signal?.aborted) return false;
      // OK-59196: one-time DeFi risk disclaimer, same gate the earn stake flow
      // uses. Returning false lets the caller tell a rejection apart from a
      // completed hand-off and leave the form untouched.
      if (!(await ensureRiskAccepted({ provider, symbol, networkId }))) {
        return false;
      }

      let stakeTx: IStakeTxResponse | undefined;
      const stakingConfig =
        await backgroundApiProxy.serviceStaking.getStakingConfigs({
          networkId,
          symbol,
          provider,
        });
      if (!stakingConfig) {
        throw new OneKeyLocalError('Staking config not found');
      }

      if (stakingConfig?.unstakeWithSignMessage) {
        const account = await backgroundApiProxy.serviceAccount.getAccount({
          accountId,
          networkId,
        });
        const { message, deadline } =
          await backgroundApiProxy.serviceStaking.buildLidoEthPermitMessageData(
            {
              accountId,
              networkId,
              amount,
            },
          );

        const signHash =
          (await backgroundApiProxy.serviceDApp.openSignMessageModal({
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

        stakeTx =
          await backgroundApiProxy.serviceStaking.buildUnstakeTransaction({
            amount,
            networkId,
            accountId,
            symbol,
            provider,
            inputTokenAddress,
            outputTokenAddress,
            effectiveApy,
            ...utm,
            withdrawType,
            signature: signHash,
            deadline,
          });
      } else if (useEthenaCooldown) {
        const openEthenaCooldownUnstakeConfirm = async () => {
          const unstakeTx =
            await backgroundApiProxy.serviceStaking.buildUnstakeTransaction({
              amount,
              identity,
              networkId,
              accountId,
              symbol,
              provider,
              inputTokenAddress,
              outputTokenAddress,
              protocolVault,
              withdrawAll,
              useEthenaCooldown: true,
              slippage,
              effectiveApy,
              ...utm,
              withdrawType,
            });
          const unstakeEncodedTx =
            await backgroundApiProxy.serviceStaking.buildInternalDappTx({
              networkId,
              accountId,
              tx: unstakeTx.tx,
              internalDappType: EInternalDappEnum.Staking,
              stakingAction: EInternalStakingAction.Withdraw,
            });
          const unstakeStakeInfo = createStakeInfoWithOrderId({
            stakingInfo,
            orderId: unstakeTx.orderId,
          });

          let unstakeConfirmResult;
          try {
            unstakeConfirmResult = await waitForTxConfirmResult({
              encodedTx: unstakeEncodedTx,
              stakingInfo: unstakeStakeInfo,
            });
          } catch (error) {
            onFail?.(error as Error);
            return false;
          }

          if (unstakeConfirmResult.status !== 'success') {
            return false;
          }

          onStepChange?.(3);
          await handleStakeSuccess({
            data: unstakeConfirmResult.data,
            stakeInfo: unstakeStakeInfo,
            networkId,
            onSuccess,
          });
        };

        if (resumeEthenaCooldownUnstake) {
          await openEthenaCooldownUnstakeConfirm();
          return true;
        }

        // Ethena two-step: 1) swap PT-sUSDe → sUSDe, 2) unstake sUSDe → USDe
        const swapTx =
          await backgroundApiProxy.serviceStaking.buildUnstakeTransaction({
            amount,
            identity,
            networkId,
            accountId,
            symbol,
            provider,
            inputTokenAddress,
            outputTokenAddress,
            protocolVault,
            withdrawAll,
            ethenaPath: true,
            slippage,
            effectiveApy,
            ...utm,
            withdrawType,
          });
        const swapEncodedTx =
          await backgroundApiProxy.serviceStaking.buildInternalDappTx({
            networkId,
            accountId,
            tx: swapTx.tx,
            internalDappType: EInternalDappEnum.Staking,
            stakingAction: EInternalStakingAction.Withdraw,
          });
        const swapStakeInfo = createStakeInfoWithOrderId({
          stakingInfo,
          orderId: swapTx.orderId,
        });
        let swapConfirmResult;
        try {
          swapConfirmResult = await waitForTxConfirmResult({
            encodedTx: swapEncodedTx,
            stakingInfo: swapStakeInfo,
          });
        } catch (error) {
          onFail?.(error as Error);
          return false;
        }

        if (swapConfirmResult.status !== 'success') {
          return false;
        }

        await handleStakeSuccess({
          data: swapConfirmResult.data,
          stakeInfo: swapStakeInfo,
          networkId,
        });

        if (signal?.aborted) {
          return false;
        }

        onStepChange?.(2);

        const swapTxId =
          swapConfirmResult.data[0]?.signedTx?.txid ??
          swapConfirmResult.data[0]?.decodedTx?.txid;
        if (swapTxId) {
          const swapStatus = await waitForTxFinalStatus({
            accountId,
            networkId,
            txid: swapTxId,
            signal,
          });
          if (swapStatus !== EOnChainHistoryTxStatus.Success) {
            if (!signal?.aborted) {
              Toast.error({
                title: intl.formatMessage({
                  id: ETranslations.global_failed,
                }),
              });
            }
            return false;
          }
        }

        if (signal?.aborted) {
          return false;
        }

        onEthenaCooldownUnstakeReady?.();

        // Let the previous confirm modal finish closing before opening
        // the next step so each tx confirm owns the stack serially.
        await timerUtils.wait(150);

        if (signal?.aborted) {
          return false;
        }

        await openEthenaCooldownUnstakeConfirm();
        return true;
      } else {
        stakeTx =
          await backgroundApiProxy.serviceStaking.buildUnstakeTransaction({
            amount,
            identity,
            networkId,
            accountId,
            symbol,
            provider,
            inputTokenAddress,
            outputTokenAddress,
            protocolVault,
            withdrawAll: earnUtils.resolveEarnWithdrawAll({
              providerName: provider,
              withdrawAll,
            }),
            signature: withdrawSignature,
            message: withdrawMessage,
            expectedAccountAddress: isEtherFi
              ? expectedAccountAddress
              : undefined,
            slippage,
            effectiveApy,
            ...utm,
            withdrawType,
          });
      }

      if (!stakeTx.tx) {
        if (!stakeTx.orderId) {
          throw new OneKeyLocalError(
            'Unstake response has neither a transaction nor an orderId',
          );
        }
        // Unitas gold-vault redeem: submitted by the protocol after the receipt
        // approve
        return handleServerExecutedOrder({
          orderId: stakeTx.orderId,
          networkId,
          accountId,
          intl,
          onSuccess,
          onFail,
        });
      }

      // Handle Stakefish validator exit broadcast (no on-chain tx needed)
      const txAsExitBroadcast =
        stakeTx.tx as unknown as IStakeTxStakefishExitBroadcast;
      if (txAsExitBroadcast?.exitBroadcasted === true) {
        Toast.success({
          title: intl.formatMessage({
            id: ETranslations.feedback_transaction_submitted,
          }),
        });
        onSuccess?.([]);
        return true;
      }

      const encodedTx =
        await backgroundApiProxy.serviceStaking.buildInternalDappTx({
          networkId,
          accountId,
          tx: stakeTx.tx,
          internalDappType: EInternalDappEnum.Staking,
          stakingAction: EInternalStakingAction.Withdraw,
        });
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

      if (isEtherFi && signal?.aborted) return false;
      await navigationToTxConfirm({
        encodedTx,
        stakingInfo: stakeInfoWithOrderId,
        signOnly: stakingConfig?.withdrawSignOnly,
        onLateBroadcastAccepted:
          isEtherFi && !stakingConfig?.withdrawSignOnly
            ? (fact) =>
                recordLateEtherFiOrder({
                  fact,
                  accountId,
                  networkId,
                  stakeInfo: stakeInfoWithOrderId,
                  signal,
                  intl,
                })
            : undefined,
        useFeeInTx,
        feeInfoEditable,
        isNavigationCurrent:
          isEtherFi && signal ? () => !signal.aborted : undefined,
        onBeforeSend:
          isEtherFi && signal
            ? async () => {
                if (signal.aborted) {
                  throw new OneKeyLocalError('Withdrawal context expired');
                }
                const account =
                  await backgroundApiProxy.serviceAccount.getAccount({
                    accountId,
                    networkId,
                  });
                if (
                  !expectedAccountAddress ||
                  account.address.toLowerCase() !==
                    expectedAccountAddress.toLowerCase() ||
                  signal.aborted
                ) {
                  throw new OneKeyLocalError('Withdrawal account changed');
                }
                if (
                  verifyEtherFiLegacyApproval &&
                  !(await verifyEtherFiLegacyApproval())
                ) {
                  throw new OneKeyLocalError('Legacy approval changed');
                }
                if (signal.aborted)
                  throw new OneKeyLocalError('Withdrawal context expired');
              }
            : undefined,
        onSuccess: async (data) => {
          if (!stakingConfig?.withdrawSignOnly) {
            await handleStakeSuccess({
              data,
              stakeInfo: stakeInfoWithOrderId,
              networkId,
              etherFiOrder: isEtherFi ? { signal, intl, accountId } : undefined,
              onSuccess: isEtherFi
                ? (result) => {
                    if (!signal?.aborted) onSuccess?.(result);
                  }
                : onSuccess,
            });
          } else {
            const psbtHex = data[0].signedTx.finalizedPsbtHex;
            if (psbtHex && identity) {
              await backgroundApiProxy.serviceStaking.unstakePush({
                txId: identity,
                networkId,
                accountId,
                symbol,
                provider,
                unstakeTxHex: psbtHex,
              });
              onSuccess?.(data);
            }
          }
        },
        onFail,
      });

      return true;
    },
    [
      accountId,
      ensureRiskAccepted,
      networkId,
      navigationToTxConfirm,
      waitForTxConfirmResult,
      intl,
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
      claimApprove,
      claimFollowUp,
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
      vault: string;
      /** Allowance the claim needs first (Unitas USDu), from the claimable list. */
      claimApprove?: IClaimApproveInfo;
      /** Server-executed step that follows the claim, from the claimable list. */
      claimFollowUp?: IClaimFollowUpInfo;
      onSuccess?: IModalSendParamList['SendConfirm']['onSuccess'];
      onFail?: IModalSendParamList['SendConfirm']['onFail'];
      portfolioSymbol?: string;
      portfolioRewardSymbol?: string;
    }) => {
      const amountNumber = BigNumber(amount || 0);
      const normalizedAmount = amountNumber.isNaN()
        ? '0'
        : amountNumber.toFixed();
      // OK-59196: one-time DeFi risk disclaimer, same gate the earn stake flow
      // uses.
      if (!(await ensureRiskAccepted({ provider, symbol, networkId }))) {
        return false;
      }

      // OK-61790 (Unitas USDu): the claimed USDu is converted back to USDT by
      // the protocol right after the claim, which needs an allowance of the
      // claimed amount. Ask for it before the claim transaction when missing.
      if (claimApprove && amountNumber.gt(0)) {
        const readAllowance = async () => {
          const info =
            await backgroundApiProxy.serviceStaking.fetchTokenAllowance({
              networkId,
              accountId,
              tokenAddress: claimApprove.tokenAddress,
              spenderAddress: claimApprove.approveTarget,
            });
          return new BigNumber(info.allowanceParsed || '0');
        };
        let allowance = new BigNumber(0);
        try {
          allowance = await readAllowance();
        } catch {
          // Unreadable allowance: fall through to the approve so the claim is
          // never left without its conversion.
        }
        if (allowance.lt(amountNumber)) {
          const account = await backgroundApiProxy.serviceAccount.getAccount({
            accountId,
            networkId,
          });
          const tokenInfo: IToken = {
            address: claimApprove.tokenAddress,
            symbol: claimApprove.symbol,
            name: claimApprove.symbol,
            decimals: claimApprove.decimals,
            isNative: false,
            networkId,
          };
          let approveStatus: 'success' | 'cancel';
          try {
            approveStatus = await new Promise<'success' | 'cancel'>(
              (resolve, reject) => {
                void navigationToTxConfirm({
                  approvesInfo: [
                    {
                      owner: account.address,
                      spender: claimApprove.approveTarget,
                      amount: normalizedAmount,
                      tokenInfo,
                    },
                  ],
                  onSuccess: () => resolve('success'),
                  onFail: (error) => reject(error),
                  onCancel: () => resolve('cancel'),
                }).catch((error) => reject(error));
              },
            );
          } catch (error) {
            onFail?.(error as Error);
            return false;
          }
          if (approveStatus !== 'success') {
            return false;
          }
          // The approve was just broadcast; wait for the allowance to land
          // before building the claim so the server-side conversion can run.
          let allowanceReady = false;
          for (let attempt = 0; attempt < 15; attempt += 1) {
            await timerUtils.wait(2000);
            try {
              if ((await readAllowance()).gte(amountNumber)) {
                allowanceReady = true;
                break;
              }
            } catch {
              // keep polling
            }
          }
          if (!allowanceReady) {
            Toast.error({
              title: intl.formatMessage({ id: ETranslations.global_failed }),
            });
            return false;
          }
          await timerUtils.wait(150);
        }
      }

      const continueClaim = async () => {
        const claimRequest = {
          networkId,
          accountId,
          symbol,
          provider,
          amount: normalizedAmount,
          claimTokenAddress,
          claimType,
          vault,
        };
        // This claim is the conversion itself (OK-61790, Unitas: USDu already
        // in the wallet, left there by a conversion that did not finish). The
        // server runs it, so there is nothing to sign: ask for it and wait
        // under the conversion dialog, which also offers another try.
        if (claimFollowUp && claimFollowUp.identity === identity) {
          const outcome = await runClaimConversion({
            intl,
            request: { ...claimRequest, identity: claimFollowUp.identity },
            symbol,
            amount: normalizedAmount,
            withClaimStep: false,
          });
          // A failure the user gave up on leaves the amount claimable, so the
          // page stays as it is; anything else moved the position.
          if (outcome !== 'failed') {
            onSuccess?.([]);
          }
          return;
        }
        const stakeTx =
          await backgroundApiProxy.serviceStaking.buildClaimTransaction({
            ...claimRequest,
            identity,
          });
        // Any other claim the server runs itself: wait for the order under a
        // dialog, the same as a server-executed stake.
        if (!stakeTx.tx) {
          if (!stakeTx.orderId) {
            throw new OneKeyLocalError('Claim returned neither tx nor order');
          }
          await handleServerExecutedOrder({
            orderId: stakeTx.orderId,
            networkId,
            accountId,
            intl,
            onSuccess,
            onFail,
          });
          return;
        }
        // The claim is followed by a server-executed step (Unitas: the USDu it
        // pays out is converted back to USDT) unless this claim is that step.
        const followUpIdentity =
          claimFollowUp && claimFollowUp.identity !== identity
            ? claimFollowUp.identity
            : undefined;
        const encodedTx =
          await backgroundApiProxy.serviceStaking.buildInternalDappTx({
            networkId,
            accountId,
            tx: stakeTx.tx,
            internalDappType: EInternalDappEnum.Staking,
            stakingAction: EInternalStakingAction.Claim,
          });
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

        await navigationToTxConfirm({
          encodedTx,
          stakingInfo: stakeInfoWithOrderId,
          onSuccess: async (data) => {
            // Report the claim transaction first: the server only runs the
            // follow-up for a claim it knows about. The caller's onSuccess is
            // held back until the follow-up settles, so the page refreshes
            // once, onto the final state.
            await handleStakeSuccess({
              data,
              stakeInfo: stakeInfoWithOrderId,
              networkId,
              onSuccess: followUpIdentity ? undefined : onSuccess,
            });
            if (!followUpIdentity) {
              return;
            }
            // Whatever the conversion does, the claim itself went through:
            // the page refreshes once the dialog is done with.
            await runClaimConversion({
              intl,
              request: { ...claimRequest, identity: followUpIdentity },
              symbol,
              amount: normalizedAmount,
              withClaimStep: true,
            });
            onSuccess?.(data);
          },
          onFail,
          useFeeInTx,
          feeInfoEditable,
        });
      };
      if (amountNumber.gt(0)) {
        const account = await backgroundApiProxy.serviceAccount.getAccount({
          accountId,
          networkId,
        });
        const estimateFeeResp =
          await backgroundApiProxy.serviceStaking.estimateFee({
            networkId,
            provider,
            symbol,
            action: 'claim',
            amount: normalizedAmount,
            protocolVault,
            identity,
            accountAddress: account.address,
          });
        // Only check gas fee vs claim value if token price is available
        if (estimateFeeResp.token?.price) {
          const tokenFiatValueBN = BigNumber(
            estimateFeeResp.token.price,
          ).multipliedBy(normalizedAmount);
          if (tokenFiatValueBN.lt(estimateFeeResp.feeFiatValue)) {
            showClaimEstimateGasAlert({
              claimTokenFiatValue: tokenFiatValueBN.toFixed(),
              estFiatValue: estimateFeeResp.feeFiatValue,
              onConfirm: continueClaim,
            });
            // The alert owns the flow from here; it either continues or the
            // user dismisses it, so the hand-off counts as started.
            return true;
          }
        }
      }
      await continueClaim();

      return true;
    },
    [
      ensureRiskAccepted,
      navigationToTxConfirm,
      accountId,
      networkId,
      intl,
      showClaimEstimateGasAlert,
    ],
  );
}
