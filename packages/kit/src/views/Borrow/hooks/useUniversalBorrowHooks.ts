import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import type { IEncodedTx } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IModalSendParamList } from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IRepayWithCollateralQuote,
  IStakingInfo,
} from '@onekeyhq/shared/types/staking';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

import {
  getBorrowLutFinalizationErrorTranslation,
  mapBorrowLutFinalizationToTxStatus,
} from './borrowLutFinalization';

function parseBorrowEncodedTx(tx: string): IEncodedTx {
  try {
    const parsed = JSON.parse(tx) as unknown;
    if (parsed && typeof parsed === 'object') {
      return parsed as IEncodedTx;
    }
  } catch {
    // Ignore parsing errors and fallback to raw string
  }
  return tx;
}

const attachBorrowOrderId = ({
  stakingInfo,
  orderId,
}: {
  stakingInfo?: IStakingInfo;
  orderId?: string;
}): IStakingInfo | undefined =>
  stakingInfo ? { ...stakingInfo, orderId } : undefined;

const attachRepayWithCollateralAmount = ({
  stakingInfo,
  amount,
}: {
  stakingInfo?: IStakingInfo;
  amount?: string;
}): IStakingInfo | undefined => {
  if (!stakingInfo?.send || !amount) {
    return stakingInfo;
  }

  return {
    ...stakingInfo,
    send: {
      ...stakingInfo.send,
      amount,
    },
  };
};

const buildBorrowTrackingStakingInfo = ({
  stakingInfo,
  orderId,
}: {
  stakingInfo?: IStakingInfo;
  orderId?: string;
}): IStakingInfo | undefined => {
  if (!stakingInfo?.tags?.length) {
    return undefined;
  }

  return attachBorrowOrderId({
    stakingInfo: {
      ...stakingInfo,
      send: undefined,
      receive: undefined,
    },
    orderId,
  });
};

type ITxConfirmResult =
  | {
      status: 'success';
      data: ISendTxOnSuccessData[];
    }
  | {
      status: 'cancel';
    };

// React Navigation modal transitions take about 300ms on mobile. Waiting for
// that animation to settle avoids racing the second repay confirm with the
// closing setup modal.
const SIGNATURE_MODAL_SETTLE_WAIT_MS = 300;

const getLatestTxId = (data: ISendTxOnSuccessData[]) => {
  for (let index = data.length - 1; index >= 0; index -= 1) {
    const item = data[index];
    const txId = item?.signedTx?.txid || item?.decodedTx?.txid;
    if (txId) {
      return txId;
    }
  }

  return undefined;
};

const syncBorrowOrder = async ({
  orderId,
  networkId,
  txId,
  status,
}: {
  orderId?: string;
  networkId: string;
  txId?: string;
  status: EDecodedTxStatus;
}) => {
  if (!orderId || !txId) {
    return;
  }

  await backgroundApiProxy.serviceStaking.addEarnOrder({
    orderId,
    networkId,
    txId,
    status,
  });
};

const handleBorrowSuccess = async ({
  data,
  orderId,
  networkId,
  onSuccess,
}: {
  data: ISendTxOnSuccessData[];
  orderId?: string;
  networkId: string;
  onSuccess?: IModalSendParamList['SendConfirm']['onSuccess'];
}) => {
  const latestTxId =
    Array.isArray(data) && data.length > 0 ? getLatestTxId(data) : undefined;

  if (orderId && latestTxId) {
    await backgroundApiProxy.serviceStaking.addEarnOrder({
      orderId,
      networkId,
      txId: latestTxId,
      status: data[data.length - 1]?.decodedTx.status,
    });
  }
  onSuccess?.(data);
};

// Buffer after RPC finalization to allow all RPC nodes to sync the LUT state
const LUT_PROPAGATION_BUFFER_MS = 5000;

type IBorrowBuildTxParams = {
  amount: string;
  provider: string;
  marketAddress: string;
  reserveAddress: string;
  collateralReserveAddress?: string;
  withdrawAll?: boolean;
  repayAll?: boolean;
  needsSetupLut?: boolean;
  slippageBps?: number;
  routeKey?: string;
  stakingInfo?: IStakingInfo;
  onSetupLutReadyForRepay?: () => void;
  onSuccess?: IModalSendParamList['SendConfirm']['onSuccess'];
  onFail?: IModalSendParamList['SendConfirm']['onFail'];
};

