import { cloneDeep } from 'lodash';

import { backgroundMethod } from '@onekeyhq/shared/src/background/backgroundDecorators';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import accountSelectorUtils from '@onekeyhq/shared/src/utils/accountSelectorUtils';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { EGlobalDeriveTypesScopes } from '@onekeyhq/shared/types/account';

import { SimpleDbEntityBase } from '../base/SimpleDbEntityBase';

import {
  getAccountSelectorWriteIntentEpoch,
  invalidateStorageInitStartedAfterSelectionIntent,
  isAccountSelectorSelectionIntentCurrent,
  isAccountSelectorStorageInitGenerationCurrent,
  isAccountSelectorStorageInitHomeIntentCurrent,
  areAccountSelectorSelectionsEqual as isSameSelectedAccount,
  recordAccountSelectorSelectionIntent,
  beginAccountSelectorStorageInit as registerAccountSelectorStorageInit,
  runAccountSelectorPersistenceExclusive,
} from './accountSelectorPersistenceGuard';

import type { IAccountSelectorPersistenceLockToken } from './accountSelectorPersistenceGuard';
import type { IAccountDeriveTypes } from '../../../vaults/types';
import type {
  IDBAccount,
  IDBIndexedAccount,
  IDBWalletId,
} from '../../local/types';

export type IAccountSelectorFocusedWallet =
  | IDBWalletId
  | '$$others'
  | undefined; // TODO move to standalone atom
export interface IAccountSelectorSelectedAccount {
  walletId: IDBWalletId | undefined;
  indexedAccountId: string | undefined;
  othersWalletAccountId: string | undefined; // for others wallet only
  networkId: string | undefined;
  deriveType: IAccountDeriveTypes | undefined; // TODO move to jotai global
  focusedWallet: IAccountSelectorFocusedWallet; // TODO move to standalone atom
}
export type IAccountSelectorSelectedAccountsMap = Partial<{
  [num: number]: IAccountSelectorSelectedAccount;
}>;
export interface IAccountSelectorAccountsListSectionData {
  title: string;
  isHiddenWalletData?: boolean;
  data: IDBIndexedAccount[] | IDBAccount[];
  firstAccount: IDBIndexedAccount | IDBAccount | undefined;
  walletId: IDBWalletId;
  emptyText?: string;
}
export type IGlobalDeriveTypesMap = Partial<{
  [networkIdOrImpl: string]: IAccountDeriveTypes;
}>;

export interface IAccountSelectorPersistInfo {
  selectorInfo: {
    [sceneId: string]: {
      selector: IAccountSelectorSelectedAccountsMap;
    };
  };
  globalDeriveTypesMap: Partial<
    Record<EGlobalDeriveTypesScopes, IGlobalDeriveTypesMap>
  >;
}

const SELECTED_ACCOUNT_OWNERSHIP_FIELDS = [
  'walletId',
  'indexedAccountId',
  'othersWalletAccountId',
  'focusedWallet',
] as const satisfies readonly (keyof IAccountSelectorSelectedAccount)[];

function isSameSelectedAccountOwnership(
  first: IAccountSelectorSelectedAccount | undefined,
  second: IAccountSelectorSelectedAccount | undefined,
) {
  return SELECTED_ACCOUNT_OWNERSHIP_FIELDS.every(
    (field) => first?.[field] === second?.[field],
  );
}

export class SimpleDbEntityAccountSelector extends SimpleDbEntityBase<IAccountSelectorPersistInfo> {
  entityName = 'accountSelector';

  override enableCache = true;

  private globalDeriveTypeUpdateTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();

  private scheduleGlobalDeriveTypeUpdate(networkImpl: string) {
    const previousTimer = this.globalDeriveTypeUpdateTimers.get(networkImpl);
    if (previousTimer) {
      clearTimeout(previousTimer);
      defaultLogger.accountSelector.perf.trace('globalDeriveEventCoalesced', {
        networkImpl,
      });
    }
    const timer = setTimeout(() => {
      this.globalDeriveTypeUpdateTimers.delete(networkImpl);
      const globalDeriveEventBus = appEventBus as {
        emit: (
          eventName: EAppEventBusNames.GlobalDeriveTypeUpdate,
          payload: { networkImpl: string },
        ) => void;
      };
      globalDeriveEventBus.emit(EAppEventBusNames.GlobalDeriveTypeUpdate, {
        networkImpl,
      });
      defaultLogger.accountSelector.perf.trace('globalDeriveEventDispatched', {
        networkImpl,
      });
    }, 100);
    this.globalDeriveTypeUpdateTimers.set(networkImpl, timer);
    defaultLogger.accountSelector.perf.trace('globalDeriveEventScheduled', {
      networkImpl,
    });
  }

