/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Connection,
  Ed25519PublicKey,
  JsonRpcProvider,
  toB64,
  toSerializedSignature,
} from '@mysten/sui.js';
import { hexToBytes } from '@noble/hashes/utils';

import type { UnsignedTx } from '@onekeyhq/engine/src/types/provider';
import { convertDeviceError } from '@onekeyhq/shared/src/device/deviceErrorUtils';
import { COINTYPE_SUI as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { OneKeyHardwareError, OneKeyInternalError } from '../../../errors';
import { AccountType } from '../../../types/account';
import { KeyringHardwareBase } from '../../keyring/KeyringHardwareBase';
import { addHexPrefix, hexlify } from '../../utils/hexUtils';

import { handleSignData, toTransaction } from './utils';

import type { DBSimpleAccount } from '../../../types/account';
import type { AptosMessage } from '../../../types/message';
import type {
  IHardwareGetAddressParams,
  IPrepareHardwareAccountsParams,
  ISignCredentialOptions,
  SignedTxResult,
} from '../../types';

const PATH_PREFIX = `m/44'/${COIN_TYPE}'`;

export class KeyringHardware extends KeyringHardwareBase {
  async getPublicKey(
    connectId: string,
    deviceId: string,
    paths: Array<string>,
  ): Promise<Array<string>> {
    let response;
    const HardwareSDK = await this.getHardwareSDKInstance();
    const passphraseState = await this.getWalletPassphraseState();
    try {
      response = await HardwareSDK.suiGetPublicKey(connectId, deviceId, {
        bundle: paths.map((path) => ({ path })),
        ...passphraseState,
      });
    } catch (error: any) {
      debugLogger.common.error(error);
      throw new OneKeyHardwareError(error);
    }

    if (!response.success) {
      debugLogger.common.error(response.payload);
      throw convertDeviceError(response.payload);
    }

    const pubKeys = response.payload
      .map((result) => result.publicKey)
      .filter((item: string | undefined): item is string => !!item);

    return pubKeys;
  }

  async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<Array<DBSimpleAccount>> {
    const { type, indexes, names } = params;
    const paths = indexes.map((index) => `${PATH_PREFIX}/${index}'/0'/0'`);
    const isSearching = type === 'SEARCH_ACCOUNTS';
    const showOnOneKey = false;
    const HardwareSDK = await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();

    let addressesResponse;
    try {
      addressesResponse = await HardwareSDK.suiGetAddress(connectId, deviceId, {
        bundle: paths.map((path) => ({ path, showOnOneKey })),
        ...passphraseState,
      });
    } catch (error: any) {
      debugLogger.common.error(error);
      throw new OneKeyHardwareError(error);
    }
    if (!addressesResponse.success) {
      debugLogger.common.error(addressesResponse.payload);
      throw convertDeviceError(addressesResponse.payload);
    }

    let pubKeys: Array<string> = [];
    if (!isSearching) {
      const includePublicKey = !!addressesResponse.payload?.[0]?.publicKey;

      if (!includePublicKey) {
        pubKeys = await this.getPublicKey(connectId, deviceId, paths);
      }
    }

    const ret = [];
    let index = 0;
    for (const addressInfo of addressesResponse.payload) {
      const { address, path, publicKey } = addressInfo;
      if (address) {
        const name = (names || [])[index] || `SUI #${indexes[index] + 1}`;
        ret.push({
          id: `${this.walletId}--${path}`,
          name,
          type: AccountType.SIMPLE,
          path,
          coinType: COIN_TYPE,
          pub: publicKey ?? (pubKeys[index] || ''),
          address: addHexPrefix(address),
        });
        index += 1;
      }
    }
    return ret;
  }

  async getAddress(params: IHardwareGetAddressParams): Promise<string> {
    const HardwareSDK = await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();
    const response = await HardwareSDK.suiGetAddress(connectId, deviceId, {
      path: params.path,
      showOnOneKey: params.showOnOneKey,
      ...passphraseState,
    });
    if (response.success && !!response.payload?.address) {
      return response.payload.address.toLowerCase();
    }
    throw convertDeviceError(response.payload);
  }

  override async batchGetAddress(
    params: IHardwareGetAddressParams[],
  ): Promise<{ path: string; address: string }[]> {
    const HardwareSDK = await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();
    const response = await HardwareSDK.suiGetAddress(connectId, deviceId, {
      ...passphraseState,
      bundle: params.map(({ path, showOnOneKey }) => ({
        path,
        showOnOneKey: !!showOnOneKey,
      })),
    });

    if (!response.success) {
      throw convertDeviceError(response.payload);
    }
    return response.payload.map((item) => ({
      path: item.path ?? '',
      address: item.address ?? '',
    }));
  }

  async signTransaction(
    unsignedTx: UnsignedTx,
    options: ISignCredentialOptions,
  ): Promise<SignedTxResult> {
    debugLogger.common.info('signTransaction', unsignedTx);
    const dbAccount = await this.getDbAccount();
    const { rpcURL } = await this.engine.getNetwork(this.networkId);
    const client = new JsonRpcProvider(new Connection({ fullnode: rpcURL }));
    const sender = dbAccount.address;

    const senderPublicKey = unsignedTx.inputs?.[0]?.publicKey;
    if (!senderPublicKey) {
      throw new OneKeyInternalError('Unable to get sender public key.');
    }

    const { encodedTx } = unsignedTx.payload;
    const txnBytes = await toTransaction(client, sender, encodedTx);
    const signData = handleSignData(txnBytes, true);

    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();

    const HardwareSDK = await this.getHardwareSDKInstance();

    const response = await HardwareSDK.suiSignTransaction(connectId, deviceId, {
      path: dbAccount.path,
      rawTx: hexlify(Buffer.from(signData)),
      ...passphraseState,
    });

    if (response.success) {
      const { signature } = response.payload;

      const serializeSignature = toSerializedSignature({
        signatureScheme: 'ED25519',
        signature: hexToBytes(signature),
        pubKey: new Ed25519PublicKey(hexToBytes(senderPublicKey)),
      });

      return {
        txid: '',
        rawTx: toB64(txnBytes),
        signatureScheme: 'ed25519',
        signature: serializeSignature,
        publicKey: addHexPrefix(senderPublicKey),
      };
    }

    throw convertDeviceError(response.payload);
  }

  override async signMessage(
    messages: AptosMessage[],
    options: ISignCredentialOptions,
  ): Promise<string[]> {
    debugLogger.common.info('signMessage', messages);
    return Promise.reject(new Error('Not implemented'));
  }
}
