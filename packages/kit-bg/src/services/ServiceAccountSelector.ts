/* eslint-disable @typescript-eslint/no-unused-vars */
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
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import accountSelectorUtils from '@onekeyhq/shared/src/utils/accountSelectorUtils';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type {
  EAccountSelectorSceneName,
  IServerNetwork,
} from '@onekeyhq/shared/types';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

import { getVaultSettings } from '../vaults/settings';

import ServiceBase from './ServiceBase';

import type { AccountSelectorPerpsWorth } from './utils/accountSelectorPerpsWorth';
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

function hasStoredAccountAddress(account: IDBAccount): boolean {
  if (account.address) {
    return true;
  }

  const addressMaps = [
    'addresses' in account ? account.addresses : undefined,
    'customAddresses' in account ? account.customAddresses : undefined,
    'findAddresses' in account ? account.findAddresses : undefined,
    'connectedAddresses' in account ? account.connectedAddresses : undefined,
  ];

  return addressMaps.some((addressMap) =>
    Object.values(addressMap ?? {}).some(Boolean),
  );
}

@backgroundClass()
class ServiceAccountSelector extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });
  }

  // Home/swap sync helpers live in a lazily imported module so they stay out
  // of the native background startup graph (Startup Graph Budget CI check).
  private async _getHomeSyncUtils() {
    return import('./utils/accountSelectorHomeSyncUtils');
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
    const { shouldSyncWithHomeScene } = await this._getHomeSyncUtils();
    return shouldSyncWithHomeScene({ scene: { sceneName, sceneUrl, num } });
  }

  @backgroundMethod()
  async shouldSyncWithHomeSource(params: {
    sceneName: EAccountSelectorSceneName;
    sceneUrl?: string;
    num: number;
  }) {
    const { isAccountSelectorHomeSyncSourceScene } =
      await this._getHomeSyncUtils();
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
    const { shouldSyncHomeAndSwapScenes } = await this._getHomeSyncUtils();
    return shouldSyncHomeAndSwapScenes({ sourceScene, targetScene });
  }

  @backgroundMethod()
  public async fixOthersWalletAccountNetworkPair({
    selectedAccount,
    source,
  }: {
    selectedAccount: IAccountSelectorSelectedAccount;
    source?: string;
  }): Promise<IAccountSelectorSelectedAccount> {
    const { fixOthersWalletAccountNetworkPair } =
      await this._getHomeSyncUtils();
    return fixOthersWalletAccountNetworkPair({
      backgroundApi: this.backgroundApi,
      selectedAccount,
      source,
    });
  }

  @backgroundMethod()
  public async mergeHomeDataToSwapMap({
    swapMap,
  }: {
    swapMap: IAccountSelectorSelectedAccountsMap | undefined;
  }) {
    const { mergeHomeDataToSwapMap } = await this._getHomeSyncUtils();
    return mergeHomeDataToSwapMap({
      backgroundApi: this.backgroundApi,
      swapMap,
    });
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
    perfTiming?: {
      bgTotalMs: number;
      errorStages: string[];
      stageMs: Record<string, number>;
    };
  }> {
    const stageMs: Record<string, number> = {};
    const errorStages: string[] = [];
    const getPerfTimestamp = () =>
      typeof performance !== 'undefined' && performance.now
        ? performance.now()
        : Date.now();
    const startStage = () => (nonce === undefined ? 0 : getPerfTimestamp());
    const perfStartedAt = startStage();
    const finishStage = (stage: string, startedAt: number) => {
      if (nonce !== undefined) {
        stageMs[stage] = Math.round(getPerfTimestamp() - startedAt);
      }
    };
    // Together with `deriveType` below this reads exactly the fields in
    // ACTIVE_ACCOUNT_RELOAD_SELECTION_FIELDS (kit selectedAccountCompare.ts);
    // its key-set test guards the agreement, since kit-bg cannot import the
    // constant itself.
    const { othersWalletAccountId, indexedAccountId, networkId, walletId } =
      selectedAccount;
    const recordStageError = (stage: string, error: unknown) => {
      // Failure logging is deliberately NOT gated by the perf nonce: callers
      // like ServiceDApp never pass one, and a silently degraded build is the
      // only bg-side trace of a broken account/network switch. The nonce keeps
      // gating only the timing stats (stageMs/perfTiming).
      defaultLogger.accountSelector.failure.buildActiveAccountStageFailed({
        errorMessage: (error as Error | undefined)?.message,
        errorName: (error as Error | undefined)?.name,
        networkId,
        stage,
      });
      if (!errorStages.includes(stage)) {
        errorStages.push(stage);
      }
    };
    const deriveType = selectedAccount.deriveType;

    if (nonce !== undefined) {
      defaultLogger.accountSelector.perf.buildActiveAccountInfoFromSelectedAccount(
        {
          selectedAccount,
        },
      );
    }

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
    const isAllNetwork = Boolean(
      networkId && networkUtils.isAllNetwork({ networkId }),
    );

    const walletAndIndexedStartedAt = startStage();
    if (walletId) {
      try {
        wallet = await serviceAccount.getWallet({
          walletId,
        });
      } catch (error) {
        recordStageError('wallet', error);
      }
    }

    if (indexedAccountId && wallet) {
      try {
        indexedAccount = await serviceAccount.getIndexedAccount({
          id: indexedAccountId,
        });
      } catch (error) {
        recordStageError('indexedAccount', error);
      }
    }

    let dbAccountId = othersWalletAccountId || '';
    // Prefer the fetched indexedAccount but fall back to the raw
    // indexedAccountId: a transient getIndexedAccount failure (bg service
    // worker recycled, native DB busy, cold-start race) must not cascade
    // into skipping the dbAccount/network account lookups below.
    const effectiveIndexedAccountId = indexedAccount?.id || indexedAccountId;
    if (
      !dbAccountId &&
      effectiveIndexedAccountId &&
      networkId &&
      deriveType &&
      !isAllNetwork
    ) {
      try {
        dbAccountId =
          await this.backgroundApi.serviceAccount.getDbAccountIdFromIndexedAccountId(
            {
              indexedAccountId: effectiveIndexedAccountId,
              networkId,
              deriveType,
            },
          );
      } catch (error) {
        recordStageError('dbAccountId', error);
      }
    }
    finishStage('walletAndIndexed', walletAndIndexedStartedAt);

    const networkAndVaultStartedAt = startStage();
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
          recordStageError('vaultSettings', error);
        }
      } catch (error) {
        recordStageError('network', error);
      }
    }
    finishStage('networkAndVault', networkAndVaultStartedAt);

    const networkAccountAndDeriveStartedAt = startStage();
    if (networkId) {
      // Unusable and legacy others-wallet selections skip the stored-address
      // check below, so keep their existing aggregate-account behavior.
      const shouldQueryIndexedAllNetworkAccount = Boolean(
        wallet &&
        (accountUtils.isWalletDeprecatedOrMocked(wallet) ||
          accountUtils.isOthersWallet({ walletId: wallet.id })),
      );
      const canQueryIndexedNetworkAccount = Boolean(
        deriveType &&
        effectiveIndexedAccountId &&
        wallet &&
        (!isAllNetwork || shouldQueryIndexedAllNetworkAccount),
      );
      const canQueryOthersNetworkAccount = Boolean(othersWalletAccountId);
      if (canQueryIndexedNetworkAccount || canQueryOthersNetworkAccount) {
        try {
          const r = await serviceAccount.getNetworkAccount({
            indexedAccountId: effectiveIndexedAccountId,
            accountId: othersWalletAccountId,
            deriveType: deriveType || 'default',
            networkId,
          });
          account = r;
        } catch (error) {
          // account may not compatible with network
          recordStageError('networkAccount', error);
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
          recordStageError('deriveInfo', error);
        }
      }
    }
    finishStage('networkAccountAndDerive', networkAccountAndDeriveStartedAt);

    const dbAccountAndWalletStateStartedAt = startStage();
    if (dbAccountId && (!isAllNetwork || othersWalletAccountId)) {
      try {
        const r = await serviceAccount.getDBAccount({
          accountId: dbAccountId,
        });
        dbAccount = r;
      } catch (error) {
        recordStageError('dbAccount', error);
      }
    }

    if (wallet) {
      try {
        if (await serviceAccount.isTempWalletRemoved({ wallet })) {
          wallet = undefined;
          account = undefined;
          indexedAccount = undefined;
        }
      } catch (error) {
        recordStageError('tempWalletState', error);
        throw error;
      }
    }
    finishStage('dbAccountAndWalletState', dbAccountAndWalletStateStartedAt);

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

    const deviceAndAllNetworkStartedAt = startStage();
    if ((isHwWallet || isQrWallet) && wallet?.associatedDevice) {
      try {
        device = await serviceAccount.getDevice({
          dbDeviceId: wallet?.associatedDevice,
        });
      } catch (error) {
        recordStageError('device', error);
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
      // Only expose the aggregate mock account after a real chain address exists.
      if (!isOthersWallet && indexedAccountId && !isWalletUnusable) {
        try {
          const { accounts } =
            await this.backgroundApi.serviceAccount.getAccountsInSameIndexedAccountId(
              {
                indexedAccountId,
              },
            );
          // Persisted addresses define whether an account has been created.
          // Runtime derivation here would turn skipped creation into existence.
          account = accounts.some(hasStoredAccountAddress)
            ? await this.backgroundApi.serviceAccount.getMockedAllNetworkAccount(
                {
                  indexedAccountId,
                },
              )
            : undefined;
          canCreateAddress = true;
        } catch (error) {
          account = undefined;
          canCreateAddress = true;
          recordStageError('allNetworkMockAccount', error);
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
    finishStage('deviceAndAllNetwork', deviceAndAllNetworkStartedAt);

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
    const deriveInfoItemsStartedAt = startStage();
    let deriveInfoItems: IAccountDeriveInfoItems[] = [];
    try {
      deriveInfoItems = await serviceNetwork.getDeriveInfoItemsOfNetwork({
        networkId,
      });
    } catch (error) {
      recordStageError('deriveInfoItems', error);
    }
    finishStage('deriveInfoItems', deriveInfoItemsStartedAt);
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
    return {
      activeAccount,
      selectedAccount: selectedAccountFixed,
      nonce,
      ...(nonce === undefined
        ? {}
        : {
            perfTiming: {
              bgTotalMs: Math.round(getPerfTimestamp() - perfStartedAt),
              errorStages,
              stageMs,
            },
          }),
    };
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
    } catch {
      // wallet may be removed
      defaultLogger.accountSelector.perf.trace('walletLookupFailed', {
        phase: 'buildAccountsData',
      });
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
    } catch {
      // wallet may be removed
      defaultLogger.accountSelector.perf.trace('walletLookupFailed', {
        phase: 'buildWalletData',
      });
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
    const accountsDeFiOverviewRaw =
      await this.backgroundApi.serviceDeFi.getAccountsLocalDeFiOverview({
        accounts,
      });
    // Compound-key shape consumed by `calculateAccountTotalValue`; the
    // per-address `getAllNetworkAccountsValue` would yield Record<networkId,
    // worth> and silently miss every compound-key lookup downstream. The
    // batched form folds N storage reads into one (the SimpleDb entity has
    // caching disabled, so the per-account form paid a fresh
    // deserialization per row — a 50-row selector batch turned into 50
    // reads). Extra fields on the account objects are ignored by the callee.
    const accountsValue =
      await this.backgroundApi.serviceAccountProfile.getAllNetworkAccountsValueByAccountIdBatch(
        { accounts },
      );
    // Perps worth is additive display data — a failed lazy-module load must
    // never break this batch's tokens/DeFi values, so fall back to the raw
    // overview on any load error.
    const accountsDeFiOverview = await this._getPerpsWorth()
      .then((perpsWorth) =>
        perpsWorth.buildDeFiOverviewWithPerps({
          accounts,
          linkedNetworkId,
          accountsDeFiOverview: accountsDeFiOverviewRaw,
        }),
      )
      .catch(() => accountsDeFiOverviewRaw);
    return {
      accountsValue,
      accountsDeFiOverview,
    };
  }

  // Loaded on first use: perps-worth resolution is selector-open code and
  // its dependency chain (homeWalletTabSupportUtils, perps consts/utils)
  // must stay out of the native background startup graph, which the Startup
  // Graph Budget CI check enforces — keep this a dynamic import.
  private _perpsWorthPromise: Promise<AccountSelectorPerpsWorth> | undefined;

  private async _getPerpsWorth(): Promise<AccountSelectorPerpsWorth> {
    if (!this._perpsWorthPromise) {
      this._perpsWorthPromise = import('./utils/accountSelectorPerpsWorth')
        .then(
          (m) =>
            new m.AccountSelectorPerpsWorth({
              backgroundApi: this.backgroundApi,
            }),
        )
        .catch((error) => {
          // Drop the failed load so the next call retries, instead of pinning
          // the rejection on this bg singleton for the rest of the session.
          this._perpsWorthPromise = undefined;
          throw error;
        });
    }
    return this._perpsWorthPromise;
  }
}

export default ServiceAccountSelector;