  @backgroundMethod()
  async saveSelectedAccount(
    {
      selectedAccount,
      sceneName,
      sceneUrl,
      num,
      selectionIntentEpoch,
    }: {
      selectedAccount: IAccountSelectorSelectedAccount;
      sceneName: EAccountSelectorSceneName;
      sceneUrl?: string;
      num: number;
      selectionIntentEpoch?: number;
    },
    persistenceLockToken?: IAccountSelectorPersistenceLockToken,
  ) {
    checkIsDefined(num);
    checkIsDefined(sceneName);
    const persistenceScope = {
      sceneName,
      sceneUrl,
      num,
    };
    // Non-persisted scenes still publish write intent so an in-flight
    // background authorization cannot outlive the renderer's newer choice.
    let effectiveSelectionIntentEpoch: number;
    if (selectionIntentEpoch !== undefined) {
      if (
        !isAccountSelectorSelectionIntentCurrent({
          epoch: selectionIntentEpoch,
          scope: persistenceScope,
          selectedAccount,
        })
      ) {
        return { persisted: false, staleSelectionIntent: true };
      }
      effectiveSelectionIntentEpoch = selectionIntentEpoch;
      invalidateStorageInitStartedAfterSelectionIntent(persistenceScope);
    } else {
      effectiveSelectionIntentEpoch = recordAccountSelectorSelectionIntent(
        persistenceScope,
        selectedAccount,
      );
    }
    if (!accountSelectorUtils.isSceneCanPersist({ sceneName })) {
      // console.log(`skip ${sceneName} account selector persist`);
      return { persisted: false };
    }
    return runAccountSelectorPersistenceExclusive(async () => {
      const sceneId = accountSelectorUtils.buildAccountSelectorSceneId({
        sceneName,
        sceneUrl,
      });
      const isSelectionIntentCurrent = () =>
        isAccountSelectorSelectionIntentCurrent({
          epoch: effectiveSelectionIntentEpoch,
          scope: persistenceScope,
          selectedAccount,
        });
      const transaction = await this.setRawDataTransaction({
        build: (rawData) => {
          const data = cloneDeep(rawData) || {
            selectorInfo: {},
            globalDeriveTypesMap: {},
          };
          data.selectorInfo[sceneId] = data.selectorInfo[sceneId] || {};
          data.selectorInfo[sceneId].selector =
            data.selectorInfo[sceneId].selector || {};
          data.selectorInfo[sceneId].selector[num] =
            this.cloneAndFixSelectedAccount(selectedAccount);
          return { data };
        },
        shouldCommit: isSelectionIntentCurrent,
      });
      if (!transaction.committed) {
        return { persisted: false, staleSelectionIntent: true };
      }

      // An init can start while the storage write is pending. The user intent
      // remains authoritative, so invalidate that init again after the guarded
      // write has crossed its final commit check.
      invalidateStorageInitStartedAfterSelectionIntent(persistenceScope);

      // console.log('saveSelectedAccount', {
      //   selectedAccount,
      //   sceneName,
      //   sceneUrl,
      //   num,
      // });
      return { persisted: true };
    }, persistenceLockToken);
  }

