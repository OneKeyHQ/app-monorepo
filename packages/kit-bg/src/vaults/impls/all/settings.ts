import {
  COINTYPE_ALLNETWORKS,
  IMPL_ALLNETWORKS,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';

import { EDBAccountType } from '../../../dbs/local/consts';

import type { IAccountDeriveInfoMapBase, IVaultSettings } from '../../types';

const accountDeriveInfo: IAccountDeriveInfoMapBase = {
  default: {
    namePrefix: 'ALL',
    template: `${COINTYPE_ALLNETWORKS}/${INDEX_PLACEHOLDER}`,
    coinType: COINTYPE_ALLNETWORKS,
  },
};

const settings: IVaultSettings = {
  impl: IMPL_ALLNETWORKS,
  coinTypeDefault: COINTYPE_ALLNETWORKS,
  accountType: EDBAccountType.SIMPLE,

  importedAccountEnabled: false,
  hardwareAccountEnabled: false,
  externalAccountEnabled: false,
  watchingAccountEnabled: false,
  publicKeyExportEnabled: false,
  addressBookDisabled: true,
  hideBlockExplorer: true,

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
};

export default Object.freeze(settings);
