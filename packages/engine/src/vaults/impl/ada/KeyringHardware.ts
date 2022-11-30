import { CardanoGetAddressMethodParams, PROTO } from '@onekeyfe/hd-core';

import { deviceUtils } from '@onekeyhq/kit/src/utils/hardware';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { COINTYPE_ADA as COIN_TYPE } from '../../../constants';
import {
  NotImplemented,
  OneKeyHardwareError,
  OneKeyInternalError,
} from '../../../errors';
import { AccountType, DBUTXOAccount } from '../../../types/account';
import { KeyringHardwareBase } from '../../keyring/KeyringHardwareBase';
import { IPrepareHardwareAccountsParams } from '../../types';

import { NetworkId } from './types';

const PATH_PREFIX = `m/1852'/${COIN_TYPE}'`;

// @ts-ignore
export class KeyringHardware extends KeyringHardwareBase {
  override async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<DBUTXOAccount[]> {
    const { indexes, names } = params;
    const paths = indexes.map((index) => `${PATH_PREFIX}/${index}'/0/0`);
    const stakingPaths = indexes.map((index) => `${PATH_PREFIX}/${index}'/2/0`);

    const showOnOneKey = false;
    const HardwareSDK = await this.getHardwareSDKInstance();
    const { connectId, deviceId } = await this.getHardwareInfo();
    const passphraseState = await this.getWalletPassphraseState();

    const bundle = paths.map((path, index) => ({
      addressParameters: {
        addressType: PROTO.CardanoAddressType.BASE,
        path,
        stakingPath: stakingPaths[index],
      },
      networkId: NetworkId.MAINNET,
      protocolMagic: 764824073,
      derivationType: PROTO.CardanoDerivationType.ICARUS_TREZOR,
      address: '',
      showOnOneKey,
    })) as CardanoGetAddressMethodParams[];

    let response;
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      response = await HardwareSDK.cardanoGetAddress(connectId, deviceId, {
        ...passphraseState,
        bundle,
      });
    } catch (error: any) {
      debugLogger.common.error(error);
      throw new OneKeyHardwareError(error);
    }

    if (!response.success || !response.payload) {
      console.error(response.payload);
      throw deviceUtils.convertDeviceError(response.payload);
    }

    if (response.payload.length !== indexes.length) {
      throw new OneKeyInternalError('Unable to get publick key.');
    }

    const ret = [];
    let index = 0;
    const firstAddressRelPath = '0/0';
    const stakingAddressRelPath = '2/0';
    for (const addressInfo of response.payload) {
      const { address, xpub, serializedPath, stakeAddress } = addressInfo;
      if (address) {
        const name = (names || [])[index] || `XRP #${indexes[index] + 1}`;
        const addresses: Record<string, string> = {
          [firstAddressRelPath]: address,
        };
        if (stakeAddress) {
          addresses[stakingAddressRelPath] = stakeAddress;
        }
        ret.push({
          id: `${this.walletId}--${serializedPath}`,
          name,
          type: AccountType.UTXO,
          path: serializedPath,
          coinType: COIN_TYPE,
          xpub: xpub ?? '',
          address,
          addresses,
        });
        index += 1;
      }
    }
    return ret;
  }
}
