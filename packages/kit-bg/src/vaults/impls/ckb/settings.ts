import {
  COINTYPE_CKB,
  IMPL_CKB,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';

import { EDBAccountType } from '../../../dbs/local/consts';

import type { IAccountDeriveInfoMapBase, IVaultSettings } from '../../types';

const accountDeriveInfo: IAccountDeriveInfoMapBase = {
  default: {
    namePrefix: 'CKB',
    labelKey: 'form__bip44_standard',
    template: `m/44'/${COINTYPE_NERVOS}'/0'/0/${INDEX_PLACEHOLDER}`,
    coinType: COINTYPE_CKB,
  },
};

const settings: IVaultSettings = {
  impl: IMPL_CKB,
  coinTypeDefault: COINTYPE_CKB,
  accountType: EDBAccountType.SIMPLE,

  importedAccountEnabled: true,
  hardwareAccountEnabled: true,
  externalAccountEnabled: false,
  watchingAccountEnabled: true,

  defaultFeePresetIndex: 0,

  isUtxo: false,
  isSingleToken: false,
  NFTEnabled: false,
  nonceRequired: false,
  feeUTXORequired: false,
  editFeeEnabled: false,
  replaceTxEnabled: false,

  minTransferAmount: '0.00000546',

  accountDeriveInfo,
  networkInfo: {
    default: {
      curve: 'secp256k1',
      addressPrefix: '',
    },
  },
};

export default Object.freeze(settings);
