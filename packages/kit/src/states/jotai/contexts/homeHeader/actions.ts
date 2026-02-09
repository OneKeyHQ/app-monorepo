import { useRef } from 'react';

import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';

import type { IHomeHeaderData } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityHomePageData';

import { ContextJotaiActionsBase } from '../../utils/ContextJotaiActionsBase';

import { contextAtomMethod, homeHeaderDataAtom } from './atoms';

class ContextJotaiActionsHomeHeader extends ContextJotaiActionsBase {
  setHomeHeaderData = contextAtomMethod(
    (get, set, payload: IHomeHeaderData) => {
      set(homeHeaderDataAtom(), payload);
    },
  );

  setHomeHeaderRefreshing = contextAtomMethod(
    (get, set, payload: { isRefreshing: boolean }) => {
      set(homeHeaderDataAtom(), {
        ...get(homeHeaderDataAtom()),
        ...payload,
      });
    },
  );

  setHomeHeaderInitialized = contextAtomMethod(
    (get, set, payload: { initialized: boolean }) => {
      set(homeHeaderDataAtom(), {
        ...get(homeHeaderDataAtom()),
        ...payload,
      });
    },
  );
}

const createActions = memoFn(() => {
  return new ContextJotaiActionsHomeHeader();
});

export function useHomeHeaderActions() {
  const actions = createActions();
  const setHomeHeaderData = actions.setHomeHeaderData.use();
  const setHomeHeaderRefreshing = actions.setHomeHeaderRefreshing.use();
  const setHomeHeaderInitialized = actions.setHomeHeaderInitialized.use();

  return useRef({
    setHomeHeaderData,
    setHomeHeaderRefreshing,
    setHomeHeaderInitialized,
  });
}
