import BigNumber from 'bignumber.js';

import { getUtxoId } from '@onekeyhq/engine/src/dbs/simple/entity/SimpleDbEntityUtxoAccounts';
import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import { getLocalNFTs } from '@onekeyhq/engine/src/managers/nft';
import type { DBUTXOAccount } from '@onekeyhq/engine/src/types/account';
import type { NFTBTCAssetModel } from '@onekeyhq/engine/src/types/nft';
import type { ICoinControlListItem } from '@onekeyhq/engine/src/types/utxoAccounts';
import type { ICollectUTXOsOptions } from '@onekeyhq/engine/src/vaults/utils/btcForkChain/types';
import {
  getTaprootXpub,
  isTaprootXpubSegwit,
} from '@onekeyhq/engine/src/vaults/utils/btcForkChain/utils';
import type VaultBtcFork from '@onekeyhq/engine/src/vaults/utils/btcForkChain/VaultBtcFork';
import { getShouldHideInscriptions } from '@onekeyhq/kit/src/hooks/crossHooks/useShouldHideInscriptions';
import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { isBTCNetwork } from '@onekeyhq/shared/src/engine/engineConsts';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import ServiceBase from './ServiceBase';

type ICompareFn = (a: ICoinControlListItem, b: ICoinControlListItem) => number;
type ISortType = 'balance' | 'height' | 'address' | 'label';

function compareByAddress(
  a: ICoinControlListItem,
  b: ICoinControlListItem,
): number {
  if (a.address < b.address) {
    return -1;
  }
  if (a.address > b.address) {
    return 1;
  }
  return 0;
}

// convert function to curry function
function compareByBalanceOrHeight(field: 'value' | 'height') {
  return function (a: ICoinControlListItem, b: ICoinControlListItem) {
    const aBN = new BigNumber(a[field]);
    const bBN = new BigNumber(b[field]);
    if (aBN.isGreaterThan(bBN)) {
      return -1;
    }
    if (aBN.isLessThan(bBN)) {
      return 1;
    }
    return 0;
  };
}

function compareByLabel(
  a: ICoinControlListItem,
  b: ICoinControlListItem,
): number {
  if (a.label && b.label) {
    if (a.label < b.label) {
      return -1;
    }
    if (a.label > b.label) {
      return 1;
    }
    return 0;
  }
  if (a.label && !b.label) {
    return -1;
  }
  if (!a.label && b.label) {
    return 1;
  }
  return 0;
}

@backgroundClass()
export default class ServiceUtxos extends ServiceBase {
  @backgroundMethod()
  getUtxos({
    networkId,
    accountId,
    sortBy = 'balance',
    options = {},
    useRecycleUtxos = false,
    useCustomAddressesBalance = false,
  }: {
    networkId: string;
    accountId: string;
    sortBy?: ISortType;
    options?: ICollectUTXOsOptions;
    useRecycleUtxos?: boolean;
    useCustomAddressesBalance?: boolean;
  }): Promise<{
    utxos: ICoinControlListItem[];
    utxosWithoutDust: ICoinControlListItem[];
    utxosDust: ICoinControlListItem[];
    frozenUtxos: ICoinControlListItem[];
    frozenUtxosWithoutRecycle: ICoinControlListItem[];
    frozenRecycleUtxos: ICoinControlListItem[];
    recycleUtxos: ICoinControlListItem[];
    recycleUtxosWithoutFrozen: ICoinControlListItem[];
  }> {
    return this._getUtxos(
      networkId,
      accountId,
      sortBy,
      useRecycleUtxos,
      useCustomAddressesBalance,
      {
        checkInscription: !getShouldHideInscriptions({ accountId, networkId }),
        ...options,
      },
    );
  }

