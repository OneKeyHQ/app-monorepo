import {
  COINTYPE_ALGO,
  IMPL_ALGO,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { EDBAccountType } from '../../../dbs/local/consts';

import type { IAccountDeriveInfoMapBase, IVaultSettings } from '../../types';

const accountDeriveInfo: IAccountDeriveInfoMapBase = {
  default: {
    namePrefix: 'ALGO',
    labelKey: ETranslations.bip44__standard,
    template: `m/44'/${COINTYPE_ALGO}'/0'/0'/${INDEX_PLACEHOLDER}'`,
    coinType: COINTYPE_ALGO,
  },
};

const settings: IVaultSettings = {
  impl: IMPL_ALGO,
  coinTypeDefault: COINTYPE_ALGO,
  accountType: EDBAccountType.SIMPLE,

  importedAccountEnabled: true,
  hardwareAccountEnabled: true,
  externalAccountEnabled: false,
  watchingAccountEnabled: true,

  isUtxo: false,
  isSingleToken: false,
  NFTEnabled: false,
  nonceRequired: false,
  feeUTXORequired: false,
  editFeeEnabled: false,
  replaceTxEnabled: false,
  transferZeroNativeTokenEnabled: true,

  defaultFeePresetIndex: 0,

  onChainHistoryDisabled: true,

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
