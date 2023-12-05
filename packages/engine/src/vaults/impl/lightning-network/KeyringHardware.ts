import { ripemd160 } from '@noble/hashes/ripemd160';
import { bytesToHex } from '@noble/hashes/utils';

import { convertDeviceError } from '@onekeyhq/shared/src/device/deviceErrorUtils';
import {
  COINTYPE_BTC,
  COINTYPE_LIGHTNING,
  COINTYPE_LIGHTNING_TESTNET,
  COINTYPE_TBTC,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';

import { OneKeyHardwareError, OneKeyInternalError } from '../../../errors';
import { slicePathTemplate } from '../../../managers/derivation';
import { AccountType, type DBVariantAccount } from '../../../types/account';
import { KeyringHardwareBase } from '../../keyring/KeyringHardwareBase';
import { AddressEncodings } from '../../utils/btcForkChain/types';

import { getBtcProvider } from './helper/account';

import type { IPrepareHardwareAccountsParams } from '../../types';

export class KeyringHardware extends KeyringHardwareBase {
  override async prepareAccounts(
    params: IPrepareHardwareAccountsParams,
  ): Promise<DBVariantAccount[]> {
    const { indexes, names, confirmOnDevice } = params;
    const network = await this.vault.getNetwork();
    const { isTestnet } = network;
    const btcCoinType = isTestnet ? COINTYPE_TBTC : COINTYPE_BTC;
    const lightningCoinType = network.isTestnet
      ? COINTYPE_LIGHTNING_TESTNET
      : COINTYPE_LIGHTNING;
    const template = `m/84'/${btcCoinType}'/${INDEX_PLACEHOLDER}'/0/0`;
    const ignoreFirst = indexes[0] !== 0;
    const usedIndexes = [...(ignoreFirst ? [indexes[0] - 1] : []), ...indexes];

    let response;
    try {
      const { connectId, deviceId } = await this.getHardwareInfo();
      const passphraseState = await this.getWalletPassphraseState();
      const HardwareSDK = await this.getHardwareSDKInstance();
      const { pathPrefix } = slicePathTemplate(template);
      const coinName = network.isTestnet ? 'TEST' : 'BTC';
      response = await HardwareSDK.btcGetPublicKey(connectId, deviceId, {
        bundle: usedIndexes.map((index) => ({
          path: `${pathPrefix}/${index}'`,
          coin: coinName.toLowerCase(),
          showOnOneKey: !confirmOnDevice
            ? false
            : index === usedIndexes[usedIndexes.length - 1],
        })),
        ...passphraseState,
      });
    } catch (error: any) {
      console.error(error);
      throw new OneKeyHardwareError(error);
    }

    if (!response.success || !response.payload) {
      console.error(response.payload);
      throw convertDeviceError(response.payload);
    }

    if (response.payload.length !== usedIndexes.length) {
      throw new OneKeyInternalError('Unable to get publick key.');
    }

    const ret = [];
    const index = 0;
    const provider = await getBtcProvider(this.engine, isTestnet);
    const prefix = isTestnet ? 'TLightning' : 'Lightning';
    for (const { path, xpub } of response.payload) {
      const addressRelPath = '0/0';
      const { [addressRelPath]: address } = provider.xpubToAddresses(
        xpub,
        [addressRelPath],
        AddressEncodings.P2WPKH,
      );
      console.log(path, xpub, address);
      const accountPath = `m/44'/${lightningCoinType}'/${usedIndexes[index]}'`;
      const name =
        (names || [])[index] || `${prefix} #${usedIndexes[index] + 1}`;
      ret.push({
        id: `${this.walletId}--${accountPath}`,
        name,
        type: AccountType.VARIANT,
        path: accountPath,
        coinType: lightningCoinType,
        pub: xpub,
        address: '',
        addresses: {
          normalizedAddress: address,
          realPath: path,
          hashAddress: bytesToHex(ripemd160(address)),
        },
      });
    }
    return ret;
  }
}
