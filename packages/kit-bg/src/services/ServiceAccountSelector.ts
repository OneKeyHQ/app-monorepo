/* eslint-disable @typescript-eslint/no-unused-vars */
import { cloneDeep } from 'lodash';

import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import accountSelectorUtils from '@onekeyhq/shared/src/utils/accountSelectorUtils';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

import { swapToAnotherAccountSwitchOnAtom } from '../states/jotai/atoms';
import { getVaultSettingsAccountDeriveInfo } from '../vaults/settings';

import ServiceBase from './ServiceBase';

import type { IDBIndexedAccount, IDBWallet } from '../dbs/local/types';
import type {
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
          swapMap[num] = swapDataMerged;
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

      if (indexedAccountId) {
        try {
          indexedAccount = await serviceAccount.getIndexedAccount({
            id: indexedAccountId,
          });
        } catch (e) {
          console.error(e);
        }
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

      if (indexedAccountId || othersWalletAccountId) {
        try {
          const r = await serviceAccount.getAccountOfWallet({
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
          deriveInfo = await getVaultSettingsAccountDeriveInfo({
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
    const activeAccount: IAccountSelectorActiveAccountInfo = {
      account,
      indexedAccount,
      accountName: account?.name || indexedAccount?.name || '',
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
      focusedWallet: isOthersWallet ? '$$others' : activeAccount.wallet?.id,
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
}

export default ServiceAccountSelector;
