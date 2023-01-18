/* eslint-disable @typescript-eslint/no-unused-vars */
import type { SignedTx, UnsignedTx } from '@onekeyhq/engine/src/types/provider';
import { convertDeviceError } from '@onekeyhq/shared/src/device/deviceErrorUtils';
import {
  COINTYPE_ETH as COIN_TYPE,
  IMPL_EVM,
} from '@onekeyhq/shared/src/engine/engineConsts';
import * as engineUtils from '@onekeyhq/shared/src/engine/engineUtils';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { OneKeyHardwareError } from '../../../errors';
import * as OneKeyHardware from '../../../hardware';
import { AccountType } from '../../../types/account';
import { KeyringHardwareBase } from '../../keyring/KeyringHardwareBase';

import { ethers } from './sdk/ethers';

import type { DBSimpleAccount } from '../../../types/account';
import type {
  IGetAddressParams,
  IPrepareHardwareAccountsParams,
  ISignCredentialOptions,
} from '../../types';
import type { IUnsignedMessageEvm } from './Vault';

const PATH_PREFIX = `m/44'/${COIN_TYPE}'/0'/0`;

export class KeyringHardware extends KeyringHardwareBase {
  async signTransaction(unsignedTx: UnsignedTx): Promise<SignedTx> {
    const HardwareSDK = await this.getHardwareSDKInstance();
    const path = await this.getAccountPath();
    const chainId = await this.getNetworkChainId();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();
    return OneKeyHardware.ethereumSignTransaction(
      HardwareSDK,
      connectId,
      deviceId,
      path,
      chainId,
      unsignedTx,
      passphraseState,
    );
  }

  async signMessage(
    messages: IUnsignedMessageEvm[],
    options: ISignCredentialOptions,
  ): Promise<string[]> {
    const HardwareSDK = await this.getHardwareSDKInstance();
    const path = await this.getAccountPath();
    const chainId = await this.getNetworkChainId();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();
    return Promise.all(
      messages.map((message) =>
        OneKeyHardware.ethereumSignMessage({
          HardwareSDK,
          connectId,
          deviceId,
          passphraseState,
          path,
          message,
          chainId: Number(chainId),
        }),
      ),
    );
  }

  override async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<Array<DBSimpleAccount>> {
    const HardwareSDK = await this.getHardwareSDKInstance();
    const chainId = await this.getNetworkChainId();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();
    const { indexes, names, type } = params;

    let addressInfos;
    if (type === 'SEARCH_ACCOUNTS') {
      // When searching for accounts, we only get the PATH_PREFIX's xpub
      // and derive the addresses to reduce the number of calls to the device
      // therefore better performance.
      let response;
      try {
        response = await HardwareSDK.evmGetPublicKey(connectId, deviceId, {
          path: PATH_PREFIX,
          showOnOneKey: false,
          chainId: Number(chainId),
          ...passphraseState,
        });
      } catch (e: any) {
        debugLogger.engine.error(e);
        throw new OneKeyHardwareError(e);
      }

      if (!response.success) {
        throw convertDeviceError(response.payload);
      }
      const { xpub } = response.payload;
      const node = ethers.utils.HDNode.fromExtendedKey(xpub);
      addressInfos = indexes.map((index) => ({
        path: `${PATH_PREFIX}/${index}`,
        info: engineUtils.fixAddressCase({
          address: node.derivePath(`${index}`).address,
          impl: IMPL_EVM,
        }),
      }));
    } else {
      const paths = indexes.map((index) => `${PATH_PREFIX}/${index}`);
      addressInfos = await OneKeyHardware.getXpubs(
        HardwareSDK,
        IMPL_EVM,
        paths,
        'address',
        type,
        connectId,
        deviceId,
        passphraseState,
        Number(chainId),
      );
    }

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
    const HardwareSDK = await this.getHardwareSDKInstance();
    const chainId = await this.getNetworkChainId();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();
    const address = await OneKeyHardware.ethereumGetAddress(
      HardwareSDK,
      connectId,
      deviceId,
      params.path,
      params.showOnOneKey,
      passphraseState,
      Number(chainId),
    );

    return address;
  }
}
