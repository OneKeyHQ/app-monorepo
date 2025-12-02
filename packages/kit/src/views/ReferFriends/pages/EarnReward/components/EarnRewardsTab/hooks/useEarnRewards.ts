import { useCallback, useEffect, useRef, useState } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IFilterState } from '@onekeyhq/kit/src/views/ReferFriends/components/FilterButton';
import type { IEarnRewardResponse } from '@onekeyhq/shared/src/referralCode/type';

import { EARN_VAULT_KEY_SEPARATOR } from '../components/RewardAccountList';

import type {
  ISectionData,
  IVaultAmount,
} from '../components/RewardAccountList';

export function useEarnRewards(filterState: IFilterState) {
  const [lists, setLists] = useState<(ISectionData[] | undefined)[]>([]);
  const [amountPending, setAmountPending] = useState<string | undefined>();
  const [vaultAmount, setVaultAmount] = useState<IVaultAmount | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const isMountedRef = useRef(true);

  const buildAccountNetworkKey = useCallback(
    (accountAddress: string, networkId: string) =>
      `${accountAddress}-${networkId}`,
    [],
  );

  const onRefresh = useCallback(async () => {
    setIsLoading(true);
    const [salesResult, totalResult] = await Promise.allSettled([
      backgroundApiProxy.serviceReferralCode.getEarnReward(
        undefined,
        true,
        filterState.timeRange,
        filterState.inviteCode,
      ),
      backgroundApiProxy.serviceReferralCode.getEarnReward(
        undefined,
        undefined,
        filterState.timeRange,
        filterState.inviteCode,
      ),
    ]);
    const listBundles: (ISectionData[] | undefined)[] = [];
    let pending = '0';
    if (salesResult.status === 'fulfilled') {
      const data = salesResult.value;
      listBundles[0] = data.items?.length ? data.items : [];
      pending = BigNumber(data.fiatValue).toFixed() || '0';
    }
    if (totalResult.status === 'fulfilled') {
      const data = totalResult.value;
      listBundles[1] = data.items?.length ? data.items : [];
    }
    const accounts: {
      accountAddress: string;
      networkId: string;
    }[] = [];
    const seenAccounts = new Set<string>();
    const processItems = (items: IEarnRewardResponse['items']) => {
      if (!items || !items.length) {
        return;
      }
      items.forEach((item) => {
        const key = buildAccountNetworkKey(
          item.accountAddress,
          item.items[0].networkId,
        );
        if (!seenAccounts.has(key)) {
          seenAccounts.add(key);
          accounts.push({
            accountAddress: item.accountAddress,
            networkId: item.items[0].networkId,
          });
        }
      });
    };

    if (salesResult.status === 'fulfilled' && salesResult.value.items) {
      processItems(salesResult.value.items);
    }

    if (totalResult.status === 'fulfilled' && totalResult.value.items) {
      processItems(totalResult.value.items);
    }
    const response = await backgroundApiProxy.serviceReferralCode.getPositions(
      accounts,
    );

    const newVaultAmount = {} as IVaultAmount;
    for (const item of response.list) {
      const keys = item.key.split(EARN_VAULT_KEY_SEPARATOR);
      const lastIndex = keys.length - 1;
      if (keys[lastIndex].length) {
        keys[lastIndex] = keys[lastIndex].toLowerCase();
      }
      if (!newVaultAmount[item.accountAddress]) {
        newVaultAmount[item.accountAddress] = {};
      }
      newVaultAmount[item.accountAddress][keys.join(EARN_VAULT_KEY_SEPARATOR)] =
        item.deposited;
    }
    if (!isMountedRef.current) {
      return;
    }
    setVaultAmount(newVaultAmount);
    setAmountPending(pending);
    setLists(listBundles);
    setTimeout(() => {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }, 80);
  }, [buildAccountNetworkKey, filterState.inviteCode, filterState.timeRange]);

  useEffect(() => {
    isMountedRef.current = true;
    void onRefresh();
    return () => {
      isMountedRef.current = false;
    };
  }, [onRefresh]);

  const refresh = useCallback(() => onRefresh(), [onRefresh]);

  return {
    lists,
    amountPending,
    vaultAmount,
    isLoading,
    refresh,
  };
}
