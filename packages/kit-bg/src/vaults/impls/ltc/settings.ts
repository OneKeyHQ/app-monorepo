import { EAddressEncodings } from '@onekeyhq/core/src/types';
import {
  COINNAME_LTC,
  COINTYPE_LTC,
  IMPL_LTC,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

import settingsBtc from '../btc/settings';

import type {
  IAccountDeriveInfo,
  IAccountDeriveInfoMapBase,
  IVaultSettings,
} from '../../types';

export type IAccountDeriveInfoMapLtc = IAccountDeriveInfoMapBase & {
  BIP84: IAccountDeriveInfo;
  BIP44: IAccountDeriveInfo;
};

const accountDeriveInfo: IAccountDeriveInfoMapLtc = {
  default: {
    namePrefix: 'LTC Nested SegWit',
    template: `m/49'/${COINTYPE_LTC}'/${INDEX_PLACEHOLDER}'/0/0`,
    coinType: COINTYPE_LTC,
    coinName: COINNAME_LTC,
    label: 'Nested SegWit',
    descI18n: {
      id: ETranslations.litecoin_nested_segwit_desc,
      data: {},
    },
    addressEncoding: EAddressEncodings.P2SH_P2WPKH,
  },
  BIP84: {
    namePrefix: 'LTC Native SegWit',
    template: `m/84'/${COINTYPE_LTC}'/${INDEX_PLACEHOLDER}'/0/0`,
    coinType: COINTYPE_LTC,
    coinName: COINNAME_LTC,
    label: 'Native SegWit',
    descI18n: {
      id: ETranslations.litecoin_native_segwit_desc,
      data: {},
    },
    addressEncoding: EAddressEncodings.P2WPKH,
  },
  BIP44: {
    namePrefix: 'LTC Legacy',
    template: `m/44'/${COINTYPE_LTC}'/${INDEX_PLACEHOLDER}'/0/0`,
    coinType: COINTYPE_LTC,
    coinName: COINNAME_LTC,
    label: 'Legacy',
    desc: `${appLocale.intl.formatMessage({
      id: ETranslations.litecoin_legacy_desc,
    })} BIP44, P2PKH, Base58`,
    addressEncoding: EAddressEncodings.P2PKH,
  },
};

const settings: IVaultSettings = {
  ...settingsBtc,
  accountDeriveInfo,
  impl: IMPL_LTC,
  coinTypeDefault: COINTYPE_LTC,
  minTransferAmount: '0.00000546',
  hasFrozenBalance: false,
};

export default Object.freeze(settings);
