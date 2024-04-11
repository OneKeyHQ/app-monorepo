import { isNil } from 'lodash';

import { convertDeviceError } from '@onekeyhq/shared/src/device/deviceErrorUtils';
import {
  IMPL_DYNEX as COIN_IMPL,
  COINTYPE_DYNEX as COIN_TYPE,
} from '@onekeyhq/shared/src/engine/engineConsts';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { OneKeyHardwareError } from '../../../errors';
import { slicePathTemplate } from '../../../managers/derivation';
import { getAccountNameInfoByImpl } from '../../../managers/impl';
import { AccountType, type DBAccount } from '../../../types/account';
import { KeyringHardwareBase } from '../../keyring/KeyringHardwareBase';

import type { DBSimpleAccount } from '../../../types/account';
import type {
  IHardwareGetAddressParams,
  IPrepareHardwareAccountsParams,
  ISignCredentialOptions,
  ISignedTxPro,
  IUnsignedTxPro,
} from '../../types';

export class KeyringHardware extends KeyringHardwareBase {
  override async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<DBAccount[]> {
    const { indexes, names, template } = params;
    const { pathPrefix } = slicePathTemplate(template);
    const paths = indexes.map((index) => `${pathPrefix}/${index}'`);
    const showOnOneKey = false;
    const HardwareSDK = await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();

    const { prefix } = getAccountNameInfoByImpl(COIN_IMPL).default;
    let addressesResponse;
    try {
      addressesResponse = await HardwareSDK.dnxGetAddress(connectId, deviceId, {
        bundle: paths.map((path) => ({
          path,
          showOnOneKey,
        })),
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

    const ret: DBSimpleAccount[] = [];
    let index = 0;
    for (const addressInfo of addressesResponse.payload) {
      const { address, path } = addressInfo;

      if (isNil(address)) {
        throw new OneKeyHardwareError({ message: 'Get Dynex Address error.' });
      }
      const name = (names || [])[index] || `${prefix} #${indexes[index] + 1}`;
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

  override async getAddress(
    params: IHardwareGetAddressParams,
  ): Promise<string> {
    const HardwareSDK = await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();
    const addressesResponse = await HardwareSDK.dnxGetAddress(
      connectId,
      deviceId,
      {
        path: params.path,
        showOnOneKey: params.showOnOneKey,
        ...passphraseState,
      },
    );

    if (addressesResponse.success && !!addressesResponse.payload?.address) {
      return addressesResponse.payload.address;
    }
    throw convertDeviceError(addressesResponse.payload);
  }

  override async batchGetAddress(
    params: IHardwareGetAddressParams[],
  ): Promise<{ path: string; address: string }[]> {
    const HardwareSDK = await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();

    try {
      const addressesResponse = await HardwareSDK.dnxGetAddress(
        connectId,
        deviceId,
        {
          bundle: params.map(({ path, showOnOneKey }) => ({
            path,
            showOnOneKey: !!showOnOneKey,
          })),
          ...passphraseState,
        },
      );
      if (!addressesResponse.success) {
        debugLogger.common.error(addressesResponse.payload);
        throw convertDeviceError(addressesResponse.payload);
      }

      return addressesResponse.payload.map((item) => ({
        path: item.path ?? '',
        address: item.address ?? '',
      }));
    } catch (error: any) {
      debugLogger.common.error(error);
      throw new OneKeyHardwareError(error);
    }
  }

  override signTransaction(
    unsignedTx: IUnsignedTxPro,
    options: ISignCredentialOptions,
  ): Promise<ISignedTxPro> {
    throw new Error('Method not implemented.');
  }

  override signMessage(): Promise<string[]> {
    throw new Error('Method not implemented.');
  }
}