  async saveSelectedAccountIfCurrent(
    {
      beforePublish,
      expectedWriteIntentEpoch,
      selectedAccount,
      sceneName,
      sceneUrl,
      num,
      shouldCommit,
    }: {
      selectedAccount: IAccountSelectorSelectedAccount;
      sceneName: EAccountSelectorSceneName;
      sceneUrl?: string;
      num: number;
      shouldCommit: () => boolean;
      beforePublish?: () => Promise<boolean> | boolean;
      expectedWriteIntentEpoch: number;
    },
    persistenceLockToken?: IAccountSelectorPersistenceLockToken,
  ) {
    checkIsDefined(num);
    checkIsDefined(sceneName);
    if (!accountSelectorUtils.isSceneCanPersist({ sceneName })) {
      return { persisted: false };
    }
    const persistenceScope = {
      sceneName,
      sceneUrl,
      num,
    };
    const isWriteCurrent = () =>
      getAccountSelectorWriteIntentEpoch(persistenceScope) ===
        expectedWriteIntentEpoch && shouldCommit();
    return runAccountSelectorPersistenceExclusive(async () => {
      const sceneId = accountSelectorUtils.buildAccountSelectorSceneId({
        sceneName,
        sceneUrl,
      });
      const transaction = await this.setRawDataTransaction({
        beforePublish,
        build: (rawData) => {
          const data = cloneDeep(rawData) || {
            selectorInfo: {},
            globalDeriveTypesMap: {},
          };
          data.selectorInfo[sceneId] = data.selectorInfo[sceneId] || {};
          data.selectorInfo[sceneId].selector =
            data.selectorInfo[sceneId].selector || {};
          data.selectorInfo[sceneId].selector[num] =
            this.cloneAndFixSelectedAccount(selectedAccount);
          return { data };
        },
        shouldCommit: isWriteCurrent,
      });
      return { persisted: transaction.committed };
    }, persistenceLockToken);
  }

  @backgroundMethod()
  async getSelectedAccountWriteIntentEpoch({
    sceneName,
    sceneUrl,
    num,
  }: {
    sceneName: EAccountSelectorSceneName;
    sceneUrl?: string;
    num: number;
  }) {
    checkIsDefined(num);
    checkIsDefined(sceneName);
    return getAccountSelectorWriteIntentEpoch({ sceneName, sceneUrl, num });
  }

  @backgroundMethod()
  async saveSelectedAccountIfWriteIntentCurrent(
    {
      expectedWriteIntentEpoch,
      selectedAccount,
      sceneName,
      sceneUrl,
      num,
    }: {
      expectedWriteIntentEpoch: number;
      selectedAccount: IAccountSelectorSelectedAccount;
      sceneName: EAccountSelectorSceneName;
      sceneUrl?: string;
      num: number;
    },
    persistenceLockToken?: IAccountSelectorPersistenceLockToken,
  ) {
    return this.saveSelectedAccountIfCurrent(
      {
        expectedWriteIntentEpoch,
        selectedAccount,
        sceneName,
        sceneUrl,
        num,
        shouldCommit: () => true,
      },
      persistenceLockToken,
    );
  }

  @backgroundMethod()
  async beginAccountSelectorStorageInit({
    sceneName,
    sceneUrl,
  }: {
    sceneName: EAccountSelectorSceneName;
    sceneUrl?: string;
  }) {
    return registerAccountSelectorStorageInit({ sceneName, sceneUrl });
  }

  @backgroundMethod()
  async recordSelectedAccountIntent({
    num,
    sceneName,
    sceneUrl,
    selectedAccount,
  }: {
    num: number;
    sceneName: EAccountSelectorSceneName;
    sceneUrl?: string;
    selectedAccount: IAccountSelectorSelectedAccount;
  }) {
    checkIsDefined(num);
    checkIsDefined(sceneName);
    return recordAccountSelectorSelectionIntent(
      { num, sceneName, sceneUrl },
      selectedAccount,
    );
  }

