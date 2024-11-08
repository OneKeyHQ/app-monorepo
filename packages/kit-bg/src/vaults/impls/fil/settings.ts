import { ECoreApiExportedSecretKeyType } from '@onekeyhq/core/src/types';
import {
  COINTYPE_FIL,
  IMPL_FIL,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { EDBAccountType } from '../../../dbs/local/consts';

import type { IAccountDeriveInfoMapBase, IVaultSettings } from '../../types';

const accountDeriveInfo: IAccountDeriveInfoMapBase = {
  default: {
    namePrefix: 'FIL',
    labelKey: ETranslations.bip44__standard,
    template: `m/44'/${COINTYPE_FIL}'/0'/0/${INDEX_PLACEHOLDER}`,
    coinType: COINTYPE_FIL,
  },
};

const settings: IVaultSettings = {
  impl: IMPL_FIL,
  coinTypeDefault: COINTYPE_FIL,
  accountType: EDBAccountType.VARIANT,

  importedAccountEnabled: true,
  hardwareAccountEnabled: true,
  externalAccountEnabled: false,
  watchingAccountEnabled: true,

  supportExportedSecretKeys: [
    ECoreApiExportedSecretKeyType.privateKey,
    // ECoreApiExportedSecretKeyType.publicKey,
  ],

  isUtxo: false,
  isSingleToken: true,
  NFTEnabled: false,
  nonceRequired: true,
  feeUTXORequired: false,
  editFeeEnabled: true,
  replaceTxEnabled: false,
  transferZeroNativeTokenEnabled: true,
  estimatedFeePollingInterval: 30,

  customRpcEnabled: true,
  defaultFeePresetIndex: 0,

  accountDeriveInfo,
  networkInfo: {
    default: {
      curve: 'secp256k1',
      addressPrefix: '',
    },
  },

  hideFeeInfoInHistoryList: true,
  isNativeTokenContractAddressEmpty: true,
};

export default Object.freeze(settings);
