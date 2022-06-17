/* eslint no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
/* eslint @typescript-eslint/no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
import {
  buildSignedTx,
  buildUnsignedRawTx,
} from '@onekeyfe/blockchain-libs/dist/provider/chains/stc/provider';

import { HardwareSDK } from '@onekeyhq/kit/src/utils/hardware';

import { COINTYPE_STC as COIN_TYPE } from '../../../constants';
import { NotImplemented, OneKeyHardwareError } from '../../../errors';
import { AccountType, DBSimpleAccount } from '../../../types/account';
import { KeyringHardwareBase } from '../../keyring/KeyringHardwareBase';

import type {
  IPrepareHardwareAccountsParams,
  ISignCredentialOptions,
} from '../../types';
import type {
  SignedTx,
  UnsignedTx,
} from '@onekeyfe/blockchain-libs/dist/types/provider';

const PATH_PREFIX = `m/44'/${COIN_TYPE}'/0'/0'`;

export class KeyringHardware extends KeyringHardwareBase {
  async signTransaction(
    unsignedTx: UnsignedTx,
    _options: ISignCredentialOptions,
  ): Promise<SignedTx> {
    const dbAccount = await this.getDbAccount();
    const connectId = await this.getHardwareConnectId();
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

    const response = await HardwareSDK.starcoinSignTransaction(connectId, {
      path: dbAccount.path,
      rawTx: Buffer.from(rawUserTransactionBytes).toString('hex'),
    });

    if (response.success) {
      const { signature } = response.payload;
      return buildSignedTx(
        senderPublicKey,
        Buffer.from(signature as string, 'hex'),
        rawTxn,
      );
    }

    throw new OneKeyHardwareError(Error('signature is required'));
  }

  signMessage(
    _messages: any[],
    _options: ISignCredentialOptions,
  ): Promise<string[]> {
    throw new NotImplemented();
  }

  async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<Array<DBSimpleAccount>> {
    const { type, indexes, names } = params;
    const paths = indexes.map((index) => `${PATH_PREFIX}/${index}'`);
    const isSearching = type === 'SEARCH_ACCOUNTS';
    const showOnDevice = false;
    const connectId = await this.getHardwareConnectId();

    let pubkeys: Array<string> = [];
    if (!isSearching) {
      let response;
      try {
        response = await HardwareSDK.starcoinGetPublicKey(connectId, {
          bundle: paths.map((path) => ({ path, showOnDevice })),
        });
      } catch (error: any) {
        console.error(error);
        throw new OneKeyHardwareError(error);
      }

      if (!response.success) {
        console.error(response.payload);
        throw new OneKeyHardwareError({
          code: response.payload.code,
          message: response.payload.error,
        });
      }

      pubkeys = response.payload
        .map((result) => result.public_key)
        .filter((item: string | undefined): item is string => !!item);
    }

    let addressesResponse;
    try {
      addressesResponse = await HardwareSDK.starcoinGetAddress(connectId, {
        bundle: paths.map((path) => ({ path, showOnDevice })),
      });
    } catch (error: any) {
      console.error(error);
      throw new OneKeyHardwareError(error);
    }
    if (!addressesResponse.success) {
      console.error(addressesResponse.payload);
      throw new OneKeyHardwareError({
        code: addressesResponse.payload.code,
        message: addressesResponse.payload.error,
      });
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
}
