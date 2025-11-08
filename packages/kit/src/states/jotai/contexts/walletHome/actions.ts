import { useRef } from 'react';

import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import type { IPopularTradingToken } from '@onekeyhq/shared/types/swap/types';

import { ContextJotaiActionsBase } from '../../utils/ContextJotaiActionsBase';

import {
  contextAtomMethod,
  popularTradingAtom,
  popularTradingStateAtom,
} from './atoms';

class ContextJotaiActionsPopularTrading extends ContextJotaiActionsBase {
  updatePopularTrading = contextAtomMethod(
    (
      get,
      set,
      value: {
        tokens: IPopularTradingToken[];
        lastUpdatedAt: number;
      },
    ) => {
      set(popularTradingAtom(), {
        ...get(popularTradingAtom()),
        ...value,
      });
    },
  );

  updatePopularTradingState = contextAtomMethod(
    (
      get,
      set,
      value: {
        isInitialized: boolean;
        isLoading: boolean;
      },
    ) => {
      set(popularTradingStateAtom(), {
        ...get(popularTradingStateAtom()),
        ...value,
      });
    },
  );
}

const createActions = memoFn(() => {
  console.log('new ContextJotaiActionsPopularTrading()', Date.now());
  return new ContextJotaiActionsPopularTrading();
});

export function usePopularTradingActions() {
  const actions = createActions();

  const updatePopularTrading = actions.updatePopularTrading.use();
  const updatePopularTradingState = actions.updatePopularTradingState.use();

  return useRef({
    updatePopularTrading,
    updatePopularTradingState,
  });
}
