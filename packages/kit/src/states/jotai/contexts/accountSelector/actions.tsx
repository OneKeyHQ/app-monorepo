import { useRef } from 'react';

import { ORPHAN_ELIGIBLE_ERROR_CODES } from '@onekeyfe/hwk-adapter-core/errors';
import { Semaphore } from 'async-mutex';
import { cloneDeep, isEmpty, isEqual, isUndefined, omitBy } from 'lodash';

import type { IDialogInstance } from '@onekeyhq/components';
import { Dialog, Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { CommonDeviceLoading } from '@onekeyhq/kit/src/components/Hardware/Hardware';
import type useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { shouldContinueLedgerAutoCreateForCoreAppsCheckResult } from '@onekeyhq/kit/src/provider/Container/ThirdPartyHardwareUiStateContainer/ledgerCoreAppsReadyUtils';
import { ensureLedgerCoreAppsReady } from '@onekeyhq/kit/src/provider/Container/ThirdPartyHardwareUiStateContainer/LedgerInstallCoreAppsDialog';
import { toastExistingWalletSwitch } from '@onekeyhq/kit/src/utils/toastExistingWalletSwitch';
import qrHiddenCreateGuideDialog from '@onekeyhq/kit/src/views/Onboarding/pages/ConnectHardwareWallet/qrHiddenCreateGuideDialog';
import type {
  IDBAccount,
  IDBCreateHwWalletParamsBase,
  IDBCreateQRWalletParams,
  IDBIndexedAccount,
  IDBWallet,
  IDBWalletIdSingleton,
  IKeylessWalletDetailsInfo,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import type {
  IAccountSelectorFocusedWallet,
  IAccountSelectorSelectedAccount,
  IAccountSelectorSelectedAccountsMap,
} from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import type { IJotaiSetter } from '@onekeyhq/kit-bg/src/states/jotai/types';
import { writeContextAtomColdStartCacheValues } from '@onekeyhq/kit-bg/src/states/jotai/utils';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
} from '@onekeyhq/shared/src/consts/dbConsts';
import {
  CONTEXT_ATOM_COLD_START_CACHE_KEYS,
  type IContextAtomColdStartCacheKey,
} from '@onekeyhq/shared/src/consts/jotaiConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { type IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import { isHardwareErrorByCode } from '@onekeyhq/shared/src/errors/utils/deviceErrorUtils';
import {
  classifyThirdPartyHwCreateFailures,
  filterThirdPartyHwCreateFailureToasts,
  shouldOfferLedgerCoreAppInstallForCreateFailures,
} from '@onekeyhq/shared/src/errors/utils/thirdPartyDeviceErrorUtils';
import {
  EAppEventBusNames,
  EFinalizeWalletSetupSteps,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { ILedgerCoreAppName } from '@onekeyhq/shared/src/hardware/ledgerApps';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IAccountChainSelectorRouteParams,
  IAccountSelectorRouteParamsExtraConfig,
  IUnifiedNetworkSelectorRouteParams,
} from '@onekeyhq/shared/src/routes';
import {
  EAccountManagerStacksRoutes,
  EChainSelectorPages,
  EModalRoutes,
  EOnboardingPages,
} from '@onekeyhq/shared/src/routes';
import { coldStartCacheStorage } from '@onekeyhq/shared/src/storage/instance/syncStorageInstance';
import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorageKeys';
import accountSelectorUtils from '@onekeyhq/shared/src/utils/accountSelectorUtils';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import {
  EAccountSelectorAutoSelectTriggerBy,
  EAccountSelectorSceneName,
} from '@onekeyhq/shared/types';
import { EGlobalDeriveTypesScopes } from '@onekeyhq/shared/types/account';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { ContextJotaiActionsBase } from '../../utils/ContextJotaiActionsBase';

import { shouldKeepCurrentActiveAccountForIncompleteSelection } from './activeAccountInitGuard';
import {
  accountSelectorActiveAccountInitDoneAtom,
  accountSelectorContextDataAtom,
  accountSelectorEditModeAtom,
  accountSelectorStorageInitDoneAtom,
  accountSelectorStorageReadyAtom,
  accountSelectorSyncLoadingAtom,
  accountSelectorUpdateMetaAtom,
  activeAccountsAtom,
  contextAtomMethod,
  defaultActiveAccountInfo,
  defaultSelectedAccount,
  selectedAccountsAtom,
} from './atoms';
import {
  buildActiveAccountPerfSummary,
  getAccountSelectorPerfTimestamp,
  getNextAccountSelectorPerfOperationId,
  getSelectedAccountChangedFields,
  getSelectedAccountPerfCommitMeta,
  isAccountSelectorPerfDebugEnabled,
  recordActiveAccountPerfStateUpdate,
  recordSelectedAccountPerfStateUpdate,
} from './perfDebug';

import type {
  IAccountSelectorActiveAccountInfo,
  IAccountSelectorAvailableNetworks,
  IAccountSelectorRouteParams,
  IAccountSelectorUpdateMeta,
  ISelectedAccountsAtomMap,
} from './atoms';

const { serviceAccount } = backgroundApiProxy;

const RECENT_ACCOUNT_SWITCH_COLD_START_MS = 5 * 60 * 1000;
// Version 1 can contain a Swap num 1 fallback that was selected from an
// incomplete map. Do not restore that recipient state after this fix lands.
const ACCOUNT_SELECTOR_RECENT_SELECTION_CACHE_VERSION = 2;

type ISelectionUpdateOutcome = 'commit' | 'noop' | 'skip-empty' | 'stale';

type ISelectionUpdateResult = {
  outcome: ISelectionUpdateOutcome;
  transitionId?: number;
};

type IActiveAccountReloadOutcome =
  | 'commit'
  | 'noop'
  | 'skip-incomplete'
  | 'stale-after-build'
  | 'stale-before-build'
  | 'stale-schedule-before-build';

type IActiveAccountReloadResult = {
  activeAccount: IAccountSelectorActiveAccountInfo;
  outcome: IActiveAccountReloadOutcome;
};

const isSameSelectedAccount = (
  first: IAccountSelectorSelectedAccount | undefined,
  second: IAccountSelectorSelectedAccount | undefined,
) => isEqual(omitBy(first, isUndefined), omitBy(second, isUndefined));

const getNextSelectionUpdatedAt = ({
  currentUpdatedAt,
  requestedUpdatedAt,
}: {
  currentUpdatedAt?: number;
  requestedUpdatedAt?: number;
}) =>
  Math.max(
    Date.now(),
    currentUpdatedAt === undefined ? 0 : currentUpdatedAt + 1,
    requestedUpdatedAt || 0,
  );

type IAccountSelectorRecentSelectionCacheItem = {
  version: typeof ACCOUNT_SELECTOR_RECENT_SELECTION_CACHE_VERSION;
  updatedAt: number;
  selectedAccountsMap: ISelectedAccountsAtomMap;
  updateMeta: Partial<{
    [num: number]: IAccountSelectorUpdateMeta;
  }>;
};

type IAccountSelectorRecentSelectionCache = Record<
  string,
  IAccountSelectorRecentSelectionCacheItem
>;

const isSelectedAccountIdentityIncomplete = (
  selectedAccount: IAccountSelectorSelectedAccount | undefined,
) =>
  !selectedAccount?.walletId &&
  !selectedAccount?.indexedAccountId &&
  !selectedAccount?.othersWalletAccountId;

const safeIsAccountCompatibleWithNetwork = ({
  account,
  networkId,
}: {
  account: IDBAccount | undefined;
  networkId: string;
}) => {
  if (!account) {
    return false;
  }
  try {
    return accountUtils.isAccountCompatibleWithNetwork({
      account,
      networkId,
    });
  } catch {
    return false;
  }
};

const safeGetAccountCompatibleNetwork = ({
  account,
  networkId,
}: {
  account: IDBAccount | undefined;
  networkId: string;
}) => {
  if (!account) {
    return undefined;
  }
  try {
    return accountUtils.getAccountCompatibleNetwork({
      account,
      networkId,
    });
  } catch {
    return undefined;
  }
};

export type IAccountSelectorSyncFromSceneParams = {
  from: {
    sceneName: EAccountSelectorSceneName;
    sceneUrl?: string;
    sceneNum: number;
  };
  num: number;
  targetSceneName?: EAccountSelectorSceneName;
  withNetworkSync?: boolean;
  availableNetworks?: IAccountSelectorAvailableNetworks;
};

type ISceneSyncPreparationResult = {
  deriveResolution: 'none' | 'source' | 'target' | 'global' | 'default';
  networkResolution: 'none' | 'source' | 'target' | 'default' | 'first';
  selectedAccount: IAccountSelectorSelectedAccount;
};

function prepareSceneSyncSelectedAccount({
  availableNetworks,
  currentSelectedAccount,
  globalDeriveTypesMap,
  sourceSelectedAccount,
  targetSceneName,
  withNetworkSync,
}: {
  availableNetworks?: IAccountSelectorAvailableNetworks;
  currentSelectedAccount: IAccountSelectorSelectedAccount;
  globalDeriveTypesMap?: Partial<Record<string, IAccountDeriveTypes>>;
  sourceSelectedAccount: IAccountSelectorSelectedAccount;
  targetSceneName: EAccountSelectorSceneName | undefined;
  withNetworkSync: boolean;
}): ISceneSyncPreparationResult {
  const selectedAccount = cloneDeep(sourceSelectedAccount);
  const sourceNetworkId = selectedAccount.networkId;
  const sourceDeriveType = selectedAccount.deriveType;
  const targetNetworkId = currentSelectedAccount.networkId;
  const targetDeriveType = currentSelectedAccount.deriveType;
  let networkResolution: ISceneSyncPreparationResult['networkResolution'] =
    sourceNetworkId ? 'source' : 'none';
  let deriveResolution: ISceneSyncPreparationResult['deriveResolution'] =
    sourceDeriveType ? 'source' : 'none';

  if (!withNetworkSync) {
    selectedAccount.networkId = targetNetworkId;
    selectedAccount.deriveType = targetDeriveType;
    networkResolution = targetNetworkId ? 'target' : 'none';
    deriveResolution = targetDeriveType ? 'target' : 'none';
  } else {
    const networkIds = availableNetworks?.networkIds?.filter(Boolean) || [];
    const isAvailableNetwork = (networkId: string | undefined) =>
      Boolean(networkId && networkIds.includes(networkId));
    const isUsableNetwork = (networkId: string | undefined) =>
      Boolean(
        isAvailableNetwork(networkId) &&
        !(
          targetSceneName === EAccountSelectorSceneName.discover &&
          networkId &&
          networkUtils.isAllNetwork({ networkId })
        ),
      );
    const usableNetworkIds = networkIds.filter((networkId) =>
      isUsableNetwork(networkId),
    );
    const sourceNetworkCannotBeUsed = Boolean(
      (targetSceneName === EAccountSelectorSceneName.discover &&
        sourceNetworkId &&
        networkUtils.isAllNetwork({ networkId: sourceNetworkId })) ||
      (sourceNetworkId &&
        networkIds.length > 0 &&
        !isUsableNetwork(sourceNetworkId)),
    );

    if (!sourceNetworkId || sourceNetworkCannotBeUsed) {
      const defaultNetworkId = isUsableNetwork(
        availableNetworks?.defaultNetworkId,
      )
        ? availableNetworks?.defaultNetworkId
        : undefined;
      const resolvedNetworkId = isUsableNetwork(targetNetworkId)
        ? targetNetworkId
        : defaultNetworkId || usableNetworkIds[0];

      selectedAccount.networkId = resolvedNetworkId;
      selectedAccount.deriveType =
        resolvedNetworkId && resolvedNetworkId === targetNetworkId
          ? targetDeriveType
          : undefined;
      if (!resolvedNetworkId) {
        networkResolution = 'none';
      } else if (resolvedNetworkId === targetNetworkId) {
        networkResolution = 'target';
      } else if (resolvedNetworkId === defaultNetworkId) {
        networkResolution = 'default';
      } else {
        networkResolution = 'first';
      }
      deriveResolution = selectedAccount.deriveType ? 'target' : 'none';
    }

    if (
      selectedAccount.networkId &&
      targetSceneName === EAccountSelectorSceneName.discover &&
      networkUtils.isAllNetwork({ networkId: selectedAccount.networkId })
    ) {
      selectedAccount.networkId = undefined;
      selectedAccount.deriveType = undefined;
      networkResolution = 'none';
      deriveResolution = 'none';
    }
  }

  if (selectedAccount.networkId && !selectedAccount.deriveType) {
    const key = accountSelectorUtils.buildGlobalDeriveTypesMapKey({
      networkId: selectedAccount.networkId,
    });
    const globalDeriveType = globalDeriveTypesMap?.[key];
    selectedAccount.deriveType = globalDeriveType || 'default';
    deriveResolution = globalDeriveType ? 'global' : 'default';
  }

  return {
    deriveResolution,
    networkResolution,
    selectedAccount,
  };
}

export type IFinalizeWalletSetupCreateWalletResult = {
  wallet: IDBWallet;
  indexedAccount: IDBIndexedAccount | undefined;
  isOverrideWallet?: boolean;
  hidden?: {
    wallet: IDBWallet;
    indexedAccount: IDBIndexedAccount | undefined;
  };
};

class AccountSelectorActions extends ContextJotaiActionsBase {
  refresh = contextAtomMethod((_, set, payload: { num: number }) => {
    const { num } = payload;
    this.setSelectedAccountsAtom(
      set,
      (v) => ({
        ...v,
        [num]: {
          ...v[num],
        } as any,
      }),
      'refresh',
    );
  });

  setSelectedAccountsAtom(
    set: IJotaiSetter,
    fn: (currentValue: ISelectedAccountsAtomMap) => ISelectedAccountsAtomMap,
    reason?: string,
    parentOperationId?: number,
  ) {
    set(selectedAccountsAtom(), (currentValue) => {
      const newValue = fn(currentValue);
      const isForcedRefresh = reason === 'refresh';
      if (!isForcedRefresh && isEqual(currentValue, newValue)) {
        return currentValue;
      }
      if (isAccountSelectorPerfDebugEnabled()) {
        const nums = new Set([
          ...Object.keys(currentValue),
          ...Object.keys(newValue),
        ]);
        nums.forEach((numText) => {
          const num = Number(numText);
          const previous = currentValue[num];
          const current = newValue[num];
          if (!isEqual(previous, current)) {
            recordSelectedAccountPerfStateUpdate({
              current,
              num,
              parentOperationId,
              previous,
              reason: reason || 'unknown',
            });
          } else if (isForcedRefresh && previous !== current) {
            const transitionMeta = recordSelectedAccountPerfStateUpdate({
              current,
              num,
              parentOperationId,
              previous,
              reason,
            });
            defaultLogger.accountSelector.perf.trace('selectionRefresh', {
              num,
              reason,
              transitionId: transitionMeta?.transitionId,
            });
          }
        });
      }
      return newValue;
    });
  }

  buildAccountSelectorColdStartScopeKey({
    sceneName,
    sceneUrl,
  }: {
    sceneName: EAccountSelectorSceneName | undefined;
    sceneUrl?: string;
  }) {
    if (!sceneName) {
      return undefined;
    }
    const sceneId = accountSelectorUtils.buildAccountSelectorSceneId({
      sceneName,
      sceneUrl,
    });
    return `store:accountSelector@${sceneId}`;
  }

  buildAccountSelectorRecentSelectionCacheSceneId({
    sceneName,
    sceneUrl,
  }: {
    sceneName: EAccountSelectorSceneName | undefined;
    sceneUrl?: string;
  }) {
    if (!sceneName) {
      return undefined;
    }
    // OK-57139: discover scenes are backed by the dApp connection record
    // (simpleDb.dappConnection), which background keeps re-aligning to the
    // wallet account. Caching a "recent selection" for them lets a stale
    // browser-side account survive re-init and overwrite the aligned
    // session (and, via dApp->Home sync, the wallet home account).
    if (sceneName === EAccountSelectorSceneName.discover) {
      return undefined;
    }
    return accountSelectorUtils.buildAccountSelectorSceneId({
      sceneName,
      sceneUrl,
    });
  }

  getRecentAccountSelectorSelectionCache({
    sceneName,
    sceneUrl,
  }: {
    sceneName: EAccountSelectorSceneName | undefined;
    sceneUrl?: string;
  }): IAccountSelectorRecentSelectionCacheItem | undefined {
    try {
      const sceneId = this.buildAccountSelectorRecentSelectionCacheSceneId({
        sceneName,
        sceneUrl,
      });
      if (!sceneId) {
        return undefined;
      }
      const cache =
        coldStartCacheStorage.getObject<IAccountSelectorRecentSelectionCache>(
          EAppSyncStorageKeys.onekey_account_selector_recent_selection,
        );
      const item = cache?.[sceneId];
      const now = Date.now();
      if (
        item?.version !== ACCOUNT_SELECTOR_RECENT_SELECTION_CACHE_VERSION ||
        !item.updatedAt ||
        now - item.updatedAt < 0 ||
        now - item.updatedAt > RECENT_ACCOUNT_SWITCH_COLD_START_MS
      ) {
        return undefined;
      }
      return cloneDeep(item);
    } catch {
      return undefined;
    }
  }

  setRecentAccountSelectorSelectionCache({
    sceneName,
    sceneUrl,
    num,
    selectedAccountsMap,
    updateMeta,
  }: {
    sceneName: EAccountSelectorSceneName | undefined;
    sceneUrl?: string;
    num?: number;
    selectedAccountsMap: ISelectedAccountsAtomMap;
    updateMeta: Partial<{
      [num: number]: IAccountSelectorUpdateMeta;
    }>;
  }) {
    try {
      const sceneId = this.buildAccountSelectorRecentSelectionCacheSceneId({
        sceneName,
        sceneUrl,
      });
      if (!sceneId) {
        return;
      }
      const now = Date.now();
      const cache =
        coldStartCacheStorage.getObject<IAccountSelectorRecentSelectionCache>(
          EAppSyncStorageKeys.onekey_account_selector_recent_selection,
        ) ?? {};
      const nextCache: IAccountSelectorRecentSelectionCache = {};
      Object.entries(cache).forEach(([key, item]) => {
        if (
          item?.version === ACCOUNT_SELECTOR_RECENT_SELECTION_CACHE_VERSION &&
          item.updatedAt &&
          now - item.updatedAt >= 0 &&
          now - item.updatedAt <= RECENT_ACCOUNT_SWITCH_COLD_START_MS
        ) {
          nextCache[key] = item;
        }
      });
      const setCacheItem = ({
        targetSceneId,
        targetSelectedAccountsMap,
        targetUpdateMeta,
      }: {
        targetSceneId: string;
        targetSelectedAccountsMap: ISelectedAccountsAtomMap;
        targetUpdateMeta: Partial<{
          [targetNum: number]: IAccountSelectorUpdateMeta;
        }>;
      }) => {
        nextCache[targetSceneId] = {
          version: ACCOUNT_SELECTOR_RECENT_SELECTION_CACHE_VERSION,
          updatedAt: now,
          selectedAccountsMap: cloneDeep(targetSelectedAccountsMap),
          updateMeta: cloneDeep(targetUpdateMeta),
        };
      };

      setCacheItem({
        targetSceneId: sceneId,
        targetSelectedAccountsMap: selectedAccountsMap,
        targetUpdateMeta: updateMeta,
      });

      const selectedAccountForHomeSync = selectedAccountsMap[0];
      const updateMetaForHomeSync = updateMeta[0];
      if (
        num === 0 &&
        selectedAccountForHomeSync &&
        updateMetaForHomeSync &&
        (sceneName === EAccountSelectorSceneName.home ||
          sceneName === EAccountSelectorSceneName.swap)
      ) {
        const homeSyncSceneName =
          sceneName === EAccountSelectorSceneName.home
            ? EAccountSelectorSceneName.swap
            : EAccountSelectorSceneName.home;
        const homeSyncSceneId =
          this.buildAccountSelectorRecentSelectionCacheSceneId({
            sceneName: homeSyncSceneName,
          });
        if (homeSyncSceneId) {
          const homeSyncSelectedAccountsMap = cloneDeep(
            nextCache[homeSyncSceneId]?.selectedAccountsMap ?? {},
          );
          const homeSyncUpdateMeta = cloneDeep(
            nextCache[homeSyncSceneId]?.updateMeta ?? {},
          );
          homeSyncSelectedAccountsMap[0] = selectedAccountForHomeSync;
          homeSyncUpdateMeta[0] = updateMetaForHomeSync;
          setCacheItem({
            targetSceneId: homeSyncSceneId,
            targetSelectedAccountsMap: homeSyncSelectedAccountsMap,
            targetUpdateMeta: homeSyncUpdateMeta,
          });
        }
      }

      coldStartCacheStorage.setObject(
        EAppSyncStorageKeys.onekey_account_selector_recent_selection,
        nextCache,
      );
    } catch {
      // The recent selection cache only protects the quick-kill window.
    }
  }

  async flushRecentAccountSelectorSelectionCacheNowIfNeeded() {
    if (!platformEnv.isWeb && !platformEnv.isDesktop) {
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { flushColdStartCacheNow } =
        require('@onekeyhq/shared/src/storage/instance/webColdStartStorage') as typeof import('@onekeyhq/shared/src/storage/instance/webColdStartStorage');
      await flushColdStartCacheNow();
    } catch {
      // Native MMKV writes are synchronous; extension background has no cache.
    }
  }

  async flushAccountSelectorColdStartSnapshot({
    sceneName,
    sceneUrl,
    selectedAccounts,
    activeAccounts,
    updateMeta,
  }: {
    sceneName: EAccountSelectorSceneName | undefined;
    sceneUrl?: string;
    selectedAccounts?: ISelectedAccountsAtomMap;
    activeAccounts?: Partial<{
      [num: number]: IAccountSelectorActiveAccountInfo;
    }>;
    updateMeta?: Partial<{
      [num: number]: IAccountSelectorUpdateMeta;
    }>;
  }) {
    try {
      const coldStartScopeKey = this.buildAccountSelectorColdStartScopeKey({
        sceneName,
        sceneUrl,
      });
      if (!coldStartScopeKey) {
        return;
      }
      if (sceneName === EAccountSelectorSceneName.discover) {
        return;
      }

      await writeContextAtomColdStartCacheValues({
        flushImmediately: true,
        entries: [
          selectedAccounts
            ? {
                coldStartScopeKey,
                coldStartCacheKey:
                  CONTEXT_ATOM_COLD_START_CACHE_KEYS.selectedAccountsAtom,
                value: selectedAccounts,
              }
            : undefined,
          activeAccounts
            ? {
                coldStartScopeKey,
                coldStartCacheKey:
                  CONTEXT_ATOM_COLD_START_CACHE_KEYS.activeAccountsAtom,
                value: activeAccounts,
              }
            : undefined,
          updateMeta
            ? {
                coldStartScopeKey,
                coldStartCacheKey:
                  CONTEXT_ATOM_COLD_START_CACHE_KEYS.accountSelectorUpdateMetaAtom,
                value: updateMeta,
              }
            : undefined,
        ].filter(Boolean) as {
          coldStartScopeKey: string;
          coldStartCacheKey: IContextAtomColdStartCacheKey;
          value: unknown;
        }[],
      });
    } catch {
      // Cold-start snapshots are a best-effort fast path; simpleDb remains the source of truth.
    }
  }

  flushCurrentAccountSelectorColdStartSnapshot = contextAtomMethod(
    async (
      get,
      _set,
      {
        sceneName,
        sceneUrl,
        includeActiveAccounts,
      }: {
        sceneName: EAccountSelectorSceneName | undefined;
        sceneUrl?: string;
        includeActiveAccounts?: boolean;
      },
    ) => {
      await this.flushAccountSelectorColdStartSnapshot({
        sceneName,
        sceneUrl,
        selectedAccounts: get(selectedAccountsAtom()),
        updateMeta: get(accountSelectorUpdateMetaAtom()),
        activeAccounts: includeActiveAccounts
          ? get(activeAccountsAtom())
          : undefined,
      });
    },
  );

  shouldKeepColdStartSelectedAccounts({
    selectedAccountsMap,
    selectedAccountsMapInDB,
    updateMeta,
  }: {
    selectedAccountsMap: ISelectedAccountsAtomMap;
    selectedAccountsMapInDB: IAccountSelectorSelectedAccountsMap | undefined;
    updateMeta: Partial<{
      [num: number]: IAccountSelectorUpdateMeta;
    }>;
  }) {
    if (isEqual(selectedAccountsMapInDB, selectedAccountsMap)) {
      return false;
    }
    const hasSelectedAccount = Object.values(selectedAccountsMap).some(
      (selectedAccount) =>
        selectedAccount && !isEqual(selectedAccount, defaultSelectedAccount()),
    );
    if (!hasSelectedAccount) {
      return false;
    }
    const now = Date.now();
    return Object.values(updateMeta).some(
      (meta) =>
        meta?.updatedAt &&
        now - meta.updatedAt >= 0 &&
        now - meta.updatedAt <= RECENT_ACCOUNT_SWITCH_COLD_START_MS,
    );
  }

  mergeColdStartSelectedAccountsWithStorage({
    selectedAccountsMap,
    selectedAccountsMapInDB,
  }: {
    selectedAccountsMap: ISelectedAccountsAtomMap;
    selectedAccountsMapInDB: IAccountSelectorSelectedAccountsMap | undefined;
  }) {
    const mergedSelectedAccountsMap = cloneDeep(selectedAccountsMap);
    Object.entries(selectedAccountsMapInDB ?? {}).forEach(
      ([numKey, dbAccount]) => {
        const targetNum = Number(numKey);
        const current = mergedSelectedAccountsMap[targetNum];
        // A wallet-only slot still triggers automatic selection of index 0,
        // so only a complete account identity can override the storage value.
        const currentHasAccount = Boolean(
          current?.othersWalletAccountId ||
          (current?.walletId && current?.indexedAccountId),
        );
        const dbHasAccount = Boolean(
          dbAccount?.othersWalletAccountId ||
          (dbAccount?.walletId && dbAccount?.indexedAccountId),
        );
        if (!currentHasAccount && dbAccount && dbHasAccount) {
          // Keep the slot's freshly restored network context while filling the
          // missing identity from the normalized storage map.
          mergedSelectedAccountsMap[targetNum] =
            accountSelectorUtils.buildMergedSelectedAccount({
              data: current,
              mergedByData: dbAccount,
            });
        }
      },
    );
    return mergedSelectedAccountsMap;
  }

  mutex = new Semaphore(1);

  reloadActiveAccountInfo = contextAtomMethod(
    async (
      get,
      set,
      payload: {
        num: number;
        perfContext?: {
          coalescedCount?: number;
          coalescedTriggers?: string[];
          effectInstanceId?: number;
          perfEnabled?: boolean;
          scheduleId?: number;
          sceneName?: EAccountSelectorSceneName;
          selectionStateUpdatedAt?: number;
          selectionReason?: string;
          selectionTransitionId?: number;
          trigger?: string;
        };
        selectedAccount: IAccountSelectorSelectedAccount;
        shouldReload?: () => boolean;
      },
    ): Promise<IActiveAccountReloadResult> => {
      const perfEnabled =
        payload.perfContext?.perfEnabled ?? isAccountSelectorPerfDebugEnabled();
      const requestedAt = perfEnabled ? getAccountSelectorPerfTimestamp() : 0;
      const reloadId = perfEnabled
        ? getNextAccountSelectorPerfOperationId()
        : undefined;
      const transitionMeta = payload.perfContext?.selectionTransitionId
        ? {
            stateUpdatedAt: payload.perfContext.selectionStateUpdatedAt,
            reason: payload.perfContext.selectionReason,
            transitionId: payload.perfContext.selectionTransitionId,
          }
        : undefined;
      const traceTrigger = payload.perfContext?.trigger || 'direct';
      const traceReason = transitionMeta?.reason || traceTrigger;
      const traceSceneName =
        payload.perfContext?.sceneName ??
        get(accountSelectorContextDataAtom())?.sceneName;
      return this.mutex.runExclusive(async () => {
        const { serviceAccountSelector } = backgroundApiProxy;
        const { num, perfContext, selectedAccount, shouldReload } = payload;
        const startedAt = perfEnabled ? getAccountSelectorPerfTimestamp() : 0;
        const mutexWaitMs = Math.round(startedAt - requestedAt);
        const buildResultTiming = () => {
          const completedAt = getAccountSelectorPerfTimestamp();
          return {
            mutexWaitMs,
            selectionStateToResultMs: transitionMeta?.stateUpdatedAt
              ? Math.round(completedAt - transitionMeta.stateUpdatedAt)
              : undefined,
            totalMs: Math.round(completedAt - requestedAt),
            workMs: Math.round(completedAt - startedAt),
          };
        };
        if (perfEnabled) {
          defaultLogger.accountSelector.perf.trace('activeReloadStart', {
            coalescedCount: perfContext?.coalescedCount,
            coalescedTriggers: perfContext?.coalescedTriggers,
            effectInstanceId: perfContext?.effectInstanceId,
            mutexWaitMs,
            num,
            reason: traceReason,
            reloadId,
            scheduleId: perfContext?.scheduleId,
            sceneName: traceSceneName,
            selectionStateToStartMs: transitionMeta?.stateUpdatedAt
              ? Math.round(startedAt - transitionMeta.stateUpdatedAt)
              : undefined,
            transitionId: transitionMeta?.transitionId,
            trigger: traceTrigger,
          });
        }
        // console.log('buildActiveAccountInfoFromSelectedAccount', {
        // selectedAccount,
        // });
        const currentActiveAccount =
          get(activeAccountsAtom())?.[num] || defaultActiveAccountInfo();
        if (shouldReload && !shouldReload()) {
          if (perfEnabled) {
            defaultLogger.accountSelector.perf.trace('activeReloadResult', {
              ...buildResultTiming(),
              coalescedCount: perfContext?.coalescedCount,
              coalescedTriggers: perfContext?.coalescedTriggers,
              effectInstanceId: perfContext?.effectInstanceId,
              num,
              outcome: 'stale-schedule-before-build',
              reason: traceReason,
              reloadId,
              scheduleId: perfContext?.scheduleId,
              sceneName: traceSceneName,
              transitionId: transitionMeta?.transitionId,
              trigger: traceTrigger,
            });
          }
          return {
            activeAccount: currentActiveAccount,
            outcome: 'stale-schedule-before-build',
          };
        }
        const selectedAccountBeforeBuild =
          this.getSelectedAccount.call(set, { num }) ||
          defaultSelectedAccount();
        if (
          !isSameSelectedAccount(selectedAccountBeforeBuild, selectedAccount)
        ) {
          if (perfEnabled) {
            defaultLogger.accountSelector.perf.trace('activeReloadResult', {
              ...buildResultTiming(),
              coalescedCount: perfContext?.coalescedCount,
              coalescedTriggers: perfContext?.coalescedTriggers,
              effectInstanceId: perfContext?.effectInstanceId,
              num,
              outcome: 'stale-before-build',
              reason: traceReason,
              reloadId,
              scheduleId: perfContext?.scheduleId,
              sceneName: traceSceneName,
              transitionId: transitionMeta?.transitionId,
              trigger: traceTrigger,
            });
          }
          return {
            activeAccount: currentActiveAccount,
            outcome: 'stale-before-build',
          };
        }
        const markActiveAccountInitDone = () => {
          const initDone = get(accountSelectorActiveAccountInitDoneAtom());
          if (!initDone[num]) {
            set(accountSelectorActiveAccountInitDoneAtom(), {
              ...initDone,
              [num]: true,
            });
          }
        };
        if (
          shouldKeepCurrentActiveAccountForIncompleteSelection({
            storageInitDone: get(accountSelectorStorageInitDoneAtom()),
            selectedAccount,
            activeAccount: currentActiveAccount,
          })
        ) {
          markActiveAccountInitDone();
          if (perfEnabled) {
            defaultLogger.accountSelector.perf.trace('activeReloadResult', {
              ...buildResultTiming(),
              coalescedCount: perfContext?.coalescedCount,
              coalescedTriggers: perfContext?.coalescedTriggers,
              effectInstanceId: perfContext?.effectInstanceId,
              num,
              outcome: 'skip-incomplete',
              reason: traceReason,
              reloadId,
              scheduleId: perfContext?.scheduleId,
              sceneName: traceSceneName,
              transitionId: transitionMeta?.transitionId,
              trigger: traceTrigger,
            });
          }
          return {
            activeAccount: currentActiveAccount,
            outcome: 'skip-incomplete',
          };
        }
        let activeAccount: IAccountSelectorActiveAccountInfo | undefined;
        let buildOutcome: 'error-fallback' | 'partial' | 'success' = 'success';
        try {
          const bgRpcStartedAt = perfEnabled
            ? getAccountSelectorPerfTimestamp()
            : 0;
          const buildResult =
            await serviceAccountSelector.buildActiveAccountInfoFromSelectedAccount(
              {
                nonce: reloadId,
                selectedAccount,
              },
            );
          const perfTiming =
            'perfTiming' in buildResult
              ? (buildResult.perfTiming as
                  | {
                      bgTotalMs: number;
                      errorStages: string[];
                      stageMs: Record<string, number>;
                    }
                  | undefined)
              : undefined;
          activeAccount = buildResult.activeAccount;
          if (perfTiming?.errorStages.length) {
            buildOutcome = 'partial';
          }
          if (perfEnabled && perfTiming) {
            const bgRpcMs = Math.round(
              getAccountSelectorPerfTimestamp() - bgRpcStartedAt,
            );
            defaultLogger.accountSelector.perf.trace('activeBuildResult', {
              approximateRpcOverheadMs: Math.max(
                0,
                bgRpcMs - perfTiming.bgTotalMs,
              ),
              bgRpcMs,
              bgTotalMs: perfTiming.bgTotalMs,
              errorStages: perfTiming.errorStages,
              nonce: buildResult.nonce,
              reloadId,
              stageMs: perfTiming.stageMs,
            });
          }
        } catch (_error) {
          buildOutcome = 'error-fallback';
          activeAccount = {
            ...defaultActiveAccountInfo(),
            ready: true,
          };
        }
        // console.log('buildActiveAccountInfoFromSelectedAccount update state', {
        //   selectedAccount,
        //   activeAccount,
        // });
        const currentSelectedAccount =
          this.getSelectedAccount.call(set, { num }) ||
          defaultSelectedAccount();
        if (
          !isEqual(
            omitBy(currentSelectedAccount, isUndefined),
            omitBy(selectedAccount, isUndefined),
          )
        ) {
          if (perfEnabled) {
            defaultLogger.accountSelector.perf.trace('activeReloadResult', {
              ...buildResultTiming(),
              buildOutcome,
              coalescedCount: perfContext?.coalescedCount,
              coalescedTriggers: perfContext?.coalescedTriggers,
              effectInstanceId: perfContext?.effectInstanceId,
              num,
              outcome: 'stale-after-build',
              reason: traceReason,
              reloadId,
              scheduleId: perfContext?.scheduleId,
              sceneName: traceSceneName,
              transitionId: transitionMeta?.transitionId,
              trigger: traceTrigger,
            });
          }
          return {
            activeAccount: currentActiveAccount,
            outcome: 'stale-after-build',
          };
        }
        const latestActiveAccount =
          get(activeAccountsAtom())?.[num] || defaultActiveAccountInfo();
        if (isEqual(latestActiveAccount, activeAccount)) {
          markActiveAccountInitDone();
          if (perfEnabled) {
            defaultLogger.accountSelector.perf.trace('activeReloadResult', {
              activeAccount: buildActiveAccountPerfSummary(activeAccount),
              ...buildResultTiming(),
              buildOutcome,
              coalescedCount: perfContext?.coalescedCount,
              coalescedTriggers: perfContext?.coalescedTriggers,
              effectInstanceId: perfContext?.effectInstanceId,
              num,
              outcome: 'noop',
              reason: traceReason,
              reloadId,
              scheduleId: perfContext?.scheduleId,
              sceneName: traceSceneName,
              transitionId: transitionMeta?.transitionId,
              trigger: traceTrigger,
            });
          }
          return {
            activeAccount: latestActiveAccount,
            outcome: 'noop',
          };
        }
        const newActiveAccounts = {
          ...get(activeAccountsAtom()),
          [num]: activeAccount,
        };
        if (perfEnabled) {
          recordActiveAccountPerfStateUpdate({
            current: activeAccount,
            previous: latestActiveAccount,
            reloadId,
            scheduleId: perfContext?.scheduleId,
            trigger: traceTrigger,
          });
        }
        set(activeAccountsAtom(), newActiveAccounts);
        markActiveAccountInitDone();
        if (perfEnabled) {
          defaultLogger.accountSelector.perf.trace('activeReloadResult', {
            activeAccount: buildActiveAccountPerfSummary(activeAccount),
            ...buildResultTiming(),
            buildOutcome,
            coalescedCount: perfContext?.coalescedCount,
            coalescedTriggers: perfContext?.coalescedTriggers,
            effectInstanceId: perfContext?.effectInstanceId,
            num,
            outcome: 'commit',
            reason: traceReason,
            reloadId,
            scheduleId: perfContext?.scheduleId,
            sceneName: traceSceneName,
            transitionId: transitionMeta?.transitionId,
            trigger: traceTrigger,
          });
        }
        // contextAtom snapshot saving is now automatic via coldStartCache.
        return { activeAccount, outcome: 'commit' };
      });
    },
  );

  updateSelectedAccountFocusedWallet = contextAtomMethod(
    async (
      get,
      set,
      payload: {
        num: number;
        focusedWallet: string | undefined;
        reason?: string;
      },
    ) => {
      const { num, focusedWallet, reason } = payload;
      const focusedWalletFixed = focusedWallet;
      if (
        focusedWalletFixed &&
        accountUtils.isOthersWallet({ walletId: focusedWalletFixed })
      ) {
        // **** focus to grouped Others Tab
        // focusedWalletFixed = '$$others';
      }
      await this.updateSelectedAccount.call(set, {
        num,
        reason: reason || 'updateSelectedAccountFocusedWallet',
        builder: (v) => ({
          ...v,
          focusedWallet: focusedWalletFixed,
        }),
      });
    },
  );

  resolveOthersWalletAccountForNetworkSwitch = async ({
    selectedAccount,
    networkId,
  }: {
    selectedAccount: IAccountSelectorSelectedAccount | undefined;
    networkId: string;
  }): Promise<IAccountSelectorSelectedAccount> => {
    const nextSelectedAccount: IAccountSelectorSelectedAccount = {
      ...(selectedAccount || defaultSelectedAccount()),
      networkId,
    };
    const walletId = nextSelectedAccount.walletId;
    const othersWalletAccountId = nextSelectedAccount.othersWalletAccountId;

    if (
      !walletId ||
      !accountUtils.isOthersWallet({ walletId }) ||
      !othersWalletAccountId
    ) {
      return nextSelectedAccount;
    }

    if (networkUtils.isAllNetwork({ networkId })) {
      return nextSelectedAccount;
    }

    let currentAccount: IDBAccount | undefined;
    try {
      currentAccount = await serviceAccount.getDBAccount({
        accountId: othersWalletAccountId,
      });
    } catch {
      // Fall through to account lookup/fallback below.
    }

    const currentAccountMatchesTarget = safeIsAccountCompatibleWithNetwork({
      account: currentAccount,
      networkId,
    });

    if (currentAccountMatchesTarget) {
      return nextSelectedAccount;
    }

    try {
      const { accounts } = await serviceAccount.getSingletonAccountsOfWallet({
        walletId: walletId as IDBWalletIdSingleton,
        activeNetworkId: networkId,
      });
      const matchedAccount = accounts.find((account) =>
        safeIsAccountCompatibleWithNetwork({
          account,
          networkId,
        }),
      );

      if (matchedAccount) {
        const resolvedSelectedAccount = {
          ...nextSelectedAccount,
          walletId,
          focusedWallet: walletId,
          indexedAccountId: undefined,
          othersWalletAccountId: matchedAccount.id,
          deriveType: 'default' as const,
        };
        return resolvedSelectedAccount;
      }
    } catch {
      // Fall through to compatible-network fallback below.
    }

    const fallbackNetworkId = safeGetAccountCompatibleNetwork({
      account: currentAccount,
      networkId,
    });
    if (fallbackNetworkId && fallbackNetworkId !== networkId) {
      const resolvedSelectedAccount = {
        ...nextSelectedAccount,
        networkId: fallbackNetworkId,
      };
      return resolvedSelectedAccount;
    }

    return nextSelectedAccount;
  };

  repairOthersWalletNetworkPairsInSelectedAccountsMap = async ({
    selectedAccountsMap,
  }: {
    selectedAccountsMap: ISelectedAccountsAtomMap | undefined;
  }) => {
    if (!selectedAccountsMap) {
      return selectedAccountsMap;
    }

    const repairedSelectedAccountsMap = cloneDeep(selectedAccountsMap);

    await Promise.all(
      Object.entries(repairedSelectedAccountsMap).map(
        async ([numText, selectedAccount]) => {
          if (
            !selectedAccount?.networkId ||
            !selectedAccount.walletId ||
            !accountUtils.isOthersWallet({
              walletId: selectedAccount.walletId,
            }) ||
            !selectedAccount.othersWalletAccountId ||
            networkUtils.isAllNetwork({ networkId: selectedAccount.networkId })
          ) {
            return;
          }

          const resolvedSelectedAccount =
            await this.resolveOthersWalletAccountForNetworkSwitch({
              selectedAccount,
              networkId: selectedAccount.networkId,
            });

          if (
            !isEqual(
              omitBy(selectedAccount, isUndefined),
              omitBy(resolvedSelectedAccount, isUndefined),
            )
          ) {
            repairedSelectedAccountsMap[Number(numText)] =
              resolvedSelectedAccount;
          }
        },
      ),
    );

    return repairedSelectedAccountsMap;
  };

  isIncompatibleOthersWalletNetworkPair = async ({
    selectedAccount,
  }: {
    selectedAccount: IAccountSelectorSelectedAccount | undefined;
  }) => {
    const walletId = selectedAccount?.walletId;
    const networkId = selectedAccount?.networkId;
    const othersWalletAccountId = selectedAccount?.othersWalletAccountId;
    if (
      !walletId ||
      !networkId ||
      !othersWalletAccountId ||
      !accountUtils.isOthersWallet({ walletId }) ||
      networkUtils.isAllNetwork({ networkId })
    ) {
      return false;
    }

    let account: IDBAccount | undefined;
    try {
      account = await serviceAccount.getDBAccount({
        accountId: othersWalletAccountId,
      });
    } catch {
      return true;
    }

    return !safeIsAccountCompatibleWithNetwork({
      account,
      networkId,
    });
  };

  buildSelectedAccountWithoutWallet = ({
    selectedAccount,
  }: {
    selectedAccount: IAccountSelectorSelectedAccount | undefined;
  }): IAccountSelectorSelectedAccount => ({
    ...defaultSelectedAccount(),
    networkId: selectedAccount?.networkId,
    deriveType: selectedAccount?.deriveType,
  });

  getSelectedAccountWalletIdForAvailabilityCheck = ({
    selectedAccount,
  }: {
    selectedAccount: IAccountSelectorSelectedAccount | undefined;
  }) => {
    if (selectedAccount?.walletId) {
      return selectedAccount.walletId;
    }
    if (
      selectedAccount?.focusedWallet &&
      selectedAccount.focusedWallet !== '$$others'
    ) {
      return selectedAccount.focusedWallet;
    }
    return undefined;
  };

  isSelectedAccountWalletPersistentlyUnavailable = async ({
    selectedAccount,
  }: {
    selectedAccount: IAccountSelectorSelectedAccount | undefined;
  }): Promise<boolean> => {
    const walletId = this.getSelectedAccountWalletIdForAvailabilityCheck({
      selectedAccount,
    });
    if (!walletId) {
      return false;
    }
    if (
      !accountUtils.isHdWallet({ walletId }) &&
      !accountUtils.isHwOrQrWallet({ walletId })
    ) {
      return false;
    }

    const wallet = await serviceAccount.getWalletSafe({ walletId });
    const isMissingWallet = !wallet;
    return isMissingWallet || Boolean(wallet?.isMocked);
  };

  clearUnavailableWalletSelectionsInStorage = async ({
    selectedAccountsMapInDB,
    sceneName,
    sceneUrl,
    shouldContinue,
  }: {
    selectedAccountsMapInDB: IAccountSelectorSelectedAccountsMap | undefined;
    sceneName: EAccountSelectorSceneName;
    sceneUrl?: string;
    shouldContinue?: () => boolean;
  }) => {
    if (!selectedAccountsMapInDB) {
      return selectedAccountsMapInDB;
    }

    const selectedAccountsMap = cloneDeep(selectedAccountsMapInDB);
    const clearedEntries: {
      num: number;
      clearedSelectedAccount: IAccountSelectorSelectedAccount;
    }[] = [];

    await Promise.all(
      Object.entries(selectedAccountsMap).map(
        async ([numText, selectedAccount]) => {
          const isPersistentlyUnavailableWallet =
            await this.isSelectedAccountWalletPersistentlyUnavailable({
              selectedAccount,
            });
          if (!isPersistentlyUnavailableWallet) {
            return;
          }
          const num = Number(numText);
          const clearedSelectedAccount = this.buildSelectedAccountWithoutWallet(
            {
              selectedAccount,
            },
          );
          selectedAccountsMap[num] = clearedSelectedAccount;
          clearedEntries.push({
            num,
            clearedSelectedAccount,
          });
        },
      ),
    );

    if (!clearedEntries.length) {
      return selectedAccountsMapInDB;
    }

    if (shouldContinue && !shouldContinue()) {
      return selectedAccountsMap;
    }

    await Promise.all(
      clearedEntries.map(async ({ num, clearedSelectedAccount }) => {
        await this.savePersistentlyUnavailableWalletSelectionToStorage({
          sceneName,
          sceneUrl,
          num,
          selectedAccount: clearedSelectedAccount,
          trigger: 'init-clear-unavailable',
        });
      }),
    );

    return selectedAccountsMap;
  };

  savePersistentlyUnavailableWalletSelectionToStorage = async ({
    sceneName,
    sceneUrl,
    num,
    selectedAccount,
    trigger = 'unspecified',
  }: {
    sceneName: EAccountSelectorSceneName;
    sceneUrl?: string;
    num: number;
    selectedAccount: IAccountSelectorSelectedAccount;
    trigger?: string;
  }) => {
    const perfEnabled = isAccountSelectorPerfDebugEnabled();
    const requestedAt = perfEnabled ? getAccountSelectorPerfTimestamp() : 0;
    const operationId = perfEnabled
      ? getNextAccountSelectorPerfOperationId()
      : undefined;
    let phase = 'read-primary';
    let primaryPersisted = false;
    let primaryWriteAttempted = false;
    let homeWriteAttempted = false;
    let startedAt: number | undefined;
    let syncedHome = false;
    if (perfEnabled) {
      defaultLogger.accountSelector.perf.trace(
        'unavailableSelectionStorageRequested',
        { num, operationId, sceneName, trigger },
      );
    }
    try {
      await this.mutexSaveToStorage.runExclusive(async () => {
        startedAt = getAccountSelectorPerfTimestamp();
        const { serviceAccountSelector, simpleDb } = backgroundApiProxy;
        const currentSaved = await simpleDb.accountSelector.getSelectedAccount({
          sceneName,
          sceneUrl,
          num,
        });
        if (
          !isEqual(
            omitBy(currentSaved, isUndefined),
            omitBy(selectedAccount, isUndefined),
          )
        ) {
          phase = 'write-primary';
          primaryWriteAttempted = true;
          const primarySaveResult =
            await simpleDb.accountSelector.saveSelectedAccount({
              sceneName,
              sceneUrl,
              num,
              selectedAccount,
            });
          primaryPersisted = Boolean(primarySaveResult?.persisted);
        }

        if (
          sceneName !== EAccountSelectorSceneName.home &&
          (await serviceAccountSelector.shouldSyncWithHomeSource({
            sceneName,
            sceneUrl,
            num,
          }))
        ) {
          phase = 'read-home';
          const homeSelectedAccount =
            await simpleDb.accountSelector.getSelectedAccount({
              sceneName: EAccountSelectorSceneName.home,
              num: 0,
            });
          const newHomeSelectedAccount =
            accountSelectorUtils.buildMergedSelectedAccount({
              data: homeSelectedAccount,
              mergedByData: selectedAccount,
            });
          if (
            !isEqual(
              omitBy(homeSelectedAccount, isUndefined),
              omitBy(newHomeSelectedAccount, isUndefined),
            )
          ) {
            phase = 'write-home';
            homeWriteAttempted = true;
            const homeSaveResult =
              await simpleDb.accountSelector.saveSelectedAccount({
                sceneName: EAccountSelectorSceneName.home,
                num: 0,
                selectedAccount: newHomeSelectedAccount,
              });
            syncedHome = Boolean(homeSaveResult?.persisted);
          }
        }
      });
      if (perfEnabled) {
        const completedAt = getAccountSelectorPerfTimestamp();
        let outcome = 'noop-already-saved';
        if (primaryPersisted || syncedHome) {
          outcome = 'persisted';
        } else if (primaryWriteAttempted || homeWriteAttempted) {
          outcome = 'processed-nonpersistent';
        }
        defaultLogger.accountSelector.perf.trace(
          'unavailableSelectionStorageResult',
          {
            mutexWaitMs:
              startedAt === undefined
                ? undefined
                : Math.round(startedAt - requestedAt),
            num,
            operationId,
            outcome,
            primaryPersisted,
            sceneName,
            syncedHome,
            totalMs: Math.round(completedAt - requestedAt),
            trigger,
            workMs:
              startedAt === undefined
                ? undefined
                : Math.round(completedAt - startedAt),
          },
        );
      }
    } catch (error) {
      if (perfEnabled) {
        defaultLogger.accountSelector.perf.trace(
          'unavailableSelectionStorageResult',
          {
            failedPhase: phase,
            num,
            operationId,
            outcome: primaryPersisted || syncedHome ? 'partial' : 'error',
            primaryPersisted,
            sceneName,
            syncedHome,
            totalMs: Math.round(
              getAccountSelectorPerfTimestamp() - requestedAt,
            ),
            trigger,
          },
        );
      }
      throw error;
    }
  };

  updateSelectedAccountNetwork = contextAtomMethod(
    async (
      get,
      set,
      payload: {
        num: number;
        networkId: string;
        reason?: string;
      },
    ) => {
      const { num, networkId, reason } = payload;
      await this.updateSelectedAccount.call(set, {
        num,
        reason: reason || 'updateSelectedAccountNetwork',
        builder: (v) => ({
          ...v,
          networkId,
        }),
      });
    },
  );

  updateSelectedAccountDeriveType = contextAtomMethod(
    async (
      get,
      set,
      payload: {
        updateMeta?: IAccountSelectorUpdateMeta;
        num: number;
        deriveType: IAccountDeriveTypes;
        expectedSelection?: IAccountSelectorSelectedAccount;
        parentOperationId?: number;
        reason?: string;
      },
    ) => {
      const {
        num,
        deriveType,
        expectedSelection,
        parentOperationId,
        reason,
        updateMeta,
      } = payload;
      return this.updateSelectedAccount.call(set, {
        expectedSelection,
        updateMeta,
        num,
        parentOperationId,
        reason: reason || 'updateSelectedAccountDeriveType',
        builder: (v) => ({
          ...v,
          deriveType: deriveType || 'default',
        }),
      });
    },
  );

  updateSelectedAccountForHdOrHwAccount = contextAtomMethod(
    async (
      get,
      set,
      payload: {
        num: number;
        walletId: string | undefined;
        indexedAccountId: string | undefined;
      },
    ) => {
      const { num, walletId, indexedAccountId } = payload;
      await this.updateSelectedAccount.call(set, {
        num,
        reason: 'updateSelectedAccountForHdOrHwAccount',
        builder: (v) => ({
          ...v,
          walletId,
          indexedAccountId,
          othersWalletAccountId: undefined,
        }),
      });
    },
  );

  updateSelectedAccountForSingletonAccount = contextAtomMethod(
    async (
      get,
      set,
      payload: {
        num: number;
        networkId: string | undefined;
        walletId: IDBWalletIdSingleton;
        othersWalletAccountId: string | undefined;
      },
    ) => {
      const { num, walletId, networkId, othersWalletAccountId } = payload;
      await this.updateSelectedAccount.call(set, {
        num,
        reason: 'updateSelectedAccountForSingletonAccount',
        builder: (v) => ({
          ...v,
          networkId,
          walletId,
          othersWalletAccountId,
          focusedWallet: walletId,
          indexedAccountId: undefined,
        }),
      });
    },
  );

  getCurrentSceneInfo = contextAtomMethod(async (get) => {
    const contextData = get(accountSelectorContextDataAtom());
    return contextData;
  });

  mutexUpdateSelectedAccount = new Semaphore(1);

  updateSelectedAccount = contextAtomMethod(
    async (
      get,
      set,
      payload: {
        expectedSelection?: IAccountSelectorSelectedAccount;
        expectedUpdatedAt?: number | null;
        updateMeta?: IAccountSelectorUpdateMeta;
        num: number;
        parentOperationId?: number;
        reason?: string;
        shouldCommit?: () => boolean;
        builder: (
          oldAccount: IAccountSelectorSelectedAccount,
        ) => IAccountSelectorSelectedAccount;
      },
    ) => {
      const perfEnabled = isAccountSelectorPerfDebugEnabled();
      const requestedAt = perfEnabled ? getAccountSelectorPerfTimestamp() : 0;
      const attemptId = perfEnabled
        ? getNextAccountSelectorPerfOperationId()
        : undefined;
      const requestReason = payload.reason || 'updateSelectedAccount';
      if (perfEnabled) {
        defaultLogger.accountSelector.perf.trace('selectionUpdateRequested', {
          attemptId,
          num: payload.num,
          parentOperationId: payload.parentOperationId,
          reason: requestReason,
        });
      }
      return this.mutexUpdateSelectedAccount
        .runExclusive(async () => {
          const startedAt = perfEnabled ? getAccountSelectorPerfTimestamp() : 0;
          const sceneInfo = await this.getCurrentSceneInfo.call(set);
          // if (!contextData) {
          //   return;
          // }
          const {
            expectedSelection,
            expectedUpdatedAt,
            num,
            builder,
            parentOperationId,
            reason,
            shouldCommit,
            updateMeta,
          } = payload;
          const oldSelectedAccount: IAccountSelectorSelectedAccount = cloneDeep(
            this.getSelectedAccount.call(set, { num }) ||
              defaultSelectedAccount(),
          );
          const logSelectionUpdateResult = ({
            outcome,
            selectedAccount,
          }: {
            outcome: ISelectionUpdateOutcome;
            selectedAccount: IAccountSelectorSelectedAccount;
          }): ISelectionUpdateResult => {
            const transitionMeta =
              getSelectedAccountPerfCommitMeta(selectedAccount);
            if (perfEnabled) {
              const completedAt = getAccountSelectorPerfTimestamp();
              defaultLogger.accountSelector.perf.trace(
                'selectionUpdateResult',
                {
                  attemptId,
                  changedFields: getSelectedAccountChangedFields({
                    current: selectedAccount,
                    previous: oldSelectedAccount,
                  }),
                  mutexWaitMs: Math.round(startedAt - requestedAt),
                  num,
                  outcome,
                  parentOperationId,
                  reason: requestReason,
                  sceneName: sceneInfo?.sceneName,
                  totalMs: Math.round(completedAt - requestedAt),
                  transitionId:
                    outcome === 'commit'
                      ? transitionMeta?.transitionId
                      : undefined,
                  workMs: Math.round(completedAt - startedAt),
                },
              );
            }
            return {
              outcome,
              transitionId:
                outcome === 'commit' ? transitionMeta?.transitionId : undefined,
            };
          };
          if (perfEnabled) {
            defaultLogger.accountSelector.perf.trace('selectionUpdateStart', {
              attemptId,
              mutexWaitMs: Math.round(startedAt - requestedAt),
              num,
              parentOperationId,
              reason: requestReason,
              sceneName: sceneInfo?.sceneName,
            });
          }
          if (
            expectedUpdatedAt !== undefined &&
            get(accountSelectorUpdateMetaAtom())[num]?.updatedAt !==
              (expectedUpdatedAt ?? undefined)
          ) {
            return logSelectionUpdateResult({
              outcome: 'stale',
              selectedAccount: oldSelectedAccount,
            });
          }
          if (
            expectedSelection &&
            !isSameSelectedAccount(oldSelectedAccount, expectedSelection)
          ) {
            return logSelectionUpdateResult({
              outcome: 'stale',
              selectedAccount: oldSelectedAccount,
            });
          }

          const newSelectedAccount: IAccountSelectorSelectedAccount = cloneDeep(
            builder(oldSelectedAccount),
          );

          if (
            platformEnv.isWebDappMode
            // sceneInfo?.sceneName &&
            // ![EAccountSelectorSceneName.swap].includes(sceneInfo?.sceneName)
          ) {
            const oldIsNotAllNetwork =
              oldSelectedAccount.networkId &&
              oldSelectedAccount.networkId !== getNetworkIdsMap().onekeyall;
            const newIsNotAllNetwork =
              newSelectedAccount.networkId &&
              newSelectedAccount.networkId !== getNetworkIdsMap().onekeyall;
            if (newIsNotAllNetwork || oldIsNotAllNetwork) {
              newSelectedAccount.networkId = getNetworkIdsMap().onekeyall;
              newSelectedAccount.deriveType = 'default';
            }
          }

          if (
            isEqual(
              omitBy(oldSelectedAccount, isUndefined),
              omitBy(newSelectedAccount, isUndefined),
            )
          ) {
            return logSelectionUpdateResult({
              outcome: 'noop',
              selectedAccount: oldSelectedAccount,
            });
          }

          if (isEmpty(newSelectedAccount)) {
            return logSelectionUpdateResult({
              outcome: 'skip-empty',
              selectedAccount: newSelectedAccount,
            });
          }

          defaultLogger.accountSelector.storage.updateSelectedAccount({
            sceneName: sceneInfo?.sceneName,
            num,
            sceneUrl: sceneInfo?.sceneUrl,
            oldSelectedAccount,
            newSelectedAccount,
          });

          if (
            oldSelectedAccount.walletId &&
            oldSelectedAccount.indexedAccountId &&
            !newSelectedAccount.walletId &&
            !newSelectedAccount.indexedAccountId
          ) {
            // debugger;
          }

          if (
            sceneInfo?.sceneName === EAccountSelectorSceneName.discover &&
            oldSelectedAccount?.walletId?.startsWith('watching') &&
            newSelectedAccount?.walletId?.startsWith('hw-')
          ) {
            // debugger;
          }
          // if (
          //   sceneInfo?.sceneName === EAccountSelectorSceneName.discover &&
          //   sceneInfo?.sceneUrl?.startsWith('https://app.pendle.finance') &&
          //   newSelectedAccount?.deriveType === 'default'
          // ) {
          //   console.log('updateSelectedAccount deriveType: ', newSelectedAccount);
          // }

          const newNetworkId = newSelectedAccount?.networkId;
          const oldNetworkId = oldSelectedAccount?.networkId;
          const newDeriveType = newSelectedAccount?.deriveType;
          const oldDeriveType = oldSelectedAccount?.deriveType;
          // fix deriveType from global storage if change network only, as current deriveType is previous network's
          // **** important: remove this logic will cause infinite loop
          // if you want to change networkId and driveType at same time, you should call updateSelectedAccount twice, first change networkId, then change deriveType
          if (
            newNetworkId &&
            newNetworkId !== oldNetworkId &&
            newDeriveType === oldDeriveType
          ) {
            const fixDeriveTypeByGlobal = async ({
              sceneName,
            }: {
              sceneName: EAccountSelectorSceneName | undefined;
            }) => {
              const newDriveTypeFixed =
                await backgroundApiProxy.serviceAccountSelector.getGlobalDeriveType(
                  {
                    selectedAccount: newSelectedAccount,
                    sceneName,
                  },
                );
              if (newDriveTypeFixed) {
                newSelectedAccount.deriveType = newDriveTypeFixed;
              }
            };

            if (sceneInfo?.sceneName) {
              await fixDeriveTypeByGlobal({ sceneName: sceneInfo?.sceneName });

              const shouldUseGlobalDeriveType =
                await backgroundApiProxy.serviceAccountSelector.shouldUseGlobalDeriveType(
                  {
                    sceneName: sceneInfo?.sceneName,
                  },
                );
              if (
                !shouldUseGlobalDeriveType &&
                newSelectedAccount?.networkId &&
                newSelectedAccount?.deriveType
              ) {
                const isNewDeriveTypeAvailable =
                  await backgroundApiProxy.serviceNetwork.isDeriveTypeAvailableForNetwork(
                    {
                      networkId: newSelectedAccount?.networkId,
                      deriveType: newSelectedAccount?.deriveType,
                    },
                  );
                if (!isNewDeriveTypeAvailable) {
                  await fixDeriveTypeByGlobal({ sceneName: undefined });
                }
              }
            }
          }
          if (
            newSelectedAccount.indexedAccountId &&
            newSelectedAccount.othersWalletAccountId
          ) {
            if (
              newSelectedAccount.walletId &&
              !accountUtils.isOthersWallet({
                walletId: newSelectedAccount.walletId,
              })
            ) {
              newSelectedAccount.othersWalletAccountId = undefined;
            }
          }
          if (shouldCommit && !shouldCommit()) {
            return logSelectionUpdateResult({
              outcome: 'stale',
              selectedAccount: oldSelectedAccount,
            });
          }
          if (
            isEqual(
              omitBy(oldSelectedAccount, isUndefined),
              omitBy(newSelectedAccount, isUndefined),
            )
          ) {
            return logSelectionUpdateResult({
              outcome: 'noop',
              selectedAccount: oldSelectedAccount,
            });
          }
          this.setSelectedAccountsAtom(
            set,
            (v) => ({
              ...v,
              [num]: newSelectedAccount,
            }),
            reason || 'updateSelectedAccount',
            payload.parentOperationId,
          );
          set(accountSelectorUpdateMetaAtom(), (v) => ({
            ...v,
            [num]: {
              eventEmitDisabled: Boolean(updateMeta?.eventEmitDisabled),
              updatedAt: getNextSelectionUpdatedAt({
                currentUpdatedAt: v[num]?.updatedAt,
                requestedUpdatedAt: updateMeta?.updatedAt,
              }),
            },
          }));
          return logSelectionUpdateResult({
            outcome: 'commit',
            selectedAccount: newSelectedAccount,
          });
        })
        .catch((error: unknown) => {
          if (perfEnabled) {
            defaultLogger.accountSelector.perf.trace('selectionUpdateResult', {
              attemptId,
              num: payload.num,
              outcome: 'error',
              parentOperationId: payload.parentOperationId,
              reason: requestReason,
              totalMs: Math.round(
                getAccountSelectorPerfTimestamp() - requestedAt,
              ),
            });
          }
          throw error;
        });
    },
  );

  clearSelectedAccount = contextAtomMethod(
    async (
      get,
      set,
      payload: {
        num: number;
        clearAccount: boolean;
      },
    ) => {
      const { num, clearAccount } = payload;
      await this.updateSelectedAccount.call(set, {
        num,
        reason: 'clearSelectedAccount',
        builder: (v) => {
          const newValue = {
            ...v,
          };
          if (clearAccount) {
            newValue.walletId = undefined;
            newValue.indexedAccountId = undefined;
            newValue.othersWalletAccountId = undefined;
            newValue.focusedWallet = undefined;
          }
          return newValue;
        },
      });
    },
  );

  // Keyed by scene + selector num so concurrent selections in different
  // scenes cannot cancel each other.
  confirmAccountSelectLatestRequestIdMap = new Map<string, number>();

  confirmAccountSelectRequestSequence = 0;

  confirmAccountSelect = contextAtomMethod(
    async (
      get,
      set,
      params: {
        indexedAccount: IDBIndexedAccount | undefined;
        othersWalletAccount: IDBAccount | undefined;
        num: number;
        autoChangeToAccountMatchedNetworkId?: string;
        forceSelectToNetworkId?: string;
        reason?: string;
      },
    ) => {
      const {
        num,
        othersWalletAccount,
        indexedAccount,
        autoChangeToAccountMatchedNetworkId,
        forceSelectToNetworkId,
        reason = 'confirmAccountSelect',
      } = params;
      if (othersWalletAccount && indexedAccount) {
        throw new OneKeyLocalError(
          'confirmSelectAccount ERROR: othersWalletAccount and indexedAccount can not be both defined',
        );
      }
      if (!othersWalletAccount && !indexedAccount) {
        throw new OneKeyLocalError(
          'confirmSelectAccount ERROR: othersWalletAccount and indexedAccount can not be both undefined',
        );
      }
      const walletId = accountUtils.getWalletIdFromAccountId({
        accountId: indexedAccount?.id || othersWalletAccount?.id || '',
      });
      if (!walletId) {
        throw new OneKeyLocalError(
          'confirmSelectAccount ERROR: walletId is undefined',
        );
      }

      const requestContextData = get(accountSelectorContextDataAtom());
      const confirmRequestKey = `${requestContextData?.sceneName ?? ''}__${
        requestContextData?.sceneUrl ?? ''
      }__${num}`;
      const confirmRequestId = (this.confirmAccountSelectRequestSequence += 1);
      this.confirmAccountSelectLatestRequestIdMap.set(
        confirmRequestKey,
        confirmRequestId,
      );
      const perfEnabled = isAccountSelectorPerfDebugEnabled();
      const accountSelectStartedAt = perfEnabled
        ? getAccountSelectorPerfTimestamp()
        : 0;
      const accountSelectOperationId = perfEnabled
        ? getNextAccountSelectorPerfOperationId()
        : undefined;
      if (perfEnabled) {
        defaultLogger.accountSelector.perf.trace('accountSelectRequested', {
          accountKind: indexedAccount ? 'indexed' : 'others',
          num,
          operationId: accountSelectOperationId,
          reason,
          requestId: confirmRequestId,
          sceneName: requestContextData?.sceneName,
        });
      }

      let fallbackMs = 0;
      let fallbackOutcome: 'error' | 'not-needed' | 'success' = 'not-needed';
      let phase = 'validate-wallet';
      let stateOutcome: ISelectionUpdateOutcome | undefined;
      let transitionId: number | undefined;
      try {
        let wallet: IDBWallet | undefined;
        try {
          wallet = await serviceAccount.getWalletSafe({ walletId });
        } catch {
          if (perfEnabled) {
            defaultLogger.accountSelector.perf.trace('accountSelectResult', {
              accountKind: indexedAccount ? 'indexed' : 'others',
              num,
              operationId: accountSelectOperationId,
              outcome: 'wallet-check-error',
              phase,
              reason,
              requestId: confirmRequestId,
              totalMs: Math.round(
                getAccountSelectorPerfTimestamp() - accountSelectStartedAt,
              ),
            });
          }
          return false;
        }
        if (!wallet || wallet.isMocked) {
          if (perfEnabled) {
            defaultLogger.accountSelector.perf.trace('accountSelectResult', {
              accountKind: indexedAccount ? 'indexed' : 'others',
              num,
              operationId: accountSelectOperationId,
              outcome: 'unavailable-wallet',
              phase,
              reason,
              requestId: confirmRequestId,
              totalMs: Math.round(
                getAccountSelectorPerfTimestamp() - accountSelectStartedAt,
              ),
            });
          }
          return false;
        }
        if (
          this.confirmAccountSelectLatestRequestIdMap.get(confirmRequestKey) !==
          confirmRequestId
        ) {
          if (perfEnabled) {
            defaultLogger.accountSelector.perf.trace('accountSelectResult', {
              accountKind: indexedAccount ? 'indexed' : 'others',
              num,
              operationId: accountSelectOperationId,
              outcome: 'stale',
              phase,
              reason,
              requestId: confirmRequestId,
              totalMs: Math.round(
                getAccountSelectorPerfTimestamp() - accountSelectStartedAt,
              ),
            });
          }
          return false;
        }

        phase = 'resolve-network';
        const accountNetworkId: string =
          forceSelectToNetworkId ||
          this.getAutoSelectNetworkIdForAccount.call(set, {
            num,
            account: othersWalletAccount,
            autoChangeToAccountMatchedNetworkId,
          });

        const oldSelectedAccount: IAccountSelectorSelectedAccount = cloneDeep(
          this.getSelectedAccount.call(set, { num }) ||
            defaultSelectedAccount(),
        );

        // All Networks is a dead end when none of its enabled networks is
        // compatible with the target wallet (home renders a blank network
        // selector); fall back to the first compatible single chain instead.
        let resolvedNetworkId: string = accountNetworkId;
        const targetNetworkId =
          accountNetworkId || oldSelectedAccount.networkId;
        if (
          !platformEnv.isWebDappMode &&
          targetNetworkId &&
          networkUtils.isAllNetwork({ networkId: targetNetworkId }) &&
          !accountUtils.isOthersWallet({ walletId })
        ) {
          const fallbackStartedAt = perfEnabled
            ? getAccountSelectorPerfTimestamp()
            : 0;
          phase = 'fallback-network';
          try {
            const fallbackNetworkId =
              await backgroundApiProxy.serviceAllNetwork.getAllNetworksFallbackNetworkId(
                {
                  walletId,
                },
              );
            if (fallbackNetworkId) {
              resolvedNetworkId = fallbackNetworkId;
            }
            fallbackOutcome = 'success';
          } catch {
            // keep the All Networks selection if the check fails
            fallbackOutcome = 'error';
          } finally {
            if (perfEnabled) {
              fallbackMs = Math.round(
                getAccountSelectorPerfTimestamp() - fallbackStartedAt,
              );
            }
          }
        }

        // A newer selection may have started while the fallback query was in
        // flight; committing this stale result would overwrite the user's
        // latest choice, so drop it.
        if (
          this.confirmAccountSelectLatestRequestIdMap.get(confirmRequestKey) !==
          confirmRequestId
        ) {
          if (perfEnabled) {
            defaultLogger.accountSelector.perf.trace('accountSelectResult', {
              accountKind: indexedAccount ? 'indexed' : 'others',
              fallbackMs,
              num,
              operationId: accountSelectOperationId,
              outcome: 'stale',
              reason,
              requestId: confirmRequestId,
              totalMs: Math.round(
                getAccountSelectorPerfTimestamp() - accountSelectStartedAt,
              ),
            });
          }
          return false;
        }

        const shouldUseFastConfirm =
          !resolvedNetworkId ||
          resolvedNetworkId === oldSelectedAccount.networkId;
        phase = 'selection-update';
        const selectionResult = await this.updateSelectedAccount.call(set, {
          num,
          parentOperationId: accountSelectOperationId,
          reason,
          shouldCommit: () =>
            this.confirmAccountSelectLatestRequestIdMap.get(
              confirmRequestKey,
            ) === confirmRequestId,
          builder: (v) => ({
            ...v,
            networkId: resolvedNetworkId || v.networkId,
            walletId,
            othersWalletAccountId: othersWalletAccount?.id,
            indexedAccountId: indexedAccount?.id,
          }),
        });
        stateOutcome = selectionResult.outcome;
        transitionId = selectionResult.transitionId;

        if (stateOutcome === 'stale') {
          if (perfEnabled) {
            defaultLogger.accountSelector.perf.trace('accountSelectResult', {
              accountKind: indexedAccount ? 'indexed' : 'others',
              fallbackMs,
              fallbackOutcome,
              num,
              operationId: accountSelectOperationId,
              outcome: 'stale',
              phase,
              reason,
              requestId: confirmRequestId,
              stateOutcome,
              totalMs: Math.round(
                getAccountSelectorPerfTimestamp() - accountSelectStartedAt,
              ),
            });
          }
          return false;
        }

        const stateCommittedAt = perfEnabled
          ? getAccountSelectorPerfTimestamp()
          : 0;

        const sceneInfo = get(accountSelectorContextDataAtom());
        const selectedAccount = this.getSelectedAccount.call(set, { num });

        phase = 'recent-cache';
        this.setRecentAccountSelectorSelectionCache({
          sceneName: sceneInfo?.sceneName,
          sceneUrl: sceneInfo?.sceneUrl,
          num,
          selectedAccountsMap: get(selectedAccountsAtom()),
          updateMeta: get(accountSelectorUpdateMetaAtom()),
        });
        await this.flushRecentAccountSelectorSelectionCacheNowIfNeeded();

        if (
          this.confirmAccountSelectLatestRequestIdMap.get(confirmRequestKey) !==
          confirmRequestId
        ) {
          if (perfEnabled) {
            defaultLogger.accountSelector.perf.trace('accountSelectResult', {
              accountKind: indexedAccount ? 'indexed' : 'others',
              fallbackMs,
              fallbackOutcome,
              num,
              operationId: accountSelectOperationId,
              outcome: 'stale-after-commit',
              phase: 'recent-cache',
              reason,
              requestId: confirmRequestId,
              stateOutcome,
              totalMs: Math.round(
                getAccountSelectorPerfTimestamp() - accountSelectStartedAt,
              ),
              transitionId,
            });
          }
          return false;
        }

        void this.flushCurrentAccountSelectorColdStartSnapshot
          .call(set, {
            sceneName: sceneInfo?.sceneName,
            sceneUrl: sceneInfo?.sceneUrl,
          })
          .catch(() => undefined);

        if (sceneInfo?.sceneName) {
          void this.saveToStorage
            .call(set, {
              selectedAccount,
              sceneName: sceneInfo.sceneName,
              sceneUrl: sceneInfo.sceneUrl,
              num,
              trigger: 'confirm-explicit',
              selectedAccountUpdatedAt: get(accountSelectorUpdateMetaAtom())[
                num
              ]?.updatedAt,
            })
            .catch(() => undefined);
        }

        appEventBus.emit(EAppEventBusNames.ConfirmAccountSelected, {
          num,
          indexedAccountId: indexedAccount?.id,
          othersWalletAccountId: othersWalletAccount?.id,
        });
        if (perfEnabled) {
          defaultLogger.accountSelector.perf.trace('accountSelectResult', {
            accountKind: indexedAccount ? 'indexed' : 'others',
            fallbackMs,
            fallbackOutcome,
            fastPath: shouldUseFastConfirm,
            num,
            operationId: accountSelectOperationId,
            outcome: stateOutcome,
            reason,
            requestId: confirmRequestId,
            stateMs: Math.round(stateCommittedAt - accountSelectStartedAt),
            totalMs: Math.round(
              getAccountSelectorPerfTimestamp() - accountSelectStartedAt,
            ),
            transitionId,
          });
        }
        return true;
      } catch (error) {
        if (perfEnabled) {
          defaultLogger.accountSelector.perf.trace('accountSelectResult', {
            accountKind: indexedAccount ? 'indexed' : 'others',
            fallbackMs,
            fallbackOutcome,
            num,
            operationId: accountSelectOperationId,
            outcome: 'error',
            phase,
            reason,
            requestId: confirmRequestId,
            stateOutcome,
            totalMs: Math.round(
              getAccountSelectorPerfTimestamp() - accountSelectStartedAt,
            ),
            transitionId,
          });
        }
        throw error;
      } finally {
        if (
          this.confirmAccountSelectLatestRequestIdMap.get(confirmRequestKey) ===
          confirmRequestId
        ) {
          this.confirmAccountSelectLatestRequestIdMap.delete(confirmRequestKey);
        }
      }
    },
  );

  showAccountSelector = contextAtomMethod(
    async (
      get,
      set,
      {
        navigation,
        num,
        sceneName,
        sceneUrl,
        showConnectWalletModalInDappMode,
        ...others
      }: {
        navigation: ReturnType<typeof useAppNavigation>;
        showConnectWalletModalInDappMode?: boolean;
      } & IAccountSelectorRouteParams &
        IAccountSelectorRouteParamsExtraConfig,
    ) => {
      defaultLogger.accountSelector.perf.showAccountSelector({
        num,
        sceneName,
        sceneUrl,
      });

      const activeAccountInfo = this.getActiveAccount.call(set, { num });

      // In dapp mode, show the connect-wallet options whenever there is no
      // connected account. Key on the account (not the wallet record): a
      // just-disconnected external/keyless wallet can briefly linger as a wallet
      // with no account during the async reload, so matching DappHeader's
      // account-based "connected" check keeps the Connect button and its tap
      // target in sync — it always reopens the reconnect modal.
      const isWebDappMode = platformEnv.isWebDappMode;
      const hasAccount =
        activeAccountInfo?.account || activeAccountInfo?.indexedAccount;

      if (isWebDappMode && !hasAccount && showConnectWalletModalInDappMode) {
        navigation.pushModal(EModalRoutes.OnboardingModal, {
          screen: EOnboardingPages.ConnectWalletOptions,
        });
        return;
      }

      if (activeAccountInfo?.wallet?.id) {
        // focus to active wallet when open selector
        const focusedWalletNew: IAccountSelectorFocusedWallet =
          activeAccountInfo?.wallet?.id;
        await this.updateSelectedAccountFocusedWallet.call(set, {
          num,
          focusedWallet: focusedWalletNew,
          reason: 'openSelectorFocusActiveWallet',
        });
      }
      set(accountSelectorEditModeAtom(), false);

      let linkNetworkDeriveType: IAccountDeriveTypes | undefined;
      if (others.linkNetworkId) {
        linkNetworkDeriveType =
          others.linkNetworkDeriveType ||
          (await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork(
            {
              networkId: others.linkNetworkId,
            },
          ));
      }

      navigation.pushModal(EModalRoutes.AccountManagerStacks, {
        screen: EAccountManagerStacksRoutes.AccountSelectorStack,
        params: {
          num,
          sceneName,
          sceneUrl,
          ...others,
          linkNetworkDeriveType,
        },
      });
    },
  );

  showChainSelector = contextAtomMethod(
    (
      _,
      set,
      {
        navigation,
        ...routeParams
      }: {
        navigation: ReturnType<typeof useAppNavigation>;
      } & IAccountChainSelectorRouteParams,
    ) => {
      navigation.pushModal(EModalRoutes.ChainSelectorModal, {
        screen: EChainSelectorPages.AccountChainSelector,
        params: routeParams,
      });
    },
  );

  showUnifiedNetworkSelector = contextAtomMethod(
    (
      _,
      set,
      {
        navigation,
        ...routeParams
      }: {
        navigation: ReturnType<typeof useAppNavigation>;
      } & IUnifiedNetworkSelectorRouteParams,
    ) => {
      navigation.pushModal(EModalRoutes.ChainSelectorModal, {
        screen: EChainSelectorPages.UnifiedNetworkSelector,
        params: routeParams,
      });
    },
  );

  withFinalizeWalletSetupStep = contextAtomMethod(
    async (
      get,
      set,
      {
        createWalletFn,
        generatingAccountsFn,
      }: {
        createWalletFn: () => Promise<IFinalizeWalletSetupCreateWalletResult>;
        generatingAccountsFn?: (
          params: IFinalizeWalletSetupCreateWalletResult,
        ) => Promise<void>;
      },
    ) => {
      let createdResult: IFinalizeWalletSetupCreateWalletResult | null = null;
      try {
        appEventBus.emit(EAppEventBusNames.FinalizeWalletSetupStep, {
          step: EFinalizeWalletSetupSteps.CreatingWallet,
        });

        const [{ wallet, indexedAccount, hidden, isOverrideWallet }] =
          await Promise.all([createWalletFn(), timerUtils.wait(1000)]);
        createdResult = { wallet, indexedAccount, hidden, isOverrideWallet };

        if (generatingAccountsFn) {
          appEventBus.emit(EAppEventBusNames.FinalizeWalletSetupStep, {
            step: EFinalizeWalletSetupSteps.GeneratingAccounts,
          });

          await Promise.all([
            generatingAccountsFn({ wallet, indexedAccount, hidden }),
            timerUtils.wait(1000),
          ]);
        }

        appEventBus.emit(EAppEventBusNames.FinalizeWalletSetupStep, {
          step: EFinalizeWalletSetupSteps.Ready,
        });

        const createResult = {
          wallet,
          indexedAccount,
          isOverrideWallet,
        };
        return createResult;
      } catch (error) {
        // Cleanup only empty Ledger onboarding shells.
        const isLedgerWallet =
          createdResult?.wallet?.associatedDeviceInfo?.vendor ===
          EHardwareVendor.ledger;
        if (
          createdResult &&
          !createdResult.isOverrideWallet &&
          isLedgerWallet &&
          isHardwareErrorByCode({
            error: error as IOneKeyError | undefined,
            code: ORPHAN_ELIGIBLE_ERROR_CODES,
          })
        ) {
          const walletId = createdResult.wallet?.id;
          const indexedAccountId = createdResult.indexedAccount?.id;
          if (walletId && indexedAccountId) {
            try {
              const { accounts } =
                await serviceAccount.getAccountsInSameIndexedAccountId({
                  indexedAccountId,
                });
              if (accounts.length === 0) {
                await serviceAccount.removeFailedOnboardingHwWallet({
                  walletId,
                });
                // Advance selection off the just-removed walletId.
                await this.autoSelectNextAccount.call(set, {
                  num: 0,
                  triggerBy: EAccountSelectorAutoSelectTriggerBy.removeWallet,
                });
              }
            } catch (cleanupErr) {
              defaultLogger.app.error.log(
                `withFinalizeWalletSetupStep orphan cleanup failed: ${
                  (cleanupErr as Error)?.message || String(cleanupErr)
                }`,
              );
            }
          }
        }
        qrHiddenCreateGuideDialog.showDialogIfErrorMatched(error);
        appEventBus.emit(EAppEventBusNames.FinalizeWalletSetupError, {
          error: error as IOneKeyError,
        });
        throw error;
      }
    },
  );

  addDefaultNetworkAccounts = contextAtomMethod(
    async (
      get,
      set,
      params: {
        wallet: IDBWallet;
        indexedAccount: IDBIndexedAccount | undefined;
        skipDeviceCancel?: boolean;
        hideCheckingDeviceLoading?: boolean;
        autoHandleExitError?: boolean;
        isCreateWallet?: boolean;
      },
    ) => {
      const {
        wallet,
        indexedAccount,
        skipDeviceCancel,
        hideCheckingDeviceLoading,
        autoHandleExitError = true,
        isCreateWallet,
      } = params;
      defaultLogger.account.batchCreatePerf.addDefaultNetworkAccounts({
        wallet,
        indexedAccount,
      });
      const selectedAccount = this.getSelectedAccount.call(set, {
        num: 0,
      });
      const networkId = selectedAccount.networkId;
      const deriveType = selectedAccount.deriveType;
      // Multi-network fill = wallet creation, or add-account on the all-network
      // view. A specific-network (single) add keeps the per-app install prompt.
      const isAutoCreateMultiNetwork =
        !!isCreateWallet || networkUtils.isAllNetwork({ networkId });
      const isHwWallet = accountUtils.isHwWallet({ walletId: wallet.id });
      const customNetworks =
        networkId && deriveType ? [{ networkId, deriveType }] : undefined;
      let ledgerRequiredApps: ILedgerCoreAppName[] = [];
      let hardwareVendor: EHardwareVendor | undefined;
      let result: {
        addedAccounts: {
          networkId: string;
          deriveType: IAccountDeriveTypes;
        }[];
        failedAccounts: Array<{
          networkId: string;
          deriveType: IAccountDeriveTypes;
          error: IOneKeyError;
        }>;
      } = {
        addedAccounts: [],
        failedAccounts: [],
      };

      if (!params.wallet.isMocked) {
        if (isAutoCreateMultiNetwork && isHwWallet) {
          const device =
            await backgroundApiProxy.serviceAccount.getWalletDevice({
              walletId: wallet.id,
            });
          hardwareVendor = device?.vendor;
          if (hardwareVendor === EHardwareVendor.ledger) {
            ledgerRequiredApps =
              await backgroundApiProxy.serviceBatchCreateAccount.buildRequiredLedgerAppsForDefaultNetworkAccounts(
                {
                  walletId: wallet.id,
                  customNetworks,
                  isCreateWallet,
                },
              );
            if (ledgerRequiredApps.length > 0) {
              const ensureResult = await ensureLedgerCoreAppsReady({
                walletId: wallet.id,
                requiredApps: ledgerRequiredApps,
              });
              if (
                !shouldContinueLedgerAutoCreateForCoreAppsCheckResult(
                  ensureResult,
                )
              ) {
                return;
              }
            }
          }
        }

        result =
          await backgroundApiProxy.serviceBatchCreateAccount.addDefaultNetworkAccounts(
            {
              walletId: wallet.id,
              indexedAccountId: indexedAccount?.id,
              customNetworks,
              isCreateWallet,
              isAutoCreateMultiNetwork,
              skipDeviceCancel,
              hideCheckingDeviceLoading,
              autoHandleExitError,
            },
          );
      }

      if (autoHandleExitError) {
        void (async () => {
          let failedList = result?.failedAccounts || [];
          let isThirdPartyHw = false;

          // 3rd-party HW: drop AppNotInstalled when any chain succeeded.
          // Only Ledger offers in-app core-app install when zero chains succeed.
          if (failedList.length > 0) {
            isThirdPartyHw =
              await backgroundApiProxy.serviceAccount.isThirdPartyHwByWalletId({
                walletId: wallet.id,
              });
            if (isThirdPartyHw) {
              const { allAppNotInstalled, genuineFailures } =
                classifyThirdPartyHwCreateFailures({
                  addedCount: result.addedAccounts.length,
                  failedAccounts: failedList,
                });
              if (
                shouldOfferLedgerCoreAppInstallForCreateFailures({
                  vendor: hardwareVendor,
                  allAppNotInstalled,
                  isAutoCreateMultiNetwork,
                })
              ) {
                const ensureResult = await ensureLedgerCoreAppsReady({
                  walletId: wallet.id,
                  requiredApps: ledgerRequiredApps.length
                    ? ledgerRequiredApps
                    : undefined,
                });
                if (!ensureResult.ok) return;
                const retry =
                  await backgroundApiProxy.serviceBatchCreateAccount.addDefaultNetworkAccounts(
                    {
                      walletId: wallet.id,
                      indexedAccountId: indexedAccount?.id,
                      customNetworks,
                      isCreateWallet,
                      isAutoCreateMultiNetwork,
                      skipDeviceCancel,
                      hideCheckingDeviceLoading,
                      autoHandleExitError: false,
                    },
                  );
                failedList = retry?.failedAccounts || [];
                if (failedList.length === 0) return;
                const reClass = classifyThirdPartyHwCreateFailures({
                  addedCount: retry.addedAccounts.length,
                  failedAccounts: failedList,
                });
                if (reClass.allAppNotInstalled) return;
                failedList = reClass.genuineFailures;
              } else {
                failedList = genuineFailures;
              }
            }
          }

          const failedListForToast =
            isThirdPartyHw && failedList.length > 0
              ? filterThirdPartyHwCreateFailureToasts(failedList)
              : failedList;
          for (const failedAccount of failedListForToast) {
            const network = await backgroundApiProxy.serviceNetwork.getNetwork({
              networkId: failedAccount.networkId,
            });
            const deriveTypeInfo =
              await backgroundApiProxy.serviceNetwork.getDeriveInfoOfNetwork({
                networkId: failedAccount.networkId,
                deriveType: failedAccount.deriveType,
              });
            if (
              accountUtils.isQrWallet({
                walletId: wallet.id,
              })
            ) {
              // mute error toast for qr wallet
            } else {
              Toast.error({
                // eslint-disable-next-line onekey/no-app-locale-main-thread
                title: appLocale.intl.formatMessage(
                  {
                    id: ETranslations.feedback_hw_create_unsupported_address_title,
                  },
                  {
                    network: network?.name || failedAccount.networkId,
                    addressType:
                      deriveTypeInfo?.label || failedAccount.deriveType,
                  },
                ),
                message: failedAccount.error.message || 'Unknown error',
              });
            }
          }
        })();
      }

      return result;
    },
  );

  createHDWallet = contextAtomMethod(
    async (
      _,
      set,
      {
        mnemonic,
        isWalletBackedUp,
        isKeylessWallet,
        keylessDetailsInfo,
      }: {
        mnemonic: string;
        isWalletBackedUp?: boolean;
        isKeylessWallet?: boolean;
        keylessDetailsInfo?: IKeylessWalletDetailsInfo;
      },
    ) =>
      this.withFinalizeWalletSetupStep.call(set, {
        createWalletFn: async () => {
          // eslint-disable-next-line prefer-const
          let { wallet, indexedAccount, isOverrideWallet } =
            await serviceAccount.createHDWallet({
              mnemonic,
              isWalletBackedUp,
              isKeylessWallet,
              keylessDetailsInfo,
              // Cloud sync will query the Keyless wallet database. Querying during creation will cause the indexedDB transaction to automatically exit
              skipAddHDNextIndexedAccount: isKeylessWallet,
              // skipAddHDNextIndexedAccount: false,
            });
          if (!indexedAccount?.id) {
            // Pre-cache cloud sync credentials to reduce database operation time and avoid indexedDB transaction auto-commit
            await backgroundApiProxy.servicePrimeCloudSync.getSyncCredentialSafe();
            const { indexedAccountId } =
              await serviceAccount.addHDNextIndexedAccount({
                walletId: wallet.id,
              });
            indexedAccount = await serviceAccount.getIndexedAccountSafe({
              id: indexedAccountId,
            });
          }
          await this.autoSelectToCreatedWallet.call(set, {
            wallet,
            indexedAccount,
            isOverrideWallet,
          });
          return { wallet, indexedAccount, isOverrideWallet };
        },
        generatingAccountsFn: async ({ wallet, indexedAccount }) => {
          if (indexedAccount?.id) {
            await this.addDefaultNetworkAccounts.call(set, {
              wallet,
              indexedAccount,
              isCreateWallet: true,
            });
          }
          if (wallet.isKeyless) {
            void backgroundApiProxy.serviceKeylessCloudSync.autoEnableCloudSyncKeyless();
          }
        },
      }),
  );

  createHWWallet = contextAtomMethod(
    async (
      _,
      set,
      params: IDBCreateHwWalletParamsBase,
      options: { disableAutoSelect?: boolean } = {},
    ) => {
      const res = await serviceAccount.createHWWallet(params);
      const { wallet, indexedAccount, isOverrideWallet } = res;

      if (!options?.disableAutoSelect) {
        await this.autoSelectToCreatedWallet.call(set, {
          wallet,
          indexedAccount,
          isOverrideWallet,
          isAttachPinMode: params.isAttachPinMode,
        });
      }

      return res;
    },
  );

  createHWHiddenWallet = contextAtomMethod(
    async (
      _,
      set,
      {
        walletId,
        skipDeviceCancel,
        hideCheckingDeviceLoading,
      }: {
        walletId: string;
        skipDeviceCancel?: boolean;
        hideCheckingDeviceLoading?: boolean;
      },
      options: {
        showAddAccountsLoading?: boolean;
        addDefaultNetworkAccounts?: boolean;
      } = {},
    ) => {
      try {
        defaultLogger.account.wallet.addWalletStarted({
          addMethod: 'ConnectHWWallet',
          details: {
            hardwareWalletType: 'Hidden',
          },
          isSoftwareWalletOnlyUser:
            await backgroundApiProxy.serviceAccountProfile.isSoftwareWalletOnlyUser(),
        });
        const res = await serviceAccount.createHWHiddenWallet({
          walletId,
          skipDeviceCancel: options?.addDefaultNetworkAccounts
            ? true
            : skipDeviceCancel,
          hideCheckingDeviceLoading,
        });
        const { wallet, indexedAccount, isOverrideWallet, isAttachPinMode } =
          res;
        await this.autoSelectToCreatedWallet.call(set, {
          wallet,
          indexedAccount,
          isOverrideWallet,
          isAttachPinMode,
        });
        if (options?.addDefaultNetworkAccounts) {
          let dialog: IDialogInstance | undefined;
          try {
            if (options?.showAddAccountsLoading) {
              dialog = Dialog.show({
                // eslint-disable-next-line onekey/no-app-locale-main-thread
                title: appLocale.intl.formatMessage({
                  id: ETranslations.onboarding_finalize_generating_accounts,
                }),
                showCancelButton: false,
                showConfirmButton: false,
                dismissOnOverlayPress: false,
                showExitButton: false,
                showFooter: false,
                disableDrag: true,
                renderContent: <CommonDeviceLoading />,
              });
            }
            await this.addDefaultNetworkAccounts.call(set, {
              wallet,
              indexedAccount,
              isCreateWallet: true,
              skipDeviceCancel,
              hideCheckingDeviceLoading: options?.showAddAccountsLoading
                ? true
                : hideCheckingDeviceLoading,
            });
          } finally {
            await dialog?.close();
          }
        }
        return res;
      } catch (error) {
        qrHiddenCreateGuideDialog.showDialogIfErrorMatched(error);
        throw error;
      }
    },
  );

  createHWWalletWithoutHidden = contextAtomMethod(
    async (_, set, params: IDBCreateHwWalletParamsBase) => {
      return this.withFinalizeWalletSetupStep.call(set, {
        createWalletFn: async () => {
          const { wallet, indexedAccount, isOverrideWallet } =
            await this.createHWWallet.call(
              set,
              {
                ...params,
                skipDeviceCancel: true,
              },
              {
                // will autoSelect later by wallet is mocked or not
                disableAutoSelect: true,
              },
            );
          if (!wallet.isMocked && indexedAccount?.id) {
            // autoSelect account here
            await this.autoSelectToCreatedWallet.call(set, {
              wallet,
              indexedAccount,
              isOverrideWallet,
              isAttachPinMode: params.isAttachPinMode,
            });
          }
          await serviceAccount.restoreTempCreatedWallet({
            walletId: wallet.id,
          });
          return {
            isOverrideWallet,
            wallet,
            indexedAccount,
            hidden: undefined,
          };
        },
        generatingAccountsFn: async ({ wallet, indexedAccount }) => {
          await this.addDefaultNetworkAccounts.call(set, {
            wallet,
            indexedAccount,
            isCreateWallet: true,
            skipDeviceCancel: false,
            hideCheckingDeviceLoading: params.hideCheckingDeviceLoading,
          });
        },
      });
    },
  );

  createHWWalletWithHidden = contextAtomMethod(
    async (_, set, params: IDBCreateHwWalletParamsBase) =>
      this.withFinalizeWalletSetupStep.call(set, {
        createWalletFn: async () => {
          const shouldCreateHiddenWalletOnly = Boolean(
            params?.features?.passphrase_protection,
          );
          const { wallet, device, indexedAccount, isOverrideWallet } =
            await this.createHWWallet.call(
              set,
              {
                ...params,
                isMockedStandardHwWallet: shouldCreateHiddenWalletOnly,
                skipDeviceCancel: true,
              },
              {
                disableAutoSelect: true,
              },
            );

          let hiddenWalletCreatedResult:
            | {
                wallet: IDBWallet;
                indexedAccount: IDBIndexedAccount | undefined;
              }
            | undefined;
          // add hidden wallet if device passphrase enabled (SearchedDevice.features is cached in web sdk)
          if (device && shouldCreateHiddenWalletOnly) {
            // wait previous action done, wait device ready
            if (!params.hideCheckingDeviceLoading) {
              await backgroundApiProxy.serviceHardwareUI.showCheckingDeviceDialog(
                {
                  connectId: device.connectId,
                },
              );
            }
            await timerUtils.wait(100);

            hiddenWalletCreatedResult = await this.createHWHiddenWallet.call(
              set,
              {
                walletId: wallet.id,
                skipDeviceCancel: true,
                hideCheckingDeviceLoading: params.hideCheckingDeviceLoading,
              },
            );
          }

          await serviceAccount.restoreTempCreatedWallet({
            walletId: wallet.id,
          });
          if (!hiddenWalletCreatedResult) {
            await this.autoSelectToCreatedWallet.call(set, {
              wallet,
              indexedAccount,
              isOverrideWallet,
              isAttachPinMode: params.isAttachPinMode,
            });
          }

          return {
            isOverrideWallet,
            wallet,
            indexedAccount,
            hidden: hiddenWalletCreatedResult
              ? {
                  wallet: hiddenWalletCreatedResult?.wallet,
                  indexedAccount: hiddenWalletCreatedResult?.indexedAccount,
                }
              : undefined,
          };
        },
        generatingAccountsFn: async ({ wallet, indexedAccount, hidden }) => {
          if (hidden && hidden.wallet && hidden.indexedAccount) {
            // hidden wallet account should be first create before normal wallet account
            // otherwise, passphrase input will be asked many times
            await this.addDefaultNetworkAccounts.call(set, {
              wallet: hidden.wallet,
              indexedAccount: hidden.indexedAccount,
              isCreateWallet: true,
              skipDeviceCancel: true,
              hideCheckingDeviceLoading: params.hideCheckingDeviceLoading,
            });
            await timerUtils.wait(100);
          }
          if (wallet && indexedAccount) {
            await this.addDefaultNetworkAccounts.call(set, {
              wallet,
              indexedAccount,
              isCreateWallet: true,
              skipDeviceCancel: false,
              hideCheckingDeviceLoading: params.hideCheckingDeviceLoading,
            });
          }
        },
      }),
  );

  createQrWallet = contextAtomMethod(
    async (
      _,
      set,
      params: IDBCreateQRWalletParams & {
        isOnboarding?: boolean;
      },
    ) =>
      this.withFinalizeWalletSetupStep.call(set, {
        createWalletFn: async () => {
          const qrDevice = params?.qrDevice;
          const airGapAccounts = params?.airGapAccounts;
          if (!qrDevice) {
            throw new OneKeyLocalError('qrDevice is required');
          }
          const result = await serviceAccount.createQrWallet({
            qrDevice,
            airGapAccounts,
          });
          if (params?.isOnboarding) {
            await this.autoSelectToCreatedWallet.call(set, result);
          }
          return result;
        },
        generatingAccountsFn: async ({ wallet, indexedAccount }) => {
          if (params?.isOnboarding) {
            const result = await this.addDefaultNetworkAccounts.call(set, {
              wallet,
              indexedAccount,
              isCreateWallet: true,
            });
            const firstAccount = result?.addedAccounts?.[0];
            // All Networks is a dead end when none of its enabled networks
            // is compatible with the QR wallet (home renders a blank network
            // selector with no way to escape); fall back to the first created
            // account's network in that case.
            let shouldFallbackToFirstAccountNetwork = false;
            if (firstAccount) {
              try {
                const compatibleEnabledNetworks =
                  await backgroundApiProxy.serviceAllNetwork.getEnabledNetworksCompatibleWithWalletId(
                    {
                      walletId: wallet.id,
                    },
                  );
                shouldFallbackToFirstAccountNetwork =
                  compatibleEnabledNetworks.length === 0;
              } catch {
                // keep the All Networks default if the check fails
              }
            }
            // update networkId and deriveType matched with first account
            await this.updateSelectedAccount.call(set, {
              num: 0, // update home num selector
              reason: 'createQrWalletNetworkFallback',
              builder: (v) => {
                const currentNetworkSupport = result?.addedAccounts?.find(
                  (item) =>
                    item.networkId === v.networkId &&
                    item.deriveType === v.deriveType,
                );

                if (currentNetworkSupport || !firstAccount) {
                  return v;
                }

                if (shouldFallbackToFirstAccountNetwork) {
                  return {
                    ...v,
                    networkId: firstAccount.networkId,
                    deriveType: firstAccount.deriveType || 'default',
                  };
                }

                return {
                  ...v,
                  // networkId: firstAccount.networkId,
                  // deriveType: firstAccount.deriveType || 'default',
                  networkId: getNetworkIdsMap().onekeyall,
                  deriveType: 'default',
                };
              },
            });
          }
        },
      }),
  );

  createTonImportedWallet = contextAtomMethod(
    async (
      _,
      set,
      {
        mnemonic,
      }: {
        mnemonic: string;
      },
    ) => {
      try {
        appEventBus.emit(EAppEventBusNames.FinalizeWalletSetupStep, {
          step: EFinalizeWalletSetupSteps.CreatingWallet,
        });

        await Promise.all([
          (async () => {
            const r = await serviceAccount.addTonImportedAccountByMnemonic({
              mnemonic,
              name: '',
              shouldCheckDuplicateName: true,
            });
            const accountId = r?.accounts?.[0]?.id;
            await this.updateSelectedAccountForSingletonAccount.call(set, {
              num: 0,
              networkId: getNetworkIdsMap().ton,
              walletId: WALLET_TYPE_IMPORTED,
              othersWalletAccountId: accountId,
            });
          })(),
          timerUtils.wait(1000),
        ]);

        appEventBus.emit(EAppEventBusNames.FinalizeWalletSetupStep, {
          step: EFinalizeWalletSetupSteps.Ready,
        });
      } catch (error) {
        appEventBus.emit(EAppEventBusNames.FinalizeWalletSetupError, {
          error: error as IOneKeyError,
        });
        throw error;
      }
    },
  );

  updateHwWalletsDeprecatedStatus = contextAtomMethod(
    async (
      get,
      set,
      { connectId, deviceId }: { connectId: string; deviceId: string },
    ) => {
      if (!connectId || !deviceId) {
        return;
      }

      // Best-effort cleanup: callers run it after the wallet is already
      // created + committed; a throw must never fail that success path.
      try {
        const allHwWallets =
          await backgroundApiProxy.serviceAccount.getAllHwQrWalletWithDevice({
            filterHiddenWallet: false,
            filterQrWallet: true,
          });

        const willUpdateDeprecateMap: Record<string, boolean> = {};

        for (const walletWithDevice of Object.values(allHwWallets)) {
          const wallet = walletWithDevice.wallet;
          const device = walletWithDevice.device;

          if (wallet?.id && device?.connectId) {
            const isSameConnectId =
              device.connectId === connectId ||
              device.bleConnectId === connectId;
            const isSameDevice = device.deviceId === deviceId;

            // only handle wallet with same connectId
            if (isSameConnectId) {
              // if connectId is same, deviceId is different, the wallet should be deprecated
              // if connectId is same, deviceId is same, the wallet should be not deprecated
              const newDeprecatedStatus = !isSameDevice;
              willUpdateDeprecateMap[wallet.id] = newDeprecatedStatus;
            }
          }
        }

        const result =
          await backgroundApiProxy.serviceAccount.updateWalletsDeprecatedState({
            willUpdateDeprecateMap,
          });
        if (result && Object.keys(willUpdateDeprecateMap).length > 0) {
          appEventBus.emit(EAppEventBusNames.WalletUpdate, undefined);
        }
      } catch {
        defaultLogger.accountSelector.perf.trace(
          'walletDeprecatedStatusUpdateResult',
          { outcome: 'error', walletType: 'onekey-hardware' },
        );
      }
    },
  );

  // Trezor-only dedup — intentionally NOT sharing the OneKey path above.
  updateTrezorWalletsDeprecatedStatus = contextAtomMethod(
    async (
      get,
      set,
      { connectId, deviceId }: { connectId: string; deviceId: string },
    ) => {
      if (!connectId || !deviceId) {
        return;
      }

      // Best-effort cleanup: runs after the wallet is already created +
      // committed; a throw must never fail that success path.
      try {
        const allHwWallets =
          await backgroundApiProxy.serviceAccount.getAllHwQrWalletWithDevice({
            filterHiddenWallet: false,
            filterQrWallet: true,
          });

        const willUpdateDeprecateMap: Record<string, boolean> = {};

        for (const walletWithDevice of Object.values(allHwWallets)) {
          const wallet = walletWithDevice.wallet;
          const device = walletWithDevice.device;
          if (wallet?.id && device?.connectId) {
            // A Trezor device is reachable by any of its transport ids — match
            // the same key set the connection-status light uses.
            const walletConnectIds = [
              device.connectId,
              device.usbConnectId,
              device.bleConnectId,
            ].filter(Boolean);
            if (walletConnectIds.includes(connectId)) {
              // Same physical device but a different device_id (e.g. after a
              // reset) → the stored wallet is stale, mark it deprecated.
              const isSameDevice = device.deviceId === deviceId;
              willUpdateDeprecateMap[wallet.id] = !isSameDevice;
            }
          }
        }

        const result =
          await backgroundApiProxy.serviceAccount.updateWalletsDeprecatedState({
            willUpdateDeprecateMap,
          });
        if (result && Object.keys(willUpdateDeprecateMap).length > 0) {
          appEventBus.emit(EAppEventBusNames.WalletUpdate, undefined);
        }
      } catch {
        defaultLogger.accountSelector.perf.trace(
          'walletDeprecatedStatusUpdateResult',
          { outcome: 'error', walletType: 'trezor' },
        );
      }
    },
  );

  removeAccount = contextAtomMethod(
    async (
      get,
      set,
      {
        indexedAccount,
        account,
        isRemoveLastOthersAccount,
      }: {
        indexedAccount?: IDBIndexedAccount;
        account?: IDBAccount;
        isRemoveLastOthersAccount?: boolean;
      },
    ) => {
      // TODO add home scene check
      // const num = 0;
      await serviceAccount.removeAccount({ account, indexedAccount });
      // set(accountSelectorEditModeAtom(), false);
      if (accountUtils.isOthersAccount({ accountId: account?.id })) {
        await this.autoSelectNextAccount.call(set, {
          num: 0,
          triggerBy: isRemoveLastOthersAccount
            ? EAccountSelectorAutoSelectTriggerBy.removeLastOthersAccount
            : EAccountSelectorAutoSelectTriggerBy.removeAccount,
        });
      }
    },
  );

  removeWallet = contextAtomMethod(
    async (
      get,
      set,
      {
        walletId,
        isRemoveToMocked,
      }: {
        walletId: string;
        isRemoveToMocked?: boolean; // hw standard wallet mocked remove only
      },
    ) => {
      // TODO add home scene check
      const num = 0;
      set(accountSelectorSyncLoadingAtom(), {
        ...get(accountSelectorSyncLoadingAtom()),
        [num]: { isLoading: true },
      });
      try {
        await serviceAccount.removeWallet({
          walletId,
          isRemoveToMocked,
        });
        set(accountSelectorEditModeAtom(), false);

        await this.autoSelectNextAccount.call(set, {
          num,
          triggerBy: EAccountSelectorAutoSelectTriggerBy.removeWallet,
        });
      } finally {
        set(accountSelectorSyncLoadingAtom(), {
          ...get(accountSelectorSyncLoadingAtom()),
          [num]: { isLoading: false },
        });
      }
    },
  );

  mutexSyncHomeAndSwap = new Semaphore(1);

  syncHomeAndSwapSelectedAccount = contextAtomMethod(
    async (
      get,
      set,
      params: {
        sceneName: EAccountSelectorSceneName;
        sceneUrl?: string | undefined;
        num: number;
        eventPayload: {
          selectedAccount: IAccountSelectorSelectedAccount;
          selectedAccountUpdatedAt?: number;
          sceneName: EAccountSelectorSceneName;
          sceneUrl?: string | undefined;
          num: number;
          sourceOperationId?: number;
          sourceRuntimeId?: string;
          sourceTransitionId?: number;
          trigger?: string;
        };
      },
    ) => {
      const { serviceAccountSelector } = backgroundApiProxy;
      const perfEnabled = isAccountSelectorPerfDebugEnabled();
      const requestedAt = perfEnabled ? getAccountSelectorPerfTimestamp() : 0;
      const operationId = perfEnabled
        ? getNextAccountSelectorPerfOperationId()
        : undefined;
      let phase = 'mutex-wait';
      if (perfEnabled) {
        defaultLogger.accountSelector.perf.trace('crossSceneSyncRequested', {
          num: params.num,
          operationId,
          sourceNum: params.eventPayload.num,
          sourceOperationId: params.eventPayload.sourceOperationId,
          sourceRuntimeId: params.eventPayload.sourceRuntimeId,
          sourceSceneName: params.eventPayload.sceneName,
          sourceTransitionId: params.eventPayload.sourceTransitionId,
          targetSceneName: params.sceneName,
          trigger: params.eventPayload.trigger,
        });
      }
      return this.mutexSyncHomeAndSwap
        .runExclusive(async () => {
          const startedAt = getAccountSelectorPerfTimestamp();
          const { sceneName, sceneUrl, num, eventPayload } = params;
          const logCrossSceneResult = ({
            outcome,
            transitionId,
          }: {
            outcome: string;
            transitionId?: number;
          }) => {
            if (!perfEnabled) {
              return;
            }
            const completedAt = getAccountSelectorPerfTimestamp();
            defaultLogger.accountSelector.perf.trace('crossSceneSyncResult', {
              eventAgeMs: eventPayload.selectedAccountUpdatedAt
                ? Math.max(
                    0,
                    Date.now() - eventPayload.selectedAccountUpdatedAt,
                  )
                : undefined,
              mutexWaitMs: Math.round(startedAt - requestedAt),
              num,
              operationId,
              outcome,
              sourceNum: eventPayload.num,
              sourceOperationId: eventPayload.sourceOperationId,
              sourceRuntimeId: eventPayload.sourceRuntimeId,
              sourceSceneName: eventPayload.sceneName,
              sourceTransitionId: eventPayload.sourceTransitionId,
              targetSceneName: sceneName,
              totalMs: Math.round(completedAt - requestedAt),
              transitionId,
              trigger: eventPayload.trigger,
              workMs: Math.round(completedAt - startedAt),
            });
          };

          if (
            accountSelectorUtils.isEqualAccountSelectorScene({
              scene1: { sceneName, sceneUrl, num },
              scene2: eventPayload,
            })
          ) {
            logCrossSceneResult({ outcome: 'skip-same-scene' });
            return { outcome: 'skip-same-scene' };
          }

          phase = 'sync-policy';
          const shouldSync =
            await serviceAccountSelector.shouldSyncHomeAndSwapSelectedAccount({
              sourceScene: eventPayload,
              targetScene: {
                sceneName,
                sceneUrl,
                num,
              },
            });

          if (!shouldSync) {
            logCrossSceneResult({ outcome: 'skip-policy' });
            return { outcome: 'skip-policy' };
          }
          if (shouldSync) {
            // Drop stale cross-scene sync events: a slow swap<->home event must
            // not overwrite a selection the user has changed since it was sent.
            const eventPayloadUpdatedAt = eventPayload.selectedAccountUpdatedAt;
            const currentUpdatedAt = get(accountSelectorUpdateMetaAtom())[num]
              ?.updatedAt;
            if (
              eventPayloadUpdatedAt &&
              currentUpdatedAt &&
              currentUpdatedAt >= eventPayloadUpdatedAt
            ) {
              logCrossSceneResult({ outcome: 'stale-before-fix' });
              return { outcome: 'stale-before-fix' };
            }
            const current = this.getSelectedAccount.call(set, { num });
            let newSelectedAccount =
              accountSelectorUtils.buildMergedSelectedAccount({
                data: current,
                mergedByData: eventPayload.selectedAccount,
              });
            phase = 'fix-selection';
            newSelectedAccount =
              await serviceAccountSelector.fixOthersWalletAccountNetworkPair({
                selectedAccount: newSelectedAccount,
                source: 'syncHomeAndSwapSelectedAccount',
              });
            phase = 'selection-update';
            const selectionResult = await this.updateSelectedAccount.call(set, {
              expectedSelection: current,
              expectedUpdatedAt: currentUpdatedAt ?? null,
              parentOperationId: operationId,
              updateMeta: {
                eventEmitDisabled: true, // stop update infinite loop here
                updatedAt: eventPayload.selectedAccountUpdatedAt ?? Date.now(),
              },
              num,
              reason: 'syncHomeAndSwapSelectedAccount',
              builder(v) {
                return newSelectedAccount || v;
              },
            });
            logCrossSceneResult({
              outcome: selectionResult.outcome,
              transitionId: selectionResult.transitionId,
            });
            return selectionResult;
          }
          logCrossSceneResult({ outcome: 'skip-policy' });
          return { outcome: 'skip-policy' };
        })
        .catch((error: unknown) => {
          if (perfEnabled) {
            defaultLogger.accountSelector.perf.trace('crossSceneSyncResult', {
              num: params.num,
              operationId,
              outcome: 'error',
              phase,
              sourceNum: params.eventPayload.num,
              sourceOperationId: params.eventPayload.sourceOperationId,
              sourceRuntimeId: params.eventPayload.sourceRuntimeId,
              sourceTransitionId: params.eventPayload.sourceTransitionId,
              targetSceneName: params.sceneName,
              totalMs: Math.round(
                getAccountSelectorPerfTimestamp() - requestedAt,
              ),
            });
          }
          throw error;
        });
    },
  );

  reloadSwapToAccountFromHome = contextAtomMethod(async (get, set) => {
    // const swapMap =
    //   await backgroundApiProxy.simpleDb.accountSelector.getSelectedAccountsMap({
    //     sceneName: EAccountSelectorSceneName.swap,
    //   });
    const swapMap = get(selectedAccountsAtom());
    const newMap =
      await backgroundApiProxy.serviceAccountSelector.mergeHomeDataToSwapMap({
        swapMap,
      });
    await this.updateSelectedAccount.call(set, {
      num: 1,
      reason: 'reloadSwapToAccountFromHome',
      builder(v) {
        return newMap?.[1] || v;
      },
    });
  });

  mutexSyncLocalDeriveType = new Semaphore(1);

  syncLocalDeriveTypeFromGlobal = contextAtomMethod(
    async (
      get,
      set,
      {
        num,
        parentOperationId,
        sceneName,
        source = 'unspecified',
      }: {
        num: number;
        sceneName: EAccountSelectorSceneName;
        sceneUrl?: string | undefined;
        source?: string;
        parentOperationId?: number;
      },
    ) => {
      const perfEnabled = isAccountSelectorPerfDebugEnabled();
      const requestedAt = perfEnabled ? getAccountSelectorPerfTimestamp() : 0;
      const operationId = perfEnabled
        ? getNextAccountSelectorPerfOperationId()
        : undefined;
      let phase = 'mutex-wait';
      let startedAt: number | undefined;
      const logResult = (outcome: string, transitionId?: number) => {
        if (!perfEnabled) {
          return;
        }
        const completedAt = getAccountSelectorPerfTimestamp();
        defaultLogger.accountSelector.perf.trace('autoDeriveSyncResult', {
          mutexWaitMs:
            startedAt === undefined
              ? undefined
              : Math.round(startedAt - requestedAt),
          num,
          operationId,
          outcome,
          parentOperationId,
          phase,
          sceneName,
          source,
          totalMs: Math.round(completedAt - requestedAt),
          transitionId,
          workMs:
            startedAt === undefined
              ? undefined
              : Math.round(completedAt - startedAt),
        });
      };
      if (perfEnabled) {
        defaultLogger.accountSelector.perf.trace('autoDeriveSyncRequested', {
          num,
          operationId,
          parentOperationId,
          sceneName,
          source,
        });
      }
      return this.mutexSyncLocalDeriveType
        .runExclusive(async () => {
          startedAt = perfEnabled
            ? getAccountSelectorPerfTimestamp()
            : undefined;
          const selectedAccount = this.getSelectedAccount.call(set, {
            num,
          });
          phase = 'get-global-derive';
          const globalDeriveType =
            await backgroundApiProxy.serviceAccountSelector.getGlobalDeriveType(
              {
                selectedAccount,
                sceneName,
              },
            );
          if (!globalDeriveType) {
            logResult('no-global-derive');
            return { globalDeriveType: undefined, selectionResult: undefined };
          }
          if (selectedAccount.deriveType === globalDeriveType) {
            const selectionResult: ISelectionUpdateResult = {
              outcome: 'noop',
            };
            phase = 'skip-already-selected';
            logResult('noop-already-selected');
            return { globalDeriveType, selectionResult };
          }
          phase = 'update-selection';
          const selectionResult =
            await this.updateSelectedAccountDeriveType.call(set, {
              updateMeta: {
                eventEmitDisabled: true, // stop update infinite loop here
                updatedAt: Date.now(),
              },
              num,
              deriveType: globalDeriveType,
              expectedSelection: selectedAccount,
              parentOperationId: operationId,
              reason: 'autoDeriveGlobalSync',
            });
          logResult(selectionResult.outcome, selectionResult.transitionId);
          return { globalDeriveType, selectionResult };
        })
        .catch((error: unknown) => {
          logResult('error');
          throw error;
        });
    },
  );

  initFromStorageGenerationMap = new Map<string, number>();

  initFromStorage = contextAtomMethod(
    async (
      get,
      set,
      {
        sceneName,
        sceneUrl,
        trigger = 'direct',
      }: {
        sceneName: EAccountSelectorSceneName;
        sceneUrl?: string;
        trigger?: string;
      },
    ) => {
      const initScopeKey = `${sceneName}:${sceneUrl || ''}`;
      const generation =
        (this.initFromStorageGenerationMap.get(initScopeKey) || 0) + 1;
      this.initFromStorageGenerationMap.set(initScopeKey, generation);
      const isLatestGeneration = () =>
        this.initFromStorageGenerationMap.get(initScopeKey) === generation;
      const perfEnabled = isAccountSelectorPerfDebugEnabled();
      const operationId = perfEnabled
        ? getNextAccountSelectorPerfOperationId()
        : undefined;
      const requestedAt = perfEnabled ? getAccountSelectorPerfTimestamp() : 0;
      const initialSelectedAccountsMap = perfEnabled
        ? get(selectedAccountsAtom())
        : undefined;
      const initialSelectionCount = initialSelectedAccountsMap
        ? Object.keys(initialSelectedAccountsMap).length
        : 0;
      const stageMs: Record<string, number> = {};
      let phase = 'read-primary';
      let phaseStartedAt = requestedAt;
      let resultLogged = false;
      let storageApplied = false;
      let storageSelectionCount: number | undefined;
      let recentSelectionCount: number | undefined;
      const startPhase = (nextPhase: string) => {
        if (perfEnabled) {
          const now = getAccountSelectorPerfTimestamp();
          stageMs[phase] = Math.round(now - phaseStartedAt);
          phaseStartedAt = now;
        }
        phase = nextPhase;
      };
      const logResult = (outcome: string) => {
        if (!perfEnabled || resultLogged) {
          return;
        }
        resultLogged = true;
        const completedAt = getAccountSelectorPerfTimestamp();
        stageMs[phase] = Math.round(completedAt - phaseStartedAt);
        const finalSelectedAccountsMap = get(selectedAccountsAtom());
        const changedNumCount = initialSelectedAccountsMap
          ? Array.from(
              new Set([
                ...Object.keys(initialSelectedAccountsMap),
                ...Object.keys(finalSelectedAccountsMap),
              ]),
            ).filter(
              (numText) =>
                !isEqual(
                  initialSelectedAccountsMap[Number(numText)],
                  finalSelectedAccountsMap[Number(numText)],
                ),
            ).length
          : 0;
        defaultLogger.accountSelector.perf.trace('storageInitResult', {
          changedNumCount,
          failedPhase: outcome === 'error-finalized' ? phase : undefined,
          finalSelectionCount: Object.keys(finalSelectedAccountsMap).length,
          hasSceneUrl: Boolean(sceneUrl),
          generation,
          initialSelectionCount,
          operationId,
          outcome,
          phase,
          recentSelectionCount,
          sceneName,
          stageMs,
          storageApplied,
          storageSelectionCount,
          totalMs: Math.round(completedAt - requestedAt),
          trigger,
        });
      };
      const abortIfStale = () => {
        if (isLatestGeneration()) {
          return false;
        }
        logResult(`stale-${phase}`);
        return true;
      };
      if (perfEnabled) {
        defaultLogger.accountSelector.perf.trace('storageInitRequested', {
          generation,
          hasSceneUrl: Boolean(sceneUrl),
          initialSelectionCount,
          operationId,
          sceneName,
          trigger,
        });
      }
      set(accountSelectorStorageInitDoneAtom(), () => false);
      set(accountSelectorActiveAccountInitDoneAtom(), {});
      try {
        const { serviceAccountSelector } = backgroundApiProxy;
        let selectedAccountsMapInDB:
          | IAccountSelectorSelectedAccountsMap
          | undefined =
          await backgroundApiProxy.simpleDb.accountSelector.getSelectedAccountsMap(
            {
              sceneName,
              sceneUrl,
            },
          );
        if (abortIfStale()) {
          return;
        }
        storageSelectionCount = selectedAccountsMapInDB
          ? Object.keys(selectedAccountsMapInDB).length
          : 0;

        defaultLogger.accountSelector.listData.simpleDbSelectedAccountsMap({
          selectedAccountsMap: selectedAccountsMapInDB,
        });

        // fix discover account from dappConnection
        if (sceneUrl && sceneName === EAccountSelectorSceneName.discover) {
          startPhase('discover-connection');
          const connectionMap =
            await backgroundApiProxy.simpleDb.dappConnection.getAccountSelectorMap(
              {
                sceneUrl,
              },
            );
          if (abortIfStale()) {
            return;
          }
          defaultLogger.accountSelector.listData.simpleDbDappConnectionSelectedAccountsMap(
            {
              connectionMap,
            },
          );
          if (connectionMap) {
            const map: IAccountSelectorSelectedAccountsMap = {};
            Object.entries(connectionMap).forEach(([num, v]) => {
              map[Number(num)] = {
                walletId: v.walletId,
                indexedAccountId: v.indexedAccountId,
                othersWalletAccountId: v.othersWalletAccountId,
                networkId: v.networkId,
                deriveType: v.deriveType,
                focusedWallet: v.focusedWallet,
              };
              map[Number(num)] = omitBy(map[Number(num)], isUndefined) as any;
            });
            selectedAccountsMapInDB = map;
            defaultLogger.accountSelector.listData.initFromStorageDiscoverySelectedAccountsMapMerged(
              {
                selectedAccountsMap: selectedAccountsMapInDB,
              },
            );
          }
        }

        if (selectedAccountsMapInDB) {
          selectedAccountsMapInDB = cloneDeep(selectedAccountsMapInDB);
        }

        // fix swap account from home
        if (sceneName === EAccountSelectorSceneName.swap) {
          startPhase('swap-merge');
          selectedAccountsMapInDB =
            await serviceAccountSelector.mergeHomeDataToSwapMap({
              swapMap: selectedAccountsMapInDB,
            });
          if (abortIfStale()) {
            return;
          }
        }

        // fix derive type from global
        if (selectedAccountsMapInDB) {
          startPhase('normalize-storage');
          selectedAccountsMapInDB =
            await backgroundApiProxy.serviceAccountSelector.fixDeriveTypesForInitAccountSelectorMap(
              {
                selectedAccountsMapInDB,
                sceneName,
                sceneUrl,
              },
            );
          if (abortIfStale()) {
            return;
          }
          defaultLogger.accountSelector.listData.fixDeriveTypesForInitAccountSelectorMapResult(
            {
              selectedAccountsMap: selectedAccountsMapInDB,
            },
          );
          selectedAccountsMapInDB =
            await this.repairOthersWalletNetworkPairsInSelectedAccountsMap({
              selectedAccountsMap: selectedAccountsMapInDB,
            });
          if (abortIfStale()) {
            return;
          }
          selectedAccountsMapInDB =
            await this.clearUnavailableWalletSelectionsInStorage({
              selectedAccountsMapInDB,
              sceneName,
              sceneUrl,
              shouldContinue: isLatestGeneration,
            });
          if (abortIfStale()) {
            return;
          }
        }

        // OK-57139: the dApp connection record loaded above is the single
        // source of truth for discover scenes; background keeps re-aligning
        // it to the wallet account. Cold-start keep/restore must not
        // resurrect a stale browser-side selection over it, or the stale
        // account gets written back into the connection session and then
        // into the wallet home account. (getRecentAccountSelectorSelectionCache
        // already returns undefined for discover scenes.)
        const isDappConnectionBackedScene =
          sceneName === EAccountSelectorSceneName.discover;

        const recentSelectionCache =
          this.getRecentAccountSelectorSelectionCache({
            sceneName,
            sceneUrl,
          });
        startPhase('recent-selection');
        let recentSelectionCacheSelectedAccountsMap:
          | IAccountSelectorSelectedAccountsMap
          | undefined;
        if (recentSelectionCache) {
          const repairedRecentSelectionCache =
            await this.repairOthersWalletNetworkPairsInSelectedAccountsMap({
              selectedAccountsMap: recentSelectionCache.selectedAccountsMap,
            });
          if (abortIfStale()) {
            return;
          }
          recentSelectionCacheSelectedAccountsMap =
            await this.clearUnavailableWalletSelectionsInStorage({
              selectedAccountsMapInDB: repairedRecentSelectionCache,
              sceneName,
              sceneUrl,
              shouldContinue: isLatestGeneration,
            });
          if (abortIfStale()) {
            return;
          }
        }
        recentSelectionCount = recentSelectionCacheSelectedAccountsMap
          ? Object.keys(recentSelectionCacheSelectedAccountsMap).length
          : 0;
        if (
          recentSelectionCache &&
          recentSelectionCacheSelectedAccountsMap &&
          this.shouldKeepColdStartSelectedAccounts({
            selectedAccountsMap: recentSelectionCacheSelectedAccountsMap,
            selectedAccountsMapInDB,
            updateMeta: recentSelectionCache.updateMeta,
          })
        ) {
          const mergedRecentSelectionCacheSelectedAccountsMap =
            this.mergeColdStartSelectedAccountsWithStorage({
              selectedAccountsMap: recentSelectionCacheSelectedAccountsMap,
              selectedAccountsMapInDB,
            });
          this.setSelectedAccountsAtom(
            set,
            () => mergedRecentSelectionCacheSelectedAccountsMap,
            'initFromRecentSelectionCache',
            operationId,
          );
          set(accountSelectorUpdateMetaAtom(), (v) => ({
            ...v,
            ...recentSelectionCache.updateMeta,
          }));
          set(accountSelectorStorageReadyAtom(), () => true);
          set(accountSelectorStorageInitDoneAtom(), () => true);
          Object.entries(recentSelectionCacheSelectedAccountsMap).forEach(
            ([num, selectedAccount]) => {
              if (
                selectedAccount &&
                !isEqual(selectedAccount, defaultSelectedAccount())
              ) {
                void this.saveToStorage
                  .call(set, {
                    selectedAccount,
                    sceneName,
                    sceneUrl,
                    num: Number(num),
                    trigger: 'init-recent-cache',
                    selectedAccountUpdatedAt:
                      recentSelectionCache.updateMeta[Number(num)]?.updatedAt,
                  })
                  .catch(() => undefined);
              }
            },
          );
          logResult('restored-recent-cache');
          return;
        }

        startPhase('current-selection');
        const currentSelectedAccountsMap = get(selectedAccountsAtom());
        const repairedSelectedAccountsMap =
          await this.repairOthersWalletNetworkPairsInSelectedAccountsMap({
            selectedAccountsMap: currentSelectedAccountsMap,
          });
        if (abortIfStale()) {
          return;
        }
        const selectedAccountsMap =
          (await this.clearUnavailableWalletSelectionsInStorage({
            selectedAccountsMapInDB: repairedSelectedAccountsMap,
            sceneName,
            sceneUrl,
            shouldContinue: isLatestGeneration,
          })) || {};
        if (abortIfStale()) {
          return;
        }
        const updateMeta = get(accountSelectorUpdateMetaAtom());
        if (
          !isDappConnectionBackedScene &&
          this.shouldKeepColdStartSelectedAccounts({
            selectedAccountsMap,
            selectedAccountsMapInDB,
            updateMeta,
          })
        ) {
          // Keep the cold-start selection but fill EMPTY nums from the
          // (home-merged) DB; else a sibling scene (e.g. swap on the Perps
          // route) leaves num0 empty, auto-selects index 0, and clobbers home's
          // restored num0 via the home<->swap sync. Non-empty slots untouched.
          const mergedSelectedAccountsMap =
            this.mergeColdStartSelectedAccountsWithStorage({
              selectedAccountsMap,
              selectedAccountsMapInDB,
            });
          // Compare against the raw atom value: repair/clear results must
          // reach memory even when the fill step adds nothing.
          if (!isEqual(mergedSelectedAccountsMap, currentSelectedAccountsMap)) {
            this.setSelectedAccountsAtom(
              set,
              () => mergedSelectedAccountsMap,
              'initFromStorageFillEmptyNumsFromDB',
              operationId,
            );
          }
          set(accountSelectorStorageReadyAtom(), () => true);
          set(accountSelectorStorageInitDoneAtom(), () => true);
          logResult('kept-current-selection');
          return;
        }

        startPhase('apply-storage');
        if (
          selectedAccountsMapInDB &&
          !isEqual(selectedAccountsMapInDB, selectedAccountsMap)
        ) {
          this.setSelectedAccountsAtom(
            set,
            (v) => {
              const r = selectedAccountsMapInDB || v;
              defaultLogger.accountSelector.listData.initFromStorageSelectedAccountsMapResult(
                {
                  selectedAccountsMap: r,
                },
              );
              return r;
            },
            'initFromStorage',
            operationId,
          );
          storageApplied = true;
        }
        set(accountSelectorStorageReadyAtom(), () => true);
        set(accountSelectorStorageInitDoneAtom(), () => true);
        let outcome = 'ready-no-storage';
        if (storageApplied) {
          outcome = 'restored-storage';
        } else if (selectedAccountsMapInDB) {
          outcome = 'storage-already-current';
        }
        logResult(outcome);
      } catch (error) {
        if (!isLatestGeneration()) {
          logResult(`stale-${phase}`);
          return;
        }
        logResult('error-finalized');
        defaultLogger.app.error.log(
          `initFromStorage failed: ${
            (error as Error)?.message || String(error)
          }`,
        );
      } finally {
        if (isLatestGeneration()) {
          set(accountSelectorStorageReadyAtom(), () => true);
          set(accountSelectorStorageInitDoneAtom(), () => true);
          // Home reads account selector num 0. Finalize it here so an init error
          // after a warm-cache reload cannot leave the no-wallet page blank.
          set(accountSelectorActiveAccountInitDoneAtom(), (v) => ({
            ...v,
            0: true,
          }));
          logResult('ready-finalized');
        } else {
          logResult(`stale-${phase}`);
        }
      }
    },
  );

  mutexSaveToStorage = new Semaphore(1);

  saveToStorageInflightMap = new WeakMap<
    IAccountSelectorSelectedAccount,
    Map<
      string,
      {
        operationId: number | undefined;
        promise: Promise<void>;
        trigger: string;
      }
    >
  >();

  saveToStorage = contextAtomMethod(
    async (
      get,
      set,
      payload: {
        selectedAccount: IAccountSelectorSelectedAccount;
        sceneName: EAccountSelectorSceneName;
        sceneUrl?: string;
        num: number;
        selectedAccountUpdatedAt: number | undefined;
        trigger?: string;
      },
    ) => {
      const perfEnabled = isAccountSelectorPerfDebugEnabled();
      const inflightScopeKey = `${payload.sceneName}:${
        payload.sceneUrl || ''
      }:${payload.num}:${payload.selectedAccountUpdatedAt ?? 'no-revision'}`;
      const existingInflight = this.saveToStorageInflightMap
        .get(payload.selectedAccount)
        ?.get(inflightScopeKey);
      if (existingInflight) {
        if (perfEnabled) {
          defaultLogger.accountSelector.perf.trace(
            'selectionStorageCoalesced',
            {
              num: payload.num,
              operationId: existingInflight.operationId,
              originalTrigger: existingInflight.trigger,
              outcome: 'join-inflight',
              sceneName: payload.sceneName,
              trigger: payload.trigger || 'unspecified',
            },
          );
        }
        return existingInflight.promise;
      }
      const requestedAt = perfEnabled ? getAccountSelectorPerfTimestamp() : 0;
      const operationId = perfEnabled
        ? getNextAccountSelectorPerfOperationId()
        : undefined;
      const saveTask = (async () => {
        const { serviceAccountSelector } = backgroundApiProxy;
        const transitionMeta = getSelectedAccountPerfCommitMeta(
          payload.selectedAccount,
        );
        if (perfEnabled) {
          defaultLogger.accountSelector.perf.trace(
            'selectionStorageRequested',
            {
              num: payload.num,
              operationId,
              reason: transitionMeta?.reason,
              sceneName: payload.sceneName,
              transitionId: transitionMeta?.transitionId,
              trigger: payload.trigger || 'unspecified',
            },
          );
        }
        let primaryPersisted = false;
        let storagePhase = 'mutex-wait';
        await this.mutexSaveToStorage
          .runExclusive(async () => {
            storagePhase = 'validate';
            const startedAt = getAccountSelectorPerfTimestamp();
            const { sceneName, sceneUrl, num } = payload;
            let { selectedAccount } = payload;
            const logStorageResult = ({
              eventEmitted = false,
              eventEmitDisabled,
              outcome,
              syncedHome = false,
            }: {
              eventEmitted?: boolean;
              eventEmitDisabled?: boolean;
              outcome: string;
              syncedHome?: boolean;
            }) => {
              if (!perfEnabled) {
                return;
              }
              const completedAt = getAccountSelectorPerfTimestamp();
              defaultLogger.accountSelector.perf.trace(
                'selectionStorageResult',
                {
                  eventEmitted,
                  eventEmitDisabled,
                  mutexWaitMs: Math.round(startedAt - requestedAt),
                  num,
                  operationId,
                  outcome,
                  primaryPersisted,
                  reason: transitionMeta?.reason,
                  sceneName,
                  syncedHome,
                  totalMs: Math.round(completedAt - requestedAt),
                  transitionId: transitionMeta?.transitionId,
                  trigger: payload.trigger || 'unspecified',
                  workMs: Math.round(completedAt - startedAt),
                },
              );
            };
            const { simpleDb } = backgroundApiProxy;
            const isPayloadStillCurrent = () => {
              const currentSelectedAccount = this.getSelectedAccount.call(set, {
                num,
              });
              const currentUpdatedAt = get(accountSelectorUpdateMetaAtom())[num]
                ?.updatedAt;
              return (
                isSameSelectedAccount(
                  currentSelectedAccount,
                  payload.selectedAccount,
                ) &&
                (payload.selectedAccountUpdatedAt === undefined ||
                  currentUpdatedAt === undefined ||
                  currentUpdatedAt === payload.selectedAccountUpdatedAt)
              );
            };
            const isReady = get(accountSelectorStorageReadyAtom());
            if (!isReady) {
              logStorageResult({ outcome: 'skip-not-ready' });
              return;
            }
            if (sceneName === EAccountSelectorSceneName.homeUrlAccount) {
              if (
                !selectedAccount?.othersWalletAccountId ||
                !accountUtils.isUrlAccountFn({
                  accountId: selectedAccount?.othersWalletAccountId,
                })
              ) {
                selectedAccount = defaultSelectedAccount();
              }
            }
            if (isEqual(selectedAccount, defaultSelectedAccount())) {
              logStorageResult({ outcome: 'skip-default-selection' });
              return;
            }
            // Identity-less selections (e.g. network-only cold-start snapshots)
            // must never overwrite a saved account. Clearing an unavailable
            // wallet persists through
            // savePersistentlyUnavailableWalletSelectionToStorage, which bypasses
            // this guard on purpose.
            const hasAccountIdentityForStorage = Boolean(
              selectedAccount?.walletId &&
              (selectedAccount.indexedAccountId ||
                selectedAccount.othersWalletAccountId),
            );
            if (!hasAccountIdentityForStorage) {
              logStorageResult({ outcome: 'skip-no-identity' });
              return;
            }
            // Skip stale async saves: the in-memory selection may have moved on
            // while this payload was waiting on the mutex.
            if (!isPayloadStillCurrent()) {
              logStorageResult({ outcome: 'stale-before-fix' });
              return;
            }
            storagePhase = 'fix-selection';
            selectedAccount =
              await serviceAccountSelector.fixOthersWalletAccountNetworkPair({
                selectedAccount,
                source: `saveToStorage:${sceneName}:${num}`,
              });
            if (!isPayloadStillCurrent()) {
              logStorageResult({ outcome: 'stale-after-fix' });
              return;
            }
            // If the pair is still broken after the fix (e.g. the account row was
            // removed), keep the previously saved record instead of persisting an
            // unresolvable selection.
            if (
              await this.isIncompatibleOthersWalletNetworkPair({
                selectedAccount,
              })
            ) {
              logStorageResult({ outcome: 'skip-incompatible' });
              return;
            }
            if (!isPayloadStillCurrent()) {
              logStorageResult({ outcome: 'stale-before-read' });
              return;
            }
            const fixedPayload = {
              ...payload,
              selectedAccount,
              sourceOperationId: operationId,
              sourceRuntimeId: perfEnabled ? appEventBus.nodeId : undefined,
              sourceTransitionId: transitionMeta?.transitionId,
            };
            storagePhase = 'read-primary';
            const currentSaved =
              await simpleDb.accountSelector.getSelectedAccount({
                sceneName,
                sceneUrl,
                num,
              });
            if (isEqual(currentSaved, selectedAccount)) {
              // console.log(
              //   'AccountSelector.saveToStorage skip, selectedAccount not changed',
              // );
              logStorageResult({ outcome: 'noop-already-saved' });
              return;
            }
            if (!isPayloadStillCurrent()) {
              logStorageResult({ outcome: 'stale-before-write' });
              return;
            }

            // **** saveSelectedAccount
            // skip discover account selector persist here
            storagePhase = 'write-primary';
            const primarySaveResult =
              await simpleDb.accountSelector.saveSelectedAccount(fixedPayload);
            primaryPersisted = Boolean(primarySaveResult?.persisted);
            if (!isPayloadStillCurrent()) {
              logStorageResult({ outcome: 'stale-after-write' });
              return;
            }

            // **** save global derive type (with event emit if need)
            const updateMeta = get(accountSelectorUpdateMetaAtom())[num];
            const eventEmitDisabled = Boolean(updateMeta?.eventEmitDisabled);

            storagePhase = 'save-global-derive';
            await backgroundApiProxy.serviceAccountSelector.saveGlobalDeriveType(
              {
                eventEmitDisabled,
                selectedAccount,
                sceneName,
                sceneUrl,
                num,
              },
            );
            if (!isPayloadStillCurrent()) {
              logStorageResult({
                eventEmitDisabled,
                outcome: 'stale-after-global-derive',
              });
              return;
            }

            // **** also save to home scene SelectedAccount if sync needed
            let syncedHome = false;
            if (
              sceneName !== EAccountSelectorSceneName.home &&
              !eventEmitDisabled &&
              (await serviceAccountSelector.shouldSyncWithHomeSource({
                sceneName,
                sceneUrl,
                num,
              }))
            ) {
              storagePhase = 'sync-home';
              const homeSelectedAccount =
                await simpleDb.accountSelector.getSelectedAccount({
                  sceneName: EAccountSelectorSceneName.home,
                  num: 0,
                });
              const newSelectedAccount =
                accountSelectorUtils.buildMergedSelectedAccount({
                  data: homeSelectedAccount,
                  mergedByData: selectedAccount,
                });
              const fixedNewSelectedAccount =
                await serviceAccountSelector.fixOthersWalletAccountNetworkPair({
                  selectedAccount: newSelectedAccount,
                  source: 'saveToStorage:syncHome',
                });
              await simpleDb.accountSelector.saveSelectedAccount({
                sceneName: EAccountSelectorSceneName.home,
                num: 0,
                selectedAccount: fixedNewSelectedAccount,
              });
              syncedHome = true;
            }

            if (!isPayloadStillCurrent()) {
              logStorageResult({
                eventEmitDisabled,
                outcome: 'stale-before-event',
                syncedHome,
              });
              return;
            }

            // **** emit event
            storagePhase = 'emit-event';
            if (!eventEmitDisabled) {
              if (
                networkUtils.isAllNetwork({
                  networkId: payload.selectedAccount?.networkId,
                })
              ) {
                // debugger;
              }
              if (sceneName === EAccountSelectorSceneName.discover) {
                if (payload?.selectedAccount?.indexedAccountId === 'hd-1--0') {
                  // alert('AccountSelectorSelectedAccountUpdate');
                  // debugger;
                }
              }
              appEventBus.emit(
                EAppEventBusNames.AccountSelectorSelectedAccountUpdate,
                fixedPayload,
              );
            }
            logStorageResult({
              eventEmitted: !eventEmitDisabled,
              eventEmitDisabled,
              outcome: primaryPersisted
                ? 'persisted'
                : 'processed-nonpersistent',
              syncedHome,
            });
          })
          .catch((error: unknown) => {
            if (perfEnabled) {
              defaultLogger.accountSelector.perf.trace(
                'selectionStorageResult',
                {
                  num: payload.num,
                  operationId,
                  outcome: primaryPersisted ? 'partial' : 'error',
                  failedPhase: storagePhase,
                  primaryPersisted,
                  reason: transitionMeta?.reason,
                  sceneName: payload.sceneName,
                  totalMs: Math.round(
                    getAccountSelectorPerfTimestamp() - requestedAt,
                  ),
                  transitionId: transitionMeta?.transitionId,
                  trigger: payload.trigger || 'unspecified',
                },
              );
            }
            throw error;
          });
      })();
      let inflightByScope = this.saveToStorageInflightMap.get(
        payload.selectedAccount,
      );
      if (!inflightByScope) {
        inflightByScope = new Map();
        this.saveToStorageInflightMap.set(
          payload.selectedAccount,
          inflightByScope,
        );
      }
      inflightByScope.set(inflightScopeKey, {
        operationId,
        promise: saveTask,
        trigger: payload.trigger || 'unspecified',
      });
      try {
        await saveTask;
      } finally {
        if (inflightByScope.get(inflightScopeKey)?.promise === saveTask) {
          inflightByScope.delete(inflightScopeKey);
        }
      }
    },
  );

  saveClearedSelectedAccountToStorage = contextAtomMethod(
    async (
      get,
      set,
      payload: {
        previousSelectedAccount: IAccountSelectorSelectedAccount | undefined;
        selectedAccount: IAccountSelectorSelectedAccount;
        sceneName: EAccountSelectorSceneName | undefined;
        sceneUrl?: string;
        num: number;
      },
    ) => {
      const {
        previousSelectedAccount,
        selectedAccount,
        sceneName,
        sceneUrl,
        num,
      } = payload;
      if (
        !sceneName ||
        !accountSelectorUtils.isSceneCanPersist({ sceneName })
      ) {
        return;
      }
      if (!get(accountSelectorStorageReadyAtom())) {
        return;
      }

      const previousSelectedAccountHasWalletSelection = Boolean(
        previousSelectedAccount?.walletId ||
        previousSelectedAccount?.focusedWallet ||
        previousSelectedAccount?.indexedAccountId ||
        previousSelectedAccount?.othersWalletAccountId,
      );
      const selectedAccountHasIdentity = Boolean(
        selectedAccount.walletId &&
        (selectedAccount.indexedAccountId ||
          selectedAccount.othersWalletAccountId),
      );
      if (
        !previousSelectedAccountHasWalletSelection ||
        selectedAccountHasIdentity
      ) {
        return;
      }
      if (
        !(await this.isSelectedAccountWalletPersistentlyUnavailable({
          selectedAccount: previousSelectedAccount,
        }))
      ) {
        return;
      }

      const currentSelectedAccount = this.getSelectedAccount.call(set, {
        num,
      });
      if (
        !isEqual(
          omitBy(currentSelectedAccount, isUndefined),
          omitBy(selectedAccount, isUndefined),
        )
      ) {
        return;
      }

      await this.savePersistentlyUnavailableWalletSelectionToStorage({
        sceneName,
        sceneUrl,
        num,
        selectedAccount,
        trigger: 'auto-select-clear',
      });
    },
  );

  getSelectedAccount = contextAtomMethod(
    (
      get,
      set,
      {
        num,
      }: {
        num: number;
      },
    ) => {
      const selectedAccount = get(selectedAccountsAtom())[num];
      return selectedAccount || defaultSelectedAccount();
    },
  );

  getActiveAccount = contextAtomMethod(
    (
      get,
      set,
      {
        num,
      }: {
        num: number;
      },
    ) => {
      const activeAccount = get(activeAccountsAtom())[num];
      return activeAccount || defaultActiveAccountInfo();
    },
  );

  syncFromScene = contextAtomMethod(
    async (
      get,
      set,
      {
        from,
        num,
        targetSceneName,
        withNetworkSync,
        availableNetworks,
      }: IAccountSelectorSyncFromSceneParams,
    ) => {
      const perfEnabled = isAccountSelectorPerfDebugEnabled();
      const requestedAt = perfEnabled ? getAccountSelectorPerfTimestamp() : 0;
      const operationId = perfEnabled
        ? getNextAccountSelectorPerfOperationId()
        : undefined;
      const expectedSelection = this.getSelectedAccount.call(set, { num });
      const expectedUpdatedAt = get(accountSelectorUpdateMetaAtom())[num]
        ?.updatedAt;
      let phase = 'wait-auto-select';
      let deriveResolution: ISceneSyncPreparationResult['deriveResolution'] =
        'none';
      let networkResolution: ISceneSyncPreparationResult['networkResolution'] =
        'none';
      let resolvedTargetSceneName = targetSceneName;
      const availableNetworksResolution = availableNetworks?.networkIds?.length
        ? 'provided'
        : 'none';
      defaultLogger.accountSelector.storage.syncFromScene({
        sceneName: from.sceneName,
        sceneUrl: from.sceneUrl,
        num,
      });
      if (perfEnabled) {
        defaultLogger.accountSelector.perf.trace('manualSceneSyncRequested', {
          num,
          operationId,
          sourceNum: from.sceneNum,
          sourceSceneName: from.sceneName,
          targetSceneName,
          availableNetworkCount: availableNetworks?.networkIds?.length || 0,
          withNetworkSync: Boolean(withNetworkSync),
        });
      }
      try {
        await this.autoSelectNextAccountMutex.waitForUnlock();

        phase = 'read-scene';
        const sceneInfo = await this.getCurrentSceneInfo.call(set);
        resolvedTargetSceneName ||= sceneInfo?.sceneName;
        const { sceneName, sceneUrl, sceneNum } = from;

        const sourceSelectedAccount =
          await backgroundApiProxy.simpleDb.accountSelector.getSelectedAccount({
            sceneName,
            sceneUrl,
            num: sceneNum,
          });

        const globalDeriveTypesMap = (
          await backgroundApiProxy.simpleDb.accountSelector.getRawData()
        )?.globalDeriveTypesMap?.[EGlobalDeriveTypesScopes.global];

        let preparedSelectedAccount:
          | IAccountSelectorSelectedAccount
          | undefined;
        if (sourceSelectedAccount) {
          const prepared = prepareSceneSyncSelectedAccount({
            availableNetworks,
            currentSelectedAccount: expectedSelection,
            globalDeriveTypesMap,
            sourceSelectedAccount,
            targetSceneName: resolvedTargetSceneName,
            withNetworkSync: Boolean(withNetworkSync),
          });
          preparedSelectedAccount = prepared.selectedAccount;
          deriveResolution = prepared.deriveResolution;
          networkResolution = prepared.networkResolution;
        }

        phase = 'selection-update';
        const selectionResult = await this.updateSelectedAccount.call(set, {
          expectedSelection,
          expectedUpdatedAt: expectedUpdatedAt ?? null,
          num,
          parentOperationId: operationId,
          reason: 'syncFromScene',
          builder: (v) => {
            return preparedSelectedAccount || v;
          },
        });
        if (perfEnabled) {
          defaultLogger.accountSelector.perf.trace('manualSceneSyncResult', {
            num,
            deriveResolution,
            networkResolution,
            availableNetworkCount: availableNetworks?.networkIds?.length || 0,
            availableNetworksResolution,
            operationId,
            outcome: selectionResult.outcome,
            sourceNum: from.sceneNum,
            sourceSceneName: from.sceneName,
            targetSceneName: resolvedTargetSceneName,
            totalMs: Math.round(
              getAccountSelectorPerfTimestamp() - requestedAt,
            ),
            transitionId: selectionResult.transitionId,
            withNetworkSync: Boolean(withNetworkSync),
          });
        }
        return undefined;
      } catch (error) {
        if (perfEnabled) {
          defaultLogger.accountSelector.perf.trace('manualSceneSyncResult', {
            failedPhase: phase,
            num,
            deriveResolution,
            networkResolution,
            availableNetworksResolution,
            operationId,
            outcome: 'error',
            sourceNum: from.sceneNum,
            sourceSceneName: from.sceneName,
            targetSceneName: resolvedTargetSceneName,
            totalMs: Math.round(
              getAccountSelectorPerfTimestamp() - requestedAt,
            ),
            withNetworkSync: Boolean(withNetworkSync),
          });
        }
        throw error;
      }
    },
  );

  getAutoSelectNetworkIdForAccount = contextAtomMethod(
    (
      get,
      set,
      {
        num,
        account,
        autoChangeToAccountMatchedNetworkId,
      }: {
        num: number;
        account: IDBAccount | undefined;
        autoChangeToAccountMatchedNetworkId?: string;
      },
    ) => {
      if (!account) {
        return '';
      }
      const { networkId: currentNetworkId } = this.getSelectedAccount.call(
        set,
        { num },
      );
      const networkId = autoChangeToAccountMatchedNetworkId || currentNetworkId;
      if (!networkId) {
        return '';
      }
      const accountNetworkId = accountUtils.getAccountCompatibleNetwork({
        account,
        networkId,
      });
      if (accountNetworkId && accountNetworkId !== currentNetworkId) {
        return accountNetworkId;
      }
      return '';
    },
  );

  autoSelectNetworkOfOthersWalletAccount = contextAtomMethod(
    async (
      get,
      set,
      {
        num,
        othersWalletAccountId,
      }: {
        num: number;
        othersWalletAccountId: string | undefined;
      },
    ) => {
      if (!othersWalletAccountId) {
        return;
      }
      const account = await serviceAccount.getDBAccount({
        accountId: othersWalletAccountId,
      });
      if (!account) {
        return;
      }
      const accountNetworkId = this.getAutoSelectNetworkIdForAccount.call(set, {
        num,
        account,
      });
      if (accountNetworkId) {
        await this.updateSelectedAccountNetwork.call(set, {
          num,
          networkId: accountNetworkId,
        });
      }
    },
  );

  cloneSelectedAccountNew = contextAtomMethod(
    async (get, set, { num }: { num: number }) => {
      const selectedAccount = this.getSelectedAccount.call(set, { num });
      return cloneDeep(selectedAccount || defaultSelectedAccount());
    },
  );

  // TODO merge with autoSelectAccount()
  autoSelectHomeNextAvailableAccount = contextAtomMethod(
    async (
      get,
      set,
      {
        walletId,
      }: {
        walletId: string;
      },
    ) => {
      const { account, wallet, network } = this.getActiveAccount.call(set, {
        num: 0,
      });
      if (account && wallet) {
        return;
      }
      if (wallet) {
        if (accountUtils.isOthersWallet({ walletId })) {
          const { accounts } =
            await serviceAccount.getSingletonAccountsOfWallet({
              walletId: wallet.id as IDBWalletIdSingleton,
              activeNetworkId: network?.id,
            });
          const firstAccount = accounts[0];
          if (firstAccount) {
            const accountNetworkId = accountUtils.getAccountCompatibleNetwork({
              account: firstAccount,
              networkId: network?.id || '',
            });

            await this.updateSelectedAccount.call(set, {
              num: 0,
              reason: 'autoSelectHomeNextAvailableAccount',
              builder: (v) => ({
                ...v,
                networkId: accountNetworkId || v.networkId,
                indexedAccountId: undefined,
                walletId: wallet.id,
                focusedWallet: wallet.id,
              }),
            });
          }
        }
      }
    },
  );

  autoSelectToCreatedWallet = contextAtomMethod(
    async (
      _,
      set,
      createResult: {
        wallet: IDBWallet;
        indexedAccount: IDBIndexedAccount | undefined;
        isOverrideWallet: boolean | undefined;
        isAttachPinMode?: boolean | undefined;
      },
    ) => {
      const { wallet, indexedAccount } = createResult;
      if (wallet?.isMocked || !indexedAccount?.id) {
        return;
      }
      toastExistingWalletSwitch(createResult);
      await this.updateSelectedAccount.call(set, {
        num: 0,
        reason: 'autoSelectToCreatedWallet',
        builder: (v) => ({
          ...v,
          indexedAccountId: indexedAccount?.id,
          walletId: wallet.id,
          focusedWallet: wallet.id,
        }),
      });
    },
  );

  autoSelectNextAccountMutex = new Semaphore(1);

  // Public barrier for components that want to write to selectedAccount only
  // AFTER autoSelectNextAccount has completed. syncFromScene uses the same
  // mutex internally; external writers (e.g. keyless preselect) previously
  // had to guess a timeout, which raced AutoSelect on slow paths.
  waitForAutoSelectUnlock = contextAtomMethod(async (_get, _set) => {
    await this.autoSelectNextAccountMutex.waitForUnlock();
  });

  autoSelectNextAccount = contextAtomMethod(
    async (
      get,
      set,
      {
        sceneName,
        sceneUrl,
        num,
        settledForMs = 0,
        source = 'unspecified',
        triggerBy,
      }: {
        sceneName?: EAccountSelectorSceneName;
        sceneUrl?: string;
        num: number;
        settledForMs?: number;
        source?: string;
        triggerBy?: EAccountSelectorAutoSelectTriggerBy;
      },
    ) => {
      // console.log('accountSelector actions.autoSelectAccount >>> ', {
      //   sceneName,
      //   sceneUrl,
      //   num,
      //   triggerBy,
      // });

      const perfEnabled = isAccountSelectorPerfDebugEnabled();
      const requestedAt = getAccountSelectorPerfTimestamp();
      const operationId = perfEnabled
        ? getNextAccountSelectorPerfOperationId()
        : undefined;
      let startedAt: number | undefined;
      let settleDelayMs: number | undefined;
      let walletSettleDelayMs: number | undefined;
      let phase = 'scene-gate';
      const logAutoSelectResult = ({
        outcome,
        transitionId,
      }: {
        outcome: string;
        transitionId?: number;
      }) => {
        if (!perfEnabled) {
          return;
        }
        const completedAt = getAccountSelectorPerfTimestamp();
        defaultLogger.accountSelector.perf.trace('autoSelectAccountResult', {
          mutexWaitMs:
            startedAt === undefined
              ? undefined
              : Math.round(startedAt - requestedAt),
          num,
          operationId,
          outcome,
          sceneName,
          settledForMs,
          source,
          settleDelayMs,
          totalMs: Math.round(completedAt - requestedAt),
          transitionId,
          triggerBy,
          walletSettleDelayMs,
          workMs:
            startedAt === undefined
              ? undefined
              : Math.round(completedAt - startedAt),
        });
      };
      if (perfEnabled) {
        defaultLogger.accountSelector.perf.trace('autoSelectAccountRequested', {
          num,
          operationId,
          sceneName,
          settledForMs,
          source,
          triggerBy,
        });
      }

      // addressInput scene should keep empty selection, let user select account manually
      if (!accountSelectorUtils.isSceneCanAutoSelect({ sceneName })) {
        logAutoSelectResult({ outcome: 'skip-scene' });
        return;
      }

      return this.autoSelectNextAccountMutex
        .runExclusive(async () => {
          startedAt = getAccountSelectorPerfTimestamp();
          phase = 'settle-delay';
          const requestAgeMs = Math.max(
            0,
            settledForMs + startedAt - requestedAt,
          );
          settleDelayMs = Math.max(0, Math.round(300 - requestAgeMs));
          if (perfEnabled) {
            defaultLogger.accountSelector.perf.trace('autoSelectAccountStart', {
              mutexWaitMs: Math.round(startedAt - requestedAt),
              num,
              operationId,
              requestAgeMs: Math.round(requestAgeMs),
              sceneName,
              settledForMs,
              settleDelayMs,
              source,
              triggerBy,
            });
          }
          // Give activeAccount at least 300ms from the event to settle. Time
          // already spent queued on the same mutex counts toward that window;
          // otherwise every mounted scene adds another unnecessary 300ms.
          // Any remaining delay stays inside runExclusive so barrier callers
          // cannot write during the unsettled portion of the pass.
          if (settleDelayMs > 0) {
            await timerUtils.wait(settleDelayMs);
          }
          const storageReady = get(accountSelectorStorageReadyAtom());
          const activeAccount = this.getActiveAccount.call(set, { num });
          const isActiveAccountReady = Boolean(
            activeAccount && activeAccount?.ready && storageReady,
          );
          if (!isActiveAccountReady) {
            logAutoSelectResult({ outcome: 'skip-not-ready' });
            return;
          }
          defaultLogger.accountSelector.storage.autoSelectNextAccount({
            sceneName,
            sceneUrl,
            num,
          });
          // TODO auto select account from home scene
          const { network, wallet, indexedAccount, account, dbAccount } =
            activeAccount;
          const selectedAccount = this.getSelectedAccount.call(set, { num });
          const isAccountExist = Boolean(
            indexedAccount || account || dbAccount,
          );
          // Mocked wallets need replacement. Deprecated wallets remain readable.
          const shouldAutoSelectNextAccount =
            !selectedAccount?.focusedWallet ||
            !network ||
            !wallet ||
            wallet.isMocked ||
            !isAccountExist;
          let selectionResult: ISelectionUpdateResult | undefined;

          if (shouldAutoSelectNextAccount) {
            phase = 'resolve-candidate';
            defaultLogger.accountSelector.autoSelect.startAutoSelect({
              focusedWallet: selectedAccount?.focusedWallet,
              networkId: network?.id,
              walletId: wallet?.id,
              isAccountExist,
            });

            const selectedAccountNew = await this.cloneSelectedAccountNew.call(
              set,
              {
                num,
              },
            );

            defaultLogger.accountSelector.autoSelect.currentSelectedAccount({
              selectedAccount: selectedAccountNew,
            });

            let selectedWalletId = wallet?.id || selectedAccount?.walletId;
            let selectedWallet = wallet;
            if (!selectedWallet && selectedWalletId) {
              selectedWallet = await serviceAccount.getWalletSafe({
                walletId: selectedWalletId,
              });
              if (
                !selectedWallet ||
                (await serviceAccount.isTempWalletRemoved({
                  wallet: selectedWallet,
                }))
              ) {
                selectedWalletId = undefined;
                selectedWallet = undefined;
              }
            }
            let selectedIndexedAccountId =
              indexedAccount?.id || selectedAccount?.indexedAccountId;
            // accountUtils.isHwWallet
            const hasIndexedAccounts =
              selectedWalletId &&
              (accountUtils.isHdWallet({
                walletId: selectedWalletId,
              }) ||
                accountUtils.isHwOrQrWallet({
                  walletId: selectedWalletId,
                })) &&
              (await serviceAccount.isWalletHasIndexedAccounts({
                walletId: selectedWalletId,
              }));

            // auto select hd hw wallet if current wallet not contains next available account
            if (
              !selectedWalletId ||
              !hasIndexedAccounts ||
              selectedWallet?.isMocked
            ) {
              let shouldSelectHdHwWallet = true;
              if (
                selectedWalletId &&
                accountUtils.isOthersWallet({ walletId: selectedWalletId })
              ) {
                try {
                  const { accounts } =
                    await serviceAccount.getSingletonAccountsOfWallet({
                      walletId: selectedWalletId as IDBWalletIdSingleton,
                      activeNetworkId: network?.id || '',
                    });
                  const firstAccount = accounts?.[0];
                  if (firstAccount) {
                    // others wallet contains next available account, no need to switch to other hd hw wallet
                    shouldSelectHdHwWallet = false;
                  }
                } catch (_e) {
                  //
                }
              }
              if (shouldSelectHdHwWallet) {
                // wait for hardware indexed account created
                walletSettleDelayMs = Math.max(
                  0,
                  Math.round(
                    600 -
                      (settledForMs +
                        getAccountSelectorPerfTimestamp() -
                        requestedAt),
                  ),
                );
                if (walletSettleDelayMs > 0) {
                  await timerUtils.wait(walletSettleDelayMs);
                }
                await serviceAccount.clearAccountCache();
                const { wallets } = await serviceAccount.getAllHdHwQrWallets();
                let firstAvailableWallet: IDBWallet | undefined;
                let foundWalletWithIndexedAccounts = false;
                for (const wallet0 of wallets) {
                  const isWalletUnavailable =
                    wallet0.isMocked ||
                    (await serviceAccount.isTempWalletRemoved({
                      wallet: wallet0,
                    }));
                  if (!isWalletUnavailable) {
                    firstAvailableWallet = firstAvailableWallet || wallet0;
                    if (
                      await serviceAccount.isWalletHasIndexedAccounts({
                        walletId: wallet0.id,
                      })
                    ) {
                      selectedWallet = wallet0;
                      selectedWalletId = selectedWallet?.id;
                      selectedAccountNew.walletId = selectedWalletId;
                      foundWalletWithIndexedAccounts = true;
                      break;
                    }
                  }
                }
                if (
                  (!selectedWallet || !foundWalletWithIndexedAccounts) &&
                  firstAvailableWallet
                ) {
                  selectedWallet = firstAvailableWallet;
                  selectedWalletId = selectedWallet.id;
                  selectedAccountNew.walletId = selectedWalletId;
                  selectedAccountNew.indexedAccountId = undefined;
                  selectedAccountNew.othersWalletAccountId = undefined;
                  selectedAccountNew.focusedWallet = selectedWalletId;
                }
                // maybe no hd hw wallet found, reset walletId and indexedAccountId
                if (!selectedWallet || selectedWallet.isMocked) {
                  defaultLogger.accountSelector.autoSelect.resetSelectedWalletToUndefined(
                    {
                      selectedAccount: selectedAccountNew,
                    },
                  );

                  selectedAccountNew.walletId = undefined;
                  selectedAccountNew.indexedAccountId = undefined;
                  selectedAccountNew.focusedWallet = undefined;
                  // Sync local variables so subsequent code (isHdWallet /
                  // isHwOrQrWallet checks, Others fallback) doesn't use the
                  // stale unavailable wallet reference and undo the reset.
                  selectedWalletId = undefined;
                  selectedWallet = undefined;
                }
              }
            }

            const isHdWallet = accountUtils.isHdWallet({
              walletId: selectedWalletId,
            });
            const isHwOrQrWallet = accountUtils.isHwOrQrWallet({
              walletId: selectedWalletId,
            });

            // auto select hd or hw index account
            if (selectedWalletId && (isHdWallet || isHwOrQrWallet)) {
              if (
                !selectedAccountNew.walletId ||
                !selectedAccountNew.indexedAccountId ||
                !selectedAccountNew.focusedWallet ||
                !indexedAccount ||
                indexedAccount.walletId !== selectedWalletId
              ) {
                const { accounts: indexedAccounts } =
                  await serviceAccount.getIndexedAccountsOfWallet({
                    walletId: selectedWalletId,
                  });
                // Keep the restored indexed account when it still exists in the
                // wallet, so an incomplete activeAccount hydration cannot jump
                // the persisted selection back to the first account.
                const indexedAccountIdToRestore =
                  selectedAccountNew.indexedAccountId ||
                  selectedIndexedAccountId;
                const restoredIndexedAccount = indexedAccountIdToRestore
                  ? indexedAccounts?.find(
                      (item) =>
                        item.id === indexedAccountIdToRestore &&
                        item.walletId === selectedWalletId,
                    )
                  : undefined;
                selectedIndexedAccountId =
                  restoredIndexedAccount?.id || indexedAccounts?.[0]?.id;
                selectedAccountNew.walletId = selectedWalletId;
                selectedAccountNew.indexedAccountId = selectedIndexedAccountId;
                selectedAccountNew.focusedWallet = selectedWalletId;
                selectedAccountNew.othersWalletAccountId = undefined;
              }
            }

            const isOthers =
              Boolean(selectedWalletId) && !isHdWallet && !isHwOrQrWallet;

            if (isOthers) {
              selectedAccountNew.focusedWallet = selectedWalletId;
              selectedAccountNew.walletId = selectedWalletId;
              selectedAccountNew.indexedAccountId = undefined;
              // others account may be removed
              if (!account?.id) {
                selectedAccountNew.othersWalletAccountId = undefined;
              }
            }

            // auto select others singleton account
            if (
              !selectedAccountNew.indexedAccountId &&
              !selectedAccountNew.othersWalletAccountId
            ) {
              const autoSelectAccountFromOthersWallet = async (
                singletonWalletId: IDBWalletIdSingleton,
              ) => {
                const { accounts } =
                  await serviceAccount.getSingletonAccountsOfWallet({
                    walletId: singletonWalletId,
                    activeNetworkId: network?.id || '',
                  });
                const firstAccount = accounts?.[0];
                if (firstAccount) {
                  const accountNetworkId =
                    accountUtils.getAccountCompatibleNetwork({
                      account: firstAccount,
                      networkId: network?.id || '',
                    });
                  selectedAccountNew.focusedWallet = singletonWalletId;
                  selectedAccountNew.networkId =
                    accountNetworkId || network?.id;
                  selectedAccountNew.deriveType = 'default';
                  selectedAccountNew.walletId = singletonWalletId;
                  selectedAccountNew.indexedAccountId = undefined;
                  selectedAccountNew.othersWalletAccountId = firstAccount.id;
                  return true;
                }
                return false;
              };
              const othersWallets: IDBWalletIdSingleton[] = [
                WALLET_TYPE_IMPORTED,
                WALLET_TYPE_WATCHING,
                WALLET_TYPE_EXTERNAL,
              ];
              for (const walletType of othersWallets) {
                const done =
                  await autoSelectAccountFromOthersWallet(walletType);
                if (done) {
                  break;
                }
              }
            }

            // TODO auto select network and derive type, check network compatible for others wallet account

            if (selectedAccountNew.walletId) {
              const finalWallet = await serviceAccount.getWalletSafe({
                walletId: selectedAccountNew.walletId,
              });
              if (
                !finalWallet ||
                finalWallet.isMocked ||
                (await serviceAccount.isTempWalletRemoved({
                  wallet: finalWallet,
                }))
              ) {
                selectedAccountNew.walletId = undefined;
                selectedAccountNew.indexedAccountId = undefined;
                selectedAccountNew.othersWalletAccountId = undefined;
                selectedAccountNew.focusedWallet = undefined;
              } else if (
                !selectedAccountNew.othersWalletAccountId &&
                finalWallet.id &&
                accountUtils.isOthersWallet({
                  walletId: finalWallet.id,
                })
              ) {
                // reset focused wallet when last others wallet account removed
                selectedAccountNew.othersWalletAccountId = undefined;
                selectedAccountNew.focusedWallet = undefined;
                selectedAccountNew.walletId = undefined;
              }
            }

            // A swap-scene fallback picked from an empty all-network slot is
            // scene-local bootstrap data; block the update event so it cannot
            // sync into the home selection.
            const shouldDisableAutoSelectSyncToHome =
              sceneName === EAccountSelectorSceneName.swap &&
              num === 0 &&
              isSelectedAccountIdentityIncomplete(selectedAccount) &&
              networkUtils.isAllNetwork({
                networkId: selectedAccount?.networkId,
              });

            phase = 'selection-update';
            selectionResult = await this.updateSelectedAccount.call(set, {
              expectedSelection: selectedAccount,
              num,
              parentOperationId: operationId,
              reason: 'autoSelectNextAccount',
              updateMeta: shouldDisableAutoSelectSyncToHome
                ? {
                    eventEmitDisabled: true,
                    updatedAt: Date.now(),
                  }
                : undefined,
              builder: () => selectedAccountNew,
            });
            if (selectionResult.outcome === 'stale') {
              logAutoSelectResult({ outcome: 'stale-user-selection' });
              return selectionResult;
            }
            await this.saveClearedSelectedAccountToStorage.call(set, {
              previousSelectedAccount: selectedAccount,
              selectedAccount: selectedAccountNew,
              sceneName,
              sceneUrl,
              num,
            });

            if (
              selectedAccount.walletId !== selectedAccountNew.walletId &&
              triggerBy !==
                EAccountSelectorAutoSelectTriggerBy.removeLastOthersAccount &&
              triggerBy !== EAccountSelectorAutoSelectTriggerBy.removeAccount
            ) {
              set(accountSelectorEditModeAtom(), false);
            }
          }

          const isTriggerByRemoveWalletOrLastOthersAccount =
            triggerBy &&
            [
              EAccountSelectorAutoSelectTriggerBy.removeWallet,
              EAccountSelectorAutoSelectTriggerBy.removeLastOthersAccount,
            ].includes(triggerBy);
          // (else if) when auto select logic not trigger, should fix focusedWallet only
          // focused A wallet, but remove B wallet, should focus back to A wallet
          if (
            !shouldAutoSelectNextAccount &&
            isTriggerByRemoveWalletOrLastOthersAccount
          ) {
            const selectedAccountNew = await this.cloneSelectedAccountNew.call(
              set,
              {
                num,
              },
            );
            // autofix focusedWallet when remove an unfocused wallet
            selectedAccountNew.focusedWallet = selectedAccountNew.walletId;
            phase = 'focused-wallet-update';
            selectionResult = await this.updateSelectedAccount.call(set, {
              expectedSelection: selectedAccount,
              num,
              parentOperationId: operationId,
              reason: 'autoSelectNextAccountFocusedWallet',
              builder: () => selectedAccountNew,
            });
          }
          logAutoSelectResult({
            outcome: selectionResult?.outcome || 'noop-not-needed',
            transitionId: selectionResult?.transitionId,
          });
          return selectionResult;
        })
        .catch((error: unknown) => {
          if (perfEnabled) {
            defaultLogger.accountSelector.perf.trace(
              'autoSelectAccountResult',
              {
                num,
                operationId,
                outcome: 'error',
                phase,
                sceneName,
                source,
                totalMs: Math.round(
                  getAccountSelectorPerfTimestamp() - requestedAt,
                ),
                triggerBy,
              },
            );
          }
          throw error;
        });
    },
  );
}

const createActions = memoFn(() => new AccountSelectorActions());

export const getAccountSelectorActions = createActions;
export type IAccountSelectorActionsInstance = ReturnType<
  typeof getAccountSelectorActions
>;

export function useAccountSelectorActions() {
  const actions = getAccountSelectorActions();
  const reloadActiveAccountInfo = actions.reloadActiveAccountInfo.use();
  const getSelectedAccount = actions.getSelectedAccount.use();
  const getActiveAccount = actions.getActiveAccount.use();
  const initFromStorage = actions.initFromStorage.use();
  const saveToStorage = actions.saveToStorage.use();
  const flushCurrentAccountSelectorColdStartSnapshot =
    actions.flushCurrentAccountSelectorColdStartSnapshot.use();

  const clearSelectedAccount = actions.clearSelectedAccount.use();
  const updateSelectedAccountFocusedWallet =
    actions.updateSelectedAccountFocusedWallet.use();
  const updateSelectedAccountNetwork =
    actions.updateSelectedAccountNetwork.use();
  const updateSelectedAccountDeriveType =
    actions.updateSelectedAccountDeriveType.use();
  const updateSelectedAccountForHdOrHwAccount =
    actions.updateSelectedAccountForHdOrHwAccount.use();
  const updateSelectedAccountForSingletonAccount =
    actions.updateSelectedAccountForSingletonAccount.use();

  const refresh = actions.refresh.use();
  const showAccountSelector = actions.showAccountSelector.use();
  const showChainSelector = actions.showChainSelector.use();
  const showUnifiedNetworkSelector = actions.showUnifiedNetworkSelector.use();
  const removeWallet = actions.removeWallet.use();
  const removeAccount = actions.removeAccount.use();
  const createHDWallet = actions.createHDWallet.use();
  // const createHWWallet = actions.createHWWallet.use();
  const createHWHiddenWallet = actions.createHWHiddenWallet.use();
  const createHWWalletWithHidden = actions.createHWWalletWithHidden.use();
  const createHWWalletWithoutHidden = actions.createHWWalletWithoutHidden.use();
  const createQrWallet = actions.createQrWallet.use();
  const createTonImportedWallet = actions.createTonImportedWallet.use();
  const autoSelectNextAccount = actions.autoSelectNextAccount.use();
  const waitForAutoSelectUnlock = actions.waitForAutoSelectUnlock.use();
  const updateHwWalletsDeprecatedStatus =
    actions.updateHwWalletsDeprecatedStatus.use();
  const updateTrezorWalletsDeprecatedStatus =
    actions.updateTrezorWalletsDeprecatedStatus.use();
  const autoSelectNetworkOfOthersWalletAccount =
    actions.autoSelectNetworkOfOthersWalletAccount.use();
  const syncFromScene = actions.syncFromScene.use();
  const confirmAccountSelect = actions.confirmAccountSelect.use();
  const syncHomeAndSwapSelectedAccount =
    actions.syncHomeAndSwapSelectedAccount.use();
  const syncLocalDeriveTypeFromGlobal =
    actions.syncLocalDeriveTypeFromGlobal.use();
  const reloadSwapToAccountFromHome = actions.reloadSwapToAccountFromHome.use();
  const addDefaultNetworkAccounts = actions.addDefaultNetworkAccounts.use();
  const updateSelectedAccount = actions.updateSelectedAccount.use();

  return useRef({
    reloadActiveAccountInfo,
    getSelectedAccount,
    getActiveAccount,
    refresh,
    initFromStorage,
    saveToStorage,
    flushCurrentAccountSelectorColdStartSnapshot,
    clearSelectedAccount,
    updateSelectedAccountNetwork,
    updateSelectedAccountDeriveType,
    updateSelectedAccountFocusedWallet,
    updateSelectedAccountForHdOrHwAccount,
    updateSelectedAccountForSingletonAccount,
    showAccountSelector,
    showChainSelector,
    showUnifiedNetworkSelector,
    removeWallet,
    removeAccount,
    createHDWallet,
    createHWHiddenWallet,
    createHWWalletWithHidden,
    createHWWalletWithoutHidden,
    createQrWallet,
    createTonImportedWallet,
    updateHwWalletsDeprecatedStatus,
    updateTrezorWalletsDeprecatedStatus,
    autoSelectNextAccount,
    waitForAutoSelectUnlock,
    autoSelectNetworkOfOthersWalletAccount,
    syncFromScene,
    confirmAccountSelect,
    syncHomeAndSwapSelectedAccount,
    syncLocalDeriveTypeFromGlobal,
    reloadSwapToAccountFromHome,
    addDefaultNetworkAccounts,
    updateSelectedAccount,
  });
}
