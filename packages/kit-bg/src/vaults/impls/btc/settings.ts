import { EAddressEncodings } from '@onekeyhq/core/src/types';
import {
  COINNAME_BTC,
  COINTYPE_BTC,
  IMPL_BTC,
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
    coinName: COINNAME_BTC,
    addressEncoding: EAddressEncodings.P2SH_P2WPKH,
    desc: "P2WPKH (m/49'/0'/0'), Starts with '3'",
  },
  BIP86: {
    namePrefix: 'BTC Taproot',
    label: 'Taproot',
    template: `m/86'/${COINTYPE_BTC}'/${INDEX_PLACEHOLDER}'/0/0`,
    coinType: COINTYPE_BTC,
    coinName: COINNAME_BTC,
    addressEncoding: EAddressEncodings.P2TR,
    desc: "P2TR (m/86'/0'/0'), Starts with 'bc1p’",
  },
  BIP84: {
    namePrefix: 'BTC Native SegWit',
    label: 'Native SegWit',
    template: `m/84'/${COINTYPE_BTC}'/${INDEX_PLACEHOLDER}'/0/0`,
    coinType: COINTYPE_BTC,
    coinName: COINNAME_BTC,
    addressEncoding: EAddressEncodings.P2WPKH,
    desc: "P2SH-P2WPKH (m/84'/0'/0'), Starts with 'bc1q'",
  },
  BIP44: {
    namePrefix: 'BTC Legacy',
    label: 'Legacy',
    template: `m/44'/${COINTYPE_BTC}'/${INDEX_PLACEHOLDER}'/0/0`,
    coinType: COINTYPE_BTC,
    coinName: COINNAME_BTC,
    addressEncoding: EAddressEncodings.P2PKH,
    desc: "P2PKH (m/44'/0'/0'), Starts with '1'",
    // notRecommended: true,
  },
};

const settings: IVaultSettings = {
  impl: IMPL_BTC,
  coinTypeDefault: COINTYPE_BTC,
  accountType: EDBAccountType.UTXO,

  importedAccountEnabled: true,
  hardwareAccountEnabled: true,
  externalAccountEnabled: false,
  watchingAccountEnabled: true,

  isUtxo: true,
  isSingleToken: true,
  NFTEnabled: false,
  nonceRequired: false,
  editFeeEnabled: true,

  accountDeriveInfo,
  networkInfo: {
    default: {
      curve: 'secp256k1',
      addressPrefix: '',
    },
  },
};

export default Object.freeze(settings);
