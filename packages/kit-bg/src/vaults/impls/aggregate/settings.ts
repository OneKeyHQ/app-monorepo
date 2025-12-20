import {
  COINTYPE_AGGREGATE,
  IMPL_AGGREGATE,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';

import { EDBAccountType } from '../../../dbs/local/consts';

import type { IAccountDeriveInfoMapBase, IVaultSettings } from '../../types';

const accountDeriveInfo: IAccountDeriveInfoMapBase = {
  default: {
    namePrefix: 'AGGREGATE',
    template: `${COINTYPE_AGGREGATE}/${INDEX_PLACEHOLDER}`,
    coinType: COINTYPE_AGGREGATE,
  },
};

const settings: IVaultSettings = {
  impl: IMPL_AGGREGATE,
  coinTypeDefault: COINTYPE_AGGREGATE,
  accountType: EDBAccountType.SIMPLE,

  importedAccountEnabled: false,
  hardwareAccountEnabled: false,
  externalAccountEnabled: false,
  watchingAccountEnabled: false,
  publicKeyExportEnabled: false,

  defaultFeePresetIndex: 0,

  isUtxo: false,
  isSingleToken: false,
  NFTEnabled: true,
  nonceRequired: false,
  feeUTXORequired: false,
  editFeeEnabled: false,
  replaceTxEnabled: false,
  estimatedFeePollingInterval: 6000,

  accountDeriveInfo,
  networkInfo: {
    default: {
      curve: 'secp256k1',
      addressPrefix: '',
    },
  },

  enabledInternalSignAndVerify: true,
};

export default Object.freeze(settings);
