import { isNil } from 'lodash';

import {
  getLocalUsedAddressFromLocalPendingTxs,
  transformAddress,
} from '@onekeyhq/core/src/chains/btc/sdkBtc/fresh-address';
import type {
  IBtcFindAddressItem,
  IBtcFreshAddress,
  IBtcFreshAddressStructure,
} from '@onekeyhq/core/src/chains/btc/types';
import { EAddressEncodings } from '@onekeyhq/core/src/types';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { BTC_FIND_ADDRESS_MAX_INDEX } from '@onekeyhq/shared/src/consts/chainConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import localDb from '../dbs/local/localDb';
import { settingsPersistAtom } from '../states/jotai/atoms';
import { vaultFactory } from '../vaults/factory';

import ServiceBase from './ServiceBase';

import type { IDBUtxoAccount } from '../dbs/local/types';
import type VaultBtc from '../vaults/impls/btc/Vault';
import type { IAccountDeriveTypes } from '../vaults/types';

@backgroundClass()
class ServiceFreshAddress extends ServiceBase {
  constructor({ backgroundApi }: { backgroundApi: any }) {
    super({ backgroundApi });

    appEventBus.on(EAppEventBusNames.WalletRemove, () => {
      this.getAccountNameFromFreshAddressMemo.clear();
    });
    appEventBus.on(EAppEventBusNames.AccountRemove, () => {
      this.getAccountNameFromFreshAddressMemo.clear();
    });
    appEventBus.on(EAppEventBusNames.WalletUpdate, () => {
      this.getAccountNameFromFreshAddressMemo.clear();
    });
  }

  private getLocalPendingTxsForFreshAddress = memoizee(
    async ({ networkId }: { networkId: string }) => {
      const localPendingTxs =
        await this.backgroundApi.simpleDb.localHistory.getLocalPendingHistoryByNetwork(
          {
            networkId,
          },
        );
      return getLocalUsedAddressFromLocalPendingTxs({
        pendingTxs: localPendingTxs.pendingTxs,
      });
    },
    {
      promise: true,
      maxAge: timerUtils.getTimeDurationMs({ seconds: 5 }),
    },
  );

  @backgroundMethod()
  async syncBTCFreshAddressByAccountId({
    accountId,
    networkId,
  }: {
    accountId: string;
    networkId: string;
  }) {
    if (
      accountUtils.isEnabledBtcFreshAddress({
        networkId,
        accountId,
        enableBTCFreshAddress: true, // always true, check in other method
      })
    ) {
      const dbAccount = await this.backgroundApi.serviceAccount.getDBAccount({
        accountId,
      });
      const indexedAccount =
        await this.backgroundApi.serviceAccount.getIndexedAccountByAccount({
          account: dbAccount,
        });
      if (indexedAccount) {
        void this.syncBTCFreshAddressByIndexedAccountId({
          indexedAccountId: indexedAccount.id,
          networkId,
        });
      }
    }
  }

  @backgroundMethod()
  async syncBTCFreshAddressByIndexedAccountId({
    indexedAccountId,
    networkId,
  }: {
    indexedAccountId: string;
    networkId: string;
  }) {
    if (
      networkId !== getNetworkIdsMap().onekeyall &&
      !networkUtils.isBTCNetwork(networkId)
    ) {
      return;
    }
    const enableBTCFreshAddress = (await settingsPersistAtom.get())
      .enableBTCFreshAddress;
    if (!enableBTCFreshAddress) {
      return;
    }

    const currentNetworkId =
      networkId === getNetworkIdsMap().onekeyall
        ? getNetworkIdsMap().btc
        : networkId;

    const btcAccounts =
      await this.backgroundApi.serviceAccount.getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes(
        {
          networkId: currentNetworkId,
          indexedAccountId,
          excludeEmptyAccount: true,
        },
      );
    btcAccounts.networkAccounts?.forEach((account) => {
      if (
        account.account?.id &&
        accountUtils.isEnabledBtcFreshAddress({
          networkId: btcAccounts.network.id,
          accountId: account.account?.id ?? '',
          enableBTCFreshAddress,
        })
      ) {
        void this.syncBTCFreshAddress({
          networkId: btcAccounts.network.id,
          accountId: account.account.id,
          deriveType: account.deriveType,
        });
      }
    });
  }

