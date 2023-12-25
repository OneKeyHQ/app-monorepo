import { getAddress } from '@ethersproject/address';
import { isEmpty } from 'lodash';

import type { IEncodedTxBtc } from '@onekeyhq/core/src/chains/btc/types';
import { EthersJsonRpcProvider } from '@onekeyhq/core/src/chains/evm/sdkEvm/ethers';
import type { ISignedTxPro, IUnsignedTxPro } from '@onekeyhq/core/src/types';
import {
  NotImplemented,
  OneKeyInternalError,
} from '@onekeyhq/shared/src/errors';
import type { IFeeInfoUnit } from '@onekeyhq/shared/types/gas';

import { VaultBase } from '../../base/VaultBase';

import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import settings from './settings';

import type { IDBWalletType } from '../../../dbs/local/types';
import type { KeyringBase } from '../../base/KeyringBase';
import type {
  IBroadcastTransactionParams,
  ITransferInfo,
  IVaultSettings,
} from '../../types';

// btc vault
export default class Vault extends VaultBase {
  override settings: IVaultSettings = settings;

  override async buildEncodedTx(options: {
    transfersInfo: ITransferInfo[] | undefined;
  }): Promise<IEncodedTxBtc> {
    const { transfersInfo } = options;
    if (transfersInfo && !isEmpty(transfersInfo)) {
      return this._buildEncodedTxFromTransfer(transfersInfo);
    }
    throw new OneKeyInternalError();
  }

  override async buildUnsignedTx(options: {
    transfersInfo: ITransferInfo[] | undefined;
  }): Promise<IUnsignedTxPro> {
    const { transfersInfo } = options;
    const encodedTx = await this.buildEncodedTx({ transfersInfo });
    if (encodedTx) {
      return this._buildUnsignedTxFromEncodedTx(encodedTx);
    }
    throw new OneKeyInternalError();
  }

  override async updateUnsignedTx(options: {
    unsignedTx: IUnsignedTxPro;
    feeInfo?: IFeeInfoUnit | undefined;
  }): Promise<IUnsignedTxPro> {
    const { unsignedTx, feeInfo } = options;
    if (feeInfo) {
      unsignedTx.feeInfo = feeInfo;
      return unsignedTx;
    }

    throw new OneKeyInternalError();
  }

  override async validateAddress(address: string) {
    let isValid = false;
    let checksumAddress = '';

    try {
      checksumAddress = getAddress(address);
      isValid = checksumAddress.length === 42;
    } catch {
      return Promise.resolve({
        isValid: false,
      });
    }

    return Promise.resolve({
      normalizedAddress: checksumAddress.toLowerCase() || undefined,
      displayAddress: checksumAddress || undefined,
      isValid,
    });
  }

  override keyringMap: Record<IDBWalletType, typeof KeyringBase> = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringWatching,
  };

  async _buildEncodedTxFromTransfer(
    transfersInfo: ITransferInfo[],
  ): Promise<IEncodedTxBtc> {
    const network = await this.getNetwork();
    if (transfersInfo.length === 1) {
      const transferInfo = transfersInfo[0];
      return {
        inputs: [],
        outputs: [],
      };
    }
    return this._buildEncodedTxFromBatchTransfer(transfersInfo);
  }

  async _buildEncodedTxFromBatchTransfer(
    transfersInfo: ITransferInfo[],
  ): Promise<IEncodedTxBtc> {
    throw new NotImplemented();
  }

  async _buildUnsignedTxFromEncodedTx(
    encodedTx: IEncodedTxBtc,
  ): Promise<IUnsignedTxPro> {
    return Promise.resolve({
      encodedTx,
      feeInfo: undefined,
    });
  }

  // TODO memo cache
  async getEthersClient() {
    const rpcUrl = await this.getRpcUrl();
    const client = new EthersJsonRpcProvider(rpcUrl);
    return client;
  }

  override async broadcastTransaction(
    params: IBroadcastTransactionParams,
  ): Promise<ISignedTxPro> {
    const { signedTx } = params;
    const client = await this.getEthersClient();
    const result = await client.sendTransaction(signedTx.rawTx);
    console.log('evm broadcastTransaction result: ', result);
    return {
      encodedTx: signedTx.encodedTx,
      txid: signedTx.txid,
      rawTx: signedTx.rawTx,
    };
  }
}