  @backgroundMethod()
  async clearUnavailableSelectedAccount(
    {
      expectedSelectedAccount,
      selectedAccount,
      sceneName,
      sceneUrl,
      num,
      shouldSyncWithHomeSource,
      storageInitGeneration,
    }: {
      expectedSelectedAccount: IAccountSelectorSelectedAccount;
      selectedAccount: IAccountSelectorSelectedAccount;
      sceneName: EAccountSelectorSceneName;
      sceneUrl?: string;
      num: number;
      shouldSyncWithHomeSource: boolean;
      storageInitGeneration?: number;
    },
    persistenceLockToken?: IAccountSelectorPersistenceLockToken,
  ) {
    checkIsDefined(num);
    checkIsDefined(sceneName);
    const result = {
      homeMatched: false,
      homeSelectionIntentMatched: true,
      primaryMatched: false,
      primaryPersisted: false,
      storageInitGenerationMatched: true,
      syncedHome: false,
    };
    if (!accountSelectorUtils.isSceneCanPersist({ sceneName })) {
      return result;
    }

    const homePersistenceScope = {
      num: 0,
      sceneName: EAccountSelectorSceneName.home,
    };
    const homeIntentEpochAtRequest =
      getAccountSelectorWriteIntentEpoch(homePersistenceScope);
    return runAccountSelectorPersistenceExclusive(async () => {
      const storageInitScope = { sceneName, sceneUrl };
      const isStorageInitGenerationCurrent = () =>
        storageInitGeneration === undefined ||
        isAccountSelectorStorageInitGenerationCurrent({
          generation: storageInitGeneration,
          scope: storageInitScope,
        });
      const isHomeSelectionIntentCurrent = () => {
        if (
          sceneName === EAccountSelectorSceneName.home ||
          !shouldSyncWithHomeSource
        ) {
          return true;
        }
        if (storageInitGeneration !== undefined) {
          return isAccountSelectorStorageInitHomeIntentCurrent({
            generation: storageInitGeneration,
            scope: storageInitScope,
          });
        }
        return (
          getAccountSelectorWriteIntentEpoch(homePersistenceScope) ===
          homeIntentEpochAtRequest
        );
      };
      const shouldCommitTransaction = () =>
        isStorageInitGenerationCurrent() && isHomeSelectionIntentCurrent();
      const sceneId = accountSelectorUtils.buildAccountSelectorSceneId({
        sceneName,
        sceneUrl,
      });
      const homeSceneId = accountSelectorUtils.buildAccountSelectorSceneId({
        sceneName: EAccountSelectorSceneName.home,
      });
      const transaction = await this.setRawDataTransaction({
        build: (rawData) => {
          if (!isStorageInitGenerationCurrent()) {
            result.storageInitGenerationMatched = false;
            return undefined;
          }
          if (!isHomeSelectionIntentCurrent()) {
            result.homeSelectionIntentMatched = false;
            return undefined;
          }
          const data = cloneDeep(rawData) || {
            selectorInfo: {},
            globalDeriveTypesMap: {},
          };
          const currentSelectedAccount = this.cloneAndFixSelectedAccount(
            data.selectorInfo[sceneId]?.selector?.[num],
          );
          const primaryAlreadyCleared = isSameSelectedAccountOwnership(
            currentSelectedAccount,
            selectedAccount,
          );
          result.primaryMatched =
            primaryAlreadyCleared ||
            isSameSelectedAccountOwnership(
              currentSelectedAccount,
              expectedSelectedAccount,
            );
          if (!result.primaryMatched) {
            return undefined;
          }

          if (!primaryAlreadyCleared) {
            const newPrimarySelectedAccount =
              accountSelectorUtils.buildMergedSelectedAccount({
                data: currentSelectedAccount,
                mergedByData: selectedAccount,
              });
            if (
              !isSameSelectedAccount(
                currentSelectedAccount,
                newPrimarySelectedAccount,
              )
            ) {
              data.selectorInfo[sceneId] = data.selectorInfo[sceneId] || {};
              data.selectorInfo[sceneId].selector =
                data.selectorInfo[sceneId].selector || {};
              data.selectorInfo[sceneId].selector[num] =
                this.cloneAndFixSelectedAccount(newPrimarySelectedAccount);
              result.primaryPersisted = true;
            }
          }

          if (
            sceneName !== EAccountSelectorSceneName.home &&
            shouldSyncWithHomeSource
          ) {
            const homeSelectedAccount = this.cloneAndFixSelectedAccount(
              data.selectorInfo[homeSceneId]?.selector?.[0],
            );
            // Home and Swap share account ownership but intentionally keep their
            // own network and derive type. Compare ownership under the entity
            // mutex, then merge from the current Home value so a valid
            // scene-specific network is preserved while a newer account or
            // focused wallet rejects the cleanup.
            const homeAlreadyCleared = isSameSelectedAccountOwnership(
              homeSelectedAccount,
              selectedAccount,
            );
            result.homeMatched =
              homeAlreadyCleared ||
              isSameSelectedAccountOwnership(
                homeSelectedAccount,
                expectedSelectedAccount,
              );
            if (result.homeMatched && !homeAlreadyCleared) {
              const newHomeSelectedAccount =
                accountSelectorUtils.buildMergedSelectedAccount({
                  data: homeSelectedAccount,
                  mergedByData: selectedAccount,
                });
              if (
                !isSameSelectedAccount(
                  homeSelectedAccount,
                  newHomeSelectedAccount,
                )
              ) {
                data.selectorInfo[homeSceneId] =
                  data.selectorInfo[homeSceneId] || {};
                data.selectorInfo[homeSceneId].selector =
                  data.selectorInfo[homeSceneId].selector || {};
                data.selectorInfo[homeSceneId].selector[0] =
                  this.cloneAndFixSelectedAccount(newHomeSelectedAccount);
                result.syncedHome = true;
              }
            }
          }

          return result.primaryPersisted || result.syncedHome
            ? { data }
            : undefined;
        },
        shouldCommit: shouldCommitTransaction,
      });
      if (!transaction.committed) {
        if (!isStorageInitGenerationCurrent()) {
          result.storageInitGenerationMatched = false;
        }
        if (!isHomeSelectionIntentCurrent()) {
          result.homeSelectionIntentMatched = false;
        }
        result.primaryPersisted = false;
        result.syncedHome = false;
      }

      return result;
    }, persistenceLockToken);
  }