  @backgroundMethod()
  async syncBTCFreshAddress({
    networkId,
    accountId,
    deriveType,
  }: {
    networkId: string;
    accountId: string;
    deriveType: IAccountDeriveTypes;
  }) {
    const account = (await this.backgroundApi.serviceAccount.getDBAccount({
      accountId,
    })) as IDBUtxoAccount;
    if (!account?.xpub || !account?.xpubSegwit) {
      throw new OneKeyLocalError('Account xpub not found');
    }
    const xpubForMeta =
      deriveType === 'BIP86' ? account.xpubSegwit : account.xpub;
    const btcFreshAddressMetaRecord =
      (await this.backgroundApi.simpleDb.btcFreshAddressMeta.getRecord({
        networkId,
        xpubSegwit: xpubForMeta,
      })) ?? {};
    const { lastUpdateTime, txCount: currentTxCount } =
      btcFreshAddressMetaRecord;
    const lastLocalUsedAddressesHash =
      btcFreshAddressMetaRecord.localUsedAddressesHash;
    if (
      lastUpdateTime &&
      Date.now() - lastUpdateTime <
        timerUtils.getTimeDurationMs({
          seconds: 10,
        })
    ) {
      // Throttle sync requests within 10 seconds
      return;
    }

    const { localUsedAddressesHash, localUsedAddressesMap } =
      await this.getLocalPendingTxsForFreshAddress({
        networkId,
      });

    const isSameLocalUsedAddressesHash =
      lastLocalUsedAddressesHash &&
      lastLocalUsedAddressesHash === localUsedAddressesHash;

    let lastUsedAccountId: string | undefined;
    let lastUsedWalletName: string | undefined;
    let lastUsedAccountName: string | undefined;
    try {
      const walletId = accountUtils.getWalletIdFromAccountId({ accountId });
      let walletName: string | undefined;
      if (walletId) {
        const wallet = await this.backgroundApi.serviceAccount.getWallet({
          walletId,
        });
        walletName = wallet?.name;
      }
      const accountIdentifier =
        account.indexedAccountId ?? account.id ?? accountId;
      if (walletName && account.name && accountIdentifier) {
        lastUsedAccountId = accountIdentifier;
        lastUsedWalletName = walletName;
        lastUsedAccountName = account.name;
      }
    } catch (error) {
      console.error(error);
    }
    const lastUsedAccountMetaPatch =
      lastUsedAccountId && lastUsedWalletName && lastUsedAccountName
        ? {
            lastUsedAccountId,
            lastUsedWalletName,
            lastUsedAccountName,
          }
        : undefined;

    if (!isNil(currentTxCount)) {
      const accountDetailsWithTxCount =
        await this.backgroundApi.serviceAccountProfile.fetchAccountDetails({
          accountId,
          networkId,
          withTransactionCount: true,
        });
      if (
        (accountDetailsWithTxCount.transactionCount || 0) === currentTxCount &&
        isSameLocalUsedAddressesHash
      ) {
        await this.backgroundApi.simpleDb.btcFreshAddressMeta.updateRecord({
          networkId,
          xpubSegwit: xpubForMeta,
          patch: {
            lastUpdateTime: Date.now(),
            ...lastUsedAccountMetaPatch,
          },
        });
        return;
      }
    }

    const accountDetailsWithXpubDerivedTokens =
      await this.backgroundApi.serviceAccountProfile.fetchAccountDetails({
        accountId,
        networkId,
        withXpubDerivedTokens: true,
        withTransactionCount: true,
      });
    if (
      !Array.isArray(accountDetailsWithXpubDerivedTokens.xpubDerivedTokens) ||
      !accountDetailsWithXpubDerivedTokens.xpubDerivedTokens.length
    ) {
      await this.backgroundApi.simpleDb.btcFreshAddressMeta.updateRecord({
        networkId,
        xpubSegwit: xpubForMeta,
        patch: {
          lastUpdateTime: Date.now(),
          ...lastUsedAccountMetaPatch,
        },
      });
      return;
    }

    const vault = (await vaultFactory.getVault({
      networkId,
      accountId,
    })) as VaultBtc;
    const network = await vault.getBtcForkNetwork();
    const { encoding } = await vault.validateAddress(account.address);
    if (!encoding) {
      throw new OneKeyLocalError('Invalid account address');
    }
    const derivedInfos = await transformAddress({
      network,
      xpub: account.xpub,
      addressEncoding: encoding,
      derivedInfos: accountDetailsWithXpubDerivedTokens.xpubDerivedTokens,
      localUsedAddressesMap,
    });
    if (derivedInfos) {
      await this.backgroundApi.simpleDb.btcFreshAddress.updateBTCFreshAddresses(
        {
          networkId,
          xpubSegwit:
            encoding === EAddressEncodings.P2TR
              ? account.xpubSegwit
              : account.xpub,
          value: derivedInfos,
        },
      );
    }
    await this.backgroundApi.simpleDb.btcFreshAddressMeta.updateRecord({
      networkId,
      xpubSegwit: xpubForMeta,
      patch: {
        ...lastUsedAccountMetaPatch,
        txCount: accountDetailsWithXpubDerivedTokens.transactionCount || 0,
        lastUpdateTime: Date.now(),
        localUsedAddressesHash,
      },
    });
    appEventBus.emit(EAppEventBusNames.BtcFreshAddressUpdated, undefined);
    appEventBus.emit(EAppEventBusNames.AccountUpdate, undefined);

    // Update push notification subscription accounts after BTC fresh address update
    void this.backgroundApi.serviceNotification.registerClientWithAppendAccounts(
      {
        dbAccounts: [account],
      },
    );
  }

