import {
  COINTYPE_XRP,
  IMPL_XRP,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';

import { EDBAccountType } from '../../../dbs/local/consts';

import type { IAccountDeriveInfoMapBase, IVaultSettings } from '../../types';

const accountDeriveInfo: IAccountDeriveInfoMapBase = {
  default: {
    namePrefix: 'Ripple',
    labelKey: 'form__bip44_standard',
    template: `m/44'/${COINTYPE_XRP}'/${INDEX_PLACEHOLDER}'/0/0`,
    coinType: COINTYPE_XRP,
  },
};

const settings: IVaultSettings = {
  impl: IMPL_XRP,
  coinTypeDefault: COINTYPE_XRP,
  accountType: EDBAccountType.SIMPLE,

  importedAccountEnabled: true,
  hardwareAccountEnabled: true,
  externalAccountEnabled: false,
  watchingAccountEnabled: true,

  defaultFeePresetIndex: 0,

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

  cannotSendToSelf: true,
};

export default Object.freeze(settings);
