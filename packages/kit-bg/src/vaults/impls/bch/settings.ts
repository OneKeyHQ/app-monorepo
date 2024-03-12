import { EAddressEncodings } from '@onekeyhq/core/src/types';
import {
  COINNAME_BCH,
  COINTYPE_BCH,
  IMPL_BCH,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';

import settingsBtc from '../btc/settings';

import type { IAccountDeriveInfoMapBase, IVaultSettings } from '../../types';

const accountDeriveInfo: IAccountDeriveInfoMapBase = {
  default: {
    namePrefix: 'BCH',
    label: 'Legacy',
    template: `m/44'/${COINTYPE_BCH}'/${INDEX_PLACEHOLDER}'/0/0`,
    coinType: COINTYPE_BCH,
    coinName: COINNAME_BCH,
    addressEncoding: EAddressEncodings.P2PKH,
    desc: 'BIP44, P2PKH, Base58.',
  },
};

const settings: IVaultSettings = {
  ...settingsBtc,
  accountDeriveInfo,
  impl: IMPL_BCH,
  coinTypeDefault: COINTYPE_BCH,
};

export default Object.freeze(settings);