  private async resolveBtcAddressContext({
    accountId,
    networkId,
    deriveType,
    dbAccount: prefetchedDbAccount,
  }: {
    accountId: string;
    networkId: string;
    deriveType?: IAccountDeriveTypes;
    // optional prefetched account to avoid a duplicate db read
    dbAccount?: IDBUtxoAccount;
  }): Promise<
    | {
        dbAccount: IDBUtxoAccount;
        xpubSegwit: string;
        freshAddresses: IBtcFreshAddressStructure | undefined;
      }
    | undefined
  > {
    if (!accountId || !networkId) return undefined;
    if (!networkUtils.isBTCNetwork(networkId)) return undefined;

    const dbAccount =
      prefetchedDbAccount ??
      ((await this.backgroundApi.serviceAccount.getDBAccount({
        accountId,
      })) as IDBUtxoAccount | undefined);
    if (!dbAccount) return undefined;

    let xpubSegwit =
      deriveType === 'BIP86' ? dbAccount.xpubSegwit : dbAccount.xpub;
    if (!deriveType) {
      const vault = (await vaultFactory.getVault({
        networkId,
        accountId,
      })) as VaultBtc;
      const { encoding } = await vault.validateAddress(dbAccount.address);
      xpubSegwit =
        encoding === EAddressEncodings.P2TR
          ? dbAccount.xpubSegwit
          : dbAccount.xpub;
    }
    if (!xpubSegwit) return undefined;

    const freshAddresses =
      await this.backgroundApi.simpleDb.btcFreshAddress.getBTCFreshAddresses({
        networkId,
        xpubSegwit,
      });

    return { dbAccount, xpubSegwit, freshAddresses };
  }

