import { bufferToU8a, u8aConcat, u8aToU8a, u8aWrapBytes } from '@polkadot/util';
import { hdLedger } from '@polkadot/util-crypto';
import { merge } from 'lodash';

import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';

import { CoreChainApiBase } from '../../base/CoreChainApiBase';
import { encrypt, mnemonicFromEntropy } from '../../secret';
import { slicePathTemplate } from '../../utils';

import { DOT_TYPE_PREFIX } from './types';

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

async function serializeMessage(message: string): Promise<Buffer> {
  const encoded = u8aWrapBytes(message);
  return Buffer.from(u8aToU8a(encoded));
}

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
      // TODO handle relPaths privateKey here
      // const { relPaths } = account;
      privateKeys[account.path] = credentials.imported;
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
    // throw new Error('Method not implemented.');
    const { unsignedTx } = payload;
    const signer = await this.baseGetSingleSigner({
      payload,
      curve,
    });
    const txBytes = bufferUtils.toBuffer(
      checkIsDefined(unsignedTx.rawTxUnsigned),
    );
    const [signature] = await signer.sign(txBytes);
    const txSignature = u8aConcat(
      DOT_TYPE_PREFIX.ed25519,
      bufferToU8a(signature),
    );
    const txid = '';
    const rawTx = ''; // build rawTx on high level which requires network
    return {
      encodedTx: unsignedTx.encodedTx,
      txid,
      rawTx,
      signature: hexUtils.addHexPrefix(bufferUtils.bytesToHex(txSignature)),
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
    // throw new Error('Method not implemented.');
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
    // throw new Error('Method not implemented.');
    const { publicKey } = query;
    return Promise.resolve({
      address: '',
      addresses: {},
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
