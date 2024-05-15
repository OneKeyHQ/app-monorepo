import { encoding } from '@starcoin/starcoin';

import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { Verifier } from '../../base/ChainSigner';
import { CoreChainApiBase } from '../../base/CoreChainApiBase';

import type {
  ICoreApiGetAddressItem,
  ICoreApiGetAddressQueryImported,
  ICoreApiGetAddressQueryPublicKey,
  ICoreApiGetAddressesQueryHd,
  ICoreApiGetAddressesResult,
  ICoreApiPrivateKeysMap,
  ICoreApiSignBasePayload,
  ICoreApiSignTxPayload,
  ICurveName,
  ISignedTxPro,
} from '../../types';
import {
  buildSignedTx,
  buildUnsignedRawTx,
  hashRawTx,
} from '@onekeyhq/kit-bg/src/vaults/impls/stc/utils';

const curve: ICurveName = 'ed25519';

const pubkeyToAddress = async (
  pub: string,
  encodingType = 'hex',
): Promise<string> => {
  const verifier = new Verifier(pub, 'ed25519');
  let address = '';
  const pubkeyBytes = await verifier.getPubkey();
  if (encodingType === 'hex') {
    address = encoding.publicKeyToAddress(pubkeyBytes.toString('hex'));
  } else if (encodingType === 'bech32') {
    address = encoding.publicKeyToReceiptIdentifier(
      pubkeyBytes.toString('hex'),
    );
  } else {
    throw new Error('invalid encoding');
  }
  return address;
};

export default class CoreChainSoftware extends CoreChainApiBase {
  override async getPrivateKeys(
    payload: ICoreApiSignBasePayload,
  ): Promise<ICoreApiPrivateKeysMap> {
    // throw new Error('Method not implemented.');
    return this.baseGetPrivateKeys({
      payload,
      curve,
    });
  }

  override async signTransaction(
    payload: ICoreApiSignTxPayload,
  ): Promise<ISignedTxPro> {
    // throw new Error('Method not implemented.');
    const {
      unsignedTx,
      networkInfo: { chainId },
      account,
    } = payload;
    const senderPublicKey = account.pub;
    const signer = await this.baseGetSingleSigner({
      payload,
      curve,
    });
    const [rawTxn, rawUserTransactionBytes] = buildUnsignedRawTx(
      unsignedTx,
      chainId,
    );
    const txBytes = hashRawTx(rawUserTransactionBytes);

    const [signature] = await signer.sign(bufferUtils.toBuffer(txBytes));
    return buildSignedTx(
      senderPublicKey as string,
      signature,
      rawTxn,
      unsignedTx.encodedTx,
    );
  }

  override async signMessage(): Promise<string> {
    throw new Error('Method not implemented.');
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
    const address = await pubkeyToAddress(publicKey);
    return Promise.resolve({
      address,
      publicKey,
    });
  }

  override async getAddressesFromHd(
    query: ICoreApiGetAddressesQueryHd,
  ): Promise<ICoreApiGetAddressesResult> {
    // throw new Error('Method not implemented.');
    return this.baseGetAddressesFromHd(query, {
      curve,
    });
  }
}
