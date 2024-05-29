import { bufferToU8a, u8aConcat } from '@polkadot/util';
import { hdLedger, encodeAddress } from '@polkadot/util-crypto';
import { merge } from 'lodash';

import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';

import { CoreChainApiBase } from '../../base/CoreChainApiBase';
import { decryptImportedCredential, encrypt, mnemonicFromEntropy } from '../../secret';
import { slicePathTemplate } from '../../utils';

import { DOT_TYPE_PREFIX, IEncodedTxDot } from './types';

import type {
  ICoreApiGetAddressItem,
  ICoreApiGetAddressQueryImported,
  ICoreApiGetAddressQueryPublicKey,
  ICoreApiGetAddressesQueryHd,
  ICoreApiGetAddressesResult,
  ICoreApiPrivateKeysMap,
  ICoreApiSignBasePayload,
  ICoreApiSignMsgPayload,
  ICoreApiSignTxPayload,
  ICurveName,
  ISignedTxPro,
} from '../../types';
import { serializeMessage, serializeSignedTransaction } from './sdkDot';

const curve: ICurveName = 'ed25519';

const derivationHdLedger = (mnemonic: string, path: string) => {
  try {
    return hdLedger(mnemonic, path);
  } catch (e: any) {
    const { message }: { message: string } = e;
    if (
      message ===
      'Expected a mnemonic with 24 words (or 25 including a password)'
    ) {
      throw new OneKeyInternalError({
        message,
        key: 'msg__error_mnemonics_can_only_be_12_24',
      });
    }
    throw e;
  }
};

export default class CoreChainSoftware extends CoreChainApiBase {
  override async baseGetPrivateKeys({
    payload,
  }: {
    payload: ICoreApiSignBasePayload;
  }): Promise<ICoreApiPrivateKeysMap> {
    const { credentials, account, password } = payload;
    let privateKeys: ICoreApiPrivateKeysMap = {};
    if (credentials.hd) {
      const { relPaths } = account;
      const pathComponents = account.path.split('/');
      const usedRelativePaths = relPaths || [pathComponents.pop() as string];
      const basePath = pathComponents.join('/');
      const mnemonic = mnemonicFromEntropy(credentials.hd, password);
      const keys = usedRelativePaths.map((relPath) => {
        const path = `${basePath}/${relPath}`;

        const keyPair = derivationHdLedger(mnemonic, path);
        return {
          path,
          key: encrypt(password, Buffer.from(keyPair.secretKey.slice(0, 32))),
        };
      });

      privateKeys = keys.reduce(
        (ret, key) => ({ ...ret, [key.path]: bufferUtils.bytesToHex(key.key) }),
        {},
      );
    }
    if (credentials.imported) {
      const { privateKey: p } = decryptImportedCredential({
        password,
        credential: credentials.imported,
      });
      const encryptPrivateKey = bufferUtils.bytesToHex(encrypt(password, p));
      privateKeys[account.path] = encryptPrivateKey;
      privateKeys[''] = encryptPrivateKey;
    }
    if (!Object.keys(privateKeys).length) {
      throw new Error('No private keys found');
    }
    return privateKeys;
  }

  override async getPrivateKeys(
    payload: ICoreApiSignBasePayload,
  ): Promise<ICoreApiPrivateKeysMap> {
    return this.baseGetPrivateKeys({
      payload,
    });
  }
  
  override async signTransaction(
    payload: ICoreApiSignTxPayload,
  ): Promise<ISignedTxPro> {
    const { unsignedTx } = payload;
    const signer = await this.baseGetSingleSigner({
      payload,
      curve,
    });
    if (!unsignedTx.rawTxUnsigned) {
      throw new Error('rawTxUnsigned is undefined');
    }
    const [signature] = await signer.sign(bufferUtils.toBuffer(bufferUtils.hexToBytes(unsignedTx.rawTxUnsigned)));
    const txSignature = u8aConcat(
      DOT_TYPE_PREFIX.ed25519,
      bufferToU8a(signature),
    );
    const txSignatureHex = bufferUtils.bytesToHex(txSignature);
    const txid = '';
    const rawTx = await serializeSignedTransaction(unsignedTx.encodedTx as IEncodedTxDot, txSignatureHex);
    return {
      encodedTx: unsignedTx.encodedTx,
      txid,
      rawTx,
      signature: hexUtils.addHexPrefix(txSignatureHex),
    };
  }

  override async signMessage(payload: ICoreApiSignMsgPayload): Promise<string> {
    const { message } = payload.unsignedMsg;
    const signer = await this.baseGetSingleSigner({
      payload,
      curve,
    });
    const wrapMessage = await serializeMessage(message);
    const [signature] = await signer.sign(wrapMessage);
    const txSignature = u8aConcat(
      DOT_TYPE_PREFIX.ed25519,
      bufferToU8a(signature),
    );
    return hexUtils.addHexPrefix(bufferUtils.bytesToHex(txSignature));
  }

  override async getAddressFromPrivate(
    query: ICoreApiGetAddressQueryImported,
  ): Promise<ICoreApiGetAddressItem> {
    const { privateKeyRaw } = query;
    const privateKey = bufferUtils.toBuffer(privateKeyRaw);
    const pub = this.baseGetCurve(curve).publicFromPrivate(privateKey);
    return this.getAddressFromPublic({
      publicKey: bufferUtils.bytesToHex(pub),
      networkInfo: query.networkInfo,
    });
  }

  override async getAddressFromPublic(
    query: ICoreApiGetAddressQueryPublicKey,
  ): Promise<ICoreApiGetAddressItem> {
    const { publicKey, networkInfo } = query;
    const pubKeyBytes = bufferUtils.hexToBytes(hexUtils.stripHexPrefix(publicKey));
    return Promise.resolve({
      address: '',
      addresses: {
        [networkInfo.networkId]: encodeAddress(pubKeyBytes, +(networkInfo.addressPrefix ?? 0)),
      },
      publicKey,
    });
  }

  override async getAddressesFromHd(
    query: ICoreApiGetAddressesQueryHd,
  ): Promise<ICoreApiGetAddressesResult> {
    const { template, hdCredential, password, indexes } = query;
    const { pathPrefix, pathSuffix } = slicePathTemplate(template);
    const indexFormatted = indexes.map((index) =>
      pathSuffix.replace('{index}', index.toString()),
    );
    const mnemonic = mnemonicFromEntropy(hdCredential, password);

    const publicKeys = indexFormatted.map((index) => {
      const path = `${pathPrefix}/${index}`;
      const keyPair = derivationHdLedger(mnemonic, path);
      return {
        path,
        pubkey: keyPair.publicKey,
      };
    });

    if (publicKeys.length !== indexes.length) {
      throw new OneKeyInternalError('Unable to get public key.');
    }

    const addresses = await Promise.all(
      publicKeys.map(async (info) => {
        const { path, pubkey } = info;
        const publicKey = bufferUtils.bytesToHex(pubkey);

        const result = await this.getAddressFromPublic({
          publicKey,
          networkInfo: query.networkInfo,
        });

        return merge({ publicKey, path }, result);
      }),
    );
    return { addresses };
  }
}
