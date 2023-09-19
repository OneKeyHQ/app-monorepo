// TODO move to core
import { hexZeroPad, splitSignature } from '@ethersproject/bytes';
import { keccak256 } from '@ethersproject/keccak256';
import { serialize } from '@ethersproject/transactions';
import BigNumber from 'bignumber.js';
import * as ethUtil from 'ethereumjs-util';
import { isString } from 'lodash';

import { slicePathTemplate } from '@onekeyhq/engine/src/managers/derivation';
import type { ICurveName } from '@onekeyhq/engine/src/secret';
import {
  batchGetPrivateKeys,
  batchGetPublicKeys,
  uncompressPublicKey,
} from '@onekeyhq/engine/src/secret';
import { secp256k1 } from '@onekeyhq/engine/src/secret/curves';
import type {
  EMessageTypesEth,
  IUnsignedMessageEth,
} from '@onekeyhq/engine/src/types/message';
import type { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import type { ISignedTxPro } from '@onekeyhq/engine/src/vaults/types';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { toBigIntHex } from '@onekeyhq/shared/src/utils/numberUtils';

import { CoreChainApiBase } from '../../base/CoreChainApiBase';

import { hashMessage } from './message';

import type {
  ICoreApiGetAddressItem,
  ICoreApiGetAddressQueryImported,
  ICoreApiGetAddressQueryPublicKey,
  ICoreApiGetAddressesQueryHd,
  ICoreApiGetAddressesResult,
  ICoreApiGetPrivateKeysMapQuery,
  ICoreApiPrivateKeysMap,
  ICoreApiSignBasePayload,
  ICoreApiSignMsgPayload,
  ICoreApiSignTxPayload,
  ICoreHdCredential,
  ICoreImportedCredential,
} from '../../types';
import type { UnsignedTransaction } from '@ethersproject/transactions';

const curveName: ICurveName = 'secp256k1';

export default abstract class CoreChainEvmSoftware extends CoreChainApiBase {
  private packTransaction(encodedTx: IEncodedTxEvm): UnsignedTransaction {
    const baseTx: UnsignedTransaction = {
      // undefined is for deploy contract calls.
      to: encodedTx.to || undefined,

      // some RPC do not accept nonce as number
      nonce: toBigIntHex(
        new BigNumber(checkIsDefined(encodedTx.nonce)),
      ) as unknown as number,

      gasLimit: toBigIntHex(
        new BigNumber(checkIsDefined(encodedTx.gasLimit ?? encodedTx.gas)),
      ),

      data: encodedTx?.data || '0x',
      value: encodedTx?.value || '0x0',

      // update chainId at: buildUnsignedTxFromEncodedTx
      chainId: checkIsDefined(encodedTx.chainId),
    };

    if (!baseTx.to) {
      console.error('may be EVM contract deploy, always set value to 0');
      baseTx.value = '0x0';
    }

    const isEIP1559 =
      encodedTx?.maxFeePerGas || encodedTx?.maxPriorityFeePerGas;

    if (isEIP1559) {
      Object.assign(baseTx, {
        type: 2,
        maxFeePerGas: toBigIntHex(
          new BigNumber(checkIsDefined(encodedTx?.maxFeePerGas)),
        ),
        maxPriorityFeePerGas: toBigIntHex(
          new BigNumber(checkIsDefined(encodedTx?.maxPriorityFeePerGas)),
        ),
      });
    } else {
      Object.assign(baseTx, {
        gasPrice: toBigIntHex(
          new BigNumber(checkIsDefined(encodedTx.gasPrice)),
        ),
      });
    }

    return baseTx;
  }

  private async getPublicFromPrivate({
    privateKeyRaw,
  }: {
    privateKeyRaw: string;
  }): Promise<{ publicKey: string }> {
    const privateKey = bufferUtils.toBuffer(privateKeyRaw);
    if (privateKey.length !== 32) {
      throw new OneKeyInternalError('Invalid private key.');
    }
    const publicKey = secp256k1.publicFromPrivate(privateKey).toString('hex');
    return Promise.resolve({ publicKey });
  }

  override async getAddressFromPublic(
    query: ICoreApiGetAddressQueryPublicKey,
  ): Promise<ICoreApiGetAddressItem> {
    const { publicKey } = query;
    const compressedPublicKey = bufferUtils.toBuffer(publicKey);
    const uncompressedPublicKey = uncompressPublicKey(
      curveName,
      compressedPublicKey,
    );
    const address = `0x${keccak256(uncompressedPublicKey.slice(-64)).slice(
      -40,
    )}`;
    return Promise.resolve({ address, publicKey });
  }

  private getSignerEvm({
    privateKey,
    password,
  }: {
    privateKey: string; // encryptedPrivateKey by password
    password: string;
  }) {
    return this.baseGetChainSigner({
      curve: curveName,
      privateKey,
      password,
    });
  }

  override async signMessage(payload: ICoreApiSignMsgPayload): Promise<string> {
    const unsignedMsg = payload.unsignedMsg as IUnsignedMessageEth;
    const signer = await this.baseGetSingleSigner({
      payload,
      curve: curveName,
    });

    let finalMessage: any = unsignedMsg.message;

    if (isString(unsignedMsg.message)) {
      // Special temporary fix for attribute name error on SpaceSwap
      // https://onekeyhq.atlassian.net/browse/OK-18748
      try {
        const finalMessageParsed: {
          message: { value1?: string; value?: string };
        } = JSON.parse(unsignedMsg.message);
        if (
          finalMessageParsed?.message?.value1 !== undefined &&
          finalMessageParsed?.message?.value === undefined &&
          finalMessageParsed?.message
        ) {
          finalMessageParsed.message.value =
            finalMessageParsed?.message?.value1;
          finalMessage = JSON.stringify(finalMessageParsed);
        } else {
          finalMessage = unsignedMsg.message;
        }
      } catch (e) {
        finalMessage = unsignedMsg.message;
      }
    }

    const messageHash = hashMessage({
      messageType: unsignedMsg.type,
      message: finalMessage,
    });

    const [sig, recId] = await signer.sign(ethUtil.toBuffer(messageHash));
    const result = ethUtil.addHexPrefix(
      Buffer.concat([sig, Buffer.from([recId + 27])]).toString('hex'),
    );
    return result;
  }

  override getPrivateKeys(
    payload: ICoreApiSignBasePayload,
  ): Promise<ICoreApiPrivateKeysMap> {
    return this.baseGetPrivateKeys({
      payload,
      curve: curveName,
    });
  }

  override async signTransaction(
    payload: ICoreApiSignTxPayload,
  ): Promise<ISignedTxPro> {
    const { unsignedTx } = payload;
    const signer = await this.baseGetSingleSigner({
      payload,
      curve: curveName,
    });

    const tx = this.packTransaction(unsignedTx.encodedTx as IEncodedTxEvm);
    const digest = keccak256(serialize(tx));
    const [sig, recoveryParam] = await signer.sign(
      Buffer.from(digest.slice(2), 'hex'),
    );
    const [r, s]: [Buffer, Buffer] = [sig.slice(0, 32), sig.slice(32)];
    const signature = splitSignature({
      recoveryParam,
      r: hexZeroPad(`0x${r.toString('hex')}`, 32),
      s: hexZeroPad(`0x${s.toString('hex')}`, 32),
    });

    const rawTx: string = serialize(tx, signature);
    const txid: string = keccak256(rawTx);
    return { txid, rawTx };
  }

  override async getAddressFromPrivate(
    query: ICoreApiGetAddressQueryImported,
  ): Promise<ICoreApiGetAddressItem> {
    const { privateKeyRaw } = query;
    const { publicKey } = await this.getPublicFromPrivate({ privateKeyRaw });
    const { address } = await this.getAddressFromPublic({
      publicKey,
      networkInfo: query.networkInfo,
    });
    return {
      address,
      publicKey,
    };
  }

  override async getAddressesFromHd(
    query: ICoreApiGetAddressesQueryHd,
  ): Promise<ICoreApiGetAddressesResult> {
    return this.baseGetAddressesFromHd(query, {
      curve: curveName,
    });
  }
}
