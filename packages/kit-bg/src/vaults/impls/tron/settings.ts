import {
  COINTYPE_TRON,
  IMPL_TRON,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { EDBAccountType } from '../../../dbs/local/consts';

import type { IAccountDeriveInfoMapBase, IVaultSettings } from '../../types';

const accountDeriveInfo: IAccountDeriveInfoMapBase = {
  default: {
    namePrefix: 'TRON',
    labelKey: ETranslations.bip44__standard,
    template: `m/44'/${COINTYPE_TRON}'/0'/0/${INDEX_PLACEHOLDER}`,
    coinType: COINTYPE_TRON,
  },
};

const settings: IVaultSettings = {
  impl: IMPL_TRON,
  coinTypeDefault: COINTYPE_TRON,
  accountType: EDBAccountType.SIMPLE,

  importedAccountEnabled: true,
  hardwareAccountEnabled: true,
  externalAccountEnabled: false,
  watchingAccountEnabled: true,

  dappInteractionEnabled: true,

  defaultFeePresetIndex: 0,

  isUtxo: false,
  isSingleToken: false,
  NFTEnabled: false,
  nonceRequired: false,
  feeUTXORequired: false,
  editFeeEnabled: false,
  checkFeeDetailEnabled: true,
  replaceTxEnabled: false,
  allowZeroFee: true,
  estimatedFeePollingInterval: 6,

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
