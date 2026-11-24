import { useCallback } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IFilterState } from '@onekeyhq/kit/src/views/ReferFriends/components/FilterButton';
import type { IEarnPositionsResponse } from '@onekeyhq/shared/src/referralCode/type';

import { EARN_VAULT_KEY_SEPARATOR } from '../components/RewardAccountList';

import type {
  ISectionData,
  IVaultAmount,
} from '../components/RewardAccountList';

type IRewardAccount = { accountAddress: string; networkId: string };

const EMPTY_LISTS: (ISectionData[] | undefined)[] = [];

function collectRewardAccounts(lists: (ISectionData[] | undefined)[]) {
  const accounts: IRewardAccount[] = [];
  const seen = new Set<string>();
  lists.forEach((items) =>
    items?.forEach(({ accountAddress, items: vaults }) => {
      // A record with no vault rows has no network to look positions up on.
      const networkId = vaults[0]?.networkId;
      const key = `${accountAddress}-${networkId ?? ''}`;
      if (!networkId || seen.has(key)) {
        return;
      }
      seen.add(key);
      accounts.push({ accountAddress, networkId });
    }),
  );
  return accounts;
}

function toVaultAmount(list: IEarnPositionsResponse['list']) {
  const vaultAmount: IVaultAmount = {};
  for (const item of list) {
    const keys = item.key.split(EARN_VAULT_KEY_SEPARATOR);
    const lastIndex = keys.length - 1;
    if (keys[lastIndex].length) {
      keys[lastIndex] = keys[lastIndex].toLowerCase();
    }
    vaultAmount[item.accountAddress] ??= {};
    vaultAmount[item.accountAddress][keys.join(EARN_VAULT_KEY_SEPARATOR)] =
      item.deposited;
  }
  return vaultAmount;
}

export function useEarnRewards(filterState: IFilterState) {
  const { inviteCode, startTime, endTime } = filterState;
  // When using custom date range (startTime/endTime), don't pass timeRange
  const effectiveTimeRange =
    startTime && endTime ? undefined : filterState.timeRange;

  const {
    result: rewards,
    isLoading,
    run,
  } = usePromiseResult(
    async () => {
      const fetchRewards = (available?: boolean) =>
        backgroundApiProxy.serviceReferralCode.getEarnReward(
          undefined,
          available,
          effectiveTimeRange,
          inviteCode,
          startTime,
          endTime,
        );
      const [salesResult, totalResult] = await Promise.allSettled([
        fetchRewards(true),
        fetchRewards(),
      ]);
      const lists: (ISectionData[] | undefined)[] = [];
      let amountPending = '0';
      if (salesResult.status === 'fulfilled') {
        lists[0] = salesResult.value.items ?? [];
        amountPending = BigNumber(salesResult.value.fiatValue).toFixed() || '0';
      }
      if (totalResult.status === 'fulfilled') {
        lists[1] = totalResult.value.items ?? [];
      }
      return { lists, amountPending, accounts: collectRewardAccounts(lists) };
    },
    [effectiveTimeRange, inviteCode, startTime, endTime],
    // Keep the overlay up briefly so it does not drop before the list paints.
    { watchLoading: true, loadingDelay: 80 },
  );

  // Deposited amounts only decorate the reward rows, so they load on their
  // own: a slow, hung or failed positions request never holds the records
  // behind the loading overlay (OK-67014).
  const accounts = rewards?.accounts;
  const { result: vaultAmount } = usePromiseResult(async () => {
    if (!accounts?.length) {
      return undefined;
    }
    try {
      const response =
        await backgroundApiProxy.serviceReferralCode.getPositions(accounts);
      return toVaultAmount(response.list);
    } catch {
      return undefined;
    }
  }, [accounts]);

  const refresh = useCallback(() => run(), [run]);

  return {
    lists: rewards?.lists ?? EMPTY_LISTS,
    amountPending: rewards?.amountPending,
    vaultAmount,
    // usePromiseResult reports undefined until its first run starts.
    isLoading: isLoading ?? true,
    refresh,
  };
}
