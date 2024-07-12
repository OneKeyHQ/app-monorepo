import { EAddressEncodings } from '@onekeyhq/core/src/types';
import {
  COINNAME_NEURAI,
  COINTYPE_NEURAI,
  IMPL_NEURAI,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';

import settingsBtc from '../btc/settings';

import type { IAccountDeriveInfoMapBase, IVaultSettings } from '../../types';

const accountDeriveInfo: IAccountDeriveInfoMapBase = {
  default: {
    namePrefix: 'Neurai',
    label: 'Legacy',
    template: `m/44'/${COINTYPE_NEURAI}'/${INDEX_PLACEHOLDER}'/0/0`,
    coinType: COINTYPE_NEURAI,
    coinName: COINNAME_NEURAI,
    addressEncoding: EAddressEncodings.P2PKH,
    desc: 'BIP44, P2PKH, Base58.',
  },
};

const settings: IVaultSettings = {
  ...settingsBtc,

  importedAccountEnabled: true,
  hardwareAccountEnabled: true,
  externalAccountEnabled: false,
  watchingAccountEnabled: true,

  dappInteractionEnabled: false,

  accountDeriveInfo,
  impl: IMPL_NEURAI,
  coinTypeDefault: COINTYPE_NEURAI,
  minTransferAmount: '0.00000546',
  hasFrozenBalance: false,
  showAddressType: false,
  estimatedFeePollingInterval: 60,
};

export default Object.freeze(settings);
