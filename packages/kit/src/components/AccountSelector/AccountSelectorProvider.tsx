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
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

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

const AccountSelectorMirrorTracker = memo(JotaiContextStoreMirrorTracker);

const AccountSelectorProviderPerfDebug = lazy(async () => {
  const { AccountSelectorProviderPerfDebug: PerfDebug } =
    await import('./AccountSelectorProviderPerfDebug');
  return { default: PerfDebug };
});

const AccountSelectorE2EContextProbe = lazy(
  () => import('./AccountSelectorE2EContextProbe'),
);

const accountSelectorRenderBaselineGlobals = globalThis as typeof globalThis & {
  $$accountSelectorRenderBaselineMode?: boolean;
};

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
  e2eContextProbeName,
  availableNetworksMap,
  perfDebugName,
  storageReadyFallback,
  waitForStorageReady,
}: {
  children?: ReactNode;
  config: IAccountSelectorContextData;
  enabledNum: number[];
  e2eContextProbeName?: string;
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
  const shouldLoadE2EContextProbe =
    process.env.NODE_ENV !== 'production' &&
    platformEnv.isWeb &&
    (platformEnv.isDev || platformEnv.isE2E) &&
    !accountSelectorRenderBaselineGlobals.$$accountSelectorRenderBaselineMode;
  const providerContent = (
    <AccountSelectorJotaiProvider store={store} config={stableConfig}>
      {shouldLoadE2EContextProbe ? (
        <Suspense fallback={null}>
          <AccountSelectorE2EContextProbe
            enabledNum={stableEnabledNum}
            expectedConfig={stableConfig}
            expectedStore={store}
            perfDebugName={perfDebugName}
            probeName={
              e2eContextProbeName ??
              perfDebugName ??
              `${stableConfig.sceneName}:${stableConfig.sceneUrl || 'default'}`
            }
          />
        </Suspense>
      ) : null}
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