  private async deriveAndPersistFreshAddresses({
    accountId,
    networkId,
    xpubSegwit,
    dbAccount,
    freshAddresses,
    paged,
    rewriteStructure,
  }: {
    accountId: string;
    networkId: string;
    xpubSegwit: string;
    dbAccount: IDBUtxoAccount;
    freshAddresses: IBtcFreshAddressStructure | undefined;
    paged: IBtcFreshAddress[];
    rewriteStructure: (params: {
      structure: IBtcFreshAddressStructure;
      derivedMap: Record<string, string>;
      updatedPaths: Set<string>;
    }) => IBtcFreshAddressStructure;
  }): Promise<IBtcFreshAddress[]> {
    if (!paged.length) return paged;

    const deriveCandidates = paged.filter(
      (item) => item.path && (!item.isDerivedByApp || !item.address),
    );
    if (deriveCandidates.length === 0) return paged;

    const vault = (await vaultFactory.getVault({
      networkId,
      accountId,
    })) as VaultBtc;

    const derivedMap = await vault.deriveAddressesByPaths({
      dbAccount,
      paths: deriveCandidates
        .map((item) => item.path)
        .filter((path): path is string => Boolean(path)),
    });

    const updatedPaths = new Set<string>();
    const next = paged.map((item) => {
      const path = item.path;
      if (!path) return item;
      const derived = derivedMap[path];
      if (!derived) return item;
      if (!item.isDerivedByApp || item.address !== derived) {
        updatedPaths.add(path);
      }
      return { ...item, address: derived, isDerivedByApp: true };
    });

    if (freshAddresses && updatedPaths.size > 0) {
      await this.backgroundApi.simpleDb.btcFreshAddress.updateBTCFreshAddresses(
        {
          networkId,
          xpubSegwit,
          value: rewriteStructure({
            structure: freshAddresses,
            derivedMap,
            updatedPaths,
          }),
        },
      );
    }

    return next;
  }

  @backgroundMethod()
  async getBtcUsedAddressesByPage({
    accountId,
    networkId,
    page,
    pageSize,
    deriveType,
  }: {
    accountId: string;
    networkId: string;
    page: number;
    pageSize: number;
    deriveType?: IAccountDeriveTypes;
  }): Promise<{ total: number; items: IBtcFreshAddress[] }> {
    const emptyResult = { total: 0, items: [] as IBtcFreshAddress[] };

    if (!accountId || !networkId || pageSize <= 0 || page <= 0) {
      return emptyResult;
    }

    const ctx = await this.resolveBtcAddressContext({
      accountId,
      networkId,
      deriveType,
    });
    if (!ctx) return emptyResult;
    const { dbAccount, xpubSegwit, freshAddresses } = ctx;

    const usedAddresses = freshAddresses?.fresh?.used ?? [];
    const total = usedAddresses.length;
    if (!total) return emptyResult;

    const start = (Math.max(1, page) - 1) * pageSize;
    const paged = usedAddresses.slice(start, start + pageSize).map((item) => ({
      ...item,
      address: item.address ?? item.name,
    }));
    if (!paged.length) return { total, items: [] };

    const items = await this.deriveAndPersistFreshAddresses({
      accountId,
      networkId,
      xpubSegwit,
      dbAccount,
      freshAddresses,
      paged,
      rewriteStructure: ({ structure, derivedMap, updatedPaths }) => {
        const freshGroup = structure.fresh ?? { used: [], unused: [] };
        return {
          ...structure,
          fresh: {
            ...freshGroup,
            used: (freshGroup.used ?? []).map((item) => {
              if (!item.path || !updatedPaths.has(item.path)) return item;
              const derived = derivedMap[item.path];
              return derived
                ? { ...item, address: derived, isDerivedByApp: true }
                : item;
            }),
          },
        };
      },
    });

    return { total, items };
  }

  @backgroundMethod()
  async getBtcNextFreshAddress({
    accountId,
    networkId,
    deriveType,
  }: {
    accountId: string;
    networkId: string;
    deriveType?: IAccountDeriveTypes;
  }): Promise<{ next: IBtcFreshAddress | undefined; totalFresh: number }> {
    const empty = { next: undefined, totalFresh: 0 };
    if (!accountId || !networkId) return empty;

    const ctx = await this.resolveBtcAddressContext({
      accountId,
      networkId,
      deriveType,
    });
    if (!ctx) return empty;
    const { dbAccount, xpubSegwit, freshAddresses } = ctx;

    const unused = freshAddresses?.fresh?.unused ?? [];
    const totalFresh = unused.length;
    if (!totalFresh) return empty;

    const first = unused[0];
    const seed: IBtcFreshAddress = {
      ...first,
    };

    const items = await this.deriveAndPersistFreshAddresses({
      accountId,
      networkId,
      xpubSegwit,
      dbAccount,
      freshAddresses,
      paged: [seed],
      rewriteStructure: ({ structure, derivedMap, updatedPaths }) => {
        const freshGroup = structure.fresh ?? { used: [], unused: [] };
        return {
          ...structure,
          fresh: {
            ...freshGroup,
            unused: (freshGroup.unused ?? []).map((item) => {
              if (!item.path || !updatedPaths.has(item.path)) return item;
              const derived = derivedMap[item.path];
              return derived
                ? { ...item, address: derived, isDerivedByApp: true }
                : item;
            }),
          },
        };
      },
    });

    const next = items[0];
    return { next: next?.address ? next : undefined, totalFresh };
  }

