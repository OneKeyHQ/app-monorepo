import { EAddressEncodings } from '@onekeyhq/core/src/types';
import {
  COINNAME_DOGE,
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
    coinName: COINNAME_DOGE,
    addressEncoding: EAddressEncodings.P2PKH,
    desc: 'BIP44, P2PKH, Base58.',
  },
};

const settings: IVaultSettings = {
  ...settingsBtc,
  accountDeriveInfo,
  impl: IMPL_DOGE,
  coinTypeDefault: COINTYPE_DOGE,
  minTransferAmount: '0.01',
  utxoDustAmount: '0.0099999',
  hasFrozenBalance: false,
  showAddressType: false,
  estimatedFeePollingInterval: 60,

  dappInteractionEnabled: false,
  mergeDeriveAssetsEnabled: false,
  qrAccountEnabled: false,
};

export default Object.freeze(settings);
