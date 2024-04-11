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
import accountSelectorUtils from '@onekeyhq/shared/src/utils/accountSelectorUtils';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

import { swapToAnotherAccountSwitchOnAtom } from '../states/jotai/atoms';

import ServiceBase from './ServiceBase';

import type {
  IDBAccount,
  IDBIndexedAccount,
  IDBWallet,
} from '../dbs/local/types';
import type {
  IAccountSelectorAccountsListSectionData,
  IAccountSelectorFocusedWallet,
  IAccountSelectorSelectedAccount,
  IAccountSelectorSelectedAccountsMap,
} from '../dbs/simple/entity/SimpleDbEntityAccountSelector';
import type { IAccountDeriveInfo, IAccountDeriveTypes } from '../vaults/types';

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

    const swapToAnotherAccountSwitchOn =
      await swapToAnotherAccountSwitchOnAtom.get();
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
            swapDataMerged.networkId ??
            swapMap[num]?.networkId ??
            homeData?.networkId;
          swapMap[num] = swapDataMerged;
          if (swapMap && swapMap[num]) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            swapMap[num]!.networkId = usedNetworkId;
          }
        }
      };

      updateSwapMap(0);

      const swapToAnotherAccountSwitchOn =
        await swapToAnotherAccountSwitchOnAtom.get();
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

    let account: INetworkAccount | undefined;
    // NetworkAccount is undefined if others wallet account not compatible with network
    // in this case, we should use dbAccount
    let dbAccount: IDBAccount | undefined;
    let wallet: IDBWallet | undefined;
    let network: IServerNetwork | undefined;
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

    if (othersWalletAccountId) {
      try {
        const r = await serviceAccount.getDBAccount({
          accountId: othersWalletAccountId,
        });
        dbAccount = r;
      } catch (e) {
        console.error(e);
      }
    }

    if (networkId) {
      try {
        network = await serviceNetwork.getNetwork({
          networkId,
        });
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

    if (wallet && (await serviceAccount.isTempWalletRemoved({ wallet }))) {
      wallet = undefined;
      account = undefined;
      indexedAccount = undefined;
    }

    const isOthersWallet = Boolean(account && !indexedAccountId);
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

    const activeAccount: IAccountSelectorActiveAccountInfo = {
      account,
      dbAccount,
      indexedAccount,
      accountName: universalAccountName,
      wallet,
      network,
      deriveType,
      deriveInfo,
      deriveInfoItems: await serviceNetwork.getDeriveInfoItemsOfNetwork({
        networkId,
      }),
      ready: true,
      isOthersWallet,
    };
    const selectedAccountFixed: IAccountSelectorSelectedAccount = {
      othersWalletAccountId: isOthersWallet
        ? activeAccount?.account?.id
        : undefined,
      indexedAccountId: activeAccount.indexedAccount?.id,
      deriveType: activeAccount.deriveType,
      networkId: activeAccount.network?.id,
      walletId: activeAccount.wallet?.id,
      focusedWallet: activeAccount.wallet?.id,
    };
    return { activeAccount, selectedAccount: selectedAccountFixed, nonce };
  }

  @backgroundMethod()
  async getGlobalDeriveType({
    selectedAccount,
  }: {
    selectedAccount: IAccountSelectorSelectedAccount;
  }) {
    const { networkId, walletId } = selectedAccount;
    if (!networkId) {
      return undefined;
    }
    if (walletId && accountUtils.isOthersWallet({ walletId })) {
      return undefined;
    }
    const currentGlobalDeriveType =
      await this.backgroundApi.simpleDb.accountSelector.getGlobalDeriveType({
        networkId,
      });

    return currentGlobalDeriveType;
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
  }) {
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
      });
      if (currentGlobalDeriveType !== deriveType) {
        const deriveInfoItems =
          await serviceNetwork.getDeriveInfoItemsOfNetwork({
            networkId,
          });
        if (deriveInfoItems.find((item) => item.value === deriveType)) {
          await this.backgroundApi.simpleDb.accountSelector.saveGlobalDeriveType(
            {
              eventEmitDisabled,
              networkId,
              deriveType,
            },
          );
        }
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

  // TODO move to serviceAccountSelector
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
          title: title ?? 'Watchlist',
          data: accounts,
          walletId,
          emptyText:
            'Your watchlist is empty. Import a address to start monitoring.',
        };
      }
      if (walletId === WALLET_TYPE_IMPORTED) {
        return {
          title: title ?? 'Private Key',
          data: accounts,
          walletId,
          emptyText:
            'No private key accounts. Add a new account to manage your assets.',
        };
      }
      if (walletId === WALLET_TYPE_EXTERNAL) {
        return {
          title: title ?? 'External account',
          data: accounts,
          walletId,
          emptyText:
            'No external wallets connected. Link a third-party wallet to view here.',
        };
      }
      // hw and hd accounts
      return {
        title: title ?? '',
        data: accounts,
        walletId,
        emptyText: 'No account',
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
    try {
      await serviceAccount.getWallet({ walletId });
    } catch (error) {
      // wallet may be removed
      console.error(error);
      return [];
    }

    // others singleton wallet
    if (accountUtils.isOthersWallet({ walletId })) {
      const { accounts } = await serviceAccount.getSingletonAccountsOfWallet({
        walletId: walletId as any,
        activeNetworkId: othersNetworkId,
      });
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
        walletId,
        title: '',
      }),
    ];
  }
}

export default ServiceAccountSelector;
