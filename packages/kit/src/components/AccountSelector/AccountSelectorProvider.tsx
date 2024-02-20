import { memo, useEffect, useMemo } from 'react';

import { uniq } from 'lodash';

import type {
  IAccountSelectorMap,
  IAccountSelectorMapValue,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  getAccountSelectorTrackerMap,
  useAccountSelectorMapAtom,
  useAccountSelectorTrackerMap,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  AccountSelectorJotaiProvider,
  useAccountSelectorAvailableNetworksAtom,
} from '../../states/jotai/contexts/accountSelector';

import { AccountSelectorEffects } from './AccountSelectorEffects';
import { AccountSelectorStorageInit } from './AccountSelectorStorageInit';
import { AccountSelectorStorageReady } from './AccountSelectorStorageReady';
import { accountSelectorStore } from './accountSelectorStore';

import type {
  IAccountSelectorAvailableNetworksMap,
  IAccountSelectorContextData,
} from '../../states/jotai/contexts/accountSelector';

function AccountSelectorRootProviderCmp({
  enabledNumStr,
  sceneName,
  sceneUrl,
}: {
  enabledNumStr: string;
  sceneName: EAccountSelectorSceneName;
  sceneUrl?: string;
}) {
  const config = useMemo(
    () => ({ sceneName, sceneUrl }),
    [sceneName, sceneUrl],
  );
  const enabledNum = enabledNumStr.split(',');
  // const sceneId = accountUtils.buildAccountSelectorSceneId(config);
  const store = accountSelectorStore.getOrCreateStore({ config });
  useEffect(() => {
    console.log('AccountSelectorProvider mount');
    return () => {
      console.log('AccountSelectorProvider unmount');
      accountSelectorStore.removeStore({ config });
    };
  }, [config]);
  return (
    <AccountSelectorJotaiProvider store={store} config={config}>
      <AccountSelectorStorageInit />
      {enabledNum.map((num) => (
        <AccountSelectorEffects key={num} num={Number(num)} />
      ))}
    </AccountSelectorJotaiProvider>
  );
}
const AccountSelectorRootProvider = memo(AccountSelectorRootProviderCmp);

function AccountSelectorRootProvidersAutoMountCmp() {
  const [map] = useAccountSelectorMapAtom();
  const mapEntries = useMemo(() => Object.entries(map), [map]);
  // const mapEntries = [];
  if (process.env.NODE_ENV !== 'production') {
    console.log(
      'AccountSelectorProvidersAutoMount mapEntries:',
      mapEntries,
      getAccountSelectorTrackerMap(),
      global.$$accountSelectorStore,
    );
  }
  return (
    <>
      {mapEntries.map(([key, value]) => {
        const { sceneName, sceneUrl, enabledNum, count } = value;
        // const config = {
        //   sceneName,
        //   sceneUrl,
        // };
        if (count <= 0) {
          return null;
        }
        return (
          <AccountSelectorRootProvider
            key={key}
            sceneName={sceneName}
            sceneUrl={sceneUrl}
            enabledNumStr={enabledNum.join(',')}
          />
        );
      })}
    </>
  );
}

export const AccountSelectorRootProvidersAutoMount = memo(
  AccountSelectorRootProvidersAutoMountCmp,
);

function AccountSelectorMapTracker({
  config,
  enabledNum,
}: {
  config: IAccountSelectorContextData;
  enabledNum: number[];
}) {
  const { setMap } = useAccountSelectorTrackerMap();

  const { sceneName, sceneUrl } = config;
  const sceneId = accountUtils.buildAccountSelectorSceneId(config);

  useEffect(() => {
    const processMapCount = (action: 'add' | 'remove') => {
      const toMergeMap: IAccountSelectorMap = {};

      const mapCache = getAccountSelectorTrackerMap();

      const key = `${sceneId}`;
      let value: IAccountSelectorMapValue | undefined = mapCache[key];
      if (!value) {
        value = {
          sceneName,
          sceneUrl,
          enabledNum,
          count: 0,
        };
      }
      if (action === 'add') {
        value.count += 1;
        value.enabledNum = uniq([...value.enabledNum, ...enabledNum]).sort();
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
  }, [enabledNum, sceneId, sceneName, sceneUrl, setMap]);

  return null;
}

function AccountSelectorAvailableNetworksInit(props: {
  availableNetworksMap?: IAccountSelectorAvailableNetworksMap;
}) {
  const { availableNetworksMap } = props;
  const [, setMap] = useAccountSelectorAvailableNetworksAtom();
  useEffect(() => {
    if (availableNetworksMap) setMap(availableNetworksMap);
  }, [availableNetworksMap, setMap]);
  return null;
}
export function AccountSelectorProviderMirror({
  children,
  config,
  enabledNum,
  availableNetworksMap,
}: {
  children?: any;
  config: IAccountSelectorContextData;
  enabledNum: number[];
  availableNetworksMap?: IAccountSelectorAvailableNetworksMap;
}) {
  if (!enabledNum || enabledNum.length <= 0) {
    throw new Error(
      'AccountSelectorProviderMirror ERROR: enabledNum is required',
    );
  }
  const store = accountSelectorStore.getOrCreateStore({ config });
  return (
    <>
      <AccountSelectorMapTracker config={config} enabledNum={enabledNum} />
      <AccountSelectorJotaiProvider store={store} config={config}>
        <AccountSelectorStorageReady>
          <AccountSelectorAvailableNetworksInit
            availableNetworksMap={availableNetworksMap}
          />
          {children}
        </AccountSelectorStorageReady>
      </AccountSelectorJotaiProvider>
    </>
  );
}
