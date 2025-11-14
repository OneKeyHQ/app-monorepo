import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { ISupportedSymbol } from '@onekeyhq/shared/types/earn';
import type {
  IEarnTokenInfo,
  IEarnWithdrawActionIcon,
  IProtocolInfo,
} from '@onekeyhq/shared/types/staking';

import { buildLocalTxStatusSyncId } from '../../../utils/utils';

import { useEarnAccount } from './useEarnAccount';

export const useProtocolDetails = ({
  accountId,
  networkId,
  indexedAccountId,
  symbol,
  provider,
  vault,
}: {
  accountId: string;
  indexedAccountId: string | undefined;
  networkId: string;
  symbol: ISupportedSymbol;
  provider: string;
  vault: string | undefined;
}) => {
  const { earnAccount, refreshAccount } = useEarnAccount({
    accountId,
    networkId,
    indexedAccountId,
  });

  const {
    result: detailInfo,
    isLoading,
    run,
  } = usePromiseResult(
    async () => {
      const response =
        await backgroundApiProxy.serviceStaking.getProtocolDetailsV2({
          accountId,
          networkId,
          indexedAccountId,
          symbol,
          provider,
          vault,
        });
      return response;
    },
    [accountId, networkId, indexedAccountId, symbol, provider, vault],
    { watchLoading: true },
  );

  const tokenInfo: IEarnTokenInfo | undefined = useMemo(() => {
    if (!detailInfo?.subscriptionValue?.token) {
      return undefined;
    }

    // Use BigNumber to handle balance and fallback to '0' if invalid or missing
    const balanceBN = new BigNumber(
      detailInfo.subscriptionValue.balance || '0',
    );
    const balanceParsed = balanceBN.isNaN() ? '0' : balanceBN.toFixed();

    return {
      balanceParsed,
      token: detailInfo.subscriptionValue.token.info,
      price: detailInfo.subscriptionValue.token.price,
      networkId,
      provider,
      vault,
      accountId,
    };
  }, [
    detailInfo?.subscriptionValue?.token,
    detailInfo?.subscriptionValue?.balance,
    networkId,
    provider,
    vault,
    accountId,
  ]);

  const protocolInfo: IProtocolInfo | undefined = useMemo(() => {
    const withdrawAction = detailInfo?.actions?.find(
      (i) => i.type === 'withdraw' || i.type === 'withdrawOrder',
    ) as IEarnWithdrawActionIcon;
    return detailInfo?.protocol
      ? {
          ...detailInfo.protocol,
          apyDetail: detailInfo.apyDetail,
          earnAccount,
          activeBalance: withdrawAction?.data?.balance,
          eventEndTime: detailInfo?.countDownAlert?.endTime,
          stakeTag: buildLocalTxStatusSyncId({
            providerName: provider,
            tokenSymbol: symbol,
          }),

          // withdraw
          withdrawAction,
          overflowBalance: detailInfo.nums?.overflow,
          maxUnstakeAmount: detailInfo.nums?.maxUnstakeAmount,
          minUnstakeAmount: detailInfo.nums?.minUnstakeAmount,

          // staking
          minTransactionFee: detailInfo.nums?.minTransactionFee,
          remainingCap: detailInfo.nums?.remainingCap,

          // claim
          claimable: detailInfo.nums?.claimable,
        }
      : undefined;
  }, [
    detailInfo?.actions,
    detailInfo?.apyDetail,
    detailInfo?.countDownAlert?.endTime,
    detailInfo?.nums?.claimable,
    detailInfo?.nums?.maxUnstakeAmount,
    detailInfo?.nums?.minTransactionFee,
    detailInfo?.nums?.minUnstakeAmount,
    detailInfo?.nums?.remainingCap,
    detailInfo?.nums?.overflow,
    detailInfo?.protocol,
    earnAccount,
    provider,
    symbol,
  ]);

  return {
    detailInfo,
    isLoading,
    run,
    tokenInfo,
    earnAccount,
    refreshAccount,
    protocolInfo,
  };
};
