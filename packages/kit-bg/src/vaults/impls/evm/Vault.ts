import { getAddress } from '@ethersproject/address';
import BigNumber from 'bignumber.js';
import { isEmpty, isNil } from 'lodash';

import { EthersJsonRpcProvider } from '@onekeyhq/core/src/chains/evm/sdkEvm/ethers';
import type { IEncodedTxEvm } from '@onekeyhq/core/src/chains/evm/types';
import type { ISignedTxPro, IUnsignedTxPro } from '@onekeyhq/core/src/types';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import chainValueUtils from '@onekeyhq/shared/src/utils/chainValueUtils';
import { noopObject } from '@onekeyhq/shared/src/utils/miscUtils';
import numberUtils from '@onekeyhq/shared/src/utils/numberUtils';
import type { IFeeInfoUnit } from '@onekeyhq/shared/types/gas';
import { EDecodedTxStatus, type IDecodedTx } from '@onekeyhq/shared/types/tx';

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
  IBuildDecodedTxParams,
  ITransferInfo,
  IVaultSettings,
} from '../../types';

// evm vault
export default class Vault extends VaultBase {
  override settings: IVaultSettings = settings;

  override async buildEncodedTx(options: {
    transfersInfo: ITransferInfo[] | undefined;
  }): Promise<IEncodedTxEvm> {
    const { transfersInfo } = options;
    if (transfersInfo && !isEmpty(transfersInfo)) {
      return this._buildEncodedTxFromTransfer(transfersInfo);
    }
    throw new OneKeyInternalError();
  }

  override async buildDecodedTx(
    params: IBuildDecodedTxParams,
  ): Promise<IDecodedTx> {
    noopObject(params);
    // TODO evm decode tx impl
    return Promise.resolve({
      txid: '',
      owner: '',
      signer: '',
      nonce: 0,
      actions: [],
      networkId: '',
      accountId: '',
      status: EDecodedTxStatus.Pending,
      extraInfo: null,
    });
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
      const encodedTxNew = await this._attachFeeInfoToEncodedTx({
        encodedTx: unsignedTx.encodedTx as IEncodedTxEvm,
        feeInfo,
      });
      unsignedTx.encodedTx = encodedTxNew;
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
  ): Promise<IEncodedTxEvm> {
    const network = await this.getNetwork();
    if (transfersInfo.length === 1) {
      const transferInfo = transfersInfo[0];
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
    return this._buildEncodedTxFromBatchTransfer(transfersInfo);
  }

  async _buildEncodedTxFromBatchTransfer(transfersInfo: ITransferInfo[]) {
    console.log(transfersInfo);
    // TODO EVM batch transfer through contract
    return {
      from: '',
      to: '',
      value: '0',
      data: '0x',
    };
  }

  async _attachFeeInfoToEncodedTx(params: {
    encodedTx: IEncodedTxEvm;
    feeInfo: IFeeInfoUnit;
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
    const chainIdHex = await this.getNetworkChainId({ hex: true });
    const chainIdNum = new BigNumber(chainIdHex).toNumber();

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
