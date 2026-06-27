import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { isNil } from 'lodash';
import { useIntl } from 'react-intl';

import { useIsOverlayPage } from '@onekeyhq/components';
import {
  EJotaiContextStoreNames,
  useInAppNotificationAtom,
  useSwapFromMarketJumpTokenAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import {
  buildUnifiedSwapProviderManagers,
  canUseUnifiedSwapProviderManagers,
} from '@onekeyhq/shared/src/utils/swapProviderManagerUtils';
import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import { swapDefaultSetTokens } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import type {
  ISwapInitParams,
  ISwapNetwork,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';
import {
  ESwapDirectionType,
  ESwapLimitOrderExpiryStep,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useListenTabFocusState from '../../../hooks/useListenTabFocusState';
import {
  selectedAccountsAtom,
  useAccountSelectorActions,
  useActiveAccount,
  useSelectedAccount,
} from '../../../states/jotai/contexts/accountSelector';
import {
  useSwapActions,
  useSwapFromTokenAmountAtom,
  useSwapInitialSelectedTokensSyncedAtom,
  useSwapMevConfigAtom,
  useSwapNativeTokenReserveGasAtom,
  useSwapNetworksAtom,
  useSwapSelectFromTokenAtom,
  useSwapSelectToTokenAtom,
  useSwapSelectedTokensColdStartContextAtom,
  useSwapTipsAtom,
  useSwapToTokenAmountAtom,
  useSwapTypeSwitchAtom,
} from '../../../states/jotai/contexts/swap';
import { jotaiContextStore } from '../../../states/jotai/utils/jotaiContextStore';
import {
  SWAP_COLD_START_HOME_SCENE_NAME,
  buildSwapInitParamsConsumptionKey,
  buildSwapSelectedAccountSyncedFromHome,
  buildSwapSelectedTokensColdStartContext,
  getSelectedTokensColdStartChannelSupport,
  getSwapDefaultToTokenForSwapType,
  getSwapSelectedTokensColdStartContextNetworkId,
  getSwapSelectedTokensHomeAccountSyncAction,
  isSwapColdStartAllNetworkContextNetworkId,
  isSwapSelectedTokensColdStartContextMatched,
  shouldMarkSwapInitialSelectedTokensSynced,
  shouldPreserveSwapUserInputAmountOnAccountSwitch,
  shouldPreserveSwapUserInputOnAccountSwitch,
  shouldSkipSwapDefaultSelectedTokenSync,
  shouldSyncSwapSelectedAccountOnHomeAccountUpdate,
} from '../utils/swapColdStartTokenCacheUtils';
import {
  canUseSwapNetworkCacheAsSortSource,
  isSwapNetworkCacheCompatible,
  isSwapNetworkCacheReadyForBasicList,
  mergeSwapNetworksWithCachedSort,
} from '../utils/swapNetworkCacheUtils';
import {
  getSwapNetworkSupportTabSwitchTypes,
  getSwapSupportCheckType,
  getVisibleSwapTabSwitchType,
  getVisibleSwapTabSwitchUpdate,
} from '../utils/swapTypeUtils';

import { useSwapAddressInfo } from './useSwapAccount';
import { useSwapProInputToken } from './useSwapPro';

const SWAP_NETWORK_SCHEMA_RETRY_DELAY = 30_000;

function getSelectedTokensColdStartSwapType({
  currentSwapType,
  fromToken,
  toToken,
}: {
  currentSwapType: ESwapTabSwitchType;
  fromToken?: ISwapToken;
  toToken?: ISwapToken;
}) {
  if (
    fromToken?.networkId &&
    toToken?.networkId &&
    fromToken.networkId !== toToken.networkId
  ) {
    return ESwapTabSwitchType.BRIDGE;
  }

  return currentSwapType;
}

function getHomeSelectedAccountFromContextStore() {
  const homeAccountSelectorStore = jotaiContextStore.getStore({
    storeName: EJotaiContextStoreNames.accountSelector,
    accountSelectorInfo: {
      sceneName: SWAP_COLD_START_HOME_SCENE_NAME,
      sceneUrl: '',
      enabledNum: [0],
    },
  });
  return homeAccountSelectorStore?.get(selectedAccountsAtom())?.[0];
}

async function getLatestHomeSelectedAccount() {
  const homeSelectedAccountFromStore = getHomeSelectedAccountFromContextStore();
  if (homeSelectedAccountFromStore) {
    return homeSelectedAccountFromStore;
  }

  return backgroundApiProxy.simpleDb.accountSelector.getSelectedAccount({
    sceneName: SWAP_COLD_START_HOME_SCENE_NAME,
    num: 0,
  });
}

/**
 * Initializes and manages state and side effects for the token swap feature, including networks, tokens, providers, and related UI state.
 *
 * This hook synchronizes swap networks, selected tokens, provider managers, MEV configuration, and swap tips by integrating with background APIs, local storage, and global state atoms. It handles data fetching, caching, and updates in response to parameter changes and app lifecycle events.
 *
 * @param params - Optional parameters for initializing swap state, such as imported tokens or network IDs
 * @returns An object containing `fetchLoading`, indicating whether the swap network list is currently loading
 */
export function useSwapInit(params?: ISwapInitParams) {
  const [swapNetworks, setSwapNetworks] = useSwapNetworksAtom();
  const [swapFromToken, setSwapFromToken] = useSwapSelectFromTokenAtom();
  const swapProFromToken = useSwapProInputToken();
  const [toToken, setToToken] = useSwapSelectToTokenAtom();
  const { activeAccount: swapActiveAccount } = useActiveAccount({ num: 0 });
  const { selectedAccount: swapSelectedAccount } = useSelectedAccount({
    num: 0,
  });
  const [, setSwapMevConfig] = useSwapMevConfigAtom();
  const {
    syncNetworksSort,
    needChangeToken,
    selectToToken,
    selectFromToken,
    resetSwapTokenData,
    swapTypeSwitchAction,
  } = useSwapActions().current;
  const swapAddressInfo = useSwapAddressInfo(ESwapDirectionType.FROM);
  const { updateSelectedAccountNetwork, updateSelectedAccount } =
    useAccountSelectorActions().current;
  const [networkListFetching, setNetworkListFetching] = useState<boolean>(true);
  const [skipSyncDefaultSelectedToken, setSkipSyncDefaultSelectedToken] =
    useState<boolean>(false);
  const normalizedSwapTabSwitchType = getVisibleSwapTabSwitchType(
    params?.swapTabSwitchType,
  );
  const supportCheckSwapTabSwitchType = getSwapSupportCheckType(
    params?.swapTabSwitchType,
  );
  const swapInitParamsConsumptionKey =
    buildSwapInitParamsConsumptionKey(params);
  const swapAddressInfoRef =
    useRef<ReturnType<typeof useSwapAddressInfo>>(undefined);
  const [, setInAppNotification] = useInAppNotificationAtom();
  const [swapTypeSwitch] = useSwapTypeSwitchAtom();
  const [fromTokenAmount, setFromTokenAmount] = useSwapFromTokenAmountAtom();
  const [toTokenAmount, setToTokenAmount] = useSwapToTokenAmountAtom();
  const [, setSwapNativeTokenReserveGas] = useSwapNativeTokenReserveGasAtom();
  const [, setSwapTips] = useSwapTipsAtom();
  const [selectedTokensColdStartContext, setSelectedTokensColdStartContext] =
    useSwapSelectedTokensColdStartContextAtom();
  const [initialSelectedTokensSynced, setInitialSelectedTokensSynced] =
    useSwapInitialSelectedTokensSyncedAtom();
  const fromToken = useMemo(() => {
    if (platformEnv.isNative && swapTypeSwitch === ESwapTabSwitchType.LIMIT) {
      return swapProFromToken;
    }
    return swapFromToken;
  }, [swapProFromToken, swapTypeSwitch, swapFromToken]);
  const swapTypeSwitchRef = useRef(swapTypeSwitch);
  if (swapTypeSwitchRef.current !== swapTypeSwitch) {
    swapTypeSwitchRef.current = swapTypeSwitch;
  }
  const focusSwapPro = useMemo(() => {
    return platformEnv.isNative && swapTypeSwitch === ESwapTabSwitchType.LIMIT;
  }, [swapTypeSwitch]);
  if (swapAddressInfoRef.current !== swapAddressInfo) {
    swapAddressInfoRef.current = swapAddressInfo;
  }
  const swapActiveAccountRef =
    useRef<typeof swapActiveAccount>(swapActiveAccount);
  if (swapActiveAccountRef.current !== swapActiveAccount) {
    swapActiveAccountRef.current = swapActiveAccount;
  }
  const swapSelectedAccountRef = useRef(swapSelectedAccount);
  if (swapSelectedAccountRef.current !== swapSelectedAccount) {
    swapSelectedAccountRef.current = swapSelectedAccount;
  }
  const selectedTokensColdStartContextRef = useRef(
    selectedTokensColdStartContext,
  );
  if (
    selectedTokensColdStartContextRef.current !== selectedTokensColdStartContext
  ) {
    selectedTokensColdStartContextRef.current = selectedTokensColdStartContext;
  }
  const initialSelectedTokensSyncedRef = useRef(initialSelectedTokensSynced);
  if (initialSelectedTokensSyncedRef.current !== initialSelectedTokensSynced) {
    initialSelectedTokensSyncedRef.current = initialSelectedTokensSynced;
  }
  const swapNetworksRef = useRef<ISwapNetwork[]>([]);
  if (swapNetworksRef.current !== swapNetworks) {
    swapNetworksRef.current = swapNetworks;
  }
  const fromTokenRef = useRef<ISwapToken>(undefined);
  if (fromTokenRef.current !== swapFromToken) {
    fromTokenRef.current = swapFromToken;
  }
  const toTokenRef = useRef<ISwapToken>(undefined);
  if (toTokenRef.current !== toToken) {
    toTokenRef.current = toToken;
  }
  const selectedTokensRuntimeChannelSupport = useMemo(
    () =>
      getSelectedTokensColdStartChannelSupport({
        swapType: swapTypeSwitch,
        fromToken: swapFromToken,
        toToken,
        swapNetworks,
      }),
    [swapFromToken, swapTypeSwitch, swapNetworks, toToken],
  );
  const fromTokenAmountRef = useRef<{ value: string; isInput: boolean }>(
    fromTokenAmount,
  );
  if (
    fromTokenAmountRef.current?.value !== fromTokenAmount?.value ||
    fromTokenAmountRef.current?.isInput !== fromTokenAmount?.isInput
  ) {
    fromTokenAmountRef.current = fromTokenAmount;
  }
  const toTokenAmountRef = useRef<{ value: string; isInput: boolean }>(
    toTokenAmount,
  );
  if (
    toTokenAmountRef.current?.value !== toTokenAmount?.value ||
    toTokenAmountRef.current?.isInput !== toTokenAmount?.isInput
  ) {
    toTokenAmountRef.current = toTokenAmount;
  }
  const hasRefreshedSwapNetworksRef = useRef(false);
  const refreshSwapNetworksPromiseRef = useRef<Promise<void> | undefined>(
    undefined,
  );
  const hasSyncedSwapSelectedAccountFromHomeStorageRef = useRef(false);
  const consumedSwapInitParamsKeyRef = useRef<string | undefined>(undefined);
  const markSwapInitParamsConsumed = useCallback(() => {
    if (swapInitParamsConsumptionKey) {
      consumedSwapInitParamsKeyRef.current = swapInitParamsConsumptionKey;
    }
  }, [swapInitParamsConsumptionKey]);
  const shouldPreserveUserInputAmount = useCallback(() => {
    const hasImportParams = Boolean(
      params?.importFromToken ||
      params?.importToToken ||
      params?.importNetworkId,
    );
    return shouldPreserveSwapUserInputAmountOnAccountSwitch({
      fromTokenAmount: fromTokenAmountRef.current,
      hasImportParams,
      toTokenAmount: toTokenAmountRef.current,
    });
  }, [params?.importFromToken, params?.importNetworkId, params?.importToToken]);

  const shouldPreserveUserInputSelectedTokens = useCallback(() => {
    const hasImportParams = Boolean(
      params?.importFromToken ||
      params?.importToToken ||
      params?.importNetworkId,
    );
    const hasSelectedTokens = Boolean(
      fromTokenRef.current || toTokenRef.current,
    );
    return shouldPreserveSwapUserInputOnAccountSwitch({
      fromTokenAmount: fromTokenAmountRef.current,
      hasImportParams,
      hasSelectedTokens,
      toTokenAmount: toTokenAmountRef.current,
    });
  }, [params?.importFromToken, params?.importNetworkId, params?.importToToken]);

  const getCurrentSelectedTokensColdStartContext = useCallback(
    () =>
      buildSwapSelectedTokensColdStartContext({
        activeAccount: swapActiveAccountRef.current,
        networkId: getSwapSelectedTokensColdStartContextNetworkId({
          accountNetworkId: swapActiveAccountRef.current?.network?.id,
          fromTokenNetworkId: fromTokenRef.current?.networkId,
        }),
        swapType: getSelectedTokensColdStartSwapType({
          currentSwapType: swapTypeSwitchRef.current,
          fromToken: fromTokenRef.current,
          toToken: toTokenRef.current,
        }),
      }),
    [],
  );

  const syncSelectedTokensColdStartSwapType = useCallback(() => {
    const nextSwapType = getSelectedTokensColdStartSwapType({
      currentSwapType: swapTypeSwitchRef.current,
      fromToken: fromTokenRef.current,
      toToken: toTokenRef.current,
    });
    const { nextVisibleSwapType, shouldUpdate } = getVisibleSwapTabSwitchUpdate(
      {
        currentSwapType: swapTypeSwitchRef.current,
        nextSwapType,
      },
    );
    if (!shouldUpdate) {
      return;
    }
    swapTypeSwitchRef.current = nextVisibleSwapType;
    void swapTypeSwitchAction(
      nextVisibleSwapType,
      fromTokenRef.current?.networkId,
    );
  }, [swapTypeSwitchAction]);

  const switchSwapTypeIfNeeded = useCallback(
    (nextSwapType: ESwapTabSwitchType, networkId?: string) => {
      const { nextVisibleSwapType, shouldUpdate } =
        getVisibleSwapTabSwitchUpdate({
          currentSwapType: swapTypeSwitchRef.current,
          nextSwapType,
        });
      if (!shouldUpdate) {
        return;
      }
      swapTypeSwitchRef.current = nextVisibleSwapType;
      void swapTypeSwitchAction(nextVisibleSwapType, networkId);
    },
    [swapTypeSwitchAction],
  );

  const validateSelectedTokensColdStartContext = useCallback(() => {
    if (!fromTokenRef.current && !toTokenRef.current) {
      return true;
    }

    const currentContext = getCurrentSelectedTokensColdStartContext();
    if (!currentContext) {
      return undefined;
    }

    return isSwapSelectedTokensColdStartContextMatched({
      cachedContext: selectedTokensColdStartContextRef.current,
      currentContext,
    });
  }, [getCurrentSelectedTokensColdStartContext]);

  const updateSelectedTokensColdStartContext = useCallback(() => {
    const currentContext = getCurrentSelectedTokensColdStartContext();
    if (!currentContext) {
      return;
    }
    // In all-network mode the context network is the `onekeyall--*` sentinel while
    // the from-token carries a concrete chain id, so they never match exactly.
    // Skipping the equality guard here lets the context persist; otherwise the
    // all-network cold-start cache would be dropped on the next launch. Same rule
    // is mirrored in normalizeSwapColdStartCacheSnapshot.
    if (
      !isSwapColdStartAllNetworkContextNetworkId(currentContext.networkId) &&
      fromTokenRef.current?.networkId !== currentContext.networkId
    ) {
      return;
    }

    const cachedContext = selectedTokensColdStartContextRef.current;
    if (
      cachedContext?.accountKey === currentContext.accountKey &&
      cachedContext?.networkId === currentContext.networkId &&
      cachedContext?.swapType === currentContext.swapType
    ) {
      return;
    }

    selectedTokensColdStartContextRef.current = currentContext;
    setSelectedTokensColdStartContext(currentContext);
  }, [
    getCurrentSelectedTokensColdStartContext,
    setSelectedTokensColdStartContext,
  ]);

  const clearSelectedTokensColdStartCache = useCallback(
    ({
      resetSwapType = false,
    }: {
      resetSwapType?: boolean;
    } = {}) => {
      fromTokenRef.current = undefined;
      toTokenRef.current = undefined;
      void resetSwapTokenData(ESwapDirectionType.FROM);
      void resetSwapTokenData(ESwapDirectionType.TO);
      setSelectedTokensColdStartContext(undefined);
      if (resetSwapType) {
        switchSwapTypeIfNeeded(
          params?.swapTabSwitchType ?? ESwapTabSwitchType.SWAP,
        );
      }
    },
    [
      params?.swapTabSwitchType,
      resetSwapTokenData,
      setSelectedTokensColdStartContext,
      switchSwapTypeIfNeeded,
    ],
  );

  const markInitialSelectedTokensSynced = useCallback(() => {
    if (initialSelectedTokensSyncedRef.current) {
      return;
    }
    initialSelectedTokensSyncedRef.current = true;
    setInitialSelectedTokensSynced(true);
  }, [setInitialSelectedTokensSynced]);

  const finishSwapInitParamsSync = useCallback(() => {
    markSwapInitParamsConsumed();
    markInitialSelectedTokensSynced();
  }, [markInitialSelectedTokensSynced, markSwapInitParamsConsumed]);

  const syncSwapSelectedAccountFromHome = useCallback(
    async (
      homeSelectedAccount?: Parameters<
        typeof shouldSyncSwapSelectedAccountOnHomeAccountUpdate
      >[0]['eventPayload']['selectedAccount'],
    ) => {
      if (!homeSelectedAccount) {
        return { synced: false as const };
      }

      const eventPayload = {
        sceneName: SWAP_COLD_START_HOME_SCENE_NAME,
        num: 0,
        selectedAccount: homeSelectedAccount,
      };
      const hasSelectedTokens = Boolean(
        fromTokenRef.current || toTokenRef.current,
      );
      if (
        !shouldSyncSwapSelectedAccountOnHomeAccountUpdate({
          cachedContext: selectedTokensColdStartContextRef.current,
          eventPayload,
          hasSelectedTokens,
          initialSelectedTokensSynced: initialSelectedTokensSyncedRef.current,
          swapActiveNetworkId: swapActiveAccountRef.current?.network?.id,
          swapSelectedAccount: swapSelectedAccountRef.current,
        })
      ) {
        return { synced: false as const };
      }

      let clearedSelectedTokens = false;
      const selectedTokensSyncAction =
        getSwapSelectedTokensHomeAccountSyncAction({
          cachedContext: selectedTokensColdStartContextRef.current,
          hasSelectedTokens,
          homeSelectedAccount,
          initialSelectedTokensSynced: initialSelectedTokensSyncedRef.current,
          preserveSelectedTokens: shouldPreserveUserInputAmount(),
          swapSelectedAccount: swapSelectedAccountRef.current,
          swapType: swapTypeSwitchRef.current,
        });
      if (selectedTokensSyncAction.type === 'replace-with-defaults') {
        const { defaultTokens } = selectedTokensSyncAction;
        fromTokenRef.current = defaultTokens.fromToken;
        toTokenRef.current = defaultTokens.toToken;
        selectedTokensColdStartContextRef.current = defaultTokens.context;
        setSwapFromToken(defaultTokens.fromToken);
        setToToken(defaultTokens.toToken);
        setSelectedTokensColdStartContext(defaultTokens.context);
        switchSwapTypeIfNeeded(
          defaultTokens.swapType,
          defaultTokens.fromToken?.networkId ??
            defaultTokens.toToken?.networkId,
        );
      } else if (selectedTokensSyncAction.type === 'clear') {
        clearedSelectedTokens = true;
        const homeNetworkDefaultTokens = homeSelectedAccount.networkId
          ? swapDefaultSetTokens[homeSelectedAccount.networkId]
          : undefined;
        const shouldPreserveLimitTabWithoutDefaultTokens =
          swapTypeSwitchRef.current === ESwapTabSwitchType.LIMIT &&
          !homeNetworkDefaultTokens?.limitFromToken &&
          !homeNetworkDefaultTokens?.limitToToken;
        clearSelectedTokensColdStartCache({
          resetSwapType: !shouldPreserveLimitTabWithoutDefaultTokens,
        });
      }
      await updateSelectedAccount({
        updateMeta: {
          eventEmitDisabled: true,
          updatedAt: Date.now(),
        },
        num: 0,
        builder: (currentSelectedAccount) =>
          buildSwapSelectedAccountSyncedFromHome({
            homeSelectedAccount,
            swapSelectedAccount: currentSelectedAccount,
          }),
      });
      return {
        synced: true as const,
        clearedSelectedTokens,
        homeSelectedAccount,
      };
    },
    [
      clearSelectedTokensColdStartCache,
      shouldPreserveUserInputAmount,
      setSelectedTokensColdStartContext,
      setSwapFromToken,
      setToToken,
      switchSwapTypeIfNeeded,
      updateSelectedAccount,
    ],
  );

  const syncSwapSelectedAccountFromLatestHome = useCallback(async () => {
    const homeSelectedAccount = await getLatestHomeSelectedAccount();
    return syncSwapSelectedAccountFromHome(homeSelectedAccount);
  }, [syncSwapSelectedAccountFromHome]);

  const syncSwapSelectedAccountFromHomeStoragePromiseRef = useRef<
    ReturnType<typeof syncSwapSelectedAccountFromLatestHome> | undefined
  >(undefined);

  const syncSwapSelectedAccountFromLatestHomeStorage = useCallback(async () => {
    if (syncSwapSelectedAccountFromHomeStoragePromiseRef.current) {
      return syncSwapSelectedAccountFromHomeStoragePromiseRef.current;
    }

    const promise = syncSwapSelectedAccountFromLatestHome().finally(() => {
      hasSyncedSwapSelectedAccountFromHomeStorageRef.current = true;
      syncSwapSelectedAccountFromHomeStoragePromiseRef.current = undefined;
    });
    syncSwapSelectedAccountFromHomeStoragePromiseRef.current = promise;
    return promise;
  }, [syncSwapSelectedAccountFromLatestHome]);

  useEffect(() => {
    const handleAccountSelectorSelectedAccountUpdate = (
      eventPayload: Parameters<
        typeof shouldSyncSwapSelectedAccountOnHomeAccountUpdate
      >[0]['eventPayload'],
    ) => {
      if (
        eventPayload.sceneName !== SWAP_COLD_START_HOME_SCENE_NAME ||
        eventPayload.num !== 0
      ) {
        return;
      }
      void syncSwapSelectedAccountFromHome(eventPayload.selectedAccount).then(
        (result) => {
          if (!result.synced) {
            return;
          }
          const homeNetworkDefaultTokens = result.homeSelectedAccount.networkId
            ? swapDefaultSetTokens[result.homeSelectedAccount.networkId]
            : undefined;
          if (
            result.clearedSelectedTokens &&
            swapTypeSwitchRef.current === ESwapTabSwitchType.LIMIT &&
            !homeNetworkDefaultTokens?.limitFromToken &&
            !homeNetworkDefaultTokens?.limitToToken
          ) {
            markInitialSelectedTokensSynced();
          }
        },
      );
    };

    appEventBus.on(
      EAppEventBusNames.AccountSelectorSelectedAccountUpdate,
      handleAccountSelectorSelectedAccountUpdate,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.AccountSelectorSelectedAccountUpdate,
        handleAccountSelectorSelectedAccountUpdate,
      );
    };
  }, [markInitialSelectedTokensSynced, syncSwapSelectedAccountFromHome]);

  useEffect(() => {
    if (hasSyncedSwapSelectedAccountFromHomeStorageRef.current) {
      return;
    }
    void syncSwapSelectedAccountFromLatestHomeStorage();
  }, [syncSwapSelectedAccountFromLatestHomeStorage]);

  const fetchSwapNetworks = useCallback(async () => {
    const currentSwapNetworks = swapNetworksRef.current;
    if (currentSwapNetworks.length) {
      if (isSwapNetworkCacheCompatible(currentSwapNetworks)) {
        setNetworkListFetching(false);
        if (hasRefreshedSwapNetworksRef.current) {
          return;
        }
      } else {
        setNetworkListFetching(
          !isSwapNetworkCacheReadyForBasicList(currentSwapNetworks),
        );
      }
    }

    if (refreshSwapNetworksPromiseRef.current) {
      await refreshSwapNetworksPromiseRef.current;
      return;
    }

    const refreshPromise = (async () => {
      let swapNetworksSortList =
        await backgroundApiProxy.simpleDb.swapNetworksSort.getRawData();
      if (swapNetworksSortList?.data?.length) {
        const cachedSwapNetworks = swapNetworksSortList.data;
        const canUseCachedSwapNetworks =
          isSwapNetworkCacheCompatible(cachedSwapNetworks);
        if (canUseCachedSwapNetworks) {
          setSwapNetworks(cachedSwapNetworks);
          setNetworkListFetching(false);
        } else if (isSwapNetworkCacheReadyForBasicList(cachedSwapNetworks)) {
          setSwapNetworks(cachedSwapNetworks);
          setNetworkListFetching(false);
        } else if (!canUseSwapNetworkCacheAsSortSource(cachedSwapNetworks)) {
          await backgroundApiProxy.simpleDb.swapNetworksSort.setRawData({
            data: [],
          });
          swapNetworksSortList = null;
        }
      }

      // Older network caches can preserve user sorting, but selector state needs
      // the refreshed schema, especially backendIndex.
      let networks: ISwapNetwork[] = [];
      try {
        const fetchNetworks =
          await backgroundApiProxy.serviceSwap.fetchSwapNetworks({
            refreshClientNetworks: true,
          });
        networks = [...fetchNetworks];
        if (swapNetworksSortList?.data?.length && fetchNetworks?.length) {
          networks = mergeSwapNetworksWithCachedSort({
            cachedNetworks: swapNetworksSortList.data,
            fetchedNetworks: fetchNetworks,
          });
        }
        if (networks.length) {
          await backgroundApiProxy.simpleDb.swapNetworksSort.setRawData({
            data: networks,
          });
          setSwapNetworks(networks);
          hasRefreshedSwapNetworksRef.current =
            isSwapNetworkCacheCompatible(networks);
        }
      } catch {
        // The background method shows its own toast. Keep cached networks usable.
      } finally {
        setNetworkListFetching(false);
      }
    })().finally(() => {
      refreshSwapNetworksPromiseRef.current = undefined;
    });

    refreshSwapNetworksPromiseRef.current = refreshPromise;
    await refreshPromise;
  }, [setSwapNetworks]);

  useEffect(() => {
    if (!swapNetworks.length || isSwapNetworkCacheCompatible(swapNetworks)) {
      return;
    }

    const timer = setTimeout(() => {
      void fetchSwapNetworks();
    }, SWAP_NETWORK_SCHEMA_RETRY_DELAY);

    return () => clearTimeout(timer);
  }, [fetchSwapNetworks, swapNetworks]);

  const fetchSyncSwapProviderManager = useCallback(
    async (noFetch?: boolean) => {
      const swapProviderManagerSimpleDb =
        await backgroundApiProxy.simpleDb.swapConfigs.getSwapProviderManager();
      const bridgeProviderManagerSimpleDb =
        await backgroundApiProxy.simpleDb.swapConfigs.getBridgeProviderManager();
      const setProviderManagersFromCache = () => {
        setInAppNotification((pre) => ({
          ...pre,
          swapProviderManager: swapProviderManagerSimpleDb,
          bridgeProviderManager: bridgeProviderManagerSimpleDb,
        }));
      };
      setProviderManagersFromCache();
      if (noFetch) {
        return;
      }

      try {
        const swapProviderManagerFromServer =
          await backgroundApiProxy.serviceSwap.getSwapProviderManager();

        if (swapProviderManagerFromServer.length) {
          const unifiedProviderManager = buildUnifiedSwapProviderManagers({
            serverProviders: swapProviderManagerFromServer,
            swapProviderManagers: swapProviderManagerSimpleDb,
            bridgeProviderManagers: bridgeProviderManagerSimpleDb,
          });
          if (
            !canUseUnifiedSwapProviderManagers({
              serverProviders: swapProviderManagerFromServer,
              unifiedProviderManagers: unifiedProviderManager,
              bridgeProviderManagers: bridgeProviderManagerSimpleDb,
            })
          ) {
            return;
          }
          await backgroundApiProxy.simpleDb.swapConfigs.setSwapProviderManager(
            unifiedProviderManager,
          );
          await backgroundApiProxy.simpleDb.swapConfigs.setBridgeProviderManager(
            [],
          );
          setInAppNotification((pre) => ({
            ...pre,
            swapProviderManager: unifiedProviderManager,
            bridgeProviderManager: [],
          }));
        }
      } catch {
        // Keep cached provider settings usable when the provider list refresh fails.
      }
    },
    [setInAppNotification],
  );

  const checkSupportTokenSwapType = useCallback(
    (token: ISwapToken, enableSwitchAction?: boolean) => {
      const supportNet = swapNetworks.find(
        (net) => net.networkId === token.networkId,
      );
      const supportTypes = supportNet
        ? getSwapNetworkSupportTabSwitchTypes({
            supportSingleSwap: supportNet.supportSingleSwap,
            supportCrossChainSwap: supportNet.supportCrossChainSwap,
            supportLimit: supportNet.supportLimit,
            supportStock: supportNet.supportStock,
          })
        : [];
      if (!normalizedSwapTabSwitchType && enableSwitchAction) {
        if (
          supportTypes.length > 0 &&
          !supportTypes.includes(swapTypeSwitch) &&
          !focusSwapPro
        ) {
          const needSwitchType = supportTypes.find((t) => t !== swapTypeSwitch);
          if (needSwitchType) {
            void swapTypeSwitchAction(
              needSwitchType,
              swapAddressInfoRef.current?.networkId ??
                fromTokenRef.current?.networkId,
            );
          }
        }
      }
      return supportTypes;
    },
    [
      normalizedSwapTabSwitchType,
      swapNetworks,
      swapTypeSwitch,
      swapTypeSwitchAction,
      focusSwapPro,
    ],
  );

  const syncDefaultSelectedToken = useCallback(async () => {
    const hasUnconsumedSwapInitParams = Boolean(
      swapInitParamsConsumptionKey &&
      consumedSwapInitParamsKeyRef.current !== swapInitParamsConsumptionKey,
    );
    const isStockDefaultTokenFlow =
      swapTypeSwitchRef.current === ESwapTabSwitchType.STOCK ||
      params?.swapTabSwitchType === ESwapTabSwitchType.STOCK;
    const hasInitFromAmount = Boolean(
      hasUnconsumedSwapInitParams && params?.fromAmount,
    );
    if (
      hasUnconsumedSwapInitParams &&
      params?.fromAmount &&
      (!fromTokenAmount.isInput || fromTokenAmount.value !== params.fromAmount)
    ) {
      void setFromTokenAmount({
        value: params.fromAmount,
        isInput: true,
      });
    }
    if (isStockDefaultTokenFlow) {
      if (
        selectedTokensColdStartContextRef.current?.swapType !==
        ESwapTabSwitchType.STOCK
      ) {
        if (fromTokenRef.current) {
          setSwapFromToken(undefined);
        }
        if (toTokenRef.current) {
          setToToken(undefined);
        }
        if (selectedTokensColdStartContextRef.current) {
          setSelectedTokensColdStartContext(undefined);
        }
        if (
          fromTokenAmountRef.current.value ||
          fromTokenAmountRef.current.isInput
        ) {
          setFromTokenAmount({ value: '', isInput: false });
        }
        if (
          toTokenAmountRef.current.value ||
          toTokenAmountRef.current.isInput
        ) {
          setToTokenAmount({ value: '', isInput: false });
        }
      }
      finishSwapInitParamsSync();
      return;
    }
    const hasImportTokenParams =
      hasUnconsumedSwapInitParams &&
      Boolean(params?.importFromToken || params?.importToToken);
    const hasImportParams =
      Boolean(hasImportTokenParams || params?.importNetworkId) &&
      hasUnconsumedSwapInitParams;
    let hasSelectedTokens = Boolean(fromTokenRef.current || toTokenRef.current);
    if (
      shouldSkipSwapDefaultSelectedTokenSync({
        hasImportParams,
        hasSelectedTokens,
        initialSelectedTokensSynced: initialSelectedTokensSyncedRef.current,
      })
    ) {
      if (
        hasSelectedTokens &&
        getSelectedTokensColdStartChannelSupport({
          swapType: swapTypeSwitchRef.current,
          fromToken: fromTokenRef.current,
          toToken: toTokenRef.current,
          swapNetworks: swapNetworksRef.current,
        }) === false
      ) {
        clearSelectedTokensColdStartCache();
      }
      if (hasInitFromAmount) {
        markSwapInitParamsConsumed();
      }
      return;
    }
    const homeAccountSyncResult =
      await syncSwapSelectedAccountFromLatestHomeStorage();
    if (homeAccountSyncResult.synced) {
      if (homeAccountSyncResult.clearedSelectedTokens) {
        hasSelectedTokens = false;
      }
    }
    if (hasImportTokenParams) {
      if (!swapNetworksRef.current.length) {
        return;
      }
      const hasImportTokenNetwork =
        Boolean(
          params?.importFromToken &&
          swapNetworksRef.current.find(
            (net) => net.networkId === params?.importFromToken?.networkId,
          ),
        ) ||
        Boolean(
          params?.importToToken &&
          swapNetworksRef.current.find(
            (net) => net.networkId === params?.importToToken?.networkId,
          ),
        );
      if (!hasImportTokenNetwork) {
        clearSelectedTokensColdStartCache();
        hasSelectedTokens = false;
      } else {
        const importTokenSupportCheckType =
          supportCheckSwapTabSwitchType ?? ESwapTabSwitchType.SWAP;
        const isImportFromTokenSupported = Boolean(
          params?.importFromToken &&
          importTokenSupportCheckType &&
          checkSupportTokenSwapType(params.importFromToken).includes(
            importTokenSupportCheckType,
          ),
        );
        const isImportToTokenSupported = Boolean(
          params?.importToToken &&
          importTokenSupportCheckType &&
          checkSupportTokenSwapType(params.importToToken).includes(
            importTokenSupportCheckType,
          ),
        );
        const hasUnsupportedImportToken =
          (Boolean(params?.importFromToken) && !isImportFromTokenSupported) ||
          (Boolean(params?.importToToken) && !isImportToTokenSupported);
        if (hasUnsupportedImportToken) {
          clearSelectedTokensColdStartCache();
        }
        let didSetImportFromToken = false;
        if (params?.importFromToken) {
          if (isImportFromTokenSupported) {
            setSwapFromToken(params?.importFromToken);
            didSetImportFromToken = true;
          }
        }
        if (params?.importToToken) {
          if (isImportToTokenSupported) {
            setToToken(params?.importToToken);
          }
        }
        if (
          params?.importFromToken &&
          !params?.importToToken &&
          didSetImportFromToken
        ) {
          const defaultTokenSwapType = importTokenSupportCheckType;
          const needSetToToken = needChangeToken({
            token: params.importFromToken,
            swapTypeSwitchValue: defaultTokenSwapType,
          });
          if (needSetToToken) {
            const defaultTokenSupportTypes =
              checkSupportTokenSwapType(needSetToToken);
            if (defaultTokenSupportTypes.includes(defaultTokenSwapType)) {
              setToToken(needSetToToken);
            }
          }
        }
        void syncNetworksSort(
          params?.importFromToken?.networkId ??
            params?.importToToken?.networkId ??
            getNetworkIdsMap().onekeyall,
        );
        finishSwapInitParamsSync();
        return;
      }
    }
    if (
      shouldPreserveUserInputAmount() &&
      (!hasSelectedTokens ||
        getSelectedTokensColdStartChannelSupport({
          swapType: swapTypeSwitchRef.current,
          fromToken: fromTokenRef.current,
          toToken: toTokenRef.current,
          swapNetworks: swapNetworksRef.current,
        }) !== false)
    ) {
      if (hasSelectedTokens) {
        syncSelectedTokensColdStartSwapType();
      }
      finishSwapInitParamsSync();
      return;
    }
    if (
      hasSelectedTokens &&
      shouldPreserveUserInputSelectedTokens() &&
      getSelectedTokensColdStartChannelSupport({
        swapType: swapTypeSwitchRef.current,
        fromToken: fromTokenRef.current,
        toToken: toTokenRef.current,
        swapNetworks: swapNetworksRef.current,
      }) !== false
    ) {
      syncSelectedTokensColdStartSwapType();
      finishSwapInitParamsSync();
      return;
    }

    let shouldResetInvalidColdStartSwapType = false;
    if (hasSelectedTokens) {
      const isSelectedTokensColdStartContextValid =
        validateSelectedTokensColdStartContext();
      if (isSelectedTokensColdStartContextValid === undefined) {
        return;
      }
      if (isSelectedTokensColdStartContextValid) {
        const selectedTokensColdStartChannelSupport =
          getSelectedTokensColdStartChannelSupport({
            swapType: swapTypeSwitchRef.current,
            fromToken: fromTokenRef.current,
            toToken: toTokenRef.current,
            swapNetworks: swapNetworksRef.current,
          });
        if (selectedTokensColdStartChannelSupport === undefined) {
          return;
        }
        if (!selectedTokensColdStartChannelSupport) {
          clearSelectedTokensColdStartCache();
          finishSwapInitParamsSync();
          return;
        }
        syncSelectedTokensColdStartSwapType();
        finishSwapInitParamsSync();
        return;
      }

      shouldResetInvalidColdStartSwapType = true;
      clearSelectedTokensColdStartCache();
    }
    const defaultTokenNetworkId = homeAccountSyncResult.synced
      ? homeAccountSyncResult.homeSelectedAccount.networkId
      : swapAddressInfoRef.current?.networkId;
    const hasAccountReadyForDefaultToken =
      swapAddressInfoRef.current?.accountInfo?.ready ||
      Boolean(homeAccountSyncResult.synced);
    if (
      !hasAccountReadyForDefaultToken ||
      !defaultTokenNetworkId ||
      !swapNetworksRef.current.length ||
      (hasImportParams &&
        params?.importNetworkId &&
        defaultTokenNetworkId &&
        params?.importNetworkId !== defaultTokenNetworkId) ||
      skipSyncDefaultSelectedToken
    ) {
      return;
    }
    const isAllNet = networkUtils.isAllNetwork({
      networkId: defaultTokenNetworkId,
    });
    const accountNetwork = swapNetworksRef.current.find(
      (net) => net.networkId === defaultTokenNetworkId,
    );
    let netInfo = accountNetwork;
    let netId = accountNetwork?.networkId;
    if (isAllNet) {
      netId = getNetworkIdsMap().onekeyall;
      const allNetDefaultToken = swapDefaultSetTokens[netId]?.fromToken;
      netInfo = swapNetworksRef.current.find(
        (net) => net.networkId === allNetDefaultToken?.networkId,
      );
    }

    if (netInfo && netId) {
      if (
        !isNil(swapDefaultSetTokens[netId]?.fromToken) ||
        !isNil(swapDefaultSetTokens[netId]?.toToken) ||
        !isNil(swapDefaultSetTokens[netId]?.limitFromToken) ||
        !isNil(swapDefaultSetTokens[netId]?.limitToToken)
      ) {
        const preferredDefaultSwapType =
          params?.swapTabSwitchType ?? swapTypeSwitchRef.current;
        const shouldUseLimitDefaults =
          preferredDefaultSwapType === ESwapTabSwitchType.LIMIT;
        if (shouldUseLimitDefaults && !netInfo.supportLimit) {
          clearSelectedTokensColdStartCache();
          finishSwapInitParamsSync();
          return;
        }
        let didSetDefaultSelectedTokens = false;
        const defaultFromToken = shouldUseLimitDefaults
          ? swapDefaultSetTokens[netId]?.limitFromToken
          : swapDefaultSetTokens[netId]?.fromToken;
        const defaultToToken = getSwapDefaultToTokenForSwapType({
          fromToken: defaultFromToken,
          homeNetworkId: netId,
          preferredSwapType: preferredDefaultSwapType,
          toToken: shouldUseLimitDefaults
            ? swapDefaultSetTokens[netId]?.limitToToken
            : swapDefaultSetTokens[netId]?.toToken,
        });
        if (shouldUseLimitDefaults && !defaultFromToken && !defaultToToken) {
          clearSelectedTokensColdStartCache();
          finishSwapInitParamsSync();
          return;
        }
        const defaultFromTokenWithLogo = defaultFromToken
          ? {
              ...defaultFromToken,
              networkLogoURI: isAllNet
                ? defaultFromToken.networkLogoURI
                : netInfo?.logoURI,
            }
          : undefined;
        if (defaultFromToken) {
          setSwapFromToken(defaultFromTokenWithLogo);
          didSetDefaultSelectedTokens = true;
          void syncNetworksSort(defaultFromToken.networkId);
        }
        if (defaultToToken) {
          setToToken({
            ...defaultToToken,
            networkLogoURI: isAllNet
              ? defaultToToken.networkLogoURI
              : netInfo?.logoURI,
          });
          didSetDefaultSelectedTokens = true;
          void syncNetworksSort(defaultToToken.networkId);
          if (shouldResetInvalidColdStartSwapType) {
            switchSwapTypeIfNeeded(
              params?.swapTabSwitchType ?? ESwapTabSwitchType.SWAP,
              defaultFromTokenWithLogo?.networkId ?? defaultToToken.networkId,
            );
          }
        } else if (defaultFromTokenWithLogo) {
          const defaultFromTokenSupportTypes = checkSupportTokenSwapType(
            defaultFromTokenWithLogo,
          );
          const defaultSwapTypes = [
            supportCheckSwapTabSwitchType,
            normalizedSwapTabSwitchType,
            swapTypeSwitch,
            ESwapTabSwitchType.SWAP,
            ESwapTabSwitchType.LIMIT,
            ESwapTabSwitchType.STOCK,
          ].filter(
            (type, index, list): type is ESwapTabSwitchType =>
              !!type &&
              list.indexOf(type) === index &&
              defaultFromTokenSupportTypes.includes(type),
          );
          let matchedDefaultSwapType: ESwapTabSwitchType | undefined;
          let needChangeToToken: ISwapToken | null | undefined;
          defaultSwapTypes.some((type) => {
            const nextToToken = needChangeToken({
              token: defaultFromTokenWithLogo,
              swapTypeSwitchValue: type,
            });
            if (nextToToken) {
              matchedDefaultSwapType = type;
              needChangeToToken = nextToToken;
              return true;
            }
            return false;
          });
          if (needChangeToToken) {
            setToToken(needChangeToToken);
            didSetDefaultSelectedTokens = true;
            void syncNetworksSort(needChangeToToken.networkId);
            if (
              !params?.swapTabSwitchType &&
              matchedDefaultSwapType &&
              matchedDefaultSwapType !== swapTypeSwitchRef.current
            ) {
              switchSwapTypeIfNeeded(
                matchedDefaultSwapType,
                defaultFromTokenWithLogo.networkId,
              );
            }
          }
        }
        if (defaultFromToken) {
          checkSupportTokenSwapType(defaultFromToken, true);
        }
        if (didSetDefaultSelectedTokens) {
          finishSwapInitParamsSync();
        }
      } else if (shouldResetInvalidColdStartSwapType) {
        switchSwapTypeIfNeeded(
          params?.swapTabSwitchType ?? ESwapTabSwitchType.SWAP,
          netId,
        );
        finishSwapInitParamsSync();
      } else {
        finishSwapInitParamsSync();
      }
    } else if (shouldResetInvalidColdStartSwapType) {
      switchSwapTypeIfNeeded(
        params?.swapTabSwitchType ?? ESwapTabSwitchType.SWAP,
      );
    }
  }, [
    params?.fromAmount,
    params?.importFromToken,
    params?.importToToken,
    params?.importNetworkId,
    params?.swapTabSwitchType,
    normalizedSwapTabSwitchType,
    supportCheckSwapTabSwitchType,
    swapInitParamsConsumptionKey,
    skipSyncDefaultSelectedToken,
    fromTokenAmount.isInput,
    fromTokenAmount.value,
    setFromTokenAmount,
    setSelectedTokensColdStartContext,
    setToTokenAmount,
    syncNetworksSort,
    checkSupportTokenSwapType,
    swapTypeSwitch,
    setSwapFromToken,
    setToToken,
    needChangeToken,
    validateSelectedTokensColdStartContext,
    syncSelectedTokensColdStartSwapType,
    clearSelectedTokensColdStartCache,
    markSwapInitParamsConsumed,
    finishSwapInitParamsSync,
    shouldPreserveUserInputAmount,
    switchSwapTypeIfNeeded,
    syncSwapSelectedAccountFromLatestHomeStorage,
    shouldPreserveUserInputSelectedTokens,
  ]);

  useEffect(() => {
    if (initialSelectedTokensSyncedRef.current) {
      return;
    }
    const hasSelectedTokens = Boolean(
      fromTokenRef.current || toTokenRef.current,
    );
    if (!hasSelectedTokens) {
      return;
    }
    if (
      shouldMarkSwapInitialSelectedTokensSynced({
        hasSelectedTokens,
        hasSyncedSwapSelectedAccountFromHomeStorage:
          hasSyncedSwapSelectedAccountFromHomeStorageRef.current,
        selectedTokensColdStartContextValid:
          validateSelectedTokensColdStartContext(),
      })
    ) {
      markInitialSelectedTokensSynced();
    }
  }, [
    fromToken?.networkId,
    fromToken?.contractAddress,
    toToken?.networkId,
    toToken?.contractAddress,
    selectedTokensColdStartContext,
    swapActiveAccount.ready,
    swapActiveAccount.wallet?.id,
    swapActiveAccount.indexedAccount?.id,
    swapActiveAccount.account?.id,
    swapActiveAccount.dbAccount?.id,
    swapActiveAccount.deriveType,
    swapActiveAccount.network?.id,
    validateSelectedTokensColdStartContext,
    markInitialSelectedTokensSynced,
  ]);

  useEffect(() => {
    if (!fromTokenRef.current && !toTokenRef.current) {
      return;
    }
    updateSelectedTokensColdStartContext();
  }, [
    fromToken?.networkId,
    fromToken?.contractAddress,
    toToken?.networkId,
    toToken?.contractAddress,
    swapTypeSwitch,
    swapActiveAccount.ready,
    swapActiveAccount.wallet?.id,
    swapActiveAccount.indexedAccount?.id,
    swapActiveAccount.account?.id,
    swapActiveAccount.dbAccount?.id,
    swapActiveAccount.deriveType,
    swapActiveAccount.network?.id,
    updateSelectedTokensColdStartContext,
  ]);

  useEffect(() => {
    void (async () => {
      const swapConfigs =
        await backgroundApiProxy.serviceSwap.fetchSwapConfigs();
      if (swapConfigs?.swapMevNetConfig) {
        setSwapMevConfig({
          swapMevNetConfig: swapConfigs.swapMevNetConfig,
        });
      }
    })();
  }, [setSwapMevConfig]);

  useEffect(() => {
    void (async () => {
      const tips = await backgroundApiProxy.serviceSwap.fetchSwapTips();
      const simpleDbTips =
        await backgroundApiProxy.simpleDb.swapConfigs.getSwapUserCloseTips();
      if (tips && !simpleDbTips.includes(tips.tipsId)) {
        setSwapTips({
          tips,
          status: 'ready',
          updatedAt: Date.now(),
        });
        return;
      }
      setSwapTips({
        status: 'empty',
        updatedAt: Date.now(),
      });
    })();
  }, [setSwapTips]);

  useEffect(() => {
    void (async () => {
      await backgroundApiProxy.serviceSwap.swapRecentTokenSync();
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      await fetchSwapNetworks();
    })();
  }, [fetchSwapNetworks, swapNetworks.length]);

  useEffect(() => {
    void (async () => {
      await fetchSyncSwapProviderManager();
    })();
  }, [fetchSyncSwapProviderManager]);

  useEffect(() => {
    void (async () => {
      if (
        params?.importNetworkId &&
        swapAddressInfoRef.current?.networkId &&
        params?.importNetworkId !== swapAddressInfoRef.current.networkId
      ) {
        await updateSelectedAccountNetwork({
          num: 0,
          networkId: params?.importNetworkId,
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.importNetworkId, updateSelectedAccountNetwork]);

  useEffect(() => {
    void (async () => {
      await syncDefaultSelectedToken();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    swapAddressInfo.accountInfo?.ready,
    swapNetworks.length,
    swapAddressInfo.networkId,
    params?.importFromToken,
    params?.importToToken,
    params?.importNetworkId,
    // The initial home->swap account write-back can keep the same networkId while
    // changing account identity, so import/default token init must also watch the
    // resolved account fields.
    swapActiveAccount.wallet?.id,
    swapActiveAccount.indexedAccount?.id,
    swapActiveAccount.account?.id,
    swapActiveAccount.dbAccount?.id,
    swapActiveAccount.deriveType,
    selectedTokensRuntimeChannelSupport,
  ]);
  const [swapFromMarketJumpToken, setSwapFromMarketJumpToken] =
    useSwapFromMarketJumpTokenAtom();
  const swapFromMarketJumpTokenRef = useRef<{
    token: ISwapToken | undefined;
    type: ESwapTabSwitchType;
    amount?: string;
    otherToken?: ISwapToken | undefined;
    direction: 'from' | 'to';
  }>(undefined);
  if (swapFromMarketJumpTokenRef.current !== swapFromMarketJumpToken) {
    swapFromMarketJumpTokenRef.current = swapFromMarketJumpToken;
  }
  const isModalPage = useIsOverlayPage();
  useListenTabFocusState(
    ETabRoutes.Swap,
    (isFocus: boolean, isHiddenModel: boolean) => {
      if (!isModalPage) {
        if (isFocus) {
          if (isHiddenModel) {
            setSkipSyncDefaultSelectedToken(true);
          } else {
            setSkipSyncDefaultSelectedToken(false);
          }
        }
      }
      if (isFocus) {
        if (
          !swapNetworksRef.current.length ||
          !isSwapNetworkCacheCompatible(swapNetworksRef.current)
        ) {
          void fetchSwapNetworks();
        }
        if (swapFromMarketJumpTokenRef.current?.token) {
          void swapTypeSwitchAction(swapFromMarketJumpTokenRef.current.type);
          if (swapFromMarketJumpTokenRef.current.direction === 'from') {
            if (
              equalTokenNoCaseSensitive({
                token1: swapFromMarketJumpTokenRef.current.token,
                token2: toTokenRef.current,
              })
            ) {
              void setToToken(undefined);
            }
            if (swapFromMarketJumpTokenRef.current.otherToken) {
              void setToToken(swapFromMarketJumpTokenRef.current.otherToken);
            }
            void selectFromToken(swapFromMarketJumpTokenRef.current.token);
            if (swapFromMarketJumpTokenRef.current.amount) {
              void setFromTokenAmount({
                value: swapFromMarketJumpTokenRef.current.amount,
                isInput: true,
              });
            }
          } else {
            if (
              equalTokenNoCaseSensitive({
                token1: swapFromMarketJumpTokenRef.current.token,
                token2: fromTokenRef.current,
              })
            ) {
              void setSwapFromToken(undefined);
            }
            if (swapFromMarketJumpTokenRef.current.otherToken) {
              void setSwapFromToken(
                swapFromMarketJumpTokenRef.current.otherToken,
              );
            }
            void selectToToken(swapFromMarketJumpTokenRef.current.token);
            if (swapFromMarketJumpTokenRef.current.amount) {
              void setFromTokenAmount({
                value: swapFromMarketJumpTokenRef.current.amount,
                isInput: true,
              });
            }
          }
          setSwapFromMarketJumpToken({
            token: undefined,
            type: ESwapTabSwitchType.SWAP,
            direction: 'from',
          });
        }
      }
    },
  );

  useEffect(() => {
    if (fromToken?.networkId && fromToken?.isNative) {
      void (async () => {
        const nativeTokenConfig =
          await backgroundApiProxy.serviceSwap.fetchSwapNativeTokenConfig({
            networkId: fromToken.networkId,
          });
        setSwapNativeTokenReserveGas((pre) => {
          const find = pre.find(
            (item) => item.networkId === fromToken.networkId,
          );
          if (find) {
            return [
              ...pre.filter((item) => item.networkId !== fromToken.networkId),
              {
                networkId: fromToken.networkId,
                reserveGas: nativeTokenConfig.reserveGas,
              },
            ];
          }
          return [...pre, nativeTokenConfig];
        });
      })();
    }
  }, [fromToken?.networkId, fromToken?.isNative, setSwapNativeTokenReserveGas]);

  return {
    fetchLoading: networkListFetching,
  };
}

export const useSwapLimitConfigMaps = () => {
  const intl = useIntl();
  const limitOrderExpiryStepMap = useMemo(
    () => [
      {
        label: `5 ${intl.formatMessage({
          id: ETranslations.Limit_expire_minutes,
        })}`,
        value: ESwapLimitOrderExpiryStep.FIVE_MINUTES.toString(),
      },
      {
        label: `30 ${intl.formatMessage({
          id: ETranslations.Limit_expire_minutes,
        })}`,
        value: ESwapLimitOrderExpiryStep.THIRTY_MINUTES.toString(),
      },
      {
        label: `1 ${intl.formatMessage({
          id: ETranslations.Limit_expire_hour,
        })}`,
        value: ESwapLimitOrderExpiryStep.ONE_HOUR.toString(),
      },
      {
        label: `1 ${intl.formatMessage({
          id: ETranslations.Limit_expire_day,
        })}`,
        value: ESwapLimitOrderExpiryStep.ONE_DAY.toString(),
      },
      {
        label: `3 ${intl.formatMessage({
          id: ETranslations.Limit_expire_days,
        })}`,
        value: ESwapLimitOrderExpiryStep.THREE_DAYS.toString(),
      },
      {
        label: `7 ${intl.formatMessage({
          id: ETranslations.Limit_expire_days,
        })}`,
        value: ESwapLimitOrderExpiryStep.ONE_WEEK.toString(),
      },
      {
        label: `1 ${intl.formatMessage({
          id: ETranslations.Limit_expire_month,
        })}`,
        value: ESwapLimitOrderExpiryStep.ONE_MONTH.toString(),
      },
    ],
    [intl],
  );
  const limitOrderPartiallyFillStepMap = useMemo(
    () => [
      {
        label: intl.formatMessage({
          id: ETranslations.Limit_info_partial_fill_enable,
        }),
        value: true,
      },
      {
        label: intl.formatMessage({
          id: ETranslations.Limit_info_partial_fill_disable,
        }),
        value: false,
      },
    ],
    [intl],
  );
  return {
    limitOrderExpiryStepMap,
    limitOrderPartiallyFillStepMap,
  };
};
