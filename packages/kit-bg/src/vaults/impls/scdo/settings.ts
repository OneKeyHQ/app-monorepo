import {
  COINTYPE_SCDO,
  IMPL_SCDO,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { EDBAccountType } from '../../../dbs/local/consts';

import type { IAccountDeriveInfoMapBase, IVaultSettings } from '../../types';

const accountDeriveInfo: IAccountDeriveInfoMapBase = {
  default: {
    namePrefix: 'SCDO',
    labelKey: ETranslations.bip44__standard,
    template: `m/44'/${COINTYPE_SCDO}'/${INDEX_PLACEHOLDER}'/0/0`,
    coinType: COINTYPE_SCDO,
  },
};

const settings: IVaultSettings = {
  impl: IMPL_SCDO,
  coinTypeDefault: COINTYPE_SCDO,
  accountType: EDBAccountType.SIMPLE,

  importedAccountEnabled: false,
  hardwareAccountEnabled: true,
  externalAccountEnabled: false,
  watchingAccountEnabled: true,
  softwareAccountDisabled: true,

  supportedDeviceTypes: ['classic1s', 'pro'],

  defaultFeePresetIndex: 0,

  isUtxo: false,
  isSingleToken: false,
  NFTEnabled: false,
  nonceRequired: true,
  feeUTXORequired: false,
  editFeeEnabled: true,
  replaceTxEnabled: false,
  estimatedFeePollingInterval: 30,

  customRpcEnabled: true,

  accountDeriveInfo,
  networkInfo: {
    default: {
      curve: 'secp256k1',
      addressPrefix: '',
    },
  },
};

export default Object.freeze(settings);
