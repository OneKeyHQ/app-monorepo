/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  SignedTx,
  UnsignedTx,
} from '@onekeyfe/blockchain-libs/dist/types/provider';

import { COINTYPE_ETH as COIN_TYPE, IMPL_EVM } from '../../../constants';
import * as OneKeyHardware from '../../../hardware';
import { AccountType, DBSimpleAccount } from '../../../types/account';
import { KeyringHardwareBase } from '../../keyring/KeyringHardwareBase';
import {
  IGetAddressParams,
  IPrepareHardwareAccountsParams,
  ISignCredentialOptions,
} from '../../types';

import type { IUnsignedMessageEvm } from './Vault';

const PATH_PREFIX = `m/44'/${COIN_TYPE}'/0'/0`;

export class KeyringHardware extends KeyringHardwareBase {
  async signTransaction(unsignedTx: UnsignedTx): Promise<SignedTx> {
    await this.getHardwareSDKInstance();
    const path = await this.getAccountPath();
    const chainId = await this.getNetworkChainId();
    const { connectId, deviceId } = await this.getHardwareInfo();
    return OneKeyHardware.ethereumSignTransaction(
      connectId,
      deviceId,
      path,
      chainId,
      unsignedTx,
    );
  }

  async signMessage(
    messages: IUnsignedMessageEvm[],
    options: ISignCredentialOptions,
  ): Promise<string[]> {
    const path = await this.getAccountPath();
    const { connectId, deviceId } = await this.getHardwareInfo();
    return Promise.all(
      messages.map((message) =>
        OneKeyHardware.ethereumSignMessage({
          connectId,
          deviceId,
          path,
          message,
        }),
      ),
    );
  }

  override async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<Array<DBSimpleAccount>> {
    await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const { indexes, names } = params;
    const paths = indexes.map((index) => `${PATH_PREFIX}/${index}`);
    const addressInfos = await OneKeyHardware.getXpubs(
      IMPL_EVM,
      paths,
      'address',
      params.type,
      connectId,
      deviceId,
    );

    const ret = [];
    let index = 0;
    for (const info of addressInfos) {
      const { path, info: address } = info;
      const name = (names || [])[index] || `EVM #${indexes[index] + 1}`;
      ret.push({
        id: `${this.walletId}--${path}`,
        name,
        type: AccountType.SIMPLE,
        path,
        coinType: COIN_TYPE,
        pub: '',
        address,
      });
      index += 1;
    }
    return ret;
  }

  async getAddress(params: IGetAddressParams): Promise<string> {
    await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const address = await OneKeyHardware.ethereumGetAddress(
      connectId,
      deviceId,
      params.path,
      params.showOnOneKey,
    );

    return address;
  }
}
