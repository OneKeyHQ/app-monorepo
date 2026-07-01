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
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { type IModalSendParamList } from '@onekeyhq/shared/src/routes';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';
import {
  type EApproveType,
  EInternalDappEnum,
  EInternalStakingAction,
  type IEarnClaimType,
  type IEarnPermit2ApproveSignData,
  type IEarnStakeType,
  type IEarnWithdrawType,
  type IStakeTxResponse,
  type IStakeTxStakefishExitBroadcast,
  type IStakingInfo,
} from '@onekeyhq/shared/types/staking';
import type { IToken } from '@onekeyhq/shared/types/token';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import { useShowClaimEstimateGasAlert } from '../components/EstimateNetworkFee';

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

type ITxConfirmResult =
  | {
      status: 'success';
      data: ISendTxOnSuccessData[];
    }
  | {
      status: 'cancel';
    };

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
  const orderTx = Array.isArray(data) ? data[data.length - 1] : undefined;
  if (orderTx?.signedTx?.txid && stakeInfo?.orderId) {
    await backgroundApiProxy.serviceStaking.addEarnOrder({
      orderId: stakeInfo.orderId,
      networkId,
      txId: orderTx.signedTx.txid,
      status: orderTx.decodedTx.status,
      ...getEarnOrderTrackingInfo(stakeInfo),
    });
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
    }: {
      encodedTx?: IEncodedTx;
      stakingInfo?: IStakingInfo;
      approvesInfo?: IApproveInfo[];
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
          approvesInfo,
          useFeeInTx,
          feeInfoEditable,
          onSuccess: (data) => resolveOnce({ status: 'success', data }),
          onFail: (error) => rejectOnce(error),
          onCancel: () => resolveOnce({ status: 'cancel' }),
        }).catch((error) => rejectOnce(error));
      }),
    [navigationToTxConfirm],
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
      postWrapStakeToken,
      postWrapApproveSpenderAddress,
      stakingInfo,
      onSuccess,
      onFail,
      onStepChange,
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
    }) => {
      const buildStakeConfirmPayload = async ({
        confirmStakeType = stakeType,
        confirmInputTokenAddress = inputTokenAddress,
        confirmStakingInfo = stakingInfo,
      }: {
        confirmStakeType?: IEarnStakeType;
        confirmInputTokenAddress?: string;
        confirmStakingInfo?: IStakingInfo;
      } = {}) => {
        const stakeTx =
          await backgroundApiProxy.serviceStaking.buildStakeTransaction({
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
            inputTokenAddress: confirmInputTokenAddress,
            outputTokenAddress,
            slippage,
            effectiveApy,
            stakeType: confirmStakeType,
            // Stakefish specific param
            validatorPublicKey,
          });

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

        const wrapConfirmPayload = await buildStakeConfirmPayload({
          confirmStakeType: 'wrap',
          confirmStakingInfo: undefined,
        });

        let wrapConfirmResult: ITxConfirmResult;
        try {
          wrapConfirmResult = await waitForTxConfirmResult({
            encodedTx: wrapConfirmPayload.encodedTx,
            stakingInfo: wrapConfirmPayload.stakeInfoWithOrderId,
            useFeeInTx: wrapConfirmPayload.useFeeInTx,
            feeInfoEditable: wrapConfirmPayload.feeInfoEditable,
          });
        } catch (error) {
          onFail?.(error as Error);
          return;
        }

        if (wrapConfirmResult.status !== 'success') {
          return;
        }

        await handleStakeSuccess({
          data: wrapConfirmResult.data,
          stakeInfo: wrapConfirmPayload.stakeInfoWithOrderId,
          networkId,
        });

        const wrapTxId =
          wrapConfirmResult.data[0]?.signedTx?.txid ??
          wrapConfirmResult.data[0]?.decodedTx?.txid;
        if (!wrapTxId) {
          Toast.error({
            title: intl.formatMessage({
              id: ETranslations.global_failed,
            }),
          });
          return;
        }

        const wrapStatus = await waitForTxFinalStatus({
          accountId,
          networkId,
          txid: wrapTxId,
        });
        if (wrapStatus !== EOnChainHistoryTxStatus.Success) {
          Toast.error({
            title: intl.formatMessage({
              id: ETranslations.global_failed,
            }),
          });
          return;
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
        const shouldApprovePostWrapStake =
          !amountBN.isNaN() && !allowanceBN.isNaN() && allowanceBN.lt(amountBN);
        onStepChange?.(2, {
          shouldShowPostWrapApproveStep: shouldApprovePostWrapStake,
        });

        await timerUtils.wait(150);

        if (shouldApprovePostWrapStake) {
          const account = await backgroundApiProxy.serviceAccount.getAccount({
            accountId,
            networkId,
          });

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
            });
          } catch (error) {
            onFail?.(error as Error);
            return;
          }

          if (approveConfirmResult.status !== 'success') {
            return;
          }

          await timerUtils.wait(150);

          const allowanceReady = await waitForPostWrapAllowance();
          if (!allowanceReady) {
            Toast.error({
              title: intl.formatMessage({
                id: ETranslations.global_failed,
              }),
            });
            return;
          }

          onStepChange?.(3);
        }

        const normalConfirmPayload = await buildStakeConfirmPayload({
          confirmStakeType: 'normal',
          confirmInputTokenAddress: postWrapStakeToken.address,
          confirmStakingInfo: postWrapStakingInfo,
        });

        await navigationToTxConfirm({
          encodedTx: normalConfirmPayload.encodedTx,
          stakingInfo: normalConfirmPayload.stakeInfoWithOrderId,
          onSuccess: async (data) => {
            await handleStakeSuccess({
              data,
              stakeInfo: normalConfirmPayload.stakeInfoWithOrderId,
              networkId,
              onSuccess,
            });
          },
          onFail,
          useFeeInTx: normalConfirmPayload.useFeeInTx,
          feeInfoEditable: normalConfirmPayload.feeInfoEditable,
        });
        return;
      }

      const stakeConfirmPayload = await buildStakeConfirmPayload();

      await navigationToTxConfirm({
        encodedTx: stakeConfirmPayload.encodedTx,
        stakingInfo: stakeConfirmPayload.stakeInfoWithOrderId,
        onSuccess: async (data) => {
          await handleStakeSuccess({
            data,
            stakeInfo: stakeConfirmPayload.stakeInfoWithOrderId,
            networkId,
            onSuccess,
          });
        },
        onFail,
        useFeeInTx: stakeConfirmPayload.useFeeInTx,
        feeInfoEditable: stakeConfirmPayload.feeInfoEditable,
      });
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
      useEthenaCooldown,
      resumeEthenaCooldownUnstake,
      onStepChange,
      onEthenaCooldownUnstakeReady,
      signal,
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
      useEthenaCooldown?: boolean;
      resumeEthenaCooldownUnstake?: boolean;
      onStepChange?: (step: number) => void;
      onEthenaCooldownUnstakeReady?: () => void;
      signal?: AbortSignal;
    }) => {
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
            return;
          }

          if (unstakeConfirmResult.status !== 'success') {
            return;
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
          return;
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
          return;
        }

        if (swapConfirmResult.status !== 'success') {
          return;
        }

        await handleStakeSuccess({
          data: swapConfirmResult.data,
          stakeInfo: swapStakeInfo,
          networkId,
        });

        if (signal?.aborted) {
          return;
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
            return;
          }
        }

        if (signal?.aborted) {
          return;
        }

        onEthenaCooldownUnstakeReady?.();

        // Let the previous confirm modal finish closing before opening
        // the next step so each tx confirm owns the stack serially.
        await timerUtils.wait(150);

        if (signal?.aborted) {
          return;
        }

        await openEthenaCooldownUnstakeConfirm();
        return;
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
            withdrawAll,
            signature: withdrawSignature,
            message: withdrawMessage,
            slippage,
            effectiveApy,
            withdrawType,
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
        return;
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

      await navigationToTxConfirm({
        encodedTx,
        stakingInfo: stakeInfoWithOrderId,
        signOnly: stakingConfig?.withdrawSignOnly,
        useFeeInTx,
        feeInfoEditable,
        onSuccess: async (data) => {
          if (!stakingConfig?.withdrawSignOnly) {
            await handleStakeSuccess({
              data,
              stakeInfo: stakeInfoWithOrderId,
              networkId,
              onSuccess,
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
    },
    [accountId, networkId, navigationToTxConfirm, waitForTxConfirmResult, intl],
  );
}

export function useUniversalClaim({
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
  const showClaimEstimateGasAlert = useShowClaimEstimateGasAlert();
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
      onSuccess?: IModalSendParamList['SendConfirm']['onSuccess'];
      onFail?: IModalSendParamList['SendConfirm']['onFail'];
      portfolioSymbol?: string;
      portfolioRewardSymbol?: string;
    }) => {
      const amountNumber = BigNumber(amount || 0);
      const normalizedAmount = amountNumber.isNaN()
        ? '0'
        : amountNumber.toFixed();
      const continueClaim = async () => {
        const stakeTx =
          await backgroundApiProxy.serviceStaking.buildClaimTransaction({
            networkId,
            accountId,
            symbol,
            provider,
            amount: normalizedAmount,
            identity,
            claimTokenAddress,
            claimType,
            vault,
          });
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
            await handleStakeSuccess({
              data,
              stakeInfo: stakeInfoWithOrderId,
              networkId,
              onSuccess,
            });
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
            return;
          }
        }
      }
      await continueClaim();
    },
    [navigationToTxConfirm, accountId, networkId, showClaimEstimateGasAlert],
  );
}
