/* eslint-disable @typescript-eslint/no-unused-vars */
import { cloneDeep } from 'lodash';

import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  WALLET_TYPE_EXTERNAL,
  WALLET_TYPE_IMPORTED,
  WALLET_TYPE_WATCHING,
} from '@onekeyhq/shared/src/consts/dbConsts';
import { PERPS_NETWORK_ID } from '@onekeyhq/shared/src/consts/perp';
import { PERPS_HL_PORTFOLIO_STALE_SERVE_MAX_AGE_MS } from '@onekeyhq/shared/src/consts/perpCache';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import accountSelectorUtils from '@onekeyhq/shared/src/utils/accountSelectorUtils';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import cacheUtils from '@onekeyhq/shared/src/utils/cacheUtils';
import { buildHomeWalletTabSupport } from '@onekeyhq/shared/src/utils/homeWalletTabSupportUtils';
import { isHyperliquidPortfolioSnapshotFresh } from '@onekeyhq/shared/src/utils/hyperliquidPortfolioUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

import {
  perpsCommonConfigPersistAtom,
  settingsAtom,
} from '../states/jotai/atoms';
import { getVaultSettings } from '../vaults/settings';

import ServiceBase from './ServiceBase';
import {
  isAccountSelectorHomeSyncSourceScene,
  isAccountSelectorHomeSyncTargetScene,
  shouldSyncAccountSelectorHomeAndSwapScenes,
} from './utils/accountSelectorHomeSyncUtils';
import { buildAccountsPerpsNetWorthUsd } from './utils/accountSelectorPerpsWorthUtils';

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
    const { swapToAnotherAccountSwitchOn } = await settingsAtom.get();
    return isAccountSelectorHomeSyncTargetScene({
      scene: { sceneName, sceneUrl, num },
      swapToAnotherAccountSwitchOn,
    });
  }

  @backgroundMethod()
  async shouldSyncWithHomeSource(params: {
    sceneName: EAccountSelectorSceneName;
    sceneUrl?: string;
    num: number;
  }) {
    return isAccountSelectorHomeSyncSourceScene(params);
  }

  @backgroundMethod()
  async shouldSyncHomeAndSwapSelectedAccount({
    sourceScene,
    targetScene,
  }: {
    sourceScene: {
      sceneName: EAccountSelectorSceneName;
      sceneUrl?: string;
      num: number;
    };
    targetScene: {
      sceneName: EAccountSelectorSceneName;
      sceneUrl?: string;
      num: number;
    };
  }) {
    const { swapToAnotherAccountSwitchOn } = await settingsAtom.get();
    return shouldSyncAccountSelectorHomeAndSwapScenes({
      sourceScene,
      targetScene,
      swapToAnotherAccountSwitchOn,
    });
  }

  @backgroundMethod()
  public async fixOthersWalletAccountNetworkPair({
    selectedAccount,
    source,
  }: {
    selectedAccount: IAccountSelectorSelectedAccount;
    source?: string;
  }): Promise<IAccountSelectorSelectedAccount> {
    const { walletId, networkId, othersWalletAccountId } = selectedAccount;
    if (
      !walletId ||
      !networkId ||
      !othersWalletAccountId ||
      !accountUtils.isOthersWallet({ walletId }) ||
      networkUtils.isAllNetwork({ networkId })
    ) {
      return selectedAccount;
    }

    let dbAccount: IDBAccount | undefined;
    try {
      dbAccount = await this.backgroundApi.serviceAccount.getDBAccount({
        accountId: othersWalletAccountId,
      });
    } catch {
      return selectedAccount;
    }

    if (!dbAccount) {
      return selectedAccount;
    }

    try {
      if (
        accountUtils.isAccountCompatibleWithNetwork({
          account: dbAccount,
          networkId,
        })
      ) {
        return selectedAccount;
      }
    } catch {
      // Fall through to compatible-network resolution below.
    }

    let fixedNetworkId: string | undefined;
    try {
      fixedNetworkId = accountUtils.getAccountCompatibleNetwork({
        account: dbAccount,
        networkId,
      });
    } catch {
      return selectedAccount;
    }

    if (!fixedNetworkId || fixedNetworkId === networkId) {
      return selectedAccount;
    }

    defaultLogger.accountSelector.listData.fixOthersWalletAccountNetworkPair({
      source,
      walletId,
      networkId,
      fixedNetworkId,
      accountImpl: dbAccount.impl,
      accountCreateAtNetwork: dbAccount.createAtNetwork,
      accountNetworksCount: dbAccount.networks?.length,
    });

    return {
      ...selectedAccount,
      networkId: fixedNetworkId,
      deriveType: selectedAccount.deriveType || 'default',
    };
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
      const fixedHomeData = await this.fixOthersWalletAccountNetworkPair({
        selectedAccount: homeData,
        source: 'mergeHomeDataToSwapMap:home',
      });
      // eslint-disable-next-line no-param-reassign
      swapMap = cloneDeep(swapMap || {});

      const updateSwapMap = async (num: number) => {
        if (!swapMap) {
          return;
        }
        const swapDataMerged = accountSelectorUtils.buildMergedSelectedAccount({
          data: swapMap[num],
          mergedByData: fixedHomeData,
        });
        if (swapDataMerged) {
          const usedNetworkId =
            // swapDataMerged.networkId ??
            // swapMap[num]?.networkId ??
            fixedHomeData?.networkId;
          const fixedSwapDataMerged =
            await this.fixOthersWalletAccountNetworkPair({
              selectedAccount: {
                ...swapDataMerged,
                networkId: usedNetworkId,
              },
              source: `mergeHomeDataToSwapMap:${num}`,
            });
          swapMap[num] = fixedSwapDataMerged;
        }
      };

      await updateSwapMap(0);

      const { swapToAnotherAccountSwitchOn } = await settingsAtom.get();
      if (!swapToAnotherAccountSwitchOn) {
        await updateSwapMap(1);
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
    const { othersWalletAccountId, indexedAccountId, networkId, walletId } =
      selectedAccount;
    const deriveType = selectedAccount.deriveType;

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

      const canQueryIndexedNetworkAccount = Boolean(
        deriveType && indexedAccountId && wallet,
      );
      const canQueryOthersNetworkAccount = Boolean(othersWalletAccountId);
      if (canQueryIndexedNetworkAccount || canQueryOthersNetworkAccount) {
        try {
          const r = await serviceAccount.getNetworkAccount({
            indexedAccountId,
            accountId: othersWalletAccountId,
            deriveType: deriveType || 'default',
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

    if (dbAccountId && (!isAllNetwork || othersWalletAccountId)) {
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
    // Mocked/deprecated wallets are "zombie" records still in DB but no
    // longer user-facing (e.g. HW wallet removed via isRemoveToMocked).
    // Creating addresses on them silently fails, so gate every canCreate
    // path (OK-51091). `hasNoUsableWallet` in accountUtils gives the same
    // guarantee for the UI surface; this is defense-in-depth for any code
    // path that reads canCreateAddress directly.
    const isWalletUnusable = accountUtils.isWalletDeprecatedOrMocked(wallet);
    let canCreateAddress = false;
    if (isAllNetwork && networkId) {
      // build mocked networkAccount of all network
      if (!isOthersWallet && indexedAccountId && !isWalletUnusable) {
        try {
          account =
            await this.backgroundApi.serviceAccount.getMockedAllNetworkAccount({
              indexedAccountId,
            });
          canCreateAddress = true;
        } catch (error) {
          account = undefined;
          canCreateAddress = true;
        }
      } else if (
        !isOthersWallet &&
        wallet &&
        !isWalletUnusable &&
        !indexedAccountId
      ) {
        // When all accounts are deleted, allow creating the first account
        // for HD wallets, HW wallets, and QR wallets.
        const isHdOrHwOrQrWallet =
          accountUtils.isHdWallet({ walletId: wallet.id }) ||
          accountUtils.isHwWallet({ walletId: wallet.id }) ||
          accountUtils.isQrWallet({ walletId: wallet.id });
        if (isHdOrHwOrQrWallet) {
          canCreateAddress = true;
        }
      }
    } else {
      // single network
      canCreateAddress =
        !isOthersWallet && !isWalletUnusable && !account?.address;
      if (isQrWallet && vaultSettings) {
        canCreateAddress =
          !isWalletUnusable && !!vaultSettings.qrAccountEnabled;
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
        ? activeAccount?.account?.id || activeAccount?.dbAccount?.id
        : undefined,
      indexedAccountId: activeAccount?.indexedAccount?.id,
      deriveType: activeAccount?.deriveType,
      networkId: activeAccount?.network?.id,
      walletId: activeAccount?.wallet?.id,
      focusedWallet: activeAccount?.wallet?.id,
    };

    // throw new OneKeyLocalError('Method not implemented.');
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
    if (
      !accountSelectorUtils.isSceneAutoSaveToGlobalDeriveType({
        sceneName,
      })
    ) {
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
        // console.log('syncDeriveType currentGlobalDeriveType !== deriveType', {
        //   currentGlobalDeriveType,
        //   deriveType,
        // });
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

            defaultLogger.accountSelector.listData.fixDeriveTypesForInitAccountSelectorMap(
              {
                selectedAccount: v,
                globalDeriveType,
                fixedDeriveType: deriveType,
              },
            );

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
    keepAllOtherAccounts,
  }: {
    focusedWallet: IAccountSelectorFocusedWallet;
    othersNetworkId?: string;
    linkedNetworkId?: string;
    deriveType: IAccountDeriveTypes;
    keepAllOtherAccounts?: boolean;
  }): Promise<Array<IAccountSelectorAccountsListSectionData>> {
    // await timerUtils.wait(1000);
    const { serviceAccount } = this.backgroundApi;
    if (!focusedWallet) {
      defaultLogger.accountSelector.listData.focusedWalletMissing({
        focusedWallet,
      });
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
      defaultLogger.accountSelector.listData.buildAccountsData({
        accountsLength: accounts.length,
        walletId,
        title,
      });

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
      if (linkedNetworkId && !keepAllOtherAccounts) {
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
    defaultLogger.accountSelector.listData.getIndexedAccountsOfWallet({
      accountsLength: accounts.length,
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
            indexedAccount.associateAccount = undefined;
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
    const isHwOrQr = accountUtils.isHwOrQrWallet({
      walletId: focusedWallet,
    });
    try {
      const wallet = await this.backgroundApi.serviceAccount.getWallet({
        walletId: focusedWallet,
      });

      let device: IDBDevice | undefined;
      if (isHwOrQr) {
        device = await this.backgroundApi.serviceAccount.getWalletDeviceSafe({
          dbWallet: wallet,
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
    selectedNetworkId,
    deriveType,
    keepAllOtherAccounts,
  }: {
    focusedWallet: IAccountSelectorFocusedWallet;
    othersNetworkId?: string;
    linkedNetworkId?: string;
    selectedNetworkId?: string;
    deriveType: IAccountDeriveTypes;
    keepAllOtherAccounts?: boolean;
  }) {
    defaultLogger.accountSelector.perf.buildAccountSelectorAccountsListData({
      focusedWallet,
      othersNetworkId,
      linkedNetworkId,
      deriveType,
    });

    defaultLogger.accountSelector.listData.buildAccountsListData({
      focusedWallet,
      othersNetworkId,
      linkedNetworkId,
      selectedNetworkId,
      deriveType,
      keepAllOtherAccounts,
    });

    const sectionData = await this.getAccountSelectorAccountsListSectionData({
      focusedWallet,
      othersNetworkId,
      linkedNetworkId,
      deriveType,
      keepAllOtherAccounts,
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

    let mergeDeriveAssetsEnabled = false;
    if (selectedNetworkId) {
      mergeDeriveAssetsEnabled =
        (
          await this.backgroundApi.serviceNetwork.getVaultSettings({
            networkId: selectedNetworkId,
          })
        )?.mergeDeriveAssetsEnabled ?? false;
    }

    const accountsForValuesQuery: {
      accountId: string;
      networkId: string;
      indexedAccountId?: string;
      accountAddress?: string;
      xpub?: string;
    }[] = [];

    try {
      sectionData?.forEach?.((s) => {
        s?.data?.forEach?.((account) => {
          accountsCount += 1;
          const accountAddress =
            (account as IDBAccount).address ||
            (account as IDBIndexedAccount).associateAccount?.address ||
            '';
          const xpub =
            ('xpub' in account &&
              ((account.xpubSegwit || account.xpub) ?? '')) ||
            ('associateAccount' in account &&
              account.associateAccount &&
              'xpub' in account.associateAccount &&
              ((account.associateAccount.xpubSegwit ||
                account.associateAccount.xpub) ??
                '')) ||
            '';
          accountsForValuesQuery.push({
            accountId: account.id,
            networkId:
              (account as IDBAccount).createAtNetwork ||
              selectedNetworkId ||
              '',
            indexedAccountId: accountUtils.buildIndexedAccountId({
              walletId: (account as IDBIndexedAccount).walletId ?? '',
              index: (account as IDBIndexedAccount).index,
            }),
            accountAddress,
            xpub,
          });
        });
      });
    } catch (error) {
      //
    }

    return {
      sectionData,
      focusedWalletInfo,
      accountsCount,
      mergeDeriveAssetsEnabled,
      accountsForValuesQuery,
    };
  }

  @backgroundMethod()
  async buildAccountAddressMap({
    focusedWallet,
    indexedAccountIds,
  }: {
    focusedWallet: IAccountSelectorFocusedWallet;
    indexedAccountIds: string[];
  }): Promise<Record<string, string[]> | undefined> {
    if (
      !accountUtils.isIndexedAccountWallet({ walletId: focusedWallet }) ||
      !indexedAccountIds.length
    ) {
      return undefined;
    }

    try {
      const relevantIds = new Set(indexedAccountIds);
      const { allDbAccounts } =
        await this.backgroundApi.serviceAccount.getAccountsInSameIndexedAccountId(
          { indexedAccountId: indexedAccountIds[0] },
        );
      const accountAddressMap: Record<string, string[]> = {};
      for (const dbAccount of allDbAccounts) {
        const key = dbAccount.indexedAccountId;
        if (key && relevantIds.has(key) && dbAccount.address) {
          const addr = dbAccount.address.toLowerCase();
          accountAddressMap[key] ??= [];
          if (!accountAddressMap[key].includes(addr)) {
            accountAddressMap[key].push(addr);
          }
        }
      }
      return accountAddressMap;
    } catch (error) {
      // silently fail — address search degrades to name-only
      return {};
    }
  }

  @backgroundMethod()
  async buildAccountSelectorAccountsValuesData({
    accounts,
    linkedNetworkId,
  }: {
    accounts: {
      accountId: string;
      networkId: string;
      indexedAccountId?: string;
      accountAddress?: string;
      xpub?: string;
    }[];
    linkedNetworkId?: string;
  }) {
    const accountsDeFiOverview =
      await this.backgroundApi.serviceDeFi.getAccountsLocalDeFiOverview({
        accounts,
      });
    // Compound-key shape consumed by `calculateAccountTotalValue`; the
    // per-address `getAllNetworkAccountsValue` would yield Record<networkId,
    // worth> and silently miss every compound-key lookup downstream. The
    // batched form folds N storage reads into one (the SimpleDb entity has
    // caching disabled, so the per-account form paid a fresh
    // deserialization per row — a 50-row selector batch turned into 50
    // reads).
    const accountsValue =
      await this.backgroundApi.serviceAccountProfile.getAllNetworkAccountsValueByAccountIdBatch(
        {
          accounts: accounts.map((a) => ({
            accountId: a.accountId,
            accountAddress: a.accountAddress,
            xpub: a.xpub,
          })),
        },
      );
    const accountsPerpsNetWorthUsd = await this._getAccountsPerpsNetWorthUsd({
      accounts,
      linkedNetworkId,
    });
    // Ride perps worth on the DeFi overview items so the UI atom plumbing
    // (loader → accountSelectorDeFiMapAtom → AccountValue) stays unchanged.
    const accountsDeFiOverviewWithPerps = accounts.map((_, index) => {
      const overviewItem = accountsDeFiOverview?.[index];
      const perpsNetWorthUsd = accountsPerpsNetWorthUsd[index];
      if (perpsNetWorthUsd === undefined) {
        return overviewItem;
      }
      return {
        ...overviewItem,
        overview: overviewItem?.overview ?? {},
        perpsNetWorthUsd,
      };
    });
    return {
      accountsValue,
      accountsDeFiOverview: accountsDeFiOverviewWithPerps,
    };
  }

  // Network-support inputs (perp config, DeFi-enabled map, all-networks
  // state) are constant across one selector open, but the values loader
  // calls the bg method once per 50-row batch — memoize briefly so a
  // multi-batch open computes them once. The perps derive type is
  // deliberately NOT part of this cache: it changes when the user switches
  // the EVM global derive type and is re-read per call in
  // _getPerpsSelectorGating.
  private _getPerpsSelectorGatingCached = cacheUtils.memoizee(
    async (
      linkedNetworkId: string | undefined,
    ): Promise<{
      isPerpsSupported: boolean;
      isGatingReady: boolean;
    }> => {
      const notSupported = {
        isPerpsSupported: false,
        isGatingReady: true,
      };
      const { perpConfigCommon, perpConfigLoaded } =
        await perpsCommonConfigPersistAtom.get();
      // Not-yet-loaded config counts as enabled, mirroring usePerpTabConfig.
      const perpDisabled = perpConfigLoaded
        ? perpConfigCommon?.disablePerp === true
        : false;
      if (perpDisabled) {
        return notSupported;
      }

      // On a cold start the local map is empty; await the shared sync
      // promise and gate on the final map, so every batch of one selector
      // open computes perps with the same verdict instead of the early
      // batches silently dropping it. The sync is deduped in ServiceDeFi
      // and its empty result is negative-cached, so this blocks at most
      // once per cold start.
      const { enabledNetworksMap: deFiEnabledNetworksMap, isReady } =
        await this.backgroundApi.serviceDeFi.getDeFiEnabledNetworksMapState();
      const isSingleLinkedNetwork =
        !!linkedNetworkId &&
        !networkUtils.isAllNetwork({ networkId: linkedNetworkId });
      let isPerpsSupported: boolean;
      if (isSingleLinkedNetwork) {
        isPerpsSupported = buildHomeWalletTabSupport({
          network: {
            id: linkedNetworkId,
            isAllNetworks: false,
            isTestnet: false,
          },
          deFiEnabledNetworksMap,
          perpDisabled,
        }).isPerpsSupported;
      } else {
        // No linked network (account manager) behaves like the All Networks
        // Home context.
        const [allNetworksState, { networks }] = await Promise.all([
          this.backgroundApi.serviceAllNetwork.getAllNetworksState(),
          this.backgroundApi.serviceNetwork.getAllNetworks({
            excludeTestNetwork: true,
            excludeAllNetworkItem: true,
          }),
        ]);
        isPerpsSupported = buildHomeWalletTabSupport({
          network: {
            id: getNetworkIdsMap().onekeyall,
            isAllNetworks: true,
            isTestnet: false,
          },
          allNetworks: networks,
          allNetworksState,
          deFiEnabledNetworksMap,
          perpDisabled,
        }).isPerpsSupported;
      }
      if (!isPerpsSupported) {
        return { ...notSupported, isGatingReady: isReady };
      }
      return { isPerpsSupported, isGatingReady: isReady };
    },
    {
      max: 4,
      maxAge: timerUtils.getTimeDurationMs({ seconds: 15 }),
      promise: true,
    },
  );

  // Cache only gating computed from a ready DeFi map: when the awaited sync
  // still ends with an empty map (sync failure or empty server list), that
  // provisional verdict must not be pinned for the whole memo TTL — dropping
  // it lets the next loader pass retry once the map actually syncs.
  private async _getPerpsSelectorGating(
    linkedNetworkId: string | undefined,
  ): Promise<{
    isPerpsSupported: boolean;
    perpsDeriveType: IAccountDeriveTypes | undefined;
    isGatingReady: boolean;
  }> {
    const gating = await this._getPerpsSelectorGatingCached(linkedNetworkId);
    if (!gating.isGatingReady) {
      void this._getPerpsSelectorGatingCached.delete(linkedNetworkId);
    }
    if (!gating.isPerpsSupported) {
      return { ...gating, perpsDeriveType: undefined };
    }
    // Re-read on every call, outside the memo TTL: switching the EVM global
    // derive type must not leave rows resolving perps snapshots for the
    // previous derive type's addresses.
    const perpsDeriveType =
      await this.backgroundApi.serviceNetwork.getGlobalDeriveTypeOfNetwork({
        networkId: PERPS_NETWORK_ID,
      });
    return { ...gating, perpsDeriveType };
  }

  // One getAllAccounts read + in-memory lookups instead of a per-row
  // getNetworkAccount (each a DB read + vault address build) on the
  // selector-open path.
  async _resolvePerpsAddressesByIndexedAccountIds({
    indexedAccountIds,
    perpsDeriveType,
    snapshotAddresses,
  }: {
    indexedAccountIds: string[];
    perpsDeriveType: IAccountDeriveTypes;
    snapshotAddresses?: string[];
  }): Promise<Record<string, string | undefined>> {
    const addressByIndexedAccountId: Record<string, string | undefined> = {};
    const { accounts: allDbAccounts } =
      await this.backgroundApi.serviceAccount.getAllAccounts();
    const { accounts: perpsAccounts } =
      await this.backgroundApi.serviceAccount.getAccountsByIndexedAccounts({
        indexedAccountIds,
        networkId: PERPS_NETWORK_ID,
        deriveType: perpsDeriveType,
        allDbAccounts,
        // Rows without a created perps-network account resolve to undefined
        // instead of throwing per row.
        skipDbQueryIfNotFoundFromAllDbAccounts: true,
      });
    for (const account of perpsAccounts) {
      if (account?.indexedAccountId) {
        addressByIndexedAccountId[account.indexedAccountId] =
          account.addressDetail?.normalizedAddress ||
          account.address ||
          undefined;
      }
    }
    // Home can materialize an indexed account's EVM address on demand,
    // writing the Address index (saveAccountAddresses) and the perps
    // snapshot cache WITHOUT creating an Account record; such rows miss the
    // Account-table pass above. Before treating them as unresolvable,
    // reverse-map the cached snapshot addresses through the Address index
    // so their Home-visible perps net worth also shows in the selector.
    const unresolvedIdSet = new Set(
      indexedAccountIds.filter((id) => !addressByIndexedAccountId[id]),
    );
    if (unresolvedIdSet.size && snapshotAddresses?.length) {
      // The Address index key (`${impl}--${normalizedAddress}`) omits the
      // derive type, so the same indexedAccount maps every derive path's
      // address to identical wallets values. Collect all candidates first and
      // adopt only an unambiguous single hit; with multiple hits the derive
      // path cannot be determined, so the row keeps no perps worth rather
      // than showing another derive path's balance.
      const candidateAddressesById = new Map<string, Set<string>>();
      for (const snapshotAddress of snapshotAddresses) {
        const addressRecord =
          await this.backgroundApi.serviceAccount.getAddressRecordByNetworkImpl(
            {
              networkId: PERPS_NETWORK_ID,
              normalizedAddress: snapshotAddress.toLowerCase(),
            },
          );
        for (const mappedAccountId of Object.values(
          addressRecord?.wallets ?? {},
        )) {
          if (unresolvedIdSet.has(mappedAccountId)) {
            let candidates = candidateAddressesById.get(mappedAccountId);
            if (!candidates) {
              candidates = new Set<string>();
              candidateAddressesById.set(mappedAccountId, candidates);
            }
            candidates.add(snapshotAddress);
          }
        }
      }
      for (const [mappedAccountId, candidates] of candidateAddressesById) {
        if (candidates.size === 1) {
          const [candidateAddress] = candidates;
          addressByIndexedAccountId[mappedAccountId] = candidateAddress;
        }
      }
    }
    return addressByIndexedAccountId;
  }

  // Hyperliquid perps net worth (USD) per selector row, read from the LOCAL
  // portfolio snapshot cache only — the same cache the Home overview polls
  // into — so selector totals can match Home's tokens + DeFi + perps sum.
  // Gating mirrors Home's isPerpsSupported (buildHomeWalletTabSupport): a
  // BTC-linked selector gets no perps, exactly like the BTC Home overview.
  async _getAccountsPerpsNetWorthUsd({
    accounts,
    linkedNetworkId,
  }: {
    accounts: {
      accountId: string;
      indexedAccountId?: string;
      accountAddress?: string;
    }[];
    linkedNetworkId?: string;
  }): Promise<(string | undefined)[]> {
    const emptyResult = accounts.map(() => undefined);
    try {
      const { isPerpsSupported, perpsDeriveType } =
        await this._getPerpsSelectorGating(linkedNetworkId);
      if (!isPerpsSupported || !perpsDeriveType) {
        return emptyResult;
      }

      const perpData = await this.backgroundApi.simpleDb.perp.getPerpData();
      const snapshotNetWorthUsdByAddress: Record<string, string> = {};
      const now = Date.now();
      for (const [address, snapshot] of Object.entries(
        perpData?.hyperliquidPortfolioSnapshotByAddress ?? {},
      )) {
        const netWorthUsd = snapshot?.netWorthUsd;
        // Mirror ServiceHyperliquid.getHyperliquidPortfolioSnapshot's cache
        // policy: fresh snapshots serve as-is; stale ones only inside the
        // stale-serve window and never when degraded. Older entries would
        // render as loading on Home, so the selector must not sum them.
        if (
          netWorthUsd !== undefined &&
          (isHyperliquidPortfolioSnapshotFresh(snapshot, now) ||
            (!snapshot.isDegraded &&
              now - snapshot.fetchedAt <=
                PERPS_HL_PORTFOLIO_STALE_SERVE_MAX_AGE_MS))
        ) {
          // Same-policy mode check: a snapshot written under a different
          // abstraction mode than the persisted one is rejected by the
          // service (allowCachedFallback), so the selector must not sum it
          // either. getUserAbstractionMode reads the cached perp data and
          // includes the legacy dexAbstraction fallback.
          const persistedMode =
            await this.backgroundApi.simpleDb.perp.getUserAbstractionMode(
              address,
            );
          if (!persistedMode || snapshot.abstractionMode === persistedMode) {
            snapshotNetWorthUsdByAddress[address.toLowerCase()] = netWorthUsd;
          }
        }
      }

      return await buildAccountsPerpsNetWorthUsd({
        accounts,
        snapshotNetWorthUsdByAddress,
        resolvePerpsAddressesByIndexedAccountIds: async (indexedAccountIds) =>
          this._resolvePerpsAddressesByIndexedAccountIds({
            indexedAccountIds,
            perpsDeriveType,
            snapshotAddresses: Object.keys(snapshotNetWorthUsdByAddress),
          }),
      });
    } catch {
      // Perps worth is additive display data — never break the selector.
      return emptyResult;
    }
  }
}

export default ServiceAccountSelector;
