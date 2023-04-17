import BigNumber from 'bignumber.js';

import { getUtxoId } from '@onekeyhq/engine/src/dbs/simple/entity/SimpleDbEntityUtxoAccounts';
import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import type { DBUTXOAccount } from '@onekeyhq/engine/src/types/account';
import type { ICoinControlListItem } from '@onekeyhq/engine/src/types/utxoAccounts';
import type VaultBtcFork from '@onekeyhq/engine/src/vaults/utils/btcForkChain/VaultBtcFork';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';

import ServiceBase from './ServiceBase';

@backgroundClass()
export default class ServiceUtxos extends ServiceBase {
  @backgroundMethod()
  async getUtxos(networkId: string, accountId: string) {
    const vault = await this.backgroundApi.engine.getVault({
      networkId,
      accountId,
    });
    const [dbAccount, network] = await Promise.all([
      vault.getDbAccount() as unknown as DBUTXOAccount,
      this.backgroundApi.engine.getNetwork(networkId),
    ]);
    const dust = new BigNumber(vault.settings.minTransferAmount || 0).shiftedBy(
      network.decimals,
    );

    let utxos = (await (
      vault as VaultBtcFork
    ).collectUTXOs()) as ICoinControlListItem[];

    const archivedUtxos = await simpleDb.utxoAccounts.getCoinControlList(
      networkId,
      dbAccount.xpub,
    );
    utxos = utxos.map((utxo) => {
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
    });
    const dataSourceWithoutDust = utxos.filter((utxo) =>
      new BigNumber(utxo.value).isGreaterThan(dust),
    );
    const dustData = utxos.filter((utxo) =>
      new BigNumber(utxo.value).isLessThanOrEqualTo(dust),
    );
    const frozenUtxos = utxos.filter((utxo) => utxo.frozen);
    const result = {
      utxos,
      utxosWithoutDust: dataSourceWithoutDust,
      utxosDust: dustData,
      frozenUtxos,
    };
    return result;
  }

  @backgroundMethod()
  async getUtxosBlockTime(
    networkId: string,
    accountId: string,
    utxos: ICoinControlListItem[],
  ) {
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
  }
}
