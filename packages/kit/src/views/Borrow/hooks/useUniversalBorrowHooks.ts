import { useCallback } from 'react';

import type { IEncodedTx } from '@onekeyhq/core/src/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IModalSendParamList } from '@onekeyhq/shared/src/routes';
import type { IStakingInfo } from '@onekeyhq/shared/types/staking';
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
  if (
    orderId &&
    Array.isArray(data) &&
    data.length === 1 &&
    data[0].signedTx?.txid
  ) {
    await backgroundApiProxy.serviceStaking.addEarnOrder({
      orderId,
      networkId,
      txId: data[0].signedTx.txid,
      status: data[0].decodedTx.status,
    });
  }
  onSuccess?.(data);
};

type IBorrowBuildTxParams = {
  amount: string;
  provider: string;
  marketAddress: string;
  reserveAddress: string;
  collateralReserveAddress?: string;
  withdrawAll?: boolean;
  repayAll?: boolean;
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
      collateralReserveAddress,
      repayAll,
      slippageBps,
      routeKey,
      stakingInfo,
      onSuccess,
      onFail,
    }: IBorrowBuildTxParams) => {
      if (!collateralReserveAddress) {
        throw new OneKeyLocalError('collateralReserveAddress is required');
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
            routeKey,
          },
        );

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
