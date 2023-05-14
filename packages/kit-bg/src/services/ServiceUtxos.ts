import BigNumber from 'bignumber.js';
import memoizee from 'memoizee';

import { getUtxoId } from '@onekeyhq/engine/src/dbs/simple/entity/SimpleDbEntityUtxoAccounts';
import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import type { DBUTXOAccount } from '@onekeyhq/engine/src/types/account';
import type { ICoinControlListItem } from '@onekeyhq/engine/src/types/utxoAccounts';
import type VaultBtcFork from '@onekeyhq/engine/src/vaults/utils/btcForkChain/VaultBtcFork';
import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';

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
  getUtxos(
    networkId: string,
    accountId: string,
    sortBy: ISortType,
  ): Promise<{
    utxos: ICoinControlListItem[];
    utxosWithoutDust: ICoinControlListItem[];
    utxosDust: ICoinControlListItem[];
    frozenUtxos: ICoinControlListItem[];
  }> {
    return this._getUtxos(networkId, accountId, sortBy);
  }

  _getUtxos = memoizee(
    async (
      networkId: string,
      accountId: string,
      sortBy: ISortType = 'balance',
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

      let utxos = (await vault.collectUTXOs()) as ICoinControlListItem[];

      const archivedUtxos = await simpleDb.utxoAccounts.getCoinControlList(
        networkId,
        dbAccount.xpub,
      );

      let compareFunction: ICompareFn = compareByBalanceOrHeight('value');
      if (sortBy === 'height') {
        compareFunction = compareByBalanceOrHeight('height');
      } else if (sortBy === 'address') {
        compareFunction = compareByAddress;
      } else if (sortBy === 'label') {
        compareFunction = compareByLabel;
      }

      utxos = utxos
        .map((utxo) => {
          const archivedUtxo = archivedUtxos.find(
            (item) => item.id === getUtxoId(networkId, utxo),
          );
          if (archivedUtxo) {
            return {
              ...utxo,
              label: archivedUtxo.label,
              frozen: archivedUtxo.frozen,
            };
          }
          return utxo;
        })
        .sort(compareFunction);

      const dataSourceWithoutDust = utxos.filter(
        (utxo) => new BigNumber(utxo.value).isGreaterThan(dust) && !utxo.frozen,
      );
      const dustData = utxos.filter(
        (utxo) =>
          new BigNumber(utxo.value).isLessThanOrEqualTo(dust) && !utxo.frozen,
      );
      const frozenUtxos = utxos.filter((utxo) => utxo.frozen);
      const result = {
        utxos,
        utxosWithoutDust: dataSourceWithoutDust,
        utxosDust: dustData,
        frozenUtxos,
      };
      return result;
    },
    {
      promise: true,
      maxAge: getTimeDurationMs({ seconds: 1 }),
    },
  );

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
      normalizer: (...args) => JSON.stringify(args),
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
        { label, frozen: false },
      );
    }

    return simpleDb.utxoAccounts.updateCoinControlItem(id, {
      label,
      frozen: existUtxo.frozen,
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
    if (!existUtxo) {
      return simpleDb.utxoAccounts.addCoinControlItem(
        networkId,
        utxo,
        dbAccount.xpub,
        { label: '', frozen },
      );
    }

    return simpleDb.utxoAccounts.updateCoinControlItem(id, {
      label: existUtxo.label,
      frozen,
    });
  }
}
