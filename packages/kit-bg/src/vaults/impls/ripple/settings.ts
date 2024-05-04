import {
  COINTYPE_RIPPLE,
  IMPL_RIPPLE,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';

import { EDBAccountType } from '../../../dbs/local/consts';

import type { IAccountDeriveInfoMapBase, IVaultSettings } from '../../types';

const accountDeriveInfo: IAccountDeriveInfoMapBase = {
  default: {
    namePrefix: 'Ripple',
    labelKey: 'form__bip44_standard',
    template: `m/44'/${COINTYPE_RIPPLE}'/${INDEX_PLACEHOLDER}'/0/0`,
    coinType: COINTYPE_RIPPLE,
  },
};

const settings: IVaultSettings = {
  impl: IMPL_RIPPLE,
  coinTypeDefault: COINTYPE_RIPPLE,
  accountType: EDBAccountType.SIMPLE,

  importedAccountEnabled: true,
  hardwareAccountEnabled: true,
  externalAccountEnabled: false,
  watchingAccountEnabled: true,

  isUtxo: false,
  isSingleToken: true,
  NFTEnabled: false,
  nonceRequired: false,
  feeUTXORequired: false,
  editFeeEnabled: false,
  replaceTxEnabled: false,

  accountDeriveInfo,
  networkInfo: {
    default: {
      curve: 'secp256k1',
      addressPrefix: '',
    },
  },
};

export default Object.freeze(settings);
