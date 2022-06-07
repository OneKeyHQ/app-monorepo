/* eslint no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
/* eslint @typescript-eslint/no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
import { Provider } from '@onekeyfe/blockchain-libs/dist/provider/chains/stc/provider';
import OneKeyConnect from '@onekeyfe/js-sdk';

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

    const provider = (await this.engine.providerManager.getProvider(
      this.networkId,
    )) as Provider;
    return provider.hardwareSignTransaction(unsignedTx, {
      [dbAccount.address]: dbAccount.path,
    });
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

    let pubkeys: Array<string> = [];
    if (!isSearching) {
      let response;
      try {
        response = await OneKeyConnect.starcoinGetPublicKey({
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
      pubkeys = response.payload.map(({ publicKey }) => publicKey);
    }

    let addressesResponse;
    try {
      addressesResponse = await OneKeyConnect.starcoinGetAddress({
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
      const { address, serializedPath: path } = addressInfo;
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
    return ret;
  }
}
