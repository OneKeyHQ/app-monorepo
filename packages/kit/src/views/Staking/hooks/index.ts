import { useEffect, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { isAccountCompatibleWithNetwork } from '@onekeyhq/engine/src/managers/account';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../../hooks';
import { isEvmNetworkId } from '../../Swap/utils';

import type { KeleGenericHistory } from '../typing';

export function useAccountStakingActivity(
  networkId: string,
  accountId: string,
) {
  return useAppSelector(
    (s) => s.staking.stakingActivities?.[accountId]?.[networkId],
  );
}

export function useKeleUnstakeOverview(networkId: string, accountId: string) {
  useEffect(() => {
    if (
      isEvmNetworkId(networkId) &&
      isAccountCompatibleWithNetwork(accountId, networkId)
    ) {
      backgroundApiProxy.serviceStaking.fetchKeleUnstakeOverview({
        networkId,
        accountId,
      });
    }
  }, [networkId, accountId]);
  return useAppSelector(
    (s) => s.staking.keleUnstakeOverviews?.[accountId]?.[networkId],
  );
}

export function useKeleWithdrawOverview(networkId: string, accountId: string) {
  useEffect(() => {
    if (
      isEvmNetworkId(networkId) &&
      isAccountCompatibleWithNetwork(accountId, networkId)
    ) {
      backgroundApiProxy.serviceStaking.fetchWithdrawOverview({
        networkId,
        accountId,
      });
    }
  }, [networkId, accountId]);
  return useAppSelector(
    (s) => s.staking.keleWithdrawOverviews?.[accountId]?.[networkId],
  );
}

export function useKeleMinerOverview(networkId?: string, accountId?: string) {
  return useAppSelector(
    (s) => s.staking.keleMinerOverviews?.[accountId ?? '']?.[networkId ?? ''],
  );
}

export function useKeleIncomes(networkId?: string, accountId?: string) {
  return useAppSelector(
    (s) => s.staking.keleIncomes?.[accountId ?? '']?.[networkId ?? ''],
  );
}

export function useKeleOpHistory(networkId?: string, accountId?: string) {
  return useAppSelector(
    (s) => s.staking.keleOpHistory?.[accountId ?? '']?.[networkId ?? ''],
  );
}

export function usePendingWithdraw(networkId?: string, accountId?: string) {
  return useAppSelector(
    (s) => s.staking.kelePendingWithdraw?.[accountId ?? '']?.[networkId ?? ''],
  );
}

export function useIntlMinutes(minutes: number) {
  const intl = useIntl();
  const day = 60 * 24;
  const hour = 60;
  const days = Math.floor(minutes / day);
  if (days > 0) {
    return `${days} ${intl.formatMessage({ id: 'content__day' })}`;
  }
  const hours = Math.floor(minutes / hour);
  if (hours > 0) {
    return `${hours} ${intl.formatMessage({ id: 'content__hours' })}`;
  }
  return `${minutes} ${intl.formatMessage({
    id: 'content__minutes_lowercase',
  })}`;
}

export function useKeleHistory(networkId?: string, accountId?: string) {
  const incomes = useKeleIncomes(networkId, accountId);
  const opHistory = useKeleOpHistory(networkId, accountId);
  return useMemo(() => {
    let result: KeleGenericHistory[] = [];
    if (incomes && incomes.length) {
      result = result.concat(
        incomes.map((item) => ({
          type: 'income',
          income: item,
          time: new Date(item.date).getTime(),
        })),
      );
    }
    if (opHistory && opHistory.length) {
      result = result.concat(
        opHistory.map((item) => ({
          type: 'op',
          op: item,
          time: new Date(item.history_time).getTime(),
        })),
      );
    }
    return result.sort((a, b) => b.time - a.time);
  }, [incomes, opHistory]);
}
