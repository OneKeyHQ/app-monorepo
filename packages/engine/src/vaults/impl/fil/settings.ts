import {
  COINTYPE_FIL,
  INDEX_PLACEHOLDER,
} from '@onekeyhq/shared/src/engine/engineConsts';

import type { IVaultSettings } from '../../types';

const settings: IVaultSettings = Object.freeze({
  feeInfoEditable: false,
  privateKeyExportEnabled: true,
  tokenEnabled: false,
  txCanBeReplaced: false,

  importedAccountEnabled: true,
  watchingAccountEnabled: true,
  externalAccountEnabled: false,
  hardwareAccountEnabled: true,

  isUTXOModel: false,

  accountNameInfo: {
    default: {
      prefix: 'FIL',
      category: `44'/${COINTYPE_FIL}'`,
      template: `m/44'/${COINTYPE_FIL}'/0'/0/${INDEX_PLACEHOLDER}`,
      coinType: COINTYPE_FIL,
    },
  },
});

export default settings;