  @backgroundMethod()
  async getBtcNextChangeAddress({
    accountId,
    networkId,
    deriveType,
  }: {
    accountId: string;
    networkId: string;
    deriveType?: IAccountDeriveTypes;
  }): Promise<{ next: IBtcFreshAddress | undefined }> {
    const empty = { next: undefined };
    if (!accountId || !networkId) return empty;

    const ctx = await this.resolveBtcAddressContext({
      accountId,
      networkId,
      deriveType,
    });
    if (!ctx) return empty;
    const { dbAccount, xpubSegwit, freshAddresses } = ctx;

    const unused = freshAddresses?.change?.unused ?? [];
    if (!unused.length) return empty;

    const first = unused[0];
    const seed: IBtcFreshAddress = {
      ...first,
    };

    const items = await this.deriveAndPersistFreshAddresses({
      accountId,
      networkId,
      xpubSegwit,
      dbAccount,
      freshAddresses,
      paged: [seed],
      rewriteStructure: ({ structure, derivedMap, updatedPaths }) => {
        const changeGroup = structure.change ?? { used: [], unused: [] };
        return {
          ...structure,
          change: {
            ...changeGroup,
            unused: (changeGroup.unused ?? []).map((item) => {
              if (!item.path || !updatedPaths.has(item.path)) return item;
              const derived = derivedMap[item.path];
              return derived
                ? { ...item, address: derived, isDerivedByApp: true }
                : item;
            }),
          },
        };
      },
    });

    const next = items[0];
    return { next: next?.address ? next : undefined };
  }

  @backgroundMethod()
  async getBtcChangeAddressesByPage({
    accountId,
    networkId,
    page,
    pageSize,
    deriveType,
  }: {
    accountId: string;
    networkId: string;
    page: number;
    pageSize: number;
    deriveType?: IAccountDeriveTypes;
  }): Promise<{ total: number; items: IBtcFreshAddress[] }> {
    const emptyResult = { total: 0, items: [] as IBtcFreshAddress[] };

    if (!accountId || !networkId || pageSize <= 0 || page <= 0) {
      return emptyResult;
    }

    const ctx = await this.resolveBtcAddressContext({
      accountId,
      networkId,
      deriveType,
    });
    if (!ctx) return emptyResult;
    const { dbAccount, xpubSegwit, freshAddresses } = ctx;

    const source = freshAddresses?.change?.used ?? [];

    const total = source.length;
    if (!total) return emptyResult;

    const start = (Math.max(1, page) - 1) * pageSize;
    const paged = source.slice(start, start + pageSize).map((item) => ({
      ...item,
      address: item.address ?? item.name,
    }));
    if (!paged.length) return { total, items: [] };

    const items = await this.deriveAndPersistFreshAddresses({
      accountId,
      networkId,
      xpubSegwit,
      dbAccount,
      freshAddresses,
      paged,
      rewriteStructure: ({ structure, derivedMap, updatedPaths }) => {
        const changeGroup = structure.change ?? { used: [], unused: [] };
        return {
          ...structure,
          change: {
            ...changeGroup,
            used: (changeGroup.used ?? []).map((item) => {
              if (!item.path || !updatedPaths.has(item.path)) return item;
              const derived = derivedMap[item.path];
              return derived
                ? { ...item, address: derived, isDerivedByApp: true }
                : item;
            }),
          },
        };
      },
    });

    return { total, items };
  }

  async getAccountNameFromFreshAddress({
    address,
    networkId,
  }: {
    address: string;
    networkId: string;
  }) {
    return this.getAccountNameFromFreshAddressMemo({
      address,
      networkId,
    });
  }

