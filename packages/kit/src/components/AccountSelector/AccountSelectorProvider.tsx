import {
  type ReactNode,
  Suspense,
  lazy,
  memo,
  useEffect,
  useMemo,
} from 'react';

import { isEqual } from 'lodash';

import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms/jotaiContextStoreMap';
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  AccountSelectorJotaiProvider,
  activeAccountsAtom,
  selectedAccountsAtom,
  useAccountSelectorAvailableNetworksAtom,
} from '../../states/jotai/contexts/accountSelector/atoms';
import { jotaiContextStore } from '../../states/jotai/utils/jotaiContextStore';
import { JotaiContextStoreMirrorTracker } from '../../states/jotai/utils/JotaiContextStoreMirrorTracker';

import { AccountSelectorStorageReady } from './AccountSelectorStorageReady';

import type {
  IAccountSelectorAvailableNetworksMap,
  IAccountSelectorContextData,
  ISelectedAccountsAtomMap,
} from '../../states/jotai/contexts/accountSelector/atoms';

const AccountSelectorMirrorTracker = memo(JotaiContextStoreMirrorTracker);

const AccountSelectorProviderPerfDebug = lazy(async () => {
  const { AccountSelectorProviderPerfDebug: PerfDebug } =
    await import('./AccountSelectorProviderPerfDebug');
  return { default: PerfDebug };
});

const accountSelectorRenderBaselineGlobals = globalThis as typeof globalThis & {
  $$accountSelectorRenderBaselineMode?: boolean;
};

type IAccountSelectorE2EStateAccessor = {
  getSnapshot: (params: {
    num: number;
    sceneName: IAccountSelectorContextData['sceneName'];
    sceneUrl?: string;
  }) =>
    | {
        active:
          | {
              accountName: string;
              address: string | undefined;
              deriveType: string | undefined;
              indexedAccountId: string | undefined;
              networkId: string | undefined;
              ready: boolean;
              walletId: string | undefined;
            }
          | undefined;
        selected: ISelectedAccountsAtomMap[number] | undefined;
      }
    | undefined;
};

const accountSelectorE2EAppGlobals = appGlobals as typeof appGlobals & {
  $$accountSelectorE2EStateAccessor?: IAccountSelectorE2EStateAccessor;
};

if (platformEnv.isE2E) {
  accountSelectorE2EAppGlobals.$$accountSelectorE2EStateAccessor = {
    getSnapshot: ({ num, sceneName, sceneUrl }) => {
      const store = jotaiContextStore.getStore({
        storeName: EJotaiContextStoreNames.accountSelector,
        accountSelectorInfo: {
          enabledNum: [num],
          sceneName,
          sceneUrl,
        },
      });
      if (!store) {
        return undefined;
      }
      const selected = store.get(selectedAccountsAtom())[num];
      const active = store.get(activeAccountsAtom())[num];
      return {
        active: active
          ? {
              accountName: active.accountName,
              address: active.account?.address,
              deriveType: active.deriveType,
              indexedAccountId: active.indexedAccount?.id,
              networkId: active.network?.id,
              ready: active.ready,
              walletId: active.wallet?.id,
            }
          : undefined,
        selected,
      };
    },
  };
}

function AccountSelectorAvailableNetworksInit(props: {
  availableNetworksMap?: IAccountSelectorAvailableNetworksMap;
}) {
  const { availableNetworksMap } = props;
  const [, setMap] = useAccountSelectorAvailableNetworksAtom();
  useEffect(() => {
    if (availableNetworksMap) {
      setMap((current) =>
        isEqual(current, availableNetworksMap) ? current : availableNetworksMap,
      );
    }
  }, [availableNetworksMap, setMap]);
  return null;
}
export function AccountSelectorProviderMirror({
  children,
  config,
  enabledNum,
  availableNetworksMap,
  perfDebugName,
  storageReadyFallback,
  waitForStorageReady,
}: {
  children?: ReactNode;
  config: IAccountSelectorContextData;
  enabledNum: number[];
  availableNetworksMap?: IAccountSelectorAvailableNetworksMap;
  perfDebugName?: string;
  storageReadyFallback?: ReactNode;
  waitForStorageReady?: boolean;
}) {
  if (!enabledNum || enabledNum.length <= 0) {
    throw new OneKeyLocalError(
      'AccountSelectorProviderMirror ERROR: enabledNum is required',
    );
  }

  const stableConfig = useMemo(
    () => ({
      sceneName: config.sceneName,
      sceneUrl: config.sceneUrl,
    }),
    [config.sceneName, config.sceneUrl],
  );
  const enabledNumKey = [...new Set(enabledNum)]
    .toSorted((a, b) => a - b)
    .join(',');
  const stableEnabledNum = useMemo(
    () => enabledNumKey.split(',').map(Number),
    [enabledNumKey],
  );

  const data = useMemo(
    () => ({
      storeName: EJotaiContextStoreNames.accountSelector,
      accountSelectorInfo: {
        sceneName: config.sceneName,
        sceneUrl: config.sceneUrl,
        enabledNum: stableEnabledNum,
      },
    }),
    [config.sceneName, config.sceneUrl, stableEnabledNum],
  );
  const store = jotaiContextStore.getOrCreateStore(data);
  const providerContent = (
    <AccountSelectorJotaiProvider store={store} config={stableConfig}>
      <AccountSelectorStorageReady
        fallback={storageReadyFallback}
        waitForStorageReady={waitForStorageReady}
      >
        <AccountSelectorAvailableNetworksInit
          availableNetworksMap={availableNetworksMap}
        />
        {children}
      </AccountSelectorStorageReady>
    </AccountSelectorJotaiProvider>
  );

  if (
    perfDebugName &&
    (platformEnv.isDev || platformEnv.isE2E) &&
    !accountSelectorRenderBaselineGlobals.$$accountSelectorRenderBaselineMode
  ) {
    return (
      <Suspense fallback={null}>
        <AccountSelectorProviderPerfDebug
          data={data}
          enabledNumKey={enabledNumKey}
          perfDebugName={perfDebugName}
          sceneName={stableConfig.sceneName}
          stableEnabledNum={stableEnabledNum}
          store={store}
        >
          {providerContent}
        </AccountSelectorProviderPerfDebug>
      </Suspense>
    );
  }

  return (
    <>
      <AccountSelectorMirrorTracker {...data} />
      {providerContent}
    </>
  );
}
