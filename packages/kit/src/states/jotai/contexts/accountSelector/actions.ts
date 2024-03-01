import { useRef } from 'react';

import { Semaphore } from 'async-mutex';
import { cloneDeep, isEqual, isUndefined, omitBy } from 'lodash';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';
import { EAccountManagerStacksRoutes } from '@onekeyhq/kit/src/views/AccountManagerStacks/router/types';
import type { IChainSelectorRouteParams } from '@onekeyhq/kit/src/views/ChainSelector/router/type';
import { EChainSelectorPages } from '@onekeyhq/kit/src/views/ChainSelector/router/type';
import type {
  IDBAccount,
  IDBCreateHWWalletParamsBase,
  IDBIndexedAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import type {
  IAccountSelectorFocusedWallet,
  IAccountSelectorSelectedAccount,
  IAccountSelectorSelectedAccountsMap,
} from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import accountSelectorUtils from '@onekeyhq/shared/src/utils/accountSelectorUtils';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { ContextJotaiActionsBase } from '../../utils/ContextJotaiActionsBase';

import {
  accountSelectorEditModeAtom,
  accountSelectorStorageReadyAtom,
  accountSelectorUpdateMetaAtom,
  activeAccountsAtom,
  contextAtomMethod,
  defaultActiveAccountInfo,
  defaultSelectedAccount,
  selectedAccountsAtom,
} from './atoms';

import type {
  IAccountSelectorActiveAccountInfo,
  IAccountSelectorRouteParams,
  IAccountSelectorUpdateMeta,
} from './atoms';

const { serviceAccount } = backgroundApiProxy;

export type IAccountSelectorSyncFromSceneParams = {
  from: {
    sceneName: EAccountSelectorSceneName;
    sceneUrl?: string;
    sceneNum: number;
  };
  num: number;
};

class AccountSelectorActions extends ContextJotaiActionsBase {
  refresh = contextAtomMethod((_, set, payload: { num: number }) => {
    const { num } = payload;
    set(selectedAccountsAtom(), (v) => ({
      ...v,
      [num]: {
        ...v[num],
      } as any,
    }));
  });

  mutex = new Semaphore(1);

  reloadActiveAccountInfo = contextAtomMethod(
    async (
      get,
      set,
      payload: {
        num: number;
        selectedAccount: IAccountSelectorSelectedAccount;
      },
    ): Promise<IAccountSelectorActiveAccountInfo> =>
      this.mutex.runExclusive(async () => {
        const { serviceAccountSelector } = backgroundApiProxy;
        const { num, selectedAccount } = payload;
        console.log('buildActiveAccountInfoFromSelectedAccount', {
          selectedAccount,
        });
        const { activeAccount } =
          await serviceAccountSelector.buildActiveAccountInfoFromSelectedAccount(
            {
              selectedAccount,
            },
          );

        console.log('buildActiveAccountInfoFromSelectedAccount update state', {
          selectedAccount,
          activeAccount,
        });
        set(activeAccountsAtom(), (v) => ({
          ...v,
          [num]: activeAccount,
        }));
        return activeAccount;
      }),
  );

  updateSelectedAccountNetwork = contextAtomMethod(
    async (
      get,
      set,
      payload: {
        num: number;
        networkId: string;
      },
    ) => {
      const { num, networkId } = payload;
      await this.updateSelectedAccount.call(set, {
        num,
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
      },
    ) => {
      const { num, deriveType, updateMeta } = payload;
      await this.updateSelectedAccount.call(set, {
        updateMeta,
        num,
        builder: (v) => ({
          ...v,
          deriveType: deriveType || 'default',
        }),
      });
    },
  );

  updateSelectedAccount = contextAtomMethod(
    async (
      get,
      set,
      payload: {
        updateMeta?: IAccountSelectorUpdateMeta;
        num: number;
        builder: (
          oldAccount: IAccountSelectorSelectedAccount,
        ) => IAccountSelectorSelectedAccount;
      },
    ) => {
      const { num, builder, updateMeta } = payload;
      const oldSelectedAccount: IAccountSelectorSelectedAccount = cloneDeep(
        this.getSelectedAccount.call(set, { num }) || defaultSelectedAccount(),
      );
      const newSelectedAccount = cloneDeep(builder(oldSelectedAccount));
      if (isEqual(oldSelectedAccount, newSelectedAccount)) {
        return;
      }
      // fix deriveType from global storage if change network only, as current deriveType is previous network's
      // **** important: remove this logic will cause infinite loop
      // if you want to change networkId and driveType at same time, you should call updateSelectedAccount twice, first change networkId, then change deriveType
      if (
        newSelectedAccount.networkId !== oldSelectedAccount.networkId &&
        newSelectedAccount.deriveType === oldSelectedAccount.deriveType
      ) {
        const newDriveType =
          await backgroundApiProxy.serviceAccountSelector.getGlobalDeriveType({
            selectedAccount: newSelectedAccount,
          });
        if (newDriveType) {
          newSelectedAccount.deriveType = newDriveType;
        }
      }
      set(selectedAccountsAtom(), (v) => ({
        ...v,
        [num]: newSelectedAccount,
      }));
      set(accountSelectorUpdateMetaAtom(), (v) => ({
        ...v,
        [num]: {
          eventEmitDisabled: Boolean(updateMeta?.eventEmitDisabled),
        },
      }));
    },
  );

  confirmAccountSelect = contextAtomMethod(
    async (
      get,
      set,
      params: {
        indexedAccount: IDBIndexedAccount | undefined;
        othersWalletAccount: IDBAccount | undefined;
        num: number;
      },
    ) => {
      const { num, othersWalletAccount, indexedAccount } = params;
      if (othersWalletAccount && indexedAccount) {
        throw new Error(
          'confirmSelectAccount ERROR: othersWalletAccount and indexedAccount can not be both defined',
        );
      }
      if (!othersWalletAccount && !indexedAccount) {
        throw new Error(
          'confirmSelectAccount ERROR: othersWalletAccount and indexedAccount can not be both undefined',
        );
      }
      const walletId = accountUtils.getWalletIdFromAccountId({
        accountId: indexedAccount?.id || othersWalletAccount?.id || '',
      });
      if (!walletId) {
        throw new Error('confirmSelectAccount ERROR: walletId is undefined');
      }

      const accountNetworkId = this.getAutoSelectNetworkIdForAccount.call(set, {
        num,
        account: othersWalletAccount,
      });

      await this.updateSelectedAccount.call(set, {
        num,
        builder: (v) => ({
          ...v,
          networkId: accountNetworkId || v.networkId,
          walletId,
          othersWalletAccountId: othersWalletAccount?.id,
          indexedAccountId: indexedAccount?.id,
        }),
      });
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
        linkNetwork, // show account address of current network
      }: {
        navigation: ReturnType<typeof useAppNavigation>;
        linkNetwork?: boolean;
      } & IAccountSelectorRouteParams,
    ) => {
      const activeAccountInfo = this.getActiveAccount.call(set, { num });
      if (activeAccountInfo?.wallet?.id) {
        let focusedWalletNew: IAccountSelectorFocusedWallet =
          activeAccountInfo?.wallet?.id;
        if (accountUtils.isOthersWallet({ walletId: focusedWalletNew })) {
          focusedWalletNew = '$$others';
        }
        await this.updateSelectedAccount.call(set, {
          num,
          builder: (v) => ({
            ...v,
            focusedWallet: focusedWalletNew,
          }),
        });
      }
      set(accountSelectorEditModeAtom(), false);
      navigation.pushModal(EModalRoutes.AccountManagerStacks, {
        screen: EAccountManagerStacksRoutes.AccountSelectorStack,
        params: {
          num,
          sceneName,
          sceneUrl,
          linkNetwork,
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
      } & IChainSelectorRouteParams,
    ) => {
      navigation.pushModal(EModalRoutes.ChainSelectorModal, {
        screen: EChainSelectorPages.ChainSelector,
        params: routeParams,
      });
    },
  );

  autoSelectToCreatedWallet = contextAtomMethod(
    async (
      _,
      set,
      {
        wallet,
        indexedAccount,
      }: { wallet: IDBWallet; indexedAccount: IDBIndexedAccount },
    ) => {
      await this.updateSelectedAccount.call(set, {
        num: 0,
        builder: (v) => ({
          ...v,
          indexedAccountId: indexedAccount.id,
          walletId: wallet.id,
          focusedWallet: wallet.id,
        }),
      });
    },
  );

  createHDWallet = contextAtomMethod(
    async (
      _,
      set,
      {
        mnemonic,
      }: {
        mnemonic: string;
      },
    ) => {
      const { wallet, indexedAccount } = await serviceAccount.createHDWallet({
        mnemonic,
      });
      await this.autoSelectToCreatedWallet.call(set, {
        wallet,
        indexedAccount,
      });
      return { wallet, indexedAccount };
    },
  );

  createHWWallet = contextAtomMethod(
    async (_, set, params: IDBCreateHWWalletParamsBase) => {
      const res = await serviceAccount.createHWWallet(params);
      const { wallet, indexedAccount } = res;
      await this.autoSelectToCreatedWallet.call(set, {
        wallet,
        indexedAccount,
      });
      return res;
    },
  );

  createHWHiddenWallet = contextAtomMethod(
    async (_, set, { walletId }: { walletId: string }) => {
      const res = await serviceAccount.createHWHiddenWallet({ walletId });
      const { wallet, indexedAccount } = res;
      await this.autoSelectToCreatedWallet.call(set, {
        wallet,
        indexedAccount,
      });
      return res;
    },
  );

  createHWWalletWithHidden = contextAtomMethod(
    async (_, set, params: IDBCreateHWWalletParamsBase) => {
      const { wallet, device } = await this.createHWWallet.call(set, params);
      // add hidden wallet if device passphrase enabled
      if (device && device.featuresInfo?.passphrase_protection) {
        // wait previous action done, wait device ready
        await backgroundApiProxy.serviceHardware.showCheckingDeviceDialog({
          connectId: device.connectId,
        });
        await timerUtils.wait(3000);
        await this.createHWHiddenWallet.call(set, {
          walletId: wallet.id,
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
      }: {
        walletId: string;
      },
    ) => {
      await serviceAccount.removeWallet({ walletId });
      set(accountSelectorEditModeAtom(), false);
      const selectedAccount = this.getSelectedAccount.call(set, { num: 0 });

      // auto change to next available wallet
      if (selectedAccount?.walletId === walletId) {
        const { wallets } = await serviceAccount.getHDAndHWWallets();
        const firstWallet: IDBWallet | undefined = wallets[0];
        let firstAccount: IDBIndexedAccount | undefined;
        if (
          firstWallet &&
          (accountUtils.isHdWallet({ walletId: firstWallet.id }) ||
            accountUtils.isHwWallet({ walletId: firstWallet.id }))
        ) {
          const { accounts } = await serviceAccount.getIndexedAccounts({
            walletId: firstWallet?.id,
          });
          // eslint-disable-next-line prefer-destructuring
          firstAccount = accounts[0];
        }

        // TODO singleton wallet auto change account, use autoSelectAccount() instead?

        await this.updateSelectedAccount.call(set, {
          num: 0,
          builder: (v) => ({
            ...v,
            indexedAccountId: firstAccount?.id,
            walletId: firstWallet?.id,
            focusedWallet: firstWallet?.id,
          }),
        });
      } else {
        await this.updateSelectedAccount.call(set, {
          num: 0,
          builder: (v) => ({
            ...v,
            focusedWallet: selectedAccount?.walletId,
          }),
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
          sceneName: EAccountSelectorSceneName;
          sceneUrl?: string | undefined;
          num: number;
        };
      },
    ) => {
      const { serviceAccountSelector } = backgroundApiProxy;
      await this.mutexSyncHomeAndSwap.runExclusive(async () => {
        const { sceneName, sceneUrl, num, eventPayload } = params;

        if (
          accountSelectorUtils.isEqualAccountSelectorScene({
            scene1: { sceneName, sceneUrl, num },
            scene2: eventPayload,
          })
        ) {
          return;
        }

        const shouldSync =
          (await serviceAccountSelector.shouldSyncWithHome({
            sceneName,
            sceneUrl,
            num,
          })) &&
          (await serviceAccountSelector.shouldSyncWithHome(eventPayload));

        if (shouldSync) {
          const current = this.getSelectedAccount.call(set, { num });
          const newSelectedAccount =
            accountSelectorUtils.buildMergedSelectedAccount({
              data: current,
              mergedByData: eventPayload.selectedAccount,
            });
          console.log('syncHomeAndSwapSelectedAccount >>>> ', {
            params,
            data: current,
            mergedByData: eventPayload.selectedAccount,
            newSelectedAccount,
          });
          await this.updateSelectedAccount.call(set, {
            updateMeta: {
              eventEmitDisabled: true, // stop update infinite loop here
            },
            num,
            builder(v) {
              return newSelectedAccount || v;
            },
          });
        }
      });
    },
  );

  reloadSwapToAccountFromHome = contextAtomMethod(async (get, set) => {
    const swapMap =
      await backgroundApiProxy.simpleDb.accountSelector.getSelectedAccountsMap({
        sceneName: EAccountSelectorSceneName.swap,
      });
    const newMap =
      await backgroundApiProxy.serviceAccountSelector.mergeHomeDataToSwapMap({
        swapMap,
      });
    await this.updateSelectedAccount.call(set, {
      num: 1,
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
        sceneName,
        sceneUrl,
      }: {
        num: number;
        sceneName: EAccountSelectorSceneName;
        sceneUrl?: string | undefined;
      },
    ) => {
      await this.mutexSyncLocalDeriveType.runExclusive(async () => {
        const selectedAccount = this.getSelectedAccount.call(set, {
          num,
        });
        const globalDeriveType =
          await backgroundApiProxy.serviceAccountSelector.getGlobalDeriveType({
            selectedAccount,
          });
        // **** globalDeriveType -> selectedAccount.deriveType
        if (globalDeriveType) {
          console.log('syncLocalDeriveTypeFromGlobal >>>> ', {
            selectedAccount,
            globalDeriveType,
            sceneName,
            sceneUrl,
            num,
          });
          await this.updateSelectedAccountDeriveType.call(set, {
            updateMeta: {
              eventEmitDisabled: true, // stop update infinite loop here
            },
            num,
            deriveType: globalDeriveType || 'default',
          });
        }
      });
    },
  );

  initFromStorage = contextAtomMethod(
    async (
      get,
      set,
      {
        sceneName,
        sceneUrl,
      }: {
        sceneName: EAccountSelectorSceneName;
        sceneUrl?: string;
      },
    ) => {
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

      // fix discover account from dappConnection
      if (sceneUrl && sceneName === EAccountSelectorSceneName.discover) {
        const connectionMap =
          await backgroundApiProxy.simpleDb.dappConnection.getAccountSelectorMap(
            {
              sceneUrl,
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
        }
      }

      if (selectedAccountsMapInDB) {
        selectedAccountsMapInDB = cloneDeep(selectedAccountsMapInDB);
      }

      // fix swap account from home
      if (sceneName === EAccountSelectorSceneName.swap) {
        selectedAccountsMapInDB =
          await serviceAccountSelector.mergeHomeDataToSwapMap({
            swapMap: selectedAccountsMapInDB,
          });
        console.log('mergeHomeDataToSwapMap ', selectedAccountsMapInDB);
      }

      // fix derive type from global
      if (selectedAccountsMapInDB) {
        selectedAccountsMapInDB =
          await backgroundApiProxy.serviceAccountSelector.fixDeriveTypesForInitAccountSelectorMap(
            {
              selectedAccountsMapInDB,
              sceneName,
              sceneUrl,
            },
          );
      }

      const selectedAccountsMap = get(selectedAccountsAtom());
      if (
        selectedAccountsMapInDB &&
        !isEqual(selectedAccountsMapInDB, selectedAccountsMap)
      ) {
        set(selectedAccountsAtom(), (v) => selectedAccountsMapInDB || v);
      }
      set(accountSelectorStorageReadyAtom(), () => true);
    },
  );

  mutexSaveToStorage = new Semaphore(1);

  saveToStorage = contextAtomMethod(
    async (
      get,
      set,
      payload: {
        selectedAccount: IAccountSelectorSelectedAccount;
        sceneName: EAccountSelectorSceneName;
        sceneUrl?: string;
        num: number;
      },
    ) => {
      const { serviceAccountSelector } = backgroundApiProxy;
      await this.mutexSaveToStorage.runExclusive(async () => {
        const { selectedAccount, sceneName, sceneUrl, num } = payload;
        const { simpleDb } = backgroundApiProxy;
        const isReady = get(accountSelectorStorageReadyAtom());
        if (!isReady) {
          return;
        }
        if (isEqual(selectedAccount, defaultSelectedAccount)) {
          console.error(
            'AccountSelector.saveToStorage skip, selectedAccount is default',
          );
          return;
        }
        const currentSaved = await simpleDb.accountSelector.getSelectedAccount({
          sceneName,
          sceneUrl,
          num,
        });
        if (isEqual(currentSaved, selectedAccount)) {
          console.error(
            'AccountSelector.saveToStorage skip, selectedAccount not changed',
          );
          return;
        }

        // **** saveSelectedAccount
        // skip discover account selector persist here
        await simpleDb.accountSelector.saveSelectedAccount(payload);

        // **** save global derive type (with event emit if need)
        const updateMeta = get(accountSelectorUpdateMetaAtom())[num];
        const eventEmitDisabled = Boolean(updateMeta?.eventEmitDisabled);
        await backgroundApiProxy.serviceAccountSelector.saveGlobalDeriveType({
          eventEmitDisabled,
          selectedAccount,
          sceneName,
          sceneUrl,
          num,
        });

        // **** also save to home scene SelectedAccount if sync needed
        if (
          sceneName !== EAccountSelectorSceneName.home &&
          (await serviceAccountSelector.shouldSyncWithHome({
            sceneName,
            sceneUrl,
            num,
          }))
        ) {
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
          await simpleDb.accountSelector.saveSelectedAccount({
            sceneName: EAccountSelectorSceneName.home,
            num: 0,
            selectedAccount: newSelectedAccount,
          });
        }

        // **** emit event
        if (!eventEmitDisabled) {
          appEventBus.emit(
            EAppEventBusNames.AccountSelectorSelectedAccountUpdate,
            payload,
          );
        }
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
    async (get, set, { from, num }: IAccountSelectorSyncFromSceneParams) => {
      const { sceneName, sceneUrl, sceneNum } = from;

      const selectedAccount =
        await backgroundApiProxy.simpleDb.accountSelector.getSelectedAccount({
          sceneName,
          sceneUrl,
          num: sceneNum,
        });

      await this.updateSelectedAccount.call(set, {
        num,
        builder: (v) => selectedAccount || v,
      });
    },
  );

  getAutoSelectNetworkIdForAccount = contextAtomMethod(
    (
      get,
      set,
      {
        num,
        account,
      }: {
        num: number;
        account: IDBAccount | undefined;
      },
    ) => {
      if (!account) {
        return '';
      }
      const { networkId } = this.getSelectedAccount.call(set, { num });
      if (!networkId) {
        return '';
      }
      const accountNetworkId = accountUtils.getAccountCompatibleNetwork({
        account,
        networkId,
      });
      if (accountNetworkId && accountNetworkId !== networkId) {
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
        await this.updateSelectedAccount.call(set, {
          num,
          builder: (v) => ({
            ...v,
            networkId: accountNetworkId,
          }),
        });
      }
    },
  );

  autoSelectAccount = contextAtomMethod(
    async (get, set, { num }: { num: number }) => {
      const storageReady = get(accountSelectorStorageReadyAtom());
      const selectedAccount = this.getSelectedAccount.call(set, { num });
      const activeAccount = this.getActiveAccount.call(set, { num });
      // TODO auto select account from home scene
      if (activeAccount && activeAccount?.ready && storageReady) {
        const { network, wallet, indexedAccount, account } = activeAccount;
        if (
          !selectedAccount?.focusedWallet ||
          !network ||
          !wallet ||
          (!indexedAccount && !account)
        ) {
          const selectedAccountNew = cloneDeep(
            selectedAccount || defaultSelectedAccount(),
          );
          let selectedWalletId = wallet?.id;
          let selectedWallet = wallet;
          let selectedIndexedAccountId = indexedAccount?.id;
          const hasIndexedAccounts =
            selectedWalletId &&
            (accountUtils.isHdWallet({
              walletId: selectedWalletId,
            }) ||
              accountUtils.isHwWallet({
                walletId: selectedWalletId,
              })) &&
            (await serviceAccount.isWalletHasIndexedAccounts({
              walletId: selectedWalletId,
            }));
          if (!selectedWalletId || !hasIndexedAccounts) {
            const { wallets } = await serviceAccount.getHDAndHWWallets();
            for (const wallet0 of wallets) {
              if (
                await serviceAccount.isWalletHasIndexedAccounts({
                  walletId: wallet0.id,
                })
              ) {
                selectedWallet = wallet0;
                selectedWalletId = selectedWallet?.id;
                selectedAccountNew.walletId = selectedWalletId;
                break;
              }
            }
          }

          const isHdWallet = accountUtils.isHdWallet({
            walletId: selectedWalletId,
          });
          const isHwWallet = accountUtils.isHwWallet({
            walletId: selectedWalletId,
          });
          const isOthers =
            Boolean(selectedWalletId) && !isHdWallet && !isHwWallet;

          if (isOthers) {
            selectedAccountNew.focusedWallet = '$$others';
            selectedAccountNew.indexedAccountId = undefined;
            // TODO auto select first others account if wallet or account not match
          } else if (selectedWalletId) {
            if (
              !indexedAccount ||
              indexedAccount.walletId !== selectedWalletId
            ) {
              selectedAccountNew.focusedWallet = selectedWalletId;
              const { accounts: indexedAccounts } =
                await serviceAccount.getIndexedAccounts({
                  walletId: selectedWalletId,
                });
              selectedIndexedAccountId = indexedAccounts[0]?.id;
              selectedAccountNew.indexedAccountId = selectedIndexedAccountId;
            }
          }

          // TODO auto select network and derive type, check network compatible for others wallet account

          await this.updateSelectedAccount.call(set, {
            num,
            builder: () => selectedAccountNew,
          });
        }
      }
    },
  );
}

const createActions = memoFn(() => new AccountSelectorActions());

export function useAccountSelectorActions() {
  const actions = createActions();
  const reloadActiveAccountInfo = actions.reloadActiveAccountInfo.use();
  const getSelectedAccount = actions.getSelectedAccount.use();
  const initFromStorage = actions.initFromStorage.use();
  const saveToStorage = actions.saveToStorage.use();
  const updateSelectedAccount = actions.updateSelectedAccount.use();
  const updateSelectedAccountNetwork =
    actions.updateSelectedAccountNetwork.use();
  const updateSelectedAccountDeriveType =
    actions.updateSelectedAccountDeriveType.use();
  const refresh = actions.refresh.use();
  const showAccountSelector = actions.showAccountSelector.use();
  const showChainSelector = actions.showChainSelector.use();
  const removeWallet = actions.removeWallet.use();
  const createHDWallet = actions.createHDWallet.use();
  const createHWWallet = actions.createHWWallet.use();
  const createHWHiddenWallet = actions.createHWHiddenWallet.use();
  const createHWWalletWithHidden = actions.createHWWalletWithHidden.use();
  const autoSelectAccount = actions.autoSelectAccount.use();
  const autoSelectNetworkOfOthersWalletAccount =
    actions.autoSelectNetworkOfOthersWalletAccount.use();
  const syncFromScene = actions.syncFromScene.use();
  const confirmAccountSelect = actions.confirmAccountSelect.use();
  const syncHomeAndSwapSelectedAccount =
    actions.syncHomeAndSwapSelectedAccount.use();
  const syncLocalDeriveTypeFromGlobal =
    actions.syncLocalDeriveTypeFromGlobal.use();
  const reloadSwapToAccountFromHome = actions.reloadSwapToAccountFromHome.use();

  return useRef({
    reloadActiveAccountInfo,
    getSelectedAccount,
    refresh,
    initFromStorage,
    saveToStorage,
    updateSelectedAccount,
    updateSelectedAccountNetwork,
    updateSelectedAccountDeriveType,
    showAccountSelector,
    showChainSelector,
    removeWallet,
    createHDWallet,
    createHWWallet,
    createHWHiddenWallet,
    createHWWalletWithHidden,
    autoSelectAccount,
    autoSelectNetworkOfOthersWalletAccount,
    syncFromScene,
    confirmAccountSelect,
    syncHomeAndSwapSelectedAccount,
    syncLocalDeriveTypeFromGlobal,
    reloadSwapToAccountFromHome,
  });
}
