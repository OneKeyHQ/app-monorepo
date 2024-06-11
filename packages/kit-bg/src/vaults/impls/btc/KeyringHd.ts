import bs58check from 'bs58check';

import {
  checkBtcAddressIsUsed,
  getBtcForkNetwork,
} from '@onekeyhq/core/src/chains/btc/sdkBtc';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { buildPsbt } from '@onekeyhq/core/src/chains/btc/sdkBtc/providerUtils';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import { type ISignedTxPro } from '@onekeyhq/core/src/types';

import { KeyringHdBase } from '../../base/KeyringHdBase';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type VaultBtc from './Vault';
import type { IDBAccount, IDBUtxoAccount } from '../../../dbs/local/types';
import type {
  IExportAccountSecretKeysParams,
  IExportAccountSecretKeysResult,
  IGetPrivateKeysParams,
  IGetPrivateKeysResult,
  IPrepareHdAccountsParams,
  ISignMessageParams,
  ISignTransactionParams,
} from '../../types';

export class KeyringHd extends KeyringHdBase {
  override coreApi = coreChainApi.btc.hd;

  override async getPrivateKeys(
    params: IGetPrivateKeysParams,
  ): Promise<IGetPrivateKeysResult> {
    return this.baseGetPrivateKeys(params);
  }

  override async exportAccountSecretKeys(
    params: IExportAccountSecretKeysParams,
  ): Promise<IExportAccountSecretKeysResult> {
    return this.baseExportAccountSecretKeys(params);
  }

  override async prepareAccounts(
    params: IPrepareHdAccountsParams,
  ): Promise<IDBAccount[]> {
    const sdkBtc = await import('@onekeyhq/core/src/chains/btc/sdkBtc');
    sdkBtc.initBitcoinEcc();

    return this.basePrepareAccountsHdUtxo(params, {
      checkIsAccountUsed: checkBtcAddressIsUsed,
    });
  }

  override async signTransaction(
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    // const { password, unsignedTx } = params;
    // const vault = this.vault as VaultBtc;
    // const networkInfo = await this.getCoreApiNetworkInfo();
    // const { account, btcExtraInfo } = await vault.prepareBtcSignExtraInfo({
    //   unsignedTx,
    // });
    // const credentials = await this.baseGetCredentialsInfo(params);

    // // TODO remove
    // void buildPsbt({
    //   network: getBtcForkNetwork(networkInfo.networkChainCode),
    //   unsignedTx,
    //   btcExtraInfo,
    //   getPubKey: () => Promise.resolve(Buffer.from('')),
    // });
    return this.baseSignTransactionBtc(params);
  }

  override async signMessage(params: ISignMessageParams): Promise<string[]> {
    return this.baseSignMessageBtc(params);
  }
}
