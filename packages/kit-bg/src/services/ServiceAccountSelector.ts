/* eslint-disable @typescript-eslint/no-unused-vars */
import { cloneDeep } from 'lodash';

import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
} from '@onekeyhq/shared/src/consts/dbConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import accountSelectorUtils from '@onekeyhq/shared/src/utils/accountSelectorUtils';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

import { settingsAtom } from '../states/jotai/atoms';
import { getVaultSettings } from '../vaults/settings';

import ServiceBase from './ServiceBase';

import type {
  IDBAccount,
  IDBDevice,
  IDBIndexedAccount,
  IDBWallet,
} from '../dbs/local/types';
import type {
  IAccountSelectorAccountsListSectionData,
  IAccountSelectorFocusedWallet,
  IAccountSelectorSelectedAccount,
  IAccountSelectorSelectedAccountsMap,
} from '../dbs/simple/entity/SimpleDbEntityAccountSelector';
import type {
  IAccountDeriveInfo,
  IAccountDeriveInfoItems,
  IAccountDeriveTypes,
  IVaultSettings,
} from '../vaults/types';

@backgroundClass()
class ServiceAccountSelector extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  @backgroundMethod()
  async shouldSyncWithHome({
    sceneName,
    sceneUrl,
    num,
  }: {
    sceneName: EAccountSelectorSceneName;
    sceneUrl?: string;
    num: number;
  }) {
    const syncScenes: {
      sceneName: EAccountSelectorSceneName;
      num: number;
    }[] = [
      {
        sceneName: EAccountSelectorSceneName.home,
        num: 0,
      },
      {
        sceneName: EAccountSelectorSceneName.swap,
        num: 0,
      },
    ];

    const { swapToAnotherAccountSwitchOn } = await settingsAtom.get();
    if (!swapToAnotherAccountSwitchOn) {
      syncScenes.push({
        sceneName: EAccountSelectorSceneName.swap,
        num: 1,
      });
    }

    return syncScenes.some((item) =>
      accountSelectorUtils.isEqualAccountSelectorScene({
        scene1: item,
        scene2: { sceneName, sceneUrl, num },
      }),
    );
  }

  @backgroundMethod()
  public async mergeHomeDataToSwapMap({
    swapMap,
  }: {
    swapMap: IAccountSelectorSelectedAccountsMap | undefined;
  }) {
    const homeData: IAccountSelectorSelectedAccount | undefined =
      await this.backgroundApi.simpleDb.accountSelector.getSelectedAccount({
        sceneName: EAccountSelectorSceneName.home,
        num: 0,
      });
    if (homeData) {
      // eslint-disable-next-line no-param-reassign
      swapMap = cloneDeep(swapMap || {});

      const updateSwapMap = (num: number) => {
        if (!swapMap) {
          return;
        }
        const swapDataMerged = accountSelectorUtils.buildMergedSelectedAccount({
          data: swapMap[num],
          mergedByData: homeData,
        });
        if (swapDataMerged) {
          const usedNetworkId =
            // swapDataMerged.networkId ??
            // swapMap[num]?.networkId ??
            homeData?.networkId;
          swapMap[num] = swapDataMerged;
          if (swapMap && swapMap[num]) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            swapMap[num]!.networkId = usedNetworkId;
          }
        }
      };

      updateSwapMap(0);

      const { swapToAnotherAccountSwitchOn } = await settingsAtom.get();
      if (!swapToAnotherAccountSwitchOn) {
        updateSwapMap(1);
      }
    }
    return swapMap;
  }

  @backgroundMethod()
  async buildActiveAccountInfoFromSelectedAccount({
    selectedAccount,
    nonce,
  }: {
    selectedAccount: IAccountSelectorSelectedAccount;
    nonce?: number;
  }): Promise<{
    selectedAccount: IAccountSelectorSelectedAccount;
    activeAccount: IAccountSelectorActiveAccountInfo;
    nonce?: number;
  }> {
    const {
      othersWalletAccountId,
      indexedAccountId,
      deriveType,
      networkId,
      walletId,
    } = selectedAccount;

    defaultLogger.accountSelector.perf.buildActiveAccountInfoFromSelectedAccount(
      {
        selectedAccount,
      },
    );

    let account: INetworkAccount | undefined;
    // NetworkAccount is undefined if others wallet account not compatible with network
    // in this case, we should use dbAccount
    let dbAccount: IDBAccount | undefined;
    let wallet: IDBWallet | undefined;
    let device: IDBDevice | undefined;
    let network: IServerNetwork | undefined;
    let vaultSettings: IVaultSettings | undefined;
    let indexedAccount: IDBIndexedAccount | undefined;
    let deriveInfo: IAccountDeriveInfo | undefined;
    const { serviceAccount, serviceNetwork } = this.backgroundApi;

    if (walletId) {
      try {
        wallet = await serviceAccount.getWallet({
          walletId,
        });
      } catch (e) {
        console.error(e);
      }
    }

    if (indexedAccountId && wallet) {
      try {
        indexedAccount = await serviceAccount.getIndexedAccount({
          id: indexedAccountId,
        });
      } catch (e) {
        console.error(e);
      }
    }

    let dbAccountId = othersWalletAccountId || '';
    if (!dbAccountId && indexedAccountId && networkId && deriveType) {
      try {
        dbAccountId =
          await this.backgroundApi.serviceAccount.getDbAccountIdFromIndexedAccountId(
            {
              indexedAccountId,
              networkId,
              deriveType,
            },
          );
      } catch (error) {
        //
      }
    }

    if (networkId) {
      try {
        network = await serviceNetwork.getNetwork({
          networkId,
        });
        try {
          if (network?.id && !networkUtils.isAllNetwork({ networkId })) {
            vaultSettings = await getVaultSettings({
              networkId: network?.id,
            });
          }
        } catch (error) {
          //
        }
      } catch (e) {
        console.error(e);
      }

      if ((indexedAccountId && wallet) || othersWalletAccountId) {
        try {
          const r = await serviceAccount.getNetworkAccount({
            indexedAccountId,
            accountId: othersWalletAccountId,
            deriveType,
            networkId,
          });
          account = r;
        } catch (e) {
          // account may not compatible with network
          console.error(e);
        }
      }

      if (deriveType) {
        try {
          deriveInfo =
            await this.backgroundApi.serviceNetwork.getDeriveInfoOfNetwork({
              networkId,
              deriveType,
            });
        } catch (error) {
          //
        }
      }
    }

    const isAllNetwork = Boolean(
      networkId && networkUtils.isAllNetwork({ networkId }),
    );

    if (dbAccountId && !isAllNetwork) {
      try {
        const r = await serviceAccount.getDBAccount({
          accountId: dbAccountId,
        });
        dbAccount = r;
      } catch (e) {
        console.error(e);
      }
    }

    if (wallet && (await serviceAccount.isTempWalletRemoved({ wallet }))) {
      wallet = undefined;
      account = undefined;
      indexedAccount = undefined;
    }

    const isOthersWallet =
      accountUtils.isOthersWallet({
        walletId: wallet?.id || '',
      }) || Boolean(account && !indexedAccountId);
    const isQrWallet = Boolean(
      wallet?.id &&
        accountUtils.isQrWallet({
          walletId: wallet?.id || '',
        }),
    );
    const isHwWallet = Boolean(
      wallet?.id &&
        accountUtils.isHwWallet({
          walletId: wallet?.id || '',
        }),
    );
    const universalAccountName = (() => {
      // hd account or others account
      if (account) {
        // localDB should replace account name from indexedAccount name if hd or hw
        return account.name;
      }
      // hd index account but account not create yet
      if (indexedAccount) {
        return indexedAccount.name;
      }
      // others account but not compatible with network, account is undefined, so use dbAccount
      if (dbAccount) {
        return dbAccount.name;
      }
      return '';
    })();

    if ((isHwWallet || isQrWallet) && wallet?.associatedDevice) {
      try {
        device = await serviceAccount.getDevice({
          dbDeviceId: wallet?.associatedDevice,
        });
      } catch (e) {
        //
      }
    }
    let allNetworkDbAccounts: IDBAccount[] | undefined;
    let canCreateAddress = false;
    if (isAllNetwork && networkId) {
      try {
        allNetworkDbAccounts =
          await this.backgroundApi.serviceAllNetwork.getAllNetworkDbAccounts({
            networkId,
            singleNetworkDeriveType: undefined,
            indexedAccountId,
            othersWalletAccountId,
          });
      } catch (error) {
        //
      }

      // build mocked networkAccount of all network
      if (!isOthersWallet && indexedAccountId) {
        const updateCanCreateAddressForAllNetwork = async () => {
          account = undefined;
          canCreateAddress = true;
        };
        if (allNetworkDbAccounts?.length) {
          try {
            account =
              await this.backgroundApi.serviceAccount.getMockedAllNetworkAccount(
                {
                  indexedAccountId,
                },
              );
            canCreateAddress = false;
          } catch (error) {
            await updateCanCreateAddressForAllNetwork();
          }
        } else {
          await updateCanCreateAddressForAllNetwork();
        }
      }
    } else {
      // single network
      canCreateAddress = !isOthersWallet && !account?.address;
      if (isQrWallet && vaultSettings) {
        canCreateAddress = !!vaultSettings.qrAccountEnabled;
      }
    }

    const isNetworkNotMatched = (() => {
      if (!account && !indexedAccount) {
        if (isOthersWallet) {
          return true;
        }
      }
      if (!account && indexedAccount) {
        if (isQrWallet && !canCreateAddress) {
          return true;
        }
      }
      return false;
    })();
    let deriveInfoItems: IAccountDeriveInfoItems[] = [];
    try {
      deriveInfoItems = await serviceNetwork.getDeriveInfoItemsOfNetwork({
        networkId,
      });
    } catch (error) {
      //
    }
    const activeAccount: IAccountSelectorActiveAccountInfo = {
      account,
      dbAccount,
      allNetworkDbAccounts,
      indexedAccount,
      accountName: universalAccountName,
      wallet,
      device,
      network,
      vaultSettings,
      deriveType,
      deriveInfo,
      deriveInfoItems,
      ready: true,
      isOthersWallet,
      canCreateAddress,
      isNetworkNotMatched,
    };

    // const activeAccount0: IAccountSelectorActiveAccountInfo = {
    //   account: undefined,
    //   indexedAccount: undefined,
    //   dbAccount: undefined,
    //   network: undefined,
    //   wallet: undefined,
    //   device: undefined,
    //   deriveType: 'default',
    //   deriveInfo: undefined,
    //   deriveInfoItems: [],
    //   ready: false,
    //   accountName: '',
    // };

    const selectedAccountFixed: IAccountSelectorSelectedAccount = {
      othersWalletAccountId: isOthersWallet
        ? activeAccount?.account?.id
        : undefined,
      indexedAccountId: activeAccount?.indexedAccount?.id,
      deriveType: activeAccount?.deriveType,
      networkId: activeAccount?.network?.id,
      walletId: activeAccount?.wallet?.id,
      focusedWallet: activeAccount?.wallet?.id,
    };

    // throw new Error('Method not implemented.');
    return { activeAccount, selectedAccount: selectedAccountFixed, nonce };
  }

  @backgroundMethod()
  async shouldUseGlobalDeriveType({
    sceneName,
  }: {
    sceneName: EAccountSelectorSceneName;
  }) {
    return accountSelectorUtils.isSceneUseGlobalDeriveType({ sceneName });
  }

  @backgroundMethod()
  async getGlobalDeriveType({
    selectedAccount,
    sceneName,
  }: {
    selectedAccount: IAccountSelectorSelectedAccount;
    sceneName: EAccountSelectorSceneName | undefined;
  }): Promise<IAccountDeriveTypes | undefined> {
    if (sceneName) {
      if (!(await this.shouldUseGlobalDeriveType({ sceneName }))) {
        return undefined;
      }
    }
    const { networkId, walletId } = selectedAccount;
    if (!networkId) {
      return undefined;
    }
    if (walletId && accountUtils.isOthersWallet({ walletId })) {
      return undefined;
    }
    return this.backgroundApi.serviceNetwork.getGlobalDeriveTypeOfNetwork({
      networkId,
    });
  }

  @backgroundMethod()
  async saveGlobalDeriveType({
    selectedAccount,
    sceneName,
    sceneUrl,
    num,
    eventEmitDisabled,
  }: {
    selectedAccount: IAccountSelectorSelectedAccount;
    sceneName: EAccountSelectorSceneName;
    sceneUrl?: string;
    num: number;
    eventEmitDisabled?: boolean;
  }): Promise<void> {
    if (!(await this.shouldUseGlobalDeriveType({ sceneName }))) {
      return;
    }
    const { serviceNetwork } = this.backgroundApi;
    // TODO add whitelist
    const { networkId, deriveType, walletId } = selectedAccount;

    // skip others wallet global derive type save
    if (
      walletId &&
      accountUtils.isOthersWallet({
        walletId,
      })
    ) {
      return;
    }
    if (networkId && deriveType) {
      const currentGlobalDeriveType = await this.getGlobalDeriveType({
        selectedAccount,
        sceneName,
      });
      if (deriveType && currentGlobalDeriveType !== deriveType) {
        await this.backgroundApi.serviceNetwork.saveGlobalDeriveTypeForNetwork({
          networkId,
          deriveType,
          eventEmitDisabled,
        });
      } else {
        console.log('syncDeriveType currentGlobalDeriveType !== deriveType', {
          currentGlobalDeriveType,
          deriveType,
        });
      }
    }
  }

  @backgroundMethod()
  async fixDeriveTypesForInitAccountSelectorMap({
    selectedAccountsMapInDB,
    sceneName,
    sceneUrl,
  }: {
    selectedAccountsMapInDB: IAccountSelectorSelectedAccountsMap;
    sceneName: EAccountSelectorSceneName;
    sceneUrl?: string;
  }) {
    await Promise.all(
      Object.entries(selectedAccountsMapInDB).map(
        async (item: [string, IAccountSelectorSelectedAccount | undefined]) => {
          // TODO add whitelist
          const [num, v] = item;
          if (v && v.networkId) {
            const globalDeriveType = await this.getGlobalDeriveType({
              selectedAccount: v,
              sceneName,
            });
            const deriveType: IAccountDeriveTypes =
              globalDeriveType || v.deriveType || 'default';
            v.deriveType = deriveType;

            if (
              v.walletId &&
              accountUtils.isOthersWallet({ walletId: v.walletId })
            ) {
              v.deriveType = 'default';
            }
          }
        },
      ),
    );
    return selectedAccountsMapInDB;
  }

  @backgroundMethod()
  async getAccountSelectorAccountsListSectionData({
    focusedWallet,
    othersNetworkId,
    linkedNetworkId,
    deriveType,
  }: {
    focusedWallet: IAccountSelectorFocusedWallet;
    othersNetworkId?: string;
    linkedNetworkId?: string;
    deriveType: IAccountDeriveTypes;
  }): Promise<Array<IAccountSelectorAccountsListSectionData>> {
    // await timerUtils.wait(1000);
    const { serviceAccount } = this.backgroundApi;
    if (!focusedWallet) {
      return [];
    }
    const buildAccountsData = ({
      accounts,
      walletId,
      title,
    }: {
      accounts: IDBAccount[] | IDBIndexedAccount[];
      walletId: string;
      title?: string;
    }): IAccountSelectorAccountsListSectionData => {
      if (walletId === WALLET_TYPE_WATCHING) {
        return {
          title:
            title ??
            appLocale.intl.formatMessage({
              id: ETranslations.global_watched,
            }),
          data: accounts,
          firstAccount: accounts[0],
          walletId,
          emptyText: appLocale.intl.formatMessage({
            id: ETranslations.no_watched_account_message,
          }),
        };
      }
      if (walletId === WALLET_TYPE_IMPORTED) {
        return {
          title:
            title ??
            appLocale.intl.formatMessage({
              id: ETranslations.global_private_key,
            }),
          data: accounts,
          firstAccount: accounts[0],
          walletId,
          emptyText: appLocale.intl.formatMessage({
            id: ETranslations.no_private_key_account_message,
          }),
        };
      }
      if (walletId === WALLET_TYPE_EXTERNAL) {
        return {
          title:
            title ??
            appLocale.intl.formatMessage({
              id: ETranslations.global_connected_account,
            }),
          data: accounts,
          firstAccount: accounts[0],
          walletId,
          emptyText: appLocale.intl.formatMessage({
            id: ETranslations.no_external_wallet_message,
          }),
        };
      }
      // hw and hd accounts
      return {
        title: title ?? '',
        data: accounts,
        firstAccount: accounts[0],
        walletId,
        emptyText: appLocale.intl.formatMessage({
          id: ETranslations.no_account,
        }),
      };
    };
    if (focusedWallet === '$$others') {
      const { accounts: accountsWatching } =
        await serviceAccount.getSingletonAccountsOfWallet({
          walletId: WALLET_TYPE_WATCHING,
          activeNetworkId: othersNetworkId,
        });
      const { accounts: accountsImported } =
        await serviceAccount.getSingletonAccountsOfWallet({
          walletId: WALLET_TYPE_IMPORTED,
          activeNetworkId: othersNetworkId,
        });
      const { accounts: accountsExternal } =
        await serviceAccount.getSingletonAccountsOfWallet({
          walletId: WALLET_TYPE_EXTERNAL,
          activeNetworkId: othersNetworkId,
        });

      return [
        buildAccountsData({
          accounts: accountsImported,
          walletId: WALLET_TYPE_IMPORTED,
        }),
        buildAccountsData({
          accounts: accountsWatching,
          walletId: WALLET_TYPE_WATCHING,
        }),
        buildAccountsData({
          accounts: accountsExternal,
          walletId: WALLET_TYPE_EXTERNAL,
        }),
      ];
    }
    const walletId = focusedWallet;

    // make sure wallet exists
    try {
      await serviceAccount.getWallet({ walletId });
    } catch (error) {
      // wallet may be removed
      console.error(error);
      return [];
    }

    // others singleton wallet
    if (accountUtils.isOthersWallet({ walletId })) {
      let { accounts } = await serviceAccount.getSingletonAccountsOfWallet({
        walletId: walletId as any,
        activeNetworkId: othersNetworkId,
      });
      if (linkedNetworkId) {
        accounts = accounts
          .filter((account) => {
            try {
              return accountUtils.isAccountCompatibleWithNetwork({
                account,
                networkId: linkedNetworkId,
              });
            } catch (error) {
              return false;
            }
          })
          .filter(Boolean);
      }
      return [
        buildAccountsData({
          accounts,
          walletId,
          title: '',
        }),
      ];
    }

    // hd hw accounts
    const { accounts } = await serviceAccount.getIndexedAccountsOfWallet({
      walletId,
    });
    if (linkedNetworkId) {
      await Promise.all(
        accounts.map(async (indexedAccount: IDBIndexedAccount) => {
          try {
            const realAccount = await serviceAccount.getNetworkAccount({
              accountId: undefined,
              indexedAccountId: indexedAccount.id,
              deriveType,
              networkId: linkedNetworkId,
            });
            indexedAccount.associateAccount = realAccount;
          } catch (e) {
            //
          }
        }),
      );
    }

    return [
      buildAccountsData({
        accounts,
        // accounts: [],
        walletId,
        title: '',
      }),
    ];
  }

  @backgroundMethod()
  async getFocusedWalletInfo({
    focusedWallet,
  }: {
    focusedWallet: IAccountSelectorFocusedWallet;
  }) {
    if (!focusedWallet) {
      return undefined;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const isHd = accountUtils.isHdWallet({
      walletId: focusedWallet,
    });
    const isHw = accountUtils.isHwWallet({
      walletId: focusedWallet,
    });
    try {
      const wallet = await this.backgroundApi.serviceAccount.getWallet({
        walletId: focusedWallet,
      });

      let device: IDBDevice | undefined;
      if (isHw) {
        device = await this.backgroundApi.serviceAccount.getWalletDeviceSafe({
          walletId: focusedWallet,
        });
      }

      return {
        wallet,
        device,
      };
    } catch (error) {
      // wallet may be removed
      console.error(error);
      return undefined;
    }
  }

  @backgroundMethod()
  async buildAccountSelectorAccountsListData({
    focusedWallet,
    othersNetworkId,
    linkedNetworkId,
    deriveType,
  }: {
    focusedWallet: IAccountSelectorFocusedWallet;
    othersNetworkId?: string;
    linkedNetworkId?: string;
    deriveType: IAccountDeriveTypes;
  }) {
    defaultLogger.accountSelector.perf.buildAccountSelectorAccountsListData({
      focusedWallet,
      othersNetworkId,
      linkedNetworkId,
      deriveType,
    });

    const sectionData = await this.getAccountSelectorAccountsListSectionData({
      focusedWallet,
      othersNetworkId,
      linkedNetworkId,
      deriveType,
    });

    let focusedWalletInfo:
      | {
          wallet: IDBWallet;
          device: IDBDevice | undefined;
        }
      | undefined;
    try {
      focusedWalletInfo = await this.getFocusedWalletInfo({
        focusedWallet,
      });
    } catch (error) {
      //
    }

    let accountsCount = 0;
    let accountsValue: {
      accountId: string;
      value: Record<string, string> | string | undefined;
      currency: string | undefined;
    }[] = [];

    try {
      const accountsForValuesQuery: {
        accountId: string;
      }[] = [];

      sectionData?.forEach?.((s) => {
        s?.data?.forEach?.((account) => {
          accountsCount += 1;
          accountsForValuesQuery.push({
            accountId: account.id,
          });
        });
      });
      if (
        accountUtils.isOthersWallet({
          walletId: focusedWallet ?? '',
        })
      ) {
        accountsValue =
          await this.backgroundApi.serviceAccountProfile.getAccountsValue({
            accounts: accountsForValuesQuery,
          });
      } else {
        accountsValue =
          await this.backgroundApi.serviceAccountProfile.getAllNetworkAccountsValue(
            {
              accounts: accountsForValuesQuery,
            },
          );
      }
    } catch (error) {
      //
    }

    return {
      sectionData,
      focusedWalletInfo,
      accountsCount,
      accountsValue,
    };
  }
}

export default ServiceAccountSelector;
