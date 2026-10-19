import { useCallback, useEffect, useMemo } from 'react';

import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { convertFiat } from '@onekeyhq/kit/src/utils/fiatConvert';
import {
  useCurrencyPersistAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IPoolPositionView } from '@onekeyhq/shared/types/pools';

import { onPoolsDataChanged } from './poolsDemoEvents';

// LP positions sit in Earn's portfolio under the protocol, like any other
// protocol there: one group per protocol per network.
export const UNISWAP_PROTOCOL = {
  name: 'Uniswap',
  logoURI: 'https://uni.onekey-asset.com/static/logo/Uniswap.png',
};

export type IPoolsPortfolioGroup = {
  key: string;
  networkId: string;
  positions: IPoolPositionView[];
  valueUsd: string;
  fees24hUsd: string;
};

export function groupPoolPositions(
  positions: IPoolPositionView[],
): IPoolsPortfolioGroup[] {
  const byNetwork = new Map<string, IPoolPositionView[]>();
  positions.forEach((view) => {
    const list = byNetwork.get(view.pool.networkId) ?? [];
    list.push(view);
    byNetwork.set(view.pool.networkId, list);
  });
  const sum = (list: IPoolPositionView[], key: 'valueUsd' | 'fees24hUsd') =>
    list
      .reduce((total, view) => total.plus(view[key]), new BigNumber(0))
      .toFixed(2);
  return Array.from(byNetwork.entries())
    .map(([networkId, list]) => ({
      key: `${networkId}-uniswap`,
      networkId,
      positions: list,
      valueUsd: sum(list, 'valueUsd'),
      fees24hUsd: sum(list, 'fees24hUsd'),
    }))
    .toSorted((a, b) => Number(b.valueUsd) - Number(a.valueUsd));
}

/**
 * Slots extra rows into a list by value without reordering the list: each
 * extra goes before the first row worth less than it.
 */
export function insertByValue<T>(
  rows: T[],
  extras: T[],
  valueOf: (row: T) => number,
): T[] {
  const sorted = extras.toSorted((a, b) => valueOf(b) - valueOf(a));
  const merged: T[] = [];
  let next = 0;
  rows.forEach((row) => {
    while (next < sorted.length && valueOf(sorted[next]) > valueOf(row)) {
      merged.push(sorted[next]);
      next += 1;
    }
    merged.push(row);
  });
  return merged.concat(sorted.slice(next));
}

/** Pool values are in USD; Earn's figures are in the user's currency */
export function useUsdToFiat() {
  const [{ currencyMap }] = useCurrencyPersistAtom();
  const [{ currencyInfo }] = useSettingsPersistAtom();
  return useCallback(
    (usd: BigNumber.Value) =>
      convertFiat({
        value: usd,
        sourceCurrency: 'usd',
        targetCurrency: currencyInfo.id,
        currencyMap,
      }),
    [currencyInfo.id, currencyMap],
  );
}

export function usePoolsPortfolio() {
  const { result: portfolio, run: refresh } = usePromiseResult(
    () => backgroundApiProxy.servicePools.getPortfolio(),
    [],
    { revalidateOnFocus: true },
  );
  useEffect(() => onPoolsDataChanged(() => void refresh()), [refresh]);
  const groups = useMemo(
    () => groupPoolPositions(portfolio?.positions ?? []),
    [portfolio?.positions],
  );
  return { portfolio, groups, refresh };
}

/** LP value and estimated 24h fees in the user's currency, for Earn's totals */
export function usePoolsPortfolioFiat() {
  const { portfolio } = usePoolsPortfolio();
  const toFiat = useUsdToFiat();
  return useMemo(
    () => ({
      valueFiat: toFiat(portfolio?.totalValueUsd ?? 0),
      fees24hFiat: toFiat(portfolio?.fees24hUsd ?? 0),
    }),
    [portfolio?.fees24hUsd, portfolio?.totalValueUsd, toFiat],
  );
}
