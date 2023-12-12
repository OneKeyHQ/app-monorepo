import BigNumber from 'bignumber.js';
import { isNil } from 'lodash';

import { EthersJsonRpcProvider } from '@onekeyhq/core/src/chains/evm/sdkEvm/ethers';
import type { IEncodedTxEvm } from '@onekeyhq/core/src/chains/evm/types';
import type { ISignedTxPro, IUnsignedTxPro } from '@onekeyhq/core/src/types';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import chainValueUtils from '@onekeyhq/shared/src/utils/chainValueUtils';
import numberUtils from '@onekeyhq/shared/src/utils/numberUtils';

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
  ITxUpdateFeeInfo,
  IVaultSettings,
} from '../../types';

export default class Vault extends VaultBase {
  override settings: IVaultSettings = settings;

  override async buildEncodedTx(options: {
    transferInfo?: ITransferInfo | undefined;
  }): Promise<IEncodedTxEvm> {
    const { transferInfo } = options;
    if (transferInfo) {
      return this._buildEncodedTxFromTransfer(transferInfo);
    }
    throw new OneKeyInternalError();
  }

  override async buildUnsignedTx(options: {
    encodedTx: IEncodedTxEvm;
  }): Promise<IUnsignedTxPro> {
    const { encodedTx } = options;
    if (encodedTx) {
      return this._buildUnsignedTxFromEncodedTx(encodedTx);
    }
    throw new OneKeyInternalError();
  }

  override async updateUnsignedTx(options: {
    unsignedTx: IUnsignedTxPro;
    feeInfo?: ITxUpdateFeeInfo | undefined;
  }): Promise<IUnsignedTxPro> {
    const { unsignedTx, feeInfo } = options;
    if (feeInfo) {
      const encodedTxNew = await this._attachFeeInfoToEncodedTx({
        encodedTx: unsignedTx.encodedTx as IEncodedTxEvm,
        feeInfo,
      });
      unsignedTx.encodedTx = encodedTxNew;
      return unsignedTx;
    }

    throw new OneKeyInternalError();
  }

  override keyringMap: Record<IDBWalletType, typeof KeyringBase> = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringWatching,
  };

  async _buildEncodedTxFromTransfer(
    transferInfo: ITransferInfo,
  ): Promise<IEncodedTxEvm> {
    const network = await this.getNetwork();
    return {
      from: transferInfo.from,
      to: transferInfo.to,
      value: numberUtils.numberToHex(
        chainValueUtils.convertAmountToChainValue({
          network,
          value: transferInfo.amount,
        }),
      ),
      data: '0x',
    };
  }

  async _attachFeeInfoToEncodedTx(params: {
    encodedTx: IEncodedTxEvm;
    feeInfo: ITxUpdateFeeInfo;
  }): Promise<IEncodedTxEvm> {
    const { encodedTx, feeInfo } = params;
    const gasInfo = feeInfo.gasEIP1559 ?? feeInfo.gas;
    const tx = {
      ...encodedTx,
      ...gasInfo,
    };
    if (!isNil(feeInfo?.gas?.gasLimit)) {
      tx.gas = feeInfo?.gas?.gasLimit;
    }
    return Promise.resolve(tx);
  }

  async _buildUnsignedTxFromEncodedTx(
    encodedTx: IEncodedTxEvm,
  ): Promise<IUnsignedTxPro> {
    const tx = {
      ...encodedTx,
    };
    const client = await this.getEthersClient();
    const chainIdHex = await this.getNetworkChainId({ hex: true });
    const chainIdNum = new BigNumber(chainIdHex).toNumber();
    const nonce = await client.getTransactionCount(tx.from);

    tx.nonce = numberUtils.numberToHex(nonce);
    tx.chainId = chainIdNum;
    return Promise.resolve({
      encodedTx: tx,
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
