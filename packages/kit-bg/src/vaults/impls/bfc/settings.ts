import { BFC_TYPE_ARG } from '@benfen/bfc.js/utils';

import { ECoreApiExportedSecretKeyType } from '@onekeyhq/core/src/types';
import {
  COINTYPE_BFC,
  IMPL_BFC,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { EDBAccountType } from '../../../dbs/local/consts';

import type { IAccountDeriveInfoMapBase, IVaultSettings } from '../../types';

const accountDeriveInfo: IAccountDeriveInfoMapBase = {
  default: {
    namePrefix: 'BFC',
    labelKey: ETranslations.bip44__standard,
    template: `m/44'/${COINTYPE_BFC}'/${INDEX_PLACEHOLDER}'/0'/0'`,
    coinType: COINTYPE_BFC,
  },
};

const settings: IVaultSettings = {
  impl: IMPL_BFC,
  coinTypeDefault: COINTYPE_BFC,
  accountType: EDBAccountType.SIMPLE,

  importedAccountEnabled: true,
  hardwareAccountEnabled: true,
  externalAccountEnabled: false,
  watchingAccountEnabled: true,

  supportExportedSecretKeys: [
    ECoreApiExportedSecretKeyType.privateKey,
    // ECoreApiExportedSecretKeyType.publicKey,
  ],

  dappInteractionEnabled: true,

  defaultFeePresetIndex: 0,

  isUtxo: false,
  isSingleToken: false,
  NFTEnabled: false,
  nonceRequired: false,
  feeUTXORequired: false,
  editFeeEnabled: true,
  replaceTxEnabled: false,
  transferZeroNativeTokenEnabled: true,
  estimatedFeePollingInterval: 120,
  customRpcEnabled: true,
  gasLimitValidationEnabled: true,

  accountDeriveInfo,
  networkInfo: {
    default: {
      curve: 'ed25519',
      addressPrefix: '',
      nativeTokenAddress: BFC_TYPE_ARG,
    },
  },
};

export default Object.freeze(settings);
