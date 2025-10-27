import { isNil } from 'lodash';

import {
  getLocalUsedAddressFromLocalPendingTxs,
  transformAddress,
} from '@onekeyhq/core/src/chains/btc/sdkBtc/fresh-address';
import type { IBtcFreshAddress } from '@onekeyhq/core/src/chains/btc/types';
import { EAddressEncodings } from '@onekeyhq/core/src/types';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { settingsPersistAtom } from '../states/jotai/atoms';
import { vaultFactory } from '../vaults/factory';

import ServiceBase from './ServiceBase';

import type { IDBUtxoAccount } from '../dbs/local/types';
import type VaultBtc from '../vaults/impls/btc/Vault';
import type { IAccountDeriveTypes } from '../vaults/types';

@backgroundClass()
class ServiceFreshAddress extends ServiceBase {
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
            ...(lastUsedAccountMetaPatch ?? {}),
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
          ...(lastUsedAccountMetaPatch ?? {}),
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
        ...(lastUsedAccountMetaPatch ?? {}),
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

  @backgroundMethod()
  async getBtcUsedAddressesByPage({
    accountId,
    networkId,
    page,
    pageSize,
  }: {
    accountId: string;
    networkId: string;
    page: number;
    pageSize: number;
  }): Promise<{ total: number; items: IBtcFreshAddress[] }> {
    const emptyResult = { total: 0, items: [] as IBtcFreshAddress[] };

    if (!accountId || !networkId || pageSize <= 0 || page <= 0) {
      return emptyResult;
    }

    if (!networkUtils.isBTCNetwork(networkId)) {
      return emptyResult;
    }

    const dbAccount = (await this.backgroundApi.serviceAccount.getDBAccount({
      accountId,
    })) as IDBUtxoAccount | undefined;

    if (!dbAccount) {
      return emptyResult;
    }

    const xpubSegwit = dbAccount.xpubSegwit ?? dbAccount.xpub;
    if (!xpubSegwit) {
      return emptyResult;
    }

    const freshAddresses =
      await this.backgroundApi.simpleDb.btcFreshAddress.getBTCFreshAddresses({
        networkId,
        xpubSegwit,
      });

    const usedAddresses = freshAddresses?.fresh?.used ?? [];

    const total = usedAddresses.length;
    if (!total) {
      return emptyResult;
    }

    const start = (Math.max(1, page) - 1) * pageSize;
    const paged = usedAddresses.slice(start, start + pageSize).map((item) => ({
      ...item,
      address: item.address ?? item.name,
    }));

    if (!paged.length) {
      return { total, items: [] };
    }

    const deriveCandidates = paged.filter(
      (item) => item.path && (!item.isDerivedByApp || !item.address),
    );

    const updatedPaths = new Set<string>();

    if (deriveCandidates.length > 0) {
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

      paged.forEach((item, index) => {
        const path = item.path;
        if (!path) {
          return;
        }
        const derived = derivedMap[path];
        if (!derived) {
          return;
        }

        if (!item.isDerivedByApp || item.address !== derived) {
          updatedPaths.add(path);
        }

        paged[index] = {
          ...item,
          address: derived,
          isDerivedByApp: true,
        };
      });

      if (freshAddresses && updatedPaths.size > 0) {
        const freshGroup = freshAddresses.fresh ?? { used: [], unused: [] };
        const originUsed = freshGroup.used ?? [];
        const updatedFreshUsed = originUsed.map((item) => {
          if (!item.path || !updatedPaths.has(item.path)) {
            return item;
          }
          const derived = derivedMap[item.path];
          if (!derived) {
            return item;
          }
          return {
            ...item,
            address: derived,
            isDerivedByApp: true,
          };
        });

        await this.backgroundApi.simpleDb.btcFreshAddress.updateBTCFreshAddresses(
          {
            networkId,
            xpubSegwit,
            value: {
              ...freshAddresses,
              fresh: {
                ...freshGroup,
                used: updatedFreshUsed,
              },
            },
          },
        );
      }
    }

    return {
      total,
      items: paged,
    };
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
      if (
        metadata &&
        metadata.lastUsedAccountName &&
        metadata.lastUsedAccountId &&
        metadata.lastUsedWalletName
      ) {
        return [
          {
            accountName: metadata.lastUsedAccountName,
            accountId: metadata.lastUsedAccountId,
            walletName: metadata.lastUsedWalletName,
          },
        ];
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
}

export default ServiceFreshAddress;
