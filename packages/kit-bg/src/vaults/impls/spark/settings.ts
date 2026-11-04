import {
  COINTYPE_LIGHTNING_SPARK,
  IMPL_LIGHTNING_SPARK,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';

import { EDBAccountType } from '../../../dbs/local/consts';

import type { IAccountDeriveInfoMapBase, IVaultSettings } from '../../types';

const accountDeriveInfo: IAccountDeriveInfoMapBase = {
  default: {
    namePrefix: 'Lightning Self-Custody',
    // BIP-85 Lightning child seed path; only index 0 is valid (spec v1).
    template: `m/83696968'/${COINTYPE_LIGHTNING_SPARK}'/0'/12'/${INDEX_PLACEHOLDER}'`,
    coinType: COINTYPE_LIGHTNING_SPARK,
  },
};

const settings: IVaultSettings = {
  impl: IMPL_LIGHTNING_SPARK,
  coinTypeDefault: COINTYPE_LIGHTNING_SPARK,
  accountType: EDBAccountType.SIMPLE,

  importedAccountEnabled: false,
  hardwareAccountEnabled: false,
  externalAccountEnabled: false,
  watchingAccountEnabled: false,
  qrAccountEnabled: false,

  hardwareAccountDisabled: true,
  botWalletAccountDisabled: true,
  firstAccountOnly: true,

  addressBookDisabled: true,
  addressBadgeDisabled: true,
  copyAddressDisabled: true,
  disabledSwapAction: true,

  defaultFeePresetIndex: 0,

  isUtxo: false,
  isSingleToken: true,
  NFTEnabled: false,
  nonceRequired: false,
  feeUTXORequired: false,
  editFeeEnabled: false,
  replaceTxEnabled: false,
  estimatedFeePollingInterval: 600,

  accountDeriveInfo,
  networkInfo: {
    default: {
      curve: 'secp256k1',
      addressPrefix: '',
    },
  },
  hideBlockExplorer: true,
};

export default Object.freeze(settings);
