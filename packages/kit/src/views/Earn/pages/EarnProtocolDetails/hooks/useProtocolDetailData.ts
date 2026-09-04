import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useEarnAccount } from '@onekeyhq/kit/src/views/Staking/hooks/useEarnAccount';
import { buildLocalTxStatusSyncId } from '@onekeyhq/kit/src/views/Staking/utils/utils';
import { swrKeys } from '@onekeyhq/shared/src/utils/swrCacheUtils';
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
  includeAccountContext = false,
}: {
  accountId: string;
  networkId: string;
  indexedAccountId: string | undefined;
  symbol: string;
  provider: string;
  vault: string | undefined;
  // Sends the account address with the detail request, which makes the server
  // return this account's portfolio/rewards/balance and enqueue a position
  // refresh. Only the phone layout needs it; desktop/web read positions from
  // /earn/v1/manage-page and must keep their current request shape.
  includeAccountContext?: boolean;
}) {
  const { locale } = useIntl();
  const { id: currencyId } = useCurrency();
  const {
    earnAccount,
    refreshAccount,
    isLoading: isAccountLoading,
  } = useEarnAccount({
    networkId,
    accountId,
    indexedAccountId,
    btcOnlyTaproot: true,
  });

  // Identifies whose balances a response describes. Kept out of the request
  // itself so an account switch produces a different cache entry instead of
  // reusing the previous account's numbers.
  const accountScopeKey = includeAccountContext
    ? `${accountId || ''}|${indexedAccountId || ''}`
    : undefined;

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
        ...(includeAccountContext ? { accountId, indexedAccountId } : {}),
      }),
    // Locale and currency invalidate interceptor-owned request headers even
    // though getProtocolDetailsV2 does not receive them as explicit params.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      networkId,
      symbol,
      provider,
      vault,
      locale,
      currencyId,
      includeAccountContext,
      accountScopeKey,
    ],
    {
      watchLoading: true,
      swrKey: swrKeys.earnProtocolDetail({
        networkId,
        symbol,
        provider,
        vault,
        locale,
        currencyId,
        accountScopeKey,
      }),
      // Account-scoped responses carry balances and rewards; keep them in
      // memory only rather than persisting them alongside the shared protocol
      // response.
      swrShouldPersist: (result) =>
        !includeAccountContext &&
        Boolean(result.protocol || result.subscriptionValue?.token),
    },
  );

  const tokenInfo = useMemo<IEarnTokenInfo | undefined>(() => {
    if (detailInfo?.subscriptionValue?.token) {
      const protocolVault = detailInfo.protocol?.vault ?? vault;
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
        vault: protocolVault,
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
        protocolVault: detailInfo.protocol.vault ?? vault,
      }),
      overflowBalance: detailInfo.nums?.overflow,
      maxUnstakeAmount: detailInfo.nums?.maxUnstakeAmount,
      minUnstakeAmount: detailInfo.nums?.minUnstakeAmount,
      minTransactionFee: detailInfo.nums?.minTransactionFee,
      remainingCap: detailInfo.nums?.remainingCap,
      claimable: detailInfo.nums?.claimable,
      withdrawApprove: detailInfo.withdrawApprove,
      receiptTokenRate:
        detailInfo.protocol.receiptTokenRate ??
        detailInfo.protocol.morphoTokenRate,
      morphoTokenRate: detailInfo.protocol.morphoTokenRate,
    };
  }, [detailInfo, earnAccount, provider, symbol, vault]);

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
