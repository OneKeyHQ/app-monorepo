import {
  type PropsWithChildren,
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';

import { ProviderJotaiContextTokenList } from '@onekeyhq/kit/src/states/jotai/contexts/tokenList/atoms';
import type { IJotaiContextStore } from '@onekeyhq/kit/src/states/jotai/utils/createJotaiContext';
import {
  getJotaiContextTrackerMap,
  useJotaiContextTrackerMap,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import {
  type IHomeTokenListDemandPriority,
  type IHomeTokenListDemandReason,
  type IHomeTokenListMode,
  getHomeTokenListStoreData,
  homeTokenListRuntime,
} from '../model/tokenList/homeTokenListRuntime';

export interface ITokenListStoreLeaseOptions {
  consumerId: string;
  demandPriority?: IHomeTokenListDemandPriority;
  demandReason?: IHomeTokenListDemandReason;
  mode: IHomeTokenListMode;
  ownerScopeKey: string;
}

function useTokenListBackgroundRegistration(mode: IHomeTokenListMode): void {
  const { setMap } = useJotaiContextTrackerMap();
  const setMapRef = useRef(setMap);
  const storeData = useMemo(() => getHomeTokenListStoreData(mode), [mode]);
  const storeId = homeTokenListRuntime.getStoreId(mode);
  useLayoutEffect(() => {
    setMapRef.current = setMap;
  }, [setMap]);
  useEffect(() => {
    const updateRegistration = (delta: 1 | -1) => {
      const current = getJotaiContextTrackerMap();
      const count = Math.max(0, (current[storeId]?.count ?? 0) + delta);
      const next = { ...current };
      if (count === 0) {
        delete next[storeId];
      } else {
        next[storeId] = {
          ...storeData,
          count,
        };
      }
      setMapRef.current(next);
    };
    updateRegistration(1);
    return () => updateRegistration(-1);
  }, [storeData, storeId]);
}

export function useTokenListStoreLease({
  consumerId,
  demandPriority = 'background',
  demandReason,
  mode,
  ownerScopeKey,
}: ITokenListStoreLeaseOptions): IJotaiContextStore {
  const store = useMemo(() => homeTokenListRuntime.getStore(mode), [mode]);
  useTokenListBackgroundRegistration(mode);
  useLayoutEffect(() => homeTokenListRuntime.retainStore(mode), [mode, store]);
  useEffect(() => {
    if (!demandReason) {
      return undefined;
    }
    return homeTokenListRuntime.acquireDemand({
      consumerId,
      ownerScopeKey,
      priority: demandPriority,
      reason: demandReason,
    });
  }, [consumerId, demandPriority, demandReason, mode, ownerScopeKey]);
  return store;
}

export const TokenListStoreProvider = memo(
  ({
    children,
    consumerId,
    demandPriority,
    demandReason,
    mode = 'wallet',
    ownerScopeKey,
  }: PropsWithChildren<
    Omit<ITokenListStoreLeaseOptions, 'mode'> & {
      mode?: IHomeTokenListMode;
    }
  >) => {
    const store = useTokenListStoreLease({
      consumerId,
      demandPriority,
      demandReason,
      mode,
      ownerScopeKey,
    });
    return (
      <ProviderJotaiContextTokenList store={store}>
        {children}
      </ProviderJotaiContextTokenList>
    );
  },
);
TokenListStoreProvider.displayName = 'TokenListStoreProvider';

export const TokenListBackgroundRootProvider = memo(
  ({ mode }: { mode: IHomeTokenListMode }) => (
    <ProviderJotaiContextTokenList
      store={homeTokenListRuntime.getStore(mode)}
    />
  ),
);
TokenListBackgroundRootProvider.displayName = 'TokenListBackgroundRootProvider';
