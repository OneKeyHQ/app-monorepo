import { useEffect, useMemo } from 'react';

import { parse } from 'date-fns';
import { useIntl } from 'react-intl';

import { isAccountCompatibleWithNetwork } from '@onekeyhq/engine/src/managers/account';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../../hooks';
import {
  selecKeleIncomes,
  selecKeleNetworkDashboardGlobal,
  selecKeleOpHistory,
  selecKelePendingWithdraw,
  selecKeleUnstakeOverviews,
  selecKeleWithdrawOverviews,
  selectAccountTokensBalance,
  selectEthStakingApr,
  selectKeleMinerOverviews,
  selectLidoOverview,
} from '../../../store/selectors';
import { formatAmount, isEvmNetworkId } from '../../Swap/utils';
import { getLidoContractAddress, getStMaticContractAdderess } from '../address';
import { EthStakingSource } from '../typing';

import type {
  KeleGenericHistory,
  LidoMaticOverview,
  LidoOverview,
} from '../typing';

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
  return useAppSelector(selecKeleUnstakeOverviews)?.[accountId]?.[networkId];
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
  return useAppSelector(selecKeleWithdrawOverviews)?.[accountId]?.[networkId];
}

export function useKeleMinerOverview(networkId?: string, accountId?: string) {
  return useAppSelector(selectKeleMinerOverviews)?.[accountId ?? '']?.[
    networkId ?? ''
  ];
}

export function useKeleDashboardInfo(networkId?: string) {
  return useAppSelector(selecKeleNetworkDashboardGlobal)?.[networkId ?? ''];
}

export function useKeleIncomes(networkId?: string, accountId?: string) {
  return useAppSelector(selecKeleIncomes)?.[accountId ?? '']?.[networkId ?? ''];
}

export function useKeleOpHistory(networkId?: string, accountId?: string) {
  return useAppSelector(selecKeleOpHistory)?.[accountId ?? '']?.[
    networkId ?? ''
  ];
}

export function usePendingWithdraw(networkId?: string, accountId?: string) {
  return useAppSelector(selecKelePendingWithdraw)?.[accountId ?? '']?.[
    networkId ?? ''
  ];
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
          time: parse(
            item.history_time,
            'yyyy-MM-dd HH:mm:ss',
            new Date(),
          ).getTime(),
        })),
      );
    }
    return result.sort((a, b) => b.time - a.time);
  }, [incomes, opHistory]);
}

export const useStakingAprValue = (
  source: EthStakingSource,
  isTestnet?: boolean,
) => {
  const ethStakingApr = useAppSelector(selectEthStakingApr);
  if (!ethStakingApr) {
    return '';
  }
  const data = isTestnet ? ethStakingApr?.testnet : ethStakingApr.mainnet;
  return source === EthStakingSource.Kele
    ? formatAmount(data.kele, 2)
    : formatAmount(data.lido, 2);
};

export const useLidoOverview = (
  networkId?: string,
  accountId?: string,
): LidoOverview | undefined => {
  const lidoOverview = useAppSelector(selectLidoOverview);
  const balances = useAppSelector(selectAccountTokensBalance)?.[
    networkId ?? ''
  ]?.[accountId ?? ''];
  return useMemo(() => {
    if (!networkId || !accountId) return undefined;
    const overview = lidoOverview?.[accountId]?.[networkId];
    const address = getLidoContractAddress(networkId);
    const stBalance = balances?.[address.toLowerCase()]?.balance;

    return {
      ...overview,
      balance: stBalance ?? overview?.balance,
      nfts: overview?.nfts ?? [],
    };
  }, [networkId, accountId, lidoOverview, balances]);
};

export const useLidoMaticOverview = (
  networkId?: string,
  accountId?: string,
): LidoMaticOverview | undefined => {
  const lidoMaticOverview = useAppSelector((s) => s.staking.lidoMaticOverview);
  const balances = useAppSelector(
    (s) => s.tokens.accountTokensBalance?.[networkId ?? '']?.[accountId ?? ''],
  );
  return useMemo(() => {
    if (!networkId || !accountId) return undefined;
    const overview = lidoMaticOverview?.[accountId]?.[networkId];
    const address = getStMaticContractAdderess(networkId);
    const stMaticBalance = balances?.[address.toLowerCase()]?.balance;

    return {
      ...overview,
      balance: stMaticBalance ?? overview?.balance,
      nfts: overview?.nfts ?? [],
    };
  }, [networkId, accountId, lidoMaticOverview, balances]);
};
