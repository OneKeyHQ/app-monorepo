import { blockchain } from '@ckb-lumos/base';
import { sealTransaction } from '@ckb-lumos/helpers';

import type { IEncodedTxCkb } from '@onekeyhq/core/src/chains/ckb/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type { ISignedTxPro } from '@onekeyhq/core/src/types';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { KeyringHdBase } from '../../base/KeyringHdBase';

import {
  convertTxToTxSkeleton,
  serializeTransactionMessage,
} from './utils/transaction';

import type IVaultCkb from './Vault';
import type { IDBAccount } from '../../../dbs/local/types';
import type {
  IGetPrivateKeysParams,
  IGetPrivateKeysResult,
  IPrepareHdAccountsParams,
  ISignTransactionParams,
} from '../../types';

export class KeyringHd extends KeyringHdBase {
  override coreApi = coreChainApi.ckb.hd;

  override async getPrivateKeys(
    params: IGetPrivateKeysParams,
  ): Promise<IGetPrivateKeysResult> {
    return this.baseGetPrivateKeys(params);
  }

  override async prepareAccounts(
    params: IPrepareHdAccountsParams,
  ): Promise<IDBAccount[]> {
    return this.basePrepareAccountsHd(params);
  }

  override async signTransaction(
    params: ISignTransactionParams,
  ): Promise<ISignedTxPro> {
    const { unsignedTx } = params;
    const encodedTx = unsignedTx.encodedTx as IEncodedTxCkb;

    const client = await (this.vault as IVaultCkb).getClient();

    const txSkeleton = await convertTxToTxSkeleton({
      client,
      transaction: encodedTx.tx,
    });

    const { txSkeleton: txSkeletonWithMessage, message } =
      serializeTransactionMessage(txSkeleton);

    if (!message) {
      throw new OneKeyInternalError('Unable to serialize transaction message.');
    }

    const result = await this.baseSignTransaction({
      ...params,
      unsignedTx: {
        ...params.unsignedTx,
        rawTxUnsigned: message,
      },
    });

    const tx = sealTransaction(txSkeletonWithMessage, [result.rawTx]);
    const signedTx = blockchain.Transaction.pack(tx);

    return {
      ...result,
      rawTx: bufferUtils.bytesToHex(signedTx),
    };
  }

  override async signMessage(): Promise<string[]> {
    throw new Error('Method not implemented.');
  }
}
