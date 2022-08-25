/* eslint no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
/* eslint @typescript-eslint/no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
import {
  SignedTx,
  UnsignedTx,
} from '@onekeyfe/blockchain-libs/dist/types/provider';
import { PublicKey, Transaction } from '@solana/web3.js';

import { HardwareSDK, deviceUtils } from '@onekeyhq/kit/src/utils/hardware';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { COINTYPE_SOL as COIN_TYPE } from '../../../constants';
import { NotImplemented, OneKeyHardwareError } from '../../../errors';
import { AccountType, DBSimpleAccount } from '../../../types/account';
import { KeyringHardwareBase } from '../../keyring/KeyringHardwareBase';

import type {
  IGetAddressParams,
  IPrepareHardwareAccountsParams,
  ISignCredentialOptions,
} from '../../types';

const PATH_PREFIX = `m/44'/${COIN_TYPE}'`;

export class KeyringHardware extends KeyringHardwareBase {
  override async signTransaction(
    unsignedTx: UnsignedTx,
    _options: ISignCredentialOptions,
  ): Promise<SignedTx> {
    const dbAccount = await this.getDbAccount();
    await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();

    const { nativeTx: transaction, feePayer } = unsignedTx.payload as {
      nativeTx: Transaction;
      feePayer: PublicKey;
    };

    const response = await HardwareSDK.solSignTransaction(connectId, deviceId, {
      path: dbAccount.path,
      rawTx: transaction.serializeMessage().toString('hex'),
    });

    if (response.success && response.payload.signature) {
      const { signature } = response.payload;
      transaction.addSignature(feePayer, Buffer.from(signature, 'hex'));
      return {
        txid: signature,
        rawTx: transaction
          .serialize({ requireAllSignatures: false })
          .toString('base64'),
      };
    }

    throw deviceUtils.convertDeviceError(response.payload);
  }

  override signMessage(
    _messages: any[],
    _options: ISignCredentialOptions,
  ): any {
    throw new NotImplemented('Signing solana message is not supported yet.');
  }

  override async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<Array<DBSimpleAccount>> {
    const { indexes, names } = params;
    const paths = indexes.map((index) => `${PATH_PREFIX}/${index}'/0'`);
    const showOnOneKey = false;
    await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();

    let addressesResponse;
    try {
      addressesResponse = await HardwareSDK.solGetAddress(connectId, deviceId, {
        bundle: paths.map((path) => ({ path, showOnOneKey })),
      });
    } catch (error: any) {
      debugLogger.common.error(error);
      throw new OneKeyHardwareError(error);
    }
    if (!addressesResponse.success) {
      debugLogger.common.error(addressesResponse.payload);
      throw deviceUtils.convertDeviceError(addressesResponse.payload);
    }

    return addressesResponse.payload
      .map(({ address, path }, index) => ({
        id: `${this.walletId}--${path}`,
        name: (names || [])[index] || `SOL #${indexes[index] + 1}`,
        type: AccountType.SIMPLE,
        path,
        coinType: COIN_TYPE,
        pub: address ?? '', // base58 encoded
        address: address ?? '',
      }))
      .filter(({ address }) => !!address);
  }

  override async getAddress(params: IGetAddressParams): Promise<string> {
    await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const response = await HardwareSDK.solGetAddress(connectId, deviceId, {
      path: params.path,
      showOnOneKey: params.showOnOneKey,
    });
    if (response.success) {
      return response.payload.address ?? '';
    }
    throw deviceUtils.convertDeviceError(response.payload);
  }
}
