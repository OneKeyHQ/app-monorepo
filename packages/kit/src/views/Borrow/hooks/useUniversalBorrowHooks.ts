import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import type { IEncodedTx, IUnsignedTxPro } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IModalSendParamList } from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';
import type { IStakingInfo } from '@onekeyhq/shared/types/staking';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';
import type { ISendTxOnSuccessData } from '@onekeyhq/shared/types/tx';

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

const waitForTxFinalStatus = async ({
  accountId,
  networkId,
  txid,
  signal,
  maxAttempts = 24,
  intervalMs = timerUtils.getTimeDurationMs({ seconds: 5 }),
}: {
  accountId: string;
  networkId: string;
  txid: string;
  signal?: AbortSignal;
  maxAttempts?: number;
  intervalMs?: number;
}) => {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (signal?.aborted) {
      return undefined;
    }

    const txDetailsResp =
      await backgroundApiProxy.serviceHistory.fetchTxDetails({
        accountId,
        networkId,
        txid,
      });
    const txStatus = txDetailsResp?.data?.status;

    if (
      txStatus === EOnChainHistoryTxStatus.Success ||
      txStatus === EOnChainHistoryTxStatus.Failed
    ) {
      return txStatus;
    }

    if (attempt < maxAttempts - 1) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, intervalMs);
      });
    }
  }

  return undefined;
};

const getLatestTxId = (data: ISendTxOnSuccessData[]) => {
  for (let index = data.length - 1; index >= 0; index -= 1) {
    const item = data[index];
    const txId = item?.signedTx?.txid ?? item?.decodedTx?.txid;
    if (txId) {
      return txId;
    }
  }

  return undefined;
};

const getTxIds = (data: ISendTxOnSuccessData[]) =>
  data
    .map((item) => item?.signedTx?.txid ?? item?.decodedTx?.txid)
    .filter((txId): txId is string => Boolean(txId));

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

const buildBorrowUnsignedTxs = async ({
  accountId,
  networkId,
  txs,
}: {
  accountId: string;
  networkId: string;
  txs: string[];
}) => {
  const unsignedTxs: IUnsignedTxPro[] = [];
  let prevNonce: number | undefined;

  for (const tx of txs) {
    const unsignedTx =
      await backgroundApiProxy.serviceSend.prepareSendConfirmUnsignedTx({
        networkId,
        accountId,
        encodedTx: parseBorrowEncodedTx(tx),
        prevNonce,
      });
    prevNonce = unsignedTx.nonce;
    unsignedTxs.push(unsignedTx);
  }

  return unsignedTxs;
};

const buildRepayWithCollateralTxWithRetry = async ({
  accountId,
  networkId,
  provider,
  marketAddress,
  reserveAddress,
  collateralReserveAddress,
  amount,
  repayAll,
  slippageBps,
  routeKey,
  needsSetupLut,
}: {
  accountId: string;
  networkId: string;
  provider: string;
  marketAddress: string;
  reserveAddress: string;
  collateralReserveAddress: string;
  amount: string;
  repayAll?: boolean;
  slippageBps?: number;
  routeKey?: string;
  needsSetupLut?: boolean;
}) => {
  const maxAttempts = needsSetupLut ? 5 : 1;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await backgroundApiProxy.serviceStaking.borrowBuildRepayWithCollateralTransaction(
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
          routeKey,
        },
      );
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts - 1) {
        await timerUtils.wait(1500);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
};

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
      unsignedTxs,
      stakingInfo,
      returnAllMultiTxResults,
    }: {
      encodedTx?: IEncodedTx;
      unsignedTxs?: IUnsignedTxPro[];
      stakingInfo?: IStakingInfo;
      returnAllMultiTxResults?: boolean;
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
          unsignedTxs,
          stakingInfo,
          returnAllMultiTxResults,
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
      onSuccess,
      onFail,
    }: IBorrowBuildTxParams) => {
      try {
        if (!collateralReserveAddress) {
          throw new OneKeyLocalError('collateralReserveAddress is required');
        }

        if (needsSetupLut) {
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

          const setupTxs: string[] = [];
          if (setupResp.txs?.length) {
            setupTxs.push(...setupResp.txs);
          } else if (setupResp.tx) {
            setupTxs.push(setupResp.tx);
          }

          if (setupTxs.length > 0) {
            const setupUnsignedTxs = await buildBorrowUnsignedTxs({
              networkId,
              accountId,
              txs: setupTxs,
            });

            const setupConfirmResult = await waitForTxConfirmResult({
              unsignedTxs: setupUnsignedTxs,
              returnAllMultiTxResults: true,
            });

            if (setupConfirmResult.status === 'cancel') {
              return;
            }

            const setupTxIds = getTxIds(setupConfirmResult.data);
            if (setupTxIds.length !== setupTxs.length) {
              Toast.error({
                title: intl.formatMessage({
                  id: ETranslations.global_failed,
                }),
              });
              return;
            }

            for (const setupTxId of setupTxIds) {
              const setupStatus = await waitForTxFinalStatus({
                accountId,
                networkId,
                txid: setupTxId,
              });

              if (setupStatus !== EOnChainHistoryTxStatus.Success) {
                await syncBorrowOrder({
                  orderId: setupResp.orderId,
                  networkId,
                  txId: setupTxId,
                  status: EDecodedTxStatus.Failed,
                });
                Toast.error({
                  title: intl.formatMessage({
                    id: ETranslations.global_failed,
                  }),
                });
                return;
              }
            }

            await syncBorrowOrder({
              orderId: setupResp.orderId,
              networkId,
              txId: setupTxIds[setupTxIds.length - 1],
              status: EDecodedTxStatus.Confirmed,
            });
          }
        }

        const resp = await buildRepayWithCollateralTxWithRetry({
          networkId,
          accountId,
          provider,
          marketAddress,
          reserveAddress,
          collateralReserveAddress,
          amount,
          repayAll,
          slippageBps,
          routeKey,
          needsSetupLut,
        });

        const stakingInfoWithOrderId = attachBorrowOrderId({
          stakingInfo,
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
          return;
        }

        await handleBorrowSuccess({
          data: repayConfirmResult.data,
          orderId: resp.orderId,
          networkId,
          onSuccess,
        });
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
        throw error;
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