export function useUniversalBorrowSupply({
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

  return useCallback(
    async ({
      amount,
      provider,
      marketAddress,
      reserveAddress,
      stakingInfo,
      onSuccess,
      onFail,
    }: IBorrowBuildTxParams) => {
      const resp =
        await backgroundApiProxy.serviceStaking.borrowBuildSupplyTransaction({
          networkId,
          accountId,
          provider,
          marketAddress,
          reserveAddress,
          amount,
        });

      const stakingInfoWithOrderId = attachBorrowOrderId({
        stakingInfo,
        orderId: resp.orderId,
      });

      await navigationToTxConfirm({
        encodedTx: resp.tx,
        stakingInfo: stakingInfoWithOrderId,
        onSuccess: async (data) => {
          await handleBorrowSuccess({
            data,
            orderId: resp.orderId,
            networkId,
            onSuccess,
          });
        },
        onFail,
      });
    },
    [accountId, networkId, navigationToTxConfirm],
  );
}

export function useUniversalBorrowWithdraw({
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

  return useCallback(
    async ({
      amount,
      provider,
      marketAddress,
      reserveAddress,
      withdrawAll,
      stakingInfo,
      onSuccess,
      onFail,
    }: IBorrowBuildTxParams) => {
      const resp =
        await backgroundApiProxy.serviceStaking.borrowBuildWithdrawTransaction({
          networkId,
          accountId,
          provider,
          marketAddress,
          reserveAddress,
          amount,
          withdrawAll,
        });

      const stakingInfoWithOrderId = attachBorrowOrderId({
        stakingInfo,
        orderId: resp.orderId,
      });

      await navigationToTxConfirm({
        encodedTx: parseBorrowEncodedTx(resp.tx),
        stakingInfo: stakingInfoWithOrderId,
        onSuccess: async (data) => {
          await handleBorrowSuccess({
            data,
            orderId: resp.orderId,
            networkId,
            onSuccess,
          });
        },
        onFail,
      });
    },
    [accountId, networkId, navigationToTxConfirm],
  );
}

export function useUniversalBorrowBorrow({
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

  return useCallback(
    async ({
      amount,
      provider,
      marketAddress,
      reserveAddress,
      stakingInfo,
      onSuccess,
      onFail,
    }: IBorrowBuildTxParams) => {
      const resp =
        await backgroundApiProxy.serviceStaking.borrowBuildBorrowTransaction({
          networkId,
          accountId,
          provider,
          marketAddress,
          reserveAddress,
          amount,
        });

      const stakingInfoWithOrderId = attachBorrowOrderId({
        stakingInfo,
        orderId: resp.orderId,
      });

      await navigationToTxConfirm({
        encodedTx: parseBorrowEncodedTx(resp.tx),
        stakingInfo: stakingInfoWithOrderId,
        onSuccess: async (data) => {
          await handleBorrowSuccess({
            data,
            orderId: resp.orderId,
            networkId,
            onSuccess,
          });
        },
        onFail,
      });
    },
    [accountId, networkId, navigationToTxConfirm],
  );
}

export function useUniversalBorrowRepay({
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

  return useCallback(
    async ({
      amount,
      provider,
      marketAddress,
      reserveAddress,
      repayAll,
      stakingInfo,
      onSuccess,
      onFail,
    }: IBorrowBuildTxParams) => {
      const resp =
        await backgroundApiProxy.serviceStaking.borrowBuildRepayTransaction({
          networkId,
          accountId,
          provider,
          marketAddress,
          reserveAddress,
          amount,
          repayAll,
        });

      const stakingInfoWithOrderId = attachBorrowOrderId({
        stakingInfo,
        orderId: resp.orderId,
      });

      await navigationToTxConfirm({
        encodedTx: parseBorrowEncodedTx(resp.tx),
        stakingInfo: stakingInfoWithOrderId,
        onSuccess: async (data) => {
          await handleBorrowSuccess({
            data,
            orderId: resp.orderId,
            networkId,
            onSuccess,
          });
        },
        onFail,
      });
    },
    [accountId, networkId, navigationToTxConfirm],
  );
}

export function useUniversalBorrowRepayWithCollateral({
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
    }: {
      encodedTx?: IEncodedTx;
      stakingInfo?: IStakingInfo;
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
      provider,
      marketAddress,
      reserveAddress,
      collateralReserveAddress,
      needsSetupLut,
      repayAll,
      slippageBps,
      routeKey,
      stakingInfo,
      onSetupLutReadyForRepay,
      onSuccess,
      onFail,
    }: IBorrowBuildTxParams): Promise<boolean> => {
      try {
        let setupLutFinalizationResult:
          | 'finalized'
          | 'failed'
          | 'timeout'
          | undefined;

        if (!collateralReserveAddress) {
          throw new OneKeyLocalError('collateralReserveAddress is required');
        }

        if (needsSetupLut) {
          const failedMessage = intl.formatMessage({
            id: ETranslations.global_failed,
          });
          const setupResp =
            await backgroundApiProxy.serviceStaking.borrowBuildSetupLutTransaction(
              {
                networkId,
                accountId,
                provider,
                marketAddress,
                reserveAddress,
                collateralReserveAddress,
              },
            );

          if (!setupResp.tx) {
            throw new OneKeyLocalError(failedMessage);
          }

          const setupTrackingStakingInfo = buildBorrowTrackingStakingInfo({
            stakingInfo,
            orderId: setupResp.orderId,
          });

          const setupConfirmResult = await waitForTxConfirmResult({
            encodedTx: parseBorrowEncodedTx(setupResp.tx),
            stakingInfo: setupTrackingStakingInfo,
          });

          if (setupConfirmResult.status === 'cancel') {
            return false;
          }

          const latestSetupTxId = getLatestTxId(setupConfirmResult.data);
          if (!latestSetupTxId) {
            throw new OneKeyLocalError(failedMessage);
          }

          await syncBorrowOrder({
            orderId: setupResp.orderId,
            networkId,
            txId: latestSetupTxId,
            status:
              setupConfirmResult.data[setupConfirmResult.data.length - 1]
                ?.decodedTx.status ?? EDecodedTxStatus.Pending,
          });

          setupLutFinalizationResult =
            await backgroundApiProxy.serviceStaking.waitForSolTxFinalized({
              networkId,
              txId: latestSetupTxId,
            });

          if (setupResp.orderId) {
            await backgroundApiProxy.serviceStaking.updateOrderStatusByTxId({
              currentTxId: latestSetupTxId,
              status: mapBorrowLutFinalizationToTxStatus(
                setupLutFinalizationResult,
              ),
            });
          }

          if (setupLutFinalizationResult === 'failed') {
            throw new OneKeyLocalError(
              intl.formatMessage({
                id: getBorrowLutFinalizationErrorTranslation(
                  setupLutFinalizationResult,
                ),
              }),
            );
          }

          await timerUtils.wait(LUT_PROPAGATION_BUFFER_MS);
        }

        if (needsSetupLut) {
          onSetupLutReadyForRepay?.();
        }

        let freshQuote: IRepayWithCollateralQuote | undefined;
        if (needsSetupLut) {
          // Re-quote after LUT setup so the confirm summary and the built
          // transaction stay pinned to the same fresh route.
          freshQuote =
            await backgroundApiProxy.serviceStaking.getBorrowRepayWithCollateralQuote(
              {
                networkId,
                accountId,
                provider,
                marketAddress,
                reserveAddress,
                collateralReserveAddress,
                amount,
                repayAll,
                slippageBps,
              },
            );
        }

        const resp =
          await backgroundApiProxy.serviceStaking.borrowBuildRepayWithCollateralTransaction(
            {
              networkId,
              accountId,
              provider,
              marketAddress,
              reserveAddress,
              collateralReserveAddress,
              amount,
              repayAll,
              slippageBps,
              routeKey: needsSetupLut ? freshQuote?.routeKey : routeKey,
            },
          );

        const stakingInfoWithOrderId = attachBorrowOrderId({
          stakingInfo: attachRepayWithCollateralAmount({
            stakingInfo,
            amount: freshQuote?.swapIn,
          }),
          orderId: resp.orderId,
        });

        if (needsSetupLut) {
          await timerUtils.wait(SIGNATURE_MODAL_SETTLE_WAIT_MS);
        }

        const repayConfirmResult = await waitForTxConfirmResult({
          encodedTx: parseBorrowEncodedTx(resp.tx),
          stakingInfo: stakingInfoWithOrderId,
        });

        if (repayConfirmResult.status === 'cancel') {
          return false;
        }

        await handleBorrowSuccess({
          data: repayConfirmResult.data,
          orderId: resp.orderId,
          networkId,
          onSuccess,
        });
        return true;
      } catch (error) {
        Toast.error({
          title:
            error instanceof Error && error.message
              ? error.message
              : intl.formatMessage({
                  id: ETranslations.global_failed,
                }),
        });
        onFail?.(error as Error);
        return false;
      }
    },
    [accountId, intl, networkId, waitForTxConfirmResult],
  );
}

type IBorrowClaimTxParams = {
  provider: string;
  marketAddress: string;
  ids: string[];
  stakingInfo?: IStakingInfo;
  onSuccess?: IModalSendParamList['SendConfirm']['onSuccess'];
  onFail?: IModalSendParamList['SendConfirm']['onFail'];
};

export function useUniversalBorrowClaim({
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

  return useCallback(
    async ({
      provider,
      marketAddress,
      ids,
      stakingInfo,
      onSuccess,
      onFail,
    }: IBorrowClaimTxParams) => {
      const resp =
        await backgroundApiProxy.serviceStaking.borrowBuildClaimTransaction({
          networkId,
          accountId,
          provider,
          marketAddress,
          ids,
        });

      const stakingInfoWithOrderId = attachBorrowOrderId({
        stakingInfo,
        orderId: resp.orderId,
      });

      await navigationToTxConfirm({
        encodedTx: parseBorrowEncodedTx(resp.tx),
        stakingInfo: stakingInfoWithOrderId,
        onSuccess: async (data) => {
          await handleBorrowSuccess({
            data,
            orderId: resp.orderId,
            networkId,
            onSuccess,
          });
        },
        onFail,
      });
    },
    [accountId, networkId, navigationToTxConfirm],
  );
}
