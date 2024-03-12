import { EAddressEncodings } from '@onekeyhq/core/src/types';
import {
  COINTYPE_DOGE,
  IMPL_DOGE,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';

import settingsBtc from '../btc/settings';

import type { IAccountDeriveInfoMapBase, IVaultSettings } from '../../types';

const accountDeriveInfo: IAccountDeriveInfoMapBase = {
  default: {
    namePrefix: 'DOGE',
    label: 'Legacy',
    template: `m/44'/${COINTYPE_DOGE}'/${INDEX_PLACEHOLDER}'/0/0`,
    coinType: COINTYPE_DOGE,
    addressEncoding: EAddressEncodings.P2PKH,
    desc: 'BIP44, P2PKH, Base58.',
  },
};

const settings: IVaultSettings = {
  ...settingsBtc,
  accountDeriveInfo,
  impl: IMPL_DOGE,
  coinTypeDefault: COINTYPE_DOGE,
};

export default Object.freeze(settings);
