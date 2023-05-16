import {
  COINTYPE_SUI,
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
  activateAccountRequired: false,
  activateTokenRequired: false,

  feeInfoEditable: true,
  minGasLimit: 50,

  signOnlyReturnFullTx: true,

  accountNameInfo: {
    default: {
      prefix: 'SUI',
      category: `44'/${COINTYPE_SUI}'`,
      template: `m/44'/${COINTYPE_SUI}'/${INDEX_PLACEHOLDER}'/0'/0'`,
      coinType: COINTYPE_SUI,
    },
  },
});

export default settings;
