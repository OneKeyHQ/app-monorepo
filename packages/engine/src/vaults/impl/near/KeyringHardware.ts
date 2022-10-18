/* eslint no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
/* eslint @typescript-eslint/no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
import {
  SignedTx,
  UnsignedTx,
} from '@onekeyfe/blockchain-libs/dist/types/provider';
import * as nearApiJs from 'near-api-js';

import { deviceUtils } from '@onekeyhq/kit/src/utils/hardware';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { COINTYPE_NEAR as COIN_TYPE } from '../../../constants';
import { NotImplemented, OneKeyHardwareError } from '../../../errors';
import { AccountType, DBSimpleAccount } from '../../../types/account';
import { KeyringHardwareBase } from '../../keyring/KeyringHardwareBase';

import { baseEncode, serializeTransaction } from './utils';

import type {
  IGetAddressParams,
  IPrepareHardwareAccountsParams,
  ISignCredentialOptions,
} from '../../types';

const PATH_PREFIX = `m/44'/${COIN_TYPE}'`;

// Hardware mistakenly returns a near implicit address with 0x prefix, this
// workaround is to remove the prefix.
function correctHardwareAddressRet(hardwareRet: string): string {
  return hardwareRet.slice(hardwareRet.startsWith('0x') ? 2 : 0);
}

export class KeyringHardware extends KeyringHardwareBase {
  override async signTransaction(
    unsignedTx: UnsignedTx,
    _options: ISignCredentialOptions,
  ): Promise<SignedTx> {
    const dbAccount = await this.getDbAccount();
    const HardwareSDK = await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();

    const transaction = unsignedTx.payload
      .nativeTx as nearApiJs.transactions.Transaction;

    const response = await HardwareSDK.nearSignTransaction(
      connectId,
      deviceId,
      {
        path: dbAccount.path,
        // Hardware expects a hex string
        rawTx: Buffer.from(
          serializeTransaction(transaction),
          'base64',
        ).toString('hex'),
        ...passphraseState,
      },
    );

    if (response.success && response.payload.signature) {
      return {
        txid: serializeTransaction(transaction, { encoding: 'sha256_bs58' }),
        rawTx: serializeTransaction(
          new nearApiJs.transactions.SignedTransaction({
            transaction,
            signature: new nearApiJs.transactions.Signature({
              keyType: transaction.publicKey.keyType,
              data: Buffer.from(response.payload.signature, 'hex'),
            }),
          }),
        ),
      };
    }

    throw deviceUtils.convertDeviceError(response.payload);
  }

  override signMessage(
    _messages: any[],
    _options: ISignCredentialOptions,
  ): any {
    throw new NotImplemented(
      'Signing near message with hardware is not supported yet.',
    );
  }

  override async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<Array<DBSimpleAccount>> {
    const { indexes, names } = params;
    const paths = indexes.map((index) => `${PATH_PREFIX}/${index}'`);
    const showOnOneKey = false;
    const HardwareSDK = await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();

    let addressesResponse;
    try {
      addressesResponse = await HardwareSDK.nearGetAddress(
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
      throw deviceUtils.convertDeviceError(addressesResponse.payload);
    }

    return addressesResponse.payload
      .map(({ address, path }, index) => ({
        id: `${this.walletId}--${path}`,
        name: (names || [])[index] || `NEAR #${indexes[index] + 1}`,
        type: AccountType.SIMPLE,
        path,
        coinType: COIN_TYPE,
        pub: `ed25519:${baseEncode(
          Buffer.from(correctHardwareAddressRet(address ?? ''), 'hex'),
        )}`,
        address: correctHardwareAddressRet(address ?? ''),
      }))
      .filter(({ address }) => !!address);
  }

  override async getAddress(params: IGetAddressParams): Promise<string> {
    const HardwareSDK = await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();
    const response = await HardwareSDK.nearGetAddress(connectId, deviceId, {
      path: params.path,
      showOnOneKey: params.showOnOneKey,
      ...passphraseState,
    });
    if (response.success && !!response.payload?.address) {
      return correctHardwareAddressRet(response.payload.address);
    }
    throw deviceUtils.convertDeviceError(response.payload);
  }
}
