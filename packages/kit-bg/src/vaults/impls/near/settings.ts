import {
  COINTYPE_NEAR,
  IMPL_NEAR,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { EDBAccountType } from '../../../dbs/local/consts';

import type { IAccountDeriveInfoMapBase, IVaultSettings } from '../../types';

const accountDeriveInfo: IAccountDeriveInfoMapBase = {
  default: {
    namePrefix: 'NEAR',
    labelKey: ETranslations.bip44__standard,
    template: `m/44'/${COINTYPE_NEAR}'/${INDEX_PLACEHOLDER}'`,
    coinType: COINTYPE_NEAR,
  },
};

const settings: IVaultSettings = {
  impl: IMPL_NEAR,
  coinTypeDefault: COINTYPE_NEAR,
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
  onChainHistoryDisabled: true,
  transferZeroNativeTokenEnabled: true,
  estimatedFeePollingInterval: 6,

  accountDeriveInfo,
  networkInfo: {
    default: {
      curve: 'ed25519',
      addressPrefix: '',
    },
  },
  hasFrozenBalance: true,
};

export default Object.freeze(settings);
