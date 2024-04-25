import {
  COINTYPE_LIGHTNING,
  IMPL_LIGHTNING,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';

import { EDBAccountType } from '../../../dbs/local/consts';

import type { IAccountDeriveInfoMapBase, IVaultSettings } from '../../types';

const accountDeriveInfo: IAccountDeriveInfoMapBase = {
  default: {
    namePrefix: 'Lightning',
    template: `m/44'/${COINTYPE_LIGHTNING}'/${INDEX_PLACEHOLDER}'/0/0`,
    coinType: COINTYPE_LIGHTNING,
  },
};

const settings: IVaultSettings = {
  impl: IMPL_LIGHTNING,
  coinTypeDefault: COINTYPE_LIGHTNING,
  accountType: EDBAccountType.SIMPLE,

  importedAccountEnabled: false,
  hardwareAccountEnabled: true,
  externalAccountEnabled: false,
  watchingAccountEnabled: false,

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
  validationRequired: true,
};

export default Object.freeze(settings);
