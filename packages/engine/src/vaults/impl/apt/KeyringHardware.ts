/* eslint-disable @typescript-eslint/no-unused-vars */
import { bytesToHex } from '@noble/hashes/utils';
import { AptosClient, BCS } from 'aptos';

import type { SignedTx, UnsignedTx } from '@onekeyhq/engine/src/types/provider';
import { convertDeviceError } from '@onekeyhq/shared/src/device/deviceErrorUtils';
import { COINTYPE_APTOS as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { OneKeyHardwareError } from '../../../errors';
import { AccountType } from '../../../types/account';
import { KeyringHardwareBase } from '../../keyring/KeyringHardwareBase';
import { addHexPrefix } from '../../utils/hexUtils';

import { buildSignedTx, generateUnsignedTransaction } from './utils';

import type { DBSimpleAccount } from '../../../types/account';
import type { AptosMessage } from '../../../types/message';
import type {
  IHardwareGetAddressParams,
  IPrepareHardwareAccountsParams,
  ISignCredentialOptions,
} from '../../types';
import type { SignMessageRequest } from './types';

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
      response = await HardwareSDK.aptosGetPublicKey(connectId, deviceId, {
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
      addressesResponse = await HardwareSDK.aptosGetAddress(
        connectId,
        deviceId,
        {
          bundle: paths.map((path) => ({ path, showOnOneKey })),
          ...passphraseState,
        },
      );
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
        const name = (names || [])[index] || `APT #${indexes[index] + 1}`;
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
    const response = await HardwareSDK.aptosGetAddress(connectId, deviceId, {
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
    const response = await HardwareSDK.aptosGetAddress(connectId, deviceId, {
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
  ): Promise<SignedTx> {
    debugLogger.common.info('signTransaction', unsignedTx);
    const dbAccount = await this.getDbAccount();
    const { rpcURL } = await this.engine.getNetwork(this.networkId);
    const aptosClient = new AptosClient(rpcURL);

    const rawTx = await generateUnsignedTransaction(aptosClient, unsignedTx);
    const serialize = new BCS.Serializer();
    rawTx.serialize(serialize);

    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();

    const HardwareSDK = await this.getHardwareSDKInstance();
    const response = await HardwareSDK.aptosSignTransaction(
      connectId,
      deviceId,
      {
        path: dbAccount.path,
        rawTx: bytesToHex(serialize.getBytes()),
        ...passphraseState,
      },
    );

    if (response.success) {
      const { signature, public_key: senderPublicKey } = response.payload;
      return buildSignedTx(rawTx, senderPublicKey, signature);
    }

    throw convertDeviceError(response.payload);
  }

  override async signMessage(
    messages: AptosMessage[],
    options: ISignCredentialOptions,
  ): Promise<string[]> {
    debugLogger.common.info('signMessage', messages);
    const dbAccount = await this.getDbAccount();

    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();
    const HardwareSDK = await this.getHardwareSDKInstance();

    return Promise.all(
      messages.map(async (message) => {
        const messageRequest: SignMessageRequest = JSON.parse(message.message);
        const response = await HardwareSDK.aptosSignMessage(
          connectId,
          deviceId,
          {
            path: dbAccount.path,
            payload: {
              message: messageRequest.message,
              address: messageRequest.address,
              application: messageRequest.application,
              chainId: messageRequest?.chainId?.toString(),
              nonce: messageRequest?.nonce?.toString(),
            },
            ...passphraseState,
          },
        );

        if (!response.success) {
          throw convertDeviceError(response.payload);
        }

        return addHexPrefix(response.payload.signature);
      }),
    );
  }
}
