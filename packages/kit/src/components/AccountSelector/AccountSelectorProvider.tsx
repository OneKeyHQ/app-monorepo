import { useEffect, useMemo } from 'react';

import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import {
  AccountSelectorJotaiProvider,
  useAccountSelectorAvailableNetworksAtom,
} from '../../states/jotai/contexts/accountSelector';
import { jotaiContextStore } from '../../states/jotai/utils/jotaiContextStore';
import { JotaiContextStoreMirrorTracker } from '../../states/jotai/utils/JotaiContextStoreMirrorTracker';

import { AccountSelectorStorageReady } from './AccountSelectorStorageReady';

import type {
  IAccountSelectorAvailableNetworksMap,
  IAccountSelectorContextData,
} from '../../states/jotai/contexts/accountSelector';

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

  const data = useMemo(
    () => ({
      storeName: EJotaiContextStoreNames.accountSelector,
      accountSelectorInfo: {
        sceneName: config.sceneName,
        sceneUrl: config.sceneUrl,
        enabledNum,
      },
    }),
    [config.sceneName, config.sceneUrl, enabledNum],
  );
  const store = jotaiContextStore.getOrCreateStore(data);

  return (
    <>
      <JotaiContextStoreMirrorTracker {...data} />
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
