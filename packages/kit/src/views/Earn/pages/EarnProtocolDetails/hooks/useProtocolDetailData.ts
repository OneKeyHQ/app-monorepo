import { useMemo } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { buildLocalTxStatusSyncId } from '@onekeyhq/kit/src/views/Staking/utils/utils';
import type { ISupportedSymbol } from '@onekeyhq/shared/types/earn';
import type {
  IEarnTokenInfo,
  IEarnWithdrawActionIcon,
  IProtocolInfo,
} from '@onekeyhq/shared/types/staking';

export function useProtocolDetailData({
  accountId,
  networkId,
  indexedAccountId,
  symbol,
  provider,
  vault,
}: {
  accountId: string;
  networkId: string;
  indexedAccountId: string | undefined;
  symbol: ISupportedSymbol;
  provider: string;
  vault: string | undefined;
}) {
  const {
    result: earnAccount,
    run: refreshAccount,
    isLoading: isAccountLoading,
  } = usePromiseResult(
    async () => {
      // If no account, don't fetch and don't block loading
      if (!accountId && !indexedAccountId) {
        return undefined;
      }
      return backgroundApiProxy.serviceStaking.getEarnAccount({
        accountId,
        networkId,
        indexedAccountId,
        btcOnlyTaproot: true,
      });
    },
    [accountId, indexedAccountId, networkId],
    { watchLoading: true },
  );

  const {
    result: detailInfo,
    isLoading: isDetailLoading,
    run,
  } = usePromiseResult(
    async () =>
      backgroundApiProxy.serviceStaking.getProtocolDetailsV2({
        networkId,
        symbol,
        provider,
        vault,
      }),
    [networkId, symbol, provider, vault],
    { watchLoading: true },
  );

  const tokenInfo = useMemo<IEarnTokenInfo | undefined>(() => {
    if (detailInfo?.subscriptionValue?.token) {
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
        accountId: accountId ?? '',
      };
    }
    return undefined;
  }, [detailInfo, networkId, provider, vault, accountId]);

  const protocolInfo = useMemo<IProtocolInfo | undefined>(() => {
    if (!detailInfo?.protocol || !earnAccount) {
      return undefined;
    }

    const withdrawAction = detailInfo?.actions?.find(
      (i) => i.type === 'withdraw',
    ) as IEarnWithdrawActionIcon;

    return {
      ...detailInfo.protocol,
      apyDetail: detailInfo.apyDetail,
      earnAccount,
      activeBalance: withdrawAction?.data?.balance,
      eventEndTime: detailInfo?.countDownAlert?.endTime,
      stakeTag: buildLocalTxStatusSyncId({
        providerName: provider,
        tokenSymbol: symbol,
      }),
      overflowBalance: detailInfo.nums?.overflow,
      maxUnstakeAmount: detailInfo.nums?.maxUnstakeAmount,
      minUnstakeAmount: detailInfo.nums?.minUnstakeAmount,
      minTransactionFee: detailInfo.nums?.minTransactionFee,
      remainingCap: detailInfo.nums?.remainingCap,
      claimable: detailInfo.nums?.claimable,
    };
  }, [detailInfo, earnAccount, provider, symbol]);

  return {
    earnAccount,
    detailInfo,
    tokenInfo,
    protocolInfo,
    // Only include account loading if we actually have an account to load
    // Otherwise detail loading alone is enough
    isLoading:
      (accountId || indexedAccountId ? isAccountLoading : false) ||
      isDetailLoading,
    refreshData: run,
    refreshAccount,
  };
}
