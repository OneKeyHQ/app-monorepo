import { useRef } from 'react';

import { ContextJotaiActionsBase } from '@onekeyhq/kit/src/states/jotai/utils/ContextJotaiActionsBase';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import type { IMarketWatchListItem } from '@onekeyhq/shared/types/market'; // Assuming similar data type

import { contextAtomMethod, marketV2Atom } from './atoms';

class ContextJotaiActionsMarketV2 extends ContextJotaiActionsBase {
  // Simplified flush action
  flushMarketV2Atom = contextAtomMethod(
    (_, set, payload: IMarketWatchListItem[]) => {
      const result = { data: payload }; // Simplified data structure
      set(marketV2Atom(), result);
    },
  );

  // Example simplified action: maybe a refresh or a simple update
  refreshMarketV2 = contextAtomMethod(async (get, set) => {
    // In a real scenario, this would fetch data
    // For simplicity, let's just set an empty array
    const mockData: IMarketWatchListItem[] = [];
    this.flushMarketV2Atom.call(set, mockData);
  });
}

const createActions = memoFn(() => new ContextJotaiActionsMarketV2());

export function useMarketV2Actions() {
  const actions = createActions();
  const refreshMarketV2 = actions.refreshMarketV2.use();
  // Add other simplified actions here if needed

  return useRef({
    refreshMarketV2,
    // Add other actions to the returned ref
  });
}
