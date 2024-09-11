import {
  decodeAddress,
  encodeAddress,
} from '@onekeyhq/core/src/chains/bch/sdkBch';
import { validateBtcAddress } from '@onekeyhq/core/src/chains/btc/sdkBtc';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';

import VaultBtc from '../btc/Vault';

import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringQr } from './KeyringQr';
import { KeyringWatching } from './KeyringWatching';

import type { IDBWalletType } from '../../../dbs/local/types';
import type { KeyringBase } from '../../base/KeyringBase';

export default class Vault extends VaultBtc {
  override coreApi = coreChainApi.bch.hd;

  override keyringMap: Record<IDBWalletType, typeof KeyringBase | undefined> = {
    hd: KeyringHd,
    qr: KeyringQr,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringWatching,
  };

  override async validateAddress(address: string) {
    const network = await this.getBtcForkNetwork();
    if (address.startsWith('xpub')) {
      return validateBtcAddress({
        address,
        network,
      });
    }
    const addressValidationResult = validateBtcAddress({
      address: decodeAddress(address),
      network,
    });

    const bchAddress = encodeAddress(
      addressValidationResult.normalizedAddress ??
        addressValidationResult.displayAddress,
    );

    if (!bchAddress) {
      throw new Error('Invalid BCH address');
    }

    const result = {
      ...addressValidationResult,
      normalizedAddress: bchAddress,
      displayAddress: bchAddress,
    };
    return result;
  }

  override getBlockbookCoinName() {
    return 'Bcash';
  }
}
