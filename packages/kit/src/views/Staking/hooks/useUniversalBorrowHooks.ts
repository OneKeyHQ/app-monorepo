import { useCallback } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSignatureConfirm } from '@onekeyhq/kit/src/hooks/useSignatureConfirm';
import type { IEncodedTx } from '@onekeyhq/core/src/types';
import type { IModalSendParamList } from '@onekeyhq/shared/src/routes';
import type { IStakingInfo } from '@onekeyhq/shared/types/staking';

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

type IBorrowBuildTxParams = {
  amount: string;
  provider: string;
  marketAddress: string;
  reserveAddress: string;
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

      await navigationToTxConfirm({
        encodedTx: parseBorrowEncodedTx(resp.tx),
        stakingInfo,
        onSuccess,
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
        });

      await navigationToTxConfirm({
        encodedTx: parseBorrowEncodedTx(resp.tx),
        stakingInfo,
        onSuccess,
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

      await navigationToTxConfirm({
        encodedTx: parseBorrowEncodedTx(resp.tx),
        stakingInfo,
        onSuccess,
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
        });

      await navigationToTxConfirm({
        encodedTx: parseBorrowEncodedTx(resp.tx),
        stakingInfo,
        onSuccess,
        onFail,
      });
    },
    [accountId, networkId, navigationToTxConfirm],
  );
}

