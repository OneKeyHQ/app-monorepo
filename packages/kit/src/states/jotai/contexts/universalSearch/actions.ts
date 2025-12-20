import { useRef } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ContextJotaiActionsBase } from '@onekeyhq/kit/src/states/jotai/utils/ContextJotaiActionsBase';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import type {
  IIUniversalRecentSearchItem,
  IUniversalSearchAtomData,
} from '@onekeyhq/shared/types/search';

import { contextAtomMethod, universalSearchAtom } from './atoms';

export const homeResettingFlags: Record<string, number> = {};

const MAX_RECENT_SEARCH_SIZE = 20;
class ContextJotaiActionsRecentSearch extends ContextJotaiActionsBase {
  syncToDb = contextAtomMethod((_, set, payload: IUniversalSearchAtomData) => {
    set(universalSearchAtom(), payload);
    void backgroundApiProxy.simpleDb.universalSearch.setRawData(payload);
  });

  addIntoRecentSearchList = contextAtomMethod(
    (get, set, payload: IIUniversalRecentSearchItem) => {
      const prev = get(universalSearchAtom());
      // Normalize text for deduplication: trim and convert to lowercase
      const normalizedPayloadText = payload.text.trim().toLowerCase();

      const newItems = prev.recentSearch.filter((recentSearchItem) => {
        const normalizedItemText = recentSearchItem.text.trim().toLowerCase();
        // Deduplicate based on normalized text only (ignore type)
        // This prevents duplicate entries like "USDC" from Market and Token sections
        return normalizedItemText !== normalizedPayloadText;
      });
      const list = [payload, ...newItems].slice(0, MAX_RECENT_SEARCH_SIZE);
      this.syncToDb.call(set, {
        recentSearch: list,
      });
    },
  );

  clearAllRecentSearch = contextAtomMethod((_, set) => {
    this.syncToDb.call(set, {
      recentSearch: [],
    });
  });
}

const createActions = memoFn(() => new ContextJotaiActionsRecentSearch());

export function useUniversalSearchActions() {
  const actions = createActions();
  const addIntoRecentSearchList = actions.addIntoRecentSearchList.use();
  const clearAllRecentSearch = actions.clearAllRecentSearch.use();

  return useRef({
    addIntoRecentSearchList,
    clearAllRecentSearch,
  });
}
