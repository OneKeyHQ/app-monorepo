import { deviceUtils } from '@onekeyhq/kit/src/utils/hardware';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { COINTYPE_XRP as COIN_TYPE } from '../../../constants';
import { OneKeyHardwareError } from '../../../errors';
import { AccountType, DBSimpleAccount } from '../../../types/account';
import { KeyringHardwareBase } from '../../keyring/KeyringHardwareBase';
import {
  IHardwareGetAddressParams,
  IPrepareHardwareAccountsParams,
} from '../../types';

const PATH_PREFIX = `m/44'/${COIN_TYPE}'`;

// @ts-ignore
export class KeyringHardware extends KeyringHardwareBase {
  override async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<DBSimpleAccount[]> {
    const { indexes, names } = params;
    const paths = indexes.map((index) => `${PATH_PREFIX}/${index}'/0/0`);
    const showOnOneKey = false;
    const HardwareSDK = await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();

    let response;
    try {
      response = await HardwareSDK.xrpGetAddress(connectId, deviceId, {
        bundle: paths.map((path) => ({ path, showOnOneKey })),
        ...passphraseState,
      });
    } catch (error: any) {
      debugLogger.common.error(error);
      throw new OneKeyHardwareError(error);
    }

    if (!response.success) {
      debugLogger.common.error(response.payload);
      throw deviceUtils.convertDeviceError(response.payload);
    }

    const ret = [];
    let index = 0;
    for (const addressInfo of response.payload) {
      const { address, path, publicKey } = addressInfo;
      if (address) {
        const name = (names || [])[index] || `APT #${indexes[index] + 1}`;
        ret.push({
          id: `${this.walletId}--${path}`,
          name,
          type: AccountType.SIMPLE,
          path,
          coinType: COIN_TYPE,
          pub: publicKey ?? '',
          address,
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
    const response = await HardwareSDK.xrpGetAddress(connectId, deviceId, {
      path: params.path,
      showOnOneKey: params.showOnOneKey,
      ...passphraseState,
    });
    // @ts-expect-error
    if (response.success && !!response.payload?.address) {
      // @ts-expect-error
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return response.payload.address;
    }
    throw deviceUtils.convertDeviceError(response.payload);
  }
}
