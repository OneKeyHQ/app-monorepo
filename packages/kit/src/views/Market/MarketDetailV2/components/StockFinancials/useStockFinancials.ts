// cspell:ignore financials
import { useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type {
  IStockFinancialPeriod,
  IStockFinancials,
} from '@onekeyhq/shared/types/marketStockFinancials';

import { createFinancialsLoader } from './financialsUtils';

export type IFinancialPeriodResult = {
  data: IStockFinancials | null;
  failed: boolean;
};

export function useStockFinancials(stockId: string) {
  const loaderRef = useRef<ReturnType<typeof createFinancialsLoader> | null>(
    null,
  );
  if (!loaderRef.current) {
    loaderRef.current = createFinancialsLoader((params) =>
      backgroundApiProxy.serviceMarketV2.fetchMarketStockFinancials(params),
    );
  }
  const normalizedStockId = stockId.trim().toUpperCase();
  const lastSuccessRef = useRef(new Map<string, IStockFinancials>());
  const refreshRef = useRef(false);
  const { result, isLoading, run } = usePromiseResult(
    async () => {
      const refresh = refreshRef.current;
      refreshRef.current = false;
      const loadPeriod = async (
        period: IStockFinancialPeriod,
      ): Promise<IFinancialPeriodResult> => {
        const key = `${normalizedStockId}:${period}`;
        try {
          const data = await loaderRef.current?.(
            normalizedStockId,
            period,
            refresh,
          );
          if (data) {
            const firstKey = lastSuccessRef.current.keys().next().value;
            if (lastSuccessRef.current.size >= 20 && firstKey !== undefined) {
              lastSuccessRef.current.delete(firstKey);
            }
            lastSuccessRef.current.set(key, data);
          }
          return { data: data ?? null, failed: false };
        } catch (_error) {
          return {
            data: lastSuccessRef.current.get(key) ?? null,
            failed: true,
          };
        }
      };
      const [annual, quarter] = await Promise.all([
        loadPeriod('annual'),
        loadPeriod('quarter'),
      ]);
      return { stockId: normalizedStockId, annual, quarter };
    },
    [normalizedStockId],
    { watchLoading: true, revalidateOnReconnect: true },
  );
  return {
    // A previous stock's successful result must not flash on a new route.
    result: result?.stockId === normalizedStockId ? result : undefined,
    isLoading: Boolean(isLoading),
    retry: async () => {
      refreshRef.current = true;
      await run();
    },
  };
}
