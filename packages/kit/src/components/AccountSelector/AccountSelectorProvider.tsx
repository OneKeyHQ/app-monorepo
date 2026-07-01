import { useEffect, useMemo } from 'react';

import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms/jotaiContextStoreMap';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  AccountSelectorJotaiProvider,
  useAccountSelectorAvailableNetworksAtom,
} from '../../states/jotai/contexts/accountSelector/atoms';
import { jotaiContextStore } from '../../states/jotai/utils/jotaiContextStore';
import { JotaiContextStoreMirrorTracker } from '../../states/jotai/utils/JotaiContextStoreMirrorTracker';

import { AccountSelectorStorageReady } from './AccountSelectorStorageReady';

import type {
  IAccountSelectorAvailableNetworksMap,
  IAccountSelectorContextData,
} from '../../states/jotai/contexts/accountSelector/atoms';

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
  waitForStorageReady,
}: {
  children?: any;
  config: IAccountSelectorContextData;
  enabledNum: number[];
  availableNetworksMap?: IAccountSelectorAvailableNetworksMap;
  waitForStorageReady?: boolean;
}) {
  if (!enabledNum || enabledNum.length <= 0) {
    throw new OneKeyLocalError(
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
        <AccountSelectorStorageReady waitForStorageReady={waitForStorageReady}>
          <AccountSelectorAvailableNetworksInit
            availableNetworksMap={availableNetworksMap}
          />
          {children}
        </AccountSelectorStorageReady>
      </AccountSelectorJotaiProvider>
    </>
  );
}