  private async resolveFreshAddressOwner({
    accountId,
  }: {
    accountId: string;
  }): Promise<
    | {
        accountId: string;
        accountName: string;
        walletName: string;
      }
    | undefined
  > {
    if (!accountId) {
      return undefined;
    }

    const walletId = accountUtils.getWalletIdFromAccountId({ accountId });
    if (!walletId) {
      return undefined;
    }

    const wallet = await this.backgroundApi.serviceAccount.getWalletSafe({
      walletId,
    });
    if (!wallet || accountUtils.isWalletDeprecatedOrMocked(wallet)) {
      return undefined;
    }

    const isTempWalletRemoved =
      await this.backgroundApi.serviceAccount.isTempWalletRemoved({
        wallet,
      });
    if (isTempWalletRemoved) {
      return undefined;
    }

    const indexedAccount =
      await this.backgroundApi.serviceAccount.getIndexedAccountSafe({
        id: accountId,
      });
    if (indexedAccount) {
      return {
        accountId: indexedAccount.id,
        accountName: indexedAccount.name,
        walletName: wallet.name,
      };
    }

    const dbAccount = await this.backgroundApi.serviceAccount.getDBAccountSafe({
      accountId,
    });
    if (
      !dbAccount ||
      accountUtils.isUrlAccountFn({ accountId: dbAccount.id })
    ) {
      return undefined;
    }

    return {
      accountId: dbAccount.id,
      accountName: dbAccount.name,
      walletName: wallet.name,
    };
  }

  getAccountNameFromFreshAddressMemo = memoizee(
    async ({ address, networkId }: { address: string; networkId: string }) => {
      if (!networkUtils.isBTCNetwork(networkId)) {
        return [];
      }
      const enableBTCFreshAddress = (await settingsPersistAtom.get())
        .enableBTCFreshAddress;
      if (!enableBTCFreshAddress) {
        return [];
      }
      const key =
        await this.backgroundApi.simpleDb.btcFreshAddress.getKeyByAddress({
          address,
          networkId,
        });
      if (!key) {
        return [];
      }
      const metadata =
        await this.backgroundApi.simpleDb.btcFreshAddressMeta.getRecordByKey(
          key,
        );
      if (metadata && metadata.lastUsedAccountId) {
        const owner = await this.resolveFreshAddressOwner({
          accountId: metadata.lastUsedAccountId,
        });
        if (owner) {
          return [owner];
        }
      }
      return [];
    },
    {
      promise: true,
      primitive: true,
      max: 50,
      maxAge: timerUtils.getTimeDurationMs({ seconds: 10 }),
    },
  );

  // Return all searchable fresh addresses for a list of BTC accounts.
  // Consolidates derive-type-aware xpub key selection and fresh address
  // extraction that was previously inlined in RecipientQuickSelect UI.
  @backgroundMethod()
  async getSearchableAddressesForAccounts({
    networkId,
    accounts,
  }: {
    networkId: string;
    accounts: Array<{
      accountId: string;
      deriveType?: string;
    }>;
  }): Promise<Record<string, string[]>> {
    if (!networkUtils.isBTCNetwork(networkId) || accounts.length === 0) {
      return {};
    }

    const result: Record<string, string[]> = {};

    await Promise.all(
      accounts.map(async ({ accountId, deriveType }) => {
        try {
          const dbAccount =
            (await this.backgroundApi.serviceAccount.getDBAccount({
              accountId,
            })) as IDBUtxoAccount | undefined;
          if (!dbAccount) return;

          // Fresh address DB key depends on derive type: Taproot (BIP86)
          // uses xpubSegwit, all others use xpub.
          const xpubSegwit =
            deriveType === 'BIP86'
              ? dbAccount.xpubSegwit
              : (dbAccount.xpub ?? dbAccount.xpubSegwit);
          if (!xpubSegwit) return;

          const freshData =
            await this.backgroundApi.simpleDb.btcFreshAddress.getBTCFreshAddresses(
              { networkId, xpubSegwit },
            );
          if (!freshData) return;

          const addresses: string[] = [];
          [
            freshData.fresh?.used,
            freshData.fresh?.unused,
            freshData.change?.used,
            freshData.change?.unused,
          ].forEach((group) => {
            group?.forEach((item) => {
              const addr = item.address ?? item.name;
              if (addr) addresses.push(addr);
            });
          });

          if (addresses.length > 0) {
            result[accountId] = addresses;
          }
        } catch {
          // non-fatal per account
        }
      }),
    );

    return result;
  }