  _getUtxos = memoizee(
    async (
      networkId: string,
      accountId: string,
      sortBy: ISortType = 'balance',
      useRecycleUtxos: boolean,
      useCustomAddressesBalance: boolean,
      options: ICollectUTXOsOptions = {},
    ) => {
      const vault = (await this.backgroundApi.engine.getVault({
        networkId,
        accountId,
      })) as VaultBtcFork;
      const [dbAccount, network] = await Promise.all([
        vault.getDbAccount() as unknown as DBUTXOAccount,
        this.backgroundApi.engine.getNetwork(networkId),
      ]);
      const dust = new BigNumber(
        (vault.settings.dust ?? vault.settings.minTransferAmount) || 0,
      ).shiftedBy(network.decimals);

      const shouldHideInscriptions = getShouldHideInscriptions({
        accountId,
        networkId,
      });

      const archivedUtxos = await simpleDb.utxoAccounts.getCoinControlList(
        networkId,
        dbAccount.xpub,
      );

      let collectUTXOsInfoOptions = options;
      if (useRecycleUtxos) {
        collectUTXOsInfoOptions = {
          ...options,
          forceSelectUtxos: archivedUtxos
            .filter((utxo) => utxo.recycle)
            .map((utxo) => {
              const [txId, vout] = utxo.key.split('_');
              return {
                txId,
                vout: parseInt(vout, 10),
                address: dbAccount.address,
              };
            }),
        };
      }
      if (useCustomAddressesBalance) {
        collectUTXOsInfoOptions = {
          ...options,
          customAddressMap: vault.getCustomAddressMap(dbAccount),
        };
      }

      const { utxos: btcUtxos } = await vault.collectUTXOsInfo(
        collectUTXOsInfoOptions,
      );

      let compareFunction: ICompareFn = compareByBalanceOrHeight('value');
      if (sortBy === 'height') {
        compareFunction = compareByBalanceOrHeight('height');
      } else if (sortBy === 'address') {
        compareFunction = compareByAddress;
      } else if (sortBy === 'label') {
        compareFunction = compareByLabel;
      }

      const utxos: ICoinControlListItem[] = btcUtxos
        .filter((utxo) =>
          // only filter unconfirmed utxos for btc network
          isBTCNetwork(networkId)
            ? new BigNumber(utxo?.confirmations ?? 0).isGreaterThan(0)
            : true,
        )
        .map((utxo) => {
          const archivedUtxo = archivedUtxos.find(
            (item) => item.id === getUtxoId(networkId, utxo),
          );
          const coinControlItem: ICoinControlListItem = {
            height: NaN, // TODO height is optional?
            ...utxo,
          };
          if (archivedUtxo) {
            coinControlItem.label = archivedUtxo.label;
            coinControlItem.frozen = archivedUtxo.frozen;
            coinControlItem.recycle = archivedUtxo.recycle;
          }
          return coinControlItem;
        })
        .sort(compareFunction);

      const dataSourceWithoutDust = utxos.filter(
        (utxo) =>
          new BigNumber(utxo.value).isGreaterThan(dust) &&
          !utxo.frozen &&
          (shouldHideInscriptions ? true : !utxo.recycle),
      );
      const dustData = utxos.filter(
        (utxo) =>
          new BigNumber(utxo.value).isLessThanOrEqualTo(dust) &&
          !utxo.frozen &&
          (shouldHideInscriptions ? true : !utxo.recycle),
      );
      const frozenUtxos = utxos.filter((utxo) => utxo.frozen);
      const frozenUtxosWithoutRecycle = utxos.filter(
        (utxo) =>
          utxo.frozen && (shouldHideInscriptions ? true : !utxo.recycle),
      );
      const frozenRecycleUtxos = frozenUtxos.filter(
        (utxo) =>
          (shouldHideInscriptions ? false : utxo.recycle) && utxo.frozen,
      );
      const recycleUtxos = utxos.filter((utxo) =>
        shouldHideInscriptions ? false : utxo.recycle,
      );
      const recycleUtxosWithoutFrozen = utxos.filter(
        (utxo) =>
          (shouldHideInscriptions ? false : utxo.recycle) && !utxo.frozen,
      );

      const result = {
        utxos,
        utxosWithoutDust: dataSourceWithoutDust,
        utxosDust: dustData,
        frozenUtxos,
        frozenUtxosWithoutRecycle,
        frozenRecycleUtxos,
        recycleUtxos,
        recycleUtxosWithoutFrozen,
      };
      return result;
    },
    {
      promise: true,
      maxAge: getTimeDurationMs({ seconds: 1 }),
    },
  );

  @backgroundMethod()
  async getArchivedUtxos(
    networkId: string | undefined,
    xpubs: string[] | undefined,
  ) {
    if (xpubs && xpubs.length) {
      const archivedUtxos = await Promise.all(
        xpubs.map((xpub) =>
          simpleDb.utxoAccounts.getCoinControlList(
            networkId ?? '',
            isTaprootXpubSegwit(xpub ?? '')
              ? getTaprootXpub(xpub ?? '')
              : xpub ?? '',
          ),
        ),
      );
      return archivedUtxos.flat();
    }
    return [];
  }