  @backgroundMethod()
  async getSelectedAccountsMap({
    sceneName,
    sceneUrl,
  }: {
    sceneName: EAccountSelectorSceneName;
    sceneUrl?: string;
  }): Promise<IAccountSelectorSelectedAccountsMap | undefined> {
    const sceneId = accountSelectorUtils.buildAccountSelectorSceneId({
      sceneName,
      sceneUrl,
    });
    const data = await this.getRawData();
    // const defaultValue: IAccountSelectorSelectedAccount = {
    //   walletId: undefined,
    //   indexedAccountId: undefined,
    //   accountId: undefined,
    //   networkId: undefined,
    //   deriveType: 'default',
    //   focusedWallet: undefined,
    // };
    const result = data?.selectorInfo[sceneId]?.selector || undefined;
    return result;
  }

  @backgroundMethod()
  async getSelectedAccount({
    sceneName,
    sceneUrl,
    num,
  }: {
    sceneName: EAccountSelectorSceneName;
    sceneUrl?: string;
    num: number;
  }): Promise<IAccountSelectorSelectedAccount | undefined> {
    const selectedAccountsMap = await this.getSelectedAccountsMap({
      sceneName,
      sceneUrl,
    });

    return this.cloneAndFixSelectedAccount(selectedAccountsMap?.[num]);
  }

  private cloneAndFixSelectedAccount(
    selectedAccount: IAccountSelectorSelectedAccount | undefined,
  ) {
    const result = cloneDeep(selectedAccount);
    if (
      result?.networkId &&
      networkUtils.isAllNetwork({ networkId: result.networkId })
    ) {
      result.deriveType = undefined;
    }
    return result;
  }

  async getGlobalDeriveType({
    networkId,
    rawData,
  }: {
    networkId: string;
    rawData?: IAccountSelectorPersistInfo | null;
  }): Promise<IAccountDeriveTypes | undefined> {
    const scope = EGlobalDeriveTypesScopes.global; // shared scope
    // TODO swapTo scope

    const rawDataValue = rawData ?? (await this.getRawData());

    const map = rawDataValue?.globalDeriveTypesMap?.[scope];
    const key = accountSelectorUtils.buildGlobalDeriveTypesMapKey({
      networkId,
    });
    const deriveType = map?.[key];
    if (networkUtils.isBTCNetwork(networkId) && deriveType === undefined) {
      return 'BIP86'; // Taproot
    }
    return deriveType;
  }

  async saveGlobalDeriveType({
    networkId,
    deriveType,
    eventEmitDisabled,
  }: {
    networkId: string;
    deriveType: IAccountDeriveTypes;
    eventEmitDisabled?: boolean;
  }) {
    const scope = EGlobalDeriveTypesScopes.global; // shared scope
    const key = accountSelectorUtils.buildGlobalDeriveTypesMapKey({
      networkId,
    });
    await this.setRawData((rawData) => {
      if (!rawData) {
        throw new OneKeyLocalError('rawData is undefined');
      }
      rawData.globalDeriveTypesMap = rawData?.globalDeriveTypesMap || {};
      rawData.globalDeriveTypesMap[scope] =
        rawData.globalDeriveTypesMap[scope] || {};
      if (rawData.globalDeriveTypesMap[scope][key] !== deriveType) {
        rawData.globalDeriveTypesMap[scope][key] = deriveType;
        if (!eventEmitDisabled) {
          this.scheduleGlobalDeriveTypeUpdate(key);
        }
      }
      return rawData;
    });
  }
}
