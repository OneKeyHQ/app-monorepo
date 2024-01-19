import { memo, useEffect, useMemo } from 'react';

import { isNil, uniq } from 'lodash';

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

import { AccountSelectorJotaiProvider } from '../../states/jotai/contexts/accountSelector';

import { AccountSelectorEffects } from './AccountSelectorEffects';
import { accountSelectorStore } from './accountSelectorStore';

import type { IAccountSelectorContextData } from '../../states/jotai/contexts/accountSelector';

function AccountSelectorProviderCmp({
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
      {enabledNum.map((num) => (
        <AccountSelectorEffects key={num} num={Number(num)} />
      ))}
    </AccountSelectorJotaiProvider>
  );
}
const AccountSelectorProvider = memo(AccountSelectorProviderCmp);

function AccountSelectorProvidersAutoMountCmp() {
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
          <AccountSelectorProvider
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

export const AccountSelectorProvidersAutoMount = memo(
  AccountSelectorProvidersAutoMountCmp,
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
export function AccountSelectorProviderMirror({
  children,
  config,
  enabledNum,
}: {
  children?: any;
  config: IAccountSelectorContextData;
  enabledNum: number[];
}) {
  if (isNil(enabledNum)) {
    throw new Error(
      'AccountSelectorProviderMirror ERROR: enabledNum is required',
    );
  }
  const store = accountSelectorStore.getOrCreateStore({ config });
  return (
    <>
      <AccountSelectorMapTracker config={config} enabledNum={enabledNum} />
      <AccountSelectorJotaiProvider store={store} config={config}>
        {children}
      </AccountSelectorJotaiProvider>
    </>
  );
}
