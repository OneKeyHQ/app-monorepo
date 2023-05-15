import {
  COINTYPE_DOT,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';

import type { IVaultSettings } from '../../types';

const settings: IVaultSettings = Object.freeze({
  feeInfoEditable: false,
  privateKeyExportEnabled: true,
  tokenEnabled: false,
  txCanBeReplaced: false,

  importedAccountEnabled: true,
  hardwareAccountEnabled: true,
  externalAccountEnabled: false,
  watchingAccountEnabled: true,

  isUTXOModel: false,

  existDeposit: true,

  signOnlyReturnFullTx: true,

  accountNameInfo: {
    default: {
      prefix: 'DOT',
      category: `44'/${COINTYPE_DOT}'`,
      template: `m/44'/${COINTYPE_DOT}'/${INDEX_PLACEHOLDER}'/0'/0'`,
      coinType: COINTYPE_DOT,
    },
  },
});

export default settings;
