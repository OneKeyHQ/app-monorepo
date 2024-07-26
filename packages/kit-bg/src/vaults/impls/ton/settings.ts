import {
  COINTYPE_TON,
  IMPL_TON,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { EDBAccountType } from '../../../dbs/local/consts';

import type { IAccountDeriveInfoMapBase, IVaultSettings } from '../../types';

const accountDeriveInfo: IAccountDeriveInfoMapBase = {
  default: {
    namePrefix: '',
    labelKey: ETranslations.bip44__standard,
    template: `m/44'/${COINTYPE_TON}'/0'/0'/${INDEX_PLACEHOLDER}'/0'`,
    coinType: COINTYPE_TON,
  },
};

const settings: IVaultSettings = {
  impl: IMPL_TON,
  coinTypeDefault: COINTYPE_TON,
  accountType: EDBAccountType.SIMPLE,

  importedAccountEnabled: true,
  hardwareAccountEnabled: true,
  externalAccountEnabled: false,
  watchingAccountEnabled: true,

  defaultFeePresetIndex: 0,

  isUtxo: false,
  isSingleToken: false,
  NFTEnabled: true,
  nonceRequired: true,
  feeUTXORequired: false,
  editFeeEnabled: true,
  replaceTxEnabled: false,
  estimatedFeePollingInterval: 30,

  accountDeriveInfo,
  networkInfo: {
    default: {
      curve: 'ed25519',
      addressPrefix: '',
    },
  },
};

export default Object.freeze(settings);
