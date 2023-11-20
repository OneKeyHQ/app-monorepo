import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';

import { CoreChainApiBase } from '../../base/CoreChainApiBase';

import { getMoneroApi } from './sdkXmr';
import { MoneroNetTypeEnum } from './sdkXmr/moneroUtil/moneroUtilTypes';

import type {
  ICoreApiGetAddressItem,
  ICoreApiGetAddressQueryImported,
  ICoreApiGetAddressesQueryHd,
  ICoreApiGetAddressesResult,
  ICoreApiPrivateKeysMap,
  ICoreApiSignBasePayload,
  ICoreApiSignTxPayload,
  ICurveName,
  ISignedTxPro,
} from '../../types';
import type { IEncodedTxXmr, ISendFundsArgs } from './types';

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
    const moneroApi = await getMoneroApi();
    // throw new Error('Method not implemented.');
    const { unsignedTx } = payload;
    const signer = await this.baseGetSingleSigner({
      payload,
      curve,
    });
    const rawPrivateKey = await signer.getPrvkey();

    if (!rawPrivateKey) {
      throw new OneKeyInternalError('Unable to get raw private key.');
    }

    const { publicSpendKey, privateViewKey, privateSpendKey } =
      await moneroApi.getKeyPairFromRawPrivatekey({
        rawPrivateKey: bufferUtils.bytesToHex(rawPrivateKey),
      });

    const encodedTx = unsignedTx.encodedTx as IEncodedTxXmr;

    let destinations = [...encodedTx.destinations];

    if (encodedTx.shouldSweep) {
      destinations = destinations.map((destination) => ({
        to_address: destination.to_address,
        send_amount: '0',
      }));
    }

    const sendFundsArgs: ISendFundsArgs = {
      destinations,
      from_address_string: encodedTx.address,
      is_sweeping: encodedTx.shouldSweep,
      nettype: encodedTx.nettype,
      priority: encodedTx.priority,

      pub_spendKey_string: publicSpendKey || '',
      sec_spendKey_string: privateSpendKey,
      sec_viewKey_string: privateViewKey,

      fromWallet_didFailToBoot: false,
      fromWallet_didFailToInitialize: false,
      fromWallet_needsImport: false,
      hasPickedAContact: false,
      manuallyEnteredPaymentID: '',
      manuallyEnteredPaymentID_fieldIsVisible: false,
      requireAuthentication: false,
      resolvedAddress: '',
      resolvedAddress_fieldIsVisible: false,
      resolvedPaymentID: '',
      resolvedPaymentID_fieldIsVisible: false,
    };
    const scanUrl = unsignedTx?.payload?.scanUrl;
    const signedTx = await moneroApi.sendFunds(
      sendFundsArgs,
      checkIsDefined(scanUrl),
    );
    return { ...signedTx, encodedTx: unsignedTx.encodedTx };
  }

  override async signMessage(): Promise<string> {
    throw new Error('Method not implemented.');
  }

  override async getAddressFromPrivate(
    query: ICoreApiGetAddressQueryImported,
  ): Promise<ICoreApiGetAddressItem> {
    const moneroApi = await getMoneroApi();

    const { privateKeyRaw, networkInfo } = query;
    // only support primary address for now
    const index = 0;
    const { publicSpendKey, publicViewKey } =
      await moneroApi.getKeyPairFromRawPrivatekey({
        rawPrivateKey: privateKeyRaw,
        index,
      });
    if (!publicSpendKey || !publicViewKey) {
      throw new OneKeyInternalError('Unable to get public spend/view key.');
    }

    const address = moneroApi.pubKeysToAddress(
      networkInfo.isTestnet
        ? MoneroNetTypeEnum.TestNet
        : MoneroNetTypeEnum.MainNet,
      index !== 0,
      bufferUtils.toBuffer(publicSpendKey),
      bufferUtils.toBuffer(publicViewKey),
    );

    const pub = `${publicSpendKey},${publicViewKey}`;
    return {
      publicKey: pub,
      address: '',
      addresses: {
        [networkInfo.networkId]: address,
      },
    };
  }

  override async getAddressFromPublic(): Promise<ICoreApiGetAddressItem> {
    throw new Error(
      'Method not implemented, use getAddressFromPrivate instead.',
    );
  }

  override async getAddressesFromHd(
    query: ICoreApiGetAddressesQueryHd,
  ): Promise<ICoreApiGetAddressesResult> {
    // throw new Error('Method not implemented.');
    return this.baseGetAddressesFromHd(query, {
      curve,
      generateFrom: 'privateKey',
    });
  }
}
