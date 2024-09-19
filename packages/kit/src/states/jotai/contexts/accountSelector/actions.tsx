import { useRef } from 'react';

import { Semaphore } from 'async-mutex';
import { cloneDeep, isEqual, isUndefined, omitBy } from 'lodash';

import type { IDialogInstance } from '@onekeyhq/components';
import { Dialog } from '@onekeyhq/components';
import { tonMnemonicToKeyPair } from '@onekeyhq/core/src/secret';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { CommonDeviceLoading } from '@onekeyhq/kit/src/components/Hardware/Hardware';
import type useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import qrHiddenCreateGuideDialog from '@onekeyhq/kit/src/views/Onboarding/pages/ConnectHardwareWallet/qrHiddenCreateGuideDialog';
import type {
  IDBAccount,
  IDBCreateHwWalletParamsBase,
  IDBCreateQRWalletParams,
  IDBIndexedAccount,
  IDBWallet,
  IDBWalletIdSingleton,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import type {
  IAccountSelectorFocusedWallet,
  IAccountSelectorSelectedAccount,
  IAccountSelectorSelectedAccountsMap,
} from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityAccountSelector';
import type { IJotaiSetter } from '@onekeyhq/kit-bg/src/states/jotai/types';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
} from '@onekeyhq/shared/src/consts/dbConsts';
import { type IOneKeyError } from '@onekeyhq/shared/src/errors/types/errorTypes';
import {
  EAppEventBusNames,
  EFinalizeWalletSetupSteps,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  IAccountChainSelectorRouteParams,
  IAccountSelectorRouteParamsExtraConfig,
} from '@onekeyhq/shared/src/routes';
import {
  EAccountManagerStacksRoutes,
  EChainSelectorPages,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import accountSelectorUtils from '@onekeyhq/shared/src/utils/accountSelectorUtils';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import {
  EAccountSelectorAutoSelectTriggerBy,
  EAccountSelectorSceneName,
} from '@onekeyhq/shared/types';

import { ContextJotaiActionsBase } from '../../utils/ContextJotaiActionsBase';

import {
  accountSelectorContextDataAtom,
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
  ISelectedAccountsAtomMap,
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

export type IFinalizeWalletSetupCreateWalletResult = {
  wallet: IDBWallet;
  indexedAccount: IDBIndexedAccount | undefined;
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
  ) {
    console.log('AccountSelectorAtomChanged  setSelectedAccountsAtom', reason);
    set(selectedAccountsAtom(), (currentValue) => {
      const newValue = fn(currentValue);
      if (isEqual(currentValue, newValue)) {
        return currentValue;
      }
      return newValue;
    });
  }

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
        let activeAccount: IAccountSelectorActiveAccountInfo | undefined;
        try {
          ({ activeAccount } =
            await serviceAccountSelector.buildActiveAccountInfoFromSelectedAccount(
              {
                selectedAccount,
              },
            ));
        } catch (error) {
          //
          activeAccount = {
            ...defaultActiveAccountInfo(),
            ready: true,
          };
        }
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

  updateSelectedAccountFocusedWallet = contextAtomMethod(
    async (
      get,
      set,
      payload: {
        num: number;
        focusedWallet: string | undefined;
      },
    ) => {
      const { num, focusedWallet } = payload;
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
        builder: (v) => ({
          ...v,
          focusedWallet: focusedWalletFixed,
        }),
      });
    },
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
      const contextData = get(accountSelectorContextDataAtom());
      // if (!contextData) {
      //   return;
      // }
      const { num, builder, updateMeta } = payload;
      const oldSelectedAccount: IAccountSelectorSelectedAccount = cloneDeep(
        this.getSelectedAccount.call(set, { num }) || defaultSelectedAccount(),
      );
      const newSelectedAccount = cloneDeep(builder(oldSelectedAccount));
      if (isEqual(oldSelectedAccount, newSelectedAccount)) {
        return;
      }

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

        if (contextData?.sceneName) {
          await fixDeriveTypeByGlobal({ sceneName: contextData?.sceneName });

          const shouldUseGlobalDeriveType =
            await backgroundApiProxy.serviceAccountSelector.shouldUseGlobalDeriveType(
              {
                sceneName: contextData?.sceneName,
              },
            );
          if (!shouldUseGlobalDeriveType && newSelectedAccount?.networkId) {
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
      this.setSelectedAccountsAtom(
        set,
        (v) => ({
          ...v,
          [num]: newSelectedAccount,
        }),
        'updateSelectedAccount',
      );
      set(accountSelectorUpdateMetaAtom(), (v) => ({
        ...v,
        [num]: {
          eventEmitDisabled: Boolean(updateMeta?.eventEmitDisabled),
        },
      }));
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
      },
    ) => {
      const {
        num,
        othersWalletAccount,
        indexedAccount,
        autoChangeToAccountMatchedNetworkId,
        forceSelectToNetworkId,
      } = params;
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

      const accountNetworkId: string =
        forceSelectToNetworkId ||
        this.getAutoSelectNetworkIdForAccount.call(set, {
          num,
          account: othersWalletAccount,
          autoChangeToAccountMatchedNetworkId,
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

      appEventBus.emit(EAppEventBusNames.ConfirmAccountSelected, undefined);
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
        ...others
      }: {
        navigation: ReturnType<typeof useAppNavigation>;
      } & IAccountSelectorRouteParams &
        IAccountSelectorRouteParamsExtraConfig,
    ) => {
      defaultLogger.accountSelector.perf.showAccountSelector({
        num,
        sceneName,
        sceneUrl,
      });

      const activeAccountInfo = this.getActiveAccount.call(set, { num });
      if (activeAccountInfo?.wallet?.id) {
        // focus to active wallet when open selector
        const focusedWalletNew: IAccountSelectorFocusedWallet =
          activeAccountInfo?.wallet?.id;
        await this.updateSelectedAccountFocusedWallet.call(set, {
          num,
          focusedWallet: focusedWalletNew,
        });
      }
      set(accountSelectorEditModeAtom(), false);

      navigation.pushModal(EModalRoutes.AccountManagerStacks, {
        screen: EAccountManagerStacksRoutes.AccountSelectorStack,
        params: {
          num,
          sceneName,
          sceneUrl,
          ...others,
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

  withFinalizeWalletSetupStep = contextAtomMethod(
    async (
      get,
      set,
      {
        createWalletFn,
        generatingAccountsFn,
      }: {
        createWalletFn: () => Promise<IFinalizeWalletSetupCreateWalletResult>;
        generatingAccountsFn: (
          params: IFinalizeWalletSetupCreateWalletResult,
        ) => Promise<void>;
      },
    ) => {
      try {
        appEventBus.emit(EAppEventBusNames.FinalizeWalletSetupStep, {
          step: EFinalizeWalletSetupSteps.CreatingWallet,
        });

        await timerUtils.wait(100);

        const [{ wallet, indexedAccount, hidden }] = await Promise.all([
          await createWalletFn(),
          await timerUtils.wait(1000),
        ]);

        appEventBus.emit(EAppEventBusNames.FinalizeWalletSetupStep, {
          step: EFinalizeWalletSetupSteps.GeneratingAccounts,
        });

        await timerUtils.wait(100);

        await Promise.all([
          generatingAccountsFn({ wallet, indexedAccount, hidden }),
          await timerUtils.wait(1000),
        ]);

        appEventBus.emit(EAppEventBusNames.FinalizeWalletSetupStep, {
          step: EFinalizeWalletSetupSteps.EncryptingData,
        });

        await timerUtils.wait(1000);

        appEventBus.emit(EAppEventBusNames.FinalizeWalletSetupStep, {
          step: EFinalizeWalletSetupSteps.Ready,
        });

        await timerUtils.wait(0);

        return { wallet, indexedAccount };
      } catch (error) {
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
      },
    ) => {
      const {
        wallet,
        indexedAccount,
        skipDeviceCancel,
        hideCheckingDeviceLoading,
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
      return backgroundApiProxy.serviceBatchCreateAccount.addDefaultNetworkAccounts(
        {
          walletId: wallet.id,
          indexedAccountId: indexedAccount?.id,
          customNetworks:
            networkId && deriveType ? [{ networkId, deriveType }] : undefined,

          skipDeviceCancel,
          hideCheckingDeviceLoading,
        },
      );
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
    ) =>
      this.withFinalizeWalletSetupStep.call(set, {
        createWalletFn: async () => {
          const { wallet, indexedAccount } =
            await serviceAccount.createHDWallet({
              mnemonic,
            });
          await this.autoSelectToCreatedWallet.call(set, {
            wallet,
            indexedAccount,
          });
          return { wallet, indexedAccount };
        },
        generatingAccountsFn: async ({ wallet, indexedAccount }) => {
          await this.addDefaultNetworkAccounts.call(set, {
            wallet,
            indexedAccount,
          });
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
      const { wallet, indexedAccount } = res;

      if (!options?.disableAutoSelect) {
        await this.autoSelectToCreatedWallet.call(set, {
          wallet,
          indexedAccount,
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
        const res = await serviceAccount.createHWHiddenWallet({
          walletId,
          skipDeviceCancel,
          hideCheckingDeviceLoading,
        });
        const { wallet, indexedAccount } = res;
        await this.autoSelectToCreatedWallet.call(set, {
          wallet,
          indexedAccount,
        });
        if (options?.addDefaultNetworkAccounts) {
          let dialog: IDialogInstance | undefined;
          try {
            if (options?.showAddAccountsLoading) {
              dialog = Dialog.show({
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
              skipDeviceCancel: true,
              hideCheckingDeviceLoading: true,
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

  createHWWalletWithHidden = contextAtomMethod(
    async (_, set, params: IDBCreateHwWalletParamsBase) =>
      this.withFinalizeWalletSetupStep.call(set, {
        createWalletFn: async () => {
          const { wallet, device, indexedAccount } =
            await this.createHWWallet.call(set, params, {
              disableAutoSelect: true,
            });

          let hiddenWalletCreatedResult:
            | {
                wallet: IDBWallet;
                indexedAccount: IDBIndexedAccount;
              }
            | undefined;
          // add hidden wallet if device passphrase enabled (SearchedDevice.features is cached in web sdk)
          if (device && device.featuresInfo?.passphrase_protection) {
            // wait previous action done, wait device ready
            if (!params.hideCheckingDeviceLoading) {
              await backgroundApiProxy.serviceHardwareUI.showCheckingDeviceDialog(
                {
                  connectId: device.connectId,
                },
              );
            }
            await timerUtils.wait(3000);

            hiddenWalletCreatedResult = await this.createHWHiddenWallet.call(
              set,
              {
                walletId: wallet.id,
                skipDeviceCancel: params.skipDeviceCancel,
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
            });
          }

          return {
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
              skipDeviceCancel: params.skipDeviceCancel,
              hideCheckingDeviceLoading: params.hideCheckingDeviceLoading,
            });
            await timerUtils.wait(3000);
          }
          await this.addDefaultNetworkAccounts.call(set, {
            wallet,
            indexedAccount,
            skipDeviceCancel: params.skipDeviceCancel,
            hideCheckingDeviceLoading: params.hideCheckingDeviceLoading,
          });
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
            throw new Error('qrDevice is required');
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
            });
            // update networkId and deriveType matched with first account
            await this.updateSelectedAccount.call(set, {
              num: 0, // update home num selector
              builder: (v) => {
                const currentNetworkSupport = result?.addedAccounts?.find(
                  (item) =>
                    item.networkId === v.networkId &&
                    item.deriveType === v.deriveType,
                );
                const firstAccount = result?.addedAccounts?.[0];

                if (currentNetworkSupport || !firstAccount) {
                  return v;
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
      const { servicePassword } = backgroundApiProxy;
      const { mnemonic: realMnemonic } = await serviceAccount.validateMnemonic(
        mnemonic,
      );
      const keyPair = await tonMnemonicToKeyPair(realMnemonic.split(' '));
      const privateHex = bufferUtils.bytesToHex(keyPair.secretKey.slice(0, 32));
      const input = await servicePassword.encodeSensitiveText({
        text: privateHex,
      });
      const r = await serviceAccount.addImportedAccount({
        input,
        deriveType: 'default',
        networkId: getNetworkIdsMap().ton,
        name: '',
        shouldCheckDuplicateName: true,
      });

      const accountId = r?.accounts?.[0]?.id;
      await serviceAccount.saveTonImportedAccountMnemonic({
        accountId,
        mnemonic,
      });
      void this.updateSelectedAccountForSingletonAccount.call(set, {
        num: 0,
        networkId: getNetworkIdsMap().ton,
        walletId: WALLET_TYPE_IMPORTED,
        othersWalletAccountId: accountId,
      });
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
      }: {
        walletId: string;
      },
    ) => {
      // TODO add home scene check
      const num = 0;
      await serviceAccount.removeWallet({ walletId });
      set(accountSelectorEditModeAtom(), false);

      await this.autoSelectNextAccount.call(set, {
        num,
        triggerBy: EAccountSelectorAutoSelectTriggerBy.removeWallet,
      });
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
            sceneName,
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
        this.setSelectedAccountsAtom(
          set,
          (v) => selectedAccountsMapInDB || v,
          'initFromStorage',
        );
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
        const { sceneName, sceneUrl, num } = payload;
        let { selectedAccount } = payload;
        const { simpleDb } = backgroundApiProxy;
        const isReady = get(accountSelectorStorageReadyAtom());
        if (!isReady) {
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
      {
        wallet,
        indexedAccount,
      }: { wallet: IDBWallet; indexedAccount?: IDBIndexedAccount },
    ) => {
      await this.updateSelectedAccount.call(set, {
        num: 0,
        builder: (v) => ({
          ...v,
          indexedAccountId: indexedAccount?.id,
          walletId: wallet.id,
          focusedWallet: wallet.id,
        }),
      });
    },
  );

  autoSelectNextAccount = contextAtomMethod(
    async (
      get,
      set,
      {
        sceneName,
        sceneUrl,
        num,
        triggerBy,
      }: {
        sceneName?: EAccountSelectorSceneName;
        sceneUrl?: string;
        num: number;
        triggerBy?: EAccountSelectorAutoSelectTriggerBy;
      },
    ) => {
      console.log('accountSelector actions.autoSelectAccount >>> ', {
        sceneName,
        sceneUrl,
        num,
        triggerBy,
      });

      // addressInput scene should keep empty selection, let user select account manually
      if (!accountSelectorUtils.isSceneCanAutoSelect({ sceneName })) {
        return;
      }

      // wait activeAccount build done
      await timerUtils.wait(300);
      const storageReady = get(accountSelectorStorageReadyAtom());
      const activeAccount = this.getActiveAccount.call(set, { num });
      const isActiveAccountReady = Boolean(
        activeAccount && activeAccount?.ready && storageReady,
      );
      if (!isActiveAccountReady) {
        return;
      }

      // TODO auto select account from home scene
      const { network, wallet, indexedAccount, account, dbAccount } =
        activeAccount;
      const selectedAccount = this.getSelectedAccount.call(set, { num });
      const isAccountExist = Boolean(indexedAccount || account || dbAccount);
      if (
        !selectedAccount?.focusedWallet ||
        !network ||
        !wallet ||
        !isAccountExist
      ) {
        const selectedAccountNew = await this.cloneSelectedAccountNew.call(
          set,
          {
            num,
          },
        );
        let selectedWalletId = wallet?.id;
        let selectedWallet = wallet;
        let selectedIndexedAccountId = indexedAccount?.id;
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
        const currentFocusWallet = selectedAccount?.focusedWallet;

        // auto select hd hw wallet if current wallet not contains next available account
        if (!selectedWalletId || !hasIndexedAccounts) {
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
            } catch (e) {
              //
            }
          }
          if (shouldSelectHdHwWallet) {
            const { wallets } = await serviceAccount.getAllHdHwQrWallets();
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
            // maybe no hd hw wallet found, reset walletId and indexedAccountId
            if (!selectedWallet) {
              selectedAccountNew.walletId = undefined;
              selectedAccountNew.indexedAccountId = undefined;
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
          if (!indexedAccount || indexedAccount.walletId !== selectedWalletId) {
            const { accounts: indexedAccounts } =
              await serviceAccount.getIndexedAccountsOfWallet({
                walletId: selectedWalletId,
              });
            selectedIndexedAccountId = indexedAccounts?.[0]?.id;
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
              const accountNetworkId = accountUtils.getAccountCompatibleNetwork(
                {
                  account: firstAccount,
                  networkId: network?.id || '',
                },
              );
              selectedAccountNew.focusedWallet = singletonWalletId;
              selectedAccountNew.networkId = accountNetworkId || network?.id;
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
            const done = await autoSelectAccountFromOthersWallet(walletType);
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
          if (!finalWallet) {
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

        await this.updateSelectedAccount.call(set, {
          num,
          builder: () => selectedAccountNew,
        });

        if (
          selectedAccount.walletId !== selectedAccountNew.walletId &&
          triggerBy !==
            EAccountSelectorAutoSelectTriggerBy.removeLastOthersAccount &&
          triggerBy !== EAccountSelectorAutoSelectTriggerBy.removeAccount
        ) {
          set(accountSelectorEditModeAtom(), false);
        }
      } else if (
        // (else if) when auto select logic not trigger, should fix focusedWallet only
        // focused A wallet, but remove B wallet, should focus back to A wallet
        triggerBy &&
        [
          EAccountSelectorAutoSelectTriggerBy.removeWallet,
          EAccountSelectorAutoSelectTriggerBy.removeLastOthersAccount,
        ].includes(triggerBy)
      ) {
        const selectedAccountNew = await this.cloneSelectedAccountNew.call(
          set,
          {
            num,
          },
        );
        // autofix focusedWallet when remove an unfocused wallet
        selectedAccountNew.focusedWallet = selectedAccountNew.walletId;
        await this.updateSelectedAccount.call(set, {
          num,
          builder: () => selectedAccountNew,
        });
      }
    },
  );
}

const createActions = memoFn(() => new AccountSelectorActions());

export function useAccountSelectorActions() {
  const actions = createActions();
  const reloadActiveAccountInfo = actions.reloadActiveAccountInfo.use();
  const getSelectedAccount = actions.getSelectedAccount.use();
  const getActiveAccount = actions.getActiveAccount.use();
  const initFromStorage = actions.initFromStorage.use();
  const saveToStorage = actions.saveToStorage.use();

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
  const removeWallet = actions.removeWallet.use();
  const removeAccount = actions.removeAccount.use();
  const createHDWallet = actions.createHDWallet.use();
  // const createHWWallet = actions.createHWWallet.use();
  const createHWHiddenWallet = actions.createHWHiddenWallet.use();
  const createHWWalletWithHidden = actions.createHWWalletWithHidden.use();
  const createQrWallet = actions.createQrWallet.use();
  const createTonImportedWallet = actions.createTonImportedWallet.use();
  const autoSelectNextAccount = actions.autoSelectNextAccount.use();
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
    getActiveAccount,
    refresh,
    initFromStorage,
    saveToStorage,
    clearSelectedAccount,
    updateSelectedAccountNetwork,
    updateSelectedAccountDeriveType,
    updateSelectedAccountFocusedWallet,
    updateSelectedAccountForHdOrHwAccount,
    updateSelectedAccountForSingletonAccount,
    showAccountSelector,
    showChainSelector,
    removeWallet,
    removeAccount,
    createHDWallet,
    createHWHiddenWallet,
    createHWWalletWithHidden,
    createQrWallet,
    createTonImportedWallet,
    autoSelectNextAccount,
    autoSelectNetworkOfOthersWalletAccount,
    syncFromScene,
    confirmAccountSelect,
    syncHomeAndSwapSelectedAccount,
    syncLocalDeriveTypeFromGlobal,
    reloadSwapToAccountFromHome,
  });
}
