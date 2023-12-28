import { EAddressEncodings } from '@onekeyhq/core/src/types';
import {
  COINTYPE_BTC,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';

import { EDBAccountType } from '../../../dbs/local/consts';

import type {
  IAccountDeriveInfo,
  IAccountDeriveInfoMapBase,
  IVaultSettings,
} from '../../types';

export type IAccountDeriveInfoMapBtc = IAccountDeriveInfoMapBase & {
  default: IAccountDeriveInfo;
  BIP86: IAccountDeriveInfo;
  BIP84: IAccountDeriveInfo;
  BIP44: IAccountDeriveInfo;
};
export type IAccountDeriveTypesBtc = keyof IAccountDeriveInfoMapBtc;

const accountDeriveInfo: IAccountDeriveInfoMapBtc = {
  default: {
    namePrefix: 'BTC Nested SegWit',
    label: 'Nested SegWit',
    template: `m/49'/${COINTYPE_BTC}'/${INDEX_PLACEHOLDER}'/0/0`,
    coinType: COINTYPE_BTC,
    addressEncoding: EAddressEncodings.P2SH_P2WPKH,
  },
  BIP86: {
    namePrefix: 'BTC Taproot',
    label: 'Taproot',
    template: `m/86'/${COINTYPE_BTC}'/${INDEX_PLACEHOLDER}'/0/0`,
    coinType: COINTYPE_BTC,
    addressEncoding: EAddressEncodings.P2TR,
  },
  BIP84: {
    namePrefix: 'BTC Native SegWit',
    label: 'Native SegWit',
    template: `m/84'/${COINTYPE_BTC}'/${INDEX_PLACEHOLDER}'/0/0`,
    coinType: COINTYPE_BTC,
    addressEncoding: EAddressEncodings.P2WPKH,
  },
  BIP44: {
    namePrefix: 'BTC Legacy',
    label: 'Legacy',
    template: `m/44'/${COINTYPE_BTC}'/${INDEX_PLACEHOLDER}'/0/0`,
    coinType: COINTYPE_BTC,
    addressEncoding: EAddressEncodings.P2PKH,
    // notRecommended: true,
  },
};

const settings: IVaultSettings = {
  accountType: EDBAccountType.UTXO,

  importedAccountEnabled: true,
  hardwareAccountEnabled: true,
  externalAccountEnabled: false,
  watchingAccountEnabled: true,

  isUtxo: true,

  accountDeriveInfo,
  networkInfo: {
    default: {
      curve: 'secp256k1',
      addressPrefix: '',
    },
  },
};

export default Object.freeze(settings);
