import {
  COINTYPE_APTOS,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';

import type { IVaultSettings } from '../../types';

const settings: IVaultSettings = Object.freeze({
  privateKeyExportEnabled: true,
  tokenEnabled: true,
  txCanBeReplaced: false,

  importedAccountEnabled: true,
  hardwareAccountEnabled: true,
  externalAccountEnabled: false,
  watchingAccountEnabled: true,

  isUTXOModel: false,
  activateAccountRequired: true,
  activateTokenRequired: true,

  feeInfoEditable: true,
  minGasLimit: 1000,

  accountNameInfo: {
    default: {
      prefix: 'APT',
      category: `44'/${COINTYPE_APTOS}'`,
      template: `m/44'/${COINTYPE_APTOS}'/${INDEX_PLACEHOLDER}'/0'/0'`,
      coinType: COINTYPE_APTOS,
    },
  },
});

export default settings;
