import { memo, useEffect, useMemo } from 'react';

import { uniq } from 'lodash';

import type {
  IJotaiContextStoreData,
  IJotaiContextStoreMap,
  IJotaiContextStoreMapValue,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  EJotaiContextStoreNames,
  getJotaiContextTrackerMap,
  useJotaiContextStoreMapAtom,
  useJotaiContextTrackerMap,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { AccountSelectorRootProvider } from '../../../components/AccountSelector/AccountSelectorRootProvider';
import { DiscoveryBrowserRootProvider } from '../../../views/Discovery/components/DiscoveryBrowserRootProvider';
import { HomeTokenListRootProvider } from '../../../views/Home/components/HomeTokenListRootProvider';

import { buildJotaiContextStoreId } from './jotaiContextStore';

// AccountSelectorMapTracker
export function JotaiContextStoreMirrorTracker(data: IJotaiContextStoreData) {
  const { storeName, accountSelectorInfo } = data;
  const { setMap } = useJotaiContextTrackerMap();
  const storeId = buildJotaiContextStoreId(data);
  useEffect(() => {
    const processMapCount = (action: 'add' | 'remove') => {
      const toMergeMap: IJotaiContextStoreMap = {};

      const mapCache = getJotaiContextTrackerMap();

      const key = `${storeId}`;
      let value: IJotaiContextStoreMapValue | undefined = mapCache[key];
      if (!value) {
        value = {
          storeName,
          accountSelectorInfo,
          count: 0,
        };
      }
      if (action === 'add') {
        value.count += 1;
        if (accountSelectorInfo && value.accountSelectorInfo) {
          value.accountSelectorInfo.enabledNum = uniq([
            ...value.accountSelectorInfo.enabledNum,
            ...accountSelectorInfo.enabledNum,
          ]).sort();
        }
      }
      if (action === 'remove') {
        value.count -= 1;
      }
      if (value.count <= 0) {
        delete mapCache[key];
      } else {
        toMergeMap[key] = value;
      }

      setMap({
        ...mapCache,
        ...toMergeMap,
      });
    };

    processMapCount('add');

    return () => {
      processMapCount('remove');
    };
  }, [accountSelectorInfo, setMap, storeId, storeName]);

  return null;
}

function JotaiContextRootProvidersAutoMountCmp() {
  const [map] = useJotaiContextStoreMapAtom();
  const mapEntries = useMemo(() => Object.entries(map), [map]);
  // const mapEntries = [];
  if (process.env.NODE_ENV !== 'production') {
    console.log(
      'JotaiContextRootProvidersAutoMount mapEntries:',
      mapEntries,
      getJotaiContextTrackerMap(),
      global.$$jotaiContextStore,
    );
  }
  return (
    <>
      {mapEntries.map(([key, value]) => {
        const { accountSelectorInfo, count, storeName } = value;
        // const config = {
        //   sceneName,
        //   sceneUrl,
        // };
        if (count <= 0) {
          return null;
        }

        switch (storeName) {
          case EJotaiContextStoreNames.accountSelector: {
            if (!accountSelectorInfo) {
              throw new Error(
                'JotaiContextRootProvidersAutoMount ERROR: accountSelectorInfo is required',
              );
            }
            const { sceneName, sceneUrl, enabledNum } = accountSelectorInfo;
            return (
              <AccountSelectorRootProvider
                key={key}
                sceneName={sceneName}
                sceneUrl={sceneUrl}
                enabledNumStr={enabledNum.join(',')}
              />
            );
          }
          case EJotaiContextStoreNames.homeTokenList: {
            return <HomeTokenListRootProvider key={key} />;
          }
          case EJotaiContextStoreNames.discoveryBrowser: {
            return <DiscoveryBrowserRootProvider key={key} />;
          }
          default: {
            const exhaustiveCheck: never = storeName;
            throw new Error(
              `Unhandled storeName case: ${exhaustiveCheck as string}`,
            );
          }
        }
      })}
    </>
  );
}

export const JotaiContextRootProvidersAutoMount = memo(
  JotaiContextRootProvidersAutoMountCmp,
);