  @backgroundMethod()
  async getUtxosBlockTime(
    networkId: string,
    accountId: string,
    utxos: ICoinControlListItem[],
  ): Promise<Record<string, number>> {
    return this._getUtxosBlockTime(networkId, accountId, utxos);
  }

  _getUtxosBlockTime = memoizee(
    async (
      networkId: string,
      accountId: string,
      utxos: ICoinControlListItem[],
    ) => {
      const vault = await this.backgroundApi.engine.getVault({
        networkId,
        accountId,
      });
      const minBlockHeight = Math.min(...utxos.map((i) => i.height));
      const maxBlockHeight = Math.max(...utxos.map((i) => i.height));
      // get block times
      const txs = (await (vault as VaultBtcFork).getAccountInfo({
        details: 'txs',
        from: minBlockHeight,
        to: maxBlockHeight,
      })) as {
        transactions: { blockTime: number; blockHeight: number }[];
      };
      const blockTimesMap: Record<string, number> = {};
      txs.transactions.forEach((tx) => {
        if (!blockTimesMap[tx.blockHeight]) {
          blockTimesMap[tx.blockHeight] = tx.blockTime;
        }
      });

      return blockTimesMap;
    },
    {
      promise: true,
      maxAge: getTimeDurationMs({ seconds: 30 }),
    },
  );

  @backgroundMethod()
  async updateLabel(
    networkId: string,
    accountId: string,
    utxo: ICoinControlListItem,
    label: string,
  ) {
    const id = getUtxoId(networkId, utxo);
    const dbAccount = (await this.backgroundApi.engine.dbApi.getAccount(
      accountId,
    )) as DBUTXOAccount;
    const existUtxo = await simpleDb.utxoAccounts.getCoinControlById(id);
    if (!existUtxo) {
      return simpleDb.utxoAccounts.addCoinControlItem(
        networkId,
        utxo,
        dbAccount.xpub,
        { label, frozen: false, recycle: false },
      );
    }

    return simpleDb.utxoAccounts.updateCoinControlItem(id, {
      label,
      frozen: existUtxo.frozen,
      recycle: existUtxo.recycle,
    });
  }

  @backgroundMethod()
  async updateFrozen(
    networkId: string,
    accountId: string,
    utxo: ICoinControlListItem,
    frozen: boolean,
  ) {
    const id = getUtxoId(networkId, utxo);
    const dbAccount = (await this.backgroundApi.engine.dbApi.getAccount(
      accountId,
    )) as DBUTXOAccount;
    const existUtxo = await simpleDb.utxoAccounts.getCoinControlById(id);

    const shouldHideInscriptions = getShouldHideInscriptions({
      accountId,
      networkId,
    });

    let recycle = existUtxo ? existUtxo.recycle : false;

    if (frozen && shouldHideInscriptions) {
      const localNFTs = (await getLocalNFTs({
        accountId,
        networkId,
      })) as NFTBTCAssetModel[];
      if (
        localNFTs.find((item) => {
          const [txid, vout] = item.output.split(':');
          return txid === utxo.txid && vout === String(utxo.vout);
        })
      ) {
        recycle = true;
      }
    }

    if (!existUtxo) {
      return simpleDb.utxoAccounts.addCoinControlItem(
        networkId,
        utxo,
        dbAccount.xpub,
        { label: '', frozen, recycle },
      );
    }

    return simpleDb.utxoAccounts.updateCoinControlItem(id, {
      label: existUtxo.label,
      frozen,
      recycle,
    });
  }

  @backgroundMethod()
  async updateRecycle({
    networkId,
    accountId,
    utxo,
    recycle,
    frozen,
  }: {
    networkId: string;
    accountId: string;
    utxo: ICoinControlListItem;
    recycle: boolean; // mark inscription as recycled status
    frozen?: boolean;
  }) {
    const id = getUtxoId(networkId, utxo);
    const dbAccount = (await this.backgroundApi.engine.dbApi.getAccount(
      accountId,
    )) as DBUTXOAccount;
    const existUtxo = await simpleDb.utxoAccounts.getCoinControlById(id);

    if (!existUtxo) {
      return simpleDb.utxoAccounts.addCoinControlItem(
        networkId,
        utxo,
        dbAccount.xpub,
        { label: '', frozen: false, recycle },
      );
    }

    return simpleDb.utxoAccounts.updateCoinControlItem(id, {
      label: existUtxo.label,
      frozen: frozen ?? existUtxo.frozen,
      recycle,
    });
  }
}
