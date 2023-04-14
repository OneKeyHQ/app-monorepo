import BigNumber from 'bignumber.js';

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
    const network = await this.backgroundApi.engine.getNetwork(networkId);
    const dust = new BigNumber(vault.settings.minTransferAmount || 0).shiftedBy(
      network.decimals,
    );
    const utxos = await (vault as VaultBtcFork).collectUTXOs();
    const dataSourceWithoutDust = utxos.filter((utxo) =>
      new BigNumber(utxo.value).isGreaterThan(dust),
    );
    const dustData = utxos.filter((utxo) =>
      new BigNumber(utxo.value).isLessThanOrEqualTo(dust),
    );
    const result = {
      utxos,
      utxosWithoutDust: dataSourceWithoutDust,
      utxosDust: dustData,
    };
    console.log('result: =====>>> ', result);
    return result;
  }
}