  // ---------------------------------------------- btc find-address feature

  private async getBtcFindAddressDbAccount({
    accountId,
    networkId,
  }: {
    accountId: string;
    networkId: string;
  }): Promise<IDBUtxoAccount> {
    if (!networkUtils.isBTCNetwork(networkId)) {
      throw new OneKeyLocalError(
        'btc find-address is only available on BTC networks',
      );
    }
    if (
      !accountUtils.isHdAccount({ accountId }) &&
      !accountUtils.isHwAccount({ accountId }) &&
      !accountUtils.isQrAccount({ accountId })
    ) {
      throw new OneKeyLocalError(
        'btc find-address is only available for hd/hw/qr accounts',
      );
    }
    const dbAccount = (await this.backgroundApi.serviceAccount.getDBAccount({
      accountId,
    })) as IDBUtxoAccount | undefined;
    if (!dbAccount?.xpub || !dbAccount?.path) {
      throw new OneKeyLocalError('Account xpub not found');
    }
    return dbAccount;
  }

  @backgroundMethod()
  async findBtcAddressByIndex({
    accountId,
    networkId,
    index,
  }: {
    accountId: string;
    networkId: string;
    index: number;
  }): Promise<IBtcFindAddressItem> {
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index > BTC_FIND_ADDRESS_MAX_INDEX
    ) {
      throw new OneKeyLocalError('Invalid address index');
    }
    const dbAccount = await this.getBtcFindAddressDbAccount({
      accountId,
      networkId,
    });
    const relPath = `0/${index}`;
    const path = `${dbAccount.path}/${relPath}`;
    const vault = (await vaultFactory.getVault({
      networkId,
      accountId,
    })) as VaultBtc;
    const derivedMap = await vault.deriveAddressesByPaths({
      dbAccount,
      paths: [path],
    });
    const address = derivedMap[path];
    if (!address) {
      throw new OneKeyLocalError('Failed to derive address by index');
    }
    return { index, relPath, path, address };
  }

  // build a one-shot checker so callers with many addresses resolve the
  // db account and the fresh-address map once instead of per address
  private async buildBtcDiscoveredAddressChecker({
    accountId,
    networkId,
    dbAccount: prefetchedDbAccount,
  }: {
    accountId: string;
    networkId: string;
    // optional prefetched account to avoid a duplicate db read
    dbAccount?: IDBUtxoAccount;
  }): Promise<(address: string) => boolean> {
    const discovered = new Set<string>();

    const ctx = await this.resolveBtcAddressContext({
      accountId,
      networkId,
      dbAccount: prefetchedDbAccount,
    });

    // local-first: the main address plus gap-scanned/custom addresses are
    // already visible even when the fresh-address cache was never fetched
    const dbAccount =
      ctx?.dbAccount ??
      prefetchedDbAccount ??
      ((await this.backgroundApi.serviceAccount
        .getDBAccount({ accountId })
        .catch(() => undefined)) as IDBUtxoAccount | undefined);
    if (dbAccount) {
      if (dbAccount.address) {
        discovered.add(dbAccount.address);
      }
      Object.values(dbAccount.addresses || {}).forEach((item) =>
        discovered.add(item),
      );
      Object.values(dbAccount.customAddresses || {}).forEach((item) =>
        discovered.add(item),
      );
    }

    if (ctx) {
      const freshAddressesMap =
        await this.backgroundApi.simpleDb.btcFreshAddress.getBTCFreshAddressMap(
          {
            networkId,
            xpubSegwit: ctx.xpubSegwit,
          },
        );
      Object.entries(freshAddressesMap).forEach(([name, item]) => {
        discovered.add(name);
        if (item.address) {
          discovered.add(item.address);
        }
      });
    }

    return (address: string) => discovered.has(address);
  }

  @backgroundMethod()
  async isBtcAddressAlreadyDiscovered({
    accountId,
    networkId,
    address,
  }: {
    accountId: string;
    networkId: string;
    address: string;
  }): Promise<boolean> {
    const isDiscovered = await this.buildBtcDiscoveredAddressChecker({
      accountId,
      networkId,
    });
    return isDiscovered(address);
  }

  @backgroundMethod()
  async claimBtcFindAddress({
    accountId,
    networkId,
    index,
  }: {
    accountId: string;
    networkId: string;
    index: number;
  }): Promise<{
    item: IBtcFindAddressItem;
    alreadyDiscovered: boolean;
  }> {
    const item = await this.findBtcAddressByIndex({
      accountId,
      networkId,
      index,
    });
    const alreadyDiscovered = await this.isBtcAddressAlreadyDiscovered({
      accountId,
      networkId,
      address: item.address,
    });
    if (alreadyDiscovered) {
      // address is already visible in the account (within gap scan),
      // claiming it would be meaningless (D7)
      return { item, alreadyDiscovered: true };
    }
    await localDb.updateAccountFindAddresses({
      accountId,
      addedFindAddresses: { [item.relPath]: item.address },
    });
    await this.clearClaimedUtxosCache({ accountId, networkId });
    appEventBus.emit(EAppEventBusNames.BtcFindAddressUpdated, undefined);
    return { item, alreadyDiscovered: false };
  }

  private async clearClaimedUtxosCache({
    accountId,
    networkId,
  }: {
    accountId: string;
    networkId: string;
  }) {
    try {
      const vault = (await vaultFactory.getVault({
        networkId,
        accountId,
      })) as VaultBtc;
      vault._collectClaimedUtxosWithCache.clear();
    } catch {
      // non-fatal
    }
  }

  @backgroundMethod()
  async unclaimBtcFindAddress({
    accountId,
    networkId,
    relPath,
  }: {
    accountId: string;
    networkId: string;
    relPath: string;
  }): Promise<void> {
    await localDb.updateAccountFindAddresses({
      accountId,
      removedRelPaths: [relPath],
    });
    await this.clearClaimedUtxosCache({ accountId, networkId });
    appEventBus.emit(EAppEventBusNames.BtcFindAddressUpdated, undefined);
  }

  @backgroundMethod()
  async getBtcFindAddresses({
    accountId,
    networkId,
  }: {
    accountId: string;
    networkId: string;
  }): Promise<IBtcFindAddressItem[]> {
    let dbAccount: IDBUtxoAccount;
    try {
      dbAccount = await this.getBtcFindAddressDbAccount({
        accountId,
        networkId,
      });
    } catch {
      return [];
    }
    const findAddresses = dbAccount.findAddresses || {};
    let entries = Object.entries(findAddresses);
    if (!entries.length) {
      return [];
    }

    // D8: a claimed address that later gets discovered by the gap scan is
    // shown in the used list only, drop it from findAddresses
    const isDiscovered = await this.buildBtcDiscoveredAddressChecker({
      accountId,
      networkId,
      dbAccount,
    });
    const discoveredRelPaths = entries
      .filter(([, address]) => isDiscovered(address))
      .map(([relPath]) => relPath);
    if (discoveredRelPaths.length) {
      await localDb.updateAccountFindAddresses({
        accountId,
        removedRelPaths: discoveredRelPaths,
      });
      await this.clearClaimedUtxosCache({ accountId, networkId });
      entries = entries.filter(
        ([relPath]) => !discoveredRelPaths.includes(relPath),
      );
    }

    return entries
      .map(([relPath, address]) => ({
        index: Number(relPath.split('/')[1]),
        relPath,
        path: `${dbAccount.path}/${relPath}`,
        address,
      }))
      .toSorted((a, b) => b.index - a.index);
  }

  @backgroundMethod()
  async fetchBtcFindAddressDetails({
    accountId,
    networkId,
    address,
  }: {
    accountId: string;
    networkId: string;
    address: string;
  }) {
    return this.backgroundApi.serviceAccountProfile.fetchAccountDetails({
      accountId,
      networkId,
      accountAddress: address,
      queryByAddressOnly: true,
      withUTXOList: true,
      withFrozenBalance: true,
    });
  }
}

export default ServiceFreshAddress;
