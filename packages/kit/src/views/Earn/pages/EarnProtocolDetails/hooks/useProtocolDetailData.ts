import { useEffect, useMemo, useRef } from 'react';

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

  // One request identity per set of fetch inputs. usePromiseResult resets the
  // result the moment the swr key changes but starts the new fetch only once
  // the screen is focused again, so a page left open in another tab while the
  // account switches sits on "no result, not loading" until refocus. Tracking
  // which identity last settled (and whether it failed) lets the page tell
  // that gap apart from a fetch that really failed (OK-63175).
  const requestKey = [
    networkId,
    symbol,
    provider,
    vault ?? '',
    locale,
    currencyId,
    accountScopeKey ?? '',
  ].join('|');
  const requestKeyRef = useRef(requestKey);
  requestKeyRef.current = requestKey;
  const settledRequestKeyRef = useRef<string | undefined>(undefined);
  const failedRequestKeyRef = useRef<string | undefined>(undefined);

  const {
    result: detailInfo,
    isLoading: isDetailLoading,
    run,
  } = usePromiseResult(
    async () => {
      const startedRequestKey = requestKeyRef.current;
      try {
        const result =
          await backgroundApiProxy.serviceStaking.getProtocolDetailsV2({
            networkId,
            symbol,
            provider,
            vault,
            ...(includeAccountContext ? { accountId, indexedAccountId } : {}),
          });
        settledRequestKeyRef.current = startedRequestKey;
        if (failedRequestKeyRef.current === startedRequestKey) {
          failedRequestKeyRef.current = undefined;
        }
        return result;
      } catch (error) {
        settledRequestKeyRef.current = startedRequestKey;
        failedRequestKeyRef.current = startedRequestKey;
        throw error;
      }
    },
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

  // For an indexed account, useEarnAccount re-resolves the address after a
  // GlobalDeriveTypeUpdate / NetworkDeriveTypeChanged, but the request above
  // only carries the unchanged accountId/indexedAccountId, so nothing would
  // refetch: protocolInfo below would move to the new address while
  // mobilePortfolio, balances and rewards still described the old one.
  // Guarded on a previous value so the initial undefined -> resolved
  // transition does not fire a second request on every cold open.
  const derivedAddress = earnAccount?.accountAddress;
  const lastDerivedAddressRef = useRef(derivedAddress);
  useEffect(() => {
    const previous = lastDerivedAddressRef.current;
    lastDerivedAddressRef.current = derivedAddress;
    if (previous && derivedAddress && previous !== derivedAddress) {
      void run();
    }
  }, [derivedAddress, run]);

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

  // No result yet for the current inputs and no fetch has settled for them:
  // the fetch is either in flight or waiting for focus. Reported as loading
  // so the page shows its skeleton instead of an error it cannot know about.
  const isDetailPending =
    detailInfo === undefined && settledRequestKeyRef.current !== requestKey;
  // The fetch for exactly these inputs ran and failed; a refresh clears it.
  const isError =
    detailInfo === undefined &&
    !isDetailLoading &&
    failedRequestKeyRef.current === requestKey;

  return {
    earnAccount,
    detailInfo,
    tokenInfo,
    protocolInfo,
    // Only include account loading if we actually have an account to load
    // Otherwise detail loading alone is enough
    isLoading:
      (accountId || indexedAccountId ? isAccountLoading : false) ||
      isDetailLoading ||
      isDetailPending,
    isError,
    refreshData: run,
    refreshAccount,
  };
}
