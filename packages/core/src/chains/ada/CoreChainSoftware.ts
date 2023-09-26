/* eslint-disable @typescript-eslint/no-unused-vars */

import type { ICurveName } from '@onekeyhq/engine/src/secret';
import { NetworkId } from '@onekeyhq/engine/src/vaults/impl/ada/types';
import type { ISignedTxPro } from '@onekeyhq/engine/src/vaults/types';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { CoreChainApiBase } from '../../base/CoreChainApiBase';

import { batchGetShelleyAddresses } from './sdkAda';

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
} from '../../types';

const curve: ICurveName = 'ed25519';

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
    const { unsignedTx } = payload;
    const signer = await this.baseGetSingleSigner({
      payload,
      curve,
    });
    // eslint-disable-next-line prefer-destructuring
    const encodedTx = unsignedTx.encodedTx;
    const txBytes = bufferUtils.toBuffer('');
    const [signature] = await signer.sign(txBytes);
    const txid = '';
    const rawTx = '';
    return {
      txid,
      rawTx,
    };
  }

  override async signMessage(payload: ICoreApiSignMsgPayload): Promise<string> {
    // throw new Error('Method not implemented.');
    // eslint-disable-next-line prefer-destructuring
    const unsignedMsg = payload.unsignedMsg;
    const signer = await this.baseGetSingleSigner({
      payload,
      curve,
    });
    const msgBytes = bufferUtils.toBuffer('');
    const [signature] = await signer.sign(msgBytes);
    return '';
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
    const address = '';
    return Promise.resolve({
      address,
      publicKey,
    });
  }

  override async getAddressesFromHd(
    query: ICoreApiGetAddressesQueryHd,
  ): Promise<ICoreApiGetAddressesResult> {
    const { hdCredential, password, indexes } = query;
    const { entropy } = hdCredential;

    // const { pathPrefix, pathSuffix } = slicePathTemplate(query.template);
    // const indexFormatted = indexes.map((index) =>
    //   pathSuffix.replace('{index}', index.toString()),
    // );

    const addressInfos = await batchGetShelleyAddresses(
      bufferUtils.toBuffer(entropy),
      password,
      indexes,
      NetworkId.MAINNET,
    );

    const firstAddressRelPath = '0/0';
    const stakingAddressPath = '2/0';

    const addresses = addressInfos.map((info) => {
      const { baseAddress, stakingAddress } = info;
      const { address, path, xpub } = baseAddress;

      const result: ICoreApiGetAddressItem = {
        address,
        publicKey: '',
        path,
        xpub,
        addresses: {
          [firstAddressRelPath]: address as string,
          [stakingAddressPath]: stakingAddress.address as string,
        },
      };
      return result;
    });
    return { addresses };
  }
}
