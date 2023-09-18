// TODO move to core
import { hexZeroPad, splitSignature } from '@ethersproject/bytes';
import { keccak256 } from '@ethersproject/keccak256';
import { serialize } from '@ethersproject/transactions';
import BigNumber from 'bignumber.js';
import * as ethUtil from 'ethereumjs-util';
import { isString } from 'lodash';

import { slicePathTemplate } from '@onekeyhq/engine/src/managers/derivation';
import type { CurveName } from '@onekeyhq/engine/src/secret';
import {
  batchGetPrivateKeys,
  batchGetPublicKeys,
  uncompressPublicKey,
} from '@onekeyhq/engine/src/secret';
import { secp256k1 } from '@onekeyhq/engine/src/secret/curves';
import type { EMessageTypesEth } from '@onekeyhq/engine/src/types/message';
import type { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import type { ISignedTxPro } from '@onekeyhq/engine/src/vaults/types';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { toBigIntHex } from '@onekeyhq/shared/src/utils/numberUtils';

import { CoreChainApiBase } from '../_base/CoreChainApiBase';

import { hashMessage } from './message';

import type {
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
    if (privateKeyRaw.length !== 64) {
      throw new OneKeyInternalError('Invalid EVM private key.');
    }
    const publicKey = secp256k1
      .publicFromPrivate(bufferUtils.toBuffer(privateKeyRaw))
      .toString('hex');
    return Promise.resolve({ publicKey });
  }

  private async getAddressFromPublic({
    publicKey,
  }: {
    publicKey: string;
  }): Promise<{ address: string }> {
    const compressedPublicKey = bufferUtils.toBuffer(publicKey);
    const uncompressedPublicKey = uncompressPublicKey(
      'secp256k1',
      compressedPublicKey,
    );
    const address = `0x${keccak256(uncompressedPublicKey.slice(-64)).slice(
      -40,
    )}`;
    return Promise.resolve({ address });
  }

  private getSignerEvm({
    privateKey,
    password,
  }: {
    privateKey: string; // encryptedPrivateKey by password
    password: string;
  }) {
    return this.baseGetChainSigner({
      curve: 'secp256k1',
      privateKey,
      password,
    });
  }

  override async signMessage(payload: ICoreApiSignMsgPayload): Promise<string> {
    const { unsignedMsg, account, password } = payload;
    const privateKeys = await this.baseGetPrivateKeys({
      payload,
      curve: 'secp256k1',
    });
    const privateKey = privateKeys[account.path];
    const signer = await this.getSignerEvm({ password, privateKey });

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
      messageType: unsignedMsg.type as EMessageTypesEth,
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
      curve: 'secp256k1',
    });
  }

  override async signTransaction(
    payload: ICoreApiSignTxPayload,
  ): Promise<ISignedTxPro> {
    const { unsignedTx, account, password } = payload;
    const privateKeys = await this.getPrivateKeys(payload);
    const privateKey = privateKeys[account.path];
    const signer = await this.getSignerEvm({ password, privateKey });

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
    const txid = keccak256(rawTx);
    return { txid, rawTx };
  }

  override async getAddressFromPrivate({
    privateKeyRaw,
  }: {
    privateKeyRaw: string;
  }): Promise<{
    publicKey: string;
    address: string;
  }> {
    const { publicKey } = await this.getPublicFromPrivate({ privateKeyRaw });
    const { address } = await this.getAddressFromPublic({ publicKey });
    return {
      address,
      publicKey,
    };
  }

  override async getAddressesFromHd({
    template,
    hdCredential,
    password,
    indexes,
  }: ICoreApiGetAddressesQueryHd): Promise<ICoreApiGetAddressesResult> {
    const { seed } = hdCredential;
    const { pathPrefix, pathSuffix } = slicePathTemplate(template);
    const seedBuffer = bufferUtils.toBuffer(seed);
    const pubkeyInfos = batchGetPublicKeys(
      'secp256k1',
      seedBuffer,
      password,
      pathPrefix,
      indexes.map((index) => pathSuffix.replace('{index}', index.toString())),
    );

    if (pubkeyInfos.length !== indexes.length) {
      throw new OneKeyInternalError('Unable to get publick key.');
    }
    const addresses = await Promise.all(
      pubkeyInfos.map(async (info) => {
        const {
          path,
          extendedKey: { key: pubkey },
        } = info;
        const publicKey = pubkey.toString('hex');

        const { address } = await this.getAddressFromPublic({ publicKey });

        return { address, publicKey, path };
      }),
    );
    return { addresses };
  }
}
