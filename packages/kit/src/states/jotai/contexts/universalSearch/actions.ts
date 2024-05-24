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

const MAX_RECENT_SEARCH_SIZE = 10;
class ContextJotaiActionsRecentSearch extends ContextJotaiActionsBase {
  syncToDb = contextAtomMethod((_, set, payload: IUniversalSearchAtomData) => {
    if (!Array.isArray(payload)) {
      throw new Error('buildBookmarkData: payload must be an array');
    }
    set(universalSearchAtom(), payload);
    void backgroundApiProxy.simpleDb.universalSearch.setRawData(payload);
  });

  addIntoRecentSearchList = contextAtomMethod(
    (get, set, payload: IIUniversalRecentSearchItem) => {
      const prev = get(universalSearchAtom());
      const newItems = prev.recentSearch.filter(
        (recentSearchItem) =>
          !!prev.recentSearch.find((i) => i.text === recentSearchItem.text),
      );
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
