import { EAddressEncodings } from '@onekeyhq/core/src/types';
import {
  COINNAME_BTC,
  COINTYPE_BTC,
  IMPL_BTC,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

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
    desc: `P2WPKH (m/49'/0'/0'), ${appLocale.intl.formatMessage({
      id: ETranslations.p2wpkh_desc,
    })}`,
  },
  BIP86: {
    namePrefix: 'BTC Taproot',
    label: 'Taproot',
    template: `m/86'/${COINTYPE_BTC}'/${INDEX_PLACEHOLDER}'/0/0`,
    coinType: COINTYPE_BTC,
    coinName: COINNAME_BTC,
    addressEncoding: EAddressEncodings.P2TR,
    desc: `P2TR (m/86'/0'/0'), ${appLocale.intl.formatMessage({
      id: ETranslations.p2tr_desc,
    })}`,
  },
  BIP84: {
    namePrefix: 'BTC Native SegWit',
    label: 'Native SegWit',
    template: `m/84'/${COINTYPE_BTC}'/${INDEX_PLACEHOLDER}'/0/0`,
    coinType: COINTYPE_BTC,
    coinName: COINNAME_BTC,
    addressEncoding: EAddressEncodings.P2WPKH,
    desc: `P2SH-P2WPKH (m/84'/0'/0'), ${appLocale.intl.formatMessage({
      id: ETranslations.p2sh_p2wpkh_desc,
    })}`,
  },
  BIP44: {
    namePrefix: 'BTC Legacy',
    label: 'Legacy',
    template: `m/44'/${COINTYPE_BTC}'/${INDEX_PLACEHOLDER}'/0/0`,
    coinType: COINTYPE_BTC,
    coinName: COINNAME_BTC,
    addressEncoding: EAddressEncodings.P2PKH,
    desc: `P2PKH (m/44'/0'/0'), ${appLocale.intl.formatMessage({
      id: ETranslations.p2pkh_desc,
    })}`,
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
  feeUTXORequired: true,
  editFeeEnabled: true,
  replaceTxEnabled: false,

  minTransferAmount: '0.00000546',
  defaultFeePresetIndex: 1,

  accountDeriveInfo,
  networkInfo: {
    default: {
      curve: 'secp256k1',
      addressPrefix: '',
    },
  },
  signOnlyFullTxRequired: true,
};

export default Object.freeze(settings);
