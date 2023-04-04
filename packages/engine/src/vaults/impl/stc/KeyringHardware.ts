/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable camelcase, @typescript-eslint/naming-convention */
/* eslint no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
/* eslint @typescript-eslint/no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
import { arrayify } from '@ethersproject/bytes';
import { starcoin_types, utils } from '@starcoin/starcoin';

import {
  buildSignedTx,
  buildUnsignedRawTx,
} from '@onekeyhq/blockchain-libs/src/provider/chains/stc/provider';
import type { SignedTx, UnsignedTx } from '@onekeyhq/engine/src/types/provider';
import { convertDeviceError } from '@onekeyhq/shared/src/device/deviceErrorUtils';
import { COINTYPE_STC as COIN_TYPE } from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { OneKeyHardwareError } from '../../../errors';
import { AccountType } from '../../../types/account';
import { KeyringHardwareBase } from '../../keyring/KeyringHardwareBase';

import type { DBSimpleAccount } from '../../../types/account';
import type {
  IGetAddressParams,
  IPrepareHardwareAccountsParams,
  ISignCredentialOptions,
} from '../../types';

const PATH_PREFIX = `m/44'/${COIN_TYPE}'/0'/0'`;

export class KeyringHardware extends KeyringHardwareBase {
  async signTransaction(
    unsignedTx: UnsignedTx,
    _options: ISignCredentialOptions,
  ): Promise<SignedTx> {
    const dbAccount = await this.getDbAccount();
    const chainId = await this.getNetworkChainId();

    const [rawTxn, rawUserTransactionBytes] = buildUnsignedRawTx(
      unsignedTx,
      chainId,
    );

    const {
      inputs: [{ publicKey: senderPublicKey }],
    } = unsignedTx;

    if (!senderPublicKey) {
      throw new OneKeyHardwareError(Error('senderPublicKey is required'));
    }

    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();

    const HardwareSDK = await this.getHardwareSDKInstance();
    const response = await HardwareSDK.starcoinSignTransaction(
      connectId,
      deviceId,
      {
        path: dbAccount.path,
        rawTx: Buffer.from(rawUserTransactionBytes).toString('hex'),
        ...passphraseState,
      },
    );

    if (response.success) {
      const { signature } = response.payload;
      return buildSignedTx(
        senderPublicKey,
        Buffer.from(signature, 'hex'),
        rawTxn,
      );
    }

    throw convertDeviceError(response.payload);
  }

  async signMessage(
    _messages: any[],
    _options: ISignCredentialOptions,
  ): Promise<string[]> {
    const dbAccount = await this.getDbAccount();
    const chainId = await this.getNetworkChainId();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();
    const HardwareSDK = await this.getHardwareSDKInstance();

    return Promise.all(
      _messages.map(async (message) => {
        let response;
        const { type, message: messageHex } = message;
        try {
          response = await HardwareSDK.starcoinSignMessage(
            connectId,
            deviceId,
            {
              path: dbAccount.path,
              messageHex,
              ...passphraseState,
            },
          );
        } catch (error: any) {
          debugLogger.common.error(error);
          throw new OneKeyHardwareError(error);
        }

        if (!response.success) {
          debugLogger.common.error(response.payload);
          throw convertDeviceError(response.payload);
        }
        const { public_key, signature } = response.payload;
        if (type === 1) {
          // personal sign
          const msgBytes = arrayify(messageHex);
          const signingMessage = new starcoin_types.SigningMessage(msgBytes);
          const signedMessageHex =
            await utils.signedMessage.generateSignedMessage(
              signingMessage,
              parseInt(chainId),
              public_key,
              signature,
            );
          return signedMessageHex;
        }
        return signature;
      }),
    );
  }

  async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<Array<DBSimpleAccount>> {
    const { type, indexes, names } = params;
    const paths = indexes.map((index) => `${PATH_PREFIX}/${index}'`);
    const isSearching = type === 'SEARCH_ACCOUNTS';
    const showOnOneKey = false;
    const HardwareSDK = await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();

    let pubkeys: Array<string> = [];
    if (!isSearching) {
      let response;
      try {
        response = await HardwareSDK.starcoinGetPublicKey(connectId, deviceId, {
          bundle: paths.map((path) => ({ path, showOnOneKey })),
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

      pubkeys = response.payload
        .map((result) => result.public_key)
        .filter((item: string | undefined): item is string => !!item);
    }

    let addressesResponse;
    try {
      addressesResponse = await HardwareSDK.starcoinGetAddress(
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

    const ret = [];
    let index = 0;
    for (const addressInfo of addressesResponse.payload) {
      const { address, path } = addressInfo;
      if (address) {
        const name = (names || [])[index] || `STC #${indexes[index] + 1}`;
        ret.push({
          id: `${this.walletId}--${path}`,
          name,
          type: AccountType.SIMPLE,
          path,
          coinType: COIN_TYPE,
          pub: pubkeys[index] || '',
          address,
        });
        index += 1;
      }
    }
    return ret;
  }

  async getAddress(params: IGetAddressParams): Promise<string> {
    const HardwareSDK = await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();
    const response = await HardwareSDK.starcoinGetAddress(connectId, deviceId, {
      path: params.path,
      showOnOneKey: params.showOnOneKey,
      ...passphraseState,
    });
    if (response.success && !!response.payload?.address) {
      return response.payload.address;
    }
    throw convertDeviceError(response.payload);
  }

  override async batchGetAddress(
    params: IGetAddressParams[],
  ): Promise<{ path: string; address: string }[]> {
    const HardwareSDK = await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();
    const response = await HardwareSDK.starcoinGetAddress(connectId, deviceId, {
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
}
