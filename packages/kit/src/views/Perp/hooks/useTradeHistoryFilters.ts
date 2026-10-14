import { useCallback, useEffect, useState } from 'react';

import { usePerpsActiveAccountAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import {
  type IFundingHistoryMarketOption,
  reconcileFundingHistoryMarketOptions,
} from '../components/OrderInfoPanel/fundingHistoryDisplay';

import type { ITradeHistoryFilters } from '../components/OrderInfoPanel/Components/tradeFillDisplay';

const DEFAULT_FILTERS: ITradeHistoryFilters = { type: 'all', side: 'all' };

export function useTradeHistoryFilters() {
  const [account] = usePerpsActiveAccountAtom();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [marketOptions, setMarketOptions] = useState<
    IFundingHistoryMarketOption[]
  >([]);
  useEffect(() => {
    setFilters(DEFAULT_FILTERS);
  }, [account?.accountAddress]);
  const onMarketOptionsChange = useCallback(
    (nextOptions: IFundingHistoryMarketOption[]) => {
      setMarketOptions((currentOptions) =>
        reconcileFundingHistoryMarketOptions({ currentOptions, nextOptions }),
      );
    },
    [],
  );
  return { filters, setFilters, marketOptions, onMarketOptionsChange };
}
